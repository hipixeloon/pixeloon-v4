-- Create table for scheduled posts
CREATE TABLE public.scheduled_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  facebook_page_id UUID NOT NULL REFERENCES public.facebook_pages(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_post_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  facebook_post_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

-- RLS policy for scheduled_posts (based on campaign ownership)
CREATE POLICY "Users can manage their scheduled posts"
ON public.scheduled_posts
FOR ALL
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_scheduled_posts_updated_at
BEFORE UPDATE ON public.scheduled_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient querying of pending posts
CREATE INDEX idx_scheduled_posts_pending 
ON public.scheduled_posts (scheduled_time, status) 
WHERE status = 'pending';