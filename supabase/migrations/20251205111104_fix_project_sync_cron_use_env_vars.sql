/*
  # Fix Project Sync CRON to Use Environment Variables

  1. Problem
    - SQL function uses non-existent app.settings configuration
    - Edge function is not being called because URL and auth key are missing
    
  2. Solution
    - Use Supabase's built-in environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    - Fall back to vault.decrypted_secrets if env vars not available
    - Use same pattern as working sync-portal-websites-feed job
    
  3. Configuration
    - Batch size: 5 projects per run
    - Delay: 2000ms between projects
    - Runs every 5 minutes
*/

-- Drop old function
DROP FUNCTION IF EXISTS call_sync_projects_edge_function() CASCADE;

-- Unschedule old job
DO $$
BEGIN
  PERFORM cron.unschedule('sync-projects-batch-job');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Create new cron job with proper environment variable access
DO $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Try to get from environment variables first
  supabase_url := current_setting('SUPABASE_URL', true);
  service_role_key := current_setting('SUPABASE_SERVICE_ROLE_KEY', true);
  
  -- Fall back to vault if not available
  IF supabase_url IS NULL THEN
    supabase_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1);
  END IF;
  
  IF service_role_key IS NULL THEN
    service_role_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1);
  END IF;

  -- Schedule the job with formatted command
  PERFORM cron.schedule(
    'sync-projects-batch-job',
    '*/5 * * * *',
    format(
      'SELECT net.http_post(url := ''%s/functions/v1/sync-projects?batch_size=5&delay_ms=2000'', headers := ''{"Content-Type": "application/json", "Authorization": "Bearer %s"}''::jsonb, body := ''{}''::jsonb) AS request_id;',
      supabase_url,
      service_role_key
    )
  );
END $$;
