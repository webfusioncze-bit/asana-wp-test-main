/*
  # Fix Folder Policies Infinite Recursion

  1. Changes
    - Drop all folder policies
    - Recreate with simpler logic to avoid recursion
    - Use direct checks instead of nested queries where possible
  
  2. Security
    - Maintain security while avoiding infinite recursion
    - Admins can access all folders
    - Users can access their own folders and shared folders
*/

-- Drop all existing folder policies
DROP POLICY IF EXISTS "Users can view folders they own or have access to" ON folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON folders;
DROP POLICY IF EXISTS "Users can update folders they own or have edit access" ON folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON folders;

-- Recreate policies with simpler logic

-- SELECT: Users can view their own folders, shared folders, or if they're admin
CREATE POLICY "Users can view own and shared folders"
  ON folders FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    ) OR
    EXISTS (
      SELECT 1 FROM folder_permissions 
      WHERE folder_id = folders.id AND user_id = auth.uid()
    )
  );

-- INSERT: Users can insert their own folders
CREATE POLICY "Users can insert own folders"
  ON folders FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- UPDATE: Users can update their own folders or folders they have edit permission on
CREATE POLICY "Users can update own and permitted folders"
  ON folders FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    ) OR
    EXISTS (
      SELECT 1 FROM folder_permissions 
      WHERE folder_id = folders.id 
        AND user_id = auth.uid() 
        AND permission_type IN ('edit', 'admin')
    )
  )
  WITH CHECK (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    ) OR
    EXISTS (
      SELECT 1 FROM folder_permissions 
      WHERE folder_id = folders.id 
        AND user_id = auth.uid() 
        AND permission_type IN ('edit', 'admin')
    )
  );

-- DELETE: Users can delete their own folders or if they're admin
CREATE POLICY "Users can delete own folders"
  ON folders FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
