/*
# Add bench positions to scrim lineup

1. Modified Tables
- No structural changes to `scrim_lineups` — the `position` column is text
  and already accepts any position string. We simply use "BENCH_1" and "BENCH_2"
  as new position values for bench/substitute players.

2. Important Notes
- No data migration needed; existing lineups are unaffected.
- The frontend type LINEUP_POSITIONS is updated to include bench slots.
- Bench players appear as small cards in the corner of the pitch view.
*/

-- No DDL needed; position is a text column.
SELECT 1;
