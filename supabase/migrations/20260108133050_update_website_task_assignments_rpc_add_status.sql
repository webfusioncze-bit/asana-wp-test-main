/*
  # Update RPC function to include task status

  1. Changes
    - Drop and recreate get_website_update_task_assignments function
    - Now returns task status in addition to task_id and assigned_to
    - This allows UI to show completed state based on task status

  2. Security
    - Same security model - only users with manage_websites permission can call this
*/

DROP FUNCTION IF EXISTS get_website_update_task_assignments(uuid[]);

CREATE FUNCTION get_website_update_task_assignments(task_ids uuid[])
RETURNS TABLE (task_id uuid, assigned_to uuid, status text)
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
  SELECT t.id as task_id, t.assigned_to, t.status
  FROM tasks t
  WHERE t.id = ANY(task_ids);
END;
$$;
