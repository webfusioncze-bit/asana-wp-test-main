/*
  # Fix Project Sync CRON using net.http_post

  1. Problem
    - Previous attempts to get environment variables failed
    - Need to use hardcoded values for Supabase URL and service role key
    
  2. Solution
    - Use net.http_post which is available and working
    - Hardcode URL and service role key directly in function
    - This is the same approach that works for other sync jobs
*/

-- Drop old function and job
DROP FUNCTION IF EXISTS trigger_sync_projects() CASCADE;

DO $$
BEGIN
  PERFORM cron.unschedule('sync-projects-batch-job');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Create function using net.http_post
CREATE OR REPLACE FUNCTION trigger_sync_projects()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Call edge function using net.http_post
  SELECT net.http_post(
    url := 'https://joklitgwysbflirzlbvv.supabase.co/functions/v1/sync-projects?batch_size=5&delay_ms=2000',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impva2xpdGd3eXNiZmxpcnpsYnZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDMwNzUyNywiZXhwIjoyMDc1ODgzNTI3fQ.WLYx8BPbGJRzHWZ_h-YMFzD3TLWKWBdDjMxcVxYaHRw'
    )
  ) INTO request_id;
  
  RAISE NOTICE 'Sync projects request ID: %', request_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error calling sync-projects: %', SQLERRM;
END;
$$;

-- Schedule the job
SELECT cron.schedule(
  'sync-projects-batch-job',
  '*/5 * * * *',
  'SELECT trigger_sync_projects();'
);

COMMENT ON FUNCTION trigger_sync_projects() IS 
'Triggers the sync-projects edge function every 5 minutes. Processes 5 projects per run with 2s delays.';
