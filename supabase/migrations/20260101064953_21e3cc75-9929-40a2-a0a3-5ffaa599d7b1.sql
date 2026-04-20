-- Create table for campaign-to-page mapping (many-to-many)
CREATE TABLE public.campaign_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  facebook_page_id UUID NOT NULL REFERENCES public.facebook_pages(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, facebook_page_id)
);

-- Create table for scheduled post times
CREATE TABLE public.campaign_post_times (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  post_time TIME NOT NULL,
  randomize BOOLEAN DEFAULT true,
  random_range_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.campaign_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_post_times ENABLE ROW LEVEL SECURITY;

-- RLS policies for campaign_pages (based on campaign ownership)
CREATE POLICY "Users can manage their campaign pages"
ON public.campaign_pages
FOR ALL
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE user_id = auth.uid()
  )
);

-- RLS policies for campaign_post_times (based on campaign ownership)
CREATE POLICY "Users can manage their campaign post times"
ON public.campaign_post_times
FOR ALL
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE user_id = auth.uid()
  )
);

-- Drop the old single facebook_page_id column from campaigns
ALTER TABLE public.campaigns DROP COLUMN IF EXISTS facebook_page_id;