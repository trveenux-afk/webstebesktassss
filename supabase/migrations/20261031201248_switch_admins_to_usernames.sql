/*
# Switch admin access to username-based accounts

1. New Table
- `admin_invites` stores usernames approved by an existing administrator.
- Only an existing administrator can create or remove an approved username.

2. Modified Table
- `admin_users.username` stores the public login name for each administrator.
- Existing administrator rows are intentionally cleared so the owner can start over.

3. Security
- Username approval and activation are performed by database functions.
- The first authenticated account can claim admin only when no admin exists.
- Later accounts can activate only an admin-approved username.
- Passwords remain inside Supabase Auth and are never stored in public tables.
*/

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_username_key ON admin_users (lower(username)) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_invites (
  username text PRIMARY KEY,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON admin_invites TO authenticated;

DROP POLICY IF EXISTS "admins_read_invites" ON admin_invites;
CREATE POLICY "admins_read_invites" ON admin_invites FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "admins_insert_invites" ON admin_invites;
CREATE POLICY "admins_insert_invites" ON admin_invites FOR INSERT TO authenticated WITH CHECK (public.is_admin() AND invited_by = auth.uid());
DROP POLICY IF EXISTS "admins_delete_invites" ON admin_invites;
CREATE POLICY "admins_delete_invites" ON admin_invites FOR DELETE TO authenticated USING (public.is_admin());

DROP FUNCTION IF EXISTS public.claim_first_admin();
CREATE OR REPLACE FUNCTION public.claim_first_admin(p_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR length(trim(p_username)) < 3 THEN RETURN false; END IF;
  INSERT INTO public.admin_users (user_id, username)
  SELECT auth.uid(), lower(trim(p_username))
  WHERE NOT EXISTS (SELECT 1 FROM public.admin_users)
  ON CONFLICT DO NOTHING;
  RETURN EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.can_register_admin_username(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.admin_users)
    OR EXISTS (SELECT 1 FROM public.admin_invites WHERE lower(username) = lower(trim(p_username)));
$$;

CREATE OR REPLACE FUNCTION public.activate_invited_admin(p_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR length(trim(p_username)) < 3 THEN RETURN false; END IF;
  INSERT INTO public.admin_users (user_id, username)
  SELECT auth.uid(), lower(trim(p_username))
  WHERE EXISTS (SELECT 1 FROM public.admin_invites WHERE lower(username) = lower(trim(p_username)))
  ON CONFLICT DO NOTHING;
  DELETE FROM public.admin_invites WHERE lower(username) = lower(trim(p_username));
  RETURN EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_register_admin_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_register_admin_username(text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_invited_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_invited_admin(text) TO authenticated;

-- The owner requested a clean administrator start.
DELETE FROM public.admin_users;
DELETE FROM auth.users WHERE email LIKE '%@admin.local';
