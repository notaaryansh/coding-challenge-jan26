"use client";

import { useEffect } from "react";
import { FruitChip } from "@/components/fruit-chip";
import { attrMatches, type Fruit } from "@/lib/matching";
import type { NearMissPair } from "./metrics";

interface Props {
  pair: NearMissPair;
  onClose: () => void;
}

function shortId(id: string): string {
  const tail = id.split(":").pop() ?? id;
  return `#${tail.slice(-6)}`;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (v === true) return "yes";
  if (v === false) return "no";
  return String(v);
}

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

const ATTRIBUTE_ORDER: Array<keyof Fruit["attributes"]> = [
  "size",
  "weight",
  "shineFactor",
  "hasStem",
  "hasLeaf",
  "hasWorm",
  "hasChemicals",
];

function FruitPanel({
  fruit,
  otherFruit,
  failedFields,
}: {
  fruit: Fruit;
  otherFruit: Fruit;
  failedFields: Set<string>;
}) {
  const prefEntries = Object.entries(fruit.preferences ?? {}).filter(
    ([, c]) => c !== undefined,
  );

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/30">
      <div className="mb-4 flex items-center gap-2">
        <FruitChip fruit={fruit} />
        <div>
          <div className="font-mono text-sm font-semibold">
            {shortId(fruit.id)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            {fruit.type}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Attributes
        </div>
        <dl className="space-y-1 text-xs">
          {ATTRIBUTE_ORDER.map((field) => (
            <div
              key={field}
              className="flex items-baseline justify-between gap-3"
            >
              <dt className="font-mono text-zinc-500">{field}</dt>
              <dd className="font-medium tabular-nums">
                {formatValue(fruit.attributes[field])}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Wants from {otherFruit.type}
        </div>
        {prefEntries.length === 0 ? (
          <div className="text-xs italic text-zinc-400">No preferences</div>
        ) : (
          <ul className="space-y-1 text-xs">
            {prefEntries.map(([field, criteria]) => {
              const failed = failedFields.has(field);
              const passes = attrMatches(
                otherFruit.attributes,
                field,
                criteria,
              );
              return (
                <li
                  key={field}
                  className={`flex items-baseline justify-between gap-3 rounded px-2 py-1 ${
                    failed
                      ? "bg-rose-50 dark:bg-rose-950/20"
                      : "bg-emerald-50/40 dark:bg-emerald-950/10"
                  }`}
                >
                  <span className="font-mono text-zinc-600 dark:text-zinc-400">
                    {field}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">
                      {formatCriteria(criteria)}
                    </span>
                    {passes ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        ✓
                      </span>
                    ) : (
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        ✗
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function PairDetailModal({ pair, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const appleFails = new Set(
    pair.failedPrefs.filter((p) => p.side === "apple").map((p) => p.field),
  );
  const orangeFails = new Set(
    pair.failedPrefs.filter((p) => p.side === "orange").map((p) => p.field),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {pair.distance === 1 ? "1 pref" : `${pair.distance} prefs`} away
              from matching
            </div>
            <h3 className="mt-1 text-base font-semibold">
              Near-miss pair details
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FruitPanel
            fruit={pair.apple}
            otherFruit={pair.orange}
            failedFields={appleFails}
          />
          <FruitPanel
            fruit={pair.orange}
            otherFruit={pair.apple}
            failedFields={orangeFails}
          />
        </div>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-800/60 dark:bg-amber-950/20">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400">
            To unlock this match
          </div>
          <ul className="space-y-1 text-xs">
            {pair.failedPrefs.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-base leading-none">
                  {p.side === "apple" ? "🍎" : "🍊"}
                </span>
                <span>
                  drop preference{" "}
                  <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[10px] dark:bg-amber-900/40">
                    {p.field}={formatCriteria(p.criteria)}
                  </code>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
