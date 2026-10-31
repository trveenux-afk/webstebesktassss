/*
# Add administrator access control

1. New Tables
- `admin_users` stores the authenticated accounts allowed to manage the public scouting data.
- `user_id` is the Supabase Auth user identifier.
- `created_at` records when administrator access was granted.

2. Security Changes
- Public visitors retain SELECT access to players, scrims, scrim_stats, and scrim_lineups.
- INSERT, UPDATE, and DELETE access for those tables is restricted to authenticated users present in admin_users.
- The browser cannot insert admin rows directly.
- A one-time `claim_first_admin` function lets the first authenticated account claim administrator access when no administrator exists.
- `is_admin` is a server-side SECURITY DEFINER check used by every write policy.

3. Important Notes
- This is a shared public scouting board, not a private multi-team workspace.
- The first account created in the Admin area becomes the initial administrator only when the administrator table is empty.
- All later accounts remain read-only unless administrator access is granted through the database.
*/

CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON admin_users TO authenticated;

DROP POLICY IF EXISTS "admins_read_own_record" ON admin_users;
CREATE POLICY "admins_read_own_record" ON admin_users FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.admin_users (user_id)
  SELECT auth.uid()
  WHERE NOT EXISTS (SELECT 1 FROM public.admin_users)
  ON CONFLICT DO NOTHING;

  RETURN EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

-- Public reads remain available; every write now requires server-checked admin access.
DROP POLICY IF EXISTS "anon_insert_players" ON players;
CREATE POLICY "admin_insert_players" ON players FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "anon_update_players" ON players;
CREATE POLICY "admin_update_players" ON players FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "anon_delete_players" ON players;
CREATE POLICY "admin_delete_players" ON players FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "anon_insert_scrims" ON scrims;
CREATE POLICY "admin_insert_scrims" ON scrims FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "anon_update_scrims" ON scrims;
CREATE POLICY "admin_update_scrims" ON scrims FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "anon_delete_scrims" ON scrims;
CREATE POLICY "admin_delete_scrims" ON scrims FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "anon_insert_scrim_stats" ON scrim_stats;
CREATE POLICY "admin_insert_scrim_stats" ON scrim_stats FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "anon_update_scrim_stats" ON scrim_stats;
CREATE POLICY "admin_update_scrim_stats" ON scrim_stats FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "anon_delete_scrim_stats" ON scrim_stats;
CREATE POLICY "admin_delete_scrim_stats" ON scrim_stats FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "anon_insert_scrim_lineups" ON scrim_lineups;
CREATE POLICY "admin_insert_scrim_lineups" ON scrim_lineups FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "anon_update_scrim_lineups" ON scrim_lineups;
CREATE POLICY "admin_update_scrim_lineups" ON scrim_lineups FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "anon_delete_scrim_lineups" ON scrim_lineups;
CREATE POLICY "admin_delete_scrim_lineups" ON scrim_lineups FOR DELETE TO authenticated USING (public.is_admin());
