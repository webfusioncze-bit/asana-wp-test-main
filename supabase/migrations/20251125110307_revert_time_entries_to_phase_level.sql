/*
  # Vrácení časových záznamů na úroveň fází

  1. Změny
    - Přejmenování project_id zpět na phase_id v project_time_entries
    - Aktualizace foreign key
    - Časové záznamy budou opět na fázích, ne na projektu
*/

-- Smazání starého foreign key constraintu
ALTER TABLE project_time_entries DROP CONSTRAINT IF EXISTS project_time_entries_project_id_fkey;

-- Smazání indexu
DROP INDEX IF EXISTS idx_project_time_entries_project_id;

-- Přejmenování sloupce project_id zpět na phase_id
ALTER TABLE project_time_entries RENAME COLUMN project_id TO phase_id;

-- Přidání nového foreign key
ALTER TABLE project_time_entries 
  ADD CONSTRAINT project_time_entries_phase_id_fkey 
  FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE CASCADE;

-- Nový index
CREATE INDEX IF NOT EXISTS idx_project_time_entries_phase_id ON project_time_entries(phase_id);