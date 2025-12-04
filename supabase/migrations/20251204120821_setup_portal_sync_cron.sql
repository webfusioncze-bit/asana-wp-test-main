/*
  # Setup Portal Websites Sync Cron Job

  1. Changes
    - Creates a cron job that runs every 15 minutes
    - Calls the sync-portal-websites edge function
    - Manages website creation and removal based on portal JSON API
    
  2. Notes
    - This is independent of the XML feed sync (which runs every 5 minutes)
    - Portal sync creates/removes websites, XML sync updates their data
*/

SELECT cron.schedule(
  'sync-portal-websites-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT current_setting('app.settings.api_url') || '/functions/v1/sync-portal-websites'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT current_setting('app.settings.service_role_key'))
    ),
    body := '{}'::jsonb
  );
  $$
);
