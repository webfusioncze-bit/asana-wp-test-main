/*
  # Add Time Tracking and Requests System

  1. New Tables
    - `requests` - Poptávky na tvorbu webových stránek
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `client_name` (text)
      - `client_email` (text)
      - `client_phone` (text)
      - `status` (enum: new, in_progress, planning, completed, cancelled)
      - `priority` (enum: low, medium, high, urgent)
      - `estimated_hours` (numeric)
      - `budget` (numeric)
      - `deadline` (timestamptz)
      - `folder_id` (uuid, nullable)
      - `assigned_to` (uuid)
      - `created_by` (uuid)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `request_actions` - Plánování akcí v rámci poptávky
      - `id` (uuid, primary key)
      - `request_id` (uuid)
      - `title` (text)
      - `description` (text)
      - `planned_date` (timestamptz)
      - `completed_date` (timestamptz, nullable)
      - `assigned_to` (uuid)
      - `created_by` (uuid)
      - `position` (integer)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `time_entries` - Vykazování času pro tasky a poptávky
      - `id` (uuid, primary key)
      - `user_id` (uuid)
      - `task_id` (uuid, nullable)
      - `request_id` (uuid, nullable)
      - `description` (text)
      - `hours` (numeric)
      - `date` (date)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to Existing Tables
    - Add `request_id` to `tasks` table to link tasks to requests

  3. Security
    - Enable RLS on all new tables
    - Users can view and edit their own time entries
    - Users can view time entries for tasks/requests they're assigned to
    - Admins can view all time entries
    - Users can view requests they're assigned to or created
    - Admins can view all requests

  4. Important Notes
    - Time tracking allows tracking time spent on both tasks and requests
    - Requests can have multiple tasks linked to them
    - Requests have planning actions (akcje) for organizing work
*/

-- Create request status enum
DO $$ BEGIN
  CREATE TYPE request_status AS ENUM ('new', 'in_progress', 'planning', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create requests table
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  client_name text,
  client_email text,
  client_phone text,
  status request_status DEFAULT 'new',
  priority text DEFAULT 'medium',
  estimated_hours numeric DEFAULT 0,
  budget numeric DEFAULT 0,
  deadline timestamptz,
  folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create request_actions table
CREATE TABLE IF NOT EXISTS request_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  planned_date timestamptz,
  completed_date timestamptz,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create time_entries table
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
  description text DEFAULT '',
  hours numeric NOT NULL CHECK (hours > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT time_entry_has_task_or_request CHECK (
    (task_id IS NOT NULL AND request_id IS NULL) OR
    (task_id IS NULL AND request_id IS NOT NULL)
  )
);

-- Add request_id to tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'request_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN request_id uuid REFERENCES requests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_requests_created_by ON requests(created_by);
CREATE INDEX IF NOT EXISTS idx_requests_folder_id ON requests(folder_id);
CREATE INDEX IF NOT EXISTS idx_request_actions_request_id ON request_actions(request_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_request_id ON time_entries(request_id);
CREATE INDEX IF NOT EXISTS idx_tasks_request_id ON tasks(request_id);

-- Enable RLS
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for requests
CREATE POLICY "Users can view requests they are assigned to or created"
  ON requests FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can insert requests"
  ON requests FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update requests they are assigned to or created"
  ON requests FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can delete requests they created or admins"
  ON requests FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for request_actions
CREATE POLICY "Users can view actions for accessible requests"
  ON request_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_actions.request_id
        AND (
          requests.assigned_to = auth.uid() OR
          requests.created_by = auth.uid() OR
          EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
          )
        )
    )
  );

CREATE POLICY "Users can insert actions for accessible requests"
  ON request_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_actions.request_id
        AND (
          requests.assigned_to = auth.uid() OR
          requests.created_by = auth.uid() OR
          EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
          )
        )
    )
  );

CREATE POLICY "Users can update actions for accessible requests"
  ON request_actions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_actions.request_id
        AND (
          requests.assigned_to = auth.uid() OR
          requests.created_by = auth.uid() OR
          EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_actions.request_id
        AND (
          requests.assigned_to = auth.uid() OR
          requests.created_by = auth.uid() OR
          EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
          )
        )
    )
  );

CREATE POLICY "Users can delete actions for accessible requests"
  ON request_actions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_actions.request_id
        AND (
          requests.assigned_to = auth.uid() OR
          requests.created_by = auth.uid() OR
          EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
          )
        )
    )
  );

-- RLS Policies for time_entries
CREATE POLICY "Users can view own time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can insert own time entries"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own time entries"
  ON time_entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
