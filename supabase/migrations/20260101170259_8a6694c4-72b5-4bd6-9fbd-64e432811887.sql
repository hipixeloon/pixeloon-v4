-- Add permalink_url column to scheduled_posts for storing the exact Facebook reel/video URL
ALTER TABLE public.scheduled_posts 
ADD COLUMN permalink_url text;