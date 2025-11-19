export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  owner_id: string;
  color: string;
  position: number;
  folder_type: 'tasks' | 'requests';
  created_at: string;
  updated_at?: string;
  item_count?: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  owner_id: string;
  created_at: string;
}

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type RecurrenceRule = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Task {
  id: string;
  title: string;
  description: string;
  folder_id: string | null;
  category_id: string | null;
  parent_task_id: string | null;
  assigned_to: string;
  created_by: string;
  priority: Priority;
  status: TaskStatus;
  due_date: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  is_recurring?: boolean;
  recurrence_rule?: RecurrenceRule | null;
  recurrence_interval?: number;
  recurrence_end_date?: string | null;
  parent_recurring_task_id?: string | null;
  next_occurrence?: string | null;
  request_id?: string | null;
  recurrence_days_of_week?: number[] | null;
  recurrence_day_of_month?: number | null;
  recurrence_month?: number | null;
  previous_folder_id?: string | null;
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

export interface User {
  id: string;
  email: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'user' | 'admin';
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export type RequestStatus = 'new' | 'in_progress' | 'planning' | 'completed' | 'cancelled';

export interface RequestType {
  id: string;
  name: string;
  color: string;
  created_by: string;
  created_at: string;
}

export interface RequestStatusCustom {
  id: string;
  name: string;
  color: string;
  position: number;
  created_by: string;
  created_at: string;
}

export interface Request {
  id: string;
  title: string;
  description: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  status: RequestStatus;
  priority: Priority;
  estimated_hours: number;
  budget: string | null;
  deadline: string | null;
  folder_id: string | null;
  assigned_to: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  request_type_id: string | null;
  request_status_id: string | null;
  subpage_count: number;
  source: string | null;
  storage_url: string | null;
  current_website_url: string | null;
  additional_services: string | null;
  accepted_price: number;
}

export interface RequestAction {
  id: string;
  request_id: string;
  title: string;
  description: string;
  planned_date: string | null;
  completed_date: string | null;
  assigned_to: string;
  created_by: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  task_id: string | null;
  request_id: string | null;
  description: string;
  hours: number;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface RequestNote {
  id: string;
  request_id: string;
  user_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface ZapierSource {
  id: string;
  name: string;
  webhook_token: string;
  is_active: boolean;
  sample_data: Record<string, any> | null;
  field_mapping: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface ZapierWebhookLog {
  id: string;
  source_id: string;
  payload: Record<string, any>;
  request_id: string | null;
  status: 'success' | 'error' | 'pending_mapping';
  error_message: string | null;
  created_at: string;
}

export interface UserGroup {
  id: string;
  name: string;
  color: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface UserGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  added_by: string;
  created_at: string;
}

export type FolderSharePermission = 'view' | 'edit';

export interface FolderShare {
  id: string;
  folder_id: string;
  shared_with_user_id: string | null;
  shared_with_group_id: string | null;
  permission_level: FolderSharePermission;
  created_by: string;
  created_at: string;
}

export interface FolderWithShares extends Folder {
  is_shared?: boolean;
  share_count?: number;
  shared_groups?: UserGroup[];
  shared_users?: User[];
}
