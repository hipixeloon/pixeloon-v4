-- Drop the existing constraint and add a new one that allows 0
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS valid_hashtag_count;
ALTER TABLE public.campaigns ADD CONSTRAINT valid_hashtag_count CHECK (hashtag_count >= 0 AND hashtag_count <= 20);