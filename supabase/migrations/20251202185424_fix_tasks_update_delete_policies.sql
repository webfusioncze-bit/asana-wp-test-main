/*
  # Oprava UPDATE a DELETE politik bez admin privilegií
  
  1. UPDATE pravidla
    - Vlastní úkoly nebo přiřazené úkoly
    - Úkoly ve vlastních nebo sdílených složkách
    - Úkoly v globální hierarchii
  
  2. DELETE pravidla
    - Pouze vlastní úkoly
    - Úkoly ve vlastních složkách
    - Úkoly v globální hierarchii
*/

-- UPDATE policy - odstranění is_admin()
DROP POLICY IF EXISTS "Users can update tasks in accessible folders" ON tasks;

CREATE POLICY "Users can update tasks in accessible folders"
ON tasks
FOR UPDATE
TO authenticated
USING (
  -- Vlastní úkoly nebo přiřazené úkoly
  created_by = auth.uid() 
  OR assigned_to = auth.uid()
  OR
  -- Úkoly ve vlastních složkách
  EXISTS (
    SELECT 1 FROM folders f
    WHERE f.id = tasks.folder_id
    AND f.owner_id = auth.uid()
  )
  OR
  -- Úkoly ve sdílených složkách
  EXISTS (
    SELECT 1 FROM folders f
    WHERE f.id = tasks.folder_id
    AND has_folder_access(auth.uid(), f.id)
  )
  OR
  -- Úkoly v globální hierarchii
  EXISTS (
    SELECT 1 FROM folders f
    WHERE f.id = tasks.folder_id
    AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
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

-- DELETE policy - odstranění is_admin()
DROP POLICY IF EXISTS "Users can delete tasks in accessible folders" ON tasks;

CREATE POLICY "Users can delete tasks in accessible folders"
ON tasks
FOR DELETE
TO authenticated
USING (
  -- Pouze vlastní úkoly
  created_by = auth.uid()
  OR
  -- Úkoly ve vlastních složkách
  EXISTS (
    SELECT 1 FROM folders f
    WHERE f.id = tasks.folder_id
    AND f.owner_id = auth.uid()
  )
  OR
  -- Úkoly v globální hierarchii (kdokoli může smazat)
  EXISTS (
    SELECT 1 FROM folders f
    WHERE f.id = tasks.folder_id
    AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
  )
);

COMMENT ON POLICY "Users can update tasks in accessible folders" ON tasks IS 
'All users can update: own tasks, assigned tasks, tasks in own/shared folders, tasks in global hierarchies. No admin privileges.';

COMMENT ON POLICY "Users can delete tasks in accessible folders" ON tasks IS 
'All users can delete: own tasks, tasks in own folders, tasks in global hierarchies. No admin privileges.';