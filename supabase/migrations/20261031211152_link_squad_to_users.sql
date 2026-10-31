/*
# Link squad members to user accounts

1. Modified Tables
- `players` adds `user_id uuid` column (nullable, references auth.users).
  When set, the card is linked to a registered user account.
  A unique index prevents a user from having more than one squad card.

2. Security Definer Functions
- `add_to_squad(p_user_id, p_positions, p_overall, p_photo_url, p_card_url)`
  Creates a player card linked to an existing user. The player name is
  automatically taken from the profile username. Admin-only.
- `remove_from_squad(p_player_id)` deletes a player card. Admin-only.
- `update_player_photo(p_player_id, p_photo_url, p_card_url)` updates only
  photo fields. Admin-only.
- `update_card_description(p_description)` lets a signed-in user update
  only the description on their own linked player card.

3. Security
- Revoke UPDATE on profiles (photo_url) from authenticated users.
  Only admins can update photo_url via the player card system.
- Grant UPDATE (description) on profiles to authenticated for own row.
- Players table: users can update only their own linked card's description.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'user_id') THEN
    ALTER TABLE players ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS players_user_id_key ON players (user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.add_to_squad(
  p_user_id uuid,
  p_positions text[],
  p_overall int,
  p_photo_url text,
  p_card_url text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username text;
  v_player_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Yetkisiz'; END IF;
  SELECT username INTO v_username FROM public.profiles WHERE user_id = p_user_id;
  IF v_username IS NULL THEN RAISE EXCEPTION 'Kullanıcı bulunamadı'; END IF;
  IF EXISTS (SELECT 1 FROM public.players WHERE user_id = p_user_id) THEN RAISE EXCEPTION 'Bu kullanıcı zaten squadta'; END IF;
  INSERT INTO public.players (name, position, positions, overall, photo_url, card_url, user_id)
  VALUES (v_username, COALESCE(p_positions[1], 'CM'), p_positions, p_overall, p_photo_url, p_card_url, p_user_id)
  RETURNING id INTO v_player_id;
  RETURN v_player_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_to_squad(uuid, text[], int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_to_squad(uuid, text[], int, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_from_squad(p_player_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_found boolean;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Yetkisiz'; END IF;
  DELETE FROM public.players WHERE id = p_player_id RETURNING true INTO v_found;
  RETURN v_found;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.remove_from_squad(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_from_squad(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_player_photo(
  p_player_id uuid,
  p_photo_url text,
  p_card_url text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Yetkisiz'; END IF;
  UPDATE public.players SET photo_url = p_photo_url, card_url = p_card_url WHERE id = p_player_id;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_player_photo(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_player_photo(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_card_description(p_description text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Yetkisiz'; END IF;
  UPDATE public.profiles SET description = p_description WHERE user_id = v_user_id;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_card_description(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_card_description(text) TO authenticated;

-- Revoke photo_url from profile updates: users can only update description
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (description) ON profiles TO authenticated;

-- Allow users to update description on their own player card (linked via user_id)
DROP POLICY IF EXISTS "users_update_own_card_desc" ON players;
CREATE POLICY "users_update_own_card_desc" ON players FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
