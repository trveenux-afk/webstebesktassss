/*
# Allow short usernames during account creation

1. Modified Function
- `public.register_profile`: removes the old three-character minimum and accepts any non-empty username up to the existing 24-character limit.

2. Security
- Keeps the existing authenticated-user check through `auth.uid()`.
- Keeps lowercase normalization and the first-account owner assignment unchanged.
- Does not change roles, permissions, or profile ownership rules.

3. Important Notes
- A username may now be one character long.
- Existing usernames and accounts are not changed.
*/

CREATE OR REPLACE FUNCTION public.register_profile(p_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner boolean;
  v_username text := lower(trim(p_username));
BEGIN
  IF auth.uid() IS NULL OR v_username = '' OR length(v_username) > 24 THEN
    RETURN false;
  END IF;
  v_owner := NOT EXISTS (SELECT 1 FROM public.profiles);
  INSERT INTO public.profiles (user_id, username, role, is_owner)
  VALUES (auth.uid(), v_username, CASE WHEN v_owner THEN 'admin' ELSE 'member' END, v_owner)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_profile(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_profile(text) TO authenticated;
