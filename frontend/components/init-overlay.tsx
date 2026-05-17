"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { InitStatus } from "@/lib/init-status";

interface Props {
  status: InitStatus;
}

/**
 * Full-screen "Initializing..." overlay. Server reads `system:init` and passes
 * the snapshot here; while status === "running" we auto-refresh once per second
 * so the progress count stays current and the page returns to normal as soon
 * as the script flips status to "done".
 */
export function InitOverlay({ status }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (status.status !== "running") return;
    const id = setInterval(() => router.refresh(), 1000);
    return () => clearInterval(id);
  }, [status.status, router]);

  if (status.status !== "running") return null;

  const pct = status.total > 0 ? (status.processed / status.total) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-50/95 backdrop-blur-sm dark:bg-zinc-950/95">
      <div className="flex max-w-md flex-col items-center gap-5 px-6 py-8 text-center">
        <svg
          className="h-10 w-10 animate-spin text-zinc-700 dark:text-zinc-200"
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
        <div>
          <h2 className="text-lg font-semibold">Initializing</h2>
          <p className="mt-1 text-sm text-muted">
            Running matchmaking for every apple in the pool.
          </p>
        </div>
        {status.total > 0 && (
          <div className="w-full">
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full bg-zinc-700 transition-all duration-300 dark:bg-zinc-200"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {status.processed} of {status.total} apples processed
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
