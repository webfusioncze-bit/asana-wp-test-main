/*
  # Přesun štítků z fází na časové záznamy
  
  1. Změny
    - Smazat tabulku `project_phase_tag_assignments` (štítky pro fáze)
    - Vytvořit tabulku `project_time_entry_tags` (štítky pro časové záznamy)
    - Zachovat tabulku `project_phase_tags` pro definice štítků
    
  2. Bezpečnost
    - Povolit RLS na nové tabulce
    - Uživatelé s přístupem k projektu mohou přiřazovat štítky k časovým záznamům
*/

-- Smazat starou tabulku pro přiřazení štítků k fázím
DROP TABLE IF EXISTS project_phase_tag_assignments CASCADE;

-- Vytvořit novou tabulku pro přiřazení štítků k časovým záznamům
CREATE TABLE IF NOT EXISTS project_time_entry_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES project_time_entries(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES project_phase_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(time_entry_id, tag_id)
);

-- Indexy pro rychlejší vyhledávání
CREATE INDEX IF NOT EXISTS idx_time_entry_tags_entry ON project_time_entry_tags(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_tags_tag ON project_time_entry_tags(tag_id);

-- Povolit RLS
ALTER TABLE project_time_entry_tags ENABLE ROW LEVEL SECURITY;

-- Políčka pro project_time_entry_tags
CREATE POLICY "Authenticated users can view time entry tags"
  ON project_time_entry_tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users with manage_projects can assign time entry tags"
  ON project_time_entry_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
      AND permission = 'manage_projects'
    )
  );

CREATE POLICY "Users with manage_projects can remove time entry tag assignments"
  ON project_time_entry_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
      AND permission = 'manage_projects'
    )
  );