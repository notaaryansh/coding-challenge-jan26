import { attrMatches, type Fruit } from "@/lib/matching";

export interface FailedPref {
  side: "apple" | "orange";
  field: string;
  criteria: unknown;
}

export interface NearMissPair {
  apple: Fruit;
  orange: Fruit;
  distance: number;
  failedPrefs: FailedPref[];
}

export interface NearMissBucket {
  key: string;
  label: string;
  count: number;
  pairs: NearMissPair[];
}

export interface NearMissData {
  totalUnmatchedPairs: number;
  matchedPairCount: number;
  buckets: NearMissBucket[];
}

export interface LeaderboardEntry {
  fruit: Fruit;
  score: number;
  waitingSince: string | null;
}

export interface Leaderboards {
  mostDesirable: { apples: LeaderboardEntry[]; oranges: LeaderboardEntry[] };
  wallflowers: { apples: LeaderboardEntry[]; oranges: LeaderboardEntry[] };
  pickiest: { apples: LeaderboardEntry[]; oranges: LeaderboardEntry[] };
  longestWaiting: LeaderboardEntry[];
}

const TOP_N = 5;
const MAX_PAIRS_PER_BUCKET = 30;

function failedPrefsAgainst(
  target: Fruit,
  source: Fruit,
): { field: string; criteria: unknown }[] {
  const failed: { field: string; criteria: unknown }[] = [];
  for (const [field, criteria] of Object.entries(source.preferences ?? {})) {
    if (criteria === undefined) continue;
    if (!attrMatches(target.attributes, field, criteria)) {
      failed.push({ field, criteria });
    }
  }
  return failed;
}

function passesPreferences(target: Fruit, source: Fruit): boolean {
  return failedPrefsAgainst(target, source).length === 0;
}

export function computeNearMiss(
  unmatchedApples: Fruit[],
  unmatchedOranges: Fruit[],
  matchedPairCount: number,
): NearMissData {
  const bucket1: NearMissPair[] = [];
  const bucket2: NearMissPair[] = [];
  let count3to5 = 0;
  let count6plus = 0;

  for (const apple of unmatchedApples) {
    for (const orange of unmatchedOranges) {
      const appleFails = failedPrefsAgainst(orange, apple);
      const orangeFails = failedPrefsAgainst(apple, orange);
      const distance = appleFails.length + orangeFails.length;

      if (distance === 1 || distance === 2) {
        const pair: NearMissPair = {
          apple,
          orange,
          distance,
          failedPrefs: [
            ...appleFails.map((f) => ({ side: "apple" as const, ...f })),
            ...orangeFails.map((f) => ({ side: "orange" as const, ...f })),
          ],
        };
        if (distance === 1) bucket1.push(pair);
        else bucket2.push(pair);
      } else if (distance >= 3 && distance <= 5) {
        count3to5++;
      } else if (distance >= 6) {
        count6plus++;
      }
    }
  }

  return {
    totalUnmatchedPairs: unmatchedApples.length * unmatchedOranges.length,
    matchedPairCount,
    buckets: [
      { key: "0", label: "Matched", count: matchedPairCount, pairs: [] },
      {
        key: "1",
        label: "1 pref away",
        count: bucket1.length,
        pairs: bucket1.slice(0, MAX_PAIRS_PER_BUCKET),
      },
      {
        key: "2",
        label: "2 prefs away",
        count: bucket2.length,
        pairs: bucket2.slice(0, MAX_PAIRS_PER_BUCKET),
      },
      { key: "3-5", label: "3–5 prefs away", count: count3to5, pairs: [] },
      { key: "6+", label: "6+ prefs away", count: count6plus, pairs: [] },
    ],
  };
}

export function computeLeaderboards(
  unmatchedApples: Fruit[],
  unmatchedOranges: Fruit[],
  waitingSince: Map<string, string>,
): Leaderboards {
  const appleDesirability = new Map<string, number>();
  const orangeDesirability = new Map<string, number>();
  const applePickiness = new Map<string, number>();
  const orangePickiness = new Map<string, number>();

  for (const apple of unmatchedApples) {
    appleDesirability.set(apple.id, 0);
    applePickiness.set(apple.id, 0);
  }
  for (const orange of unmatchedOranges) {
    orangeDesirability.set(orange.id, 0);
    orangePickiness.set(orange.id, 0);
  }

  for (const apple of unmatchedApples) {
    for (const orange of unmatchedOranges) {
      const applePrefsAcceptOrange = passesPreferences(orange, apple);
      const orangePrefsAcceptApple = passesPreferences(apple, orange);

      if (orangePrefsAcceptApple) {
        appleDesirability.set(
          apple.id,
          (appleDesirability.get(apple.id) ?? 0) + 1,
        );
      } else {
        orangePickiness.set(
          orange.id,
          (orangePickiness.get(orange.id) ?? 0) + 1,
        );
      }
      if (applePrefsAcceptOrange) {
        orangeDesirability.set(
          orange.id,
          (orangeDesirability.get(orange.id) ?? 0) + 1,
        );
      } else {
        applePickiness.set(
          apple.id,
          (applePickiness.get(apple.id) ?? 0) + 1,
        );
      }
    }
  }

  const toEntry = (fruit: Fruit, score: number): LeaderboardEntry => ({
    fruit,
    score,
    waitingSince: waitingSince.get(fruit.id) ?? null,
  });

  const sortedByScore = (
    fruits: Fruit[],
    scoreMap: Map<string, number>,
  ): LeaderboardEntry[] =>
    fruits
      .map((f) => toEntry(f, scoreMap.get(f.id) ?? 0))
      .sort((a, b) => b.score - a.score);

  const desirableApples = sortedByScore(unmatchedApples, appleDesirability).slice(0, TOP_N);
  const desirableOranges = sortedByScore(unmatchedOranges, orangeDesirability).slice(0, TOP_N);

  const wallflowerApples = unmatchedApples
    .map((f) => toEntry(f, appleDesirability.get(f.id) ?? 0))
    .filter((e) => e.score === 0)
    .slice(0, TOP_N);
  const wallflowerOranges = unmatchedOranges
    .map((f) => toEntry(f, orangeDesirability.get(f.id) ?? 0))
    .filter((e) => e.score === 0)
    .slice(0, TOP_N);

  const pickyApples = sortedByScore(unmatchedApples, applePickiness).slice(0, TOP_N);
  const pickyOranges = sortedByScore(unmatchedOranges, orangePickiness).slice(0, TOP_N);

  const waitingEntries: LeaderboardEntry[] = [];
  for (const f of [...unmatchedApples, ...unmatchedOranges]) {
    const ws = waitingSince.get(f.id);
    if (ws) waitingEntries.push({ fruit: f, score: 0, waitingSince: ws });
  }
  const longestWaiting = waitingEntries
    .sort(
      (a, b) =>
        new Date(a.waitingSince!).getTime() -
        new Date(b.waitingSince!).getTime(),
    )
    .slice(0, TOP_N);

  return {
    mostDesirable: { apples: desirableApples, oranges: desirableOranges },
    wallflowers: { apples: wallflowerApples, oranges: wallflowerOranges },
    pickiest: { apples: pickyApples, oranges: pickyOranges },
    longestWaiting,
  };
}
