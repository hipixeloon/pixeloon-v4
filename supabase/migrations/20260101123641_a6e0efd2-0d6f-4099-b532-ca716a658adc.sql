-- Create functions to get cron health data (accessible via RPC)

-- Function to get recent cron executions
CREATE OR REPLACE FUNCTION public.get_cron_executions()
RETURNS TABLE (
  id bigint,
  status_code integer,
  created timestamptz,
  timed_out boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, status_code, created, timed_out
  FROM net._http_response
  ORDER BY created DESC
  LIMIT 20;
$$;

-- Function to get cron job status
CREATE OR REPLACE FUNCTION public.get_cron_job_status()
RETURNS TABLE (
  jobname text,
  schedule text,
  active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jobname::text, schedule::text, active
  FROM cron.job
  WHERE jobname = 'auto-poster-cron'
  LIMIT 1;
$$;