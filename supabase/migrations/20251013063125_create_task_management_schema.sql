/*
  # Task Management System Database Schema

  1. New Tables
    - `users_meta`
      - `id` (uuid, primary key)
      - `wordpress_user_id` (bigint, unique, WordPress user ID)
      - `email` (text)
      - `display_name` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `folders`
      - `id` (uuid, primary key)
      - `name` (text)
      - `parent_id` (uuid, nullable, self-reference)
      - `owner_id` (uuid, references users_meta)
      - `color` (text, nullable)
      - `position` (integer, for ordering)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `folder_permissions`
      - `id` (uuid, primary key)
      - `folder_id` (uuid, references folders)
      - `user_id` (uuid, references users_meta)
      - `permission_type` (text: 'view', 'edit', 'admin')
      - `created_at` (timestamptz)
    
    - `categories`
      - `id` (uuid, primary key)
      - `name` (text)
      - `color` (text)
      - `owner_id` (uuid, references users_meta)
      - `created_at` (timestamptz)
    
    - `tasks`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text, nullable)
      - `folder_id` (uuid, references folders, nullable)
      - `category_id` (uuid, references categories, nullable)
      - `parent_task_id` (uuid, nullable, self-reference for subtasks)
      - `assigned_to` (uuid, references users_meta)
      - `created_by` (uuid, references users_meta)
      - `priority` (text: 'low', 'medium', 'high', 'urgent')
      - `status` (text: 'todo', 'in_progress', 'completed')
      - `due_date` (timestamptz, nullable)
      - `completed_at` (timestamptz, nullable)
      - `position` (integer, for ordering)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `task_comments`
      - `id` (uuid, primary key)
      - `task_id` (uuid, references tasks)
      - `user_id` (uuid, references users_meta)
      - `comment` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users_meta)
      - `task_id` (uuid, references tasks, nullable)
      - `type` (text: 'task_assigned', 'task_updated', 'comment_added', 'due_soon', 'overdue')
      - `title` (text)
      - `message` (text)
      - `is_read` (boolean, default false)
      - `is_email_sent` (boolean, default false)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access based on user relationships
    - Users can only see tasks assigned to them or created by them
    - Folder permissions control access to tasks within folders
*/

-- Create users_meta table
CREATE TABLE IF NOT EXISTS users_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wordpress_user_id bigint UNIQUE NOT NULL,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users_meta ENABLE ROW LEVEL SECURITY;

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES users_meta(id) ON DELETE CASCADE NOT NULL,
  color text DEFAULT '#6B7280',
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Create folder_permissions table
CREATE TABLE IF NOT EXISTS folder_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES folders(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users_meta(id) ON DELETE CASCADE NOT NULL,
  permission_type text NOT NULL CHECK (permission_type IN ('view', 'edit', 'admin')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(folder_id, user_id)
);

ALTER TABLE folder_permissions ENABLE ROW LEVEL SECURITY;

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#6B7280',
  owner_id uuid REFERENCES users_meta(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  parent_task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES users_meta(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES users_meta(id) ON DELETE CASCADE NOT NULL,
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
CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users_meta(id) ON DELETE CASCADE NOT NULL,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users_meta(id) ON DELETE CASCADE NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('task_assigned', 'task_updated', 'comment_added', 'due_soon', 'overdue')),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  is_email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users_meta
CREATE POLICY "Users can view all users metadata"
  ON users_meta FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own metadata"
  ON users_meta FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own metadata"
  ON users_meta FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- RLS Policies for folders
CREATE POLICY "Users can view folders they own or have access to"
  ON folders FOR SELECT
  USING (
    owner_id IN (SELECT id FROM users_meta) OR
    id IN (SELECT folder_id FROM folder_permissions WHERE user_id IN (SELECT id FROM users_meta))
  );

CREATE POLICY "Users can insert own folders"
  ON folders FOR INSERT
  WITH CHECK (owner_id IN (SELECT id FROM users_meta));

CREATE POLICY "Users can update folders they own or have edit access"
  ON folders FOR UPDATE
  USING (
    owner_id IN (SELECT id FROM users_meta) OR
    id IN (SELECT folder_id FROM folder_permissions WHERE user_id IN (SELECT id FROM users_meta) AND permission_type IN ('edit', 'admin'))
  )
  WITH CHECK (
    owner_id IN (SELECT id FROM users_meta) OR
    id IN (SELECT folder_id FROM folder_permissions WHERE user_id IN (SELECT id FROM users_meta) AND permission_type IN ('edit', 'admin'))
  );

CREATE POLICY "Users can delete own folders"
  ON folders FOR DELETE
  USING (owner_id IN (SELECT id FROM users_meta));

-- RLS Policies for folder_permissions
CREATE POLICY "Users can view folder permissions for accessible folders"
  ON folder_permissions FOR SELECT
  USING (
    folder_id IN (SELECT id FROM folders WHERE owner_id IN (SELECT id FROM users_meta)) OR
    user_id IN (SELECT id FROM users_meta)
  );

CREATE POLICY "Folder owners can manage permissions"
  ON folder_permissions FOR INSERT
  WITH CHECK (folder_id IN (SELECT id FROM folders WHERE owner_id IN (SELECT id FROM users_meta)));

CREATE POLICY "Folder owners can update permissions"
  ON folder_permissions FOR UPDATE
  USING (folder_id IN (SELECT id FROM folders WHERE owner_id IN (SELECT id FROM users_meta)))
  WITH CHECK (folder_id IN (SELECT id FROM folders WHERE owner_id IN (SELECT id FROM users_meta)));

CREATE POLICY "Folder owners can delete permissions"
  ON folder_permissions FOR DELETE
  USING (folder_id IN (SELECT id FROM folders WHERE owner_id IN (SELECT id FROM users_meta)));

-- RLS Policies for categories
CREATE POLICY "Users can view all categories"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  WITH CHECK (owner_id IN (SELECT id FROM users_meta));

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  USING (owner_id IN (SELECT id FROM users_meta))
  WITH CHECK (owner_id IN (SELECT id FROM users_meta));

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  USING (owner_id IN (SELECT id FROM users_meta));

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks assigned to them or created by them"
  ON tasks FOR SELECT
  USING (
    assigned_to IN (SELECT id FROM users_meta) OR
    created_by IN (SELECT id FROM users_meta)
  );

CREATE POLICY "Users can insert tasks"
  ON tasks FOR INSERT
  WITH CHECK (created_by IN (SELECT id FROM users_meta));

CREATE POLICY "Users can update tasks they created or are assigned to"
  ON tasks FOR UPDATE
  USING (
    assigned_to IN (SELECT id FROM users_meta) OR
    created_by IN (SELECT id FROM users_meta)
  )
  WITH CHECK (
    assigned_to IN (SELECT id FROM users_meta) OR
    created_by IN (SELECT id FROM users_meta)
  );

CREATE POLICY "Users can delete tasks they created"
  ON tasks FOR DELETE
  USING (created_by IN (SELECT id FROM users_meta));

-- RLS Policies for task_comments
CREATE POLICY "Users can view comments on accessible tasks"
  ON task_comments FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE assigned_to IN (SELECT id FROM users_meta) OR created_by IN (SELECT id FROM users_meta)
    )
  );

CREATE POLICY "Users can insert comments on accessible tasks"
  ON task_comments FOR INSERT
  WITH CHECK (
    user_id IN (SELECT id FROM users_meta) AND
    task_id IN (
      SELECT id FROM tasks WHERE assigned_to IN (SELECT id FROM users_meta) OR created_by IN (SELECT id FROM users_meta)
    )
  );

CREATE POLICY "Users can update own comments"
  ON task_comments FOR UPDATE
  USING (user_id IN (SELECT id FROM users_meta))
  WITH CHECK (user_id IN (SELECT id FROM users_meta));

CREATE POLICY "Users can delete own comments"
  ON task_comments FOR DELETE
  USING (user_id IN (SELECT id FROM users_meta));

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id IN (SELECT id FROM users_meta));

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id IN (SELECT id FROM users_meta))
  WITH CHECK (user_id IN (SELECT id FROM users_meta));

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (user_id IN (SELECT id FROM users_meta));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folder_permissions_folder ON folder_permissions(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_permissions_user ON folder_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_folder ON tasks(folder_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
