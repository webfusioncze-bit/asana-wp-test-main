/*
  # Fix Clients Sync Function URL
  
  1. Problem
    - Function sync_clients_from_portal() has placeholder values
    - Uses 'https://your-project-url.supabase.co' instead of actual URL
    - Uses 'your-anon-key' instead of actual service role key
  
  2. Solution
    - Update function with correct hardcoded values
    - Use same values as other sync functions
*/

CREATE OR REPLACE FUNCTION sync_clients_from_portal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  api_url text;
  service_key text;
BEGIN
  -- Use hardcoded values (same as other sync functions)
  api_url := 'https://joklitgwysbflirzlbvv.supabase.co';
  service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impva2xpdGd3eXNiZmxpcnpsYnZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDMwNzUyNywiZXhwIjoyMDc1ODgzNTI3fQ.IpZXsXcX1E2Zx8kcgO22GjVnxFb95aDpZE_9VnAF_yM';
  
  -- Call the edge function
  SELECT net.http_post(
    url := api_url || '/functions/v1/sync-portal-clients',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  ) INTO request_id;
  
  RAISE NOTICE 'Portal clients sync triggered, request_id: %, url: %', request_id, api_url;
END;
$$;
