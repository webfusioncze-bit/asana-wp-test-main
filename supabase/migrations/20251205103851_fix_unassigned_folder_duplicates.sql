/*
  # Fix Unassigned Folder Duplicates

  1. Problem
    - Some users have both "Nepřiřazené" and "Nepřiřazené tasky" folders
    - This creates confusion in the UI

  2. Solution
    - Delete all empty "Nepřiřazené" folders (new ones)
    - Rename all "Nepřiřazené tasky" to "Nepřiřazené"

  3. Result
    - Each user will have only one "Nepřiřazené" folder
    - All existing tasks in "Nepřiřazené tasky" will be preserved
*/

DO $$
BEGIN
  SET LOCAL row_security = off;

  -- Delete all empty "Nepřiřazené" folders
  DELETE FROM folders
  WHERE name = 'Nepřiřazené'
  AND folder_type = 'tasks'
  AND NOT EXISTS (
    SELECT 1 FROM tasks WHERE tasks.folder_id = folders.id
  );

  -- Rename "Nepřiřazené tasky" to "Nepřiřazené"
  UPDATE folders
  SET name = 'Nepřiřazené'
  WHERE name = 'Nepřiřazené tasky'
  AND folder_type = 'tasks';

END $$;
