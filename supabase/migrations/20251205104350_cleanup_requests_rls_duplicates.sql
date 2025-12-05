/*
  # Vyčištění duplicitních RLS politik pro requests

  1. Problem
    - Existují duplicitní RLS politiky na tabulce requests
    - Staré i nové politiky jsou aktivní současně
    - To je matoucí a může způsobovat neočekávané chování

  2. Solution
    - Smazat všechny staré politiky
    - Ponechat jen nové politiky, které správně zohledňují oprávnění

  3. Result
    - Uživatelé s oprávněním `view_requests` uvidí všechny poptávky
    - Admini uvidí všechny poptávky
    - Ostatní uvidí jen poptávky, které vytvořili nebo které jim byly přiřazeny
*/

-- Smažeme všechny staré politiky
DROP POLICY IF EXISTS "Users can view requests they are assigned to or created" ON requests;
DROP POLICY IF EXISTS "Users can insert requests" ON requests;
DROP POLICY IF EXISTS "Users can update requests they are assigned to or created" ON requests;
DROP POLICY IF EXISTS "Users can delete requests they created or admins" ON requests;

-- Ujistíme se, že máme správné politiky (ty by měly už existovat z předchozí migrace)
-- SELECT policy už existuje: "Users can view requests based on permissions"
-- INSERT policy už existuje: "Users can create requests"
-- UPDATE policy už existuje: "Users can update own or assigned requests"
-- DELETE policy už existuje: "Admins can delete requests"
