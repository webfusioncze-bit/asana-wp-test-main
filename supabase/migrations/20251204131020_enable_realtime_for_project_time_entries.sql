/*
  # Enable Realtime for Project Time Entries

  1. Changes
    - Enable realtime replication for `project_time_entries` table
    - This allows real-time updates when time entries are added/modified
    
  2. Purpose
    - Allow UI to automatically update when time entries are synchronized
    - Improve user experience by showing new data without manual refresh
*/

ALTER PUBLICATION supabase_realtime ADD TABLE project_time_entries;
