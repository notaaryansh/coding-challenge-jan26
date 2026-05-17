import { getDb } from "@/lib/db";
import type { MatchMetrics } from "./page";

// =============================================================================
// ⚠️  DISCLAIMER
// =============================================================================
// This loader is EXAMPLE SCAFFOLDING. You should:
// - Define your own data types based on your solution
// - Implement actual database queries to SurrealDB
// - Add whatever data fetching logic your dashboard needs
//
// The structure here is just one possible approach - feel free to do
// something completely different!
// =============================================================================

export interface DashboardData {
  metrics: MatchMetrics;
  // Add whatever your dashboard needs!
}

/**
 * Server-side data loader for the dashboard page.
 *
 * ⚠️ This is placeholder code! Replace with your actual implementation.
 *
 * This function runs on the server and can:
 * - Query SurrealDB directly
 * - Call edge functions
 * - Access server-only resources
 */
export async function getDashboardData(): Promise<DashboardData> {
  const db = await getDb();

  const [apples, oranges, matched, inProgress] = await db.query<
    [
      Array<{ count: number }>,
      Array<{ count: number }>,
      Array<{ count: number }>,
      Array<{ count: number }>,
    ]
  >(`
    SELECT count() FROM fruit WHERE type = "apple" GROUP ALL;
    SELECT count() FROM fruit WHERE type = "orange" GROUP ALL;
    SELECT count() FROM match WHERE progress = "matched" GROUP ALL;
    SELECT count() FROM match WHERE progress = "in_progress" GROUP ALL;
  `);

  const matchedCount = matched[0]?.count ?? 0;
  const inProgressCount = inProgress[0]?.count ?? 0;
  const totalConversations = matchedCount + inProgressCount;
  const successRate =
    totalConversations > 0
      ? Math.round((matchedCount / totalConversations) * 100)
      : 0;

  const metrics: MatchMetrics = {
    totalApples: apples[0]?.count ?? 0,
    totalOranges: oranges[0]?.count ?? 0,
    totalMatches: matchedCount,
    successRate,
  };

  return { metrics };
}
