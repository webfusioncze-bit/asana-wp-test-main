/*
  # Add Monthly Management Budget Field to Requests

  1. Changes
    - Add `monthly_management_budget` column to `requests` table
      - Type: numeric (decimal for precise currency values)
      - Optional field (nullable)
      - Used to identify "Website Management" type requests

  2. Purpose
    - Enables tracking of monthly management budget for website maintenance requests
    - Works similarly to e-shop and PPC fields for request categorization
    - Integrates with Zapier webhook for automatic data import
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'monthly_management_budget'
  ) THEN
    ALTER TABLE requests ADD COLUMN monthly_management_budget numeric(10,2);
  END IF;
END $$;