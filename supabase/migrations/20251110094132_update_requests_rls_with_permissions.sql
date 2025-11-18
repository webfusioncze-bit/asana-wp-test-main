/*
  # Aktualizace RLS pro requests s oprávněními

  1. Úprava RLS politik
    - Uživatelé s oprávněním `view_requests` vidí všechny poptávky
    - Ostatní vidí jen své přiřazené poptávky (assigned_to)
    - Admini vidí vše
    
  2. Poznámky
    - Zachováváme stávající políčka pro INSERT/UPDATE/DELETE
    - Upravujeme jen SELECT policy pro zohlednění oprávnění
*/

-- Smažeme staré SELECT políčko pro requests
DROP POLICY IF EXISTS "Users can view own requests" ON requests;
DROP POLICY IF EXISTS "Users can view requests assigned to them" ON requests;
DROP POLICY IF EXISTS "Users can read requests" ON requests;

-- Nová SELECT policy s podporou oprávnění
CREATE POLICY "Users can view requests based on permissions"
  ON requests
  FOR SELECT
  TO authenticated
  USING (
    -- Admin vidí vše
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
    OR
    -- Uživatel s oprávněním view_requests vidí vše
    has_permission(auth.uid(), 'view_requests')
    OR
    -- Jinak vidí jen své přiřazené poptávky
    assigned_to = auth.uid()
    OR
    -- Nebo poptávky, které vytvořil
    created_by = auth.uid()
  );

-- Ujistěme se, že existují základní políčka pro INSERT/UPDATE/DELETE
DO $$
BEGIN
  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requests' 
    AND policyname = 'Users can create requests'
  ) THEN
    CREATE POLICY "Users can create requests"
      ON requests
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  -- UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requests' 
    AND policyname = 'Users can update own or assigned requests'
  ) THEN
    CREATE POLICY "Users can update own or assigned requests"
      ON requests
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_roles.user_id = auth.uid()
          AND user_roles.role = 'admin'
        )
        OR has_permission(auth.uid(), 'view_requests')
        OR assigned_to = auth.uid()
        OR created_by = auth.uid()
      );
  END IF;

  -- DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requests' 
    AND policyname = 'Admins can delete requests'
  ) THEN
    CREATE POLICY "Admins can delete requests"
      ON requests
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_roles.user_id = auth.uid()
          AND user_roles.role = 'admin'
        )
      );
  END IF;
END $$;