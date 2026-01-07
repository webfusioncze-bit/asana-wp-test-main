/*
  # Add RLS policy for website update tasks visibility

  1. Security Changes
    - Add policy allowing users with manage_websites permission to view tasks
      that are linked to website update instances
    - This enables the schedule view to show assigned users for all update tasks

  2. Notes
    - Uses EXISTS subquery to check task linkage to website_update_instances
    - Checks user permission via user_permissions table
*/

CREATE POLICY "Users with manage_websites can view website update tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM website_update_instances wui
      WHERE wui.task_id = tasks.id
    )
    AND EXISTS (
      SELECT 1 FROM user_permissions up
      WHERE up.user_id = auth.uid()
      AND up.permission = 'manage_websites'
    )
  );
