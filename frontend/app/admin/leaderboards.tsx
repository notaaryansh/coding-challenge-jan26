"use client";

import { FruitChip } from "@/components/fruit-chip";
import type { Fruit } from "@/lib/matching";
import type { LeaderboardEntry, Leaderboards } from "./metrics";

interface Props {
  data: Leaderboards;
}

function shortId(id: string): string {
  const tail = id.split(":").pop() ?? id;
  return `#${tail.slice(-6)}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function attrSummary(fruit: Fruit): string {
  const a = fruit.attributes;
  const parts: string[] = [];
  if (a.size !== null) parts.push(`size ${a.size}`);
  if (a.shineFactor) parts.push(String(a.shineFactor));
  if (a.hasWorm === true) parts.push("wormy");
  if (a.hasStem === true) parts.push("stem");
  if (a.hasLeaf === true) parts.push("leaf");
  if (a.hasChemicals === true) parts.push("chems");
  return parts.join(" · ") || "—";
}

function EntryRow({
  entry,
  trailing,
}: {
  entry: LeaderboardEntry;
  trailing: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <FruitChip fruit={entry.fruit} size="compact" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-xs text-zinc-700 dark:text-zinc-300">
          {shortId(entry.fruit.id)}
        </div>
        <div className="truncate text-[10px] text-zinc-500 dark:text-zinc-500">
          {attrSummary(entry.fruit)}
        </div>
      </div>
      <div className="shrink-0 text-right">{trailing}</div>
    </li>
  );
}

function ScoreTrailing({ value, label }: { value: number; label: string }) {
  return (
    <>
      <div className="text-lg font-semibold tabular-nums leading-none">
        {value}
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </>
  );
}

function Column({
  heading,
  entries,
  empty,
  trailingFor,
}: {
  heading: string;
  entries: LeaderboardEntry[];
  empty: string;
  trailingFor: (entry: LeaderboardEntry) => React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {heading}
      </div>
      {entries.length === 0 ? (
        <div className="py-3 text-xs italic text-zinc-400">{empty}</div>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {entries.map((entry) => (
            <EntryRow
              key={entry.fruit.id}
              entry={entry}
              trailing={trailingFor(entry)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40">
      <div className="mb-5">
        <h3 className="text-base font-semibold">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function PopularityLeaderboards({ data }: Props) {
  const hasWallflowers =
    data.wallflowers.apples.length > 0 || data.wallflowers.oranges.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Popularity leaderboards</h2>
        <p className="text-xs text-zinc-500">
          Top fruits across the currently-unmatched pool.
        </p>
      </div>

      <Card
        title="Most desirable"
        subtitle="In the most opposite-type preference pools — others want them"
      >
        <div className="grid gap-8 md:grid-cols-2">
          <Column
            heading="🍎 Apples"
            entries={data.mostDesirable.apples}
            empty="No unmatched apples"
            trailingFor={(e) => (
              <ScoreTrailing value={e.score} label="want it" />
            )}
          />
          <Column
            heading="🍊 Oranges"
            entries={data.mostDesirable.oranges}
            empty="No unmatched oranges"
            trailingFor={(e) => (
              <ScoreTrailing value={e.score} label="want it" />
            )}
          />
        </div>
      </Card>

      <Card
        title="Pickiest"
        subtitle="Their preferences reject the most of the opposite type"
      >
        <div className="grid gap-8 md:grid-cols-2">
          <Column
            heading="🍎 Apples"
            entries={data.pickiest.apples}
            empty="No unmatched apples"
            trailingFor={(e) => (
              <ScoreTrailing value={e.score} label="rejects" />
            )}
          />
          <Column
            heading="🍊 Oranges"
            entries={data.pickiest.oranges}
            empty="No unmatched oranges"
            trailingFor={(e) => (
              <ScoreTrailing value={e.score} label="rejects" />
            )}
          />
        </div>
      </Card>

      <div
        className={`grid gap-5 ${hasWallflowers ? "md:grid-cols-2" : ""}`}
      >
        <Card
          title="Longest waiting"
          subtitle="Oldest in-progress fruits"
        >
          {data.longestWaiting.length === 0 ? (
            <div className="py-3 text-xs italic text-zinc-400">
              Nobody waiting
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {data.longestWaiting.map((entry) => (
                <EntryRow
                  key={entry.fruit.id}
                  entry={entry}
                  trailing={
                    <>
                      <div className="text-lg font-semibold tabular-nums leading-none">
                        {timeAgo(entry.waitingSince)}
                      </div>
                      <div className="mt-0.5 text-[9px] uppercase tracking-wider text-zinc-500">
                        waiting
                      </div>
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </Card>

        {hasWallflowers && (
          <Card
            title="Wallflowers"
            subtitle="Nobody's preferences accept them right now"
          >
            <div className="grid gap-8 md:grid-cols-2">
              <Column
                heading="🍎 Apples"
                entries={data.wallflowers.apples}
                empty="—"
                trailingFor={() => (
                  <div className="text-[10px] italic text-zinc-400">
                    unwanted
                  </div>
                )}
              />
              <Column
                heading="🍊 Oranges"
                entries={data.wallflowers.oranges}
                empty="—"
                trailingFor={() => (
                  <div className="text-[10px] italic text-zinc-400">
                    unwanted
                  </div>
                )}
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
