/*
  # Fix tasks and folders RLS - add admin bypass for time reports

  1. Modified Tables
    - `tasks` - Replace SELECT policy to include admin bypass
    - `folders` - Replace SELECT policy to include admin bypass

  2. Security Changes
    - Admin users can now view ALL tasks (needed for time reports and oversight)
    - Admin users can now view ALL folders (needed for task context in reports)
    - Non-admin access remains unchanged

  3. Notes
    - Root cause: time_entries RLS allowed admin access but the joined
      tables (tasks, folders) did not, causing nested Supabase embeds
      to return null/fail for admin users viewing other users' entries
    - Also drops the get_admin_time_report RPC function which is no longer needed
*/

DROP POLICY IF EXISTS "Users can view tasks in accessible folders" ON tasks;

CREATE POLICY "Users can view tasks in accessible folders"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    ))
    OR (created_by = auth.uid())
    OR (assigned_to = auth.uid())
    OR (EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id AND f.owner_id = auth.uid()
    ))
    OR (EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id AND has_folder_access(auth.uid(), f.id)
    ))
    OR (EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id
        AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
        AND (
          tasks.status <> 'completed'
          OR tasks.created_by = auth.uid()
          OR tasks.assigned_to = auth.uid()
          OR f.owner_id = auth.uid()
        )
    ))
    OR (request_id IS NOT NULL AND has_request_access(auth.uid(), request_id))
  );

DROP POLICY IF EXISTS "Users can view their own folders and shared folders" ON folders;

CREATE POLICY "Users can view their own folders and shared folders"
  ON folders FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    ))
    OR (owner_id = auth.uid())
    OR has_folder_access(auth.uid(), id)
    OR (is_global = true)
    OR (is_folder_in_global_hierarchy(id) = true)
  );

DROP FUNCTION IF EXISTS get_admin_time_report(date, date);
