import { useState, useEffect } from 'react';
import { InboxIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TaskItemSimple } from './TaskItemSimple';
import type { Task, Category, User, Folder } from '../types';

interface UnscheduledTasksProps {
  onTaskClick: (taskId: string) => void;
}

interface TasksByFolder {
  [folderId: string]: {
    folder: Folder | null;
    tasks: Task[];
  };
}

export function UnscheduledTasks({ onTaskClick }: UnscheduledTasksProps) {
  const [tasksByFolder, setTasksByFolder] = useState<TasksByFolder>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    await Promise.all([
      loadCategories(),
      loadUsers(),
      loadTasks()
    ]);
    setLoading(false);
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading categories:', error);
      return;
    }

    setCategories(data || []);
  }

  async function loadUsers() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, avatar_url, display_name')
      .order('email', { ascending: true });

    if (error) {
      console.error('Error loading users:', error);
      return;
    }

    setUsers(data || []);
  }

  async function loadTasks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .neq('status', 'completed')
      .is('due_date', null)
      .is('parent_task_id', null)
      .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (tasksError) {
      console.error('Error loading unscheduled tasks:', tasksError);
      return;
    }

    const tasks = tasksData || [];

    if (tasks.length === 0) {
      setTasksByFolder({});
      return;
    }

    const folderIds = [...new Set(tasks.map(t => t.folder_id).filter(Boolean))] as string[];

    let folders: Folder[] = [];
    if (folderIds.length > 0) {
      const { data: foldersData, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .in('id', folderIds);

      if (!foldersError) {
        folders = foldersData || [];
      }
    }

    const grouped: TasksByFolder = {};

    tasks.forEach(task => {
      const folderId = task.folder_id || 'unassigned';
      if (!grouped[folderId]) {
        const folder = folders.find(f => f.id === task.folder_id) || null;
        grouped[folderId] = {
          folder,
          tasks: []
        };
      }
      grouped[folderId].tasks.push(task);
    });

    setTasksByFolder(grouped);
  }

  async function updateTaskStatus(taskId: string, status: Task['status']) {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

    loadTasks();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-500">Načítání...</div>
      </div>
    );
  }

  const totalTasks = Object.values(tasksByFolder).reduce((sum, group) => sum + group.tasks.length, 0);

  if (totalTasks === 0) {
    return null;
  }

  const sortedFolders = Object.entries(tasksByFolder).sort((a, b) => {
    const nameA = a[1].folder?.name || 'Bez složky';
    const nameB = b[1].folder?.name || 'Bez složky';
    return nameA.localeCompare(nameB, 'cs');
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <InboxIcon className="w-5 h-5 text-amber-600" />
          <h3 className="text-sm font-semibold text-amber-600 uppercase tracking-wide">
            Úkoly bez termínu ({totalTasks})
          </h3>
        </div>

        <div className="space-y-2">
          {sortedFolders.map(([folderId, { folder, tasks }]) => (
            <div key={folderId} className="bg-gray-50 rounded-lg p-2">
              <div className="mb-2">
                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {folder?.name || 'Bez složky'} ({tasks.length})
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {tasks.map(task => {
                  const category = categories.find(c => c.id === task.category_id);
                  const assignedUser = users.find(u => u.id === task.assigned_to);
                  const createdByUser = users.find(u => u.id === task.created_by);

                  return (
                    <TaskItemSimple
                      key={task.id}
                      task={task}
                      category={category}
                      assignedUser={assignedUser}
                      createdByUser={createdByUser}
                      onClick={() => onTaskClick(task.id)}
                      onUpdateStatus={(status) => updateTaskStatus(task.id, status)}
                      onSubtaskClick={onTaskClick}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
