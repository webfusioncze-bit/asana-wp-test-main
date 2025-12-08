/*
  # Add Clients and Invoices Management

  1. New Tables
    - `clients`
      - `id` (uuid, primary key)
      - `external_id` (text, unique) - unikatni_id_klienta from API
      - `portal_id` (integer) - ID from portal
      - `name` (text) - Client name
      - `slug` (text) - URL slug
      - `status` (text) - publish status
      - `company_name` (text) - Company name
      - `ic` (text) - IČ
      - `dic` (text) - DIČ
      - `email` (text) - Email
      - `phone` (text) - Phone
      - `street` (text) - Street address
      - `city` (text) - City
      - `postal_code` (text) - Postal code
      - `portal_link` (text) - Link to portal
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `last_sync_at` (timestamptz)
      - `sync_error` (text, nullable)

    - `client_invoices`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to clients)
      - `invoice_number` (text) - Invoice number
      - `invoice_date` (text) - Invoice date
      - `status` (text) - Invoice status (Uhrazena, Po splatnosti, etc.)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `client_websites`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to clients)
      - `website_id` (uuid, foreign key to websites, nullable)
      - `website_url` (text) - URL from API
      - `created_at` (timestamptz)
      - Unique constraint on (client_id, website_url)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users with manage_clients permission
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  portal_id integer UNIQUE,
  name text NOT NULL,
  slug text,
  status text DEFAULT 'publish',
  company_name text,
  ic text,
  dic text,
  email text,
  phone text,
  street text,
  city text,
  postal_code text,
  portal_link text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_sync_at timestamptz,
  sync_error text
);

-- Create client_invoices table
CREATE TABLE IF NOT EXISTS client_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  invoice_number text NOT NULL,
  invoice_date text,
  status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, invoice_number)
);

-- Create client_websites table for linking clients with websites
CREATE TABLE IF NOT EXISTS client_websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  website_id uuid REFERENCES websites(id) ON DELETE SET NULL,
  website_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, website_url)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_external_id ON clients(external_id);
CREATE INDEX IF NOT EXISTS idx_clients_portal_id ON clients(portal_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_client_id ON client_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_client_websites_client_id ON client_websites(client_id);
CREATE INDEX IF NOT EXISTS idx_client_websites_website_id ON client_websites(website_id);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_websites ENABLE ROW LEVEL SECURITY;

-- Policies for clients table
CREATE POLICY "Users with manage_clients can view all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  );

CREATE POLICY "Users with manage_clients can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  );

CREATE POLICY "Users with manage_clients can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  );

CREATE POLICY "Users with manage_clients can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  );

-- Policies for client_invoices table
CREATE POLICY "Users with manage_clients can view all invoices"
  ON client_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  );

CREATE POLICY "Users with manage_clients can insert invoices"
  ON client_invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  );

CREATE POLICY "Users with manage_clients can update invoices"
  ON client_invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  );

CREATE POLICY "Users with manage_clients can delete invoices"
  ON client_invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  );

-- Policies for client_websites table
CREATE POLICY "Users with manage_clients can view all client_websites"
  ON client_websites FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  );

CREATE POLICY "Users with manage_clients can insert client_websites"
  ON client_websites FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  );

CREATE POLICY "Users with manage_clients can update client_websites"
  ON client_websites FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  );

CREATE POLICY "Users with manage_clients can delete client_websites"
  ON client_websites FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_clients'
    )
  );