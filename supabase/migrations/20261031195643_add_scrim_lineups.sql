/*
# Add public scrim lineups

1. New Tables
- `scrim_lineups` stores the lineup selected for each scrim.
- `id` uniquely identifies a lineup entry.
- `scrim_id` links the entry to a scrim and removes it when that scrim is removed.
- `player_id` links the entry to a player and removes it when that player is removed.
- `position` stores the lineup slot: CF, LF, RF, CM, LB, RB, or GK.
- `created_at` records when the lineup entry was created.

2. Security
- Row level security is enabled.
- This app has no sign-in, so lineup data is intentionally public/shared.
- Anonymous and authenticated visitors can read, add, edit, and delete lineup entries.
- Grants are limited to the verbs used by the app.

3. Important Notes
- The same player can appear only once per scrim.
- A scrim can contain one player in each selected position, while the app validates the visible lineup form.
*/

CREATE TABLE IF NOT EXISTS scrim_lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scrim_id uuid NOT NULL REFERENCES scrims(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position text NOT NULL CHECK (position IN ('CF', 'LF', 'RF', 'CM', 'LB', 'RB', 'GK')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scrim_id, player_id),
  UNIQUE (scrim_id, position)
);

ALTER TABLE scrim_lineups ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON scrim_lineups TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_scrim_lineups" ON scrim_lineups;
CREATE POLICY "anon_select_scrim_lineups" ON scrim_lineups FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_scrim_lineups" ON scrim_lineups;
CREATE POLICY "anon_insert_scrim_lineups" ON scrim_lineups FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_scrim_lineups" ON scrim_lineups;
CREATE POLICY "anon_update_scrim_lineups" ON scrim_lineups FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_scrim_lineups" ON scrim_lineups;
CREATE POLICY "anon_delete_scrim_lineups" ON scrim_lineups FOR DELETE
  TO anon, authenticated USING (true);
