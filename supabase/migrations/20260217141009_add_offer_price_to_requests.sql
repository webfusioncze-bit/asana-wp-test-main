/*
  # Add offer price field to requests

  1. Modified Tables
    - `requests`
      - `offer_price` (numeric, nullable) - The price quoted in the offer (cenová nabídka).
        Required when cn_sent_date is filled.

  2. Notes
    - This field tracks how much was quoted to the client when a price offer (CN) was sent.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'offer_price'
  ) THEN
    ALTER TABLE requests ADD COLUMN offer_price numeric DEFAULT NULL;
  END IF;
END $$;
