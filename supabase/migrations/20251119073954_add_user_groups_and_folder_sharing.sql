/*
  # Add User Groups and Folder Sharing System

  1. New Tables
    - `user_groups`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Group name (e.g., Management, DEV, Grafika)
      - `color` (text) - Visual identification color
      - `description` (text) - Optional group description
      - `created_by` (uuid) - Admin who created the group
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `user_group_members`
      - `id` (uuid, primary key)
      - `group_id` (uuid) - Reference to user_groups
      - `user_id` (uuid) - Reference to auth.users
      - `added_by` (uuid) - Admin who added the user
      - `created_at` (timestamptz)
    
    - `folder_shares`
      - `id` (uuid, primary key)
      - `folder_id` (uuid) - Reference to folders
      - `shared_with_user_id` (uuid, nullable) - Direct user share
      - `shared_with_group_id` (uuid, nullable) - Group share
      - `permission_level` (text) - 'view' or 'edit'
      - `created_by` (uuid) - Who shared the folder
      - `created_at` (timestamptz)
      - Constraint: Either user_id or group_id must be set (not both)

  2. Security
    - Enable RLS on all new tables
    - Admins can manage all groups and shares
    - Users can view their own group memberships
    - Users can view folders shared with them or their groups
    - Only folder owners and admins can share folders

  3. Functions
    - Helper function to check if user has access to folder via groups
    - Helper function to check if user is in a specific group
*/

-- Create user_groups table
CREATE TABLE IF NOT EXISTS user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text DEFAULT '#3B82F6',
  description text DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_group_members table
CREATE TABLE IF NOT EXISTS user_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create folder_shares table
CREATE TABLE IF NOT EXISTS folder_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  shared_with_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_group_id uuid REFERENCES user_groups(id) ON DELETE CASCADE,
  permission_level text NOT NULL CHECK (permission_level IN ('view', 'edit')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT check_share_target CHECK (
    (shared_with_user_id IS NOT NULL AND shared_with_group_id IS NULL) OR
    (shared_with_user_id IS NULL AND shared_with_group_id IS NOT NULL)
  ),
  UNIQUE(folder_id, shared_with_user_id),
  UNIQUE(folder_id, shared_with_group_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_group_members_group_id ON user_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_user_group_members_user_id ON user_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_folder_shares_folder_id ON folder_shares(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_shares_user_id ON folder_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_folder_shares_group_id ON folder_shares(shared_with_group_id);

-- Enable RLS
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_shares ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user is admin
CREATE OR REPLACE FUNCTION is_admin_user(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = is_admin_user.user_id 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user is in a group
CREATE OR REPLACE FUNCTION is_user_in_group(user_id uuid, group_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_group_members 
    WHERE user_group_members.user_id = is_user_in_group.user_id 
    AND user_group_members.group_id = is_user_in_group.group_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user has access to folder via sharing
CREATE OR REPLACE FUNCTION has_folder_access(user_id uuid, folder_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Check if user is owner
  IF EXISTS (
    SELECT 1 FROM folders 
    WHERE folders.id = has_folder_access.folder_id 
    AND folders.owner_id = has_folder_access.user_id
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if shared directly with user
  IF EXISTS (
    SELECT 1 FROM folder_shares 
    WHERE folder_shares.folder_id = has_folder_access.folder_id 
    AND folder_shares.shared_with_user_id = has_folder_access.user_id
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if shared with user's group
  IF EXISTS (
    SELECT 1 FROM folder_shares fs
    INNER JOIN user_group_members ugm ON fs.shared_with_group_id = ugm.group_id
    WHERE fs.folder_id = has_folder_access.folder_id 
    AND ugm.user_id = has_folder_access.user_id
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for user_groups
CREATE POLICY "Admins can manage all groups"
  ON user_groups FOR ALL
  TO authenticated
  USING (is_admin_user(auth.uid()))
  WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "Users can view all groups"
  ON user_groups FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for user_group_members
CREATE POLICY "Admins can manage all group members"
  ON user_group_members FOR ALL
  TO authenticated
  USING (is_admin_user(auth.uid()))
  WITH CHECK (is_admin_user(auth.uid()));

CREATE POLICY "Users can view their own memberships"
  ON user_group_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin_user(auth.uid()));

CREATE POLICY "Users can view all memberships"
  ON user_group_members FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for folder_shares
CREATE POLICY "Folder owners can manage shares"
  ON folder_shares FOR ALL
  TO authenticated
  USING (
    is_admin_user(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM folders 
      WHERE folders.id = folder_shares.folder_id 
      AND folders.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    is_admin_user(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM folders 
      WHERE folders.id = folder_shares.folder_id 
      AND folders.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can view shares for their accessible folders"
  ON folder_shares FOR SELECT
  TO authenticated
  USING (
    is_admin_user(auth.uid()) OR
    shared_with_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_group_members 
      WHERE user_group_members.group_id = folder_shares.shared_with_group_id 
      AND user_group_members.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM folders 
      WHERE folders.id = folder_shares.folder_id 
      AND folders.owner_id = auth.uid()
    )
  );

-- Update folders RLS to include shared folders
DROP POLICY IF EXISTS "Users can view their own folders" ON folders;
CREATE POLICY "Users can view their own folders and shared folders"
  ON folders FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR 
    is_admin_user(auth.uid()) OR
    has_folder_access(auth.uid(), id)
  );

-- Update trigger for updated_at on user_groups
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_groups_updated_at ON user_groups;
CREATE TRIGGER update_user_groups_updated_at
  BEFORE UPDATE ON user_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
