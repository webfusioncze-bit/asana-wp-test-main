/*
  # Add manage_clients Permission

  1. Updates user_permissions constraint to include 'manage_clients'
  
  Important Notes:
  - Adds manage_clients to the list of available permissions
  - Keeps existing permissions: manage_projects, manage_websites, view_requests, manage_requests
  - Users with this permission can view and manage all clients, invoices, and client-website relations
*/

-- Drop existing constraint
ALTER TABLE user_permissions 
  DROP CONSTRAINT IF EXISTS user_permissions_permission_check;

-- Add updated constraint with manage_clients permission
ALTER TABLE user_permissions
  ADD CONSTRAINT user_permissions_permission_check 
  CHECK (permission IN (
    'manage_projects',
    'manage_requests',
    'view_requests',
    'manage_websites',
    'manage_clients'
  ));