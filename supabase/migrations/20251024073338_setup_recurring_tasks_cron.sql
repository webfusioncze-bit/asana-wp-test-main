/*
  # Nastavení automatického zpracování opakovaných tasků

  1. Změny
    - Vytvoření cron jobu pro pravidelné spouštění Edge Function
    - Cron job běží každou hodinu a kontroluje opakované tasky

  2. Poznámky
    - pg_cron extension musí být povolena (obvykle je ve výchozím stavu)
    - Edge Function process-recurring-tasks musí být nasazena
*/

-- Povolit pg_cron extension (pokud ještě není povolena)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Smazat existující job, pokud existuje
SELECT cron.unschedule('process-recurring-tasks') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-recurring-tasks'
);

-- Vytvořit cron job pro zpracování opakovaných tasků každou hodinu
SELECT cron.schedule(
  'process-recurring-tasks',
  '0 * * * *', -- Každou hodinu v 0. minutě
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/process-recurring-tasks',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);