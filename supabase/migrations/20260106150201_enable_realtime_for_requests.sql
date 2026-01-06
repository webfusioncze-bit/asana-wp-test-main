/*
  # Enable Realtime for Requests

  1. Changes
    - Enable realtime replication for requests table
    - Allows real-time updates when requests are created, updated, or deleted

  2. Important Notes
    - Needed for live count updates in the sidebar
*/

ALTER PUBLICATION supabase_realtime ADD TABLE requests;
