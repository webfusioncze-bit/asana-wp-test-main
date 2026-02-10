/*
  # Add admin time report function

  1. New Functions
    - `get_admin_time_report(start_date, end_date)` - Returns all time entries
      from both `time_entries` and `project_time_entries` tables with full
      context (project name, phase name, task title, request title, folder name,
      user name) for a given date range.

  2. Security
    - SECURITY DEFINER to bypass RLS on joined tables (tasks, requests, folders)
    - Admin-only access check via user_roles table
    - search_path set to public for safety

  3. Notes
    - Combines task/request time entries and project phase time entries into
      a single unified result set
    - Ordered by entry_date descending
*/

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
