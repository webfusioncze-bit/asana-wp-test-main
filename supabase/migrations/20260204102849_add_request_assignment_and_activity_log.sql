/*
  # Request Assignment and Activity Log System

  1. Changes to Existing Tables
    - `requests` table:
      - `assigned_user_id` (uuid, nullable) - The user who has taken ownership of this request
      - This is different from `assigned_to` which tracks task-level assignment

  2. New Tables
    - `request_activity_log`
      - `id` (uuid, primary key)
      - `request_id` (uuid, references requests) - The request this activity belongs to
      - `user_id` (uuid, references auth.users) - The user who performed the action
      - `action_type` (text) - Type of action: 'created', 'assigned', 'unassigned', 'field_changed', 'status_changed', 'note_added', 'task_created'
      - `field_name` (text, nullable) - Name of the field that was changed
      - `old_value` (text, nullable) - Previous value before change
      - `new_value` (text, nullable) - New value after change
      - `metadata` (jsonb, nullable) - Additional data about the action
      - `created_at` (timestamptz) - When the action occurred

  3. Security
    - Enable RLS on `request_activity_log` table
    - Users with 'manage_requests' permission can view and create activity logs
    - Activity logs cannot be updated or deleted (immutable audit trail)
*/

-- Add assigned_user_id column to requests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'assigned_user_id'
  ) THEN
    ALTER TABLE requests ADD COLUMN assigned_user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Create request_activity_log table
CREATE TABLE IF NOT EXISTS request_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  action_type text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_request_activity_log_request_id ON request_activity_log(request_id);
CREATE INDEX IF NOT EXISTS idx_request_activity_log_created_at ON request_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_activity_log_action_type ON request_activity_log(action_type);

-- Enable RLS
ALTER TABLE request_activity_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users with manage_requests can view activity logs" ON request_activity_log;
DROP POLICY IF EXISTS "Users with manage_requests can create activity logs" ON request_activity_log;

-- RLS Policies for request_activity_log
-- Users with manage_requests permission can view activity logs
CREATE POLICY "Users with manage_requests can view activity logs"
  ON request_activity_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_requests'
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Users with manage_requests permission can create activity logs
CREATE POLICY "Users with manage_requests can create activity logs"
  ON request_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_requests'
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Enable realtime for activity log
ALTER PUBLICATION supabase_realtime ADD TABLE request_activity_log;