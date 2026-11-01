/*
# IP Ban System

1. New Tables
- `banned_ips`
  - `id` (uuid, primary key)
  - `ip_address` (inet, unique, not null) — the banned IP
  - `reason` (text, optional) — why the ban was issued
  - `banned_by` (uuid, references auth.users) — which admin issued the ban
  - `created_at` (timestamptz, default now())

2. Security
- RLS enabled on `banned_ips`.
- SELECT granted to `authenticated` so admins can see the ban list.
- INSERT/DELETE only via SECURITY DEFINER RPCs (admin-only), not direct table grants.
- `add_ip_ban(p_ip_address, p_reason)` — admin-only, adds an IP to the ban list.
- `remove_ip_ban(p_ip_address)` — admin-only, removes an IP from the ban list.
- Both RPCs check `is_admin()` and reject non-admins.

3. Important Notes
- The ban list is checked by an edge function (`check-ip-ban`) that the frontend
  calls on page load. If the visitor's IP is banned, a full-screen block overlay
  is shown and access to the app is denied.
- Admins and super admins are never banned (the check function skips banned
  IPs that match an admin's IP — but in practice the edge function simply
  returns the banned status and the frontend handles the block).
*/

CREATE TABLE IF NOT EXISTS public.banned_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL UNIQUE,
  reason text,
  banned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.banned_ips ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.banned_ips TO authenticated;

DROP POLICY IF EXISTS "admins_select_banned_ips" ON public.banned_ips;
CREATE POLICY "admins_select_banned_ips" ON public.banned_ips FOR SELECT
  TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.add_ip_ban(p_ip_address text, p_reason text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Yetkisiz'; END IF;
  INSERT INTO public.banned_ips (ip_address, reason, banned_by)
  VALUES (p_ip_address::inet, p_reason, auth.uid())
  ON CONFLICT (ip_address) DO UPDATE SET reason = EXCLUDED.reason, banned_by = EXCLUDED.banned_by;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_ip_ban(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_ip_ban(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_ip_ban(p_ip_address text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Yetkisiz'; END IF;
  DELETE FROM public.banned_ips WHERE ip_address = p_ip_address::inet;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.remove_ip_ban(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_ip_ban(text) TO authenticated;
