/*
  # Aktualizace RLS pro tasks s podporou folder sharing

  1. Změny
    - Upravena SELECT policy pro tasks
    - Uživatelé nyní vidí tasky ve složkách, které s nimi byly sdíleny
    - Sdílení složky = sdílení všech tasků v této složce (bez ohledu na assigned_to)
    - Zachováno: admini, assigned_to, created_by vidí své tasky

  2. Logika
    - Admin vidí vše
    - Uživatel vidí tasky, které vytvořil (created_by)
    - Uživatel vidí tasky, které má přiřazené (assigned_to)
    - Uživatel vidí všechny tasky ve složkách, které s ním byly sdíleny (přes folder_shares)
    - Sdílení složky funguje i přes user_groups
*/

-- Drop stará SELECT policy
DROP POLICY IF EXISTS "Users can read tasks they are assigned to or created" ON tasks;

-- Nová SELECT policy s podporou folder sharing
CREATE POLICY "Users can view tasks based on assignment or folder sharing"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    -- Admin vidí vše
    is_admin()
    OR
    -- Uživatel vidí tasky, které vytvořil
    created_by = auth.uid()
    OR
    -- Uživatel vidí tasky, které má přiřazené
    assigned_to = auth.uid()
    OR
    -- Uživatel vidí všechny tasky ve složkách, které byly s ním sdíleny
    (
      folder_id IS NOT NULL
      AND has_folder_access(auth.uid(), folder_id)
    )
  );
