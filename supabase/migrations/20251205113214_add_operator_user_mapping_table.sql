/*
  # Create Operator-User Mapping Table

  1. Purpose
    - Stores canonical mapping between external operator IDs and system users
    - Prevents synchronization from creating incorrect user assignments
    - Single source of truth for operator → user relationships
    
  2. Table Structure
    - `external_operator_id` (text): Operator ID from external system
    - `user_id` (uuid): Internal user ID
    - Unique constraint to prevent duplicates
    
  3. Security
    - Enable RLS
    - Only admins can modify mappings
    - All authenticated users can read mappings
*/

-- Create the mapping table
CREATE TABLE IF NOT EXISTS operator_user_mappings (
  external_operator_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE operator_user_mappings ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage operator mappings"
  ON operator_user_mappings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- All authenticated users can read mappings
CREATE POLICY "Authenticated users can view operator mappings"
  ON operator_user_mappings
  FOR SELECT
  TO authenticated
  USING (true);

-- Populate with current canonical mappings
INSERT INTO operator_user_mappings (external_operator_id, user_id)
VALUES
  ('162', '3c9ac692-1944-46cc-81d0-7c78d045c543'),  -- jiri.gerat@webfusion.cz
  ('235', '8be90e62-94c0-4303-8ef9-ca0abe3558de'),  -- dominik.smotek@webfusion.cz
  ('65', 'e54579aa-3954-40b3-9f9c-69f309b4a631'),   -- milan.vodak@webfusion.cz
  ('80', '4f3eccf5-e086-4a31-8ac0-7bdd9f784145'),   -- roman.opet@webfusion.cz
  ('83', '240b507d-0e3e-4179-a29d-545dbd850dcb'),   -- karolina.drlikova@webfusion.cz
  ('86', '35260868-7b1e-4844-88d5-055b30ce256c'),   -- matej.saitz@webfusion.cz
  ('92', '23fa44f9-fd04-4771-b520-52dd4395f5e2')    -- michal.zakostelecky@webfusion.cz
ON CONFLICT (external_operator_id) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_operator_user_mappings_user_id 
  ON operator_user_mappings(user_id);

COMMENT ON TABLE operator_user_mappings IS 
'Canonical mapping between external operator IDs and system users. Used by sync processes to ensure consistent user assignments.';
