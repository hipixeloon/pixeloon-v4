-- Add post_type column to track whether posted as Reel or Video
ALTER TABLE public.scheduled_posts 
ADD COLUMN IF NOT EXISTS post_type text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.scheduled_posts.post_type IS 'Type of post: reel (vertical short), video (horizontal/long), or null if not yet posted';