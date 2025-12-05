/*
  # Fix Default Folders Trigger to Use Correct User ID

  1. Problem
    - The trigger function uses NEW.id instead of NEW.user_id
    - Since the trigger is on user_roles table, NEW.id refers to the role record ID, not the user ID
    - This causes folders to be created with wrong owner_id

  2. Solution
    - Update the trigger function to use NEW.user_id
    - This ensures folders are created for the correct user

  3. Security
    - Function maintains SECURITY DEFINER
    - RLS bypass only applies within this specific function
*/

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
    is_global,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'Nepřiřazené',
    NEW.user_id,  -- Fixed: Use NEW.user_id instead of NEW.id
    0,
    'tasks',
    '#6B7280',
    false,
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
    is_global,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'Dokončené',
    NEW.user_id,  -- Fixed: Use NEW.user_id instead of NEW.id
    999,
    'tasks',
    '#10B981',
    false,
    now()
  );

  RETURN NEW;
END;
$$;
