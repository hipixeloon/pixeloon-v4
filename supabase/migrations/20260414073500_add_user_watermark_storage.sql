ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS watermark_image_path TEXT;
