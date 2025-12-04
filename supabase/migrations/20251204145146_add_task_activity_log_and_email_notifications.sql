/*
  # Task Activity Log and Email Notifications

  1. New Tables
    - `task_activity_log`
      - `id` (uuid, primary key)
      - `task_id` (uuid, foreign key to tasks)
      - `activity_type` (text) - email_sent, status_changed, due_date_changed, assigned_user_changed
      - `old_value` (text) - Previous value (for changes)
      - `new_value` (text) - New value (for changes)
      - `email_sent_to` (text) - Email address if activity_type is email_sent
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamptz)
      - `metadata` (jsonb) - Additional metadata

    - `task_email_notifications`
      - `id` (uuid, primary key)
      - `task_id` (uuid, foreign key to tasks)
      - `user_id` (uuid, foreign key to users)
      - `notification_type` (text) - assignment, reassignment
      - `email_sent` (boolean)
      - `sent_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Triggers
    - Automatically log changes to task status, due_date, and assigned_to
    - Track email notifications to prevent duplicates

  3. Security
    - Enable RLS on both tables
    - Users can view activity logs for tasks they can access
    - Only system can insert activity logs
*/

-- Create task_activity_log table
CREATE TABLE IF NOT EXISTS task_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  old_value text,
  new_value text,
  email_sent_to text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create task_email_notifications table to track sent emails
CREATE TABLE IF NOT EXISTS task_email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  email_sent boolean DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, user_id, notification_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_task_activity_log_task_id ON task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_created_at ON task_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_email_notifications_task_id ON task_email_notifications(task_id);

-- Enable RLS
ALTER TABLE task_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_email_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_activity_log
CREATE POLICY "Users can view activity logs for accessible tasks"
  ON task_activity_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_activity_log.task_id
      AND (
        -- User owns the task
        tasks.assigned_to = auth.uid()
        -- User created the task
        OR tasks.created_by = auth.uid()
        -- User is admin
        OR EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_roles.user_id = auth.uid()
          AND user_roles.role = 'admin'
        )
        -- User has access to the folder
        OR EXISTS (
          SELECT 1 FROM folders
          WHERE folders.id = tasks.folder_id
          AND (
            folders.owner_id = auth.uid()
            OR folders.is_global = true
            OR EXISTS (
              SELECT 1 FROM folder_shares
              WHERE folder_shares.folder_id = folders.id
              AND (
                folder_shares.shared_with_user_id = auth.uid()
                OR folder_shares.shared_with_group_id IN (
                  SELECT group_id FROM user_group_members WHERE user_id = auth.uid()
                )
              )
            )
          )
        )
      )
    )
  );

-- Service role can insert activity logs
CREATE POLICY "Service role can insert activity logs"
  ON task_activity_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Authenticated users can insert activity logs (for manual logging from app)
CREATE POLICY "Authenticated users can insert activity logs"
  ON task_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );

-- RLS Policies for task_email_notifications
CREATE POLICY "Users can view their own email notifications"
  ON task_email_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  ));

CREATE POLICY "Service role can manage email notifications"
  ON task_email_notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to log task changes
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get current user ID (will be NULL for service role operations)
  current_user_id := auth.uid();

  -- Log status changes
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO task_activity_log (task_id, activity_type, old_value, new_value, created_by)
    VALUES (NEW.id, 'status_changed', OLD.status, NEW.status, current_user_id);
  END IF;

  -- Log due date changes
  IF (TG_OP = 'UPDATE' AND OLD.due_date IS DISTINCT FROM NEW.due_date) THEN
    INSERT INTO task_activity_log (task_id, activity_type, old_value, new_value, created_by)
    VALUES (
      NEW.id, 
      'due_date_changed', 
      COALESCE(OLD.due_date::text, 'null'),
      COALESCE(NEW.due_date::text, 'null'),
      current_user_id
    );
  END IF;

  -- Log assigned user changes
  IF (TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    INSERT INTO task_activity_log (task_id, activity_type, old_value, new_value, created_by)
    VALUES (
      NEW.id,
      'assigned_user_changed',
      COALESCE(OLD.assigned_to::text, 'null'),
      COALESCE(NEW.assigned_to::text, 'null'),
      current_user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task changes
DROP TRIGGER IF EXISTS task_changes_logger ON tasks;
CREATE TRIGGER task_changes_logger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_changes();