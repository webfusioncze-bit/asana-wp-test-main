/*
  # Fix Portal Websites Sync Cron Job
  
  1. Problem
    - Cron job 'sync-portal-websites-every-15min' fails with error:
      "unrecognized configuration parameter 'app.settings.api_url'"
    - The cron job tries to use non-existent settings
    - Last successful sync was 2026-01-14
  
  2. Solution
    - Remove the old cron job
    - Create a SQL function similar to sync_websites_xml_feed_scheduled
    - Use hardcoded Supabase URL and service role key
    - Recreate the cron job to call the new function
  
  3. Schedule
    - Runs every 15 minutes
    - Adds/removes websites from portal JSON API
  
  4. Notes
    - This is independent of XML feed sync (which runs every 5 minutes)
    - Portal sync creates/removes websites, XML sync updates their data
*/

-- Remove old cron job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-portal-websites-every-15min') THEN
    PERFORM cron.unschedule('sync-portal-websites-every-15min');
  END IF;
END $$;

-- Create new function for portal websites sync
CREATE OR REPLACE FUNCTION sync_portal_websites_scheduled()
RETURNS void AS $$
DECLARE
  response_id bigint;
  api_url text;
  service_key text;
BEGIN
  -- Use hardcoded values (same as sync_websites_xml_feed_scheduled)
  api_url := 'https://joklitgwysbflirzlbvv.supabase.co';
  service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impva2xpdGd3eXNiZmxpcnpsYnZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDMwNzUyNywiZXhwIjoyMDc1ODgzNTI3fQ.IpZXsXcX1E2Zx8kcgO22GjVnxFb95aDpZE_9VnAF_yM';
  
  -- Call the edge function
  SELECT net.http_post(
    url := api_url || '/functions/v1/sync-portal-websites',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  ) INTO response_id;
  
  RAISE NOTICE 'Portal websites sync triggered, request_id: %, url: %', response_id, api_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new cron job
SELECT cron.schedule(
  'sync-portal-websites-every-15min',
  '*/15 * * * *',
  $$SELECT sync_portal_websites_scheduled()$$
);
