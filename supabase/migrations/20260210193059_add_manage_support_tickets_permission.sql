/*
  # Add manage_support_tickets permission

  1. Changes
    - Adds 'manage_support_tickets' to the user_permissions constraint
    - Grants manage_support_tickets to all users who currently have manage_websites
    - Updates RLS policy on support_tickets to also check for manage_support_tickets permission

  2. Security
    - Users with manage_support_tickets can view support tickets
    - Existing manage_websites users also get this new permission
*/

ALTER TABLE user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_permission_check;

ALTER TABLE user_permissions
  ADD CONSTRAINT user_permissions_permission_check
  CHECK (permission = ANY (ARRAY[
    'manage_projects'::text,
    'manage_requests'::text,
    'view_requests'::text,
    'manage_websites'::text,
    'manage_clients'::text,
    'manage_support_tickets'::text
  ]));

INSERT INTO user_permissions (user_id, permission)
SELECT user_id, 'manage_support_tickets'
FROM user_permissions
WHERE permission = 'manage_websites'
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Users with manage_websites can view support tickets" ON support_tickets;

CREATE POLICY "Users with manage_support_tickets can view support tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (
    has_permission(auth.uid(), 'manage_support_tickets')
    OR has_permission(auth.uid(), 'manage_websites')
  );

DROP POLICY IF EXISTS "Users with manage_websites can view support comments" ON support_ticket_comments;

CREATE POLICY "Users with manage_support_tickets can view comments"
  ON support_ticket_comments
  FOR SELECT
  TO authenticated
  USING (
    has_permission(auth.uid(), 'manage_support_tickets')
    OR has_permission(auth.uid(), 'manage_websites')
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );
