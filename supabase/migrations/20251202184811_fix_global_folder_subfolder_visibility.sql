/*
  # Oprava viditelnosti podsložek globálních složek
  
  1. Problém
    - Podsložky globálních složek se chovaly jako globální
    - Úkoly v nich byly viditelné pro všechny
  
  2. Řešení
    - POUZE složky s is_global = true jsou veřejné
    - Jejich podsložky jsou OSOBNÍ
    - Úkoly v podsložkách vidí jen tvůrce a přiřazený
  
  3. Logika
    - Globální složka = přímo označená jako is_global = true
    - Podsložky globálních složek = osobní složky
*/

-- Oprava SELECT policy pro tasks
DROP POLICY IF EXISTS "Users can view tasks in accessible folders" ON tasks;

CREATE POLICY "Users can view tasks in accessible folders"
ON tasks
FOR SELECT
TO authenticated
USING (
  -- Admini vidí vše
  is_admin() 
  OR
  -- Úkoly v PŘÍMO globální složce (is_global = true) vidí VŠICHNI
  (
    folder_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id
      AND f.is_global = true
    )
  )
  OR
  -- Úkoly mimo globální složky (včetně podsložek) vidí pouze tvůrce a přiřazený
  (
    (created_by = auth.uid() OR assigned_to = auth.uid())
    AND (
      folder_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM folders f
        WHERE f.id = tasks.folder_id
        AND f.is_global = true
      )
    )
  )
);

-- Oprava UPDATE policy
DROP POLICY IF EXISTS "Users can update tasks in accessible folders" ON tasks;

CREATE POLICY "Users can update tasks in accessible folders"
ON tasks
FOR UPDATE
TO authenticated
USING (
  -- Admini mohou upravit vše
  is_admin()
  OR
  -- V PŘÍMO globální složce může upravovat KDOKOLI
  (
    folder_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id
      AND f.is_global = true
    )
  )
  OR
  -- V osobních složkách a podsložkách pouze tvůrce a přiřazený
  (
    (created_by = auth.uid() OR assigned_to = auth.uid())
    AND (
      folder_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM folders f
        WHERE f.id = tasks.folder_id
        AND f.is_global = true
      )
    )
  )
)
WITH CHECK (
  -- Zkontrolovat, že cílová složka je přístupná
  folder_id IS NULL
  OR EXISTS (
    SELECT 1 FROM folders f
    WHERE f.id = tasks.folder_id
    AND (
      f.is_global = true 
      OR f.owner_id = auth.uid()
      OR has_folder_access(auth.uid(), f.id)
    )
  )
);

-- Oprava DELETE policy
DROP POLICY IF EXISTS "Users can delete tasks in accessible folders" ON tasks;

CREATE POLICY "Users can delete tasks in accessible folders"
ON tasks
FOR DELETE
TO authenticated
USING (
  -- Admini mohou smazat vše
  is_admin()
  OR
  -- V PŘÍMO globální složce může mazat KDOKOLI
  (
    folder_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id
      AND f.is_global = true
    )
  )
  OR
  -- V osobních složkách a podsložkách pouze tvůrce
  (
    created_by = auth.uid()
    AND (
      folder_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM folders f
        WHERE f.id = tasks.folder_id
        AND f.is_global = true
      )
    )
  )
);

COMMENT ON POLICY "Users can view tasks in accessible folders" ON tasks IS 
'Users can see all tasks ONLY in directly global folders (is_global=true). Subfolders of global folders are treated as personal - only creator and assigned user can see tasks.';

COMMENT ON POLICY "Users can update tasks in accessible folders" ON tasks IS 
'Users can update all tasks ONLY in directly global folders. Subfolders are personal - only creator and assigned can update.';

COMMENT ON POLICY "Users can delete tasks in accessible folders" ON tasks IS 
'Users can delete all tasks ONLY in directly global folders. Subfolders are personal - only creator can delete.';