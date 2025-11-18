/*
  # Rozšíření systému poptávek
  
  ## Nové tabulky
  1. `request_types` - Typy poptávek
    - `id` (uuid, primary key)
    - `name` (text) - Název typu (např. "Tvorba webu", "Redesign")
    - `color` (text) - Barva štítku
    - `created_by` (uuid) - Kdo vytvořil
    - `created_at` (timestamptz)
    
  2. `request_statuses` - Vlastní stavy poptávek
    - `id` (uuid, primary key)
    - `name` (text) - Název stavu
    - `color` (text) - Barva štítku
    - `position` (int) - Pořadí stavů
    - `created_by` (uuid) - Kdo vytvořil
    - `created_at` (timestamptz)
  
  ## Nové sloupce v tabulce requests
  - `request_type_id` (uuid) - Odkaz na typ poptávky
  - `request_status_id` (uuid) - Odkaz na vlastní stav (nahrazuje starý status enum)
  - `page_count` (int) - Počet podstránek
  - `source` (text) - Zdroj poptávky
  - `storage_url` (text) - Odkaz na uložiště
  - `current_website_url` (text) - Aktuální adresa webu
  
  ## Bezpečnost
  - RLS povoluje čtení všem přihlášeným uživatelům
  - Úpravy pouze pro administrátory
*/

-- Vytvoření tabulky request_types
CREATE TABLE IF NOT EXISTS request_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#3B82F6',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE request_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view request types"
  ON request_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert request types"
  ON request_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update request types"
  ON request_types FOR UPDATE
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

CREATE POLICY "Admins can delete request types"
  ON request_types FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Vytvoření tabulky request_statuses
CREATE TABLE IF NOT EXISTS request_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#3B82F6',
  position int DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE request_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view request statuses"
  ON request_statuses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert request statuses"
  ON request_statuses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update request statuses"
  ON request_statuses FOR UPDATE
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

CREATE POLICY "Admins can delete request statuses"
  ON request_statuses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Přidání nových sloupců do requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'requests' AND column_name = 'request_type_id'
  ) THEN
    ALTER TABLE requests ADD COLUMN request_type_id uuid REFERENCES request_types(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'requests' AND column_name = 'request_status_id'
  ) THEN
    ALTER TABLE requests ADD COLUMN request_status_id uuid REFERENCES request_statuses(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'requests' AND column_name = 'page_count'
  ) THEN
    ALTER TABLE requests ADD COLUMN page_count int DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'requests' AND column_name = 'source'
  ) THEN
    ALTER TABLE requests ADD COLUMN source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'requests' AND column_name = 'storage_url'
  ) THEN
    ALTER TABLE requests ADD COLUMN storage_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'requests' AND column_name = 'current_website_url'
  ) THEN
    ALTER TABLE requests ADD COLUMN current_website_url text;
  END IF;
END $$;

-- Vytvoření indexů pro výkon
CREATE INDEX IF NOT EXISTS idx_requests_request_type_id ON requests(request_type_id);
CREATE INDEX IF NOT EXISTS idx_requests_request_status_id ON requests(request_status_id);
CREATE INDEX IF NOT EXISTS idx_request_statuses_position ON request_statuses(position);
