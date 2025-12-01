/*
  # Add manage_websites Permission

  1. Changes
    - This migration documents the manage_websites permission
    - The permission can be used to control access to website management features
    
  2. Usage
    - Grant this permission to users who should be able to:
      - View all websites
      - Add new websites
      - Delete websites
      - Sync website data
    
  3. Notes
    - No schema changes needed - user_permissions table already exists
    - This migration serves as documentation for the new permission type
*/

-- This migration documents the manage_websites permission
-- The user_permissions table already supports any permission string
-- Admins can grant this permission through the admin dashboard