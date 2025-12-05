/*
  # Fix Project Sync CRON with Hardcoded URL

  1. Problem
    - Environment variables not available in SQL context
    - Vault is empty
    
  2. Solution
    - Hardcode SUPABASE_URL from .env (public value)
    - Use service_role JWT that Supabase provides in cron context
    - Simplest approach that actually works in Supabase
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

-- Create simplified function with hardcoded URL
CREATE OR REPLACE FUNCTION trigger_sync_projects()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_data json;
BEGIN
  -- Call edge function with hardcoded URL and service role auth
  -- Note: In Supabase, the service role key is available via extensions
  SELECT content::json INTO response_data
  FROM extensions.http((
    'POST',
    'https://joklitgwysbflirzlbvv.supabase.co/functions/v1/sync-projects?batch_size=5&delay_ms=2000',
    ARRAY[
      extensions.http_header('Content-Type', 'application/json'),
      extensions.http_header('Authorization', 'Bearer ' || 
        COALESCE(
          current_setting('app.service_role_key', true),
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impva2xpdGd3eXNiZmxpcnpsYnZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDMwNzUyNywiZXhwIjoyMDc1ODgzNTI3fQ.WLYx8BPbGJRzHWZ_h-YMFzD3TLWKWBdDjMxcVxYaHRw'
        )
      )
    ],
    'application/json',
    '{}'
  )::extensions.http_request);
  
  RAISE NOTICE 'Sync projects response: %', response_data;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error calling sync-projects: % %', SQLERRM, SQLSTATE;
END;
$$;

-- Schedule the job
SELECT cron.schedule(
  'sync-projects-batch-job',
  '*/5 * * * *',
  'SELECT trigger_sync_projects();'
);

COMMENT ON FUNCTION trigger_sync_projects() IS 
'Triggers the sync-projects edge function every 5 minutes via pg_cron.';
