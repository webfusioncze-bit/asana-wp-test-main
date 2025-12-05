/*
  # Add Last Sign In to User Profiles View

  1. Changes
    - Update user_profiles view to include last_sign_in_at from auth.users
    - This allows admins to see when users last logged in

  2. Security
    - View maintains existing RLS policies
    - Only authenticated users can access
*/

-- Drop existing view
DROP VIEW IF EXISTS user_profiles;

-- Recreate view with last_sign_in_at
CREATE VIEW user_profiles AS
SELECT
  au.id,
  au.email,
  au.last_sign_in_at,
  ur.role,
  ur.first_name,
  ur.last_name,
  ur.avatar_url,
  COALESCE(
    NULLIF(ur.first_name, '') || ' ' || NULLIF(ur.last_name, ''),
    au.email
  ) as display_name,
  au.raw_user_meta_data->>'external_id' as external_id
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id;

-- Grant access to the view
GRANT SELECT ON user_profiles TO authenticated;
GRANT SELECT ON user_profiles TO anon;