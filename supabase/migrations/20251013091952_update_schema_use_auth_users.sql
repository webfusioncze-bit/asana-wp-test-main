/*
  # Update Task Management Schema to Use Supabase Auth

  1. Changes
    - Drop users_meta table and all dependencies
    - Update all foreign keys to reference auth.users directly
    - Recreate all tables with proper auth.uid() references
    - Update RLS policies to use auth.uid()
  
  2. Security
    - All policies now use auth.uid() for proper authentication
    - Restrictive access based on ownership and assignments
*/

-- Drop existing tables in correct order
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS task_comments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS folder_permissions CASCADE;
DROP TABLE IF EXISTS folders CASCADE;
DROP TABLE IF EXISTS users_meta CASCADE;

-- Create folders table
CREATE TABLE folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  color text DEFAULT '#6B7280',
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Create folder_permissions table
CREATE TABLE folder_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES folders(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission_type text NOT NULL CHECK (permission_type IN ('view', 'edit', 'admin')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(folder_id, user_id)
);

ALTER TABLE folder_permissions ENABLE ROW LEVEL SECURITY;

-- Create categories table
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#6B7280',
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Create tasks table
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  parent_task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
  due_date timestamptz,
  completed_at timestamptz,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create task_comments table
CREATE TABLE task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Create notifications table
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('task_assigned', 'task_updated', 'comment_added', 'due_soon', 'overdue')),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  is_email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for folders
CREATE POLICY "Users can view folders they own or have access to"
  ON folders FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT folder_id FROM folder_permissions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own folders"
  ON folders FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update folders they own or have edit access"
  ON folders FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT folder_id FROM folder_permissions WHERE user_id = auth.uid() AND permission_type IN ('edit', 'admin'))
  )
  WITH CHECK (
    owner_id = auth.uid() OR
    id IN (SELECT folder_id FROM folder_permissions WHERE user_id = auth.uid() AND permission_type IN ('edit', 'admin'))
  );

CREATE POLICY "Users can delete own folders"
  ON folders FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- RLS Policies for folder_permissions
CREATE POLICY "Users can view folder permissions for accessible folders"
  ON folder_permissions FOR SELECT
  TO authenticated
  USING (
    folder_id IN (SELECT id FROM folders WHERE owner_id = auth.uid()) OR
    user_id = auth.uid()
  );

CREATE POLICY "Folder owners can manage permissions"
  ON folder_permissions FOR INSERT
  TO authenticated
  WITH CHECK (folder_id IN (SELECT id FROM folders WHERE owner_id = auth.uid()));

CREATE POLICY "Folder owners can update permissions"
  ON folder_permissions FOR UPDATE
  TO authenticated
  USING (folder_id IN (SELECT id FROM folders WHERE owner_id = auth.uid()))
  WITH CHECK (folder_id IN (SELECT id FROM folders WHERE owner_id = auth.uid()));

CREATE POLICY "Folder owners can delete permissions"
  ON folder_permissions FOR DELETE
  TO authenticated
  USING (folder_id IN (SELECT id FROM folders WHERE owner_id = auth.uid()));

-- RLS Policies for categories
CREATE POLICY "Users can view own categories"
  ON categories FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks assigned to them or created by them"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid()
  );

CREATE POLICY "Users can insert tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update tasks they created or are assigned to"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid()
  )
  WITH CHECK (
    assigned_to = auth.uid() OR
    created_by = auth.uid()
  );

CREATE POLICY "Users can delete tasks they created"
  ON tasks FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- RLS Policies for task_comments
CREATE POLICY "Users can view comments on accessible tasks"
  ON task_comments FOR SELECT
  TO authenticated
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE assigned_to = auth.uid() OR created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert comments on accessible tasks"
  ON task_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    task_id IN (
      SELECT id FROM tasks WHERE assigned_to = auth.uid() OR created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own comments"
  ON task_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
  ON task_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX idx_folders_owner ON folders(owner_id);
CREATE INDEX idx_folders_parent ON folders(parent_id);
CREATE INDEX idx_folder_permissions_folder ON folder_permissions(folder_id);
CREATE INDEX idx_folder_permissions_user ON folder_permissions(user_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_created ON tasks(created_by);
CREATE INDEX idx_tasks_folder ON tasks(folder_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
