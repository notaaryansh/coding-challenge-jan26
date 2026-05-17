"use client";

import { useState } from "react";
import { FruitChip } from "@/components/fruit-chip";
import type { NearMissData, NearMissPair } from "./metrics";
import { PairDetailModal } from "./pair-detail-modal";

interface Props {
  data: NearMissData;
}

const BUCKET_BAR: Record<string, string> = {
  "0": "bg-emerald-400/80 dark:bg-emerald-500/70",
  "1": "bg-amber-400/80 dark:bg-amber-500/70",
  "2": "bg-orange-400/80 dark:bg-orange-500/70",
  "3-5": "bg-zinc-300 dark:bg-zinc-700",
  "6+": "bg-zinc-400 dark:bg-zinc-600",
};

function formatCriteria(criteria: unknown): string {
  if (criteria === true) return "yes";
  if (criteria === false) return "no";
  if (Array.isArray(criteria)) return criteria.join(" / ");
  if (typeof criteria === "object" && criteria !== null) {
    const r = criteria as { min?: number; max?: number };
    if (r.min !== undefined && r.max !== undefined) return `${r.min}–${r.max}`;
    if (r.min !== undefined) return `≥ ${r.min}`;
    if (r.max !== undefined) return `≤ ${r.max}`;
    return JSON.stringify(criteria);
  }
  return String(criteria);
}

function describeUnlock(pair: NearMissPair): React.ReactNode {
  return pair.failedPrefs.map((p, i) => (
    <span key={i} className="inline-flex items-center gap-1">
      {i > 0 && <span className="text-zinc-400">+</span>}
      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-zinc-800">
        {p.side === "apple" ? "🍎" : "🍊"} drop {p.field}=
        {formatCriteria(p.criteria)}
      </span>
    </span>
  ));
}

export function NearMissHistogram({ data }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedPair, setSelectedPair] = useState<NearMissPair | null>(null);
  const max = Math.max(...data.buckets.map((b) => b.count), 1);
  const oneAway = data.buckets.find((b) => b.key === "1")?.count ?? 0;

  return (
    <>
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Near-miss distribution</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Unmatched pairs bucketed by how many preferences need to drop to
            unlock the match. Click bucket 1 or 2 to see actionable pairs.
          </p>
        </div>
        <div className="shrink-0 rounded-lg bg-amber-50 px-3 py-2 text-right dark:bg-amber-950/30">
          <div className="text-xl font-semibold tabular-nums text-amber-900 dark:text-amber-200">
            {oneAway}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-amber-700 dark:text-amber-400/80">
            one nudge away
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {data.buckets.map((bucket) => {
          const widthPct = (bucket.count / max) * 100;
          const isExpandable = bucket.pairs.length > 0;
          const isExpanded = expanded === bucket.key;
          return (
            <div key={bucket.key}>
              <button
                type="button"
                disabled={!isExpandable}
                onClick={() => setExpanded(isExpanded ? null : bucket.key)}
                className={`flex w-full items-center gap-4 rounded-lg px-2 py-1.5 text-left transition ${
                  isExpandable
                    ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    : "cursor-default"
                }`}
              >
                <div className="w-28 shrink-0 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {bucket.label}
                </div>
                <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800/60">
                  <div
                    className={`h-full transition-all ${BUCKET_BAR[bucket.key] ?? "bg-zinc-400"}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <div className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {bucket.count}
                </div>
                <div
                  className={`w-4 text-center text-xs ${isExpandable ? "text-zinc-400" : "text-transparent"}`}
                >
                  {isExpanded ? "▾" : "▸"}
                </div>
              </button>

              {isExpanded && bucket.pairs.length > 0 && (
                <div className="ml-32 mt-2 mb-4 space-y-1 border-l border-zinc-200 pl-4 dark:border-zinc-800">
                  {bucket.pairs.map((pair, i) => (
                    <button
                      type="button"
                      key={`${pair.apple.id}-${pair.orange.id}-${i}`}
                      onClick={() => setSelectedPair(pair)}
                      className="flex w-full flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                    >
                      <FruitChip fruit={pair.apple} size="compact" />
                      <span className="text-zinc-400">↔</span>
                      <FruitChip fruit={pair.orange} size="compact" />
                      <span className="ml-1 text-zinc-500">unblock by</span>
                      <span className="flex flex-wrap items-center gap-1">
                        {describeUnlock(pair)}
                      </span>
                      <span className="ml-auto text-[10px] text-zinc-400">
                        details →
                      </span>
                    </button>
                  ))}
                  {bucket.count > bucket.pairs.length && (
                    <div className="pt-1 text-xs italic text-zinc-400">
                      …and {bucket.count - bucket.pairs.length} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    {selectedPair && (
      <PairDetailModal
        pair={selectedPair}
        onClose={() => setSelectedPair(null)}
      />
    )}
    </>
  );
}
