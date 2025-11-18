/*
  # Přidání složky "Dokončené" a opakovaných tasků

  1. Změny
    - Vytvoření speciální složky "Dokončené" pro dokončené tasky
    - Přidání polí pro opakované tasky do tabulky tasks
    - Přidání tabulky pro šablony opakovaných tasků

  2. Nová pole v tabulce tasks
    - `is_recurring` (boolean) - označuje, zda je task opakovaný
    - `recurrence_rule` (text) - pravidlo opakování (daily, weekly, monthly, yearly)
    - `recurrence_interval` (integer) - interval opakování (např. každé 2 dny)
    - `recurrence_end_date` (date) - datum ukončení opakování
    - `parent_recurring_task_id` (uuid) - odkaz na rodičovský opakovaný task
    - `next_occurrence` (timestamptz) - datum příštího výskytu

  3. Bezpečnost
    - RLS policies zůstávají stejné
*/

-- Přidání polí pro opakované tasky do tabulky tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'is_recurring'
  ) THEN
    ALTER TABLE tasks ADD COLUMN is_recurring boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'recurrence_rule'
  ) THEN
    ALTER TABLE tasks ADD COLUMN recurrence_rule text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'recurrence_interval'
  ) THEN
    ALTER TABLE tasks ADD COLUMN recurrence_interval integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'recurrence_end_date'
  ) THEN
    ALTER TABLE tasks ADD COLUMN recurrence_end_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'parent_recurring_task_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN parent_recurring_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'next_occurrence'
  ) THEN
    ALTER TABLE tasks ADD COLUMN next_occurrence timestamptz;
  END IF;
END $$;

-- Vytvoření speciální složky "Dokončené" pro každého existujícího uživatele
DO $$
DECLARE
  user_record RECORD;
  completed_folder_id uuid;
BEGIN
  -- Pro každého uživatele vytvořit složku "Dokončené"
  FOR user_record IN SELECT id FROM auth.users LOOP
    -- Zkontrolovat, zda už složka "Dokončené" existuje
    IF NOT EXISTS (
      SELECT 1 FROM folders 
      WHERE owner_id = user_record.id 
      AND name = 'Dokončené' 
      AND folder_type = 'tasks'
    ) THEN
      -- Vytvořit složku "Dokončené"
      INSERT INTO folders (
        id,
        name,
        owner_id,
        position,
        folder_type,
        color,
        created_at
      ) VALUES (
        gen_random_uuid(),
        'Dokončené',
        user_record.id,
        999, -- Vysoké číslo, aby byla na konci
        'tasks',
        '#10B981', -- Zelená barva
        now()
      );
    END IF;
  END LOOP;
END $$;

-- Vytvořit funkci, která automaticky vytvoří složku "Dokončené" pro nové uživatele
CREATE OR REPLACE FUNCTION create_completed_folder_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO folders (
    id,
    name,
    owner_id,
    position,
    folder_type,
    color,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'Dokončené',
    NEW.id,
    999,
    'tasks',
    '#10B981',
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vytvořit trigger pro automatické vytvoření složky při registraci
DROP TRIGGER IF EXISTS create_completed_folder_trigger ON auth.users;
CREATE TRIGGER create_completed_folder_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_completed_folder_for_new_user();

-- Vytvořit index pro rychlejší vyhledávání opakovaných tasků
CREATE INDEX IF NOT EXISTS idx_tasks_is_recurring ON tasks(is_recurring) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_tasks_next_occurrence ON tasks(next_occurrence) WHERE next_occurrence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at DESC) WHERE completed_at IS NOT NULL;