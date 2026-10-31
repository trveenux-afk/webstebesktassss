/*
# Add per-player photo crop controls and admin highlight editing

1. Modified Tables
- `players`: adds `photo_object_position` for the focal point used in the squad card image.
- `players`: adds `photo_zoom` for the per-player photo zoom percentage.
- Both values are constrained to the supported UI ranges and default to a centered, 100% image.

2. Security
- Adds a SECURITY DEFINER function that lets admins update a player's photo URLs and crop settings together.
- The function derives authorization from the signed-in caller and validates position and zoom values.
- Grants the function only to authenticated users and revokes public/anonymous execution.
- Adds an authenticated UPDATE policy for highlights so admins can edit any highlight while regular users can edit only their own.
- Keeps public read access and existing owner/admin delete behavior for highlights.

3. Important Notes
- Existing player photos keep their current appearance through centered 100% defaults.
- No existing player, highlight, or profile rows are deleted.
*/

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS photo_object_position text NOT NULL DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS photo_zoom integer NOT NULL DEFAULT 100;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'players_photo_object_position_check'
      AND conrelid = 'public.players'::regclass
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_photo_object_position_check
      CHECK (photo_object_position IN ('center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'players_photo_zoom_check'
      AND conrelid = 'public.players'::regclass
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_photo_zoom_check CHECK (photo_zoom >= 50 AND photo_zoom <= 200);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_player_photo_crop(
  p_player_id uuid,
  p_photo_url text,
  p_card_url text,
  p_photo_object_position text,
  p_photo_zoom integer
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
  IF p_photo_object_position NOT IN ('center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right') THEN
    RAISE EXCEPTION 'Invalid photo position';
  END IF;
  IF p_photo_zoom < 50 OR p_photo_zoom > 200 THEN
    RAISE EXCEPTION 'Invalid photo zoom';
  END IF;
  UPDATE public.players
  SET photo_url = NULLIF(trim(p_photo_url), ''),
      card_url = NULLIF(trim(p_card_url), ''),
      photo_object_position = p_photo_object_position,
      photo_zoom = p_photo_zoom
  WHERE id = p_player_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_player_photo_crop(uuid, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_player_photo_crop(uuid, text, text, text, integer) TO authenticated;

DROP POLICY IF EXISTS "users_update_highlights" ON public.highlights;
CREATE POLICY "users_update_highlights" ON public.highlights
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());