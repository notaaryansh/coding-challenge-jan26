"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function StartButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/simulate", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Refresh the server-rendered page so it re-reads `system:init`
      // and the InitOverlay picks up status="running".
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="btn-primary disabled:opacity-50"
        title="Wipes all matches and fruits, re-seeds from data.json, and re-runs the matchmaking pipeline for every apple"
      >
        {pending ? "Resetting…" : "Reset state"}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
