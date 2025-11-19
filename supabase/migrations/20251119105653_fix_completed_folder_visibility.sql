/*
  # Fix Completed Folder Visibility

  1. Changes
    - Update folders RLS policy to exclude "Dokončené" folders from shared/admin view
    - Users can only see their own "Dokončené" folder
    - Other folders remain shareable as before

  2. Security
    - Maintains existing RLS for regular folders
    - Adds special handling for "Dokončené" folders to keep them private
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view their own folders and shared folders" ON folders;

-- Create updated policy with special handling for "Dokončené" folders
CREATE POLICY "Users can view their own folders and shared folders"
  ON folders FOR SELECT
  TO authenticated
  USING (
    -- Always show own folders
    owner_id = auth.uid() OR
    -- For non-"Dokončené" folders, allow admin and shared access
    (
      name != 'Dokončené' AND (
        is_admin_user(auth.uid()) OR
        has_folder_access(auth.uid(), id)
      )
    )
  );
