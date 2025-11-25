/*
  # Fix Task Sections RLS for Global Folders

  1. Updates to Existing Policies
    - Update task_sections INSERT policy to allow sections in global folders
    - Update task_sections UPDATE policy to allow updates in global folders
    - Update task_sections DELETE policy to allow deletes in global folders
    - Update task_sections SELECT policy to allow viewing sections in global folders

  2. Security
    - All authenticated users can create sections in global folders
    - All authenticated users can update/delete sections in global folders
    - Maintains existing security for personal folders

  3. Important Notes
    - This enables full section management in global folders
    - Global folders are identified by is_global = true
    - Also checks if folder is in global hierarchy (subfolders of global folders)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view sections in accessible folders" ON task_sections;
DROP POLICY IF EXISTS "Users can insert sections in accessible folders" ON task_sections;
DROP POLICY IF EXISTS "Users can update sections in accessible folders" ON task_sections;
DROP POLICY IF EXISTS "Users can delete sections they created" ON task_sections;

-- SELECT policy: Allow viewing sections in global folders and accessible folders
CREATE POLICY "Users can view sections in accessible folders"
  ON task_sections
  FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR has_folder_access(auth.uid(), folder_id)
    OR EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = task_sections.folder_id
      AND (
        f.is_global = true
        OR is_folder_in_global_hierarchy(f.id) = true
      )
    )
  );

-- INSERT policy: Allow creating sections in global folders and accessible folders
CREATE POLICY "Users can insert sections in accessible folders"
  ON task_sections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = task_sections.folder_id
      AND (
        (created_by = auth.uid() AND has_folder_access(auth.uid(), f.id))
        OR f.is_global = true
        OR is_folder_in_global_hierarchy(f.id) = true
      )
    )
  );

-- UPDATE policy: Allow updating sections in global folders and accessible folders
CREATE POLICY "Users can update sections in accessible folders"
  ON task_sections
  FOR UPDATE
  TO authenticated
  USING (
    is_admin()
    OR has_folder_access(auth.uid(), folder_id)
    OR EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = task_sections.folder_id
      AND (
        f.is_global = true
        OR is_folder_in_global_hierarchy(f.id) = true
      )
    )
  )
  WITH CHECK (
    is_admin()
    OR has_folder_access(auth.uid(), folder_id)
    OR EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = task_sections.folder_id
      AND (
        f.is_global = true
        OR is_folder_in_global_hierarchy(f.id) = true
      )
    )
  );

-- DELETE policy: Allow deleting sections in global folders and accessible folders
CREATE POLICY "Users can delete sections in accessible folders"
  ON task_sections
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = task_sections.folder_id
      AND (
        f.is_global = true
        OR is_folder_in_global_hierarchy(f.id) = true
      )
    )
  );
