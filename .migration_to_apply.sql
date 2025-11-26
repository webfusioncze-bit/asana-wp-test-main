/*
  # Oprava funkce pro zpětné přiřazení - aktualizace time entries

  1. Změny
    - Funkce reassign_phases_by_external_ids nyní TAKÉ aktualizuje user_id u time entries
    - Time entries s NULL user_id se nastaví na assigned_user_id z fáze
    - Vrací i počet aktualizovaných time entries

  2. Důvod
    - Když importujeme projekt bez přiřazených uživatelů, time entries mají user_id = NULL
    - Po přiřazení uživatele k fázi je potřeba aktualizovat i všechny jeho time entries
    - Pak se v UI zobrazí správný uživatel místo "Neznámý uživatel"
*/

-- Rozšířit návratový typ o počet aktualizovaných time entries
CREATE OR REPLACE FUNCTION reassign_phases_by_external_ids()
RETURNS TABLE (
  phase_id uuid,
  phase_name text,
  external_operator_id text,
  assigned_user_id uuid,
  user_email text,
  time_entries_updated integer
) AS $$
DECLARE
  v_phase record;
  v_time_entries_count integer;
BEGIN
  -- Projít všechny fáze s external_operator_id, které ještě nemají přiřazeného uživatele
  FOR v_phase IN
    SELECT 
      pp.id,
      pp.name,
      pp.external_operator_id,
      au.id as new_user_id,
      au.email
    FROM project_phases pp
    LEFT JOIN auth.users au ON au.raw_user_meta_data->>'external_id' = pp.external_operator_id
    WHERE pp.external_operator_id IS NOT NULL
    AND pp.assigned_user_id IS NULL
  LOOP
    -- Aktualizovat fázi
    UPDATE project_phases
    SET assigned_user_id = v_phase.new_user_id
    WHERE id = v_phase.id;

    -- Aktualizovat time entries pro tuto fázi (pouze ty s NULL user_id)
    UPDATE project_time_entries
    SET user_id = v_phase.new_user_id
    WHERE phase_id = v_phase.id
    AND user_id IS NULL
    AND v_phase.new_user_id IS NOT NULL;

    -- Spočítat kolik time entries bylo aktualizováno
    GET DIAGNOSTICS v_time_entries_count = ROW_COUNT;

    -- Vrátit výsledek pro tuto fázi
    RETURN QUERY
    SELECT 
      v_phase.id::uuid,
      v_phase.name::text,
      v_phase.external_operator_id::text,
      v_phase.new_user_id::uuid,
      COALESCE(v_phase.email::text, '')::text,
      v_time_entries_count::integer;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Povolit authenticated uživatelům volat tuto funkci
GRANT EXECUTE ON FUNCTION reassign_phases_by_external_ids() TO authenticated;
