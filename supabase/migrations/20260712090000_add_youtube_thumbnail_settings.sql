-- YouTube thumbnail settings per campaign.
--   mode 'none'  → let YouTube auto-pick a frame (default, current behaviour)
--   mode 'auto'  → generate a thumbnail from the video's own frame for every
--                  video (optionally with a clean title band)
--   mode 'fixed' → use one image (pasted link or uploaded file) for all videos
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS youtube_thumbnail_mode TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS youtube_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_thumbnail_title_overlay BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_youtube_thumbnail_mode_check'
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_youtube_thumbnail_mode_check
      CHECK (youtube_thumbnail_mode IN ('none', 'auto', 'fixed'));
  END IF;
END $$;

-- Public bucket for user-uploaded fixed thumbnails. Public read so YouTube's
-- thumbnails.set can fetch by URL; writes are restricted to the owner via the
-- policies below (path is prefixed with the user's id).
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can read thumbnails" ON storage.objects;
CREATE POLICY "Public can read thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');

DROP POLICY IF EXISTS "Users can upload their own thumbnails" ON storage.objects;
CREATE POLICY "Users can upload their own thumbnails"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'thumbnails'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update their own thumbnails" ON storage.objects;
CREATE POLICY "Users can update their own thumbnails"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'thumbnails'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their own thumbnails" ON storage.objects;
CREATE POLICY "Users can delete their own thumbnails"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'thumbnails'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
