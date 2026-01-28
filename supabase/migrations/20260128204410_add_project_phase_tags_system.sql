/*
  # Systém štítků pro činnosti projektů
  
  1. Nové tabulky
    - `project_phase_tags`
      - `id` (uuid, primární klíč)
      - `name` (text) - název štítku
      - `color` (text) - barva štítku (hex kód)
      - `created_at` (timestamptz)
      - `created_by` (uuid) - odkaz na uživatele
      
    - `project_phase_tag_assignments`
      - `id` (uuid, primární klíč)
      - `phase_id` (uuid) - odkaz na project_phases
      - `tag_id` (uuid) - odkaz na project_phase_tags
      - `created_at` (timestamptz)
      
  2. Bezpečnost
    - Povolit RLS na obou tabulkách
    - Oprávnění: autentizovaní uživatelé mohou číst všechny štítky
    - Pouze uživatelé s oprávněním manage_projects mohou vytvářet/upravovat/mazat štítky
    - Uživatelé s přístupem k projektu mohou přiřazovat štítky k jeho činnostem
*/

-- Tabulka pro definice štítků činností
CREATE TABLE IF NOT EXISTS project_phase_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabulka pro přiřazení štítků k činnostem
CREATE TABLE IF NOT EXISTS project_phase_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES project_phase_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(phase_id, tag_id)
);

-- Indexy pro rychlejší vyhledávání
CREATE INDEX IF NOT EXISTS idx_phase_tag_assignments_phase ON project_phase_tag_assignments(phase_id);
CREATE INDEX IF NOT EXISTS idx_phase_tag_assignments_tag ON project_phase_tag_assignments(tag_id);

-- Povolit RLS
ALTER TABLE project_phase_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_phase_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Políčka pro project_phase_tags
CREATE POLICY "Authenticated users can view phase tags"
  ON project_phase_tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users with manage_projects permission can insert phase tags"
  ON project_phase_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
      AND permission = 'manage_projects'
    )
  );

CREATE POLICY "Users with manage_projects permission can update phase tags"
  ON project_phase_tags FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
      AND permission = 'manage_projects'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
      AND permission = 'manage_projects'
    )
  );

CREATE POLICY "Users with manage_projects permission can delete phase tags"
  ON project_phase_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
      AND permission = 'manage_projects'
    )
  );

-- Políčka pro project_phase_tag_assignments
CREATE POLICY "Authenticated users can view phase tag assignments"
  ON project_phase_tag_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users with manage_projects can assign phase tags"
  ON project_phase_tag_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
      AND permission = 'manage_projects'
    )
  );

CREATE POLICY "Users with manage_projects can remove phase tag assignments"
  ON project_phase_tag_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
      AND permission = 'manage_projects'
    )
  );