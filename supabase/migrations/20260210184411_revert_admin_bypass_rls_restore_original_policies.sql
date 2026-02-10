/*
  # Revert admin bypass from tasks and folders RLS policies

  1. Modified Tables
    - `tasks` - Restore SELECT policy WITHOUT admin bypass
    - `folders` - Restore SELECT policy WITHOUT admin bypass

  2. Restored Functions
    - `get_admin_time_report(start_date, end_date)` - SECURITY DEFINER function
      that bypasses RLS safely for admin time report queries only

  3. Security Changes
    - Admin users can NO LONGER see all tasks/folders globally
    - Original access rules restored: owner, assigned, shared, global hierarchy
    - Time report admin access handled via SECURITY DEFINER function instead
    - This is the correct approach: narrow bypass via function, not broad RLS opening

  4. Notes
    - Reverts migration 20260210183942_fix_tasks_folders_rls_add_admin_bypass
    - Root cause was that the admin bypass was too broad and exposed all
      users' folders and tasks to admin users in the regular UI
*/

-- Restore original tasks SELECT policy (without admin bypass)
DROP POLICY IF EXISTS "Users can view tasks in accessible folders" ON tasks;

CREATE POLICY "Users can view tasks in accessible folders"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    (created_by = auth.uid())
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

-- Restore original folders SELECT policy (without admin bypass)
DROP POLICY IF EXISTS "Users can view their own folders and shared folders" ON folders;

CREATE POLICY "Users can view their own folders and shared folders"
  ON folders FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR has_folder_access(auth.uid(), id)
    OR is_global = true
    OR is_folder_in_global_hierarchy(id) = true
  );

-- Restore the SECURITY DEFINER function for admin time reports
CREATE OR REPLACE FUNCTION get_admin_time_report(start_date date, end_date date)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_name text,
  entry_date date,
  hours numeric,
  description text,
  entry_type text,
  project_name text,
  phase_name text,
  task_title text,
  request_title text,
  folder_name text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN QUERY
  SELECT
    te.id,
    te.user_id,
    COALESCE(
      NULLIF(TRIM(CONCAT(ur.first_name, ' ', ur.last_name)), ''),
      (au.email)::text
    )::text AS user_name,
    te.date AS entry_date,
    te.hours,
    COALESCE(te.description, '')::text AS description,
    CASE
      WHEN te.request_id IS NOT NULL THEN 'request'
      ELSE 'task'
    END::text AS entry_type,
    NULL::text AS project_name,
    NULL::text AS phase_name,
    t.title::text AS task_title,
    r.title::text AS request_title,
    f.name::text AS folder_name
  FROM time_entries te
  LEFT JOIN tasks t ON te.task_id = t.id
  LEFT JOIN folders f ON t.folder_id = f.id
  LEFT JOIN requests r ON te.request_id = r.id
  LEFT JOIN auth.users au ON te.user_id = au.id
  LEFT JOIN user_roles ur ON te.user_id = ur.user_id
  WHERE te.date BETWEEN start_date AND end_date

  UNION ALL

  SELECT
    pte.id,
    pte.user_id,
    COALESCE(
      NULLIF(TRIM(CONCAT(ur.first_name, ' ', ur.last_name)), ''),
      (au.email)::text
    )::text AS user_name,
    pte.entry_date,
    pte.hours,
    COALESCE(pte.description, '')::text AS description,
    'project'::text AS entry_type,
    p.name::text AS project_name,
    pp.name::text AS phase_name,
    NULL::text AS task_title,
    NULL::text AS request_title,
    NULL::text AS folder_name
  FROM project_time_entries pte
  LEFT JOIN project_phases pp ON pte.phase_id = pp.id
  LEFT JOIN projects p ON pp.project_id = p.id
  LEFT JOIN auth.users au ON pte.user_id = au.id
  LEFT JOIN user_roles ur ON pte.user_id = ur.user_id
  WHERE pte.entry_date BETWEEN start_date AND end_date

  ORDER BY entry_date DESC;
END;
$$;