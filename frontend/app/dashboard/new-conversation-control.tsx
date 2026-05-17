"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const FUNCTIONS_URL = "http://127.0.0.1:54321/functions/v1";

export function NewConversationControl() {
  const [fruitType, setFruitType] = useState<"apple" | "orange">("apple");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async () => {
    setError(null);
    try {
      const res = await fetch(`${FUNCTIONS_URL}/get-incoming-${fruitType}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
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
