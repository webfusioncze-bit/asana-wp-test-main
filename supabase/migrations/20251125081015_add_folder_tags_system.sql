/*
  # Add Folder Tags System

  1. New Tables
    - `folder_tags`
      - `id` (uuid, primary key)
      - `folder_id` (uuid, references folders)
      - `name` (text, tag name)
      - `color` (text, hex color)
      - `position` (integer, for ordering)
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

    - `task_tags`
      - `id` (uuid, primary key)
      - `task_id` (uuid, references tasks)
      - `tag_id` (uuid, references folder_tags)
      - `created_at` (timestamptz)
      - Unique constraint on (task_id, tag_id)

  2. Security
    - Enable RLS on both tables
    - Users can view tags in folders they have access to
    - Users can manage tags in folders they own or global folders
    - Users can assign tags to tasks they can edit

  3. Important Notes
    - Tags are scoped to folders (folder-specific)
    - Each tag has a color for visual distinction
    - Tags can be reordered via position field
    - Task can have multiple tags
*/

-- Create folder_tags table
CREATE TABLE IF NOT EXISTS folder_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create task_tags junction table
CREATE TABLE IF NOT EXISTS task_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES folder_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, tag_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_folder_tags_folder_id ON folder_tags(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_tags_position ON folder_tags(folder_id, position);
CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);

-- Enable RLS
ALTER TABLE folder_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for folder_tags

-- SELECT: Users can view tags in folders they have access to
CREATE POLICY "Users can view tags in accessible folders"
  ON folder_tags
  FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR has_folder_access(auth.uid(), folder_id)
    OR EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = folder_tags.folder_id
      AND (
        f.is_global = true
        OR is_folder_in_global_hierarchy(f.id) = true
      )
    )
  );

-- INSERT: Users can create tags in folders they own or global folders
CREATE POLICY "Users can create tags in owned or global folders"
  ON folder_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = folder_tags.folder_id
      AND (
        (f.owner_id = auth.uid() AND has_folder_access(auth.uid(), f.id))
        OR f.is_global = true
        OR is_folder_in_global_hierarchy(f.id) = true
      )
    )
  );

-- UPDATE: Users can update tags in folders they own or global folders
CREATE POLICY "Users can update tags in owned or global folders"
  ON folder_tags
  FOR UPDATE
  TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = folder_tags.folder_id
      AND (
        (f.owner_id = auth.uid() AND has_folder_access(auth.uid(), f.id))
        OR f.is_global = true
        OR is_folder_in_global_hierarchy(f.id) = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = folder_tags.folder_id
      AND (
        (f.owner_id = auth.uid() AND has_folder_access(auth.uid(), f.id))
        OR f.is_global = true
        OR is_folder_in_global_hierarchy(f.id) = true
      )
    )
  );

-- DELETE: Users can delete tags in folders they own or global folders
CREATE POLICY "Users can delete tags in owned or global folders"
  ON folder_tags
  FOR DELETE
  TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = folder_tags.folder_id
      AND (
        (f.owner_id = auth.uid() AND has_folder_access(auth.uid(), f.id))
        OR f.is_global = true
        OR is_folder_in_global_hierarchy(f.id) = true
      )
    )
  );

-- RLS Policies for task_tags

-- SELECT: Users can view task tags if they can view the task
CREATE POLICY "Users can view task tags for accessible tasks"
  ON task_tags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_tags.task_id
      AND (
        t.assigned_to = auth.uid()
        OR t.created_by = auth.uid()
        OR has_folder_access(auth.uid(), t.folder_id)
        OR is_admin()
        OR EXISTS (
          SELECT 1 FROM folders f
          WHERE f.id = t.folder_id
          AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
        )
      )
    )
  );

-- INSERT: Users can assign tags to tasks they can edit
CREATE POLICY "Users can assign tags to editable tasks"
  ON task_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_tags.task_id
      AND (
        t.assigned_to = auth.uid()
        OR t.created_by = auth.uid()
        OR has_folder_access(auth.uid(), t.folder_id)
        OR is_admin()
        OR EXISTS (
          SELECT 1 FROM folders f
          WHERE f.id = t.folder_id
          AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
        )
      )
    )
  );

-- DELETE: Users can remove tags from tasks they can edit
CREATE POLICY "Users can remove tags from editable tasks"
  ON task_tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_tags.task_id
      AND (
        t.assigned_to = auth.uid()
        OR t.created_by = auth.uid()
        OR has_folder_access(auth.uid(), t.folder_id)
        OR is_admin()
        OR EXISTS (
          SELECT 1 FROM folders f
          WHERE f.id = t.folder_id
          AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
        )
      )
    )
  );
