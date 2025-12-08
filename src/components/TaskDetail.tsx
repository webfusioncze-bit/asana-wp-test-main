import { useState, useEffect } from 'react';
import { XIcon, CalendarIcon, TagIcon, FolderIcon, TrashIcon, UserIcon, ClockIcon, PlusIcon, RepeatIcon, UploadIcon, FileIcon, DownloadIcon, MailIcon, ActivityIcon, UserPlusIcon, AlertCircleIcon, CircleIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendTaskAssignmentEmail } from '../lib/emailNotifications';
import type { Task, TaskComment, Category, Folder, User, TimeEntry, FolderTag } from '../types';

interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string;
  created_at: string;
}

interface TaskActivityLog {
  id: string;
  task_id: string;
  activity_type: string;
  old_value: string | null;
  new_value: string | null;
  email_sent_to: string | null;
  created_by: string | null;
  created_at: string;
  metadata: any;
}

interface TaskDetailProps {
  taskId: string;
  onClose: () => void;
  onTaskUpdated: () => void;
}

export function TaskDetail({ taskId, onClose, onTaskUpdated }: TaskDetailProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [taskHierarchy, setTaskHierarchy] = useState<Task[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [activityLog, setActivityLog] = useState<TaskActivityLog[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [availableTags, setAvailableTags] = useState<FolderTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isAddingTime, setIsAddingTime] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showAllActivityLogs, setShowAllActivityLogs] = useState(false);
  const [newSubtask, setNewSubtask] = useState({
    title: '',
    description: '',
    due_date: '',
    assigned_to: '',
  });
  const [newTimeEntry, setNewTimeEntry] = useState({
    description: '',
    hours: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadTask();
    loadComments();
    loadCategories();
    loadFolders();
    loadUsers();
    loadTimeEntries();
    loadSubtasks();
    loadTaskHierarchy();
    loadAttachments();
    loadTaskTags();
    loadActivityLog();
  }, [taskId]);

  useEffect(() => {
    if (task?.folder_id) {
      loadAvailableTags();
    }
  }, [task?.folder_id]);

  useEffect(() => {
    // Subscribe to realtime changes for this specific task
    const channel = supabase
      .channel(`task-detail-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `id=eq.${taskId}`
        },
        () => {
          loadTask();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`
        },
        () => {
          loadComments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `task_id=eq.${taskId}`
        },
        () => {
          loadTimeEntries();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_attachments',
          filter: `task_id=eq.${taskId}`
        },
        () => {
          loadAttachments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_activity_log',
          filter: `task_id=eq.${taskId}`
        },
        () => {
          loadActivityLog();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  async function loadTask() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();

    if (error) {
      console.error('Error loading task:', error);
      return;
    }

    setTask(data);
  }

  async function loadComments() {
    const { data, error } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading comments:', error);
      return;
    }

    setComments(data || []);
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*');

    if (error) {
      console.error('Error loading categories:', error);
      return;
    }

    setCategories(data || []);
  }

  async function loadFolders() {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('folder_type', 'tasks')
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading folders:', error);
      return;
    }

    setFolders(data || []);
  }

  function buildFolderHierarchy(folders: Folder[], parentId: string | null = null, level: number = 0): JSX.Element[] {
    const children = folders.filter(f => f.parent_id === parentId);
    const result: JSX.Element[] = [];

    children.forEach(folder => {
      const indent = '\u00A0\u00A0'.repeat(level * 2);
      const prefix = level > 0 ? '└─ ' : '';
      result.push(
        <option key={folder.id} value={folder.id}>
          {indent}{prefix}{folder.name}
        </option>
      );
      result.push(...buildFolderHierarchy(folders, folder.id, level + 1));
    });

    return result;
  }

  async function loadUsers() {
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, avatar_url, display_name');

    if (error) {
      console.error('Error loading user profiles:', error);
      return;
    }

    setUsers((profiles || []).map(p => ({
      id: p.id,
      email: p.email || '',
      first_name: p.first_name,
      last_name: p.last_name,
      avatar_url: p.avatar_url,
      display_name: p.display_name
    })));
  }

  async function loadTimeEntries() {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('task_id', taskId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error loading time entries:', error);
      return;
    }

    setTimeEntries(data || []);
  }

  async function loadSubtasks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Načti všechny subtasky, RLS se postará o filtrování podle folder sharing
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_task_id', taskId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading subtasks:', error);
      return;
    }

    setSubtasks(data || []);
  }

  async function getMaxSectionPosition(folderId: string): Promise<number> {
    const { data } = await supabase
      .from('task_sections')
      .select('position')
      .eq('folder_id', folderId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.position ?? -1;
  }

  async function loadTaskHierarchy() {
    const hierarchy: Task[] = [];
    let currentTaskId: string | null = taskId;

    while (currentTaskId) {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', currentTaskId)
        .maybeSingle();

      if (error || !data) break;

      hierarchy.unshift(data);
      currentTaskId = data.parent_task_id;
    }

    setTaskHierarchy(hierarchy);
  }

  async function updateTaskField(field: string, value: any) {
    if (!task) return;

    const updateData: any = {
      [field]: value,
      updated_at: new Date().toISOString(),
    };

    // Speciální zpracování pro datum
    if (field === 'due_date' && value) {
      updateData.due_date = new Date(value).toISOString();
    }

    // Speciální zpracování pro status změnu na completed
    if (field === 'status' && value === 'completed' && task.status !== 'completed') {
      updateData.completed_at = new Date().toISOString();

      if (task.folder_id) {
        const { data: completedSection } = await supabase
          .from('task_sections')
          .select('id')
          .eq('folder_id', task.folder_id)
          .eq('name', 'Dokončené')
          .maybeSingle();

        if (completedSection) {
          updateData.section_id = completedSection.id;
        } else {
          const maxPosition = await getMaxSectionPosition(task.folder_id);
          const { data: newSection } = await supabase
            .from('task_sections')
            .insert({
              folder_id: task.folder_id,
              name: 'Dokončené',
              position: maxPosition + 1,
              is_collapsed: false
            })
            .select()
            .single();

          if (newSection) {
            updateData.section_id = newSection.id;
          }
        }
      }
    } else if (field === 'status' && value !== 'completed' && task.status === 'completed') {
      updateData.completed_at = null;
      updateData.section_id = null;
    }

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task:', error);
      return;
    }

    // Pokud se změnil přiřazený uživatel, odešli email notifikaci
    if (field === 'assigned_to' && value && value !== task.assigned_to) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const isReassignment = task.assigned_to !== null;
        await sendTaskAssignmentEmail({
          taskId: task.id,
          taskTitle: task.title,
          assignedUserId: value,
          assignedByUserId: user.id,
          dueDate: task.due_date || undefined,
          isReassignment
        });
      }
    }

    setEditingField(null);
    loadTask();
    onTaskUpdated();
  }

  async function deleteTask() {
    if (!confirm('Opravdu chcete smazat tento úkol?')) return;

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Error deleting task:', error);
      return;
    }

    onClose();
    onTaskUpdated();
  }

  async function addComment() {
    if (!newComment.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        user_id: user.id,
        comment: newComment,
      });

    if (error) {
      console.error('Error adding comment:', error);
      return;
    }

    setNewComment('');
    loadComments();
  }

  async function addTimeEntry() {
    if (!newTimeEntry.hours || parseFloat(newTimeEntry.hours) <= 0) {
      alert('Zadejte platný počet hodin');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('time_entries')
      .insert({
        user_id: user.id,
        task_id: taskId,
        description: newTimeEntry.description,
        hours: parseFloat(newTimeEntry.hours),
        date: newTimeEntry.date,
      });

    if (error) {
      console.error('Error adding time entry:', error);
      alert('Chyba při přidávání záznamu času');
      return;
    }

    setNewTimeEntry({
      description: '',
      hours: '',
      date: new Date().toISOString().split('T')[0],
    });
    setIsAddingTime(false);
    loadTimeEntries();
  }

  async function deleteTimeEntry(entryId: string) {
    if (!confirm('Opravdu chcete smazat tento záznam času?')) return;

    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', entryId);

    if (error) {
      console.error('Error deleting time entry:', error);
      return;
    }

    loadTimeEntries();
  }

  async function addSubtask() {
    if (!newSubtask.title.trim()) {
      alert('Zadejte název subtasku');
      return;
    }

    if (!task) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('tasks')
      .insert({
        title: newSubtask.title,
        description: newSubtask.description,
        parent_task_id: taskId,
        folder_id: task.folder_id,
        category_id: task.category_id,
        assigned_to: newSubtask.assigned_to || task.assigned_to,
        due_date: newSubtask.due_date ? new Date(newSubtask.due_date).toISOString() : null,
        created_by: user.id,
        priority: task.priority,
        status: 'todo',
        position: subtasks.length,
      });

    if (error) {
      console.error('Error adding subtask:', error);
      alert('Chyba při vytváření subtasku');
      return;
    }

    setNewSubtask({ title: '', description: '', due_date: '', assigned_to: '' });
    setIsAddingSubtask(false);
    loadSubtasks();
    onTaskUpdated();
  }

  async function deleteSubtask(subtaskId: string) {
    if (!confirm('Opravdu chcete smazat tento subtask?')) return;

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', subtaskId);

    if (error) {
      console.error('Error deleting subtask:', error);
      return;
    }

    loadSubtasks();
    onTaskUpdated();
  }

  async function loadAttachments() {
    const { data, error } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading attachments:', error);
      return;
    }

    setAttachments(data || []);
  }

  async function loadActivityLog() {
    const { data, error } = await supabase
      .from('task_activity_log')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading activity log:', error);
      return;
    }

    setActivityLog(data || []);
  }

  async function loadAvailableTags() {
    if (!task?.folder_id) return;

    const { data, error } = await supabase
      .from('folder_tags')
      .select('*')
      .eq('folder_id', task.folder_id)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading available tags:', error);
      return;
    }

    setAvailableTags(data || []);
  }

  async function loadTaskTags() {
    const { data, error } = await supabase
      .from('task_tags')
      .select('tag_id')
      .eq('task_id', taskId);

    if (error) {
      console.error('Error loading task tags:', error);
      return;
    }

    setSelectedTagIds(data?.map(tt => tt.tag_id) || []);
  }

  async function toggleTag(tagId: string) {
    const isSelected = selectedTagIds.includes(tagId);

    if (isSelected) {
      const { error } = await supabase
        .from('task_tags')
        .delete()
        .eq('task_id', taskId)
        .eq('tag_id', tagId);

      if (error) {
        console.error('Error removing tag:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('task_tags')
        .insert({
          task_id: taskId,
          tag_id: tagId
        });

      if (error) {
        console.error('Error adding tag:', error);
        return;
      }
    }

    loadTaskTags();
    onTaskUpdated();
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `task-attachments/${taskId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskId,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;

      loadAttachments();
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Chyba při nahrávání souboru');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!confirm('Opravdu chcete smazat tuto přílohu?')) return;

    const { error } = await supabase
      .from('task_attachments')
      .delete()
      .eq('id', attachmentId);

    if (error) {
      console.error('Error deleting attachment:', error);
      return;
    }

    loadAttachments();
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  if (!task) {
    return (
      <div className="w-96 bg-white border-l border-gray-200 flex items-center justify-center">
        <p className="text-gray-500">Načítání...</p>
      </div>
    );
  }

  const priorityColors = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  };

  const statusColors = {
    todo: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
  };

  const priorityLabels = {
    low: 'Nízká',
    medium: 'Střední',
    high: 'Vysoká',
    urgent: 'Urgentní',
  };

  const statusLabels = {
    todo: 'K dokončení',
    in_progress: 'Probíhá',
    completed: 'Dokončeno',
  };

  return (
    <div className="w-[600px] bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-800">Detail úkolu</h2>
          <div className="flex gap-1">
            <button
              onClick={deleteTask}
              className="p-1.5 hover:bg-red-50 rounded transition-colors"
            >
              <TrashIcon className="w-4 h-4 text-red-500" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            >
              <XIcon className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
        {taskHierarchy.length > 1 && (
          <div className="flex items-center gap-2 text-xs text-gray-600 overflow-x-auto">
            {taskHierarchy.map((hierarchyTask, index) => (
              <div key={hierarchyTask.id} className="flex items-center gap-2 flex-shrink-0">
                {index > 0 && <span>/</span>}
                <button
                  onClick={() => {
                    if (hierarchyTask.id !== taskId) {
                      onClose();
                      setTimeout(() => {
                        const event = new CustomEvent('selectTask', { detail: hierarchyTask.id });
                        window.dispatchEvent(event);
                      }, 100);
                    }
                  }}
                  className={`hover:text-primary transition-colors truncate max-w-[150px] ${
                    hierarchyTask.id === taskId ? 'font-medium text-primary' : ''
                  }`}
                  title={hierarchyTask.title}
                >
                  {hierarchyTask.title}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Název</label>
          {editingField === 'title' ? (
            <input
              type="text"
              defaultValue={task.title}
              autoFocus
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== task.title) {
                  updateTaskField('title', e.target.value);
                } else {
                  setEditingField(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  setEditingField(null);
                }
              }}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <div>
              <div
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded transition-colors"
                onClick={() => setEditingField('title')}
              >
                <h3 className="text-base font-semibold text-gray-800 flex-1">
                  {task.title}
                </h3>
                {task.due_date && (() => {
                  const deadline = new Date(task.due_date);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  deadline.setHours(0, 0, 0, 0);

                  const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                  const getDeadlineStyle = () => {
                    if (daysUntil < 0) {
                      return 'bg-red-100 text-red-700';
                    } else if (daysUntil <= 3) {
                      return 'bg-orange-100 text-orange-700';
                    } else {
                      return 'bg-gray-100 text-gray-700';
                    }
                  };

                  return (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${getDeadlineStyle()}`}>
                      {deadline.toLocaleDateString('cs-CZ')}
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 px-2">
                <span>{users.find(u => u.id === task.created_by)?.display_name || users.find(u => u.id === task.created_by)?.email || 'Neznámý'}</span>
                <span className="text-gray-400">→</span>
                <span>{users.find(u => u.id === task.assigned_to)?.display_name || users.find(u => u.id === task.assigned_to)?.email || 'Nepřiřazeno'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Popis</label>
          {editingField === 'description' ? (
            <textarea
              defaultValue={task.description || ''}
              autoFocus
              rows={3}
              onBlur={(e) => {
                if (e.target.value !== task.description) {
                  updateTaskField('description', e.target.value || null);
                } else {
                  setEditingField(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditingField(null);
                }
              }}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <p
              className="text-xs text-gray-600 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded transition-colors min-h-[2rem] whitespace-pre-wrap"
              onClick={() => setEditingField('description')}
            >
              {task.description || 'Bez popisu'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
          <div>
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" title="Termín dokončení" />
              {editingField === 'due_date' ? (
                <input
                  type="date"
                  defaultValue={task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : ''}
                  autoFocus
                  onBlur={(e) => {
                    updateTaskField('due_date', e.target.value || null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                      setEditingField(null);
                    }
                  }}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              ) : (
                <p
                  className="text-gray-600 text-xs cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded transition-colors flex-1"
                  onClick={() => setEditingField('due_date')}
                >
                  {task.due_date
                    ? new Date(task.due_date).toLocaleString('cs-CZ')
                    : 'Není nastaven'}
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" title="Přiřazeno" />
              {editingField === 'assigned_to' ? (
                <select
                  defaultValue={task.assigned_to}
                  autoFocus
                  onChange={(e) => {
                    updateTaskField('assigned_to', e.target.value);
                  }}
                  onBlur={() => setEditingField(null)}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.display_name || user.email}</option>
                  ))}
                </select>
              ) : (
                <div
                  className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded transition-colors flex-1"
                  onClick={() => setEditingField('assigned_to')}
                >
                  {users.find(u => u.id === task.assigned_to)?.avatar_url ? (
                    <img
                      src={users.find(u => u.id === task.assigned_to)?.avatar_url}
                      alt="Avatar"
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                      <UserIcon className="w-3 h-3 text-gray-500" />
                    </div>
                  )}
                  <p className="text-gray-600 text-xs truncate">
                    {users.find(u => u.id === task.assigned_to)?.display_name ||
                     users.find(u => u.id === task.assigned_to)?.email ||
                     'Neznámý uživatel'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <UserPlusIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" title="Zadavatel" />
              <div className="flex items-center gap-1.5 px-2 py-1.5 flex-1">
                {users.find(u => u.id === task.created_by)?.avatar_url ? (
                  <img
                    src={users.find(u => u.id === task.created_by)?.avatar_url}
                    alt="Avatar"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                    <UserIcon className="w-3 h-3 text-blue-600" />
                  </div>
                )}
                <p className="text-gray-600 text-xs truncate">
                  {users.find(u => u.id === task.created_by)?.display_name ||
                   users.find(u => u.id === task.created_by)?.email ||
                   'Neznámý uživatel'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
          <div>
            <div className="flex items-center gap-1.5">
              <TagIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" title="Kategorie" />
              {editingField === 'category_id' ? (
                <select
                  defaultValue={task.category_id || ''}
                  autoFocus
                  onChange={(e) => {
                    updateTaskField('category_id', e.target.value || null);
                  }}
                  onBlur={() => setEditingField(null)}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Žádná kategorie</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              ) : (
                <p
                  className="text-gray-600 text-xs cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded transition-colors flex-1"
                  onClick={() => setEditingField('category_id')}
                >
                  {categories.find(c => c.id === task.category_id)?.name || 'Bez kategorie'}
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <FolderIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" title="Složka" />
              {editingField === 'folder_id' ? (
                <select
                  defaultValue={task.folder_id || ''}
                  autoFocus
                  onChange={(e) => {
                    updateTaskField('folder_id', e.target.value || null);
                  }}
                  onBlur={() => setEditingField(null)}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Žádná složka</option>
                  {buildFolderHierarchy(folders)}
                </select>
              ) : (
                <p
                  className="text-gray-600 text-xs cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded transition-colors flex-1"
                  onClick={() => setEditingField('folder_id')}
                >
                  {folders.find(f => f.id === task.folder_id)?.name || 'Bez složky'}
                </p>
              )}
            </div>
          </div>
        </div>

        {task.folder_id && availableTags.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-start gap-1.5">
              <TagIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-1" title="Tagy" />
              <div className="flex flex-wrap gap-2 flex-1">
                {availableTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${
                        isSelected
                          ? 'ring-2 ring-offset-1'
                          : 'opacity-50 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: tag.color + (isSelected ? '30' : '20'),
                        color: tag.color,
                        borderLeft: `3px solid ${tag.color}`,
                        ringColor: tag.color
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
          <div>
            <div className="flex items-center gap-1.5">
              <AlertCircleIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" title="Priorita" />
              {editingField === 'priority' ? (
                <select
                  defaultValue={task.priority || 'medium'}
                  autoFocus
                  onChange={(e) => {
                    updateTaskField('priority', e.target.value as Task['priority']);
                  }}
                  onBlur={() => setEditingField(null)}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="low">Nízká</option>
                  <option value="medium">Střední</option>
                  <option value="high">Vysoká</option>
                  <option value="urgent">Urgentní</option>
                </select>
              ) : (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${priorityColors[task.priority]}`}
                  onClick={() => setEditingField('priority')}
                >
                  {priorityLabels[task.priority]}
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <CircleIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" title="Status" />
              {editingField === 'status' ? (
                <select
                  defaultValue={task.status || 'todo'}
                  autoFocus
                  onChange={(e) => {
                    updateTaskField('status', e.target.value as Task['status']);
                  }}
                  onBlur={() => setEditingField(null)}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="todo">K dokončení</option>
                  <option value="in_progress">Probíhá</option>
                  <option value="completed">Dokončeno</option>
                </select>
              ) : (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${statusColors[task.status]}`}
                  onClick={() => setEditingField('status')}
                >
                  {statusLabels[task.status]}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-gray-700">
              Subtasky ({subtasks.length})
            </h4>
            <button
              onClick={() => setIsAddingSubtask(!isAddingSubtask)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary-dark transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Přidat
            </button>
          </div>

          {isAddingSubtask && (
            <div className="bg-gray-50 rounded p-3 mb-3 space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Název subtasku</label>
                <input
                  type="text"
                  value={newSubtask.title}
                  onChange={(e) => setNewSubtask({ ...newSubtask, title: e.target.value })}
                  placeholder="Název..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Popis subtasku</label>
                <textarea
                  value={newSubtask.description}
                  onChange={(e) => setNewSubtask({ ...newSubtask, description: e.target.value })}
                  placeholder="Popis..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    <CalendarIcon className="w-3 h-3 inline mr-1" />
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={newSubtask.due_date}
                    onChange={(e) => setNewSubtask({ ...newSubtask, due_date: e.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    <UserIcon className="w-3 h-3 inline mr-1" />
                    Přiřadit
                  </label>
                  <select
                    value={newSubtask.assigned_to}
                    onChange={(e) => setNewSubtask({ ...newSubtask, assigned_to: e.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  >
                    <option value="">Výchozí ({users.find(u => u.id === task.assigned_to)?.display_name || users.find(u => u.id === task.assigned_to)?.email || 'N/A'})</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.display_name || user.email}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addSubtask}
                  className="flex-1 px-2 py-1.5 bg-primary text-white rounded hover:bg-primary-dark transition-colors text-xs"
                >
                  Vytvořit
                </button>
                <button
                  onClick={() => {
                    setIsAddingSubtask(false);
                    setNewSubtask({ title: '', description: '', due_date: '', assigned_to: '' });
                  }}
                  className="px-2 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-xs"
                >
                  Zrušit
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5 mb-3">
            {subtasks.length === 0 ? (
              <p className="text-xs text-gray-500">Zatím žádné subtasky</p>
            ) : (
              subtasks.map(subtask => (
                <div key={subtask.id} className="bg-gray-50 rounded p-2 hover:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between mb-1">
                    <button
                      onClick={() => {
                        onClose();
                        setTimeout(() => onTaskUpdated(), 100);
                      }}
                      className="flex-1 text-left"
                    >
                      <span className="text-xs font-medium text-gray-900 hover:text-primary">{subtask.title}</span>
                    </button>
                    <button
                      onClick={() => deleteSubtask(subtask.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {subtask.description && (
                    <p className="text-xs text-gray-600 mb-2">{subtask.description}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                        subtask.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : subtask.status === 'in_progress'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {subtask.status === 'todo' && 'K dokončení'}
                      {subtask.status === 'in_progress' && 'Probíhá'}
                      {subtask.status === 'completed' && 'Hotovo'}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                        subtask.priority === 'urgent'
                          ? 'bg-red-100 text-red-600'
                          : subtask.priority === 'high'
                          ? 'bg-orange-100 text-orange-600'
                          : subtask.priority === 'medium'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {subtask.priority === 'low' && 'Nízká'}
                      {subtask.priority === 'medium' && 'Střední'}
                      {subtask.priority === 'high' && 'Vysoká'}
                      {subtask.priority === 'urgent' && 'Urgentní'}
                    </span>
                    {subtask.due_date && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        {new Date(subtask.due_date).toLocaleDateString('cs-CZ')}
                      </span>
                    )}
                    {subtask.assigned_to && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700" title={users.find(u => u.id === subtask.assigned_to)?.display_name || users.find(u => u.id === subtask.assigned_to)?.email}>
                        {users.find(u => u.id === subtask.assigned_to)?.avatar_url ? (
                          <img
                            src={users.find(u => u.id === subtask.assigned_to)?.avatar_url}
                            alt="Avatar"
                            className="w-3 h-3 rounded-full object-cover"
                          />
                        ) : (
                          <UserIcon className="w-3 h-3" />
                        )}
                        {users.find(u => u.id === subtask.assigned_to)?.display_name ||
                         users.find(u => u.id === subtask.assigned_to)?.email?.split('@')[0] ||
                         'N/A'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-gray-700">
              <ClockIcon className="w-3.5 h-3.5 inline mr-1" />
              Vykazování času
            </h4>
            <button
              onClick={() => setIsAddingTime(!isAddingTime)}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Přidat
            </button>
          </div>

          {isAddingTime && (
            <div className="bg-gray-50 rounded p-3 mb-3 space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Popis činnosti</label>
                <input
                  type="text"
                  value={newTimeEntry.description}
                  onChange={(e) => setNewTimeEntry({ ...newTimeEntry, description: e.target.value })}
                  placeholder="Co jste dělali..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hodiny</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={newTimeEntry.hours}
                    onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hours: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Datum</label>
                  <input
                    type="date"
                    value={newTimeEntry.date}
                    onChange={(e) => setNewTimeEntry({ ...newTimeEntry, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addTimeEntry}
                  className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                >
                  Uložit
                </button>
                <button
                  onClick={() => {
                    setIsAddingTime(false);
                    setNewTimeEntry({
                      description: '',
                      hours: '',
                      date: new Date().toISOString().split('T')[0],
                    });
                  }}
                  className="px-2 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-xs"
                >
                  Zrušit
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5 mb-3">
            {timeEntries.length === 0 ? (
              <p className="text-xs text-gray-500">Zatím žádné záznamy času</p>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs font-medium text-gray-700 bg-gray-50 px-3 py-2 rounded">
                  <span>Celkem hodin:</span>
                  <span className="text-green-600 font-bold">
                    {timeEntries.reduce((sum, entry) => sum + entry.hours, 0).toFixed(2)}h
                  </span>
                </div>
                {timeEntries.map(entry => (
                  <div key={entry.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{entry.hours}h</span>
                      <button
                        onClick={() => deleteTimeEntry(entry.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {entry.description && (
                      <p className="text-sm text-gray-600 mb-1">{entry.description}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      {new Date(entry.date).toLocaleDateString('cs-CZ')}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-gray-700">Přílohy</h4>
            <label className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer text-sm flex items-center gap-2">
              <UploadIcon className="w-3.5 h-3.5" />
              {isUploading ? 'Nahrávání...' : 'Nahrát soubor'}
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>
          <div className="space-y-1.5 mb-3">
            {attachments.length === 0 ? (
              <p className="text-xs text-gray-500">Zatím žádné přílohy</p>
            ) : (
              attachments.map(attachment => (
                <div key={attachment.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{attachment.file_name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(attachment.file_size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={attachment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-200 rounded transition-colors"
                      title="Stáhnout"
                    >
                      <DownloadIcon className="w-4 h-4 text-gray-600" />
                    </a>
                    <button
                      onClick={() => deleteAttachment(attachment.id)}
                      className="p-2 hover:bg-red-50 rounded transition-colors"
                      title="Smazat"
                    >
                      <TrashIcon className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <h4 className="text-sm font-medium text-gray-700 mb-4">Komentáře</h4>
          <div className="space-y-3 mb-4">
            {comments.length === 0 ? (
              <p className="text-xs text-gray-500">Zatím žádné komentáře</p>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <UserIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {new Date(comment.created_at).toLocaleString('cs-CZ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{comment.comment}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addComment();
              }}
              placeholder="Přidat komentář..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={addComment}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Odeslat
            </button>
          </div>
        </div>

        {activityLog.length > 0 && (
          <div className="border-t border-gray-100 pt-3 mt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="flex items-center gap-2 text-xs font-medium text-gray-600">
                <ActivityIcon className="w-3.5 h-3.5" />
                Historie změn
              </h4>
              {activityLog.length > 1 && (
                <button
                  onClick={() => setShowAllActivityLogs(!showAllActivityLogs)}
                  className="text-[10px] text-cyan-600 hover:text-cyan-700 font-medium"
                >
                  {showAllActivityLogs ? 'Skrýt' : `Zobrazit vše (${activityLog.length})`}
                </button>
              )}
            </div>
            <div className="space-y-1">
              {(showAllActivityLogs ? activityLog : activityLog.slice(0, 1)).map(log => {
                const user = users.find(u => u.id === log.created_by);
                const userName = user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.display_name || user?.email || 'Systém';

                let activityText = '';
                let icon = <ActivityIcon className="w-3 h-3 text-gray-400" />;

                if (log.activity_type === 'task_created') {
                  icon = <PlusIcon className="w-3 h-3 text-green-500" />;
                  activityText = `Úkol vytvořen`;
                } else if (log.activity_type === 'email_sent') {
                  icon = <MailIcon className="w-3 h-3 text-blue-500" />;
                  activityText = `Email odeslán na ${log.email_sent_to}`;
                } else if (log.activity_type === 'status_changed') {
                  const oldStatus = log.old_value === 'todo' ? 'K dokončení' : log.old_value === 'in_progress' ? 'Probíhá' : 'Dokončeno';
                  const newStatus = log.new_value === 'todo' ? 'K dokončení' : log.new_value === 'in_progress' ? 'Probíhá' : 'Dokončeno';
                  activityText = `Stav změněn: ${oldStatus} → ${newStatus}`;
                } else if (log.activity_type === 'due_date_changed') {
                  const oldDate = log.old_value && log.old_value !== 'null' ? new Date(log.old_value).toLocaleDateString('cs-CZ') : 'Bez termínu';
                  const newDate = log.new_value && log.new_value !== 'null' ? new Date(log.new_value).toLocaleDateString('cs-CZ') : 'Bez termínu';
                  activityText = `Termín změněn: ${oldDate} → ${newDate}`;
                } else if (log.activity_type === 'assigned_user_changed') {
                  const oldUser = log.old_value && log.old_value !== 'null' ? users.find(u => u.id === log.old_value) : null;
                  const newUser = log.new_value && log.new_value !== 'null' ? users.find(u => u.id === log.new_value) : null;
                  const oldUserName = oldUser ? (oldUser.first_name && oldUser.last_name ? `${oldUser.first_name} ${oldUser.last_name}` : oldUser.display_name || oldUser.email) : 'Nepřiřazeno';
                  const newUserName = newUser ? (newUser.first_name && newUser.last_name ? `${newUser.first_name} ${newUser.last_name}` : newUser.display_name || newUser.email) : 'Nepřiřazeno';
                  activityText = `Přiřazení změněno: ${oldUserName} → ${newUserName}`;
                } else if (log.activity_type === 'priority_changed') {
                  const priorityMap: { [key: string]: string } = {
                    'low': 'Nízká',
                    'medium': 'Střední',
                    'high': 'Vysoká'
                  };
                  const oldPriority = log.old_value && log.old_value !== 'null' ? priorityMap[log.old_value] || log.old_value : 'Střední';
                  const newPriority = log.new_value && log.new_value !== 'null' ? priorityMap[log.new_value] || log.new_value : 'Střední';
                  activityText = `Priorita změněna: ${oldPriority} → ${newPriority}`;
                }

                return (
                  <div key={log.id} className="flex items-start gap-1.5 py-0.5">
                    <div className="mt-0.5">{icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] leading-relaxed">
                        <span className="text-gray-700">{activityText}</span>
                        <span className="text-gray-500">
                          {' • '}{userName}{' • '}{new Date(log.created_at).toLocaleString('cs-CZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
