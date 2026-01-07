/*
  # Update schedule trigger to regenerate instances on edit

  1. Changes
    - Modify trigger to fire on both INSERT and UPDATE
    - When schedule is updated, delete future instances without tasks
    - Regenerate instances for the next 24 months (2 years)
    
  2. Important Notes
    - Only deletes instances that don't have tasks assigned
    - Preserves instances with completed tasks
    - Extends planning horizon from 12 to 24 months
*/

-- Update the trigger function to handle both INSERT and UPDATE
CREATE OR REPLACE FUNCTION trigger_generate_update_instances()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process active schedules
  IF NEW.is_active = true THEN
    -- If this is an UPDATE (not INSERT), delete future instances without tasks
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM website_update_instances
      WHERE schedule_id = NEW.id
        AND scheduled_date >= CURRENT_DATE
        AND task_id IS NULL;
    END IF;
    
    -- Generate instances for the next 24 months (2 years)
    PERFORM generate_update_instances(NEW.id, 24);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger to include UPDATE operations
DROP TRIGGER IF EXISTS auto_generate_update_instances ON website_update_schedules;
CREATE TRIGGER auto_generate_update_instances
  AFTER INSERT OR UPDATE ON website_update_schedules
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_update_instances();