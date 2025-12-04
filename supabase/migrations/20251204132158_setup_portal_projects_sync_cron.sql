/*
  # Setup Portal Projects Sync Cron Job

  1. Changes
    - Creates a cron job that runs every 15 minutes
    - Calls the sync-portal-projects edge function
    - Manages project creation and removal based on portal JSON API
    
  2. Notes
    - This is independent of the project details sync (which runs every 15 minutes separately)
    - Portal sync creates/removes projects, detail sync updates their data
    - Projects will have import_source_url and sync_enabled set automatically
*/

SELECT cron.schedule(
  'sync-portal-projects-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT current_setting('app.settings.api_url') || '/functions/v1/sync-portal-projects'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT current_setting('app.settings.service_role_key'))
    ),
    body := '{}'::jsonb
  );
  $$
);
