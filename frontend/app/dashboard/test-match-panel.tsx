"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  FilterStage,
  FilterTrace,
  Fruit,
  ShineFactor,
} from "@/lib/matching";
import { FruitCard } from "@/components/fruit-card";
import { FruitChip } from "@/components/fruit-chip";

interface TestResponse {
  source: Fruit;
  pool_type: string;
  pool_size: number;
  pool: Fruit[];
  trace: FilterTrace;
}

const STAGE_DELAY_MS = 400;

export function TestMatchPanel() {
  const [data, setData] = useState<TestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Number of pipeline blocks revealed so far. Pool = 1, then each stage, then final.
  const [revealed, setRevealed] = useState(0);

  const fruitById = useMemo(() => {
    const map = new Map<string, Fruit>();
    if (data) for (const f of data.pool) map.set(f.id, f);
    return map;
  }, [data]);

  // Total reveal steps: 1 (pool) + N stages + 1 (final result)
  const totalSteps = data ? data.trace.stages.length + 2 : 0;

  useEffect(() => {
    if (!data) return;
    setRevealed(0);
    let step = 0;
    const id = setInterval(() => {
      step += 1;
      setRevealed(step);
      if (step >= totalSteps) clearInterval(id);
    }, STAGE_DELAY_MS);
    return () => clearInterval(id);
  }, [data, totalSteps]);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/test-match", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          Picks a random apple from the pool and replays the filter pipeline
          step by step against all oranges. Click any highlighted fruit to see
          its card.
        </p>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? "Running..." : "Test"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-2">
          <FadeIn show>
            <FruitCard fruit={data.source} size="md" />
          </FadeIn>

          <Connector />

          <FadeIn show={revealed >= 1}>
            <InitialPoolBox pool={data.pool} poolType={data.pool_type} />
          </FadeIn>

          {data.trace.stages.map((stage, i) => {
            const stepIndex = i + 2; // pool is step 1, stages start at 2
            const inputIds =
              i === 0
                ? data.pool.map((f) => f.id)
                : data.trace.stages[i - 1].passing_ids;
            return (
              <div key={i}>
                <Connector />
                <FadeIn show={revealed >= stepIndex}>
                  <StageBox
                    stage={stage}
                    inputIds={inputIds}
                    fruitById={fruitById}
                  />
                </FadeIn>
              </div>
            );
          })}

          <Connector />

          <FadeIn show={revealed >= totalSteps}>
            <ResultBlock trace={data.trace} fruitById={fruitById} />
          </FadeIn>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Initial pool — stats only, not expandable
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
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="text-sm font-semibold">
        Initial pool: {pool.length} {poolType}s
      </h3>
      <dl className="mt-2 space-y-1 text-xs text-muted">
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
        <StatRow label="hasChemicals = false">
          <span>{stats.hasChemicalsFalse}</span>
        </StatRow>
      </dl>
    </div>
  );
}

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

// =============================================================================
// Filter stage box — shows input fruits as chips, highlights survivors
// =============================================================================

function StageBox({
  stage,
  inputIds,
  fruitById,
}: {
  stage: FilterStage;
  inputIds: string[];
  fruitById: Map<string, Fruit>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const passingSet = useMemo(
    () => new Set(stage.passing_ids),
    [stage.passing_ids],
  );

  const isReverse = stage.field === "reverse_compat";
  const empty = stage.passing_count === 0;
  const selected = selectedId ? fruitById.get(selectedId) : null;

  return (
    <div
      className={`rounded-lg border ${
        empty
          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
      }`}
    >
      <div className="px-3 py-2">
        <div className="text-sm font-semibold">
          {isReverse
            ? "Reverse check — does candidate accept the apple?"
            : formatStageTitle(stage)}
        </div>
        <div className="text-xs text-muted">
          {stage.passing_count} of {stage.input_count}{" "}
          {isReverse ? "accepted" : "passing"}
        </div>
      </div>
      {inputIds.length > 0 && (
        <div className="border-t border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
          <div className="flex flex-wrap gap-2">
            {inputIds.map((id) => {
              const fruit = fruitById.get(id);
              if (!fruit) return null;
              const passes = passingSet.has(id);
              return (
                <FruitChip
                  key={id}
                  fruit={fruit}
                  dimmed={!passes}
                  selected={selectedId === id}
                  status={
                    isReverse
                      ? passes
                        ? "accepted"
                        : "rejected"
                      : "neutral"
                  }
                  onClick={
                    passes
                      ? () =>
                          setSelectedId(selectedId === id ? null : id)
                      : undefined
                  }
                />
              );
            })}
          </div>
          {selected && (
            <div className="mt-3">
              <FruitCard fruit={selected} size="sm" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Final result — full FruitCard(s)
// =============================================================================

function ResultBlock({
  trace,
  fruitById,
}: {
  trace: FilterTrace;
  fruitById: Map<string, Fruit>;
}) {
  if (trace.selected) {
    const selectedFruit = fruitById.get(trace.selected);
    const otherFinalists = trace.final_candidates.filter(
      (id) => id !== trace.selected,
    );
    return (
      <div className="space-y-3 rounded-lg border-2 border-emerald-400 bg-emerald-50/30 p-3 dark:border-emerald-700 dark:bg-emerald-950/15">
        <div>
          <div className="text-sm font-semibold">✓ Match selected</div>
          <div className="mt-0.5 text-xs text-muted">
            FIFO winner from {trace.final_candidates.length} final candidate
            {trace.final_candidates.length === 1 ? "" : "s"}
          </div>
        </div>
        {selectedFruit && (
          <FruitCard fruit={selectedFruit} size="md" highlighted />
        )}
        {otherFinalists.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
              Other finalists
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {otherFinalists.map((id) => {
                const fruit = fruitById.get(id);
                if (!fruit) return null;
                return <FruitCard key={id} fruit={fruit} size="sm" />;
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/20">
      <div className="text-sm font-semibold">— No match</div>
      <div className="mt-1 text-xs text-muted">
        All candidates eliminated by the pipeline. Would queue this apple as
        in_progress in the real flow.
      </div>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function Connector() {
  return (
    <div className="ml-5 h-4 border-l-2 border-dashed border-zinc-300 dark:border-zinc-700" />
  );
}

function FadeIn({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`transition-all duration-300 ${
        show
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-1 opacity-0"
      }`}
      style={{ display: show ? undefined : "none" }}
    >
      {children}
    </div>
  );
}

function formatStageTitle(stage: FilterStage): string {
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
  hasChemicalsFalse: number;
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
  const hasChemicalsFalse = pool.filter(
    (f) => f.attributes.hasChemicals === false,
  ).length;

  return {
    avgSize,
    avgWeight,
    shineBreakdown,
    hasWormFalse,
    hasChemicalsFalse,
  };
}
