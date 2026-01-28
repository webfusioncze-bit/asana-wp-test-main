/*
  # Add Test Task Digest Function and Fix Schedule Time

  1. Changes
    - Creates a test function to send task digest to specific email
    - Updates daily digest cron job to run at 8:00 AM instead of 7:00 AM
    - Allows testing digest emails before production deployment

  2. Usage
    - Run: SELECT test_daily_task_digest('milan.vodak@webfusion.cz');
    - Returns JSON with result details
*/

-- Function to test daily digest for specific user
CREATE OR REPLACE FUNCTION test_daily_task_digest(user_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  result_body TEXT;
  result_status INT;
BEGIN
  -- Call the edge function with test parameter
  SELECT 
    net.http_post(
      url := 'https://joklitgwysbflirzlbvv.supabase.co/functions/v1/send-task-digests?digest_type=daily&test_email=' || user_email,
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impva2xpdGd3eXNiZmxpcnpsYnZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDMwNzUyNywiZXhwIjoyMDc1ODgzNTI3fQ.WLYx8BPbGJRzHWZ_h-YMFzD3TLWKWBdDjMxcVxYaHRw'
      )
    ) INTO request_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Test digest email sent to ' || user_email,
    'request_id', request_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Update daily digest cron job to run at 8:00 AM
SELECT cron.unschedule('daily-task-digest');

SELECT cron.schedule(
  'daily-task-digest',
  '0 8 * * 1-5',  -- Monday to Friday at 8:00 AM (changed from 7:00)
  'SELECT trigger_daily_task_digest();'
);

COMMENT ON FUNCTION test_daily_task_digest(TEXT) IS 
'Test function to send daily digest email to a specific user. Usage: SELECT test_daily_task_digest(''email@example.com'');';