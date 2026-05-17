"use client";

import { useMemo, useState } from "react";
import type { FilterStage, FilterTrace, Fruit } from "@/lib/matching";
import { FruitCard } from "@/components/fruit-card";

interface TestResponse {
  source: Fruit;
  pool_type: string;
  pool_size: number;
  pool: Fruit[];
  trace: FilterTrace;
}

export function TestMatchPanel() {
  const [data, setData] = useState<TestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fruitById = useMemo(() => {
    const map = new Map<string, Fruit>();
    if (data) for (const f of data.pool) map.set(f.id, f);
    return map;
  }, [data]);

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
          Picks a random apple from the pool and runs the filter pipeline
          against all oranges. No DB writes — read-only dry run. Click any
          stage to see the candidates that passed.
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
          <FruitCard fruit={data.source} size="md" />
          <Connector />
          <StageBox
            title={`Initial pool: ${data.pool_size} ${data.pool_type}s`}
            subtitle="Starting candidate set"
            ids={data.pool.map((p) => p.id)}
            fruitById={fruitById}
          />
          {data.trace.stages.map((stage, i) => (
            <div key={i}>
              <Connector />
              <StageBox
                title={formatStageTitle(stage)}
                subtitle={`${stage.passing_count} of ${stage.input_count} passing`}
                ids={stage.passing_ids}
                fruitById={fruitById}
                empty={stage.passing_count === 0}
              />
            </div>
          ))}
          <Connector />
          <ResultBox
            selected={data.trace.selected}
            fruitById={fruitById}
          />
        </div>
      )}
    </div>
  );
}

function StageBox({
  title,
  subtitle,
  ids,
  fruitById,
  empty,
}: {
  title: string;
  subtitle: string;
  ids: string[];
  fruitById: Map<string, Fruit>;
  empty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasFruits = ids.length > 0;

  return (
    <div
      className={`overflow-hidden rounded-lg border ${
        empty
          ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
      }`}
    >
      <button
        type="button"
        onClick={() => hasFruits && setOpen((v) => !v)}
        disabled={!hasFruits}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-zinc-50 disabled:cursor-default dark:hover:bg-zinc-700/40"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted">{subtitle}</div>
        </div>
        {hasFruits && (
          <span className="text-xs text-muted">{open ? "▾" : "▸"}</span>
        )}
      </button>
      {open && hasFruits && (
        <div className="border-t border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {ids.map((id) => {
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

function Connector() {
  return (
    <div className="ml-5 h-4 border-l-2 border-dashed border-zinc-300 dark:border-zinc-700" />
  );
}

function ResultBox({
  selected,
  fruitById,
}: {
  selected: string | null;
  fruitById: Map<string, Fruit>;
}) {
  const [open, setOpen] = useState(true);

  if (selected) {
    const fruit = fruitById.get(selected);
    return (
      <div className="overflow-hidden rounded-lg border-2 border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/20">
        <button
          type="button"
          onClick={() => fruit && setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
        >
          <div className="min-w-0">
            <div className="text-sm font-semibold">✓ Match found</div>
            <div className="mt-0.5 text-xs text-muted">
              Selected: <code>{selected}</code>
            </div>
          </div>
          {fruit && (
            <span className="text-xs text-muted">{open ? "▾" : "▸"}</span>
          )}
        </button>
        {open && fruit && (
          <div className="border-t border-emerald-300 bg-emerald-50/40 p-3 dark:border-emerald-700/60 dark:bg-emerald-950/10">
            <FruitCard fruit={fruit} highlighted size="md" />
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

function formatStageTitle(stage: FilterStage): string {
  const { field, operation, criteria } = stage;
  if (field === "reverse_compat") {
    return "Reverse check — does candidate's prefs accept the apple?";
  }
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
