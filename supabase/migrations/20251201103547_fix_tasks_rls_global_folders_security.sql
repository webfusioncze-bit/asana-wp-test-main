/*
  # Fix Tasks RLS - Don't show all tasks in global folders

  1. Problem
    - Current RLS policy shows ALL tasks in global folders to ALL users
    - This is a security issue - users see tasks they shouldn't see

  2. Solution
    - Keep global folders visible to all
    - BUT limit task visibility to:
      - Tasks assigned to the user
      - Tasks created by the user
      - All tasks for admins
      - Tasks in folders explicitly shared with the user

  3. Changes
    - Update "Users can view tasks in accessible folders" policy
    - Remove blanket access to all tasks in global folders
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view tasks in accessible folders" ON tasks;

-- Recreate with proper access control
CREATE POLICY "Users can view tasks in accessible folders"
ON tasks FOR SELECT
TO authenticated
USING (
  -- Admins can see everything
  is_admin()
  -- User created the task
  OR created_by = auth.uid()
  -- User is assigned to the task
  OR assigned_to = auth.uid()
  -- User has explicit access to the folder (via folder sharing)
  OR (folder_id IS NOT NULL AND has_folder_access(auth.uid(), folder_id))
  -- Folder is explicitly shared with user OR user owns it (NOT just global)
  OR EXISTS (
    SELECT 1
    FROM folders f
    WHERE f.id = tasks.folder_id
    AND (
      f.owner_id = auth.uid()
      OR has_folder_access(auth.uid(), f.id)
    )
  )
);