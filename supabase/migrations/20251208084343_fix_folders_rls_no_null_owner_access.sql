/*
  # Fix Folders RLS - Remove NULL Owner Access

  1. Problem
    - Current SELECT policy allows all users to see folders with `owner_id IS NULL`
    - This causes other users' "Nepřiřazené" and "Dokončené" folders to appear as shared
    - Security issue: users can see folders they shouldn't have access to

  2. Solution
    - Remove `owner_id IS NULL` condition from SELECT policy
    - Only allow access to:
      - Own folders (owner_id = auth.uid())
      - Explicitly shared folders (has_folder_access)
      - Global folders (is_global = true)
      - Folders in global hierarchy

  3. Cleanup
    - Delete any orphaned folders with owner_id = NULL
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own folders and shared folders" ON folders;

-- Create new SELECT policy without NULL owner access
CREATE POLICY "Users can view their own folders and shared folders"
  ON folders FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR has_folder_access(auth.uid(), id)
    OR is_global = true
    OR is_folder_in_global_hierarchy(id) = true
  );

-- Delete orphaned folders with NULL owner_id
DELETE FROM folders WHERE owner_id IS NULL;
