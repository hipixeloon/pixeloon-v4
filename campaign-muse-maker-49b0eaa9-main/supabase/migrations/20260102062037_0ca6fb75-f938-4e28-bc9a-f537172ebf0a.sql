-- Add caption length and hashtag count settings to campaigns
ALTER TABLE public.campaigns 
ADD COLUMN caption_length text DEFAULT 'medium',
ADD COLUMN hashtag_count integer DEFAULT 8;

-- Add check constraint for caption_length values
ALTER TABLE public.campaigns
ADD CONSTRAINT valid_caption_length CHECK (caption_length IN ('short', 'medium', 'long'));

-- Add check constraint for hashtag_count (1-20 hashtags)
ALTER TABLE public.campaigns
ADD CONSTRAINT valid_hashtag_count CHECK (hashtag_count >= 1 AND hashtag_count <= 20);

COMMENT ON COLUMN public.campaigns.caption_length IS 'Caption length preference: short (1 sentence), medium (2-3 sentences), long (4+ sentences)';
COMMENT ON COLUMN public.campaigns.hashtag_count IS 'Number of hashtags to generate (1-20)';