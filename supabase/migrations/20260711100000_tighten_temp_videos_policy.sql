-- The original temp-videos policy had no TO clause, which made it apply to
-- PUBLIC — any client could upload/delete objects in the bucket. Only the
-- service role (edge functions) needs to write here; reads stay public via the
-- bucket's public flag so Instagram can fetch the video URL.
DROP POLICY IF EXISTS "Service role can manage temp videos" ON storage.objects;

CREATE POLICY "Service role can manage temp videos"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'temp-videos')
WITH CHECK (bucket_id = 'temp-videos');
