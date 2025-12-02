/*
  # Oprava UPDATE a DELETE politik pro úkoly
  
  1. Změny
    - UPDATE: V globálních složkách mohou upravovat VŠICHNI, mimo ně pouze tvůrce a přiřazený
    - DELETE: V globálních složkách může mazat KAŽDÝ, mimo ně pouze tvůrce
  
  2. Logika
    - Konzistentní s SELECT policy
    - Globální složky = přístupné všem pro úpravu
    - Osobní složky = pouze vlastník/přiřazený může upravit
  
  3. Bezpečnost
    - Admini mají plný přístup
    - Respektuje hierarchii složek
*/

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
  -- V globální složce může upravovat KDOKOLI
  (
    folder_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id
      AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
    )
  )
  OR
  -- Mimo globální složky pouze tvůrce a přiřazený
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
)
WITH CHECK (
  -- Zkontrolovat, že cílová složka je buď NULL, globální, nebo má k ní user přístup
  folder_id IS NULL
  OR EXISTS (
    SELECT 1 FROM folders f
    WHERE f.id = tasks.folder_id
    AND (
      f.is_global = true 
      OR is_folder_in_global_hierarchy(f.id) = true
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
  -- V globální složce může mazat KDOKOLI
  (
    folder_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id
      AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
    )
  )
  OR
  -- Mimo globální složky pouze tvůrce
  (
    created_by = auth.uid()
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

COMMENT ON POLICY "Users can update tasks in accessible folders" ON tasks IS 
'Users can update all tasks in global folders. Outside global folders, only creator and assigned user can update.';

COMMENT ON POLICY "Users can delete tasks in accessible folders" ON tasks IS 
'Users can delete all tasks in global folders. Outside global folders, only creator can delete.';