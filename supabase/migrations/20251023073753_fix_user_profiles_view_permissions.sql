/*
  # Fix User Profiles View Permissions

  1. Changes
    - Drop and recreate user_profiles view with proper permissions
    - Grant SELECT to authenticated role
  
  2. Security
    - Allow authenticated users to see basic user info (needed for task assignment)
*/

-- Drop existing view
DROP VIEW IF EXISTS user_profiles;

-- Recreate view with explicit grant
CREATE VIEW user_profiles AS
SELECT 
  id,
  email,
  created_at
FROM auth.users;

-- Grant access to authenticated users
GRANT SELECT ON user_profiles TO authenticated;
GRANT SELECT ON user_profiles TO anon;
