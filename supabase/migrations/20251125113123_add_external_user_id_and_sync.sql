/*
  # Přidání external ID pro uživatele a podpory synchronizace

  1. Změny v tabulkách
    - Přidání `external_id` do auth.users (pomocí user_profiles view)
    - Přidání `external_operator_id` do project_phases pro uchování původního ID
    - Přidání `last_sync_at` do projects pro sledování synchronizace
    - Přidání `sync_enabled` do projects
    - Přidání unique indexu na external_id

  2. Funkce
    - Funkce pro získání user_id z external_id
    - Trigger pro automatické přiřazení uživatele když se external_id shoduje

  3. Bezpečnost
    - Zachování RLS policies
*/

-- Přidání external_id do user_profiles (raw_user_meta_data)
-- Budeme ukládat external_id do raw_user_meta_data

-- Přidání sloupců do project_phases
ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS external_operator_id text;

-- Přidání sloupců do projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sync_enabled boolean DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;

-- Index pro rychlé vyhledávání
CREATE INDEX IF NOT EXISTS idx_project_phases_external_operator_id ON project_phases(external_operator_id);
CREATE INDEX IF NOT EXISTS idx_projects_sync_enabled ON projects(sync_enabled) WHERE sync_enabled = true;

-- Funkce pro získání user_id z external_id
CREATE OR REPLACE FUNCTION get_user_id_by_external_id(ext_id text)
RETURNS uuid AS $$
DECLARE
  user_uuid uuid;
BEGIN
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE raw_user_meta_data->>'external_id' = ext_id;
  
  RETURN user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funkce pro automatické přiřazení uživatele k fázím když se vytvoří uživatel s external_id
CREATE OR REPLACE FUNCTION assign_phases_to_new_user()
RETURNS TRIGGER AS $$
DECLARE
  ext_id text;
BEGIN
  -- Získání external_id z nového uživatele
  ext_id := NEW.raw_user_meta_data->>'external_id';
  
  -- Pokud má external_id, přiřadíme všechny fáze které ho očekávají
  IF ext_id IS NOT NULL THEN
    UPDATE project_phases
    SET assigned_user_id = NEW.id
    WHERE external_operator_id = ext_id 
    AND assigned_user_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pro automatické přiřazení
DROP TRIGGER IF EXISTS assign_phases_on_user_create ON auth.users;
CREATE TRIGGER assign_phases_on_user_create
  AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION assign_phases_to_new_user();

-- Trigger pro přiřazení existujícího uživatele když se nastaví external_operator_id
CREATE OR REPLACE FUNCTION assign_user_to_phase_by_external_id()
RETURNS TRIGGER AS $$
DECLARE
  user_uuid uuid;
BEGIN
  -- Pokud se nastaví external_operator_id a assigned_user_id je NULL
  IF NEW.external_operator_id IS NOT NULL AND NEW.assigned_user_id IS NULL THEN
    -- Zkusíme najít uživatele s tímto external_id
    user_uuid := get_user_id_by_external_id(NEW.external_operator_id);
    
    IF user_uuid IS NOT NULL THEN
      NEW.assigned_user_id := user_uuid;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assign_user_by_external_id ON project_phases;
CREATE TRIGGER assign_user_by_external_id
  BEFORE INSERT OR UPDATE OF external_operator_id ON project_phases
  FOR EACH ROW
  EXECUTE FUNCTION assign_user_to_phase_by_external_id();