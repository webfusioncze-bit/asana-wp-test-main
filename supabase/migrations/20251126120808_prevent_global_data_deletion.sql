/*
  # Ochrana globálních dat před smazáním s uživatelem

  1. Změny
    - Upraví foreign key constraint pro folders.owner_id na SET NULL místo CASCADE
    - Upraví foreign key constraint pro categories.owner_id na SET NULL
    - Upraví foreign key constraint pro request_types.created_by na SET NULL
    - Upraví foreign key constraint pro request_statuses.created_by na SET NULL
    - Povolí NULL hodnoty pro owner_id/created_by u těchto tabulek

  2. Důvod
    - Globální složky a systémové nastavení NESMÍ zmizet při smazání uživatele
    - Při smazání uživatele se jeho globální data zachovají, pouze se owner_id/created_by nastaví na NULL
*/

-- Upravit folders tabulku - povolit NULL pro owner_id
ALTER TABLE folders ALTER COLUMN owner_id DROP NOT NULL;

-- Odstranit starý constraint a přidat nový s SET NULL
ALTER TABLE folders DROP CONSTRAINT IF EXISTS folders_owner_id_fkey;
ALTER TABLE folders ADD CONSTRAINT folders_owner_id_fkey
  FOREIGN KEY (owner_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- Upravit categories tabulku
ALTER TABLE categories ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_owner_id_fkey;
ALTER TABLE categories ADD CONSTRAINT categories_owner_id_fkey
  FOREIGN KEY (owner_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- Upravit request_types tabulku
ALTER TABLE request_types ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE request_types DROP CONSTRAINT IF EXISTS request_types_created_by_fkey;
ALTER TABLE request_types ADD CONSTRAINT request_types_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- Upravit request_statuses tabulku
ALTER TABLE request_statuses ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE request_statuses DROP CONSTRAINT IF EXISTS request_statuses_created_by_fkey;
ALTER TABLE request_statuses ADD CONSTRAINT request_statuses_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- Aktualizovat RLS policies pro folders s NULL owner_id
DROP POLICY IF EXISTS "Users can view their own folders and shared folders" ON folders;
CREATE POLICY "Users can view their own folders and shared folders"
  ON folders FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    owner_id IS NULL OR
    has_folder_access(auth.uid(), id) OR
    is_global = true
  );

-- Policy pro vkládání složek
DROP POLICY IF EXISTS "Admins can create global folders" ON folders;
CREATE POLICY "Admins can create global folders"
  ON folders FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_global = true AND is_admin()) OR
    (is_global = false AND owner_id = auth.uid())
  );

-- Policy pro aktualizaci složek
DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
CREATE POLICY "Users can update their own folders"
  ON folders FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    (is_global = true AND is_admin()) OR
    (owner_id IS NULL AND is_admin())
  )
  WITH CHECK (
    owner_id = auth.uid() OR
    (is_global = true AND is_admin()) OR
    (owner_id IS NULL AND is_admin())
  );

-- Policy pro mazání složek
DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;
CREATE POLICY "Users can delete their own folders"
  ON folders FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    (is_global = true AND is_admin()) OR
    (owner_id IS NULL AND is_admin())
  );

-- Aktualizovat policies pro categories s NULL owner_id
DROP POLICY IF EXISTS "Users can view their own categories" ON categories;
CREATE POLICY "Users can view their own categories"
  ON categories FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR owner_id IS NULL);

DROP POLICY IF EXISTS "Users can insert their own categories" ON categories;
CREATE POLICY "Users can insert their own categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own categories" ON categories;
CREATE POLICY "Users can update their own categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR (owner_id IS NULL AND is_admin()))
  WITH CHECK (owner_id = auth.uid() OR (owner_id IS NULL AND is_admin()));

DROP POLICY IF EXISTS "Users can delete their own categories" ON categories;
CREATE POLICY "Users can delete their own categories"
  ON categories FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR (owner_id IS NULL AND is_admin()));