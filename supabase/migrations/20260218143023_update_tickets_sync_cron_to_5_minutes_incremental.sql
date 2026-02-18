/*
  # Update support tickets sync cron to 5-minute incremental

  1. Changes
    - Updates the `sync_support_tickets_scheduled` function to pass `mode: incremental`
      so it only syncs non-resolved tickets (skips "Vyreseno")
    - Drops the old 15-minute cron job
    - Creates a new 5-minute cron job for incremental sync

  2. Important Notes
    - Incremental mode skips tickets with status "Vyreseno"
    - Full sync (all tickets) can still be triggered manually from the admin UI
*/

CREATE OR REPLACE FUNCTION sync_support_tickets_scheduled()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_id bigint;
  api_url text;
  service_key text;
BEGIN
  api_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  IF api_url IS NULL OR api_url = '' THEN
    api_url := 'https://joklitgwysbflirzlbvv.supabase.co';
  END IF;

  IF service_key IS NULL OR service_key = '' THEN
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  END IF;

  SELECT net.http_post(
    url := api_url || '/functions/v1/sync-support-tickets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{"mode": "incremental"}'::jsonb
  ) INTO response_id;

  RAISE NOTICE 'Support tickets incremental sync triggered, request_id: %', response_id;
END;
$$;

SELECT cron.unschedule('sync-support-tickets-every-15min');

SELECT cron.schedule(
  'sync-support-tickets-every-5min',
  '*/5 * * * *',
  'SELECT sync_support_tickets_scheduled()'
);
