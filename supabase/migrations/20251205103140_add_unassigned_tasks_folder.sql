/*
  # Add Unassigned Tasks Folder

  1. New Folder
    - Create "Nepřiřazené" folder for all existing users
    - Position: 0 (first in the list)
    - Color: #6B7280 (gray)
    - Auto-created for new users via trigger

  2. Changes
    - Add trigger to create "Nepřiřazené" folder for new users
    - Create folder for all existing users who don't have it yet

  3. Purpose
    - Tasks without folder_id will be displayed in this special folder
    - Provides a default location for unassigned tasks
*/

-- Create "Nepřiřazené" folder for all existing users who don't have one
DO $$
DECLARE
  user_record RECORD;
BEGIN
  SET LOCAL row_security = off;

  FOR user_record IN
    SELECT DISTINCT ur.user_id
    FROM user_roles ur
    WHERE NOT EXISTS (
      SELECT 1 FROM folders f
      WHERE f.owner_id = ur.user_id
      AND f.name = 'Nepřiřazené'
      AND f.folder_type = 'tasks'
    )
  LOOP
    INSERT INTO folders (
      id,
      name,
      owner_id,
      position,
      folder_type,
      color,
      created_at
    ) VALUES (
      gen_random_uuid(),
      'Nepřiřazené',
      user_record.user_id,
      0,
      'tasks',
      '#6B7280',
      now()
    );
  END LOOP;
END $$;

-- Update the trigger function to also create "Nepřiřazené" folder
CREATE OR REPLACE FUNCTION public.create_default_folders_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL row_security = off;

  -- Create "Nepřiřazené" folder (position 0 - first)
  INSERT INTO folders (
    id,
    name,
    owner_id,
    position,
    folder_type,
    color,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'Nepřiřazené',
    NEW.id,
    0,
    'tasks',
    '#6B7280',
    now()
  );

  -- Create "Dokončené" folder (position 999 - last)
  INSERT INTO folders (
    id,
    name,
    owner_id,
    position,
    folder_type,
    color,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'Dokončené',
    NEW.id,
    999,
    'tasks',
    '#10B981',
    now()
  );

  RETURN NEW;
END;
$$;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS create_completed_folder_on_user_role ON user_roles;

CREATE TRIGGER create_default_folders_on_user_role
AFTER INSERT ON user_roles
FOR EACH ROW
EXECUTE FUNCTION create_default_folders_for_new_user();
