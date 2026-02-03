/*
  # Add request_date and result fields to requests

  1. New Columns
    - `request_date` (date) - Date when the request was received/submitted
    - `result` (text) - Outcome of the request: 'success' (uspech) or 'failure' (neuspech), nullable

  2. Notes
    - request_date defaults to current date
    - result is nullable to allow requests that haven't been resolved yet
*/

ALTER TABLE requests ADD COLUMN IF NOT EXISTS request_date date DEFAULT CURRENT_DATE;

ALTER TABLE requests ADD COLUMN IF NOT EXISTS result text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'requests_result_check'
  ) THEN
    ALTER TABLE requests ADD CONSTRAINT requests_result_check 
      CHECK (result IS NULL OR result IN ('success', 'failure'));
  END IF;
END $$;
