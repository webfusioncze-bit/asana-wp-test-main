/*
  # Fix create_completed_folder_for_new_user trigger function

  1. Changes
    - Update function to bypass RLS when creating folder
    - Use SET LOCAL to disable RLS within the function scope
    
  2. Security
    - Function still has SECURITY DEFINER
    - RLS bypass only applies within this specific function
    - Only creates the "Dokončené" folder for new users
*/

-- Recreate the function with RLS bypass
CREATE OR REPLACE FUNCTION public.create_completed_folder_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Temporarily disable RLS for this function
  SET LOCAL row_security = off;
  
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