/*
# Add admin media management and description moderation

1. Modified Tables
- `site_settings`: adds `background_video_url`, the public MP4 URL used as the site background video.
- `highlights`: keeps existing rows and public reading, but changes all highlight creation, editing, and deletion to admin-only database-enforced actions.

2. New Storage Buckets
- `site-media`: public-read bucket for the single site background MP4. Only admins can upload, replace, or remove files.
- `player-photos`: public-read bucket for player and card images. Only admins can upload, replace, or remove files.
- `highlights`: remains public-read, but video file uploads and removal are restricted to admins.

3. New Functions
- `admin_update_profile_description`: lets admins edit or clear a member description after server-side length and unsafe-content checks.
- `description_is_allowed`: keeps description checks on the database boundary so direct API calls cannot bypass the moderation rule.

4. Security
- Storage writes are restricted to authenticated admins and the correct bucket.
- Highlight table writes are restricted to authenticated admins; public visitors retain read-only access.
- Background video updates are limited to the `background_video_url` column for authenticated users and protected by the existing admin RLS policy.
- All new SECURITY DEFINER functions use a fixed search path and revoke anonymous/public execution.

5. Data Safety
- No existing rows, files, columns, or user accounts are deleted.
- Existing highlight records remain visible; only future write permissions are narrowed.
*/

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS background_video_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-media', 'site-media', true, 52428800, ARRAY['video/mp4']::text[])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 52428800, allowed_mime_types = ARRAY['video/mp4']::text[];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('player-photos', 'player-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

DROP POLICY IF EXISTS "public_read_site_media" ON storage.objects;
CREATE POLICY "public_read_site_media" ON storage.objects FOR SELECT
TO anon, authenticated USING (bucket_id = 'site-media');
DROP POLICY IF EXISTS "admins_upload_site_media" ON storage.objects;
CREATE POLICY "admins_upload_site_media" ON storage.objects FOR INSERT
TO authenticated WITH CHECK (bucket_id = 'site-media' AND public.is_admin());
DROP POLICY IF EXISTS "admins_update_site_media" ON storage.objects;
CREATE POLICY "admins_update_site_media" ON storage.objects FOR UPDATE
TO authenticated USING (bucket_id = 'site-media' AND public.is_admin()) WITH CHECK (bucket_id = 'site-media' AND public.is_admin());
DROP POLICY IF EXISTS "admins_delete_site_media" ON storage.objects;
CREATE POLICY "admins_delete_site_media" ON storage.objects FOR DELETE
TO authenticated USING (bucket_id = 'site-media' AND public.is_admin());

DROP POLICY IF EXISTS "public_read_player_photos" ON storage.objects;
CREATE POLICY "public_read_player_photos" ON storage.objects FOR SELECT
TO anon, authenticated USING (bucket_id = 'player-photos');
DROP POLICY IF EXISTS "admins_upload_player_photos" ON storage.objects;
CREATE POLICY "admins_upload_player_photos" ON storage.objects FOR INSERT
TO authenticated WITH CHECK (bucket_id = 'player-photos' AND public.is_admin());
DROP POLICY IF EXISTS "admins_update_player_photos" ON storage.objects;
CREATE POLICY "admins_update_player_photos" ON storage.objects FOR UPDATE
TO authenticated USING (bucket_id = 'player-photos' AND public.is_admin()) WITH CHECK (bucket_id = 'player-photos' AND public.is_admin());
DROP POLICY IF EXISTS "admins_delete_player_photos" ON storage.objects;
CREATE POLICY "admins_delete_player_photos" ON storage.objects FOR DELETE
TO authenticated USING (bucket_id = 'player-photos' AND public.is_admin());

DROP POLICY IF EXISTS "users_upload_highlight_files" ON storage.objects;
DROP POLICY IF EXISTS "users_delete_highlight_files" ON storage.objects;
DROP POLICY IF EXISTS "admins_upload_highlight_files" ON storage.objects;
CREATE POLICY "admins_upload_highlight_files" ON storage.objects FOR INSERT
TO authenticated WITH CHECK (bucket_id = 'highlights' AND public.is_admin() AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "admins_delete_highlight_files" ON storage.objects;
CREATE POLICY "admins_delete_highlight_files" ON storage.objects FOR DELETE
TO authenticated USING (bucket_id = 'highlights' AND public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.highlights FROM authenticated;
GRANT INSERT, UPDATE, DELETE ON public.highlights TO authenticated;
DROP POLICY IF EXISTS "users_insert_highlights" ON public.highlights;
CREATE POLICY "admins_insert_highlights" ON public.highlights FOR INSERT
TO authenticated WITH CHECK (public.is_admin() AND user_id = auth.uid());
DROP POLICY IF EXISTS "users_update_highlights" ON public.highlights;
CREATE POLICY "admins_update_highlights" ON public.highlights FOR UPDATE
TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin() AND user_id = auth.uid());
DROP POLICY IF EXISTS "users_delete_highlights" ON public.highlights;
CREATE POLICY "admins_delete_highlights" ON public.highlights FOR DELETE
TO authenticated USING (public.is_admin());

REVOKE UPDATE ON public.site_settings FROM authenticated;
GRANT UPDATE (background_video_url) ON public.site_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.description_is_allowed(p_description text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN length(coalesce(p_description, '')) <= 200
    AND coalesce(p_description, '') !~* '<\s*/?\s*(script|iframe|object|embed)'
    AND coalesce(p_description, '') !~* 'javascript\s*:'
    AND coalesce(p_description, '') !~* '\m(rape|nazi|porn|fuck|shit|orospu|sikik|amk)\M';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.description_is_allowed(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_profile_description(p_user_id uuid, p_description text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_description text := left(trim(coalesce(p_description, '')), 200);
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.description_is_allowed(v_description) THEN RAISE EXCEPTION 'Description is not allowed'; END IF;
  UPDATE public.profiles SET description = v_description WHERE user_id = p_user_id;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_update_profile_description(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_profile_description(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_card_description(p_description text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user_id uuid := auth.uid();
DECLARE v_description text := left(trim(coalesce(p_description, '')), 200);
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.description_is_allowed(v_description) THEN RAISE EXCEPTION 'Description is not allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE user_id = v_user_id) THEN RAISE EXCEPTION 'User is not in squad'; END IF;
  UPDATE public.profiles SET description = v_description WHERE user_id = v_user_id;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_card_description(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_card_description(text) TO authenticated;