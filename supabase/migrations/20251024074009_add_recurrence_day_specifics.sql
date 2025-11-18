/*
  # Přidání polí pro specifikaci konkrétních dnů opakování

  1. Nová pole
    - `recurrence_days_of_week` (integer[]) - pole pro dny v týdnu (0=neděle, 1=pondělí, ..., 6=sobota)
    - `recurrence_day_of_month` (integer) - konkrétní den v měsíci (1-31)
    - `recurrence_month` (integer) - konkrétní měsíc pro roční opakování (1-12)

  2. Příklady použití
    - Každé pondělí: recurrence_rule='weekly', recurrence_days_of_week=[1]
    - Každé pondělí, úterý a středu: recurrence_rule='weekly', recurrence_days_of_week=[1,2,3]
    - 15. den každého měsíce: recurrence_rule='monthly', recurrence_day_of_month=15
    - 30. června každý rok: recurrence_rule='yearly', recurrence_day_of_month=30, recurrence_month=6
*/

-- Přidání polí pro specifikaci dnů opakování
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'recurrence_days_of_week'
  ) THEN
    ALTER TABLE tasks ADD COLUMN recurrence_days_of_week integer[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'recurrence_day_of_month'
  ) THEN
    ALTER TABLE tasks ADD COLUMN recurrence_day_of_month integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'recurrence_month'
  ) THEN
    ALTER TABLE tasks ADD COLUMN recurrence_month integer;
  END IF;
END $$;

-- Přidat constraint pro validaci dnů v týdnu (0-6)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_recurrence_days_of_week_check'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_recurrence_days_of_week_check 
    CHECK (
      recurrence_days_of_week IS NULL OR 
      (
        array_length(recurrence_days_of_week, 1) > 0 AND
        recurrence_days_of_week <@ ARRAY[0,1,2,3,4,5,6]
      )
    );
  END IF;
END $$;

-- Přidat constraint pro validaci dne v měsíci (1-31)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_recurrence_day_of_month_check'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_recurrence_day_of_month_check 
    CHECK (recurrence_day_of_month IS NULL OR (recurrence_day_of_month >= 1 AND recurrence_day_of_month <= 31));
  END IF;
END $$;

-- Přidat constraint pro validaci měsíce (1-12)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_recurrence_month_check'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_recurrence_month_check 
    CHECK (recurrence_month IS NULL OR (recurrence_month >= 1 AND recurrence_month <= 12));
  END IF;
END $$;