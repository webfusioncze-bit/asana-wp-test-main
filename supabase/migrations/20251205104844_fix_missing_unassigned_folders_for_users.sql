/*
  # Fix Missing Unassigned Folders for Users

  1. Problem
    - Multiple users don't have the "Nepřiřazené" folder
    - This causes tasks with folder_id = NULL to be invisible
    - Users created before the trigger was updated don't have this folder

  2. Solution
    - Create "Nepřiřazené" folder for all users who don't have it
    - Set position to 0 (first in list)
    - Use gray color (#6B7280)

  3. Result
    - All users will have "Nepřiřazené" folder
    - Tasks without folder will be visible in this folder
*/

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
      is_global,
      created_at
    ) VALUES (
      gen_random_uuid(),
      'Nepřiřazené',
      user_record.user_id,
      0,
      'tasks',
      '#6B7280',
      false,
      now()
    );
  END LOOP;
END $$;
