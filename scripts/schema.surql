-- Clera Matchmaking schema
-- Run via: surreal import --conn ws://localhost:8000 --user root --pass root --ns clera --db matchmaking scripts/schema.surql
-- Idempotent: safe to re-run.

DEFINE TABLE fruit SCHEMAFULL;
DEFINE FIELD type         ON fruit TYPE string ASSERT $value IN ["apple", "orange"];
DEFINE FIELD attributes   ON fruit FLEXIBLE TYPE object;
DEFINE FIELD preferences  ON fruit FLEXIBLE TYPE object;
DEFINE FIELD created_at   ON fruit TYPE datetime DEFAULT time::now();
DEFINE FIELD source       ON fruit TYPE string DEFAULT "seed" ASSERT $value IN ["seed", "incoming"];
DEFINE INDEX fruit_type_idx ON fruit FIELDS type;
