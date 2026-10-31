/*
# Add user deletion, site settings, and highlight title field

1. Security Definer Functions
- `delete_user(p_user_id)` lets the owner delete a non-owner user's auth account.
  Uses `SECURITY DEFINER` so it can access auth.users. Only callable by owner.
  Prevents deleting yourself or another owner.

2. New Tables
- `site_settings` (single row, id=1) stores photo display configuration:
  object_fit (cover/contain), object_position (center/top/bottom/left/right),
  zoom (100-200), card_size (small/medium/large). Defaults to cover/center/100/medium.

3. Modified Tables
- `highlights` adds `title text NOT NULL DEFAULT ''` column for video titles.

4. Security
- `delete_user` revoked from PUBLIC/anon, granted to authenticated.
- `site_settings` is public-read (anon+authenticated), admin-only write via RLS.
*/

CREATE OR REPLACE FUNCTION public.delete_user(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_owner boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT is_owner INTO v_current_owner FROM public.profiles WHERE user_id = auth.uid();
  IF v_current_owner IS NOT TRUE THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot delete yourself'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id AND is_owner = true) THEN RAISE EXCEPTION 'Cannot delete owner'; END IF;
  DELETE FROM auth.users WHERE id = p_user_id;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS site_settings (
  id int PRIMARY KEY DEFAULT 1,
  object_fit text NOT NULL DEFAULT 'cover' CHECK (object_fit IN ('cover', 'contain')),
  object_position text NOT NULL DEFAULT 'center' CHECK (object_position IN ('center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right')),
  zoom int NOT NULL DEFAULT 100 CHECK (zoom >= 50 AND zoom <= 200),
  card_size text NOT NULL DEFAULT 'medium' CHECK (card_size IN ('small', 'medium', 'large')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON site_settings TO anon, authenticated;
REVOKE UPDATE ON site_settings FROM authenticated;
GRANT UPDATE ON site_settings TO authenticated;
DROP POLICY IF EXISTS "public_read_settings" ON site_settings;
CREATE POLICY "public_read_settings" ON site_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_update_settings" ON site_settings;
CREATE POLICY "admin_update_settings" ON site_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'highlights' AND column_name = 'title') THEN
    ALTER TABLE highlights ADD COLUMN title text NOT NULL DEFAULT '';
  END IF;
END $$;
