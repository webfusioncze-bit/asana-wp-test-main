/*
  # Fix Project Sync CRON to Call Edge Function with Batching

  1. Problem
    - Current CRON job doesn't actually call the sync-projects edge function
    - Edge function processes all projects at once without delays
    - This causes timeouts and incomplete synchronization

  2. Solution
    - Update CRON job to call sync-projects edge function via HTTP
    - Edge function now processes projects in batches (5 at a time)
    - Adds 2 second delay between projects to prevent API overload
    - Includes timeout protection (50 seconds max)
    - Orders by last_sync_at to prioritize least recently synced projects

  3. Configuration
    - Default batch size: 5 projects per run
    - Default delay: 2000ms between projects
    - CRON runs every 5 minutes
    - Each run processes the oldest synced projects first
*/

-- Drop old function and trigger
DROP FUNCTION IF EXISTS sync_projects_scheduled() CASCADE;

-- Create SQL function to call edge function via HTTP
CREATE OR REPLACE FUNCTION call_sync_projects_edge_function()
RETURNS void AS $$
DECLARE
  response_data json;
BEGIN
  SELECT content::json INTO response_data
  FROM net.http_post(
    url := (SELECT current_setting('app.settings.api_url') || '/functions/v1/sync-projects?batch_size=5&delay_ms=2000'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT current_setting('app.settings.service_role_key'))
    ),
    body := '{}'::jsonb
  );
  
  RAISE NOTICE 'Project sync response: %', response_data;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to call sync-projects edge function: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove old CRON job if exists
DO $$
BEGIN
  PERFORM cron.unschedule('sync-projects-job');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Schedule new CRON job every 5 minutes
SELECT cron.schedule(
  'sync-projects-batch-job',
  '*/5 * * * *',
  $$SELECT call_sync_projects_edge_function()$$
);

COMMENT ON FUNCTION call_sync_projects_edge_function() IS 
'Calls the sync-projects edge function which processes projects in batches of 5 with 2-second delays between each project.';
