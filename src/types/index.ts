export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  owner_id: string;
  color: string;
  position: number;
  folder_type: 'tasks' | 'requests';
  is_global: boolean;
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

export interface TaskSection {
  id: string;
  folder_id: string;
  name: string;
  position: number;
  color: string | null;
  created_at: string;
  created_by: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  folder_id: string | null;
  section_id: string | null;
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
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  display_name?: string;
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

export interface FolderTag {
  id: string;
  folder_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
  created_by: string;
}

export interface TaskTag {
  id: string;
  task_id: string;
  tag_id: string;
  created_at: string;
}

export type ProjectType = 'vývoj' | 'tvorba webu' | 'grafika' | 'integrace' | 'převzetí do správy';
export type ProjectCategory = 'interní' | 'klientský';
export type ProjectStatus = 'aktivní' | 'pozastaven' | 'čeká se na klienta' | 'zrušen' | 'dokončen';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  project_type: ProjectType;
  project_category: ProjectCategory;
  status: ProjectStatus;
  client_company_name: string | null;
  client_contact_person: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_ico: string | null;
  price_offer: number | null;
  hour_budget: number | null;
  start_date: string | null;
  delivery_date: string | null;
  completed_date: string | null;
  notes: string | null;
  import_source_url: string | null;
  sync_enabled: boolean;
  last_sync_at: string | null;
  priority: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  client_name?: string | null;
  budget?: number | null;
  deadline?: string | null;
}

export type PhaseStatus = 'fáze probíhá' | 'čeká na zahájení' | 'čeká se na klienta' | 'zrušena' | 'dokončena';

export interface ProjectPhase {
  id: string;
  project_id: string;
  parent_phase_id: string | null;
  name: string;
  description: string | null;
  status: PhaseStatus;
  assigned_user_id: string | null;
  position: number;
  estimated_hours: number;
  hour_budget: number;
  start_date: string | null;
  end_date: string | null;
  completed_date: string | null;
  notes: string | null;
  hourly_rate: number | null;
  external_operator_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectPhaseAssignment {
  id: string;
  phase_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface ProjectTimeEntry {
  id: string;
  phase_id: string;
  user_id: string;
  description: string;
  hours: number;
  entry_date: string;
  visible_to_client: boolean;
  created_at: string;
  updated_at: string;
}

export type MilestoneStatus = 'čeká' | 'probíhá' | 'dokončeno' | 'zpožděno';

export interface ProjectMilestone {
  id: string;
  phase_id: string;
  name: string;
  description: string | null;
  target_date: string | null;
  completed_date: string | null;
  status: MilestoneStatus;
  position: number;
  created_at: string;
  updated_at: string;
}
