/*
  # Add Task Sections (Nadpisy) Structure

  1. New Tables
    - `task_sections`
      - `id` (uuid, primary key)
      - `folder_id` (uuid, foreign key to folders) - sekce patří ke složce
      - `name` (text) - název sekce/nadpisu
      - `position` (integer) - pořadí sekce ve složce
      - `color` (text, nullable) - volitelná barva sekce
      - `created_at` (timestamptz)
      - `created_by` (uuid, foreign key to auth.users)

  2. Changes to Existing Tables
    - Add `section_id` column to `tasks` table for grouping tasks under sections
    - Keep `position` in tasks for ordering within a section

  3. Security
    - Enable RLS on `task_sections` table
    - Add policies for authenticated users based on folder access
    - Users can manage sections in folders they have access to

  4. Important Notes
    - Sections are optional - tasks can exist without a section
    - Sections are scoped to a specific folder
    - Position determines display order within folder
*/

-- Create task_sections table
CREATE TABLE IF NOT EXISTS task_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  color text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add section_id to tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'section_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN section_id uuid REFERENCES task_sections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_task_sections_folder_id ON task_sections(folder_id);
CREATE INDEX IF NOT EXISTS idx_tasks_section_id ON tasks(section_id);

-- Enable RLS
ALTER TABLE task_sections ENABLE ROW LEVEL SECURITY;

-- Policies for task_sections
CREATE POLICY "Users can view sections in accessible folders"
  ON task_sections
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR 
    has_folder_access(auth.uid(), folder_id)
  );

CREATE POLICY "Users can insert sections in accessible folders"
  ON task_sections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    has_folder_access(auth.uid(), folder_id)
  );

CREATE POLICY "Users can update sections in accessible folders"
  ON task_sections
  FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR 
    has_folder_access(auth.uid(), folder_id)
  )
  WITH CHECK (
    is_admin() OR 
    has_folder_access(auth.uid(), folder_id)
  );

CREATE POLICY "Users can delete sections they created"
  ON task_sections
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR 
    is_admin()
  );
