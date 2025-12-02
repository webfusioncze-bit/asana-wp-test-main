/*
  # Setup Websites Feed Sync Cron Job

  1. Configuration
    - Sets up pg_cron extension to run website sync every 5 minutes
    - Uses the sync-portal-websites edge function to fetch and update all website data from the central XML feed
  
  2. Schedule
    - Runs every 5 minutes (cron expression: star slash 5 star star star star)
    - Automatically syncs all websites from https://portal.webfusion.cz/webs_feed.xml
  
  3. Notes
    - The edge function handles creating new websites and updating existing ones
    - Status data is automatically stored in website_status table
    - Login tokens (ult) are automatically updated for each website
*/

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing cron job if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('sync-portal-websites-feed')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'sync-portal-websites-feed'
  );
END $$;

-- Schedule the sync-portal-websites edge function to run every 5 minutes
SELECT cron.schedule(
  'sync-portal-websites-feed',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := (SELECT current_setting('app.settings.supabase_url') || '/functions/v1/sync-portal-websites'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT current_setting('app.settings.supabase_service_role_key'))
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
