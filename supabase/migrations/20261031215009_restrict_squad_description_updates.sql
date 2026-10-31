/*
# Restrict profile descriptions to squad members

1. Security
- Only users with a linked row in `players` may update their profile description.
- Direct profile UPDATE access is removed from authenticated users.
- The SECURITY DEFINER function performs the squad-membership check using auth.uid().
- Names, photos, roles, and squad membership remain outside user control.

2. Data Safety
- Existing descriptions are preserved.
- No rows or columns are deleted.
*/

REVOKE UPDATE ON public.profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.update_card_description(p_description text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'User is not in squad';
  END IF;
  UPDATE public.profiles
  SET description = left(trim(coalesce(p_description, '')), 200)
  WHERE user_id = v_user_id;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_card_description(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_card_description(text) TO authenticated;
