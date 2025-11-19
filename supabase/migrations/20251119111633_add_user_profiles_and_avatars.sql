/*
  # Add User Profiles and Avatar Support

  1. Storage
    - Create `avatars` bucket for profile pictures
    - Set up RLS policies for avatar access

  2. Schema Changes
    - Add `first_name` column to store user's first name
    - Add `last_name` column to store user's last name
    - Add `avatar_url` column to store profile picture URL

  3. Security
    - Users can upload their own avatars
    - Users can view all avatars (for displaying in UI)
    - Users can only delete their own avatars
*/

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Anyone can view avatars"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Add columns for user profile information
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN first_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN last_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN avatar_url text;
  END IF;
END $$;

-- Drop and recreate user_profiles view to include new fields
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
  ) as display_name
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id;

-- Grant access to the view
GRANT SELECT ON user_profiles TO authenticated;
GRANT SELECT ON user_profiles TO anon;
