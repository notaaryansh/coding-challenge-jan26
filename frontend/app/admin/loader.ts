import { getDb } from "@/lib/db";
import type { FilterTrace, Fruit } from "@/lib/matching";
import {
  computeLeaderboards,
  computeNearMiss,
  type Leaderboards,
  type NearMissData,
} from "./metrics";

export interface MatchRow {
  id: string;
  initiator: "apple" | "orange";
  progress: "matched" | "in_progress";
  created_at: string | null;
  matched_at: string | null;
  apple: Fruit | null;
  orange: Fruit | null;
  trace: FilterTrace | null;
}

export interface AdminData {
  matches: MatchRow[];
  fruitById: Record<string, Fruit>;
  counts: {
    totalMatches: number;
    inProgress: number;
    matched: number;
    apples: number;
    oranges: number;
    unmatchedApples: number;
    unmatchedOranges: number;
  };
  nearMiss: NearMissData;
  leaderboards: Leaderboards;
}

type RawFruit = Omit<Fruit, "id"> & { id: unknown };

interface RawMatch {
  id: unknown;
  initiator: "apple" | "orange";
  progress: "matched" | "in_progress";
  created_at?: string;
  matched_at?: string;
  apple?: RawFruit | unknown;
  orange?: RawFruit | unknown;
  filter_trace?: FilterTrace;
}

function normalizeFruit(raw: RawFruit | null | undefined): Fruit | null {
  if (!raw || typeof raw !== "object" || !("attributes" in raw)) return null;
  return { ...(raw as Fruit), id: String((raw as RawFruit).id) };
}

export async function getAdminData(): Promise<AdminData> {
  const db = await getDb();

  const [matchRows, allFruits] = await db.query<[RawMatch[], RawFruit[]]>(`
    SELECT * FROM match ORDER BY created_at DESC FETCH apple, orange;
    SELECT * FROM fruit;
  `);

  const fruitById: Record<string, Fruit> = {};
  for (const raw of allFruits ?? []) {
    const f = normalizeFruit(raw);
    if (f) fruitById[f.id] = f;
  }

  const matches: MatchRow[] = (matchRows ?? []).map((m) => ({
    id: String(m.id),
    initiator: m.initiator,
    progress: m.progress,
    created_at: m.created_at ?? null,
    matched_at: m.matched_at ?? null,
    apple: normalizeFruit(m.apple as RawFruit | null | undefined),
    orange: normalizeFruit(m.orange as RawFruit | null | undefined),
    trace: m.filter_trace ?? null,
  }));

  const apples = Object.values(fruitById).filter((f) => f.type === "apple").length;
  const oranges = Object.values(fruitById).filter((f) => f.type === "orange").length;
  const matchedCount = matches.filter((m) => m.progress === "matched").length;
  const inProgressCount = matches.filter((m) => m.progress === "in_progress").length;

  // Build the set of fruit IDs that are currently locked into a completed match,
  // and capture when each in-progress fruit started waiting.
  const matchedFruitIds = new Set<string>();
  const waitingSince = new Map<string, string>();
  for (const m of matches) {
    if (m.progress === "matched") {
      if (m.apple) matchedFruitIds.add(m.apple.id);
      if (m.orange) matchedFruitIds.add(m.orange.id);
    } else if (m.progress === "in_progress" && m.created_at) {
      if (m.apple) waitingSince.set(m.apple.id, m.created_at);
      if (m.orange) waitingSince.set(m.orange.id, m.created_at);
    }
  }

  const unmatchedApples = Object.values(fruitById).filter(
    (f) => f.type === "apple" && !matchedFruitIds.has(f.id),
  );
  const unmatchedOranges = Object.values(fruitById).filter(
    (f) => f.type === "orange" && !matchedFruitIds.has(f.id),
  );

  const nearMiss = computeNearMiss(unmatchedApples, unmatchedOranges, matchedCount);
  const leaderboards = computeLeaderboards(unmatchedApples, unmatchedOranges, waitingSince);

  return {
    matches,
    fruitById,
    counts: {
      totalMatches: matches.length,
      matched: matchedCount,
      inProgress: inProgressCount,
      apples,
      oranges,
      unmatchedApples: unmatchedApples.length,
      unmatchedOranges: unmatchedOranges.length,
    },
    nearMiss,
    leaderboards,
  };
}
