/*
  # Add Function to Update User Metadata

  1. New Function
    - `update_user_external_id` - Updates external_id in user's raw_user_meta_data
    - Can only be called by admins
    - Uses SECURITY DEFINER to access auth.users table

  2. Security
    - Function checks if caller is admin before allowing update
    - Uses SECURITY DEFINER to bypass RLS on auth.users
*/

-- Function to update user's external_id in raw_user_meta_data
CREATE OR REPLACE FUNCTION update_user_external_id(
  target_user_id uuid,
  new_external_id text
)
RETURNS json AS $$
DECLARE
  current_metadata jsonb;
  updated_metadata jsonb;
  is_admin boolean;
BEGIN
  -- Check if the calling user is an admin
  SELECT (role = 'admin') INTO is_admin
  FROM user_roles
  WHERE user_id = auth.uid();

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can update external IDs';
  END IF;

  -- Get current metadata
  SELECT raw_user_meta_data INTO current_metadata
  FROM auth.users
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Update metadata
  IF current_metadata IS NULL THEN
    current_metadata := '{}'::jsonb;
  END IF;

  IF new_external_id IS NULL OR new_external_id = '' THEN
    -- Remove external_id if empty
    updated_metadata := current_metadata - 'external_id';
  ELSE
    -- Set external_id
    updated_metadata := jsonb_set(
      current_metadata,
      '{external_id}',
      to_jsonb(new_external_id),
      true
    );
  END IF;

  -- Update the user
  UPDATE auth.users
  SET raw_user_meta_data = updated_metadata
  WHERE id = target_user_id;

  RETURN json_build_object(
    'success', true,
    'external_id', new_external_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;