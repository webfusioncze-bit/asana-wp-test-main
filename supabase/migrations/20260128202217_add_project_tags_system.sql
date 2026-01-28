/*
  # Add Project Tags System
  
  1. New Tables
    - `project_tags`
      - `id` (uuid, primary key)
      - `name` (text) - Tag name
      - `color` (text) - Tag color (e.g., '#3b82f6')
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `project_tag_assignments`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects)
      - `tag_id` (uuid, references project_tags)
      - `created_at` (timestamptz)
      - Unique constraint on (project_id, tag_id)
  
  2. Security
    - Enable RLS on both tables
    - Admin and users with 'manage_projects' permission can manage tags
    - All authenticated users can view tags
  
  3. Notes
    - Tags are global and can be used across all projects
    - Multiple tags can be assigned to each project
    - Tags have colors for visual distinction
*/

-- Create project_tags table
CREATE TABLE IF NOT EXISTS project_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create project_tag_assignments table
CREATE TABLE IF NOT EXISTS project_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES project_tags(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, tag_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_tags_name ON project_tags(name);
CREATE INDEX IF NOT EXISTS idx_project_tag_assignments_project ON project_tag_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tag_assignments_tag ON project_tag_assignments(tag_id);

-- Enable RLS
ALTER TABLE project_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_tags

-- Anyone authenticated can view tags
CREATE POLICY "project_tags_select_policy"
  ON project_tags FOR SELECT
  TO authenticated
  USING (true);

-- Admin or users with manage_projects permission can create tags
CREATE POLICY "project_tags_insert_policy"
  ON project_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR 
    has_permission(auth.uid(), 'manage_projects')
  );

-- Admin or users with manage_projects permission can update tags
CREATE POLICY "project_tags_update_policy"
  ON project_tags FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR 
    has_permission(auth.uid(), 'manage_projects')
  )
  WITH CHECK (
    is_admin() OR 
    has_permission(auth.uid(), 'manage_projects')
  );

-- Admin or users with manage_projects permission can delete tags
CREATE POLICY "project_tags_delete_policy"
  ON project_tags FOR DELETE
  TO authenticated
  USING (
    is_admin() OR 
    has_permission(auth.uid(), 'manage_projects')
  );

-- RLS Policies for project_tag_assignments

-- Anyone authenticated can view tag assignments
CREATE POLICY "project_tag_assignments_select_policy"
  ON project_tag_assignments FOR SELECT
  TO authenticated
  USING (true);

-- Admin or users with manage_projects permission can create tag assignments
CREATE POLICY "project_tag_assignments_insert_policy"
  ON project_tag_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR 
    has_permission(auth.uid(), 'manage_projects')
  );

-- Admin or users with manage_projects permission can delete tag assignments
CREATE POLICY "project_tag_assignments_delete_policy"
  ON project_tag_assignments FOR DELETE
  TO authenticated
  USING (
    is_admin() OR 
    has_permission(auth.uid(), 'manage_projects')
  );

-- Add updated_at trigger for project_tags
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_project_tags_updated_at'
  ) THEN
    CREATE TRIGGER update_project_tags_updated_at
      BEFORE UPDATE ON project_tags
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
