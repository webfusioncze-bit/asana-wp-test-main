/*
  # Add is_taken field to requests for taken/assigned workflow

  1. Changes to Existing Tables
    - `requests` table:
      - `is_taken` (boolean, default false) - Whether the request has been physically taken/accepted by the assigned user
      
  2. Workflow Explanation
    - New request: assigned_user_id = null, is_taken = false
    - Assigned to someone: assigned_user_id = user_id, is_taken = false (user gets email notification)
    - User takes the request: is_taken = true
    - Self-take: assigned_user_id = self, is_taken = true (in one step)
    
  3. Notes
    - A request can be assigned but not taken (pending acceptance)
    - A taken request can be reassigned to another user (is_taken resets to false)
*/

-- Add is_taken column to requests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'is_taken'
  ) THEN
    ALTER TABLE requests ADD COLUMN is_taken boolean DEFAULT false;
  END IF;
END $$;

-- Update existing requests: if they have assigned_user_id, mark them as taken
UPDATE requests SET is_taken = true WHERE assigned_user_id IS NOT NULL AND is_taken IS NULL;

-- Set default for existing null values
UPDATE requests SET is_taken = false WHERE is_taken IS NULL;