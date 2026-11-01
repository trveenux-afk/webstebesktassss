/*
# Allow five substitute positions in scrim lineups

1. Modified Tables
- `scrim_lineups`: expands the allowed `position` values to include `BENCH_1` through `BENCH_5`.

2. Data Safety
- Existing starting lineup records are unchanged.
- Existing `BENCH_1` and `BENCH_2` records, if present, remain valid.
- No rows, columns, or player data are deleted.

3. Security
- Existing table permissions and row-level security policies are unchanged.

4. Important Notes
- The application already uses the five bench position names; this migration aligns the database constraint with that behavior.
- The existing unique constraints continue to prevent duplicate players and duplicate positions within one scrim.
*/

ALTER TABLE public.scrim_lineups
  DROP CONSTRAINT IF EXISTS scrim_lineups_position_check;

ALTER TABLE public.scrim_lineups
  ADD CONSTRAINT scrim_lineups_position_check
  CHECK (position = ANY (ARRAY[
    'CF'::text,
    'LF'::text,
    'RF'::text,
    'CM'::text,
    'LB'::text,
    'RB'::text,
    'GK'::text,
    'BENCH_1'::text,
    'BENCH_2'::text,
    'BENCH_3'::text,
    'BENCH_4'::text,
    'BENCH_5'::text
  ]));