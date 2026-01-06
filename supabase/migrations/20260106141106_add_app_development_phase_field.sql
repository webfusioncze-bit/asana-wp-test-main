/*
  # Add Application Development Phase Field

  1. Changes
    - Add `development_phase` field to `requests` table for tracking application development stage
    - This field identifies application development requests
  
  2. Notes
    - When this field is populated, the request is categorized as "APLIKACE" (Application)
    - Field is nullable to support all request types
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'development_phase'
  ) THEN
    ALTER TABLE requests ADD COLUMN development_phase text;
  END IF;
END $$;
