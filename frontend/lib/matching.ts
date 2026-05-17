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

export type FilterOp = "equals" | "in" | "range";

/** Apple-side preference filter, applied independently to the FULL pool. */
export interface ParallelStage {
  field: string;
  operation: FilterOp;
  criteria: unknown;
  passing_ids: string[];
}

/** Reverse compatibility check — applied AFTER intersection. */
export interface ReverseStage {
  input_ids: string[];
  passing_ids: string[];
}

export interface FilterTrace {
  initial_pool_size: number;
  /** Each apple preference run independently against the whole pool. */
  parallel_stages: ParallelStage[];
  /** Fruits that passed every parallel stage (∩ of all passing_ids). */
  intersection: string[];
  /** Reverse compatibility check applied to the intersection. */
  reverse: ReverseStage;
  /** Same as reverse.passing_ids — final candidate set. */
  final_candidates: string[];
  /** FIFO winner from final_candidates, or null. */
  selected: string | null;
}

export function attrMatches(
  attrs: FruitAttributes,
  field: string,
  criteria: unknown
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
  // Step 1: independent filters — each preference evaluated against the FULL pool
  const parallel_stages: ParallelStage[] = [];
  for (const [field, criteria] of Object.entries(source.preferences ?? {})) {
    if (criteria === undefined) continue;
    const passing = pool.filter((c) =>
      attrMatches(c.attributes, field, criteria)
    );
    parallel_stages.push({
      field,
      operation: operationFor(field, criteria),
      criteria,
      passing_ids: passing.map((c) => c.id),
    });
  }

  // Step 2: intersect — fruits that passed every parallel stage
  let intersection: Fruit[];
  if (parallel_stages.length === 0) {
    intersection = [...pool];
  } else {
    const passingSets = parallel_stages.map((s) => new Set(s.passing_ids));
    intersection = pool.filter((c) => passingSets.every((set) => set.has(c.id)));
  }

  // Step 3: reverse check on the intersection
  const reversePassing = intersection.filter((c) =>
    Object.entries(c.preferences ?? {}).every(([f, cr]) =>
      cr === undefined ? true : attrMatches(source.attributes, f, cr)
    )
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
