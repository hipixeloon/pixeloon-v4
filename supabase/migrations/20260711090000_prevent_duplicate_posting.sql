-- Prevent duplicate posting: claim tracking, stale-post recovery, and
-- uniqueness guarantees for pending scheduled posts.

-- Track when a worker actually started processing a post so stuck posts
-- can be detected and recovered without re-posting.
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

-- Lease used to prevent two concurrent schedule generations for the same
-- campaign from inserting the same videos twice.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS schedule_generating_at TIMESTAMPTZ;

-- Speed up the every-minute cron query.
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status_time
  ON public.scheduled_posts (status, scheduled_time);

-- Remove existing duplicate PENDING posts (same campaign + video + target),
-- keeping the earliest-created row. Posted history is left untouched.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY campaign_id,
                        video_url,
                        COALESCE(facebook_page_id::text, ''),
                        COALESCE(instagram_account_id::text, ''),
                        COALESCE(youtube_channel_id::text, '')
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.scheduled_posts
  WHERE status = 'pending'
)
DELETE FROM public.scheduled_posts
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- A given video can only be queued once per campaign per target while pending.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_post_per_fb_target
  ON public.scheduled_posts (campaign_id, video_url, facebook_page_id)
  WHERE status = 'pending' AND facebook_page_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_post_per_ig_target
  ON public.scheduled_posts (campaign_id, video_url, instagram_account_id)
  WHERE status = 'pending' AND instagram_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_post_per_yt_target
  ON public.scheduled_posts (campaign_id, video_url, youtube_channel_id)
  WHERE status = 'pending' AND youtube_channel_id IS NOT NULL;
