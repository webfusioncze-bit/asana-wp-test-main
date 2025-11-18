/*
  # Přidání systému oprávnění pro uživatele

  1. Nová tabulka
    - `user_permissions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key na auth.users)
      - `permission` (text, typ oprávnění)
      - `created_at` (timestamptz)
      
  2. Oprávnění
    - `view_requests` - může vidět všechny poptávky bez omezení
    
  3. Security
    - Enable RLS
    - Pouze admini mohou spravovat oprávnění
    - Každý může číst vlastní oprávnění
    
  4. Funkce
    - `has_permission(user_id, permission)` - kontrola oprávnění uživatele
*/

-- Tabulka pro uživatelská oprávnění
CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('view_requests')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, permission)
);

-- Enable RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Admini mohou dělat vše
CREATE POLICY "Admins can manage all permissions"
  ON user_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Policy: Uživatelé mohou číst vlastní oprávnění
CREATE POLICY "Users can read own permissions"
  ON user_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Funkce pro kontrolu oprávnění
CREATE OR REPLACE FUNCTION has_permission(check_user_id uuid, check_permission text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = check_user_id
    AND permission = check_permission
  );
END;
$$;

-- Index pro rychlé vyhledávání
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission);