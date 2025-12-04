/*
  # Fix Websites Sync Cron Job and Optimize

  1. Configuration
    - Fixes pg_cron job to use correct environment variables
    - Changes schedule to run every 10 minutes instead of 5 for better performance
    - Uses Supabase's built-in vault for secrets instead of app.settings
  
  2. Schedule
    - Runs every 10 minutes
    - Automatically syncs all websites from https://portal.webfusion.cz/webs_feed.xml
  
  3. Performance Improvements
    - Reduced frequency from 5 to 10 minutes to allow full sync to complete
    - Uses proper Supabase environment variables access
  
  4. Notes
    - The edge function handles creating new websites and updating existing ones
    - Status data is automatically stored in website_status table
    - Login tokens (ult) are automatically updated for each website
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
    '*/10 * * * *',
    format(
      'SELECT net.http_post(url := ''%s/functions/v1/sync-portal-websites'', headers := ''{"Content-Type": "application/json", "Authorization": "Bearer %s"}''::jsonb, body := ''{}''::jsonb) AS request_id;',
      supabase_url,
      service_role_key
    )
  );
END $$;
