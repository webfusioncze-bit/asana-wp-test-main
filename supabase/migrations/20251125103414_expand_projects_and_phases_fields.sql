/*
  # Rozšíření projektů o detailní pole

  1. Změny v tabulce `projects`
    - `project_type` - typ zakázky (vývoj/tvorba webu/grafika/integrace/převzetí do správy)
    - `project_category` - zařazení (interní/klientský)
    - `client_company_name` - název firmy klienta
    - `client_contact_person` - kontaktní osoba
    - `client_phone` - telefon klienta
    - `client_email` - email klienta
    - `client_ico` - IČO klienta
    - `price_offer` - cenová nabídka v Kč
    - `hour_budget` - hodinový rozpočet
    - `start_date` - datum zahájení
    - Přejmenování `deadline` na `delivery_date` - datum dodání
    - Rozšíření `status` o více hodnot
    
  2. Změny v tabulce `project_phases`
    - `assigned_user_id` - operátor fáze (assignee)
    - `hour_budget` - hodinový rozpočet fáze
    - Rozšíření `status` o více hodnot
    
  3. Nová tabulka `project_milestones`
    - `id` (uuid, primary key)
    - `phase_id` (uuid, references project_phases)
    - `name` (text)
    - `description` (text)
    - `target_date` (date)
    - `completed_date` (date)
    - `status` (text)
    - `position` (integer)
    - `created_at` (timestamptz)
*/

-- Rozšíření tabulky projects
DO $$ 
BEGIN
  -- Přidání nových sloupců pokud ještě neexistují
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'project_type') THEN
    ALTER TABLE projects ADD COLUMN project_type text DEFAULT 'vývoj';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'project_category') THEN
    ALTER TABLE projects ADD COLUMN project_category text DEFAULT 'klientský';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'client_company_name') THEN
    ALTER TABLE projects ADD COLUMN client_company_name text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'client_contact_person') THEN
    ALTER TABLE projects ADD COLUMN client_contact_person text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'client_phone') THEN
    ALTER TABLE projects ADD COLUMN client_phone text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'client_email') THEN
    ALTER TABLE projects ADD COLUMN client_email text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'client_ico') THEN
    ALTER TABLE projects ADD COLUMN client_ico text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'price_offer') THEN
    ALTER TABLE projects ADD COLUMN price_offer numeric;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'hour_budget') THEN
    ALTER TABLE projects ADD COLUMN hour_budget numeric;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'start_date') THEN
    ALTER TABLE projects ADD COLUMN start_date date;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'delivery_date') THEN
    ALTER TABLE projects ADD COLUMN delivery_date date;
  END IF;
END $$;

-- Aktualizace statusu na nové hodnoty (pouze pokud používá staré hodnoty)
UPDATE projects SET status = 'aktivní' WHERE status = 'active';

-- Rozšíření tabulky project_phases
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_phases' AND column_name = 'assigned_user_id') THEN
    ALTER TABLE project_phases ADD COLUMN assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_phases' AND column_name = 'hour_budget') THEN
    ALTER TABLE project_phases ADD COLUMN hour_budget numeric DEFAULT 0;
  END IF;
END $$;

-- Aktualizace statusu fází na nové hodnoty
UPDATE project_phases SET status = 'čeká na zahájení' WHERE status = 'pending';
UPDATE project_phases SET status = 'fáze probíhá' WHERE status = 'in_progress';
UPDATE project_phases SET status = 'dokončena' WHERE status = 'completed';

-- Vytvoření tabulky project_milestones
CREATE TABLE IF NOT EXISTS project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  target_date date,
  completed_date date,
  status text DEFAULT 'čeká',
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;

-- Politiky pro project_milestones
CREATE POLICY "Authenticated users can view milestones"
  ON project_milestones
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users with manage_projects can create milestones"
  ON project_milestones
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

CREATE POLICY "Users with manage_projects can update milestones"
  ON project_milestones
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

CREATE POLICY "Users with manage_projects can delete milestones"
  ON project_milestones
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

-- Trigger pro updated_at na milestones
CREATE OR REPLACE FUNCTION update_project_milestones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_milestones_updated_at
  BEFORE UPDATE ON project_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_project_milestones_updated_at();

-- Indexy
CREATE INDEX IF NOT EXISTS idx_project_milestones_phase_id ON project_milestones(phase_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_assigned_user_id ON project_phases(assigned_user_id);