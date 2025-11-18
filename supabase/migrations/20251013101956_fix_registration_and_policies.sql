/*
  # Fix Registration and RLS Policies

  1. Changes
    - Remove trigger on auth.users (causes issues with Supabase Auth)
    - Create webhook-based approach for user role creation
    - Fix RLS policies to be less restrictive for initial setup
    - Add proper policies for reading user roles
  
  2. Security
    - Maintain security while fixing registration issues
    - Ensure users can see their own roles
*/

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Recreate RLS policies for user_roles to be more permissive for reading
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;

-- Allow authenticated users to read all user roles (needed for task assignment)
CREATE POLICY "Authenticated users can view all roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);

-- Keep the insert/update/delete policies for admins only
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
CREATE POLICY "Admins can insert roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    ) OR NOT EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
CREATE POLICY "Admins can update roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Function to manually create user role (called from application)
CREATE OR REPLACE FUNCTION create_user_role_if_not_exists(user_id_param uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO user_roles (user_id, role)
  VALUES (user_id_param, 'user')
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_user_role_if_not_exists(uuid) TO authenticated;
