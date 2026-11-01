/*
# Increase media file size limits and add background video volume control

1. Modified Tables
- `site_settings`: adds `background_video_volume` integer (0-100, default 50) to control the background video audio volume.

2. Storage Buckets
- `site-media`: file size limit increased from 50MB to 200MB to allow longer background videos.
- `player-photos`: file size limit increased from 10MB to 20MB for higher quality images.
- `highlights`: file size limit set to 200MB for MP4 highlight videos.

3. Security
- The new column uses the existing admin-only UPDATE policy on site_settings.
- No new policies or grants are needed; background_video_volume is covered by the existing column-restricted UPDATE grant.

4. Data Safety
- No rows or columns deleted.
- Existing settings retain defaults; the new volume defaults to 50%.
*/

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS background_video_volume integer NOT NULL DEFAULT 50;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'site_settings_background_video_volume_check'
      AND conrelid = 'public.site_settings'::regclass
  ) THEN
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_background_video_volume_check
      CHECK (background_video_volume >= 0 AND background_video_volume <= 100);
  END IF;
END $$;

GRANT UPDATE (background_video_url, background_video_volume) ON public.site_settings TO authenticated;

UPDATE storage.buckets
SET file_size_limit = 209715200
WHERE id = 'site-media';

UPDATE storage.buckets
SET file_size_limit = 209715200
WHERE id = 'highlights';

UPDATE storage.buckets
SET file_size_limit = 20971520
WHERE id = 'player-photos';
