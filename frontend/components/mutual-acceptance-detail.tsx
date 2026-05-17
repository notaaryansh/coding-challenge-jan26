"use client";

import {
  attrMatches,
  type Fruit,
  type FruitAttributes,
  type FruitPreferences,
  type NumberRange,
  type ShineFactor,
} from "@/lib/matching";
import { AttributesView } from "./fruit-card";

interface Props {
  /** The candidate whose preferences are being evaluated. */
  candidate: Fruit;
  /** The initiator whose attributes are being checked against those preferences. */
  initiator: Fruit;
}

const SHINE_LABEL: Record<ShineFactor, string> = {
  dull: "Dull",
  neutral: "Neutral",
  shiny: "Shiny",
  extraShiny: "Extra shiny",
};

export function MutualAcceptanceDetail({ candidate, initiator }: Props) {
  const checks = buildChecks(candidate.preferences, initiator.attributes);
  const candidateIcon = candidate.type === "apple" ? "🍎" : "🍊";
  const candidateLabel = candidate.type === "apple" ? "Apple" : "Orange";

  const failed = checks.filter((c) => !c.pass);
  const accepted = failed.length === 0;

  return (
    <div
      className={`rounded-xl border-2 shadow-sm ${
        accepted
          ? "border-emerald-400 bg-emerald-50/30 dark:border-emerald-700 dark:bg-emerald-950/15"
          : "border-rose-400 bg-rose-50/30 dark:border-rose-700 dark:bg-rose-950/15"
      }`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-current/10 px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none">{candidateIcon}</span>
          <div className="min-w-0">
            <h3 className="font-bold tracking-tight">{candidateLabel}</h3>
            <code className="mt-0.5 block truncate text-[10px] text-muted">
              {candidate.id}
            </code>
            <p className="mt-1 text-[11px] text-muted">
              {accepted
                ? "Every preference is satisfied by the initiator."
                : `${failed.length} of ${checks.length} preference${
                    checks.length === 1 ? "" : "s"
                  } not satisfied.`}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            accepted
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
          }`}
        >
          {accepted ? "accepted" : "rejected"}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        {/* Left: candidate's own info */}
        <section>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Attributes
          </h4>
          <AttributesView attrs={candidate.attributes} />
        </section>

        {/* Right: per-preference checks against the initiator */}
        <section>
          <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Looking for &mdash; checked against initiator
          </h4>
          {checks.length === 0 ? (
            <p className="text-xs italic text-muted">
              Candidate has no preferences — would accept anyone.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {checks.map((c) => (
                <li
                  key={c.field}
                  className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs ${
                    c.pass
                      ? "border-emerald-200 bg-white dark:border-emerald-900/40 dark:bg-zinc-900/40"
                      : "border-rose-300 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/20"
                  }`}
                >
                  <span
                    className={`mt-0.5 font-bold ${
                      c.pass
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {c.pass ? "✓" : "✗"}
                  </span>
                  <div className="flex-1">
                    <div
                      className={`font-medium ${
                        c.pass ? "" : "text-rose-900 dark:text-rose-200"
                      }`}
                    >
                      {c.wanted}
                    </div>
                    <div
                      className={`text-[11px] ${
                        c.pass
                          ? "text-muted"
                          : "font-semibold text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      Initiator has {c.actual}
                      {!c.pass && c.reason ? ` — ${c.reason}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// =============================================================================
// Check builder — mirrors the logic in runMatching's reverse step
// =============================================================================

interface PrefCheck {
  field: string;
  wanted: string;
  actual: string;
  reason?: string;
  pass: boolean;
}

function buildChecks(
  prefs: FruitPreferences,
  attrs: FruitAttributes,
): PrefCheck[] {
  const out: PrefCheck[] = [];
  for (const [field, criteria] of Object.entries(prefs)) {
    if (criteria === undefined) continue;
    out.push(buildCheck(field, criteria, attrs));
  }
  return out;
}

function buildCheck(
  field: string,
  criteria: unknown,
  attrs: FruitAttributes,
): PrefCheck {
  const pass = attrMatches(attrs, field, criteria);
  const actualVal = attrs[field as keyof FruitAttributes];

  if (field === "size" || field === "weight") {
    const unit = field === "weight" ? " g" : "";
    const range = criteria as NumberRange;
    const wanted = formatRange(range, unit);
    const actual =
      actualVal === null ? "no value" : `${actualVal}${unit}`;
    let reason: string | undefined;
    if (!pass && actualVal !== null && typeof actualVal === "number") {
      if (range.min !== undefined && actualVal < range.min) {
        reason = `below min ${range.min}${unit}`;
      } else if (range.max !== undefined && actualVal > range.max) {
        reason = `above max ${range.max}${unit}`;
      }
    } else if (!pass && actualVal === null) {
      reason = "value missing";
    }
    return { field, wanted: `Wants ${field} ${wanted}`, actual, reason, pass };
  }

  if (field === "shineFactor") {
    const wantedStr = Array.isArray(criteria)
      ? (criteria as ShineFactor[]).map((s) => SHINE_LABEL[s]).join(" or ")
      : SHINE_LABEL[criteria as ShineFactor];
    const actual =
      actualVal === null
        ? "no shine value"
        : SHINE_LABEL[actualVal as ShineFactor];
    return {
      field,
      wanted: `Wants shine: ${wantedStr}`,
      actual,
      reason: pass ? undefined : "shine mismatch",
      pass,
    };
  }

  // Boolean attributes: hasStem / hasLeaf / hasWorm / hasChemicals
  const wantedBool = criteria as boolean;
  const wantedLabel = `Wants ${field} = ${wantedBool}`;
  const actualLabel =
    actualVal === null ? "no value" : `${field} = ${String(actualVal)}`;
  return {
    field,
    wanted: wantedLabel,
    actual: actualLabel,
    reason: pass ? undefined : "boolean mismatch",
    pass,
  };
}

function formatRange(range: NumberRange, unit = ""): string {
  if (range.min !== undefined && range.max !== undefined) {
    return `in [${range.min}${unit}, ${range.max}${unit}]`;
  }
  if (range.min !== undefined) return `≥ ${range.min}${unit}`;
  if (range.max !== undefined) return `≤ ${range.max}${unit}`;
  return "any";
}
