/*
  # Add Global Folders Support

  1. Changes to Tables
    - Add `is_global` column to `folders` table
      - Boolean flag to mark folders as global (accessible to all users)
      - Default: false (regular user folders)
  
  2. Security Updates
    - Update RLS policies to allow:
      - Admins can create global folders
      - All authenticated users can view global folders
      - All authenticated users can create tasks in global folders
      - Only admins can modify/delete global folders
  
  3. Notes
    - Global folders are created by admins
    - All users can see and use global folders
    - Personal folders remain private (unless explicitly shared)
*/

-- Add is_global column to folders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'folders' AND column_name = 'is_global'
  ) THEN
    ALTER TABLE folders ADD COLUMN is_global boolean DEFAULT false;
  END IF;
END $$;

-- Update the folders SELECT policy to include global folders
DROP POLICY IF EXISTS "Users can view their own folders and shared folders" ON folders;
CREATE POLICY "Users can view their own folders and shared folders"
  ON folders FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    has_folder_access(auth.uid(), id) OR
    is_global = true
  );

-- Allow admins to create global folders
DROP POLICY IF EXISTS "Users can create folders" ON folders;
CREATE POLICY "Users can create folders"
  ON folders FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid() OR
    (is_admin() AND is_global = true)
  );

-- Allow admins to update global folders, users can update their own
DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
CREATE POLICY "Users can update their own folders"
  ON folders FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    (is_admin() AND is_global = true)
  )
  WITH CHECK (
    owner_id = auth.uid() OR
    (is_admin() AND is_global = true)
  );

-- Allow admins to delete global folders, users can delete their own
DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;
CREATE POLICY "Users can delete their own folders"
  ON folders FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    (is_admin() AND is_global = true)
  );

-- Update tasks policies to allow creating tasks in global folders
DROP POLICY IF EXISTS "Users can create tasks in accessible folders" ON tasks;
CREATE POLICY "Users can create tasks in accessible folders"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = folder_id
      AND (
        f.owner_id = auth.uid() OR
        has_folder_access(auth.uid(), f.id) OR
        f.is_global = true
      )
    )
  );

-- Update tasks SELECT policy to include global folder tasks
DROP POLICY IF EXISTS "Users can view tasks in accessible folders" ON tasks;
CREATE POLICY "Users can view tasks in accessible folders"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = folder_id
      AND (
        f.owner_id = auth.uid() OR
        has_folder_access(auth.uid(), f.id) OR
        f.is_global = true
      )
    )
  );

-- Update tasks UPDATE policy
DROP POLICY IF EXISTS "Users can update tasks in accessible folders" ON tasks;
CREATE POLICY "Users can update tasks in accessible folders"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = folder_id
      AND (
        f.owner_id = auth.uid() OR
        has_folder_access(auth.uid(), f.id) OR
        f.is_global = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = folder_id
      AND (
        f.owner_id = auth.uid() OR
        has_folder_access(auth.uid(), f.id) OR
        f.is_global = true
      )
    )
  );

-- Update tasks DELETE policy
DROP POLICY IF EXISTS "Users can delete tasks in accessible folders" ON tasks;
CREATE POLICY "Users can delete tasks in accessible folders"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = folder_id
      AND (
        f.owner_id = auth.uid() OR
        has_folder_access(auth.uid(), f.id) OR
        f.is_global = true
      )
    )
  );
