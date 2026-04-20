-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create cron job to run auto-poster every minute
SELECT cron.schedule(
  'auto-poster-cron',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://jtsopnmudnvyqvlaptof.supabase.co/functions/v1/auto-poster',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0c29wbm11ZG52eXF2bGFwdG9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNTUzNTEsImV4cCI6MjA4MjczMTM1MX0.8XkY9DLpEItXo937sTH4dhm71gxNnBqsY0zjjrj0foQ"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);