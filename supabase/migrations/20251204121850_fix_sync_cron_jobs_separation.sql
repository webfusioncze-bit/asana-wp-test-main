/*
  # Oprava Cron Jobů - Oddělení XML a JSON synchronizace

  1. Změny
    - Odstraní starý cron job 'sync-portal-websites-feed' (který volal špatnou funkci)
    - Vytvoří 'sync-websites-xml-feed' - volá sync-websites každých 5 minut (XML feed s daty)
    - Ponechá 'sync-portal-websites-every-15min' - volá sync-portal-websites každých 15 minut (JSON API s weby)
    
  2. Dva nezávislé cron joby
    - sync-websites (XML feed): Aktualizuje data o existujících webech - každých 5 minut
    - sync-portal-websites (JSON API): Přidává/odstraňuje weby - každých 15 minut
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-portal-websites-feed') THEN
    PERFORM cron.unschedule('sync-portal-websites-feed');
  END IF;
END $$;

DROP FUNCTION IF EXISTS sync_portal_websites_scheduled();

CREATE OR REPLACE FUNCTION sync_websites_xml_feed_scheduled()
RETURNS void AS $$
DECLARE
  response_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://joklitgwysbflirzlbvv.supabase.co/functions/v1/sync-websites',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impva2xpdGd3eXNiZmxpcnpsYnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMDc1MjcsImV4cCI6MjA3NTg4MzUyN30.52_Opwvcz-gK6VZBqzm-DJFGG3X_-6JzUl78oWovaj0'
    ),
    body := '{}'::jsonb
  ) INTO response_id;
  
  RAISE NOTICE 'XML feed sync triggered, request_id: %', response_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'sync-websites-xml-feed',
  '*/5 * * * *',
  $$SELECT sync_websites_xml_feed_scheduled()$$
);
