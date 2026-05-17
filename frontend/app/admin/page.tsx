import { NavTabs } from "@/components/nav-tabs";
import { PopularityLeaderboards } from "./leaderboards";
import { getAdminData } from "./loader";
import { MatchRowCard } from "./match-row";
import { NearMissHistogram } from "./near-miss-histogram";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const data = await getAdminData();

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Admin — Match Explorer
              </h1>
              <p className="mt-1 text-sm text-muted">
                Every match row in the DB, with its stored filter_trace.
              </p>
            </div>
            <NavTabs />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-6 py-10">
        <section>
          <StatBar
            stats={[
              {
                label: "Matched",
                value: data.counts.matched,
                accent: "emerald",
              },
              {
                label: "In progress",
                value: data.counts.inProgress,
                accent: "amber",
              },
              {
                label: "Total matches",
                value: data.counts.totalMatches,
              },
              {
                label: "🍎 unmatched",
                value: data.counts.unmatchedApples,
              },
              {
                label: "🍊 unmatched",
                value: data.counts.unmatchedOranges,
              },
            ]}
          />
        </section>

        <section>
          <NearMissHistogram data={data.nearMiss} />
        </section>

        <section>
          <PopularityLeaderboards data={data.leaderboards} />
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">All matches</h2>
            <span className="text-xs text-zinc-500">
              {data.matches.length} total
            </span>
          </div>
          {data.matches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40">
              No matches yet. Run a new conversation from the dashboard to
              create one.
            </div>
          ) : (
            <div className="space-y-2">
              {data.matches.map((m) => (
                <MatchRowCard
                  key={m.id}
                  match={m}
                  fruitById={data.fruitById}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

interface Stat {
  label: string;
  value: number;
  accent?: "emerald" | "amber";
}

function StatBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0 md:grid-cols-5 dark:divide-zinc-800/80 dark:border-zinc-800/80 dark:bg-zinc-900/40">
      {stats.map((s) => (
        <div key={s.label} className="px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {s.label}
          </div>
          <div
            className={`mt-1 text-3xl font-semibold tabular-nums ${
              s.accent === "emerald"
                ? "text-emerald-600 dark:text-emerald-400"
                : s.accent === "amber"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-900 dark:text-zinc-100"
            }`}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
