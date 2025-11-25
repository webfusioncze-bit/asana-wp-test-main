/*
  # Přidání oprávnění manage_projects

  1. Změny
    - Rozšíření check constraintu na user_permissions o 'manage_projects'
    - Přidání oprávnění manage_projects pro Milan Vodák
*/

-- Odstranění starého constraintu
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_permission_check;

-- Vytvoření nového constraintu s manage_projects
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_permission_check 
  CHECK (permission IN ('view_requests', 'manage_projects'));

-- Přidání oprávnění manage_projects pro Milan Vodák
INSERT INTO user_permissions (user_id, permission)
VALUES ('e54579aa-3954-40b3-9f9c-69f309b4a631', 'manage_projects')
ON CONFLICT (user_id, permission) DO NOTHING;