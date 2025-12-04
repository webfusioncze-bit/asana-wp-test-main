/*
  # Add Task Creation and Priority Change Logging

  1. Changes
    - Add task_created activity type to log when tasks are created
    - Add priority_changed activity type to log when task priority changes
    - Create INSERT trigger to log task creation
    - Update existing trigger to log priority changes

  2. Activity Types Added
    - task_created: Logged when a new task is created (captures creation timestamp and creator)
    - priority_changed: Logged when task priority is modified (captures old and new priority values)

  3. Security
    - Uses existing RLS policies for task_activity_log
    - All activity logs are automatically created by triggers
*/

-- Update the log_task_changes function to include priority changes
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

  -- Log priority changes
  IF (TG_OP = 'UPDATE' AND OLD.priority IS DISTINCT FROM NEW.priority) THEN
    INSERT INTO task_activity_log (task_id, activity_type, old_value, new_value, created_by)
    VALUES (
      NEW.id,
      'priority_changed',
      COALESCE(OLD.priority::text, 'null'),
      COALESCE(NEW.priority::text, 'null'),
      current_user_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log task creation
CREATE OR REPLACE FUNCTION log_task_creation()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get current user ID (will be NULL for service role operations)
  current_user_id := COALESCE(auth.uid(), NEW.created_by);

  -- Log task creation
  INSERT INTO task_activity_log (task_id, activity_type, old_value, new_value, created_by, metadata)
  VALUES (
    NEW.id,
    'task_created',
    NULL,
    NEW.title,
    current_user_id,
    jsonb_build_object(
      'priority', COALESCE(NEW.priority, 'medium'),
      'status', COALESCE(NEW.status, 'todo'),
      'assigned_to', NEW.assigned_to
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task creation
DROP TRIGGER IF EXISTS task_creation_logger ON tasks;
CREATE TRIGGER task_creation_logger
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_creation();