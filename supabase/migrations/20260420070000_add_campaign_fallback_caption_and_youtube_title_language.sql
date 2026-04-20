-- Campaign fallback captions and YouTube title language preferences
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS fallback_captions_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fallback_captions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS youtube_title_language TEXT NOT NULL DEFAULT 'english';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaigns_youtube_title_language_check'
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_youtube_title_language_check
      CHECK (youtube_title_language IN ('english', 'hinglish', 'hindi'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaigns_fallback_captions_max_three_check'
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_fallback_captions_max_three_check
      CHECK (cardinality(fallback_captions) <= 3);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaigns_fallback_captions_enabled_count_check'
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_fallback_captions_enabled_count_check
      CHECK (
        fallback_captions_enabled = false
        OR cardinality(fallback_captions) BETWEEN 2 AND 3
      );
  END IF;
END $$;
