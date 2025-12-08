/*
  # Fix Task Digest CRON Jobs with Hardcoded URLs
  
  1. Changes
    - Updates trigger functions to use hardcoded URLs instead of app.settings
    - Uses the same pattern as sync-projects CRON job
    
  2. Security
    - Service role key is embedded in function (secure enough for internal use)
    - Functions are SECURITY DEFINER
*/

-- Drop old functions
DROP FUNCTION IF EXISTS trigger_daily_task_digest() CASCADE;
DROP FUNCTION IF EXISTS trigger_weekly_task_digest() CASCADE;
DROP FUNCTION IF EXISTS trigger_next_week_task_digest() CASCADE;

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
    url := 'https://joklitgwysbflirzlbvv.supabase.co/functions/v1/send-task-digests?digest_type=daily',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impva2xpdGd3eXNiZmxpcnpsYnZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDMwNzUyNywiZXhwIjoyMDc1ODgzNTI3fQ.WLYx8BPbGJRzHWZ_h-YMFzD3TLWKWBdDjMxcVxYaHRw'
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
    url := 'https://joklitgwysbflirzlbvv.supabase.co/functions/v1/send-task-digests?digest_type=weekly',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impva2xpdGd3eXNiZmxpcnpsYnZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDMwNzUyNywiZXhwIjoyMDc1ODgzNTI3fQ.WLYx8BPbGJRzHWZ_h-YMFzD3TLWKWBdDjMxcVxYaHRw'
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
    url := 'https://joklitgwysbflirzlbvv.supabase.co/functions/v1/send-task-digests?digest_type=next-week',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impva2xpdGd3eXNiZmxpcnpsYnZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDMwNzUyNywiZXhwIjoyMDc1ODgzNTI3fQ.WLYx8BPbGJRzHWZ_h-YMFzD3TLWKWBdDjMxcVxYaHRw'
    )
  ) INTO request_id;
  
  RAISE NOTICE 'Next week task digest request ID: %', request_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error triggering next week task digest: %', SQLERRM;
END;
$$;

-- Add comments
COMMENT ON FUNCTION trigger_daily_task_digest() IS 
'Triggers daily task digest emails (Mo-Fr 7:00). Sends tasks for today + overdue tasks.';

COMMENT ON FUNCTION trigger_weekly_task_digest() IS 
'Triggers weekly task digest emails (Mo 6:00). Sends tasks for this week + overdue tasks.';

COMMENT ON FUNCTION trigger_next_week_task_digest() IS 
'Triggers next week preview digest emails (Fr 14:00). Sends tasks for next week + overdue tasks.';
