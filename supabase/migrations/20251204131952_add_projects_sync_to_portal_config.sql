/*
  # Add Projects Sync Configuration

  1. Changes
    - Add columns to `portal_sync_config` for project synchronization
    - `projects_portal_url` - URL for fetching projects list
    - `projects_sync_enabled` - Enable/disable automatic project sync
    - `projects_last_sync_at` - Timestamp of last successful sync
    - `projects_sync_error` - Error message from last sync attempt
    
  2. Purpose
    - Enable synchronization of projects from portal alongside websites
    - Projects will be automatically created/deleted based on portal data
    - Each project will have import_source_url set for detail sync
*/

ALTER TABLE portal_sync_config 
ADD COLUMN IF NOT EXISTS projects_portal_url text,
ADD COLUMN IF NOT EXISTS projects_sync_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS projects_last_sync_at timestamptz,
ADD COLUMN IF NOT EXISTS projects_sync_error text;

UPDATE portal_sync_config
SET 
  projects_portal_url = 'https://portal.webfusion.cz/wp-json/wp/v2/projekt',
  projects_sync_enabled = true
WHERE projects_portal_url IS NULL;
