/*
# User Ban System

1. Modified Tables
- `profiles`: adds `is_banned boolean NOT NULL DEFAULT false` column.
  When true, the user is banned and cannot access the site.

2. Security Definer Functions
- `ban_user(p_user_id)` — admin-only, sets is_banned = true on a user.
  Prevents banning yourself or other admins/owner.
- `unban_user(p_user_id)` — admin-only, sets is_banned = false.
- Both check is_admin() and reject non-admins.

3. Security
- RLS already enabled on profiles; existing policies unchanged.
- The new column is NOT directly writable by users — only via the RPCs.
- REVOKE UPDATE on the new column from authenticated to prevent
  users from unbanning themselves.

4. Important Notes
- The auth flow checks is_banned after loading the profile. If banned,
  the user is signed out and shown a "banned" screen.
- Admins cannot ban themselves, other admins, or the owner.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (description) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text; v_owner boolean;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Yetkisiz'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Kendinizi banlayamazsınız'; END IF;
  SELECT role, is_owner INTO v_role, v_owner FROM public.profiles WHERE user_id = p_user_id;
  IF v_owner IS TRUE THEN RAISE EXCEPTION 'Super admin banlanamaz'; END IF;
  IF v_role = 'admin' THEN RAISE EXCEPTION 'Admin banlanamaz'; END IF;
  UPDATE public.profiles SET is_banned = true WHERE user_id = p_user_id;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ban_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ban_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unban_user(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Yetkisiz'; END IF;
  UPDATE public.profiles SET is_banned = false WHERE user_id = p_user_id;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.unban_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unban_user(uuid) TO authenticated;
