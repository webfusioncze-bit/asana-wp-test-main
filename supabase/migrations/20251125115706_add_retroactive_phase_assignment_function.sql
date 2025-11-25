/*
  # Přidání funkce pro zpětné přiřazení uživatelů k fázím

  1. Nová funkce
    - `reassign_phases_by_external_ids` - Zpětně přiřadí uživatele k fázím podle external_id
    - Může být volána adminem pro opravu přiřazení po nastavení external_id

  2. Oprava pro time entries
    - Změnit NOT NULL constraint na user_id v project_time_entries (je to zbytečné)
*/

-- Funkce pro zpětné přiřazení uživatelů k fázím podle external_id
CREATE OR REPLACE FUNCTION reassign_phases_by_external_ids()
RETURNS TABLE (
  phase_id uuid,
  phase_name text,
  external_operator_id text,
  assigned_user_id uuid,
  user_email text
) AS $$
BEGIN
  RETURN QUERY
  WITH phase_updates AS (
    UPDATE project_phases pp
    SET assigned_user_id = (
      SELECT au.id
      FROM auth.users au
      WHERE au.raw_user_meta_data->>'external_id' = pp.external_operator_id
      LIMIT 1
    )
    WHERE pp.external_operator_id IS NOT NULL
    AND pp.assigned_user_id IS NULL
    RETURNING pp.id, pp.name, pp.external_operator_id, pp.assigned_user_id
  )
  SELECT 
    pu.id,
    pu.name,
    pu.external_operator_id,
    pu.assigned_user_id,
    au.email
  FROM phase_updates pu
  LEFT JOIN auth.users au ON au.id = pu.assigned_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Povolit authenticated uživatelům volat tuto funkci (admin check je v edge funkci)
GRANT EXECUTE ON FUNCTION reassign_phases_by_external_ids() TO authenticated;

-- Změnit user_id v time entries na nullable
ALTER TABLE project_time_entries ALTER COLUMN user_id DROP NOT NULL;