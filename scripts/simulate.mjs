#!/usr/bin/env node
// One-shot end-to-end simulation:
//   1. wipes ALL match rows and ALL fruit rows (true clean slate)
//   2. re-seeds fruits from data/raw_apples_and_oranges.json
//   3. iterates every apple in created_at order and treats it as an incoming
//      conversation — runs the same 3-pass matching pipeline against the
//      currently-unmatched oranges, writes a match row, and cascade-cleans.
//   4. writes a status record to `system:init` so the dashboard can show a
//      "Initializing..." spinner while this runs.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Surreal, { StringRecordId } from "surrealdb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, "../data/raw_apples_and_oranges.json");
const SCHEMA_PATH = resolve(__dirname, "./schema.surql");

const {
  SURREALDB_URL = "ws://localhost:8000",
  SURREALDB_USER = "root",
  SURREALDB_PASS = "root",
  SURREALDB_NS = "clera",
  SURREALDB_DB = "matchmaking",
} = process.env;

const db = new Surreal();

async function main() {
  console.log(`→ connecting to ${SURREALDB_URL}`);
  await db.connect(SURREALDB_URL);
  await db.signin({ username: SURREALDB_USER, password: SURREALDB_PASS });
  await db.use({ namespace: SURREALDB_NS, database: SURREALDB_DB });

  // ---------------------------------------------------------------------------
  // Status: running
  // ---------------------------------------------------------------------------
  await db.query(
    `UPDATE system:init MERGE {
       status: "running",
       processed: 0,
       total: 0,
       started_at: time::now(),
       finished_at: NONE
     }`,
  );

  // ---------------------------------------------------------------------------
  // Full reset — wipe matches AND fruits, then re-seed from data.json
  // ---------------------------------------------------------------------------
  console.log("→ wiping match + fruit tables");
  await db.query(`DELETE match`);
  await db.query(`DELETE fruit`);

  console.log("→ applying schema (idempotent)");
  const schema = await readFile(SCHEMA_PATH, "utf8");
  await db.query(schema);

  console.log("→ seeding fruits from data.json");
  const rawSeed = await readFile(SEED_PATH, "utf8");
  const seedFruits = JSON.parse(rawSeed);
  for (const fruit of seedFruits) {
    await db.create("fruit", { ...fruit, source: "seed" });
  }
  console.log(`  inserted ${seedFruits.length} fruits`);

  // ---------------------------------------------------------------------------
  // Pull apples in created_at order — each will act as an "incoming conversation"
  // ---------------------------------------------------------------------------
  const [apples] = await db.query(
    `SELECT * FROM fruit WHERE type = "apple" ORDER BY created_at ASC`,
  );
  const totalApples = apples?.length ?? 0;
  console.log(`→ ${totalApples} apples to process`);

  await db.query(`UPDATE system:init SET total = $t`, { t: totalApples });

  let matched = 0;
  let queued = 0;

  for (let i = 0; i < apples.length; i++) {
    const apple = normalize(apples[i]);
    const result = await processOne(apple);
    if (result === "matched") matched++;
    else queued++;
    await db.query(`UPDATE system:init SET processed = $p`, { p: i + 1 });
    console.log(
      `  [${i + 1}/${totalApples}] apple ${apple.id.slice(-8)} → ${result}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Status: done
  // ---------------------------------------------------------------------------
  await db.query(
    `UPDATE system:init MERGE {
       status: "done",
       finished_at: time::now()
     }`,
  );

  console.log(
    `✓ simulation done — ${matched} matched, ${queued} queued (in_progress)`,
  );
  await db.close();
}

// =============================================================================
// processOne — replicates persistAndMatch for an EXISTING apple
// =============================================================================

async function processOne(apple) {
  // FIFO-ordered candidate pool: in_progress oranges first (longest-waiting),
  // then fresh oranges by age. Matches the supabase match-persistence logic.
  const [unmatchedRaw] = await db.query(
    `SELECT * FROM fruit
     WHERE type = "orange" AND is_matched = false
     ORDER BY created_at ASC`,
  );
  const unmatched = (unmatchedRaw ?? []).map(normalize);

  const [inProgRaw] = await db.query(
    `SELECT * FROM match WHERE progress = "in_progress" AND orange IS NOT NONE ORDER BY created_at ASC`,
  );
  const inProgMatches = inProgRaw ?? [];
  const inProgByFruitId = new Map();
  for (const m of inProgMatches) {
    inProgByFruitId.set(String(m.orange), m);
  }
  const inProgFruits = unmatched
    .filter((f) => inProgByFruitId.has(f.id))
    .sort((a, b) => {
      const ma = inProgByFruitId.get(a.id);
      const mb = inProgByFruitId.get(b.id);
      return new Date(ma.created_at).getTime() - new Date(mb.created_at).getTime();
    });
  const freshFruits = unmatched.filter((f) => !inProgByFruitId.has(f.id));
  const orderedPool = [...inProgFruits, ...freshFruits];

  const trace = runMatching(apple, orderedPool);

  if (trace.selected) {
    const winnerId = trace.selected;
    const existingInProg = inProgByFruitId.get(winnerId) ?? null;
    const appleRef = new StringRecordId(apple.id);
    const winnerRef = new StringRecordId(winnerId);

    if (existingInProg) {
      const matchRef = new StringRecordId(String(existingInProg.id));
      await db.query(
        `BEGIN TRANSACTION;
         UPDATE $match_id SET apple = $apple_id, progress = "matched", matched_at = time::now(), filter_trace = $trace;
         UPDATE $apple_id SET is_matched = true;
         UPDATE $winner_id SET is_matched = true;
         COMMIT TRANSACTION;`,
        {
          match_id: matchRef,
          apple_id: appleRef,
          winner_id: winnerRef,
          trace,
        },
      );
      await cascadeClean(String(existingInProg.id), [apple.id, winnerId]);
    } else {
      const [createRes] = await db.query(
        `BEGIN TRANSACTION;
         LET $m = (CREATE ONLY match SET initiator = "apple", apple = $apple_id, orange = $winner_id, progress = "matched", matched_at = time::now(), filter_trace = $trace);
         UPDATE $apple_id SET is_matched = true;
         UPDATE $winner_id SET is_matched = true;
         RETURN $m;
         COMMIT TRANSACTION;`,
        { apple_id: appleRef, winner_id: winnerRef, trace },
      );
      const createdRow = Array.isArray(createRes) ? createRes[0] : createRes;
      const matchId = String(createdRow.id);
      await cascadeClean(matchId, [apple.id, winnerId]);
    }
    return "matched";
  }

  // No match — queue as in_progress
  await db.create("match", {
    initiator: "apple",
    apple: new StringRecordId(apple.id),
    progress: "in_progress",
    filter_trace: trace,
  });
  return "queued";
}

// =============================================================================
// runMatching — ported from frontend/lib/matching.ts
// =============================================================================

function attrMatches(attrs, field, criteria) {
  const value = attrs[field];
  if (value === null || value === undefined) return false;

  if (field === "shineFactor") {
    if (Array.isArray(criteria)) return criteria.includes(value);
    return value === criteria;
  }

  if (field === "size" || field === "weight") {
    if (criteria.min !== undefined && value < criteria.min) return false;
    if (criteria.max !== undefined && value > criteria.max) return false;
    return true;
  }

  return value === criteria;
}

function operationFor(field, criteria) {
  if (field === "shineFactor") return Array.isArray(criteria) ? "in" : "equals";
  if (field === "size" || field === "weight") return "range";
  return "equals";
}

function runMatching(source, pool) {
  const parallel_stages = [];
  for (const [field, criteria] of Object.entries(source.preferences ?? {})) {
    if (criteria === undefined) continue;
    const passing = pool.filter((c) => attrMatches(c.attributes, field, criteria));
    parallel_stages.push({
      field,
      operation: operationFor(field, criteria),
      criteria,
      passing_ids: passing.map((c) => c.id),
    });
  }

  let intersection;
  if (parallel_stages.length === 0) {
    intersection = [...pool];
  } else {
    const passingSets = parallel_stages.map((s) => new Set(s.passing_ids));
    intersection = pool.filter((c) => passingSets.every((set) => set.has(c.id)));
  }

  const reversePassing = intersection.filter((c) =>
    Object.entries(c.preferences ?? {}).every(([f, cr]) =>
      cr === undefined ? true : attrMatches(source.attributes, f, cr),
    ),
  );

  return {
    initial_pool_size: pool.length,
    parallel_stages,
    intersection: intersection.map((c) => c.id),
    reverse: {
      input_ids: intersection.map((c) => c.id),
      passing_ids: reversePassing.map((c) => c.id),
    },
    final_candidates: reversePassing.map((c) => c.id),
    selected: reversePassing[0]?.id ?? null,
  };
}

// =============================================================================
// cascadeClean — strip newly-matched fruit IDs from all OTHER in_progress traces
// =============================================================================

async function cascadeClean(excludeMatchId, idsToRemove) {
  const remove = new Set(idsToRemove);
  const [rows] = await db.query(
    `SELECT * FROM match WHERE progress = "in_progress" AND id != $excluded`,
    { excluded: new StringRecordId(excludeMatchId.replace(/^match:/, "")) },
  );
  for (const row of rows ?? []) {
    const trace = row.filter_trace;
    if (!trace) continue;
    let dirty = false;
    const scrub = (ids) => {
      const arr = ids ?? [];
      const filtered = arr.filter((id) => !remove.has(id));
      if (filtered.length !== arr.length) dirty = true;
      return filtered;
    };
    for (const stage of trace.parallel_stages ?? []) {
      stage.passing_ids = scrub(stage.passing_ids);
    }
    trace.intersection = scrub(trace.intersection);
    if (trace.reverse) {
      trace.reverse.input_ids = scrub(trace.reverse.input_ids);
      trace.reverse.passing_ids = scrub(trace.reverse.passing_ids);
    }
    trace.final_candidates = scrub(trace.final_candidates);
    if (dirty) {
      await db.merge(new StringRecordId(String(row.id).replace(/^match:/, "")), {
        filter_trace: trace,
      });
    }
  }
}

// =============================================================================

function normalize(raw) {
  return { ...raw, id: String(raw.id) };
}

main().catch(async (err) => {
  console.error("✗ simulate failed:", err);
  try {
    await db.query(
      `UPDATE system:init MERGE { status: "error", error: $msg, finished_at: time::now() }`,
      { msg: String(err?.message ?? err) },
    );
    await db.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
