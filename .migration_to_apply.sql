-- Fix Admin Folder Visibility
-- Admins should only see their own folders and shared folders, not all folders

DROP POLICY IF EXISTS "Users can view their own folders and shared folders" ON folders;
CREATE POLICY "Users can view their own folders and shared folders"
  ON folders FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    has_folder_access(auth.uid(), id)
  );
