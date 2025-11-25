/*
  # Přidání polí pro dokončení projektů a poznámek

  1. Změny v tabulce `projects`
    - Přidání `completed_date` - datum skutečného dokončení projektu
    - Přidání `notes` - poznámky k projektu
    - Přidání `import_source_url` - URL zdroje importu (pro audit)

  2. Změny v tabulce `project_phases`
    - Přidání `completed_date` - datum dokončení fáze
    - Přidání `notes` - poznámky k fázi
    - Přidání `hourly_rate` - hodinová sazba (pro reporting)

  3. Změny v tabulce `project_time_entries`
    - Přidání `visible_to_client` - viditelnost pro klienta
*/

-- Přidání polí do projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed_date date;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS import_source_url text;

-- Přidání polí do project_phases
ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS completed_date date;
ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2);

-- Přidání polí do project_time_entries
ALTER TABLE project_time_entries ADD COLUMN IF NOT EXISTS visible_to_client boolean DEFAULT true;

-- Indexy pro rychlejší vyhledávání
CREATE INDEX IF NOT EXISTS idx_projects_completed_date ON projects(completed_date);
CREATE INDEX IF NOT EXISTS idx_project_phases_completed_date ON project_phases(completed_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_visible_to_client ON project_time_entries(visible_to_client);