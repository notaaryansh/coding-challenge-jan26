"use client";

import { useEffect, useState } from "react";
import type { FilterTrace, Fruit } from "@/lib/matching";
import { FruitCard } from "./fruit-card";

interface NoMatchSuggestion {
  field: string;
  current: string;
  suggested: string;
  unlocked_candidates: number;
}

interface ExplanationResponse {
  text: string;
  suggestion: NoMatchSuggestion | null;
}

interface MatchExplanationProps {
  source: Fruit;
  match: Fruit | null;
  pool: Fruit[];
  trace: FilterTrace;
}

export function MatchExplanation({
  source,
  match,
  pool,
  trace,
}: MatchExplanationProps) {
  const [data, setData] = useState<ExplanationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stable identity for the fetch — keyed on fruit IDs, not object references.
  // Including the full source/pool/trace in deps would re-fire every render
  // because parents allocate fresh objects.
  const key = `${source.id}->${match?.id ?? "none"}`;

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);

    fetch("/api/match-explanation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, match, pool, trace }),
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<ExplanationResponse>;
      })
      .then((body) => {
        if (!ac.signal.aborted) setData(body);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
    // We intentionally key the effect on the stable `key` string, not the
    // mutable source/pool/trace object refs — those change every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const matched = match !== null;

  return (
    <div
      className={`rounded-xl border-2 p-4 ${
        matched
          ? "border-emerald-300 bg-gradient-to-br from-emerald-50/60 to-white dark:border-emerald-800/60 dark:from-emerald-950/20 dark:to-zinc-900"
          : "border-amber-300 bg-gradient-to-br from-amber-50/60 to-white dark:border-amber-800/60 dark:from-amber-950/20 dark:to-zinc-900"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">{matched ? "💞" : "💔"}</span>
        <h3 className="text-sm font-semibold">
          {matched ? "Why they match" : "Why no match was found"}
        </h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted">
          Explained by LLM
        </span>
      </div>

      <PairDiagram source={source} match={match} matched={matched} />

      <div className="mt-4 min-h-[64px]">
        {loading && <Spinner />}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Could not load explanation: {error}
          </p>
        )}
        {data && (
          <>
            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {data.text}
            </p>
            {!matched && data.suggestion && (
              <SuggestionChip suggestion={data.suggestion} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Two-fruit diagram with a connecting line
// =============================================================================

function PairDiagram({
  source,
  match,
}: {
  source: Fruit;
  match: Fruit | null;
  matched: boolean;
}) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
      <div className="min-w-0">
        <FruitCard fruit={source} size="sm" />
      </div>
      <div className="min-w-0">
        {match ? (
          <FruitCard fruit={match} size="sm" highlighted />
        ) : (
          <EmptyPartner />
        )}
      </div>
    </div>
  );
}

function EmptyPartner() {
  return (
    <div className="flex h-full min-h-[140px] items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50/40 p-4 text-center text-xs text-muted dark:border-zinc-700 dark:bg-zinc-900/40">
      <span>
        No compatible partner —<br />
        nobody passed the filters.
      </span>
    </div>
  );
}

// =============================================================================
// Suggestion pill — surfaced under the LLM text for no-match
// =============================================================================

function SuggestionChip({ suggestion }: { suggestion: NoMatchSuggestion }) {
  return (
    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs dark:border-amber-800/60 dark:bg-amber-950/30">
      <div className="font-semibold text-amber-900 dark:text-amber-200">
        💡 Try relaxing <code>{suggestion.field}</code>
      </div>
      <div className="mt-1 text-amber-900/80 dark:text-amber-200/80">
        Currently <code>{suggestion.current}</code> →{" "}
        <code>{suggestion.suggested}</code>.{" "}
        <strong>{suggestion.unlocked_candidates}</strong>{" "}
        candidate
        {suggestion.unlocked_candidates === 1 ? "" : "s"} would qualify.
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <svg
        className="h-4 w-4 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          className="opacity-20"
        />
        <path
          d="M22 12a10 10 0 0 0-10-10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span>Thinking…</span>
    </div>
  );
}
