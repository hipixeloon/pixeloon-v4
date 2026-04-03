-- Add needs_ai_caption column to scheduled_posts for deferred AI generation
ALTER TABLE public.scheduled_posts 
ADD COLUMN IF NOT EXISTS needs_ai_caption boolean DEFAULT false;