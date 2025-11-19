import { useState, useEffect } from 'react';
import { XIcon, CalendarIcon, TagIcon, FolderIcon, TrashIcon, UserIcon, ClockIcon, PlusIcon, RepeatIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Task, TaskComment, Category, Folder, User, TimeEntry } from '../types';

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
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  const [isAddingTime, setIsAddingTime] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
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
    setEditedTask(data || {});
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
      .select('id, email');

    if (error) {
      console.error('Error loading user profiles:', error);
      return;
    }

    setUsers((profiles || []).map(p => ({ id: p.id, email: p.email || '' })));
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

  async function updateTask() {
    const updateData = { ...editedTask, updated_at: new Date().toISOString() };

    if (editedTask.status === 'completed' && task.status !== 'completed') {
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
    } else if (editedTask.status !== 'completed' && task.status === 'completed') {
      updateData.completed_at = null;
      updateData.section_id = null;
    } else if (editedTask.status === 'completed') {
      updateData.completed_at = task.completed_at || new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task:', error);
      return;
    }

    setIsEditing(false);
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
        due_date: newSubtask.due_date || null,
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
    <div className="w-[500px] bg-white border-l border-gray-200 flex flex-col h-screen">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-800">Detail úkolu</h2>
          <div className="flex gap-2">
            <button
              onClick={deleteTask}
              className="p-2 hover:bg-red-50 rounded transition-colors"
            >
              <TrashIcon className="w-5 h-5 text-red-500" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
            >
              <XIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
        {taskHierarchy.length > 1 && (
          <div className="flex items-center gap-2 text-sm text-gray-600 overflow-x-auto">
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

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Název</label>
          {isEditing ? (
            <input
              type="text"
              value={editedTask.title || ''}
              onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          ) : (
            <h3 className="text-xl font-semibold text-gray-800">{task.title}</h3>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Popis</label>
          {isEditing ? (
            <textarea
              value={editedTask.description || ''}
              onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          ) : (
            <p className="text-gray-600">{task.description || 'Bez popisu'}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CalendarIcon className="w-4 h-4 inline mr-2" />
              Termín dokončení
            </label>
            {isEditing ? (
              <input
                type="datetime-local"
                value={editedTask.due_date ? new Date(editedTask.due_date).toISOString().slice(0, 16) : ''}
                onChange={(e) => setEditedTask({ ...editedTask, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            ) : (
              <p className="text-gray-600 text-sm">
                {task.due_date
                  ? new Date(task.due_date).toLocaleString('cs-CZ')
                  : 'Není nastaven'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <UserIcon className="w-4 h-4 inline mr-2" />
              Přiřazeno
            </label>
            {isEditing ? (
              <select
                value={editedTask.assigned_to || task.assigned_to}
                onChange={(e) => setEditedTask({ ...editedTask, assigned_to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.email}</option>
                ))}
              </select>
            ) : (
              <p className="text-gray-600 text-sm truncate">
                {users.find(u => u.id === task.assigned_to)?.email || 'Neznámý uživatel'}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <TagIcon className="w-4 h-4 inline mr-2" />
              Kategorie
            </label>
            {isEditing ? (
              <select
                value={editedTask.category_id || ''}
                onChange={(e) => setEditedTask({ ...editedTask, category_id: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Žádná kategorie</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            ) : (
              <p className="text-gray-600 text-sm">
                {categories.find(c => c.id === task.category_id)?.name || 'Bez kategorie'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FolderIcon className="w-4 h-4 inline mr-2" />
              Složka
            </label>
            {isEditing ? (
              <select
                value={editedTask.folder_id || ''}
                onChange={(e) => setEditedTask({ ...editedTask, folder_id: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Žádná složka</option>
                {buildFolderHierarchy(folders)}
              </select>
            ) : (
              <p className="text-gray-600 text-sm">
                {folders.find(f => f.id === task.folder_id)?.name || 'Bez složky'}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priorita</label>
            {isEditing ? (
              <select
                value={editedTask.priority || 'medium'}
                onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value as Task['priority'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="low">Nízká</option>
                <option value="medium">Střední</option>
                <option value="high">Vysoká</option>
                <option value="urgent">Urgentní</option>
              </select>
            ) : (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${priorityColors[task.priority]}`}>
                {priorityLabels[task.priority]}
              </span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            {isEditing ? (
              <select
                value={editedTask.status || 'todo'}
                onChange={(e) => setEditedTask({ ...editedTask, status: e.target.value as Task['status'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="todo">K dokončení</option>
                <option value="in_progress">Probíhá</option>
                <option value="completed">Dokončeno</option>
              </select>
            ) : (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[task.status]}`}>
                {statusLabels[task.status]}
              </span>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <RepeatIcon className="w-4 h-4 text-gray-600" />
              <label className="text-sm font-medium text-gray-700">
                Opakovaný úkol
              </label>
              <input
                type="checkbox"
                checked={editedTask.is_recurring || false}
                onChange={(e) => setEditedTask({ ...editedTask, is_recurring: e.target.checked })}
                className="ml-auto w-4 h-4 text-primary focus:ring-2 focus:ring-primary rounded"
              />
            </div>

            {editedTask.is_recurring && (
              <div className="space-y-3 pl-6">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Frekvence</label>
                    <select
                      value={editedTask.recurrence_rule || 'weekly'}
                      onChange={(e) => setEditedTask({ ...editedTask, recurrence_rule: e.target.value as any })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="daily">Denně</option>
                      <option value="weekly">Týdně</option>
                      <option value="monthly">Měsíčně</option>
                      <option value="yearly">Ročně</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Interval</label>
                    <input
                      type="number"
                      min="1"
                      value={editedTask.recurrence_interval || 1}
                      onChange={(e) => setEditedTask({ ...editedTask, recurrence_interval: parseInt(e.target.value) })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {editedTask.recurrence_rule === 'weekly' && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Dny v týdnu</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 1, label: 'Po' },
                        { value: 2, label: 'Út' },
                        { value: 3, label: 'St' },
                        { value: 4, label: 'Čt' },
                        { value: 5, label: 'Pá' },
                        { value: 6, label: 'So' },
                        { value: 0, label: 'Ne' },
                      ].map(day => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            const days = editedTask.recurrence_days_of_week || [];
                            const newDays = days.includes(day.value)
                              ? days.filter(d => d !== day.value)
                              : [...days, day.value];
                            setEditedTask({ ...editedTask, recurrence_days_of_week: newDays.length > 0 ? newDays : null });
                          }}
                          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                            (editedTask.recurrence_days_of_week || []).includes(day.value)
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-primary'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {editedTask.recurrence_rule === 'monthly' && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Den v měsíci (1-31)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={editedTask.recurrence_day_of_month || ''}
                      onChange={(e) => setEditedTask({ ...editedTask, recurrence_day_of_month: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="např. 15"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}

                {editedTask.recurrence_rule === 'yearly' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Den</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={editedTask.recurrence_day_of_month || ''}
                        onChange={(e) => setEditedTask({ ...editedTask, recurrence_day_of_month: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="30"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Měsíc</label>
                      <select
                        value={editedTask.recurrence_month || ''}
                        onChange={(e) => setEditedTask({ ...editedTask, recurrence_month: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Vyberte měsíc</option>
                        <option value="1">Leden</option>
                        <option value="2">Únor</option>
                        <option value="3">Březen</option>
                        <option value="4">Duben</option>
                        <option value="5">Květen</option>
                        <option value="6">Červen</option>
                        <option value="7">Červenec</option>
                        <option value="8">Srpen</option>
                        <option value="9">Září</option>
                        <option value="10">Říjen</option>
                        <option value="11">Listopad</option>
                        <option value="12">Prosinec</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Ukončit opakování (volitelné)</label>
                  <input
                    type="date"
                    value={editedTask.recurrence_end_date ? new Date(editedTask.recurrence_end_date).toISOString().slice(0, 10) : ''}
                    onChange={(e) => setEditedTask({ ...editedTask, recurrence_end_date: e.target.value || null })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={updateTask}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Uložit
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditedTask(task);
              }}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Zrušit
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Upravit úkol
          </button>
        )}

        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-700">
              Subtasky ({subtasks.length})
            </h4>
            <button
              onClick={() => setIsAddingSubtask(!isAddingSubtask)}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Přidat
            </button>
          </div>

          {isAddingSubtask && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
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
                    type="datetime-local"
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
                    <option value="">Výchozí ({users.find(u => u.id === task.assigned_to)?.email || 'N/A'})</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.email}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addSubtask}
                  className="flex-1 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
                >
                  Vytvořit
                </button>
                <button
                  onClick={() => {
                    setIsAddingSubtask(false);
                    setNewSubtask({ title: '', description: '', due_date: '', assigned_to: '' });
                  }}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                >
                  Zrušit
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2 mb-6">
            {subtasks.length === 0 ? (
              <p className="text-sm text-gray-500">Zatím žádné subtasky</p>
            ) : (
              subtasks.map(subtask => (
                <div key={subtask.id} className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between mb-1">
                    <button
                      onClick={() => {
                        onClose();
                        setTimeout(() => onTaskUpdated(), 100);
                      }}
                      className="flex-1 text-left"
                    >
                      <span className="text-sm font-medium text-gray-900 hover:text-primary">{subtask.title}</span>
                    </button>
                    <button
                      onClick={() => deleteSubtask(subtask.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700" title={users.find(u => u.id === subtask.assigned_to)?.email}>
                        <UserIcon className="w-3 h-3 mr-1" />
                        {users.find(u => u.id === subtask.assigned_to)?.email?.split('@')[0] || 'N/A'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-700">
              <ClockIcon className="w-4 h-4 inline mr-2" />
              Vykazování času
            </h4>
            <button
              onClick={() => setIsAddingTime(!isAddingTime)}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Přidat
            </button>
          </div>

          {isAddingTime && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
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
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                >
                  Zrušit
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2 mb-6">
            {timeEntries.length === 0 ? (
              <p className="text-sm text-gray-500">Zatím žádné záznamy času</p>
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
                        <TrashIcon className="w-4 h-4" />
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

        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-4">Komentáře</h4>
          <div className="space-y-3 mb-4">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-500">Zatím žádné komentáře</p>
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
      </div>
    </div>
  );
}
