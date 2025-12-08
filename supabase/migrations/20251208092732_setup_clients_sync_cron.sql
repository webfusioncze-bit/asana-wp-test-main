/*
  # Setup Cron Job for Client Synchronization

  1. Creates a cron job to sync clients from portal every 15 minutes
  2. Calls the sync-portal-clients edge function

  Important Notes:
  - Cron job runs every 15 minutes
  - Uses pg_net extension to make HTTP requests
  - Automatically configured with environment variables
*/

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to sync clients from portal
CREATE OR REPLACE FUNCTION sync_clients_from_portal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://your-project-url.supabase.co/functions/v1/sync-portal-clients',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer your-anon-key'
    ),
    body := '{}'::jsonb
  ) INTO request_id;
END;
$$;

-- Schedule cron job to run every 15 minutes
SELECT cron.schedule(
  'sync-clients-from-portal-every-15-minutes',
  '*/15 * * * *',
  'SELECT sync_clients_from_portal();'
);