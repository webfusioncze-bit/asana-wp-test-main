import { useState, useEffect } from 'react';
import { PlusIcon, SearchIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Task, Category, Request } from '../types';
import { TaskItem } from './TaskItem';
import { TaskCreationPanel } from './TaskCreationPanel';

interface TaskListProps {
  folderId: string | null;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string | null) => void;
  onOpenRequest?: (requestId: string) => void;
}

export function TaskList({ folderId, selectedTaskId, onSelectTask, onOpenRequest }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreationPanel, setShowCreationPanel] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [subtasks, setSubtasks] = useState<Record<string, Task[]>>({});
  const [subtaskCounts, setSubtaskCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadTasks();
    loadCategories();
    loadRequests();
  }, [folderId]);

  async function loadTasks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (folderId) {
      const { data: folderData } = await supabase
        .from('folders')
        .select('name')
        .eq('id', folderId)
        .maybeSingle();

      const isCompletedFolder = folderData?.name === 'Dokončené';

      let query = supabase
        .from('tasks')
        .select('*')
        .eq('folder_id', folderId)
        .is('parent_task_id', null);

      if (isCompletedFolder) {
        query = query.order('completed_at', { ascending: false });
      } else {
        query = query.order('position', { ascending: true });
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading tasks:', error);
        return;
      }

      const directTasks = data || [];

      // Najdi tasky, kde má uživatel přiřazené subtasky
      const { data: userSubtasks } = await supabase
        .from('tasks')
        .select('parent_task_id')
        .eq('assigned_to', user.id)
        .eq('folder_id', folderId)
        .not('parent_task_id', 'is', null);

      const parentTaskIds = [...new Set((userSubtasks || []).map(st => st.parent_task_id).filter(Boolean))];

      // Načti parent tasky, pokud již nejsou v seznamu
      const missingParentIds = parentTaskIds.filter(id => !directTasks.some(t => t.id === id));

      if (missingParentIds.length > 0) {
        const { data: parentTasks } = await supabase
          .from('tasks')
          .select('*')
          .in('id', missingParentIds);

        const allTasks = [...directTasks, ...(parentTasks || [])];

        // Seřaď podle pozice
        allTasks.sort((a, b) => (a.position || 0) - (b.position || 0));
        setTasks(allTasks);
        await loadSubtaskCounts(allTasks);
      } else {
        setTasks(directTasks);
        await loadSubtaskCounts(directTasks);
      }
    } else {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .neq('status', 'completed')
        .is('parent_task_id', null)
        .order('position', { ascending: true });

      if (error) {
        console.error('Error loading tasks:', error);
        return;
      }

      setTasks(data || []);
      await loadSubtaskCounts(data || []);
    }
  }

  async function loadSubtaskCounts(parentTasks: Task[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const counts: Record<string, number> = {};

    for (const task of parentTasks) {
      const isAssignedToParent = task.assigned_to === user.id;

      let query = supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('parent_task_id', task.id);

      // Pokud není přiřazen k parent tasku, počítaj jen jeho subtasky
      if (!isAssignedToParent) {
        query = query.eq('assigned_to', user.id);
      }

      const { count } = await query;
      counts[task.id] = count || 0;
    }

    setSubtaskCounts(counts);
  }

  async function loadSubtasksForTask(taskId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Najdi parent task
    const parentTask = tasks.find(t => t.id === taskId);
    const isAssignedToParent = parentTask?.assigned_to === user.id;

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('parent_task_id', taskId)
      .order('position', { ascending: true });

    // Pokud není přiřazen k parent tasku, zobraz jen jeho subtasky
    if (!isAssignedToParent) {
      query = query.eq('assigned_to', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading subtasks:', error);
      return;
    }

    setSubtasks(prev => ({ ...prev, [taskId]: data || [] }));
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

  async function loadRequests() {
    const { data, error } = await supabase
      .from('requests')
      .select('id, title');

    if (error) {
      console.error('Error loading requests:', error);
      return;
    }

    setRequests(data || []);
  }


  async function updateTaskStatus(taskId: string, status: Task['status']) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updateData: any = {
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: completedFolder } = await supabase
          .from('folders')
          .select('id')
          .eq('owner_id', user.id)
          .eq('name', 'Dokončené')
          .eq('folder_type', 'tasks')
          .maybeSingle();

        if (completedFolder) {
          updateData.previous_folder_id = task.folder_id;
          updateData.folder_id = completedFolder.id;
        }
      }
    } else if (task.status === 'completed' && status !== 'completed') {
      if (task.previous_folder_id) {
        updateData.folder_id = task.previous_folder_id;
        updateData.previous_folder_id = null;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: defaultFolder } = await supabase
            .from('folders')
            .select('id')
            .eq('owner_id', user.id)
            .eq('folder_type', 'tasks')
            .neq('name', 'Dokončené')
            .order('position', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (defaultFolder) {
            updateData.folder_id = defaultFolder.id;
          }
        }
      }
    }

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task:', error);
      return;
    }

    if (status === 'completed' && updateData.folder_id && updateData.folder_id !== folderId) {
      setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
    } else if (task.status === 'completed' && status !== 'completed' && updateData.folder_id && updateData.folder_id !== folderId) {
      setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
    } else {
      loadTasks();
    }
  }

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const rootTasks = filteredTasks.filter(task => !task.parent_task_id);

  const getSubtasks = (parentId: string) => {
    return subtasks[parentId] || [];
  };

  const toggleExpand = async (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
      if (!subtasks[taskId]) {
        await loadSubtasksForTask(taskId);
      }
    }
    setExpandedTasks(newExpanded);
  };

  const renderTaskWithSubtasks = (task: Task, depth: number = 0) => {
    const taskSubtasks = getSubtasks(task.id);
    const isExpanded = expandedTasks.has(task.id);
    const request = task.request_id ? requests.find(r => r.id === task.request_id) : undefined;
    const subtaskCount = subtaskCounts[task.id] || 0;

    return (
      <div key={task.id}>
        <TaskItem
          task={task}
          isSelected={selectedTaskId === task.id}
          categoryColor={getCategoryColor(task.category_id)}
          onSelect={() => onSelectTask(task.id)}
          onUpdateStatus={(status) => updateTaskStatus(task.id, status)}
          hasSubtasks={subtaskCount > 0}
          subtaskCount={subtaskCount}
          isExpanded={isExpanded}
          onToggleExpand={() => toggleExpand(task.id)}
          isSubtask={depth > 0}
          request={request}
          onRequestClick={onOpenRequest}
        />
        {isExpanded && taskSubtasks.length > 0 && (
          <div className="ml-8 mt-2 space-y-2 border-l-2 border-gray-200 pl-4">
            {taskSubtasks.map(subtask => renderTaskWithSubtasks(subtask, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const getCategoryColor = (categoryId: string | null) => {
    if (!categoryId) return '#6B7280';
    const category = categories.find(c => c.id === categoryId);
    return category?.color || '#6B7280';
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800">
            {folderId ? 'Úkoly' : 'Všechny úkoly'}
          </h1>
          <button
            onClick={() => setShowCreationPanel(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Nový úkol
          </button>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat úkoly..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Vše
            </button>
            <button
              onClick={() => setFilterStatus('todo')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'todo'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              K dokončení
            </button>
            <button
              onClick={() => setFilterStatus('in_progress')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'in_progress'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Probíhající
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filterStatus === 'completed'
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Dokončené
            </button>
          </div>
        </div>

      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {rootTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? 'Žádné úkoly neodpovídají vašemu hledání' : 'Zatím žádné úkoly'}
          </div>
        ) : (
          <div className="space-y-2">
            {rootTasks.map(task => renderTaskWithSubtasks(task))}
          </div>
        )}
      </div>

      {showCreationPanel && (
        <TaskCreationPanel
          folderId={folderId}
          onClose={() => setShowCreationPanel(false)}
          onTaskCreated={() => {
            setShowCreationPanel(false);
            loadTasks();
          }}
        />
      )}
    </div>
  );
}
