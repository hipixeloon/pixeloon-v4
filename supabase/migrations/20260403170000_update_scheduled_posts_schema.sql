-- Add account/channel references to scheduled_posts
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS instagram_account_id UUID REFERENCES public.instagram_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS youtube_channel_id UUID REFERENCES public.youtube_channels(id) ON DELETE SET NULL;

-- Ensure facebook_page_id is nullable (it might already be if earlier migration ran)
ALTER TABLE public.scheduled_posts ALTER COLUMN facebook_page_id DROP NOT NULL;
