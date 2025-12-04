/*
  # Oprava Websites Sync Cron Job s SQL funkcí

  1. Řešení
    - Vytvoření SQL funkce která volá sync-portal-websites edge funkci
    - Funkce má hardcoded Supabase URL a anon key
    - Cron job volá tuto SQL funkci
  
  2. Schedule
    - Běží každých 5 minut
    - Automaticky synchronizuje všechny weby z XML feedu
  
  3. Poznámky
    - Edge funkce má verify_jwt=false, takže můžeme použít anon key
    - Funkce je SECURITY DEFINER pro správná oprávnění
*/

CREATE OR REPLACE FUNCTION sync_portal_websites_scheduled()
RETURNS void AS $$
DECLARE
  response_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://joklitgwysbflirzlbvv.supabase.co/functions/v1/sync-portal-websites',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impva2xpdGd3eXNiZmxpcnpsYnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMDc1MjcsImV4cCI6MjA3NTg4MzUyN30.52_Opwvcz-gK6VZBqzm-DJFGG3X_-6JzUl78oWovaj0'
    ),
    body := '{}'::jsonb
  ) INTO response_id;
  
  RAISE NOTICE 'Portal websites sync triggered, request_id: %', response_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'sync-portal-websites-feed',
  '*/5 * * * *',
  $$SELECT sync_portal_websites_scheduled()$$
);
