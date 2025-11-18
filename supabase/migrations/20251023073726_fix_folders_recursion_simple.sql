/*
  # Fix Folders Infinite Recursion - Simplified Approach

  1. Changes
    - Drop all folder policies
    - Create simple policies without folder_permissions subqueries
    - Users can access their own folders
    - Admins can access all folders
  
  2. Security
    - Maintain security with simpler approach
    - Remove folder_permissions checks to avoid recursion
*/

-- Drop all existing folder policies
DROP POLICY IF EXISTS "Users can view own and shared folders" ON folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON folders;
DROP POLICY IF EXISTS "Users can update own and permitted folders" ON folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON folders;

-- Simple SELECT policy: own folders or admin
CREATE POLICY "Users can view own folders or admin can view all"
  ON folders FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Simple INSERT policy: can create own folders
CREATE POLICY "Users can insert own folders"
  ON folders FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Simple UPDATE policy: own folders or admin
CREATE POLICY "Users can update own folders or admin can update all"
  ON folders FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Simple DELETE policy: own folders or admin
CREATE POLICY "Users can delete own folders or admin can delete all"
  ON folders FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
