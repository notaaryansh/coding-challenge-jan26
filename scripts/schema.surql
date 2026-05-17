-- Clera Matchmaking schema. Idempotent: safe to re-run.

DEFINE TABLE fruit SCHEMAFULL;
DEFINE FIELD type         ON fruit TYPE string ASSERT $value IN ["apple", "orange"];
DEFINE FIELD attributes   ON fruit FLEXIBLE TYPE object;
DEFINE FIELD preferences  ON fruit FLEXIBLE TYPE object;
DEFINE FIELD created_at   ON fruit TYPE datetime DEFAULT time::now();
DEFINE FIELD source       ON fruit TYPE string DEFAULT "seed" ASSERT $value IN ["seed", "incoming"];
DEFINE FIELD is_matched   ON fruit TYPE bool DEFAULT false;
DEFINE INDEX fruit_type_idx ON fruit FIELDS type;
DEFINE INDEX fruit_unmatched_idx ON fruit FIELDS type, is_matched;

DEFINE TABLE match SCHEMAFULL;
DEFINE FIELD initiator    ON match TYPE string ASSERT $value IN ["apple", "orange"];
DEFINE FIELD apple        ON match TYPE option<record<fruit>>;
DEFINE FIELD orange       ON match TYPE option<record<fruit>>;
DEFINE FIELD progress     ON match TYPE string ASSERT $value IN ["in_progress", "matched"];
DEFINE FIELD filter_trace ON match FLEXIBLE TYPE object;
DEFINE FIELD created_at   ON match TYPE datetime DEFAULT time::now();
DEFINE FIELD matched_at   ON match TYPE option<datetime>;
DEFINE INDEX match_progress_idx ON match FIELDS progress;
DEFINE INDEX match_created_idx ON match FIELDS created_at;
DEFINE INDEX match_matched_at_idx ON match FIELDS matched_at;
