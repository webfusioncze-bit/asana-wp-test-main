/*
  # Add E-shop Fields to Requests

  1. Changes
    - Add `favorite_eshop` column to `requests` table
      - Type: text
      - Nullable: true
      - Description: URL or name of an e-shop that the client likes
    
    - Add `product_count` column to `requests` table
      - Type: integer
      - Nullable: true
      - Description: Number of products for the e-shop

  2. Purpose
    - These fields are used for mapping Zapier webhook data to request fields
    - Helps capture e-shop preferences and product quantity information
*/

-- Add favorite_eshop column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'favorite_eshop'
  ) THEN
    ALTER TABLE requests ADD COLUMN favorite_eshop text;
  END IF;
END $$;

-- Add product_count column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'product_count'
  ) THEN
    ALTER TABLE requests ADD COLUMN product_count integer;
  END IF;
END $$;