-- Add youtube_upload_type to campaigns
-- Values: 'auto' (detect from video duration), 'shorts' (force YouTube Shorts), 'long_form' (force Long Video)
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS youtube_upload_type TEXT DEFAULT 'auto';

-- Add logo_opacity to campaigns for Cloudinary watermark
-- Stores 0-100 integer (percentage). 80 = 80% opacity.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS logo_opacity INTEGER DEFAULT 80;
