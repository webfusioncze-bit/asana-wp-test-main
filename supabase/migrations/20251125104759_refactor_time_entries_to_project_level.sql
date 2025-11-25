/*
  # Refaktorování časových záznamů na úroveň projektu

  1. Změny
    - Přejmenování phase_id na project_id v project_time_entries
    - Přidání reference na projekt místo fáze
    - Zjednodušení struktury časového záznamu
    - Aktualizace RLS politik

  2. Poznámky
    - Časové záznamy budou napřímo na projektu, ne na fázích
    - Formát: Datum, Činnost (popis), Čas (v hodinách)
*/

-- Smazání starých RLS politik
DROP POLICY IF EXISTS "Authenticated users can view time entries" ON project_time_entries;
DROP POLICY IF EXISTS "Assigned users can create time entries" ON project_time_entries;
DROP POLICY IF EXISTS "Users can update own time entries" ON project_time_entries;
DROP POLICY IF EXISTS "Users can delete own time entries" ON project_time_entries;

-- Smazání starého indexu
DROP INDEX IF EXISTS idx_project_time_entries_phase_id;

-- Smazání foreign key constraintu
ALTER TABLE project_time_entries DROP CONSTRAINT IF EXISTS project_time_entries_phase_id_fkey;

-- Přejmenování sloupce phase_id na project_id
ALTER TABLE project_time_entries RENAME COLUMN phase_id TO project_id;

-- Přidání nového foreign key
ALTER TABLE project_time_entries 
  ADD CONSTRAINT project_time_entries_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- Odstranění sloupce entry_time (nebudeme používat čas, jen datum)
ALTER TABLE project_time_entries DROP COLUMN IF EXISTS entry_time;

-- Nové RLS politiky
CREATE POLICY "Authenticated users can view time entries"
  ON project_time_entries
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create time entries"
  ON project_time_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own time entries"
  ON project_time_entries
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own time entries"
  ON project_time_entries
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Nový index
CREATE INDEX IF NOT EXISTS idx_project_time_entries_project_id ON project_time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_user_id_date ON project_time_entries(user_id, entry_date);