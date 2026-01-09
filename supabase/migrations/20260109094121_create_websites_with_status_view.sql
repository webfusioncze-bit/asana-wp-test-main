/*
  # Create optimized view for websites with latest status and client info

  1. New Views
    - `websites_with_status` - combines websites with their latest status and client info in one query
      - All columns from websites table
      - Latest status fields (wordpress_version, php_version, update_plugins_count, ult)
      - Client name and company from linked client

  2. Performance
    - Uses DISTINCT ON to get only the latest status per website
    - Single query replaces multiple round-trips to database
*/

CREATE OR REPLACE VIEW websites_with_status AS
SELECT 
  w.*,
  ws.wordpress_version,
  ws.php_version,
  ws.update_plugins_count,
  ws.ult,
  ws.created_at as status_created_at,
  c.name as client_name,
  c.company_name as client_company
FROM websites w
LEFT JOIN LATERAL (
  SELECT *
  FROM website_status
  WHERE website_id = w.id
  ORDER BY created_at DESC
  LIMIT 1
) ws ON true
LEFT JOIN client_websites cw ON cw.website_id = w.id
LEFT JOIN clients c ON c.id = cw.client_id;
