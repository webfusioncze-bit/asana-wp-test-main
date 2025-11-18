export interface User {
  id: string;
  wordpress_user_id: number;
  email: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  owner_id: string;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  owner_id: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  folder_id: string | null;
  category_id: string | null;
  parent_task_id: string | null;
  assigned_to: string;
  created_by: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'completed';
  due_date: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  task_id: string | null;
  type: 'task_assigned' | 'task_updated' | 'comment_added' | 'due_soon' | 'overdue';
  title: string;
  message: string;
  is_read: boolean;
  is_email_sent: boolean;
  created_at: string;
}
