/*
  # Add closure_date field to requests

  1. New Column
    - `closure_date` (date) - Date when the request was closed/resolved

  2. Notes
    - Nullable to allow requests that haven't been closed yet
*/

ALTER TABLE requests ADD COLUMN IF NOT EXISTS closure_date date;
