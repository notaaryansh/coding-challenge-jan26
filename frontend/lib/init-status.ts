import { getDb } from "./db";

export interface InitStatus {
  status: "idle" | "running" | "done" | "error";
  processed: number;
  total: number;
  started_at: string | null;
  finished_at: string | null;
  error?: string;
}

interface RawInitRow {
  status?: string;
  processed?: number;
  total?: number;
  started_at?: string;
  finished_at?: string;
  error?: string;
}

export async function getInitStatus(): Promise<InitStatus> {
  const db = await getDb();
  try {
    const [rows] = await db.query<[RawInitRow[]]>(`SELECT * FROM system:init`);
    const row = rows?.[0];
    if (!row) {
      return {
        status: "idle",
        processed: 0,
        total: 0,
        started_at: null,
        finished_at: null,
      };
    }
    return {
      status: (row.status as InitStatus["status"]) ?? "idle",
      processed: row.processed ?? 0,
      total: row.total ?? 0,
      started_at: row.started_at ?? null,
      finished_at: row.finished_at ?? null,
      error: row.error,
    };
  } catch {
    return {
      status: "idle",
      processed: 0,
      total: 0,
      started_at: null,
      finished_at: null,
    };
  }
}
