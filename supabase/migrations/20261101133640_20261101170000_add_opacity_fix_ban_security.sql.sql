/*
# Add video opacity slider + fix ban security

1. Modified Tables
- `site_settings`: adds `background_video_opacity integer NOT NULL DEFAULT 20`
  Controls the transparency of the background video (0-100 percent).

2. Security Fixes
- `banned_ips`: REVOKE all direct INSERT/UPDATE/DELETE from anon and authenticated.
  Only SELECT remains for authenticated (admin-only via policy). All writes
  must go through the SECURITY DEFINER RPCs (add_ip_ban, remove_ip_ban).
- `profiles`: Drop the old `users_update_own_profile` policy that allowed users
  to UPDATE any column on their own row — this let a banned user unban
  themselves by setting is_banned=false. Replace with a column-restricted
  policy: users can only UPDATE the `description` column on their own row.
- GRANT UPDATE (description, is_banned) on profiles to authenticated is
  replaced by GRANT UPDATE (description) only — is_banned is NOT user-writable.

3. Important Notes
- The opacity column uses the existing admin-only UPDATE policy on site_settings.
- No data is lost; existing settings keep the default 20% opacity.
*/

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS background_video_opacity integer NOT NULL DEFAULT 20;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'site_settings_background_video_opacity_check'
      AND conrelid = 'public.site_settings'::regclass
  ) THEN
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_background_video_opacity_check
      CHECK (background_video_opacity >= 0 AND background_video_opacity <= 100);
  END IF;
END $$;

GRANT UPDATE (background_video_url, background_video_volume, background_video_opacity) ON public.site_settings TO authenticated;

-- Fix banned_ips: revoke all direct write access
REVOKE INSERT, UPDATE, DELETE ON public.banned_ips FROM anon, authenticated;

-- Fix profiles: users must NOT be able to update is_banned on their own row
-- Drop the overly-permissive policy
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;

-- Recreate with column restriction: only description is user-writable
CREATE POLICY "users_update_own_desc" ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Ensure GRANT only covers description (not is_banned)
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (description) ON public.profiles TO authenticated;
