/*
  # Add Folder Types for Tasks and Requests

  1. Changes
    - Add `folder_type` column to `folders` table
    - Can be 'tasks' or 'requests'
    - Default is 'tasks' for backward compatibility
    - Update tasks and requests to only show their respective folders
  
  2. Security
    - Maintain existing RLS policies
*/

-- Add folder_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'folders' AND column_name = 'folder_type'
  ) THEN
    ALTER TABLE folders ADD COLUMN folder_type text DEFAULT 'tasks' CHECK (folder_type IN ('tasks', 'requests'));
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_folders_type ON folders(folder_type);
