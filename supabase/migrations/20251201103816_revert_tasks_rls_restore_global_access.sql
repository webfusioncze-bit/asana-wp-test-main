/*
  # Revert Tasks RLS - Restore Global Folder Access

  1. Problem
    - Previous migration removed ability to see all tasks in global folders
    - This was intentional behavior - global folders should show all tasks to everyone

  2. Solution
    - Restore original RLS policy that allows viewing all tasks in global folders
    - Keep folder sharing and assignment-based access

  3. Changes
    - Restore "Users can view tasks in accessible folders" policy
    - Add back global folder access for all authenticated users
*/

-- Drop current policy
DROP POLICY IF EXISTS "Users can view tasks in accessible folders" ON tasks;

-- Recreate with global folder access restored
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
  -- Task is in a global folder OR user-accessible folder
  OR EXISTS (
    SELECT 1
    FROM folders f
    WHERE f.id = tasks.folder_id
    AND (
      f.owner_id = auth.uid()
      OR f.is_global = true
      OR is_folder_in_global_hierarchy(f.id) = true
      OR has_folder_access(auth.uid(), f.id)
    )
  )
);