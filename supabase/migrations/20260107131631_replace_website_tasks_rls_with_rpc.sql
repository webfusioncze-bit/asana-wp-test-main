/*
  # Replace RLS policy with RPC function for website update tasks

  1. Changes
    - Drop the overly broad RLS policy for website update tasks
    - Create RPC function that returns task assigned_to for website update instances
    - Function uses SECURITY DEFINER to bypass RLS
    - Only accessible to users with manage_websites permission

  2. Security
    - Function checks manage_websites permission before returning data
    - Only returns task_id and assigned_to, no other sensitive data
*/

DROP POLICY IF EXISTS "Users with manage_websites can view website update tasks" ON tasks;

CREATE OR REPLACE FUNCTION get_website_update_task_assignments(task_ids uuid[])
RETURNS TABLE (task_id uuid, assigned_to uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_permissions up
    WHERE up.user_id = auth.uid()
    AND up.permission = 'manage_websites'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT t.id as task_id, t.assigned_to
  FROM tasks t
  WHERE t.id = ANY(task_ids);
END;
$$;
