"use client";

import { useMemo, useState } from "react";
import type { FilterTrace, Fruit, ParallelStage } from "@/lib/matching";
import { FruitCard } from "@/components/fruit-card";
import { FruitChip } from "@/components/fruit-chip";
import { MutualAcceptanceDetail } from "@/components/mutual-acceptance-detail";
import { SlideDeck, type Slide } from "@/components/slide-deck";
import type { MatchRow } from "./loader";

interface Props {
  match: MatchRow;
  fruitById: Record<string, Fruit>;
}

export function MatchRowCard({ match, fruitById }: Props) {
  const [open, setOpen] = useState(false);

  const idShort = match.id.replace(/^match:/, "").slice(0, 8);
  const isMatched = match.progress === "matched";

  const apple = match.apple;
  const orange = match.orange;
  const trace = match.trace;

  return (
    <div
      className={`overflow-hidden rounded-lg border ${
        isMatched
          ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-800/60 dark:bg-emerald-950/15"
          : "border-amber-300 bg-amber-50/30 dark:border-amber-800/60 dark:bg-amber-950/15"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
      >
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isMatched
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
            }`}
          >
            {isMatched ? "✓ matched" : "⏳ in progress"}
          </span>
          <code className="text-xs text-muted">{idShort}</code>
          <span className="text-xs text-muted">
            initiator: {match.initiator === "apple" ? "🍎" : "🍊"}{" "}
            {match.initiator}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <FruitMini fruit={apple} placeholder="🍎" />
          <span className="text-muted">↔</span>
          <FruitMini fruit={orange} placeholder="🍊" />
          <span className="ml-2 text-muted text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-black/10 bg-white/60 p-4 dark:border-white/10 dark:bg-zinc-900/40">
          {trace ? (
            <StoredTraceView
              trace={trace}
              initiatorFruit={
                match.initiator === "apple" ? apple : orange
              }
              fruitById={fruitById}
              matchedPartnerId={
                isMatched
                  ? match.initiator === "apple"
                    ? orange?.id ?? null
                    : apple?.id ?? null
                  : null
              }
            />
          ) : (
            <p className="text-xs italic text-muted">
              No trace stored on this match row.
            </p>
          )}
          <Timestamps match={match} />
        </div>
      )}
    </div>
  );
}

function FruitMini({
  fruit,
  placeholder,
}: {
  fruit: Fruit | null;
  placeholder: string;
}) {
  if (!fruit) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-zinc-300 px-2 py-0.5 text-xs italic text-muted dark:border-zinc-700">
        <span className="opacity-40">{placeholder}</span> waiting
      </span>
    );
  }
  const icon = fruit.type === "apple" ? "🍎" : "🍊";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-0.5 text-xs dark:bg-zinc-800">
      <span>{icon}</span>
      <code className="text-[10px] text-muted">{fruit.id.slice(-6)}</code>
    </span>
  );
}

function Timestamps({ match }: { match: MatchRow }) {
  return (
    <div className="mt-4 flex flex-wrap gap-4 border-t border-black/10 pt-3 text-[11px] text-muted dark:border-white/10">
      <span>
        created:{" "}
        <code>
          {match.created_at ? new Date(match.created_at).toLocaleString() : "—"}
        </code>
      </span>
      <span>
        matched:{" "}
        <code>
          {match.matched_at ? new Date(match.matched_at).toLocaleString() : "—"}
        </code>
      </span>
      <span>
        full id: <code>{match.id}</code>
      </span>
    </div>
  );
}

// =============================================================================
// StoredTraceView — pipeline view driven by stored filter_trace
// =============================================================================

function StoredTraceView({
  trace,
  initiatorFruit,
  fruitById,
  matchedPartnerId,
}: {
  trace: FilterTrace;
  initiatorFruit: Fruit | null;
  fruitById: Record<string, Fruit>;
  matchedPartnerId: string | null;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const referencedFruits = useMemo(() => {
    const set = new Set<string>();
    for (const s of trace.parallel_stages)
      for (const id of s.passing_ids) set.add(id);
    for (const id of trace.intersection) set.add(id);
    for (const id of trace.reverse.input_ids) set.add(id);
    for (const id of trace.reverse.passing_ids) set.add(id);
    for (const id of trace.final_candidates) set.add(id);
    if (trace.selected) set.add(trace.selected);
    return Array.from(set)
      .map((id) => fruitById[id])
      .filter((f): f is Fruit => Boolean(f));
  }, [trace, fruitById]);

  const slides: Slide[] = useMemo(
    () => [
      {
        key: "pair",
        title: "Pair",
        subtitle: "Initiator and partner",
        render: () => (
          <div className="space-y-4">
            {initiatorFruit && (
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <FruitCard fruit={initiatorFruit} size="sm" />
                <div className="flex items-center justify-center text-xs text-muted md:px-2">
                  initiator →
                </div>
                {matchedPartnerId && fruitById[matchedPartnerId] ? (
                  <FruitCard
                    fruit={fruitById[matchedPartnerId]}
                    size="sm"
                    highlighted
                  />
                ) : (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-300 p-3 text-xs italic text-muted dark:border-zinc-700">
                    No partner — still waiting
                  </div>
                )}
              </div>
            )}
            <SummaryStrip trace={trace} />
          </div>
        ),
      },
      {
        key: "first",
        title: "1st pass",
        subtitle: "Initiator's preferences",
        render: () => (
          <ParallelStagesGrid
            stages={trace.parallel_stages}
            pool={referencedFruits}
          />
        ),
      },
      {
        key: "second",
        title: "2nd pass",
        subtitle: "Intersection",
        render: () => (
          <IntersectionBlock
            intersection={trace.intersection}
            fruitById={fruitById}
          />
        ),
      },
      {
        key: "third",
        title: "3rd pass",
        subtitle: "Mutual acceptance",
        render: () => (
          <ReverseBlock
            reverse={trace.reverse}
            fruitById={fruitById}
            initiator={initiatorFruit}
          />
        ),
      },
      {
        key: "result",
        title: "Result",
        subtitle: trace.selected ? "Match selected" : "No match",
        render: () => <ResultBlock trace={trace} fruitById={fruitById} />,
      },
    ],
    [trace, initiatorFruit, fruitById, matchedPartnerId, referencedFruits],
  );

  return (
    <SlideDeck
      slides={slides}
      activeIndex={activeIndex}
      onChange={setActiveIndex}
      // Disable arrow-key nav here — multiple match rows can be expanded at once
      // and arrow keys should not steer all of them simultaneously.
      keyboardNav={false}
    />
  );
}

function SummaryStrip({ trace }: { trace: FilterTrace }) {
  const steps: { label: string; value: number }[] = [
    { label: "pool", value: trace.initial_pool_size },
    { label: "2nd pass", value: trace.intersection.length },
    { label: "3rd pass", value: trace.reverse.passing_ids.length },
    { label: "finalists", value: trace.final_candidates.length },
    { label: "matched", value: trace.selected ? 1 : 0 },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <span key={s.label} className="flex items-center gap-2">
          {i > 0 && <span className="text-muted">→</span>}
          <span className="rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono dark:border-zinc-700 dark:bg-zinc-800">
            <span className="text-muted">{s.label}:</span>{" "}
            <strong>{s.value}</strong>
          </span>
        </span>
      ))}
    </div>
  );
}

function ParallelStagesGrid({
  stages,
  pool,
}: {
  stages: ParallelStage[];
  pool: Fruit[];
}) {
  if (stages.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3 text-xs italic text-muted dark:border-zinc-700 dark:bg-zinc-900/40">
        1st pass skipped — the initiator had no preferences, so every candidate
        moved on.
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide">
          1st pass — initiator&apos;s preferences ({stages.length})
        </h4>
        <p className="text-[11px] text-muted">
          Each preference is checked independently against the entire pool.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map((stage, i) => (
          <ParallelStageCard key={i} stage={stage} pool={pool} />
        ))}
      </div>
    </div>
  );
}

function ParallelStageCard({
  stage,
  pool,
}: {
  stage: ParallelStage;
  pool: Fruit[];
}) {
  const passingSet = useMemo(() => new Set(stage.passing_ids), [stage]);
  const empty = stage.passing_ids.length === 0;

  return (
    <div
      className={`rounded-md border p-2 ${
        empty
          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
          : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40"
      }`}
    >
      <div className="text-xs font-semibold">{formatStageTitle(stage)}</div>
      <div className="text-[10px] text-muted">
        {stage.passing_ids.length} passing
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {pool.map((f) => (
          <FruitChip
            key={f.id}
            fruit={f}
            size="compact"
            dimmed={!passingSet.has(f.id)}
          />
        ))}
      </div>
    </div>
  );
}

function IntersectionBlock({
  intersection,
  fruitById,
}: {
  intersection: string[];
  fruitById: Record<string, Fruit>;
}) {
  const empty = intersection.length === 0;
  return (
    <div
      className={`rounded-md border p-3 ${
        empty
          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
      }`}
    >
      <div className="text-xs font-semibold">
        2nd pass — survived every preference
      </div>
      <p className="mt-0.5 text-[11px] text-muted">
        The overlap of all sets from the 1st pass — only candidates that
        satisfied every preference move forward. ({intersection.length} fruits)
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {intersection.map((id) => {
          const f = fruitById[id];
          if (!f) return <MissingChip key={id} id={id} />;
          return <FruitChip key={id} fruit={f} size="compact" />;
        })}
      </div>
    </div>
  );
}

function ReverseBlock({
  reverse,
  fruitById,
  initiator,
}: {
  reverse: FilterTrace["reverse"];
  fruitById: Record<string, Fruit>;
  initiator: Fruit | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (reverse.input_ids.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3 text-xs italic text-muted dark:border-zinc-700 dark:bg-zinc-900/40">
        3rd pass skipped — no candidates reached this step.
      </div>
    );
  }
  const acceptedSet = new Set(reverse.passing_ids);
  const selected = selectedId ? fruitById[selectedId] : null;
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="text-xs font-semibold">
        3rd pass — mutual acceptance
      </div>
      <p className="mt-0.5 text-[11px] text-muted">
        Each surviving candidate now checks the initiator against their own
        preferences. Both sides must want each other. (
        {reverse.passing_ids.length} of {reverse.input_ids.length} accepted) —
        click any candidate to see why.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {reverse.input_ids.map((id) => {
          const f = fruitById[id];
          const accepted = acceptedSet.has(id);
          if (!f) return <MissingChip key={id} id={id} />;
          return (
            <FruitChip
              key={id}
              fruit={f}
              size="compact"
              status={accepted ? "accepted" : "rejected"}
              selected={selectedId === id}
              onClick={() =>
                setSelectedId(selectedId === id ? null : id)
              }
            />
          );
        })}
      </div>
      {selected && initiator && (
        <div className="mt-3">
          <MutualAcceptanceDetail
            candidate={selected}
            initiator={initiator}
          />
        </div>
      )}
    </div>
  );
}

function ResultBlock({
  trace,
  fruitById,
}: {
  trace: FilterTrace;
  fruitById: Record<string, Fruit>;
}) {
  if (!trace.selected) {
    return (
      <div className="rounded-md border-2 border-amber-400 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/20">
        <div className="text-xs font-semibold">— No match selected</div>
        <div className="mt-1 text-[11px] text-muted">
          All candidates eliminated. Match is queued as in_progress.
        </div>
      </div>
    );
  }
  const selectedFruit = fruitById[trace.selected];
  return (
    <div className="rounded-md border-2 border-emerald-400 bg-emerald-50/40 p-3 dark:border-emerald-700 dark:bg-emerald-950/15">
      <div className="text-xs font-semibold">
        ✓ Selected: <code>{trace.selected.slice(-12)}</code>
      </div>
      {selectedFruit && (
        <div className="mt-2">
          <FruitCard fruit={selectedFruit} size="sm" highlighted />
        </div>
      )}
    </div>
  );
}

function MissingChip({ id }: { id: string }) {
  return (
    <span className="rounded-md border border-dashed border-zinc-300 px-1.5 py-0.5 text-[10px] italic text-muted dark:border-zinc-700">
      missing {id.slice(-6)}
    </span>
  );
}

function Divider() {
  return (
    <div className="ml-4 h-2 border-l-2 border-dashed border-zinc-300 dark:border-zinc-700" />
  );
}

function formatStageTitle(stage: ParallelStage): string {
  const { field, operation, criteria } = stage;
  if (operation === "range") {
    const r = criteria as { min?: number; max?: number };
    const min = r.min !== undefined ? r.min : "−∞";
    const max = r.max !== undefined ? r.max : "+∞";
    return `${field} in [${min}, ${max}]`;
  }
  if (operation === "in") {
    return `${field} ∈ {${(criteria as string[]).join(", ")}}`;
  }
  return `${field} = ${String(criteria)}`;
}
