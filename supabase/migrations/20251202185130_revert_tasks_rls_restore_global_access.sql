/*
  # Vrácení RLS politik pro globální hierarchii
  
  1. Správné chování
    - Globální složka VČETNĚ všech podsložek je veřejná
    - Všichni vidí všechny úkoly v globální hierarchii
    - Mimo globální hierarchii vidí jen své úkoly a přiřazené
  
  2. Vysvětlení viditelnosti
    - Admini vidí VŠE (proto Milan vidí "Report VPV za 11/2025")
    - Běžní uživatelé vidí úkoly v globální hierarchii
    - Běžní uživatelé mimo globální vidí jen své/přiřazené
*/

-- Oprava SELECT policy
DROP POLICY IF EXISTS "Users can view tasks in accessible folders" ON tasks;

CREATE POLICY "Users can view tasks in accessible folders"
ON tasks
FOR SELECT
TO authenticated
USING (
  -- Admini vidí vše
  is_admin() 
  OR
  -- Úkoly v globální složce nebo v její hierarchii vidí VŠICHNI
  (
    folder_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id
      AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
    )
  )
  OR
  -- Úkoly mimo globální hierarchii vidí pouze tvůrce a přiřazený
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

-- Oprava UPDATE policy
DROP POLICY IF EXISTS "Users can update tasks in accessible folders" ON tasks;

CREATE POLICY "Users can update tasks in accessible folders"
ON tasks
FOR UPDATE
TO authenticated
USING (
  is_admin()
  OR
  (
    folder_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id
      AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
    )
  )
  OR
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
  is_admin()
  OR
  (
    folder_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = tasks.folder_id
      AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
    )
  )
  OR
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

COMMENT ON POLICY "Users can view tasks in accessible folders" ON tasks IS 
'Admins see everything. Users see all tasks in global folder hierarchies. Outside global hierarchies, only creator and assigned user can see tasks.';

COMMENT ON POLICY "Users can update tasks in accessible folders" ON tasks IS 
'Admins can update everything. Users can update all tasks in global hierarchies. Outside global hierarchies, only creator and assigned can update.';

COMMENT ON POLICY "Users can delete tasks in accessible folders" ON tasks IS 
'Admins can delete everything. Users can delete all tasks in global hierarchies. Outside global hierarchies, only creator can delete.';