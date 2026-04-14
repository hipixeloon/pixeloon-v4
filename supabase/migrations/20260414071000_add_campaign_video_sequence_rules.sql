-- Campaign-level sequencing rules for large shared folders / multi-page usage
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS video_order_mode TEXT DEFAULT 'sequential',
  ADD COLUMN IF NOT EXISTS start_video_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sequence_step INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS avoid_same_time_video_collisions BOOLEAN DEFAULT true;

ALTER TABLE public.campaigns
  ALTER COLUMN video_order_mode SET DEFAULT 'sequential',
  ALTER COLUMN start_video_index SET DEFAULT 0,
  ALTER COLUMN sequence_step SET DEFAULT 1,
  ALTER COLUMN avoid_same_time_video_collisions SET DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaigns_video_order_mode_check'
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_video_order_mode_check
      CHECK (video_order_mode IN ('sequential', 'random'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaigns_start_video_index_check'
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_start_video_index_check
      CHECK (start_video_index >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaigns_sequence_step_check'
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_sequence_step_check
      CHECK (sequence_step >= 1);
  END IF;
END $$;
