/*
  # Add Website Login Token and Availability Tracking

  1. New Columns to websites table
    - `login_token` (text) - Token for direct admin login
    - `is_available` (boolean) - Website availability status
    - `last_check_at` (timestamptz) - Last availability check time
    - `response_time_ms` (integer) - Response time in milliseconds
    - `screenshot_url` (text) - URL to website screenshot/preview
    
  2. New Table for Portal Sync Configuration
    - `portal_sync_config` - Stores portal sync settings
    
  3. Changes
    - Add new columns to track website availability and login tokens
    - Add table for managing portal sync configuration
*/

-- Add new columns to websites table
ALTER TABLE websites 
ADD COLUMN IF NOT EXISTS login_token text,
ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS last_check_at timestamptz,
ADD COLUMN IF NOT EXISTS response_time_ms integer,
ADD COLUMN IF NOT EXISTS screenshot_url text;

-- Create portal sync configuration table
CREATE TABLE IF NOT EXISTS portal_sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_url text NOT NULL,
  is_enabled boolean DEFAULT false,
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on portal_sync_config
ALTER TABLE portal_sync_config ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage portal sync config
CREATE POLICY "Only admins can view portal sync config"
  ON portal_sync_config FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Only admins can insert portal sync config"
  ON portal_sync_config FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Only admins can update portal sync config"
  ON portal_sync_config FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Only admins can delete portal sync config"
  ON portal_sync_config FOR DELETE
  TO authenticated
  USING (is_admin());

-- Add ult field to website_status for login token from XML
ALTER TABLE website_status 
ADD COLUMN IF NOT EXISTS ult text;