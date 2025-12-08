/*
  # Add Clients Sync to Portal Sync Config

  1. Changes
    - Add clients_portal_url field for clients API endpoint
    - Add clients_sync_enabled flag
    - Add clients_last_sync_at timestamp
    - Add clients_sync_error field for error tracking

  2. Notes
    - Extends portal_sync_config table with clients synchronization support
    - Clients will sync every 15 minutes like websites and projects
*/

-- Add clients sync fields to portal_sync_config
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_sync_config' AND column_name = 'clients_portal_url'
  ) THEN
    ALTER TABLE portal_sync_config 
      ADD COLUMN clients_portal_url text,
      ADD COLUMN clients_sync_enabled boolean DEFAULT false,
      ADD COLUMN clients_last_sync_at timestamptz,
      ADD COLUMN clients_sync_error text;
  END IF;
END $$;