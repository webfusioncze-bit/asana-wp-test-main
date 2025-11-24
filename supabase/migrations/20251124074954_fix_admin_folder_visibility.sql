/*
  # Fix Admin Folder Visibility

  1. Changes
    - Remove admin bypass from folder SELECT policy
    - Admins should only see their own folders and shared folders like regular users
    - Admin privileges remain for INSERT, UPDATE, DELETE operations

  2. Security
    - Maintains proper data isolation between users
    - Admin can still manage folders through admin-specific operations
*/

-- Update folders RLS to remove admin bypass from SELECT
DROP POLICY IF EXISTS "Users can view their own folders and shared folders" ON folders;
CREATE POLICY "Users can view their own folders and shared folders"
  ON folders FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    has_folder_access(auth.uid(), id)
  );

-- Keep admin privileges for INSERT, UPDATE, DELETE operations
DROP POLICY IF EXISTS "Users can create folders" ON folders;
CREATE POLICY "Users can create folders"
  ON folders FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid() OR
    is_admin_user(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
CREATE POLICY "Users can update their own folders"
  ON folders FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    is_admin_user(auth.uid())
  )
  WITH CHECK (
    owner_id = auth.uid() OR
    is_admin_user(auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;
CREATE POLICY "Users can delete their own folders"
  ON folders FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    is_admin_user(auth.uid())
  );
