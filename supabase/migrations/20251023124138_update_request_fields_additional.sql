/*
  # Update Request Fields

  1. Changes
    - Rename `page_count` column to `subpage_count` (počet podstránek)
    - Change `budget` column type from numeric to text (umožní text i číslo)
    - Add `additional_services` (text) - Další poptávané služby
    - Add `accepted_price` (numeric) - Akceptovaná cena

  2. Notes
    - Existing data in page_count will be preserved
    - Existing numeric budget values will be converted to text
*/

-- Rename page_count to subpage_count
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'page_count'
  ) THEN
    ALTER TABLE requests RENAME COLUMN page_count TO subpage_count;
  END IF;
END $$;

-- Change budget column from numeric to text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'budget' AND data_type = 'numeric'
  ) THEN
    ALTER TABLE requests ALTER COLUMN budget TYPE text USING budget::text;
  END IF;
END $$;

-- Add additional_services column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'additional_services'
  ) THEN
    ALTER TABLE requests ADD COLUMN additional_services text;
  END IF;
END $$;

-- Add accepted_price column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'accepted_price'
  ) THEN
    ALTER TABLE requests ADD COLUMN accepted_price numeric DEFAULT 0;
  END IF;
END $$;
