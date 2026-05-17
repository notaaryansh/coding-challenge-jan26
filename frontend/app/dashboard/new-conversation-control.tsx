"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FilterTrace, Fruit } from "@/lib/matching";
import { useVisualization } from "@/lib/visualization-store";

const FUNCTIONS_URL = "http://127.0.0.1:54321/functions/v1";

interface EdgeResponse {
  id: string;
  fruit: Fruit;
  attributes: string;
  preferences: string;
  match: {
    id: string;
    progress: "matched" | "in_progress";
    partner_id: string | null;
    partner: Fruit | null;
  };
  pool: Fruit[];
  pool_type: "apple" | "orange";
  trace: FilterTrace;
}

export function NewConversationControl() {
  const [fruitType, setFruitType] = useState<"apple" | "orange">("apple");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const setResult = useVisualization((s) => s.setResult);

  const handleSubmit = async () => {
    setError(null);
    try {
      const res = await fetch(`${FUNCTIONS_URL}/get-incoming-${fruitType}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const body = (await res.json()) as EdgeResponse;
      setResult({
        kind: "live",
        source: body.fruit,
        pool: body.pool,
        pool_type: body.pool_type,
        trace: body.trace,
        prompt: {
          attributes: body.attributes,
          preferences: body.preferences,
        },
        match: {
          id: body.match.id,
          progress: body.match.progress,
          partner: body.match.partner,
        },
      });
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex rounded-md border border-zinc-200 p-0.5 text-sm dark:border-zinc-700">
        <button
          type="button"
          onClick={() => setFruitType("apple")}
          className={`rounded px-3 py-1 transition ${
            fruitType === "apple"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "text-muted"
          }`}
        >
          🍎 apple
        </button>
        <button
          type="button"
          onClick={() => setFruitType("orange")}
          className={`rounded px-3 py-1 transition ${
            fruitType === "orange"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "text-muted"
          }`}
        >
          🍊 orange
        </button>
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="btn-primary disabled:opacity-50"
      >
        {isPending ? "Sending..." : "New Conversation"}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
