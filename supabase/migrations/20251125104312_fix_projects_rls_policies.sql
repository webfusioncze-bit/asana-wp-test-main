/*
  # Oprava RLS politik pro projekty

  1. Problém
    - RLS politiky používají `auth.users.email` což vyžaduje přístup k auth.users tabulce
    - To způsobuje 403 chybu při vytváření projektů
    
  2. Řešení
    - Použít pouze `user_permissions` tabulku pro kontrolu oprávnění
    - Odstranit kontrolu na konkrétní email
*/

-- Odstranění starých politik pro projects
DROP POLICY IF EXISTS "Users with manage_projects permission can create projects" ON projects;
DROP POLICY IF EXISTS "Users with manage_projects permission can update projects" ON projects;
DROP POLICY IF EXISTS "Users with manage_projects permission can delete projects" ON projects;

-- Nové politiky pro projects bez kontroly na email
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_projects'
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
  );

-- Oprava politik pro project_phases
DROP POLICY IF EXISTS "Users with manage_projects can create phases" ON project_phases;
DROP POLICY IF EXISTS "Users with manage_projects can update phases" ON project_phases;
DROP POLICY IF EXISTS "Users with manage_projects can delete phases" ON project_phases;

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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_projects'
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
  );

-- Oprava politik pro project_phase_assignments
DROP POLICY IF EXISTS "Users with manage_projects can create assignments" ON project_phase_assignments;
DROP POLICY IF EXISTS "Users with manage_projects can delete assignments" ON project_phase_assignments;

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
  );

-- Oprava politik pro project_milestones
DROP POLICY IF EXISTS "Users with manage_projects can create milestones" ON project_milestones;
DROP POLICY IF EXISTS "Users with manage_projects can update milestones" ON project_milestones;
DROP POLICY IF EXISTS "Users with manage_projects can delete milestones" ON project_milestones;

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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_projects'
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
  );