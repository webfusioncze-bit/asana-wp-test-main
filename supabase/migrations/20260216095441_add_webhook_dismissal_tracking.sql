/*
  # Add Webhook Error Dismissal Tracking

  1. Changes
    - Add `dismissed_at` field to `zapier_webhooks_log` table to track when errors are acknowledged
    - Add `dismissed_by` field to track who dismissed the error
    - Add index for faster filtering of undismissed errors

  2. Notes
    - NULL dismissed_at means the error hasn't been acknowledged yet
    - This allows us to show warnings for new errors and hide dismissed ones
*/

-- Add dismissed tracking fields
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'zapier_webhooks_log' AND column_name = 'dismissed_at'
  ) THEN
    ALTER TABLE zapier_webhooks_log ADD COLUMN dismissed_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'zapier_webhooks_log' AND column_name = 'dismissed_by'
  ) THEN
    ALTER TABLE zapier_webhooks_log ADD COLUMN dismissed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT NULL;
  END IF;
END $$;

-- Add index for filtering undismissed errors
CREATE INDEX IF NOT EXISTS idx_zapier_webhooks_log_dismissed ON zapier_webhooks_log(dismissed_at) WHERE dismissed_at IS NULL;

-- Add RLS policy for updating dismissed status
DROP POLICY IF EXISTS "Admins can update webhook log dismissed status" ON zapier_webhooks_log;
CREATE POLICY "Admins can update webhook log dismissed status"
  ON zapier_webhooks_log FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );
