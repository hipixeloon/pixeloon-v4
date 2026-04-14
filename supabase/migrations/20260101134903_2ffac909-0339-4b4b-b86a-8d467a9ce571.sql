-- Store long-lived Facebook user tokens for re-syncing pages
CREATE TABLE IF NOT EXISTS public.facebook_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  user_access_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facebook_connections ENABLE ROW LEVEL SECURITY;

-- Users can view their own connection
CREATE POLICY "Users can view their own facebook connection"
ON public.facebook_connections
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own connection
CREATE POLICY "Users can insert their own facebook connection"
ON public.facebook_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own connection
CREATE POLICY "Users can update their own facebook connection"
ON public.facebook_connections
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Optional: users can delete their own connection
CREATE POLICY "Users can delete their own facebook connection"
ON public.facebook_connections
FOR DELETE
USING (auth.uid() = user_id);

-- Keep updated_at current
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_facebook_connections_updated_at'
  ) THEN
    CREATE TRIGGER update_facebook_connections_updated_at
    BEFORE UPDATE ON public.facebook_connections
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_facebook_connections_user_id ON public.facebook_connections(user_id);