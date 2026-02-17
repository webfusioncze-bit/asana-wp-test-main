/*
  # Add CN Sent Date to Requests

  1. Changes
    - Add `cn_sent_date` (date) column to `requests` table
    - This tracks when a price quote (cenova nabidka) was sent to the client

  2. Notes
    - NULL means no CN has been sent yet
    - When filled, it should be prominently displayed in the request detail
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'cn_sent_date'
  ) THEN
    ALTER TABLE requests ADD COLUMN cn_sent_date date DEFAULT NULL;
  END IF;
END $$;
