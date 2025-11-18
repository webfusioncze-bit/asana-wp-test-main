/*
  # Zapier Webhook Integration

  1. New Tables
    - `zapier_sources`
      - `id` (uuid, primary key) - Unique identifier for each Zapier source
      - `name` (text) - Name/description of the Zapier zap (e.g., "Kontaktní formulář - Homepage")
      - `webhook_token` (text, unique) - Unique token for identifying this source
      - `is_active` (boolean) - Whether this source is active
      - `sample_data` (jsonb) - Sample data from first test request
      - `field_mapping` (jsonb) - Mapping of webhook fields to request fields
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `zapier_webhooks_log`
      - `id` (uuid, primary key)
      - `source_id` (uuid, foreign key to zapier_sources)
      - `payload` (jsonb) - Full incoming webhook payload
      - `request_id` (uuid, nullable, foreign key to requests) - Created request if successful
      - `status` (text) - 'success', 'error', 'pending_mapping'
      - `error_message` (text, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Only admins can view and manage webhook sources
    - Webhook logs are read-only for admins

  3. Notes
    - Field mapping structure: {"webhook_field": "request_field", ...}
    - Sample: {"name": "client_name", "email": "client_email", "message": "description"}
*/

-- Create zapier_sources table
CREATE TABLE IF NOT EXISTS zapier_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  webhook_token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  is_active boolean DEFAULT true,
  sample_data jsonb DEFAULT NULL,
  field_mapping jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create zapier_webhooks_log table
CREATE TABLE IF NOT EXISTS zapier_webhooks_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES zapier_sources(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  request_id uuid REFERENCES requests(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_mapping',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE zapier_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE zapier_webhooks_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for zapier_sources

CREATE POLICY "Admins can view all zapier sources"
  ON zapier_sources FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert zapier sources"
  ON zapier_sources FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update zapier sources"
  ON zapier_sources FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete zapier sources"
  ON zapier_sources FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- RLS Policies for zapier_webhooks_log

CREATE POLICY "Admins can view webhook logs"
  ON zapier_webhooks_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_zapier_sources_webhook_token ON zapier_sources(webhook_token);
CREATE INDEX IF NOT EXISTS idx_zapier_webhooks_log_source_id ON zapier_webhooks_log(source_id);
CREATE INDEX IF NOT EXISTS idx_zapier_webhooks_log_status ON zapier_webhooks_log(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_zapier_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS zapier_sources_updated_at ON zapier_sources;
CREATE TRIGGER zapier_sources_updated_at
  BEFORE UPDATE ON zapier_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_zapier_sources_updated_at();
