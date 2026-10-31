/*
# Add drag-based player photo crop coordinates

1. Modified Tables
- `players`: adds `photo_position_x` and `photo_position_y`, each storing a 0-100 percentage for the image focus point.
- Existing crop settings remain untouched so no current data is removed or rewritten.

2. Security
- Adds an admin-only SECURITY DEFINER function for saving player photo URLs, zoom, and drag coordinates together.
- Validates both coordinates and the zoom range on the database side.
- Revokes anonymous/public execution and grants execution only to authenticated users.

3. Important Notes
- New players default to the center of the image at 100% zoom.
- The application uses the new coordinates first and keeps the previous crop settings as a fallback for existing records.
*/

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS photo_position_x integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS photo_position_y integer NOT NULL DEFAULT 50;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'players_photo_position_x_check'
      AND conrelid = 'public.players'::regclass
  ) THEN
    ALTER TABLE public.players ADD CONSTRAINT players_photo_position_x_check CHECK (photo_position_x >= 0 AND photo_position_x <= 100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'players_photo_position_y_check'
      AND conrelid = 'public.players'::regclass
  ) THEN
    ALTER TABLE public.players ADD CONSTRAINT players_photo_position_y_check CHECK (photo_position_y >= 0 AND photo_position_y <= 100);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_player_photo_crop_drag(
  p_player_id uuid,
  p_photo_url text,
  p_card_url text,
  p_photo_zoom integer,
  p_photo_position_x integer,
  p_photo_position_y integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_photo_zoom < 50 OR p_photo_zoom > 200 THEN
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