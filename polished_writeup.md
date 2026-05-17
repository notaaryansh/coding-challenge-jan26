# Matchmaking — Writeup

## Approach

Matching is a sequence of set operations on the opposite-type pool, run as a 3-pass pipeline:

1. **1st pass — initiator's preferences.** Each preference field is checked independently against the entire pool, producing one passing set per preference.
2. **2nd pass — intersection.** Candidates that survive every preference (the intersection of all passing sets).
3. **3rd pass — mutual acceptance.** Each surviving candidate's own preferences are checked against the initiator. Both sides must want each other.

The final candidate set is the result of pass 3. From it, the **first FIFO entry** is selected as the match (oldest waiting fruit wins).

### Example

Apple looking for an orange with:

```json
{
  "size": { "min": 5, "max": 12 },
  "hasWorm": false,
  "shineFactor": ["shiny", "extraShiny"]
}
```

- A = oranges with `shineFactor = shiny`
- B = oranges with `shineFactor = extraShiny`
- C = oranges with `hasWorm = false`
- D = oranges with `size ∈ [5, 12]`
- Forward candidates = `(A ∪ B) ∩ C ∩ D`
- Then for each candidate, verify the apple satisfies *their* preferences
- Result: first remaining candidate by `created_at`

If the result is empty, the new fruit is parked as `in_progress` for the next round.

## Persistence — the `match` table

Every match attempt produces a row, even when no partner is found. A row has either `progress = "in_progress"` (one side filled, waiting) or `progress = "matched"` (both sides filled, locked).

### Flow when a new fruit arrives

1. `INSERT fruit (is_matched = false)`
2. Query the opposite-type unmatched pool, ordered by `created_at ASC` — but with any fruits currently sitting in an `in_progress` match floated to the front (so the longest waiters get first shot).
3. Run the 3-pass filter pipeline → `FilterTrace` + passing IDs.
4. **If any candidate passes:**
   - Winner = first by FIFO.
   - In a transaction:
     - Either update the winner's existing `in_progress` match row, or create a new `matched` row.
     - Set `is_matched = true` on both fruits.
     - **Cascade-clean** every other `in_progress` row's trace, stripping the now-matched IDs from their candidate lists (so the admin UI never shows a matched fruit as still available).
5. **If no candidate passes:**
   - Create an `in_progress` row for the new fruit with the full `FilterTrace`. It waits for a future opposite-type arrival.

The stored `FilterTrace` is the same JSON the visualization renders — replay-able, inspectable, and the substrate for every aggregate metric in the admin dashboard.

### Assumption

If the 3rd pass returns multiple valid candidates, we take the FIFO winner — not the "best" one. With binary pass/fail constraints there is no notion of "better," so fairness (oldest waiter first) is the right tiebreaker.

## Metrics & admin dashboard

Because every match satisfies every constraint by construction, individual matches have no quality dimension — they're all "perfect" by definition. So the benchmark lives at the **system level**, not the per-match level.

The admin dashboard presents three concrete views:

### Popularity leaderboards

Computed across the currently-unmatched pool.

- **Most desirable** — how many opposite-type fruits would accept this one (sorted desc)
- **Pickiest** — how many opposite-type fruits this one rejects (sorted desc)
- **Wallflowers** — desirability = 0 (nobody wants them right now)
- **Longest waiting** — oldest in-progress fruits

### Near-miss distribution

Every unmatched apple × orange pair is bucketed by **distance** = total preferences that would need to be dropped (on either side) for the pair to mutually pass.

```
Matched         → already paired
1 pref away     → THE actionable bucket
2 prefs away    → still nudgeable
3–5 prefs away  → deep mismatch
6+ prefs away   → fundamentally incompatible
```

Buckets 1 and 2 expand into pair callouts naming exactly which preferences to drop to unlock the match. Clicking a pair opens a detail modal showing both fruits' full attributes, each preference with ✓/✗ status against the other fruit, and an "unlock" summary.

These metrics answer the actual question — *is the matchmaker performing well?* — by showing where the pool is structurally bottlenecked and which individual fruits are one nudge away from a match.

## UI actions

### New Conversation

Picks a fruit type (apple or orange) and runs the full pipeline end-to-end:

1. Browser → `POST` to the Supabase Edge Function `get-incoming-{apple|orange}` (served locally at `http://127.0.0.1:54321/functions/v1/...`).
2. Edge function generates a new fruit (random attributes + relaxed preferences), persists it to SurrealDB, runs the 3-pass matching against the opposite-type unmatched pool, and writes the resulting `match` row (matched or in_progress).
3. Response carries the source fruit, the pool that was evaluated, the full `FilterTrace`, and the partner (if matched).
4. Frontend stores the result in the visualization store; the slide-deck below re-renders and walks through every stage of the pipeline that just ran.

This is the system's actual production path. Every press is a real fruit, a real match attempt, and a real DB write.

### Reset state

Wipes everything and re-seeds from scratch. Useful for demos and re-running benchmarks against a known starting pool.

1. Browser → `POST /api/simulate` (Next.js API route).
2. The route spawns `scripts/simulate.mjs` as a detached Node process and returns immediately.
3. The script:
   - Truncates the `fruit` and `match` tables in SurrealDB.
   - Re-seeds from `data/raw_apples_and_oranges.json` (40 fruits).
   - Runs the matching pipeline for every apple in sequence, persisting matches and in-progress rows exactly as a live `New Conversation` would.
4. Progress is written into a `system:init` record. The frontend's `InitOverlay` polls this record and blocks the UI while the simulation runs, then unblocks once it's done.

After a reset, the dashboard reflects the deterministic post-seed state — same starting pool every time, so the metrics are reproducible.

## What was intentionally skipped

- **Trigger.dev.** Listed in the tech stack but not in the hard requirements. Matching is synchronous and fits in one request/response cycle — there's no long-running job, no scheduled work, no retry queue that would benefit from a background-job platform. Adding it would be ceremony without value.
- **Match quality scoring.** Constraints are binary, so there's no continuous notion of "match quality." Energy was spent on system-level health metrics (near-misses, popularity, fairness) instead.

## Open items

- **Cascade transaction safety** — what happens if the cascade-clean step fails mid-completion? Currently the match still completes; stale candidate IDs in other in_progress traces would be re-scrubbed on next access. Worth hardening in production.
