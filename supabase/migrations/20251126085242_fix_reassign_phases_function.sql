/*
  # Oprava funkce pro zpětné přiřazení uživatelů k fázím

  1. Změny
    - Opravena návratová struktura funkce reassign_phases_by_external_ids
    - Upraveny typy sloupců aby odpovídaly skutečnému výstupu
    - Explicitní CAST pro email na text
*/

-- Přepsat funkci s opravenými typy
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
    RETURNING pp.id AS phase_id, pp.name AS phase_name, pp.external_operator_id, pp.assigned_user_id
  )
  SELECT 
    pu.phase_id::uuid,
    pu.phase_name::text,
    pu.external_operator_id::text,
    pu.assigned_user_id::uuid,
    COALESCE(au.email::text, '')::text AS user_email
  FROM phase_updates pu
  LEFT JOIN auth.users au ON au.id = pu.assigned_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
