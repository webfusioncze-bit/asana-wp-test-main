/*
  # Fix is_admin() Function with CASCADE

  1. Changes
    - Drop is_admin() function with CASCADE
    - Recreate with proper STABLE attribute
    - Recreate all dependent policies
  
  2. Security
    - Maintains all security policies
    - Fixes 500 error when querying folders
*/

-- Drop function with cascade
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Recreate function with proper attributes
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Recreate all policies that depend on is_admin()

-- Folders policies
CREATE POLICY "Users can view folders they own or have access to"
  ON folders FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT folder_id FROM folder_permissions WHERE user_id = auth.uid()) OR
    is_admin()
  );

CREATE POLICY "Users can update folders they own or have edit access"
  ON folders FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT folder_id FROM folder_permissions WHERE user_id = auth.uid() AND permission_type IN ('edit', 'admin')) OR
    is_admin()
  )
  WITH CHECK (
    owner_id = auth.uid() OR
    id IN (SELECT folder_id FROM folder_permissions WHERE user_id = auth.uid() AND permission_type IN ('edit', 'admin')) OR
    is_admin()
  );

CREATE POLICY "Users can delete own folders"
  ON folders FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR is_admin());

-- Tasks policies
CREATE POLICY "Users can view tasks assigned to them or created by them"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    is_admin()
  );

CREATE POLICY "Users can update tasks they created or are assigned to"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    is_admin()
  )
  WITH CHECK (
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    is_admin()
  );

CREATE POLICY "Users can delete tasks they created"
  ON tasks FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR is_admin());

-- Categories policies
CREATE POLICY "Users can view own categories"
  ON categories FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR is_admin())
  WITH CHECK (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR is_admin());
