/*
  # Přidání poznámek k poptávkám
  
  ## Nová tabulka
  - `request_notes` - Poznámky z hovorů a jednání s klienty
    - `id` (uuid, primary key)
    - `request_id` (uuid) - Odkaz na poptávku
    - `user_id` (uuid) - Kdo poznámku vytvořil
    - `note` (text) - Text poznámky
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
  
  ## Bezpečnost
  - RLS policies pro přístup podle přiřazení k poptávce
*/

CREATE TABLE IF NOT EXISTS request_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE request_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes for assigned requests"
  ON request_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests 
      WHERE requests.id = request_notes.request_id 
      AND (requests.assigned_to = auth.uid() OR requests.created_by = auth.uid())
    )
  );

CREATE POLICY "Users can insert notes for assigned requests"
  ON request_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requests 
      WHERE requests.id = request_notes.request_id 
      AND (requests.assigned_to = auth.uid() OR requests.created_by = auth.uid())
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own notes"
  ON request_notes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own notes"
  ON request_notes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_request_notes_request_id ON request_notes(request_id);
CREATE INDEX IF NOT EXISTS idx_request_notes_user_id ON request_notes(user_id);
