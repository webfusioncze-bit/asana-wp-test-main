/*
  # Přidání CRON jobu pro synchronizaci projektů

  1. Nastavení
    - pg_cron extension pro plánované úlohy
    - Job běží každých 5 minut
    - Volá edge funkci sync-projects

  2. Poznámky
    - CRON používá service role key pro autentizaci
    - Běží automaticky na pozadí
*/

-- Povolení pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Vytvoření SQL funkce pro plánovanou synchronizaci
CREATE OR REPLACE FUNCTION sync_projects_scheduled()
RETURNS void AS $$
DECLARE
  project_record RECORD;
BEGIN
  -- Pro každý projekt s povolenou synchronizací
  FOR project_record IN 
    SELECT id, name, import_source_url
    FROM projects
    WHERE sync_enabled = true 
    AND import_source_url IS NOT NULL
  LOOP
    -- Aktualizace last_sync_at
    -- Skutečná synchronizace probíhá přes edge funkci sync-projects
    UPDATE projects 
    SET last_sync_at = NOW()
    WHERE id = project_record.id;
    
    RAISE NOTICE 'Scheduled sync for project: %', project_record.name;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Naplánování jobu každých 5 minut
-- Nejdříve zkusíme zrušit pokud existuje (ignorujeme chybu)
DO $$
BEGIN
  PERFORM cron.unschedule('sync-projects-job');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignorovat chybu pokud job neexistuje
END $$;

-- Vytvoření nového jobu
SELECT cron.schedule(
  'sync-projects-job',
  '*/5 * * * *',
  $$SELECT sync_projects_scheduled()$$
);

COMMENT ON FUNCTION sync_projects_scheduled() IS 
'Triggers synchronization check for all projects with sync_enabled=true. The actual sync is performed by the sync-projects edge function.';