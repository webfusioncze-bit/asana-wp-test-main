/*
  # Remove Duplicate Folder Policies

  1. Changes
    - Remove old duplicate policies that still allow admin to see all folders
    - Keep only the new policies without admin bypass for SELECT

  2. Security
    - Ensures admins only see their own folders and shared folders
*/

-- Remove old duplicate policies
DROP POLICY IF EXISTS "Users can view own folders or admin can view all" ON folders;
DROP POLICY IF EXISTS "Users can update own folders or admin can update all" ON folders;
DROP POLICY IF EXISTS "Users can delete own folders or admin can delete all" ON folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON folders;
