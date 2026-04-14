-- Create tables for Instagram and YouTube accounts to sit alongside facebook_pages
CREATE TABLE IF NOT EXISTS public.instagram_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  instagram_account_id TEXT NOT NULL,
  instagram_username TEXT NOT NULL,
  profile_picture_url TEXT,
  facebook_page_id UUID REFERENCES public.facebook_pages(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.youtube_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  channel_thumbnail TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_channels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can manage their own instagram accounts" 
    ON public.instagram_accounts FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can manage their own youtube channels" 
    ON public.youtube_channels FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add AI & Multi-platform features to campaigns
ALTER TABLE public.campaigns 
  ADD COLUMN IF NOT EXISTS targeting_country TEXT,
  ADD COLUMN IF NOT EXISTS targeting_tone TEXT,
  ADD COLUMN IF NOT EXISTS branding_lines JSONB,
  ADD COLUMN IF NOT EXISTS affiliate_links JSONB,
  ADD COLUMN IF NOT EXISTS watermark_settings JSONB,
  ADD COLUMN IF NOT EXISTS ab_test_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS platforms JSONB DEFAULT '{"facebook": true, "instagram": false, "youtube": false}';
  
-- Add tracking and features to scheduled_posts
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS facebook_post_id TEXT,
  ADD COLUMN IF NOT EXISTS instagram_media_id TEXT,
  ADD COLUMN IF NOT EXISTS youtube_video_id TEXT,
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ab_variant TEXT DEFAULT 'A';
  
-- Add global configurations to app_settings
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_settings' and column_name='default_ai_model') THEN
    ALTER TABLE public.app_settings ADD COLUMN default_ai_model TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_settings' and column_name='default_branding_lines') THEN
    ALTER TABLE public.app_settings ADD COLUMN default_branding_lines JSONB;
  END IF;
END $$;

-- Triggers for updated_at (wrap in exception catch so it doesn't fail if already exists)
DO $$ BEGIN
    CREATE TRIGGER update_instagram_accounts_updated_at
    BEFORE UPDATE ON public.instagram_accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_youtube_channels_updated_at
    BEFORE UPDATE ON public.youtube_channels
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;
