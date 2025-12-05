/*
  # Fix Project Sync CRON with Dynamic Environment Variables

  1. Problem
    - Environment variables were empty during cron job creation
    - URL and auth key need to be loaded dynamically at runtime
    
  2. Solution
    - Create SQL function that loads env vars dynamically
    - Function is called by cron job each time it runs
    - Uses same pattern as other working sync jobs
*/

-- Drop old job
DO $$
BEGIN
  PERFORM cron.unschedule('sync-projects-batch-job');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Create function that dynamically loads environment variables and calls edge function
CREATE OR REPLACE FUNCTION trigger_sync_projects()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  response_status int;
BEGIN
  -- Get environment variables (available at runtime in Supabase)
  supabase_url := current_setting('request.env.SUPABASE_URL', true);
  service_role_key := current_setting('request.env.SUPABASE_SERVICE_ROLE_KEY', true);
  
  -- Fallback to checking for common env var names
  IF supabase_url IS NULL THEN
    BEGIN
      supabase_url := current_setting('SUPABASE_URL', false);
    EXCEPTION WHEN OTHERS THEN
      -- Try vault as last resort
      SELECT decrypted_secret INTO supabase_url 
      FROM vault.decrypted_secrets 
      WHERE name = 'SUPABASE_URL' 
      LIMIT 1;
    END;
  END IF;
  
  IF service_role_key IS NULL THEN
    BEGIN
      service_role_key := current_setting('SUPABASE_SERVICE_ROLE_KEY', false);
    EXCEPTION WHEN OTHERS THEN
      -- Try vault as last resort
      SELECT decrypted_secret INTO service_role_key 
      FROM vault.decrypted_secrets 
      WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' 
      LIMIT 1;
    END;
  END IF;
  
  -- If still null, try getting from env
  IF supabase_url IS NULL THEN
    supabase_url := getenv('SUPABASE_URL');
  END IF;
  
  IF service_role_key IS NULL THEN
    service_role_key := getenv('SUPABASE_SERVICE_ROLE_KEY');
  END IF;

  -- Log what we're using (for debugging)
  RAISE NOTICE 'Calling sync-projects with URL: %', COALESCE(supabase_url, 'NULL');
  
  -- Call the edge function
  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/sync-projects?batch_size=5&delay_ms=2000',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := '{}'::jsonb
    );
    RAISE NOTICE 'Successfully triggered sync-projects edge function';
  ELSE
    RAISE WARNING 'Could not call sync-projects: missing environment variables (URL: %, KEY: %)', 
      COALESCE(supabase_url, 'NULL'),
      CASE WHEN service_role_key IS NULL THEN 'NULL' ELSE 'SET' END;
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in trigger_sync_projects: %', SQLERRM;
END;
$$;

-- Schedule the job to call our function
SELECT cron.schedule(
  'sync-projects-batch-job',
  '*/5 * * * *',
  'SELECT trigger_sync_projects();'
);

COMMENT ON FUNCTION trigger_sync_projects() IS 
'Triggers the sync-projects edge function. Called by cron every 5 minutes. Dynamically loads Supabase URL and service role key at runtime.';
