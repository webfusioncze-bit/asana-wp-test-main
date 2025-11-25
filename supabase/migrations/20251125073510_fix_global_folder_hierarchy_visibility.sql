/*
  # Oprava viditelnosti globálních složek a jejich hierarchie

  ## Změny
  
  1. Nová funkce `is_folder_in_global_hierarchy()`
    - Kontroluje, zda je složka nebo některý její rodič globální
    - Umožňuje viditelnost subsložek globálních složek všem uživatelům
  
  2. Aktualizované RLS policies pro složky (folders)
    - SELECT: Uživatelé vidí vlastní + sdílené + globální + subsložky globálních
    - INSERT: Všichni mohou vytvářet subsložky v globálních složkách
    - UPDATE: Všichni mohou upravovat složky v globální hierarchii
    - DELETE: Všichni mohou mazat složky v globální hierarchii
  
  3. Aktualizované RLS policies pro tasky (tasks)
    - SELECT: Uživatelé vidí tasky v přístupných složkách + globálních hierarchiích
    - INSERT: Všichni mohou vytvářet tasky v globálních hierarchiích
    - UPDATE: Všichni mohou upravovat tasky v globálních hierarchiích
    - DELETE: Všichni mohou mazat tasky v globálních hierarchiích
  
  ## Poznámky
  - Privátní složky zůstávají privátní (neviditelné jiným uživatelům)
  - Globální složky a všechny jejich subsložky jsou viditelné všem
  - Všichni uživatelé mohou spravovat obsah globálních složek
*/

-- Vytvořit funkci pro kontrolu globální hierarchie
CREATE OR REPLACE FUNCTION is_folder_in_global_hierarchy(check_folder_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_folder_id uuid;
  folder_record RECORD;
BEGIN
  current_folder_id := check_folder_id;
  
  -- Projít hierarchii složek nahoru
  LOOP
    -- Získat aktuální složku
    SELECT id, parent_id, is_global INTO folder_record
    FROM folders
    WHERE id = current_folder_id;
    
    -- Pokud složka neexistuje, vrátit false
    IF NOT FOUND THEN
      RETURN false;
    END IF;
    
    -- Pokud je složka globální, vrátit true
    IF folder_record.is_global = true THEN
      RETURN true;
    END IF;
    
    -- Pokud nemá rodiče, vrátit false
    IF folder_record.parent_id IS NULL THEN
      RETURN false;
    END IF;
    
    -- Posunout se na rodiče
    current_folder_id := folder_record.parent_id;
  END LOOP;
  
  RETURN false;
END;
$$;

-- ============================================
-- FOLDERS RLS POLICIES
-- ============================================

-- DROP staré policies
DROP POLICY IF EXISTS "Users can view their own folders and shared folders" ON folders;
DROP POLICY IF EXISTS "Users can create folders" ON folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;

-- SELECT: Vidět vlastní + sdílené + globální + subsložky globálních
CREATE POLICY "Users can view their own folders and shared folders"
ON folders FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid() 
  OR has_folder_access(auth.uid(), id) 
  OR is_global = true
  OR is_folder_in_global_hierarchy(id) = true
);

-- INSERT: Vytvářet vlastní složky nebo subsložky v globálních hierarchiích
CREATE POLICY "Users can create folders"
ON folders FOR INSERT
TO authenticated
WITH CHECK (
  (owner_id = auth.uid() AND (is_global = false OR is_admin()))
  OR (parent_id IS NOT NULL AND is_folder_in_global_hierarchy(parent_id) = true)
);

-- UPDATE: Upravovat vlastní složky nebo složky v globálních hierarchiích
CREATE POLICY "Users can update their own folders"
ON folders FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid() 
  OR (is_admin() AND is_global = true)
  OR is_folder_in_global_hierarchy(id) = true
)
WITH CHECK (
  owner_id = auth.uid() 
  OR (is_admin() AND is_global = true)
  OR is_folder_in_global_hierarchy(id) = true
);

-- DELETE: Mazat vlastní složky nebo složky v globálních hierarchiích
CREATE POLICY "Users can delete their own folders"
ON folders FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid() 
  OR (is_admin() AND is_global = true)
  OR is_folder_in_global_hierarchy(id) = true
);

-- ============================================
-- TASKS RLS POLICIES
-- ============================================

-- DROP staré policies
DROP POLICY IF EXISTS "Users can view tasks based on assignment or folder sharing" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks in accessible folders" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks in accessible folders" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in accessible folders" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks they created or are assigned to" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks in accessible folders" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks they created" ON tasks;

-- SELECT: Vidět tasky v přístupných složkách včetně globálních hierarchií
CREATE POLICY "Users can view tasks in accessible folders"
ON tasks FOR SELECT
TO authenticated
USING (
  is_admin()
  OR created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR (folder_id IS NOT NULL AND has_folder_access(auth.uid(), folder_id))
  OR EXISTS (
    SELECT 1
    FROM folders f
    WHERE f.id = tasks.folder_id
    AND (
      f.owner_id = auth.uid()
      OR f.is_global = true
      OR is_folder_in_global_hierarchy(f.id) = true
      OR has_folder_access(auth.uid(), f.id)
    )
  )
);

-- INSERT: Vytvářet tasky v přístupných složkách včetně globálních hierarchií
CREATE POLICY "Users can create tasks in accessible folders"
ON tasks FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    folder_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM folders f
      WHERE f.id = tasks.folder_id
      AND (
        f.owner_id = auth.uid()
        OR f.is_global = true
        OR is_folder_in_global_hierarchy(f.id) = true
        OR has_folder_access(auth.uid(), f.id)
      )
    )
  )
);

-- UPDATE: Upravovat tasky v přístupných složkách včetně globálních hierarchií
CREATE POLICY "Users can update tasks in accessible folders"
ON tasks FOR UPDATE
TO authenticated
USING (
  is_admin()
  OR created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM folders f
    WHERE f.id = tasks.folder_id
    AND (
      f.owner_id = auth.uid()
      OR f.is_global = true
      OR is_folder_in_global_hierarchy(f.id) = true
      OR has_folder_access(auth.uid(), f.id)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM folders f
    WHERE f.id = tasks.folder_id
    AND (
      f.owner_id = auth.uid()
      OR f.is_global = true
      OR is_folder_in_global_hierarchy(f.id) = true
      OR has_folder_access(auth.uid(), f.id)
    )
  )
  OR folder_id IS NULL
);

-- DELETE: Mazat tasky v přístupných složkách včetně globálních hierarchií
CREATE POLICY "Users can delete tasks in accessible folders"
ON tasks FOR DELETE
TO authenticated
USING (
  is_admin()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM folders f
    WHERE f.id = tasks.folder_id
    AND (
      f.owner_id = auth.uid()
      OR f.is_global = true
      OR is_folder_in_global_hierarchy(f.id) = true
      OR has_folder_access(auth.uid(), f.id)
    )
  )
);
