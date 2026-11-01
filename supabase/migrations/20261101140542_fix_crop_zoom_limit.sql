/*
# Fix crop zoom limit to match frontend

The `update_player_photo_crop_drag` RPC rejected zoom values above 200,
but the frontend slider allows up to 300. This caused "Could not save"
errors when a user zoomed past 200%. This migration updates the validation
to accept zoom 50–300, matching the frontend.
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
