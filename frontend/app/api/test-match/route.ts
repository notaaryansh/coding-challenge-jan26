import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { runMatching, type Fruit } from "@/lib/matching";

export const dynamic = "force-dynamic";

type RawFruit = Omit<Fruit, "id"> & { id: unknown };

function normalize(f: RawFruit): Fruit {
  return { ...f, id: String(f.id) } as Fruit;
}

export async function POST() {
  try {
    const db = await getDb();

    const [apples] = await db.query<[RawFruit[]]>(
      `SELECT * FROM fruit WHERE type = "apple"`
    );
    if (!apples || apples.length === 0) {
      return NextResponse.json({ error: "no apples in pool" }, { status: 404 });
    }
    const source = normalize(apples[Math.floor(Math.random() * apples.length)]);

    const [oranges] = await db.query<[RawFruit[]]>(
      `SELECT * FROM fruit WHERE type = "orange"`
    );
    const pool = (oranges ?? []).map(normalize);

    const trace = runMatching(source, pool);

    return NextResponse.json({
      source,
      pool_type: "orange",
      pool_size: pool.length,
      pool,
      trace,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown error" },
      { status: 500 }
    );
  }
}
