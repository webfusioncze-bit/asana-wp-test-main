/*
  # Rozšíření projektového managementu

  1. Změny v `projects` tabulce
    - Přidání více sloupců pro projekt (client, budget, deadline, atd.)
    - Aktualizace RLS politik na základě oprávnění manage_projects

  2. Nové tabulky
    - `project_phases` - Fáze projektu (subtasky projektu)
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `parent_phase_id` (uuid, self-reference pro vnořené fáze)
      - `name` (text, název fáze)
      - `description` (text)
      - `status` (text - pending, in_progress, completed)
      - `position` (integer, pro řazení)
      - `estimated_hours` (numeric)
      - `start_date` (date)
      - `end_date` (date)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `project_phase_assignments` - Přiřazení uživatelů k fázím
      - `id` (uuid, primary key)
      - `phase_id` (uuid, references project_phases)
      - `user_id` (uuid, references auth.users)
      - `role` (text - developer, reviewer, atd.)
      - `created_at` (timestamptz)

    - `project_time_entries` - Evidence času na fázích
      - `id` (uuid, primary key)
      - `phase_id` (uuid, references project_phases)
      - `user_id` (uuid, references auth.users)
      - `description` (text, popis činnosti)
      - `hours` (numeric, počet hodin)
      - `entry_date` (date, datum evidence)
      - `entry_time` (time, čas evidence)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - RLS na všech tabulkách
    - Uživatelé s oprávněním manage_projects mohou vytvářet projekty
    - Uživatelé přiřazení k fázi mohou evidovat čas
    - Všichni autentizovaní uživatelé mohou zobrazit projekty a fáze
*/

-- Rozšíření projects tabulky
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget numeric;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deadline date;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';

-- Odstranění starých politik
DROP POLICY IF EXISTS "Specific admin can view projects" ON projects;
DROP POLICY IF EXISTS "Specific admin can create projects" ON projects;
DROP POLICY IF EXISTS "Specific admin can update projects" ON projects;
DROP POLICY IF EXISTS "Specific admin can delete projects" ON projects;

-- Nové politiky pro projects založené na oprávněních
CREATE POLICY "Authenticated users can view projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users with manage_projects permission can create projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_projects'
    )
    OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'milan.vodak@webfusion.cz'
    )
  );

CREATE POLICY "Users with manage_projects permission can update projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_projects'
    )
    OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'milan.vodak@webfusion.cz'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_projects'
    )
    OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'milan.vodak@webfusion.cz'
    )
  );

CREATE POLICY "Users with manage_projects permission can delete projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_projects'
    )
    OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'milan.vodak@webfusion.cz'
    )
  );

-- Vytvoření tabulky project_phases (fáze projektu)
CREATE TABLE IF NOT EXISTS project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_phase_id uuid REFERENCES project_phases(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text DEFAULT 'pending',
  position integer DEFAULT 0,
  estimated_hours numeric DEFAULT 0,
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;

-- Politiky pro project_phases
CREATE POLICY "Authenticated users can view project phases"
  ON project_phases
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users with manage_projects can create phases"
  ON project_phases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_projects'
    )
    OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'milan.vodak@webfusion.cz'
    )
  );

CREATE POLICY "Users with manage_projects can update phases"
  ON project_phases
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_projects'
    )
    OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'milan.vodak@webfusion.cz'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_projects'
    )
    OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'milan.vodak@webfusion.cz'
    )
  );

CREATE POLICY "Users with manage_projects can delete phases"
  ON project_phases
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_projects'
    )
    OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'milan.vodak@webfusion.cz'
    )
  );

-- Vytvoření tabulky project_phase_assignments
CREATE TABLE IF NOT EXISTS project_phase_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE(phase_id, user_id)
);

-- Enable RLS
ALTER TABLE project_phase_assignments ENABLE ROW LEVEL SECURITY;

-- Politiky pro project_phase_assignments
CREATE POLICY "Authenticated users can view phase assignments"
  ON project_phase_assignments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users with manage_projects can create assignments"
  ON project_phase_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_projects'
    )
    OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'milan.vodak@webfusion.cz'
    )
  );

CREATE POLICY "Users with manage_projects can delete assignments"
  ON project_phase_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_projects'
    )
    OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'milan.vodak@webfusion.cz'
    )
  );

-- Vytvoření tabulky project_time_entries
CREATE TABLE IF NOT EXISTS project_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL,
  hours numeric NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  entry_time time DEFAULT CURRENT_TIME,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE project_time_entries ENABLE ROW LEVEL SECURITY;

-- Politiky pro project_time_entries
CREATE POLICY "Authenticated users can view time entries"
  ON project_time_entries
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Assigned users can create time entries"
  ON project_time_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Uživatel je přiřazen k fázi
    EXISTS (
      SELECT 1 FROM project_phase_assignments
      WHERE project_phase_assignments.phase_id = project_time_entries.phase_id
      AND project_phase_assignments.user_id = auth.uid()
    )
    OR
    -- Nebo má oprávnění manage_projects
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_projects'
    )
    OR
    -- Nebo je to Milan Vodák
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = 'milan.vodak@webfusion.cz'
    )
  );

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

-- Triggery pro updated_at
CREATE OR REPLACE FUNCTION update_project_phases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_phases_updated_at
  BEFORE UPDATE ON project_phases
  FOR EACH ROW
  EXECUTE FUNCTION update_project_phases_updated_at();

CREATE OR REPLACE FUNCTION update_project_time_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_time_entries_updated_at
  BEFORE UPDATE ON project_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_project_time_entries_updated_at();

-- Indexy pro výkon
CREATE INDEX IF NOT EXISTS idx_project_phases_project_id ON project_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_parent_phase_id ON project_phases(parent_phase_id);
CREATE INDEX IF NOT EXISTS idx_project_phase_assignments_phase_id ON project_phase_assignments(phase_id);
CREATE INDEX IF NOT EXISTS idx_project_phase_assignments_user_id ON project_phase_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_phase_id ON project_time_entries(phase_id);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_user_id ON project_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_entry_date ON project_time_entries(entry_date);