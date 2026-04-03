-- Create temp bucket for video uploads (will be deleted after posting)
INSERT INTO storage.buckets (id, name, public)
VALUES ('temp-videos', 'temp-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow service role to manage temp videos
CREATE POLICY "Service role can manage temp videos"
ON storage.objects FOR ALL
USING (bucket_id = 'temp-videos')
WITH CHECK (bucket_id = 'temp-videos');