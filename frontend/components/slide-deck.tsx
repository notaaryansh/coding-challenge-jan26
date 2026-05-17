"use client";

import { useEffect } from "react";

export interface Slide {
  key: string;
  title: string;
  subtitle?: string;
  /** Optional adornment shown in the slide's top-right (e.g. a small label). */
  headerRight?: React.ReactNode;
  render: () => React.ReactNode;
}

interface SlideDeckProps {
  slides: Slide[];
  activeIndex: number;
  onChange: (i: number) => void;
  /** If true, ←/→ keys step through slides (default true). Disable when
   *  multiple decks coexist on a page to avoid arrow-key conflicts. */
  keyboardNav?: boolean;
}

export function SlideDeck({
  slides,
  activeIndex,
  onChange,
  keyboardNav = true,
}: SlideDeckProps) {
  const safeIndex = Math.min(
    Math.max(activeIndex, 0),
    Math.max(slides.length - 1, 0),
  );
  const atStart = safeIndex === 0;
  const atEnd = safeIndex === slides.length - 1;
  const active = slides[safeIndex];
  const next = slides[safeIndex + 1];

  useEffect(() => {
    if (!keyboardNav) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if (e.key === "ArrowRight") onChange(Math.min(safeIndex + 1, slides.length - 1));
      else if (e.key === "ArrowLeft") onChange(Math.max(safeIndex - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboardNav, safeIndex, slides.length, onChange]);

  if (slides.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Tab strip */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-200 px-3 pt-3 dark:border-zinc-800">
        {slides.map((s, i) => {
          const isActive = i === safeIndex;
          const isPast = i < safeIndex;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onChange(i)}
              className={`group relative flex shrink-0 items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-xs transition ${
                isActive
                  ? "border-emerald-500 text-zinc-900 dark:text-zinc-50"
                  : "border-transparent text-muted hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  isActive
                    ? "bg-emerald-500 text-white"
                    : isPast
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {i + 1}
              </span>
              <span className="font-semibold">{s.title}</span>
            </button>
          );
        })}
      </div>

      {/* Slide stage — FIXED height. Every slide fills the stage exactly,
          so the deck doesn't resize as you navigate. Slides with extra-tall
          content scroll internally rather than stretching the panel. */}
      <div className="relative h-[720px] overflow-hidden">
        {slides.map((s, i) => {
          const isActive = i === safeIndex;
          const offset = i - safeIndex;
          return (
            <div
              key={s.key}
              aria-hidden={!isActive}
              className="absolute inset-0 overflow-y-auto transition-all duration-500 ease-out"
              style={{
                transform: `translateX(${offset * 100}%)`,
                opacity: isActive ? 1 : 0,
                pointerEvents: isActive ? undefined : "none",
              }}
            >
              <div className="px-5 py-5">
                <header className="mb-4 flex items-baseline justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted">
                      Step {i + 1} of {slides.length}
                    </div>
                    <h3 className="text-base font-semibold">{s.title}</h3>
                    {s.subtitle && (
                      <p className="text-xs text-muted">{s.subtitle}</p>
                    )}
                  </div>
                  {s.headerRight && (
                    <div className="shrink-0">{s.headerRight}</div>
                  )}
                </header>
                {Math.abs(offset) <= 1 ? s.render() : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <button
          type="button"
          onClick={() => onChange(safeIndex - 1)}
          disabled={atStart}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          ← Back
        </button>

        <div className="flex items-center gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onChange(i)}
              aria-label={`Go to slide ${i + 1}: ${s.title}`}
              className={`h-1.5 rounded-full transition-all ${
                i === safeIndex
                  ? "w-6 bg-emerald-500"
                  : "w-1.5 bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => onChange(safeIndex + 1)}
          disabled={atEnd}
          className="rounded-md border border-emerald-500 bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
        >
          {atEnd ? "Done" : `Next: ${next?.title ?? ""} →`}
        </button>
      </div>

      <div className="sr-only" aria-live="polite">
        {active
          ? `Slide ${safeIndex + 1} of ${slides.length}: ${active.title}`
          : ""}
      </div>
    </div>
  );
}
