import { StringRecordId } from "surrealdb";
import { getDb } from "./db.ts";
import {
  type FilterTrace,
  type Fruit,
  runMatching,
} from "./matching.ts";

export interface PersistResult {
  fruit: Fruit;
  match_id: string;
  progress: "in_progress" | "matched";
  partner: Fruit | null;
  trace: FilterTrace;
}

type RawFruit = Omit<Fruit, "id"> & { id?: unknown };

function normalizeFruit(raw: RawFruit): Fruit {
  return { ...(raw as Fruit), id: String(raw.id) };
}

/**
 * Insert the incoming fruit, run the filter pipeline against the unmatched
 * opposite-type pool, and write the resulting match row (matched or in_progress).
 * Cascade-cleans other in_progress traces if a match completes.
 */
export async function persistAndMatch(
  incoming: Omit<Fruit, "id">,
): Promise<PersistResult> {
  const db = await getDb();
  const incomingType = incoming.type;
  const oppositeType = incomingType === "apple" ? "orange" : "apple";

  // ---------------------------------------------------------------------------
  // 1. Insert the new fruit
  // ---------------------------------------------------------------------------
  const created = await db.create("fruit", {
    type: incoming.type,
    attributes: incoming.attributes,
    preferences: incoming.preferences,
    source: "incoming",
    is_matched: false,
  });
  const newFruitRaw = Array.isArray(created) ? created[0] : created;
  const newFruit = normalizeFruit(newFruitRaw as RawFruit);

  // ---------------------------------------------------------------------------
  // 2. Build the FIFO-ordered candidate pool
  //    in_progress opposite fruits first (longest-waiting), then others by age
  // ---------------------------------------------------------------------------
  const unmatchedRes = await db.query<[RawFruit[]]>(
    `SELECT * FROM fruit WHERE type = $t AND is_matched = false ORDER BY created_at ASC`,
    { t: oppositeType },
  );
  const unmatched = (unmatchedRes[0] ?? []).map(normalizeFruit);

  const inProgRes = await db.query<[Array<Record<string, unknown>>]>(
    `SELECT * FROM match WHERE progress = "in_progress" AND ${oppositeType} IS NOT NONE ORDER BY created_at ASC`,
  );
  const inProgMatches = inProgRes[0] ?? [];

  // Map fruit id -> in_progress match (so we can update it on completion)
  const inProgByFruitId = new Map<string, Record<string, unknown>>();
  for (const m of inProgMatches) {
    const fruitId = String(m[oppositeType]);
    inProgByFruitId.set(fruitId, m);
  }

  const inProgFruits = unmatched
    .filter((f) => inProgByFruitId.has(f.id))
    .sort((a, b) => {
      const ma = inProgByFruitId.get(a.id)!;
      const mb = inProgByFruitId.get(b.id)!;
      return (
        new Date(String(ma.created_at)).getTime() -
        new Date(String(mb.created_at)).getTime()
      );
    });
  const freshFruits = unmatched.filter((f) => !inProgByFruitId.has(f.id));
  const orderedPool = [...inProgFruits, ...freshFruits];

  // ---------------------------------------------------------------------------
  // 3. Run filter pipeline
  // ---------------------------------------------------------------------------
  const trace = runMatching(newFruit, orderedPool);

  // ---------------------------------------------------------------------------
  // 4. Persist outcome
  // ---------------------------------------------------------------------------
  if (trace.selected) {
    return await completeMatch({
      db,
      newFruit,
      winnerId: trace.selected,
      winnerFruit: orderedPool.find((f) => f.id === trace.selected) ?? null,
      existingInProgMatch: inProgByFruitId.get(trace.selected) ?? null,
      trace,
    });
  }
  return await createInProgress({ db, newFruit, trace });
}

// =============================================================================
// Internal helpers
// =============================================================================

async function completeMatch({
  db,
  newFruit,
  winnerId,
  winnerFruit,
  existingInProgMatch,
  trace,
}: {
  db: Awaited<ReturnType<typeof getDb>>;
  newFruit: Fruit;
  winnerId: string;
  winnerFruit: Fruit | null;
  existingInProgMatch: Record<string, unknown> | null;
  trace: FilterTrace;
}): Promise<PersistResult> {
  const incomingType = newFruit.type;
  const oppositeType = incomingType === "apple" ? "orange" : "apple";

  let matchId: string;

  const newFruitRef = new StringRecordId(newFruit.id);
  const winnerRef = new StringRecordId(winnerId);

  if (existingInProgMatch) {
    // Complete the existing in_progress row
    matchId = String(existingInProgMatch.id);
    const matchRef = new StringRecordId(matchId);
    await db.query(
      `
      BEGIN TRANSACTION;
      UPDATE $match_id SET
        ${incomingType} = $new_fruit_id,
        progress = "matched",
        matched_at = time::now(),
        filter_trace = $trace;
      UPDATE $new_fruit_id SET is_matched = true;
      UPDATE $winner_id SET is_matched = true;
      COMMIT TRANSACTION;
      `,
      {
        match_id: matchRef,
        new_fruit_id: newFruitRef,
        winner_id: winnerRef,
        trace,
      },
    );
  } else {
    // Create a fresh match row (both sides filled, status matched)
    const createRes = await db.query<[Array<{ id: unknown }>]>(
      `
      BEGIN TRANSACTION;
      LET $m = (CREATE ONLY match SET
        initiator = $initiator,
        ${incomingType} = $new_fruit_id,
        ${oppositeType} = $winner_id,
        progress = "matched",
        matched_at = time::now(),
        filter_trace = $trace
      );
      UPDATE $new_fruit_id SET is_matched = true;
      UPDATE $winner_id SET is_matched = true;
      RETURN $m;
      COMMIT TRANSACTION;
      `,
      {
        initiator: incomingType,
        new_fruit_id: newFruitRef,
        winner_id: winnerRef,
        trace,
      },
    );
    const createdRow = Array.isArray(createRes[0])
      ? createRes[0][0]
      : createRes[0];
    matchId = String((createdRow as { id: unknown }).id);
  }

  // Cascade: scrub matched fruit IDs from all OTHER in_progress traces
  await cascadeClean(db, matchId, [newFruit.id, winnerId]);

  return {
    fruit: newFruit,
    match_id: matchId,
    progress: "matched",
    partner: winnerFruit,
    trace,
  };
}

async function createInProgress({
  db,
  newFruit,
  trace,
}: {
  db: Awaited<ReturnType<typeof getDb>>;
  newFruit: Fruit;
  trace: FilterTrace;
}): Promise<PersistResult> {
  const created = await db.create("match", {
    initiator: newFruit.type,
    [newFruit.type]: new StringRecordId(newFruit.id),
    progress: "in_progress",
    filter_trace: trace,
  });
  const row = Array.isArray(created) ? created[0] : created;
  return {
    fruit: newFruit,
    match_id: String((row as { id: unknown }).id),
    progress: "in_progress",
    partner: null,
    trace,
  };
}

/**
 * Remove the now-matched fruit IDs from every other in_progress row's
 * filter_trace so the UI never displays stale candidates as "still available."
 * Done in JS for clarity — fine for our scope; would be one SurrealQL
 * statement in production at scale.
 */
async function cascadeClean(
  db: Awaited<ReturnType<typeof getDb>>,
  excludeMatchId: string,
  idsToRemove: string[],
): Promise<void> {
  const remove = new Set(idsToRemove);
  const res = await db.query<[Array<Record<string, unknown>>]>(
    `SELECT * FROM match WHERE progress = "in_progress" AND id != $excluded`,
    { excluded: excludeMatchId },
  );
  const rows = res[0] ?? [];

  for (const row of rows) {
    const trace = row.filter_trace as FilterTrace | undefined;
    if (!trace) continue;
    let dirty = false;

    for (const stage of trace.stages ?? []) {
      const before = stage.passing_ids.length;
      stage.passing_ids = stage.passing_ids.filter((id) => !remove.has(id));
      if (stage.passing_ids.length !== before) {
        stage.passing_count = stage.passing_ids.length;
        dirty = true;
      }
    }
    const finalsBefore = trace.final_candidates?.length ?? 0;
    trace.final_candidates = (trace.final_candidates ?? []).filter(
      (id) => !remove.has(id),
    );
    if ((trace.final_candidates?.length ?? 0) !== finalsBefore) dirty = true;

    if (dirty) {
      await db.merge(new StringRecordId(String(row.id)), {
        filter_trace: trace,
      });
    }
  }
}
