/*
  # Update User Permissions Constraint to Include manage_websites

  1. Changes
    - Drop existing check constraint on user_permissions.permission
    - Create new constraint that includes 'manage_websites' permission
    
  2. Available Permissions
    - view_requests: User can view all requests
    - manage_projects: User can manage all projects
    - manage_websites: User can manage all websites (NEW)
*/

-- Drop the old constraint
ALTER TABLE user_permissions 
DROP CONSTRAINT IF EXISTS user_permissions_permission_check;

-- Add new constraint with manage_websites included
ALTER TABLE user_permissions 
ADD CONSTRAINT user_permissions_permission_check 
CHECK (permission IN ('view_requests', 'manage_projects', 'manage_websites'));