/*
  # Setup Task Digest Email CRON Jobs
  
  1. Overview
    - Creates automated email notifications for task digests
    - Three types of digests: daily, weekly, and next-week preview
    
  2. CRON Jobs
    - **Daily Digest**: Monday-Friday at 7:00 AM
      - Sends tasks for today + overdue tasks
    - **Weekly Digest**: Monday at 6:00 AM
      - Sends tasks for this week + overdue tasks
    - **Friday Preview**: Friday at 2:00 PM (14:00)
      - Sends tasks for next week + overdue tasks
      
  3. Functionality
    - Only sends emails to users with tasks
    - Includes tasks assigned to user
    - Includes overdue tasks
    - Includes tasks created by user and assigned to others
    - Uses SMTP settings from admin configuration
    
  4. Security
    - Functions use pg_net.http_post to call edge functions
    - Edge functions are secured with service role key
    - No user data exposed
*/

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to trigger daily digest emails
CREATE OR REPLACE FUNCTION trigger_daily_task_digest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url := current_setting('app.settings.api_url') || '/functions/v1/send-task-digests?digest_type=daily',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  ) INTO request_id;
  
  RAISE NOTICE 'Daily task digest request ID: %', request_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error triggering daily task digest: %', SQLERRM;
END;
$$;

-- Function to trigger weekly digest emails
CREATE OR REPLACE FUNCTION trigger_weekly_task_digest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url := current_setting('app.settings.api_url') || '/functions/v1/send-task-digests?digest_type=weekly',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  ) INTO request_id;
  
  RAISE NOTICE 'Weekly task digest request ID: %', request_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error triggering weekly task digest: %', SQLERRM;
END;
$$;

-- Function to trigger next week preview digest emails
CREATE OR REPLACE FUNCTION trigger_next_week_task_digest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url := current_setting('app.settings.api_url') || '/functions/v1/send-task-digests?digest_type=next-week',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  ) INTO request_id;
  
  RAISE NOTICE 'Next week task digest request ID: %', request_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error triggering next week task digest: %', SQLERRM;
END;
$$;

-- Drop existing jobs if they exist
DO $$
BEGIN
  PERFORM cron.unschedule('daily-task-digest');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('weekly-task-digest');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('friday-next-week-digest');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Schedule daily digest (Monday-Friday at 7:00 AM)
SELECT cron.schedule(
  'daily-task-digest',
  '0 7 * * 1-5',  -- Monday to Friday at 7:00 AM
  'SELECT trigger_daily_task_digest();'
);

-- Schedule weekly digest (Monday at 6:00 AM)
SELECT cron.schedule(
  'weekly-task-digest',
  '0 6 * * 1',  -- Monday at 6:00 AM
  'SELECT trigger_weekly_task_digest();'
);

-- Schedule Friday next week preview (Friday at 2:00 PM)
SELECT cron.schedule(
  'friday-next-week-digest',
  '0 14 * * 5',  -- Friday at 2:00 PM (14:00)
  'SELECT trigger_next_week_task_digest();'
);

-- Add comments
COMMENT ON FUNCTION trigger_daily_task_digest() IS 
'Triggers daily task digest emails (Mo-Fr 7:00). Sends tasks for today + overdue tasks.';

COMMENT ON FUNCTION trigger_weekly_task_digest() IS 
'Triggers weekly task digest emails (Mo 6:00). Sends tasks for this week + overdue tasks.';

COMMENT ON FUNCTION trigger_next_week_task_digest() IS 
'Triggers next week preview digest emails (Fr 14:00). Sends tasks for next week + overdue tasks.';
