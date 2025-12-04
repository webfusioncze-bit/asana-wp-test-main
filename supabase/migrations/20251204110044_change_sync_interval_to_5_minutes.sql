/*
  # Change Websites Sync Interval to 5 Minutes

  1. Configuration
    - Changes sync schedule from every 10 minutes to every 5 minutes
    - Keeps the proper environment variables setup
  
  2. Schedule
    - Runs every 5 minutes as requested
    - Automatically syncs all websites from https://portal.webfusion.cz/webs_feed.xml
  
  3. Notes
    - No HEAD requests are performed during sync for faster processing
    - Only fetches and stores data from the XML feed
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-portal-websites-feed') THEN
    PERFORM cron.unschedule('sync-portal-websites-feed');
  END IF;
END $$;

DO $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  supabase_url := current_setting('SUPABASE_URL', true);
  service_role_key := current_setting('SUPABASE_SERVICE_ROLE_KEY', true);
  
  IF supabase_url IS NULL THEN
    supabase_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1);
  END IF;
  
  IF service_role_key IS NULL THEN
    service_role_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1);
  END IF;

  PERFORM cron.schedule(
    'sync-portal-websites-feed',
    '*/5 * * * *',
    format(
      'SELECT net.http_post(url := ''%s/functions/v1/sync-portal-websites'', headers := ''{"Content-Type": "application/json", "Authorization": "Bearer %s"}''::jsonb, body := ''{}''::jsonb) AS request_id;',
      supabase_url,
      service_role_key
    )
  );
END $$;
