#!/usr/bin/env node
// Seeds SurrealDB with raw_apples_and_oranges.json.
// Truncates the `fruit` table for source="seed" rows first so re-running is safe.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Surreal from "surrealdb";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, "../data/raw_apples_and_oranges.json");
const SCHEMA_PATH = resolve(__dirname, "./schema.surql");

const {
  SURREALDB_URL = "ws://localhost:8000",
  SURREALDB_USER = "root",
  SURREALDB_PASS = "root",
  SURREALDB_NS = "clera",
  SURREALDB_DB = "matchmaking",
} = process.env;

const db = new Surreal();

async function main() {
  console.log(`→ connecting to ${SURREALDB_URL}`);
  await db.connect(SURREALDB_URL);
  await db.signin({ username: SURREALDB_USER, password: SURREALDB_PASS });
  await db.use({ namespace: SURREALDB_NS, database: SURREALDB_DB });

  console.log(`→ applying schema`);
  const schema = await readFile(SCHEMA_PATH, "utf8");
  await db.query(schema);

  console.log(`→ wiping prior seed rows`);
  await db.query(`DELETE fruit WHERE source = "seed"`);

  const raw = await readFile(SEED_PATH, "utf8");
  const fruits = JSON.parse(raw);
  console.log(`→ inserting ${fruits.length} fruits`);

  for (const fruit of fruits) {
    await db.create("fruit", { ...fruit, source: "seed" });
  }

  const [apples] = await db.query(`SELECT count() FROM fruit WHERE type = "apple" GROUP ALL`);
  const [oranges] = await db.query(`SELECT count() FROM fruit WHERE type = "orange" GROUP ALL`);
  console.log(`✓ seeded: ${apples?.[0]?.count ?? 0} apples, ${oranges?.[0]?.count ?? 0} oranges`);

  await db.close();
}

main().catch((err) => {
  console.error("✗ seed failed:", err);
  process.exit(1);
});
