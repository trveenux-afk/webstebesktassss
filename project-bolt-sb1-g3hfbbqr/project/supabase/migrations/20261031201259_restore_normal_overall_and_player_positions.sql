/*
# Restore 100-point player OVR and multi-position players

1. Modified Table
- `players.overall` is restored to a normal 0-100 OVR.
- `players.positions` stores multiple positions from CF, LF, RF, CM, LB, RB, GK and All Rounder.
- Existing 1-10 overall values are multiplied by ten so current players keep their relative strength.

2. Security
- Existing player policies remain in place: public reads and admin-only writes.
*/

ALTER TABLE players ADD COLUMN IF NOT EXISTS positions text[] NOT NULL DEFAULT ARRAY['CM']::text[];
UPDATE players SET overall = overall * 10 WHERE overall <= 10;
UPDATE players SET positions = ARRAY[position]::text[] WHERE positions = ARRAY['CM']::text[] AND position <> 'CM';
ALTER TABLE players ALTER COLUMN overall SET DEFAULT 75;
