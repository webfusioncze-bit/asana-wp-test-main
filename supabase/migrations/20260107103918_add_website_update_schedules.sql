/*
  # Add Website Update Schedules

  1. New Tables
    - `website_update_schedules`
      - `id` (uuid, primary key)
      - `website_id` (uuid, foreign key to websites)
      - `interval_months` (integer) - 1, 2, 3, 6, or 12 months
      - `first_update_date` (date) - date of the first update
      - `is_active` (boolean) - whether the schedule is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, foreign key to auth.users)
    
    - `website_update_instances`
      - `id` (uuid, primary key)
      - `schedule_id` (uuid, foreign key to website_update_schedules)
      - `scheduled_date` (date) - when this update is scheduled
      - `status` (text) - pending, completed, skipped
      - `task_id` (uuid, foreign key to tasks, nullable)
      - `notes` (text)
      - `completed_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users with manage_websites permission
*/

-- Create website_update_schedules table
CREATE TABLE IF NOT EXISTS website_update_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  interval_months integer NOT NULL CHECK (interval_months IN (1, 2, 3, 6, 12)),
  first_update_date date NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create website_update_instances table
CREATE TABLE IF NOT EXISTS website_update_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES website_update_schedules(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  notes text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_website_update_schedules_website_id ON website_update_schedules(website_id);
CREATE INDEX IF NOT EXISTS idx_website_update_schedules_is_active ON website_update_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_website_update_instances_schedule_id ON website_update_instances(schedule_id);
CREATE INDEX IF NOT EXISTS idx_website_update_instances_scheduled_date ON website_update_instances(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_website_update_instances_status ON website_update_instances(status);

-- Enable RLS
ALTER TABLE website_update_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_update_instances ENABLE ROW LEVEL SECURITY;

-- Policies for website_update_schedules
CREATE POLICY "Users with manage_websites can view update schedules"
  ON website_update_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  );

CREATE POLICY "Users with manage_websites can create update schedules"
  ON website_update_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  );

CREATE POLICY "Users with manage_websites can update schedules"
  ON website_update_schedules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  );

CREATE POLICY "Users with manage_websites can delete schedules"
  ON website_update_schedules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  );

-- Policies for website_update_instances
CREATE POLICY "Users with manage_websites can view update instances"
  ON website_update_instances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  );

CREATE POLICY "Users with manage_websites can create update instances"
  ON website_update_instances FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  );

CREATE POLICY "Users with manage_websites can update instances"
  ON website_update_instances FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  );

CREATE POLICY "Users with manage_websites can delete instances"
  ON website_update_instances FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on website_update_schedules
DROP TRIGGER IF EXISTS update_website_update_schedules_updated_at ON website_update_schedules;
CREATE TRIGGER update_website_update_schedules_updated_at
  BEFORE UPDATE ON website_update_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate update instances based on schedule
CREATE OR REPLACE FUNCTION generate_update_instances(
  p_schedule_id uuid,
  p_months_ahead integer DEFAULT 12
)
RETURNS void AS $$
DECLARE
  v_schedule RECORD;
  v_current_date date;
  v_end_date date;
  v_instance_date date;
BEGIN
  -- Get schedule details
  SELECT * INTO v_schedule
  FROM website_update_schedules
  WHERE id = p_schedule_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_current_date := CURRENT_DATE;
  v_end_date := v_current_date + (p_months_ahead || ' months')::interval;
  v_instance_date := v_schedule.first_update_date;

  -- Generate instances from first_update_date to end_date
  WHILE v_instance_date <= v_end_date LOOP
    -- Only insert if instance doesn't already exist and date is in future or current month
    IF v_instance_date >= DATE_TRUNC('month', v_current_date)::date THEN
      INSERT INTO website_update_instances (schedule_id, scheduled_date, status)
      VALUES (p_schedule_id, v_instance_date, 'pending')
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- Add interval_months to get next instance date
    v_instance_date := v_instance_date + (v_schedule.interval_months || ' months')::interval;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint to prevent duplicate instances
CREATE UNIQUE INDEX IF NOT EXISTS idx_website_update_instances_unique 
  ON website_update_instances(schedule_id, scheduled_date);
