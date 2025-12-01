/*
  # Add Websites Management System

  1. New Tables
    - `websites`
      - `id` (uuid, primary key)
      - `url` (text, unique) - Base URL of the website
      - `name` (text) - Display name for the website
      - `owner_id` (uuid) - User who added the website
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `last_sync_at` (timestamptz) - Last successful sync
      - `sync_error` (text) - Last sync error if any
      
    - `website_status`
      - `id` (uuid, primary key)
      - `website_id` (uuid) - References websites
      - `last_updated` (text) - From XML
      - `wordpress_version` (text)
      - `php_version` (text)
      - `mysql_version` (text)
      - `memory_limit` (text)
      - `upload_max_filesize` (text)
      - `num_pages` (integer)
      - `num_posts` (integer)
      - `num_comments` (integer)
      - `num_users` (integer)
      - `num_media_files` (integer)
      - `https_status` (text)
      - `indexing_allowed` (text)
      - `storage_usage` (text)
      - `active_plugins_count` (integer)
      - `inactive_plugins_count` (integer)
      - `update_plugins_count` (integer)
      - `theme_name` (text)
      - `theme_version` (text)
      - `server_load` (text)
      - `uptime` (text)
      - `raw_data` (jsonb) - Store full XML data as JSON
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can view websites they created or have access to
    - Admins can view all websites
    - Only authenticated users can add websites

  3. Notes
    - Websites will be synced every 5 minutes via edge function
    - Status history is kept in website_status table
*/

-- Create websites table
CREATE TABLE IF NOT EXISTS websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text UNIQUE NOT NULL,
  name text NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_sync_at timestamptz,
  sync_error text
);

-- Create website_status table for historical tracking
CREATE TABLE IF NOT EXISTS website_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid REFERENCES websites(id) ON DELETE CASCADE NOT NULL,
  last_updated text,
  wordpress_version text,
  php_version text,
  mysql_version text,
  memory_limit text,
  upload_max_filesize text,
  num_pages integer DEFAULT 0,
  num_posts integer DEFAULT 0,
  num_comments integer DEFAULT 0,
  num_users integer DEFAULT 0,
  num_media_files integer DEFAULT 0,
  https_status text,
  indexing_allowed text,
  storage_usage text,
  active_plugins_count integer DEFAULT 0,
  inactive_plugins_count integer DEFAULT 0,
  update_plugins_count integer DEFAULT 0,
  theme_name text,
  theme_version text,
  server_load text,
  uptime text,
  raw_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_status ENABLE ROW LEVEL SECURITY;

-- Websites policies
CREATE POLICY "Users can view their own websites"
  ON websites FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR owner_id = auth.uid()
  );

CREATE POLICY "Users can create websites"
  ON websites FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own websites"
  ON websites FOR UPDATE
  TO authenticated
  USING (
    is_admin()
    OR owner_id = auth.uid()
  )
  WITH CHECK (
    is_admin()
    OR owner_id = auth.uid()
  );

CREATE POLICY "Users can delete their own websites"
  ON websites FOR DELETE
  TO authenticated
  USING (
    is_admin()
    OR owner_id = auth.uid()
  );

-- Website status policies
CREATE POLICY "Users can view status for accessible websites"
  ON website_status FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM websites
      WHERE websites.id = website_status.website_id
      AND websites.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert website status"
  ON website_status FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM websites
      WHERE websites.id = website_status.website_id
    )
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_website_status_website_id ON website_status(website_id);
CREATE INDEX IF NOT EXISTS idx_website_status_created_at ON website_status(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_websites_owner_id ON websites(owner_id);