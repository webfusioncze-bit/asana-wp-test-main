/*
  # Add PPC/Marketing Fields to Requests

  1. Changes
    - Add `marketing_goal` column to `requests` table
      - Type: text
      - Nullable: true
      - Description: Marketing goal or objective
    
    - Add `competitor_url` column to `requests` table
      - Type: text
      - Nullable: true
      - Description: URL of competitor's website
    
    - Add `monthly_management_budget` column to `requests` table
      - Type: text
      - Nullable: true
      - Description: Budget for monthly management/administration
    
    - Add `monthly_credits_budget` column to `requests` table
      - Type: text
      - Nullable: true
      - Description: Budget for monthly advertising credits

  2. Purpose
    - These fields are used for mapping Zapier webhook data to request fields
    - Helps capture PPC/marketing campaign information
    - When any of these fields is filled, the request will display a PPC badge
*/

-- Add marketing_goal column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'marketing_goal'
  ) THEN
    ALTER TABLE requests ADD COLUMN marketing_goal text;
  END IF;
END $$;

-- Add competitor_url column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'competitor_url'
  ) THEN
    ALTER TABLE requests ADD COLUMN competitor_url text;
  END IF;
END $$;

-- Add monthly_management_budget column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'monthly_management_budget'
  ) THEN
    ALTER TABLE requests ADD COLUMN monthly_management_budget text;
  END IF;
END $$;

-- Add monthly_credits_budget column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'monthly_credits_budget'
  ) THEN
    ALTER TABLE requests ADD COLUMN monthly_credits_budget text;
  END IF;
END $$;
