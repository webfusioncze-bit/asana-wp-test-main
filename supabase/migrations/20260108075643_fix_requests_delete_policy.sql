/*
  # Oprava DELETE policy pro requests

  1. Změny
    - Umožnit uživatelům mazat poptávky, které vytvořili
    - Umožnit uživatelům mazat poptávky, které mají přiřazené
    - Umožnit uživatelům s oprávněním view_requests mazat poptávky
    - Admini mohou mazat všechny poptávky

  2. Bezpečnost
    - Poptávky lze mazat jen autorizovanými uživateli
    - Kontrola přístupu pomocí RLS policy
*/

-- Smažeme starou DELETE policy
DROP POLICY IF EXISTS "Admins can delete requests" ON requests;
DROP POLICY IF EXISTS "Users can delete requests they created or admins" ON requests;

-- Vytvoříme novou DELETE policy s rozšířenými právy
CREATE POLICY "Users can delete requests based on permissions"
  ON requests
  FOR DELETE
  TO authenticated
  USING (
    -- Admin může smazat vše
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
    OR
    -- Uživatel s oprávněním view_requests může smazat vše
    has_permission(auth.uid(), 'view_requests')
    OR
    -- Jinak může smazat jen své přiřazené poptávky
    assigned_to = auth.uid()
    OR
    -- Nebo poptávky, které vytvořil
    created_by = auth.uid()
  );
