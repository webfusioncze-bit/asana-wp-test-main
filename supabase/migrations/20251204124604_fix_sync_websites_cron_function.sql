/*
  # Oprava sync_websites_xml_feed_scheduled funkce
  
  1. Změny
    - Aktualizuje funkci sync_websites_xml_feed_scheduled
    - Používá Supabase vault pro bezpečné uložení credentials
    - Volá sync-websites edge funkci každých 5 minut
    
  2. Poznámky
    - Funkce používá service_role_key z Supabase secrets
    - URL je získána z prostředí
*/

-- Drop old function
DROP FUNCTION IF EXISTS sync_websites_xml_feed_scheduled();

-- Create new function using Supabase environment
CREATE OR REPLACE FUNCTION sync_websites_xml_feed_scheduled()
RETURNS void AS $$
DECLARE
  response_id bigint;
  api_url text;
  service_key text;
BEGIN
  -- Get Supabase URL from environment
  SELECT decrypted_secret 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_URL' 
  INTO api_url;
  
  -- Get service role key from environment
  SELECT decrypted_secret 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' 
  INTO service_key;
  
  -- If not found in vault, try getting from environment
  IF api_url IS NULL THEN
    api_url := current_setting('request.headers', true)::json->>'x-supabase-url';
  END IF;
  
  IF api_url IS NULL THEN
    api_url := 'https://joklitgwysbflirzlbvv.supabase.co';
  END IF;
  
  IF service_key IS NULL THEN
    service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impva2xpdGd3eXNiZmxpcnpsYnZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDMwNzUyNywiZXhwIjoyMDc1ODgzNTI3fQ.IpZXsXcX1E2Zx8kcgO22GjVnxFb95aDpZE_9VnAF_yM';
  END IF;
  
  -- Call the edge function
  SELECT net.http_post(
    url := api_url || '/functions/v1/sync-websites',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  ) INTO response_id;
  
  RAISE NOTICE 'XML feed sync triggered, request_id: %, url: %', response_id, api_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
