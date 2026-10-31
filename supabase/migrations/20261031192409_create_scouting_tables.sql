/*
# Create Besiktas Scrim Stats tables

1. New Tables
- `players`: Stores team players with their name, position, photo URL, and a GFX card image URL.
- `scrims`: Stores scrim matches with opponent name, result, and date.
- `scrim_stats`: Stores per-player per-scrim statistics (goals, assists, tackles, saves, rating/OVR).

2. Security
- Enable RLS on all tables.
- Grant CRUD to anon + authenticated (no-auth single-tenant app — the data is intentionally public/shared).
- Allow anon + authenticated full CRUD because this is a no-sign-in team management tool.
*/

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position text NOT NULL DEFAULT 'CM',
  photo_url text,
  card_url text,
  overall int NOT NULL DEFAULT 75,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON players TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_players" ON players;
CREATE POLICY "anon_select_players" ON players FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_players" ON players;
CREATE POLICY "anon_insert_players" ON players FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_players" ON players;
CREATE POLICY "anon_update_players" ON players FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_players" ON players;
CREATE POLICY "anon_delete_players" ON players FOR DELETE
  TO anon, authenticated USING (true);

-- Scrims table
CREATE TABLE IF NOT EXISTS scrims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opponent text NOT NULL,
  result text NOT NULL DEFAULT 'Draw',
  team_score int NOT NULL DEFAULT 0,
  opponent_score int NOT NULL DEFAULT 0,
  scrim_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scrims ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON scrims TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_scrims" ON scrims;
CREATE POLICY "anon_select_scrims" ON scrims FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_scrims" ON scrims;
CREATE POLICY "anon_insert_scrims" ON scrims FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_scrims" ON scrims;
CREATE POLICY "anon_update_scrims" ON scrims FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_scrims" ON scrims;
CREATE POLICY "anon_delete_scrims" ON scrims FOR DELETE
  TO anon, authenticated USING (true);

-- Scrim stats table (per-player per-scrim)
CREATE TABLE IF NOT EXISTS scrim_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scrim_id uuid NOT NULL REFERENCES scrims(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  goals int NOT NULL DEFAULT 0,
  assists int NOT NULL DEFAULT 0,
  tackles int NOT NULL DEFAULT 0,
  saves int NOT NULL DEFAULT 0,
  rating int NOT NULL DEFAULT 70,
  created_at timestamptz DEFAULT now(),
  UNIQUE (scrim_id, player_id)
);

ALTER TABLE scrim_stats ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON scrim_stats TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_scrim_stats" ON scrim_stats;
CREATE POLICY "anon_select_scrim_stats" ON scrim_stats FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_scrim_stats" ON scrim_stats;
CREATE POLICY "anon_insert_scrim_stats" ON scrim_stats FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_scrim_stats" ON scrim_stats;
CREATE POLICY "anon_update_scrim_stats" ON scrim_stats FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_scrim_stats" ON scrim_stats;
CREATE POLICY "anon_delete_scrim_stats" ON scrim_stats FOR DELETE
  TO anon, authenticated USING (true);
