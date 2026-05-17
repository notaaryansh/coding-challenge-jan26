"use client";

import type { Fruit } from "@/lib/matching";

export type ChipStatus = "neutral" | "accepted" | "rejected";

interface FruitChipProps {
  fruit: Fruit;
  dimmed?: boolean;
  selected?: boolean;
  status?: ChipStatus;
  onClick?: () => void;
}

export function FruitChip({
  fruit,
  dimmed = false,
  selected = false,
  status = "neutral",
  onClick,
}: FruitChipProps) {
  const isApple = fruit.type === "apple";
  const icon = isApple ? "🍎" : "🍊";

  const baseColor = isApple
    ? "bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/50"
    : "bg-orange-100 dark:bg-orange-950/40 hover:bg-orange-200 dark:hover:bg-orange-900/50";

  const statusRing =
    status === "accepted"
      ? "ring-2 ring-emerald-500 dark:ring-emerald-400"
      : status === "rejected"
        ? "ring-2 ring-rose-500 dark:ring-rose-400"
        : selected
          ? "ring-2 ring-zinc-700 dark:ring-zinc-300"
          : "";

  const dimClass = dimmed ? "opacity-25 grayscale" : "";

  return (
    <button
      type="button"
      onClick={onClick}
      title={fruit.id}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 hover:scale-110 ${baseColor} ${statusRing} ${dimClass}`}
    >
      <span className="text-xl leading-none">{icon}</span>
      {status === "accepted" && (
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
          ✓
        </span>
      )}
      {status === "rejected" && (
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
          ✗
        </span>
      )}
    </button>
  );
}
