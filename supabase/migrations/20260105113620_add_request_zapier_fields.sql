/*
  # Add Zapier Integration Fields to Requests

  1. New Fields
    - `delivery_speed` (text) - Rychlost dodání
    - `ai_usage` (text) - Využití AI
    - `project_materials_link` (text) - Podklady k projektu (odkaz)
  
  2. Notes
    - All fields are optional (nullable)
    - Fields support Zapier integration mapping
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'delivery_speed'
  ) THEN
    ALTER TABLE requests ADD COLUMN delivery_speed text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'ai_usage'
  ) THEN
    ALTER TABLE requests ADD COLUMN ai_usage text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'project_materials_link'
  ) THEN
    ALTER TABLE requests ADD COLUMN project_materials_link text;
  END IF;
END $$;