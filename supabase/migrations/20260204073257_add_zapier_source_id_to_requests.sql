/*
  # Add Zapier Source ID to Requests

  1. New Fields
    - `zapier_source_id` (uuid) - Reference to zapier_sources table for tracking which integration created the request

  2. Notes
    - Field is optional (nullable) as not all requests come from Zapier
    - Allows identifying email-based requests for special display handling
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'zapier_source_id'
  ) THEN
    ALTER TABLE requests ADD COLUMN zapier_source_id uuid REFERENCES zapier_sources(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_requests_zapier_source_id ON requests(zapier_source_id);
