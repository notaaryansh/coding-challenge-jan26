import { NextResponse } from "next/server";
import {
  attrMatches,
  type FilterTrace,
  type Fruit,
  type FruitAttributes,
  type FruitPreferences,
  type NumberRange,
  type ShineFactor,
} from "@/lib/matching";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RequestBody {
  source: Fruit;
  pool: Fruit[];
  trace: FilterTrace;
  match: Fruit | null;
}

interface NoMatchSuggestion {
  /** The preference field whose relaxation would unlock the most candidates. */
  field: string;
  /** Human-readable current criteria. */
  current: string;
  /** Human-readable suggested relaxation. */
  suggested: string;
  /** Number of candidates that would pass after relaxing this single preference,
   *  holding all others fixed (and still requiring the reverse-acceptance check). */
  unlocked_candidates: number;
}

interface ExplanationResponse {
  text: string;
  /** Present only when match is null and there is a viable loosening. */
  suggestion: NoMatchSuggestion | null;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith("sk-...")) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 },
      );
    }
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const body = (await req.json()) as RequestBody;
    const { source, pool, trace, match } = body;

    const suggestion = match ? null : computeSuggestion(source, pool, trace);

    const prompt = buildPrompt({ source, match, trace, suggestion });

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 220,
        messages: [
          {
            role: "system",
            content:
              "You explain fruit-matchmaking outcomes in 2-3 short sentences. Be concrete, reference the actual attributes and preferences you are given, and never invent numbers — only use counts that appear in the prompt. Plain prose, no markdown, no bullet points.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text().catch(() => "");
      return NextResponse.json(
        { error: `OpenAI ${openaiRes.status}: ${errBody.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const data = (await openaiRes.json()) as {
      choices: { message: { content: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";

    const out: ExplanationResponse = { text, suggestion };
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 },
    );
  }
}

// =============================================================================
// Prompt construction
// =============================================================================

function buildPrompt(args: {
  source: Fruit;
  match: Fruit | null;
  trace: FilterTrace;
  suggestion: NoMatchSuggestion | null;
}): string {
  const { source, match, trace, suggestion } = args;
  const lines: string[] = [];

  lines.push(
    `Initiator (${source.type}, id=${shortId(source.id)}):`,
    `  attributes: ${describeAttrs(source.attributes)}`,
    `  preferences: ${describePrefs(source.preferences)}`,
  );

  if (match) {
    lines.push(
      "",
      `Matched partner (${match.type}, id=${shortId(match.id)}):`,
      `  attributes: ${describeAttrs(match.attributes)}`,
      `  preferences: ${describePrefs(match.preferences)}`,
      "",
      `Pipeline result: matched. ${trace.final_candidates.length} candidate(s) survived all filters; this one was selected (FIFO).`,
      "",
      "Write 2-3 sentences explaining WHY this is a good mutual match. Mention 1-2 specific overlaps between the initiator's preferences and the partner's attributes, AND 1 overlap going the other way (partner wanted X, initiator has X). Speak about the fruits like they are people on a dating app — warm but factual.",
    );
  } else {
    lines.push(
      "",
      `Pipeline result: no match.`,
      `  - After the initiator's preferences: ${trace.intersection.length} candidate(s) survived.`,
      `  - After mutual-acceptance check: ${trace.reverse.passing_ids.length} candidate(s) survived.`,
    );
    if (suggestion) {
      lines.push(
        "",
        `Grounded suggestion (use these EXACT numbers, do not invent any):`,
        `  - Most restrictive preference: ${suggestion.field} (${suggestion.current}).`,
        `  - If relaxed to ${suggestion.suggested}, ${suggestion.unlocked_candidates} candidate(s) would qualify.`,
        "",
        `Write 2-3 sentences. First, briefly say why no match was found (point at the most restrictive preference). Then say: "You could get ${suggestion.unlocked_candidates} match(es) if you change <field> from <current> to <suggested>." Use the exact field name, current value, suggested value, and count from above. Plain prose.`,
      );
    } else {
      lines.push(
        "",
        `No single-preference relaxation would unlock new candidates. Write 2-3 sentences explaining that the initiator's preferences are too strict relative to the current pool, and suggest broadening overall (e.g. dropping shine or worm requirements).`,
      );
    }
  }

  return lines.join("\n");
}

// =============================================================================
// Grounded no-match suggestion: which preference to relax
// =============================================================================

function computeSuggestion(
  source: Fruit,
  pool: Fruit[],
  trace: FilterTrace,
): NoMatchSuggestion | null {
  // For each parallel stage, compute the count we'd get if we DROPPED that one
  // preference (keep all others) and still required the reverse check.
  // The best one to "relax" is the stage that, when removed, unlocks the most.
  const stages = trace.parallel_stages;
  if (stages.length === 0) return null;

  let best: NoMatchSuggestion | null = null;

  for (let i = 0; i < stages.length; i++) {
    const others = stages.filter((_, j) => j !== i);
    const otherSets = others.map((s) => new Set(s.passing_ids));
    const survivors = pool.filter((c) =>
      otherSets.every((set) => set.has(c.id)),
    );
    const passingReverse = survivors.filter((c) =>
      Object.entries(c.preferences ?? {}).every(([f, cr]) =>
        cr === undefined ? true : attrMatches(source.attributes, f, cr),
      ),
    );
    const unlocked = passingReverse.length;
    if (unlocked <= 0) continue;
    if (!best || unlocked > best.unlocked_candidates) {
      best = {
        field: stages[i].field,
        current: describeCriteria(stages[i].field, stages[i].criteria),
        suggested: suggestRelaxation(stages[i].field, stages[i].criteria),
        unlocked_candidates: unlocked,
      };
    }
  }

  return best;
}

function suggestRelaxation(field: string, criteria: unknown): string {
  if (field === "size" || field === "weight") {
    const r = criteria as NumberRange;
    const unit = field === "weight" ? "g" : "";
    if (r.min !== undefined && r.max !== undefined) {
      const span = r.max - r.min;
      const pad = Math.max(1, Math.round(span * 0.5));
      return `any ${field} (drop the [${r.min}${unit}, ${r.max}${unit}] window, or widen it to [${Math.max(0, r.min - pad)}${unit}, ${r.max + pad}${unit}])`;
    }
    if (r.min !== undefined)
      return `drop the minimum (currently ≥ ${r.min}${unit})`;
    if (r.max !== undefined)
      return `drop the maximum (currently ≤ ${r.max}${unit})`;
    return "any";
  }
  if (field === "shineFactor") {
    const all: ShineFactor[] = ["dull", "neutral", "shiny", "extraShiny"];
    if (Array.isArray(criteria)) {
      const missing = all.filter((s) => !criteria.includes(s));
      return `also accept ${missing.join(", ")}`;
    }
    return `accept any shine (not just ${criteria as string})`;
  }
  // Booleans
  if (typeof criteria === "boolean") {
    return `don't require ${field} to be ${criteria}`;
  }
  return "any";
}

// =============================================================================
// Description helpers — also used in the prompt
// =============================================================================

function describeAttrs(a: FruitAttributes): string {
  const parts: string[] = [];
  if (a.size !== null) parts.push(`size=${a.size}`);
  if (a.weight !== null) parts.push(`weight=${a.weight}g`);
  if (a.shineFactor) parts.push(`shine=${a.shineFactor}`);
  if (a.hasStem !== null) parts.push(`stem=${a.hasStem}`);
  if (a.hasLeaf !== null) parts.push(`leaf=${a.hasLeaf}`);
  if (a.hasWorm !== null) parts.push(`worm=${a.hasWorm}`);
  if (a.hasChemicals !== null) parts.push(`chemicals=${a.hasChemicals}`);
  return parts.join(", ") || "(none)";
}

function describePrefs(p: FruitPreferences): string {
  const parts: string[] = [];
  if (p.size) parts.push(`size=${formatRange(p.size)}`);
  if (p.weight) parts.push(`weight=${formatRange(p.weight, "g")}`);
  if (p.shineFactor !== undefined)
    parts.push(
      `shine=${Array.isArray(p.shineFactor) ? `{${p.shineFactor.join("|")}}` : p.shineFactor}`,
    );
  if (p.hasStem !== undefined) parts.push(`stem=${p.hasStem}`);
  if (p.hasLeaf !== undefined) parts.push(`leaf=${p.hasLeaf}`);
  if (p.hasWorm !== undefined) parts.push(`worm=${p.hasWorm}`);
  if (p.hasChemicals !== undefined) parts.push(`chemicals=${p.hasChemicals}`);
  return parts.join(", ") || "(open to anything)";
}

function describeCriteria(field: string, criteria: unknown): string {
  if (field === "size" || field === "weight") {
    return formatRange(criteria as NumberRange, field === "weight" ? "g" : "");
  }
  if (Array.isArray(criteria)) return `one of {${criteria.join(", ")}}`;
  return String(criteria);
}

function formatRange(r: NumberRange, unit = ""): string {
  if (r.min !== undefined && r.max !== undefined)
    return `[${r.min}${unit}, ${r.max}${unit}]`;
  if (r.min !== undefined) return `≥ ${r.min}${unit}`;
  if (r.max !== undefined) return `≤ ${r.max}${unit}`;
  return "any";
}

function shortId(id: string): string {
  const idx = id.indexOf(":");
  return idx >= 0 ? id.slice(idx + 1, idx + 9) : id.slice(0, 8);
}

// Re-export for type-only use elsewhere if needed.
export type { ExplanationResponse, NoMatchSuggestion };
