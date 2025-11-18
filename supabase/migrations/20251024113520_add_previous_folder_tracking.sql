/*
  # Přidání pole pro sledování původní složky tasku

  1. Změny
    - Přidání pole `previous_folder_id` pro uložení původní složky před dokončením
    - Umožní vrátit task zpět do původní složky při zrušení dokončení

  2. Poznámky
    - Pole se automaticky vyplní při dokončení tasku
    - Při zrušení dokončení se task vrátí do této složky
*/

-- Přidat pole previous_folder_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'previous_folder_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN previous_folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;
  END IF;
END $$;