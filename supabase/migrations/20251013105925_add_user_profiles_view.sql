/*
  # Add User Profiles View

  1. Changes
    - Create a view that exposes basic user info from auth.users
    - This allows querying user emails without admin API
  
  2. Security
    - Only expose necessary fields (id, email)
    - Authenticated users can view all user profiles (needed for task assignment)
*/

-- Create a view for user profiles
CREATE OR REPLACE VIEW user_profiles AS
SELECT 
  id,
  email,
  created_at
FROM auth.users;

-- Grant access to authenticated users
GRANT SELECT ON user_profiles TO authenticated;

-- Enable RLS
ALTER VIEW user_profiles SET (security_invoker = on);
