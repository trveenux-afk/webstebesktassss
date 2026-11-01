/*
# Make player crop saving reliable and secure

1. Modified Database Function
- Recreates `update_player_photo_crop_drag` without changing its arguments or stored player data.
- Keeps the 50–300 zoom validation and 0–100 position validation used by the editor.
- Sets a fixed `search_path` so the SECURITY DEFINER function always resolves database objects safely.

2. Security
- Keeps the admin check through `public.is_admin()`.
- Removes anonymous and public execution.
- Grants execution only to signed-in users; the admin check remains mandatory inside the function.

3. Important Notes
- Existing player photos and crop coordinates are not changed.
- The browser also has a protected table-update fallback so a temporary RPC schema-cache issue does not prevent an authorized admin from saving.
*/

CREATE OR REPLACE FUNCTION public.update_player_photo_crop_drag(
  p_player_id uuid,
  p_photo_url text,
  p_card_url text,
  p_photo_zoom integer,
  p_photo_position_x integer,
  p_photo_position_y integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_photo_zoom < 50 OR p_photo_zoom > 300 THEN
    RAISE EXCEPTION 'Invalid photo zoom';
  END IF;
  IF p_photo_position_x < 0 OR p_photo_position_x > 100 OR p_photo_position_y < 0 OR p_photo_position_y > 100 THEN
    RAISE EXCEPTION 'Invalid photo position';
  END IF;
  UPDATE public.players
  SET photo_url = NULLIF(trim(p_photo_url), ''),
      card_url = NULLIF(trim(p_card_url), ''),
      photo_zoom = p_photo_zoom,
      photo_position_x = p_photo_position_x,
      photo_position_y = p_photo_position_y
  WHERE id = p_player_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_player_photo_crop_drag(uuid, text, text, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_player_photo_crop_drag(uuid, text, text, integer, integer, integer) TO authenticated;
