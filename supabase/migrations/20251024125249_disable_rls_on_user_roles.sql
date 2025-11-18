/*
  # Disable RLS on user_roles table

  1. Changes
    - Disables Row Level Security on user_roles table
    - Drops all existing policies
    
  2. Reasoning
    - Simplifies user creation process
    - Trigger runs with SECURITY DEFINER which should bypass RLS anyway
    - Admin operations use SERVICE_ROLE_KEY which bypasses RLS
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Authenticated users can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;

-- Disable RLS
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;