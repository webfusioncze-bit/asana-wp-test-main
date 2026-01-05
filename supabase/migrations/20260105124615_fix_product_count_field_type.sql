/*
  # Fix Product Count Field Type

  1. Changes
    - Change `product_count` column type from integer to text
    - This allows storing ranges like "50-200" instead of just single numbers
  
  2. Purpose
    - Zapier webhooks can send product count as text ranges (e.g., "50-200")
    - The integer type was causing validation errors
    - Text type provides more flexibility for various input formats
*/

-- Change product_count column type from integer to text
DO $$
BEGIN
  -- First check if column exists and is integer type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' 
    AND column_name = 'product_count'
    AND data_type = 'integer'
  ) THEN
    -- Alter column type to text, converting any existing integer values
    ALTER TABLE requests 
    ALTER COLUMN product_count TYPE text 
    USING product_count::text;
  END IF;
END $$;