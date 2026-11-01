/*
# Increase player photo zoom limit

1. Modified Table
- `players`: updates the existing `players_photo_zoom_check` constraint so `photo_zoom` accepts the full editor range from 50 through 300.

2. Security and Data Safety
- No rows, photos, URLs, or player records are changed.
- The existing validation remains active; values below 50 or above 300 are still rejected.

3. Important Notes
- This aligns the database constraint with the editor slider and the crop-saving function.
- Existing values remain valid and untouched.
*/

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_photo_zoom_check;

ALTER TABLE public.players
  ADD CONSTRAINT players_photo_zoom_check
  CHECK (photo_zoom >= 50 AND photo_zoom <= 300);
