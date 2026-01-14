/*
  # Automatic cleanup of old website_status records - Batch Strategy

  1. Changes
    - Creates a function to delete website_status records older than 1 day in batches
    - Sets up a cron job to run the cleanup every 6 hours
    - Creates an index on created_at for faster deletion queries

  2. Purpose
    - Prevents database bloat by removing old monitoring data
    - Keeps only recent (last 24 hours) website status snapshots
    - Runs automatically without manual intervention
    - Uses batching to avoid timeouts

  3. Performance
    - Adds index on created_at for efficient cleanup
    - Deletes in batches of 10,000 records to avoid long transactions
*/

-- Create index for faster cleanup queries
CREATE INDEX IF NOT EXISTS idx_website_status_created_at 
ON website_status(created_at);

-- Function to clean up old website_status records in batches
CREATE OR REPLACE FUNCTION cleanup_old_website_status_batch()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
  batch_deleted INTEGER;
  cutoff_time TIMESTAMPTZ;
BEGIN
  -- Calculate cutoff time (1 day ago)
  cutoff_time := NOW() - INTERVAL '1 day';
  
  -- Delete in batches to avoid long transactions
  LOOP
    DELETE FROM website_status
    WHERE id IN (
      SELECT id 
      FROM website_status 
      WHERE created_at < cutoff_time
      LIMIT 10000
    );
    
    GET DIAGNOSTICS batch_deleted = ROW_COUNT;
    deleted_count := deleted_count + batch_deleted;
    
    -- Exit if no more records to delete
    EXIT WHEN batch_deleted = 0;
    
    -- Add a small delay between batches
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  RAISE NOTICE 'Cleaned up % old website_status records older than %', deleted_count, cutoff_time;
  
  RETURN deleted_count;
END;
$$;

-- Schedule cron job to run cleanup every 6 hours
SELECT cron.schedule(
  'cleanup-old-website-status',
  '0 */6 * * *',
  $$SELECT cleanup_old_website_status_batch();$$
);