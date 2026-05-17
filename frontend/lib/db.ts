import Surreal from "surrealdb";

let cached: Surreal | null = null;

export async function getDb(): Promise<Surreal> {
  if (cached) return cached;

  const db = new Surreal();
  await db.connect(process.env.SURREALDB_URL ?? "ws://localhost:8000");
  await db.signin({
    username: process.env.SURREALDB_USER ?? "root",
    password: process.env.SURREALDB_PASS ?? "root",
  });
  await db.use({
    namespace: process.env.SURREALDB_NS ?? "clera",
    database: process.env.SURREALDB_DB ?? "matchmaking",
  });

  cached = db;
  return db;
}
