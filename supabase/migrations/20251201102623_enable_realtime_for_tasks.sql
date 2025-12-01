/*
  # Enable Realtime for tasks and related tables

  1. Changes
    - Enable realtime for tasks table
    - Enable realtime for task_comments table
    - Enable realtime for task_sections table
    - Enable realtime for time_entries table
    - Enable realtime for task_attachments table

  2. Purpose
    - Allow frontend to receive real-time updates when tasks change
    - Automatically update UI when tasks are moved, updated, or deleted
    - Update folder counts in real-time
*/

-- Enable realtime for tasks table
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- Enable realtime for task_comments table
ALTER PUBLICATION supabase_realtime ADD TABLE task_comments;

-- Enable realtime for task_sections table
ALTER PUBLICATION supabase_realtime ADD TABLE task_sections;

-- Enable realtime for time_entries table
ALTER PUBLICATION supabase_realtime ADD TABLE time_entries;

-- Enable realtime for task_attachments table
ALTER PUBLICATION supabase_realtime ADD TABLE task_attachments;