/*
# Add profiles, role management, and public highlights

1. New Tables
- `profiles` stores every user's username, card description, optional photo, role, and owner flag.
- `highlights` stores public video posts and their captions.

2. Roles
- `owner` is the first registered account and can assign or remove admin and scrim_hoster roles.
- `admin` can edit players, scrim results, lineups, stats, photos, and highlight posts.
- `scrim_hoster` can add scrims only.
- `member` can manage only their own profile and highlights.

3. Storage
- Creates the public-read `highlights` bucket.
- Authenticated users can upload only into their own user-id folder.
- Users can remove their own uploaded videos; admins can manage all highlight rows.

4. Security
- Public visitors can read public profiles, highlights, players, scrims, lineups, and stats.
- Profile roles and owner flags are not client-writable.
- Role changes use a SECURITY DEFINER function that checks the signed-in owner.
- All write permissions are enforced by RLS and storage policies, not only by the interface.
*/

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  description text NOT NULL DEFAULT '',
  photo_url text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'scrim_hoster')),
  is_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON profiles (lower(username));
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON profiles TO anon, authenticated;
GRANT INSERT ON profiles TO authenticated;
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (username, description, photo_url) ON profiles TO authenticated;

DROP POLICY IF EXISTS "public_read_profiles" ON profiles;
CREATE POLICY "public_read_profiles" ON profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
CREATE POLICY "users_insert_own_profile" ON profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.register_profile(p_username text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner boolean;
BEGIN
  IF auth.uid() IS NULL OR length(trim(p_username)) < 3 THEN RETURN false; END IF;
  v_owner := NOT EXISTS (SELECT 1 FROM public.profiles);
  INSERT INTO public.profiles (user_id, username, role, is_owner)
  VALUES (auth.uid(), lower(trim(p_username)), CASE WHEN v_owner THEN 'admin' ELSE 'member' END, v_owner)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.register_profile(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_profile(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_owner = true);
$$;

CREATE OR REPLACE FUNCTION public.is_scrim_hoster()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'scrim_hoster');
$$;

CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_owner = true) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_role NOT IN ('member', 'admin', 'scrim_hoster') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  UPDATE public.profiles SET role = p_role WHERE user_id = p_user_id AND is_owner = false;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_scrim_hoster() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_scrim_hoster() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;

-- Existing scouting writes: admins only, except scrim creation for scrim hosters.
DROP POLICY IF EXISTS "admin_insert_players" ON players;
CREATE POLICY "admin_insert_players" ON players FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_players" ON players;
CREATE POLICY "admin_update_players" ON players FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_players" ON players;
CREATE POLICY "admin_delete_players" ON players FOR DELETE TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_scrims" ON scrims;
CREATE POLICY "host_insert_scrims" ON scrims FOR INSERT TO authenticated WITH CHECK (public.is_scrim_hoster());
DROP POLICY IF EXISTS "admin_update_scrims" ON scrims;
CREATE POLICY "admin_update_scrims" ON scrims FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_scrims" ON scrims;
CREATE POLICY "admin_delete_scrims" ON scrims FOR DELETE TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_scrim_stats" ON scrim_stats;
CREATE POLICY "admin_insert_scrim_stats" ON scrim_stats FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_scrim_stats" ON scrim_stats;
CREATE POLICY "admin_update_scrim_stats" ON scrim_stats FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_scrim_stats" ON scrim_stats;
CREATE POLICY "admin_delete_scrim_stats" ON scrim_stats FOR DELETE TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "admin_insert_scrim_lineups" ON scrim_lineups;
CREATE POLICY "admin_insert_scrim_lineups" ON scrim_lineups FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_update_scrim_lineups" ON scrim_lineups;
CREATE POLICY "admin_update_scrim_lineups" ON scrim_lineups FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_delete_scrim_lineups" ON scrim_lineups;
CREATE POLICY "admin_delete_scrim_lineups" ON scrim_lineups FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  caption text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON highlights TO anon, authenticated;
GRANT INSERT, DELETE ON highlights TO authenticated;
DROP POLICY IF EXISTS "public_read_highlights" ON highlights;
CREATE POLICY "public_read_highlights" ON highlights FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "users_insert_highlights" ON highlights;
CREATE POLICY "users_insert_highlights" ON highlights FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "users_delete_highlights" ON highlights;
CREATE POLICY "users_delete_highlights" ON highlights FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

INSERT INTO storage.buckets (id, name, public) VALUES ('highlights', 'highlights', true) ON CONFLICT (id) DO UPDATE SET public = true;
DROP POLICY IF EXISTS "public_read_highlight_files" ON storage.objects;
CREATE POLICY "public_read_highlight_files" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'highlights');
DROP POLICY IF EXISTS "users_upload_highlight_files" ON storage.objects;
CREATE POLICY "users_upload_highlight_files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'highlights' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "users_delete_highlight_files" ON storage.objects;
CREATE POLICY "users_delete_highlight_files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'highlights' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
