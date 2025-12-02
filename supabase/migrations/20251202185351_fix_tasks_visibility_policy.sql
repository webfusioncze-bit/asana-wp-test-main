/*
  # Oprava viditelnosti úkolů - odstranění admin privilegií
  
  1. Pravidla viditelnosti pro VŠECHNY uživatele (včetně adminů)
    - Vlastní složky a úkoly v nich
    - Vlastní úkoly (created_by)
    - Přiřazené úkoly (assigned_to)
    - Globální složky a všechny úkoly v celé hierarchii
  
  2. Role admin NEMÁ vliv na viditelnost úkolů
    - Admin má stejná práva viditelnosti jako ostatní
    - Admin může mít speciální práva pro MANAGEMENT (ne viditelnost)
*/

-- SELECT policy - odstranění is_admin()
DROP POLICY IF EXISTS "Users can view tasks in accessible folders" ON tasks;

CREATE POLICY "Users can view tasks in accessible folders"
ON tasks
FOR SELECT
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
  -- Úkoly ve sdílených složkách (přes user_groups)
  EXISTS (
    SELECT 1 FROM folders f
    WHERE f.id = tasks.folder_id
    AND has_folder_access(auth.uid(), f.id)
  )
  OR
  -- Úkoly v globální složce nebo její hierarchii
  EXISTS (
    SELECT 1 FROM folders f
    WHERE f.id = tasks.folder_id
    AND (f.is_global = true OR is_folder_in_global_hierarchy(f.id) = true)
  )
);

COMMENT ON POLICY "Users can view tasks in accessible folders" ON tasks IS 
'All users (including admins) see: own tasks, assigned tasks, tasks in own folders, tasks in shared folders, tasks in global folder hierarchies. Admin role does NOT grant additional visibility.';