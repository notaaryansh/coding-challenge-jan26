"use client";

import { useCallback, useMemo, useState } from "react";
import type { Fruit, ParallelStage, ShineFactor } from "@/lib/matching";
import { FruitCard } from "@/components/fruit-card";
import { FruitChip } from "@/components/fruit-chip";
import { MatchExplanation } from "@/components/match-explanation";
import { MutualAcceptanceDetail } from "@/components/mutual-acceptance-detail";
import { SlideDeck, type Slide } from "@/components/slide-deck";
import { useVisualization, type LiveResult } from "@/lib/visualization-store";
import { NewConversationControl } from "./new-conversation-control";
import type { FilterTrace } from "@/lib/matching";

export function TestMatchPanel() {
  const current = useVisualization((s) => s.current);
  const activeIndex = useVisualization((s) => s.activeIndex);
  const setActiveIndex = useVisualization((s) => s.setActiveIndex);
  const clear = useVisualization((s) => s.clear);

  const fruitById = useMemo(() => {
    const map = new Map<string, Fruit>();
    if (current) for (const f of current.pool) map.set(f.id, f);
    return map;
  }, [current]);

  const slides: Slide[] = useMemo(() => {
    if (!current) return [];
    const matchFruit = current.trace.selected
      ? fruitById.get(current.trace.selected) ?? null
      : null;
    return [
      {
        key: "initiator",
        title: "Initiator",
        subtitle: "Who started the search",
        render: () => (
          <div className="space-y-3">
            {current.kind === "live" && <QueryCard live={current} />}
            <FruitCard fruit={current.source} size="md" />
          </div>
        ),
      },
      {
        key: "pool",
        title: "Pool",
        subtitle: "Candidates available",
        headerRight: (
          <span className="text-[10px] uppercase tracking-wider text-muted">
            {current.pool_type}s
          </span>
        ),
        render: () => (
          <InitialPoolBox pool={current.pool} poolType={current.pool_type} />
        ),
      },
      {
        key: "first",
        title: "1st pass",
        subtitle: "Initiator's preferences",
        render: () => (
          <ParallelFiltersSection
            stages={current.trace.parallel_stages}
            pool={current.pool}
            fruitById={fruitById}
          />
        ),
      },
      {
        key: "second",
        title: "2nd pass",
        subtitle: "Intersection",
        render: () => (
          <IntersectionBox
            intersection={current.trace.intersection}
            pool={current.pool}
            fruitById={fruitById}
          />
        ),
      },
      {
        key: "third",
        title: "3rd pass",
        subtitle: "Mutual acceptance",
        render: () => (
          <ReverseCheckBox
            reverse={current.trace.reverse}
            fruitById={fruitById}
            source={current.source}
          />
        ),
      },
      {
        key: "result",
        title: "Result",
        subtitle: current.trace.selected ? "Match selected" : "No match",
        render: () => (
          <ResultBlock trace={current.trace} fruitById={fruitById} />
        ),
      },
      {
        key: "why",
        title: "Why",
        subtitle: "LLM explanation",
        render: () => (
          <MatchExplanation
            source={current.source}
            match={matchFruit}
            pool={current.pool}
            trace={current.trace}
          />
        ),
      },
    ];
  }, [current, fruitById]);

  const goTo = useCallback(
    (i: number) => {
      if (slides.length === 0) return;
      const next = Math.min(Math.max(i, 0), slides.length - 1);
      setActiveIndex(next);
    },
    [slides.length, setActiveIndex],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted">
          Pick a fruit type and start a New Conversation to run the full
          matching pipeline. Use the tabs or ← / → to step through each stage.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {current && (
            <button
              type="button"
              onClick={clear}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-muted hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Clear
            </button>
          )}
          <NewConversationControl />
        </div>
      </div>

      {!current && (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-12 text-center text-sm text-muted dark:border-zinc-700 dark:bg-zinc-900/40">
          No visualization yet. Pick a fruit type and click{" "}
          <strong>New Conversation</strong> above to run a match.
        </div>
      )}

      {current && (
        <SlideDeck slides={slides} activeIndex={activeIndex} onChange={goTo} />
      )}
    </div>
  );
}

// =============================================================================
// Query card — only rendered for live (New Conversation) results
// =============================================================================

function QueryCard({ live }: { live: LiveResult }) {
  const { source, prompt, match } = live;
  const isApple = source.type === "apple";
  const icon = isApple ? "🍎" : "🍊";
  const statusLabel =
    match.progress === "matched" ? "matched" : "queued (in progress)";
  const statusTone =
    match.progress === "matched"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";

  return (
    <div className="rounded-xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm dark:border-sky-800/60 dark:from-sky-950/30 dark:to-zinc-900">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-sky-700 dark:text-sky-400">
          <span>📨</span>
          <span className="font-semibold">Incoming conversation</span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        <Quote label="Looking for">{prompt.preferences}</Quote>
        <Quote label="About me" subtle>
          {prompt.attributes}
        </Quote>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-sky-200/60 pt-3 dark:border-sky-800/40">
        <span className="text-2xl">{icon}</span>
        <div className="text-xs text-muted">
          <code className="text-[11px]">{source.id}</code>
        </div>
        <FactPill
          label="size"
          value={source.attributes.size?.toString() ?? "—"}
        />
        <FactPill
          label="weight"
          value={
            source.attributes.weight !== null
              ? `${source.attributes.weight}g`
              : "—"
          }
        />
        <FactPill
          label="shine"
          value={source.attributes.shineFactor ?? "—"}
        />
        {source.attributes.hasWorm !== null && (
          <FactPill
            label="worm"
            value={source.attributes.hasWorm ? "yes" : "no"}
            danger={source.attributes.hasWorm === true}
          />
        )}
      </div>
    </div>
  );
}

function Quote({
  label,
  children,
  subtle,
}: {
  label: string;
  children: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        subtle
          ? "border-zinc-200 bg-white/60 dark:border-zinc-700 dark:bg-zinc-800/40"
          : "border-sky-200 bg-white dark:border-sky-800/60 dark:bg-zinc-900/60"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </div>
      <p
        className={`mt-0.5 text-sm ${
          subtle ? "italic text-muted" : "text-zinc-800 dark:text-zinc-100"
        }`}
      >
        “{children}”
      </p>
    </div>
  );
}

function FactPill({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 rounded-md border px-2 py-0.5 text-[11px] font-mono ${
        danger
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300"
          : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      }`}
    >
      <span className="text-[9px] uppercase tracking-wide text-muted">
        {label}
      </span>
      <strong>{value}</strong>
    </span>
  );
}

// =============================================================================
// Initial pool — stats only
// =============================================================================

function InitialPoolBox({
  pool,
  poolType,
}: {
  pool: Fruit[];
  poolType: string;
}) {
  const stats = useMemo(() => computePoolStats(pool), [pool]);
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="text-sm font-semibold">
        Initial pool: {pool.length} {poolType}s
      </h3>
      <dl className="mt-3 space-y-2 text-xs text-muted">
        <StatRow label="Averages">
          <span>size {stats.avgSize}</span>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span>weight {stats.avgWeight}g</span>
        </StatRow>
        <StatRow label="Shine">
          {stats.shineBreakdown.map((s, i) => (
            <span key={s.label} className="flex items-center gap-1">
              {i > 0 && (
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
              )}
              <span>
                {s.count} {s.label}
              </span>
            </span>
          ))}
        </StatRow>
        <StatRow label="hasWorm = false">
          <span>{stats.hasWormFalse}</span>
        </StatRow>
      </dl>
    </div>
  );
}

// =============================================================================
// 1st pass — N independent filter columns (one per initiator preference)
// =============================================================================

function ParallelFiltersSection({
  stages,
  pool,
  fruitById,
}: {
  stages: ParallelStage[];
  pool: Fruit[];
  fruitById: Map<string, Fruit>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3 text-xs italic text-muted dark:border-zinc-700 dark:bg-zinc-900/40">
        1st pass skipped — the initiator has no preferences, so every candidate moves on.
      </div>
    );
  }

  const selected = selectedId ? fruitById.get(selectedId) : null;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="mb-3">
          <p className="text-xs text-muted">
            Each preference is checked independently against the entire pool.
            {" "}
            <span className="font-semibold">
              ({stages.length} preference{stages.length === 1 ? "" : "s"})
            </span>
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stages.map((stage, i) => (
            <ParallelFilterColumn
              key={i}
              stage={stage}
              pool={pool}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ))}
        </div>
      </div>
      {selected && <FruitCard fruit={selected} size="sm" />}
    </div>
  );
}

function ParallelFilterColumn({
  stage,
  pool,
  selectedId,
  onSelect,
}: {
  stage: ParallelStage;
  pool: Fruit[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const passingSet = useMemo(
    () => new Set(stage.passing_ids),
    [stage.passing_ids],
  );
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
      <div className="text-[11px] text-muted">
        {stage.passing_ids.length} of {pool.length} passing
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {pool.map((f) => {
          const passes = passingSet.has(f.id);
          return (
            <FruitChip
              key={f.id}
              fruit={f}
              size="compact"
              dimmed={!passes}
              selected={selectedId === f.id}
              onClick={
                passes
                  ? () => onSelect(selectedId === f.id ? null : f.id)
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// 2nd pass — fruits that passed every preference from the 1st pass
// =============================================================================

function IntersectionBox({
  intersection,
  pool,
  fruitById,
}: {
  intersection: string[];
  pool: Fruit[];
  fruitById: Map<string, Fruit>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const passingSet = useMemo(() => new Set(intersection), [intersection]);
  const selected = selectedId ? fruitById.get(selectedId) : null;
  const empty = intersection.length === 0;

  return (
    <div
      className={`rounded-lg border ${
        empty
          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
      }`}
    >
      <div className="px-3 py-2">
        <p className="text-xs text-muted">
          The overlap of all sets from the 1st pass — only candidates that
          satisfied every preference move forward. ({intersection.length} of{" "}
          {pool.length})
        </p>
      </div>
      <div className="border-t border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
        <div className="flex flex-wrap gap-2">
          {pool.map((f) => {
            const passes = passingSet.has(f.id);
            return (
              <FruitChip
                key={f.id}
                fruit={f}
                dimmed={!passes}
                selected={selectedId === f.id}
                onClick={
                  passes
                    ? () =>
                        setSelectedId(selectedId === f.id ? null : f.id)
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>
      {selected && (
        <div className="mt-3">
          <FruitCard fruit={selected} size="sm" />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// 3rd pass — do the surviving candidates want the initiator back?
// =============================================================================

function ReverseCheckBox({
  reverse,
  fruitById,
  source,
}: {
  reverse: { input_ids: string[]; passing_ids: string[] };
  fruitById: Map<string, Fruit>;
  source: Fruit;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const acceptedSet = useMemo(
    () => new Set(reverse.passing_ids),
    [reverse.passing_ids],
  );
  const selected = selectedId ? fruitById.get(selectedId) : null;
  const empty = reverse.input_ids.length === 0;

  return (
    <div
      className={`rounded-lg border ${
        empty || reverse.passing_ids.length === 0
          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
      }`}
    >
      <div className="px-3 py-2">
        <p className="text-xs text-muted">
          Each surviving candidate now checks the initiator against their own
          preferences. Both sides must want each other. (
          {reverse.passing_ids.length} of {reverse.input_ids.length} accepted)
          {reverse.input_ids.length > 0 && (
            <> — click any candidate to see why.</>
          )}
        </p>
      </div>
      {reverse.input_ids.length > 0 && (
        <div className="border-t border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
          <div className="flex flex-wrap gap-2">
            {reverse.input_ids.map((id) => {
              const fruit = fruitById.get(id);
              if (!fruit) return null;
              const accepted = acceptedSet.has(id);
              return (
                <FruitChip
                  key={id}
                  fruit={fruit}
                  selected={selectedId === id}
                  status={accepted ? "accepted" : "rejected"}
                  onClick={() =>
                    setSelectedId(selectedId === id ? null : id)
                  }
                />
              );
            })}
          </div>
        </div>
      )}
      {selected && (
        <div className="mt-3">
          <MutualAcceptanceDetail
            candidate={selected}
            initiator={source}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Final result
// =============================================================================

function ResultBlock({
  trace,
  fruitById,
}: {
  trace: FilterTrace;
  fruitById: Map<string, Fruit>;
}) {
  if (trace.selected) {
    // Render every finalist in the same column, same size, same width — only
    // the selected one gets the green outline so the winner is unambiguous.
    const finalists = trace.final_candidates;
    return (
      <div className="space-y-3">
        <div>
          <div className="text-sm font-semibold">✓ Match selected</div>
          <div className="mt-0.5 text-xs text-muted">
            FIFO winner from {finalists.length} final candidate
            {finalists.length === 1 ? "" : "s"} — the green-outlined card is the
            one that was picked.
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {finalists.map((id) => {
            const fruit = fruitById.get(id);
            if (!fruit) return null;
            const isSelected = id === trace.selected;
            return (
              <FruitCard
                key={id}
                fruit={fruit}
                size="md"
                highlighted={isSelected}
              />
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/20">
      <div className="text-sm font-semibold">— No match</div>
      <div className="mt-1 text-xs text-muted">
        All candidates eliminated by the pipeline. Would queue this fruit as
        in_progress in the real flow.
      </div>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function StatRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
        {label}
      </dt>
      <dd className="flex flex-wrap items-center gap-2">{children}</dd>
    </div>
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

// =============================================================================
// Stats computation
// =============================================================================

interface PoolStats {
  avgSize: string;
  avgWeight: string;
  shineBreakdown: { label: string; count: number }[];
  hasWormFalse: number;
}

function computePoolStats(pool: Fruit[]): PoolStats {
  const sizes = pool
    .map((f) => f.attributes.size)
    .filter((s): s is number => s !== null);
  const weights = pool
    .map((f) => f.attributes.weight)
    .filter((w): w is number => w !== null);

  const avgSize =
    sizes.length > 0
      ? (sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(1)
      : "—";
  const avgWeight =
    weights.length > 0
      ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length).toString()
      : "—";

  const shineCounts: Record<ShineFactor, number> = {
    dull: 0,
    neutral: 0,
    shiny: 0,
    extraShiny: 0,
  };
  for (const f of pool) {
    if (f.attributes.shineFactor) shineCounts[f.attributes.shineFactor]++;
  }
  const shineLabels: Record<ShineFactor, string> = {
    dull: "dull",
    neutral: "neutral",
    shiny: "shiny",
    extraShiny: "extra-shiny",
  };
  const shineBreakdown = (Object.keys(shineCounts) as ShineFactor[])
    .filter((k) => shineCounts[k] > 0)
    .map((k) => ({ label: shineLabels[k], count: shineCounts[k] }));

  const hasWormFalse = pool.filter((f) => f.attributes.hasWorm === false).length;

  return {
    avgSize,
    avgWeight,
    shineBreakdown,
    hasWormFalse,
  };
}
