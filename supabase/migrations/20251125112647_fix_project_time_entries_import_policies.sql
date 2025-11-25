/*
  # Oprava RLS policies pro import časových záznamů

  1. Změny
    - Upravení INSERT policy aby umožňovala vložení záznamů s NULL user_id (při importu)
    - Upravení INSERT policy aby umožňovala admin uživatelům vytvářet záznamy pro jiné uživatele
    - Zachování bezpečnosti pro běžné uživatele

  2. Bezpečnost
    - Běžní uživatelé mohou vytvářet záznamy pouze pro sebe
    - Admin může vytvářet záznamy pro kohokoli
    - Při importu (user_id je NULL) může být záznam vytvořen
*/

-- Odstranění staré INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create time entries" ON project_time_entries;

-- Nová INSERT policy - umožňuje:
-- 1. Uživatelům vytvářet záznamy pro sebe (user_id = auth.uid())
-- 2. Admin vytvářet záznamy pro kohokoli (is_admin())
-- 3. Import s NULL user_id (bude později přiřazeno)
CREATE POLICY "Users can create time entries"
  ON project_time_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    OR user_id IS NULL 
    OR is_admin()
  );

-- Odstranění staré UPDATE policy
DROP POLICY IF EXISTS "Users can update own time entries" ON project_time_entries;

-- Nová UPDATE policy - umožňuje:
-- 1. Uživatelům upravovat vlastní záznamy
-- 2. Admin upravovat jakékoli záznamy
-- 3. Přiřazení user_id k záznamům s NULL (při finalizaci importu)
CREATE POLICY "Users can update time entries"
  ON project_time_entries
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR user_id IS NULL 
    OR is_admin()
  )
  WITH CHECK (
    user_id = auth.uid() 
    OR is_admin()
  );