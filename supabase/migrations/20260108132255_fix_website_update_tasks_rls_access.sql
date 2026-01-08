/*
  # Fix RLS for website update tasks

  1. Problem
    - Tasks created for website updates either have folder_id = null or are in folders
      that users may not have access to
    - Users with manage_websites permission need to view these tasks

  2. Solution
    - Add RLS policy that allows users with manage_websites permission to SELECT
      tasks that are linked to website_update_instances
    - This enables TaskDetail component to load and display these tasks

  3. Security
    - Only users with manage_websites permission can view these tasks
    - Policy is restricted to SELECT only
*/

CREATE POLICY "Users with manage_websites can view website update tasks"
ON tasks FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_permissions up
    WHERE up.user_id = auth.uid()
    AND up.permission = 'manage_websites'
  )
  AND (
    id IN (
      SELECT task_id FROM website_update_instances WHERE task_id IS NOT NULL
    )
    OR
    folder_id IS NULL
  )
);

CREATE POLICY "Users with manage_websites can update website update tasks"
ON tasks FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_permissions up
    WHERE up.user_id = auth.uid()
    AND up.permission = 'manage_websites'
  )
  AND id IN (
    SELECT task_id FROM website_update_instances WHERE task_id IS NOT NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_permissions up
    WHERE up.user_id = auth.uid()
    AND up.permission = 'manage_websites'
  )
  AND id IN (
    SELECT task_id FROM website_update_instances WHERE task_id IS NOT NULL
  )
);
