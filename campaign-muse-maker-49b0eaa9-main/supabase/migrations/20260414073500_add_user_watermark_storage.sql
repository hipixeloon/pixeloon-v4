ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS watermark_image_path TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-watermarks', 'user-watermarks', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload their own watermark images'
  ) THEN
    CREATE POLICY "Users can upload their own watermark images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'user-watermarks'
      AND split_part(name, '/', 1) = auth.uid()::text
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update their own watermark images'
  ) THEN
    CREATE POLICY "Users can update their own watermark images"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'user-watermarks'
      AND split_part(name, '/', 1) = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'user-watermarks'
      AND split_part(name, '/', 1) = auth.uid()::text
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete their own watermark images'
  ) THEN
    CREATE POLICY "Users can delete their own watermark images"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'user-watermarks'
      AND split_part(name, '/', 1) = auth.uid()::text
    );
  END IF;
END $$;
