/*
  # Add trigger to auto-generate update instances

  1. Changes
    - Create trigger that automatically generates update instances when a new schedule is created
    - Calls the generate_update_instances function for the new schedule
  
  2. Important Notes
    - Instances are generated for the next 12 months
    - Only active schedules trigger instance generation
*/

-- Trigger function to auto-generate instances after schedule insert
CREATE OR REPLACE FUNCTION trigger_generate_update_instances()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate instances for active schedules
  IF NEW.is_active = true THEN
    PERFORM generate_update_instances(NEW.id, 12);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on website_update_schedules
DROP TRIGGER IF EXISTS auto_generate_update_instances ON website_update_schedules;
CREATE TRIGGER auto_generate_update_instances
  AFTER INSERT ON website_update_schedules
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_update_instances();
