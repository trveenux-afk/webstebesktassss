/*
# Fix authenticated highlight creation

1. Modified Tables
- `highlights.user_id` now defaults to `auth.uid()` so the signed-in user is
  always recorded even when the browser omits the ownership field.

2. Security
- Authenticated users may insert only the public content fields.
- The database supplies and protects the author identity.
- Existing public reading and owner/admin deletion rules remain unchanged.
*/

ALTER TABLE public.highlights
  ALTER COLUMN user_id SET DEFAULT auth.uid();

REVOKE INSERT ON public.highlights FROM authenticated;
GRANT INSERT (video_url, title, caption) ON public.highlights TO authenticated;
