/*
  # Update User Profiles View to Include External ID

  1. Changes
    - Update `user_profiles` view to include `external_id` from auth.users metadata
    - Extract external_id from raw_user_meta_data JSON field

  2. Security
    - Maintain existing permissions (authenticated, anon can SELECT)
*/

-- Drop and recreate user_profiles view to include external_id
DROP VIEW IF EXISTS user_profiles;

CREATE VIEW user_profiles AS
SELECT
  au.id,
  au.email,
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