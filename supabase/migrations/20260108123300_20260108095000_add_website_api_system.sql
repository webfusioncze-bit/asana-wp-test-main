/*
  # Add Website API System for Task Manager Integration

  1. New Columns to websites table
    - `api_key` (text, unique) - Persistent API key for Task Manager to authenticate with website
    - `api_key_created_at` (timestamptz) - When the API key was created/last rotated

  2. Security
    - Add unique constraint on api_key
    - Add index for faster API key lookups

  3. Changes
    - Enable Task Manager to authenticate API calls to website plugin
    - Support instant admin login without token expiration
    - Enable real-time website data retrieval without XML feed dependency

  IMPORTANT: This does NOT affect existing functionality (XML feed, ULT tokens, etc.)
*/

-- Add API key columns to websites table
ALTER TABLE websites
ADD COLUMN IF NOT EXISTS api_key text UNIQUE,
ADD COLUMN IF NOT EXISTS api_key_created_at timestamptz;

-- Create index for fast API key lookups
CREATE INDEX IF NOT EXISTS idx_websites_api_key ON websites(api_key) WHERE api_key IS NOT NULL;

-- Function to generate a secure random API key
CREATE OR REPLACE FUNCTION generate_website_api_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_key text;
  key_exists boolean;
BEGIN
  LOOP
    -- Generate a random 64-character hex string
    new_key := encode(gen_random_bytes(32), 'hex');

    -- Check if key already exists
    SELECT EXISTS(SELECT 1 FROM websites WHERE api_key = new_key) INTO key_exists;

    -- Exit loop if key is unique
    EXIT WHEN NOT key_exists;
  END LOOP;

  RETURN new_key;
END;
$$;

-- Function to rotate API key for a website (only admin or owner)
CREATE OR REPLACE FUNCTION rotate_website_api_key(website_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_key text;
  website_owner_id uuid;
BEGIN
  -- Get website owner
  SELECT owner_id INTO website_owner_id FROM websites WHERE id = website_id;

  -- Check if user is admin or owner
  IF NOT (is_admin() OR auth.uid() = website_owner_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admin or website owner can rotate API key';
  END IF;

  -- Generate new API key
  new_key := generate_website_api_key();

  -- Update website with new key
  UPDATE websites
  SET
    api_key = new_key,
    api_key_created_at = now()
  WHERE id = website_id;

  RETURN new_key;
END;
$$;