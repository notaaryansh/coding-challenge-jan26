"use client";

import type { Fruit } from "@/lib/matching";

export type ChipStatus = "neutral" | "accepted" | "rejected";

interface FruitChipProps {
  fruit: Fruit;
  dimmed?: boolean;
  selected?: boolean;
  status?: ChipStatus;
  size?: "compact" | "default";
  onClick?: () => void;
}

export function FruitChip({
  fruit,
  dimmed = false,
  selected = false,
  status = "neutral",
  size = "default",
  onClick,
}: FruitChipProps) {
  const isApple = fruit.type === "apple";
  const icon = isApple ? "🍎" : "🍊";

  const baseColor = isApple
    ? "bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/50"
    : "bg-orange-100 dark:bg-orange-950/40 hover:bg-orange-200 dark:hover:bg-orange-900/50";

  // The `status` ring (accepted/rejected) is the inner colored ring.
  // The `selected` state paints a separate, contrasting outline on top so the
  // user can ALWAYS see which chip they clicked, even when every chip already
  // has a status color.
  const statusRing =
    status === "accepted"
      ? "ring-2 ring-emerald-500 dark:ring-emerald-400"
      : status === "rejected"
        ? "ring-2 ring-rose-500 dark:ring-rose-400"
        : "";

  const selectedOutline = selected
    ? "outline outline-2 outline-offset-2 outline-zinc-900 dark:outline-white z-10 scale-110 shadow-lg"
    : "";

  const dimClass = dimmed ? "opacity-25 grayscale" : "";

  const sizeClass =
    size === "compact" ? "h-7 w-7 text-sm" : "h-10 w-10 text-xl";
  const badgeSize =
    size === "compact" ? "h-3 w-3 text-[8px]" : "h-4 w-4 text-[9px]";

  return (
    <button
      type="button"
      onClick={onClick}
      title={fruit.id}
      aria-pressed={selected || undefined}
      className={`relative flex items-center justify-center rounded-full transition-all duration-300 hover:scale-110 ${sizeClass} ${baseColor} ${statusRing} ${selectedOutline} ${dimClass}`}
    >
      <span className="leading-none">{icon}</span>
      {status === "accepted" && (
        <span
          className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-emerald-500 font-bold text-white ${badgeSize}`}
        >
          ✓
        </span>
      )}
      {status === "rejected" && (
        <span
          className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-rose-500 font-bold text-white ${badgeSize}`}
        >
          ✗
        </span>
      )}
    </button>
  );
}
