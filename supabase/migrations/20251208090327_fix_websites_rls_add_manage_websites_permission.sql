/*
  # Oprava RLS politik pro websites - přidání podpory pro manage_websites oprávnění

  1. Problém
    - Uživatelé s oprávněním 'manage_websites' nevidí žádné weby
    - SELECT policy dovoluje vidět jen vlastní weby nebo pokud je uživatel admin
    - Chybí kontrola oprávnění 'manage_websites' v SELECT policy
    
  2. Řešení
    - Aktualizovat SELECT policy pro websites, aby zahrnovala uživatele s oprávněním 'manage_websites'
    - Uživatelé s oprávněním 'manage_websites' budou moci vidět všechny weby
    
  3. Poznámky
    - Podobné jako u projektů - uživatelé s oprávněním mohou vidět všechny záznamy
*/

-- Odstranění staré SELECT policy
DROP POLICY IF EXISTS "Users can view their own websites" ON websites;

-- Nová SELECT policy s podporou manage_websites oprávnění
CREATE POLICY "Users can view websites with permission"
  ON websites
  FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  );

-- Aktualizace INSERT policy - přidat podporu pro manage_websites
DROP POLICY IF EXISTS "Users can create websites" ON websites;

CREATE POLICY "Users can create websites with permission"
  ON websites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  );

-- Aktualizace UPDATE policy
DROP POLICY IF EXISTS "Users can update their own websites" ON websites;

CREATE POLICY "Users can update websites with permission"
  ON websites
  FOR UPDATE
  TO authenticated
  USING (
    is_admin()
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  )
  WITH CHECK (
    is_admin()
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  );

-- Aktualizace DELETE policy
DROP POLICY IF EXISTS "Users can delete their own websites" ON websites;

CREATE POLICY "Users can delete websites with permission"
  ON websites
  FOR DELETE
  TO authenticated
  USING (
    is_admin()
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  );

-- Aktualizace SELECT policy pro website_status
DROP POLICY IF EXISTS "Users can view status for accessible websites" ON website_status;

CREATE POLICY "Users can view status with permission"
  ON website_status
  FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM websites
      WHERE websites.id = website_status.website_id
      AND websites.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_permissions.user_id = auth.uid()
      AND user_permissions.permission = 'manage_websites'
    )
  );
