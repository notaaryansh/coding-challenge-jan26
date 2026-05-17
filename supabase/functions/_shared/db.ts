import Surreal from "surrealdb";

let cached: Surreal | null = null;

export async function getDb(): Promise<Surreal> {
  if (cached) return cached;

  const db = new Surreal();
  await db.connect(Deno.env.get("SURREALDB_URL") ?? "ws://host.docker.internal:8000");
  await db.signin({
    username: Deno.env.get("SURREALDB_USER") ?? "root",
    password: Deno.env.get("SURREALDB_PASS") ?? "root",
  });
  await db.use({
    namespace: Deno.env.get("SURREALDB_NS") ?? "clera",
    database: Deno.env.get("SURREALDB_DB") ?? "matchmaking",
  });

  cached = db;
  return db;
}
