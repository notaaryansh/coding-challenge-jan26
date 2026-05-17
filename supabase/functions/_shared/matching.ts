// Deno-compatible mirror of frontend/lib/matching.ts.
// Keep in sync manually; this is the price for not having a shared monorepo package yet.

export type ShineFactor = "dull" | "neutral" | "shiny" | "extraShiny";

export interface FruitAttributes {
  size: number | null;
  weight: number | null;
  hasStem: boolean | null;
  hasLeaf: boolean | null;
  hasWorm: boolean | null;
  shineFactor: ShineFactor | null;
  hasChemicals: boolean | null;
}

export interface NumberRange {
  min?: number;
  max?: number;
}

export interface FruitPreferences {
  size?: NumberRange;
  weight?: NumberRange;
  hasStem?: boolean;
  hasLeaf?: boolean;
  hasWorm?: boolean;
  shineFactor?: ShineFactor | ShineFactor[];
  hasChemicals?: boolean;
}

export interface Fruit {
  id: string;
  type: "apple" | "orange";
  attributes: FruitAttributes;
  preferences: FruitPreferences;
}

export type FilterOp = "equals" | "in" | "range" | "reverse";

export interface FilterStage {
  field: string;
  operation: FilterOp;
  criteria: unknown;
  input_count: number;
  passing_count: number;
  passing_ids: string[];
}

export interface FilterTrace {
  initial_pool_size: number;
  stages: FilterStage[];
  final_candidates: string[];
  selected: string | null;
}

function attrMatches(
  attrs: FruitAttributes,
  field: string,
  criteria: unknown,
): boolean {
  const value = attrs[field as keyof FruitAttributes];
  if (value === null) return false;

  if (field === "shineFactor") {
    if (Array.isArray(criteria)) return criteria.includes(value as ShineFactor);
    return value === criteria;
  }

  if (field === "size" || field === "weight") {
    const range = criteria as NumberRange;
    const n = value as number;
    if (range.min !== undefined && n < range.min) return false;
    if (range.max !== undefined && n > range.max) return false;
    return true;
  }

  return value === criteria;
}

function operationFor(field: string, criteria: unknown): FilterOp {
  if (field === "shineFactor") return Array.isArray(criteria) ? "in" : "equals";
  if (field === "size" || field === "weight") return "range";
  return "equals";
}

export function runMatching(source: Fruit, pool: Fruit[]): FilterTrace {
  const stages: FilterStage[] = [];
  let candidates = pool;

  for (const [field, criteria] of Object.entries(source.preferences ?? {})) {
    if (criteria === undefined) continue;
    const inputCount = candidates.length;
    const passing = candidates.filter((c) =>
      attrMatches(c.attributes, field, criteria)
    );
    stages.push({
      field,
      operation: operationFor(field, criteria),
      criteria,
      input_count: inputCount,
      passing_count: passing.length,
      passing_ids: passing.map((c) => c.id),
    });
    candidates = passing;
  }

  const reverseInput = candidates.length;
  const reverseCompat = candidates.filter((c) =>
    Object.entries(c.preferences ?? {}).every(([f, cr]) =>
      cr === undefined ? true : attrMatches(source.attributes, f, cr)
    )
  );
  stages.push({
    field: "reverse_compat",
    operation: "reverse",
    criteria: "candidate's preferences must accept the source",
    input_count: reverseInput,
    passing_count: reverseCompat.length,
    passing_ids: reverseCompat.map((c) => c.id),
  });

  return {
    initial_pool_size: pool.length,
    stages,
    final_candidates: reverseCompat.map((c) => c.id),
    selected: reverseCompat[0]?.id ?? null,
  };
}
