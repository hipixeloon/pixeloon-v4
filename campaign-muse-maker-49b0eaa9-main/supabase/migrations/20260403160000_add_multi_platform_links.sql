-- Create table for campaign-to-instagram mapping (many-to-many)
CREATE TABLE IF NOT EXISTS public.campaign_instagram_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  instagram_account_id UUID NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, instagram_account_id)
);

-- Create table for campaign-to-youtube mapping (many-to-many)
CREATE TABLE IF NOT EXISTS public.campaign_youtube_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  youtube_channel_id UUID NOT NULL REFERENCES public.youtube_channels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, youtube_channel_id)
);

-- Enable Row Level Security
ALTER TABLE public.campaign_instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_youtube_channels ENABLE ROW LEVEL SECURITY;

-- RLS policies (based on campaign ownership)
DO $$ BEGIN
    CREATE POLICY "Users can manage their campaign instagram accounts"
    ON public.campaign_instagram_accounts FOR ALL
    USING (campaign_id IN (SELECT id FROM public.campaigns WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can manage their campaign youtube channels"
    ON public.campaign_youtube_channels FOR ALL
    USING (campaign_id IN (SELECT id FROM public.campaigns WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
