/*
  # Oprava viditelnosti úkolů podle požadavků
  
  1. Změny
    - Úkoly v globálních složkách vidí VŠICHNI uživatelé
    - Úkoly mimo globální složky vidí pouze:
      - Vlastník úkolu (created_by)
      - Přiřazený uživatel (assigned_to)
      - Admini (is_admin)
  
  2. Logika
    - Pokud je úkol v globální složce nebo její podsložce -> viditelný pro všechny
    - Pokud NENÍ v globální složce -> viditelný pouze pro tvůrce a přiřazeného
  
  3. Bezpečnost
    - RLS policy RESTRICTIVE přístup
    - Globální složky jsou přístupné všem
    - Osobní složky jsou přístupné pouze relevantním uživatelům
*/

-- Zrušit existující SELECT policy na tasks
DROP POLICY IF EXISTS "Users can view tasks in accessible folders" ON tasks;

-- Vytvořit novou, správnou policy
CREATE POLICY "Users can view tasks in accessible folders"
ON tasks
FOR SELECT
TO authenticated
USING (
  -- Admini vidí vše
  is_admin() 
  OR
  -- Úkoly v globální složce (nebo v její hierarchii) vidí VŠICHNI
  (
    folder_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id
      AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
    )
  )
  OR
  -- Úkoly MIMO globální složky vidí pouze tvůrce a přiřazený
  (
    (created_by = auth.uid() OR assigned_to = auth.uid())
    AND (
      folder_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM folders f
        WHERE f.id = tasks.folder_id
        AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
      )
    )
  )
);

COMMENT ON POLICY "Users can view tasks in accessible folders" ON tasks IS 
'Users can see all tasks in global folders. Outside global folders, users can only see their own tasks and tasks assigned to them.';