/*
  # Speed Up Project Synchronization

  1. Problem
    - Current: 5 projects every 5 minutes = ~100 minutes for 96 projects
    - Too slow for production use
    
  2. Solution
    - Increase batch size from 5 to 15 projects
    - Reduce interval from 5 minutes to 2 minutes
    - Reduce delay from 2000ms to 1000ms
    
  3. New Performance
    - 96 projects / 15 = 7 runs × 2 minutes = ~14 minutes for full sync
    - Each project synced ~every 15 minutes instead of ~100 minutes
*/

-- Drop old job
DO $$
BEGIN
  PERFORM cron.unschedule('sync-projects-batch-job');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Drop old function
DROP FUNCTION IF EXISTS trigger_sync_projects() CASCADE;

-- Create optimized function with larger batch size and shorter delays
CREATE OR REPLACE FUNCTION trigger_sync_projects()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Call edge function with optimized parameters:
  -- - batch_size: 15 (up from 5)
  -- - delay_ms: 1000 (down from 2000)
  SELECT net.http_post(
    url := 'https://joklitgwysbflirzlbvv.supabase.co/functions/v1/sync-projects?batch_size=15&delay_ms=1000',
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

-- Schedule the job to run every 2 minutes (was 5)
SELECT cron.schedule(
  'sync-projects-batch-job',
  '*/2 * * * *',  -- Every 2 minutes
  'SELECT trigger_sync_projects();'
);

COMMENT ON FUNCTION trigger_sync_projects() IS 
'Triggers sync-projects edge function every 2 minutes. Processes 15 projects per run with 1s delays. Full sync of ~96 projects completes in ~14 minutes.';
