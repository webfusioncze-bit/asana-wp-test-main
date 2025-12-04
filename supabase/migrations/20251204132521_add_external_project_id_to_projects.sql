/*
  # Add External Project ID to Projects

  1. Changes
    - Add `external_project_id` column to projects table
    - This stores the portal API ID for project synchronization
    - Allows tracking which projects came from the portal
    
  2. Purpose
    - Enable mapping between portal projects and database projects
    - Used by portal sync to identify existing projects
*/

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS external_project_id text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_projects_external_id ON projects(external_project_id);
