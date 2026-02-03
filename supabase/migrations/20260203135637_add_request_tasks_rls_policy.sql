/*
  # Add RLS policies for tasks linked to requests

  This migration updates the tasks RLS policies to allow users who have access 
  to a request to also view and update tasks linked to that request.

  1. Changes
    - Updates SELECT policy to include tasks linked to accessible requests
    - Updates UPDATE policy to include tasks linked to accessible requests
    - Updates DELETE policy to include tasks linked to accessible requests

  2. Security
    - Users can only access tasks for requests they have permission to view
    - Admin users and users with view_requests permission can access all request tasks
    - Users assigned to or who created a request can access its tasks
*/

-- Drop existing task policies that need updating
DROP POLICY IF EXISTS "Users can view tasks in accessible folders" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in accessible folders" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks in accessible folders" ON tasks;

-- Helper function to check if user has access to a request
CREATE OR REPLACE FUNCTION has_request_access(user_id uuid, req_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = has_request_access.user_id
    AND user_roles.role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  -- Check if user has view_requests permission
  IF has_permission(user_id, 'view_requests') THEN
    RETURN true;
  END IF;

  -- Check if user is assigned to or created the request
  IF EXISTS (
    SELECT 1 FROM requests
    WHERE requests.id = req_id
    AND (requests.assigned_to = has_request_access.user_id OR requests.created_by = has_request_access.user_id)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Recreate SELECT policy with request access
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
      AND (tasks.status <> 'completed' OR tasks.created_by = auth.uid() OR tasks.assigned_to = auth.uid() OR f.owner_id = auth.uid())
    ))
    OR (
      request_id IS NOT NULL AND has_request_access(auth.uid(), request_id)
    )
  );

-- Recreate UPDATE policy with request access
CREATE POLICY "Users can update tasks in accessible folders"
  ON tasks FOR UPDATE
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
    ))
    OR (
      request_id IS NOT NULL AND has_request_access(auth.uid(), request_id)
    )
  )
  WITH CHECK (
    (folder_id IS NULL)
    OR (EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id 
      AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true OR f.owner_id = auth.uid() OR has_folder_access(auth.uid(), f.id))
    ))
  );

-- Recreate DELETE policy with request access
CREATE POLICY "Users can delete tasks in accessible folders"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    (created_by = auth.uid())
    OR (EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id AND f.owner_id = auth.uid()
    ))
    OR (EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id 
      AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
    ))
    OR (
      request_id IS NOT NULL AND has_request_access(auth.uid(), request_id)
    )
  );
