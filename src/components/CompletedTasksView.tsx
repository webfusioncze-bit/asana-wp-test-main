import { useState, useEffect, useMemo } from 'react';
import { SearchIcon, FilterIcon, CheckCircle2Icon, UserIcon, ClipboardListIcon, ChevronDownIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TaskItemSimple } from './TaskItemSimple';
import type { Task, Category, User } from '../types';

interface CompletedTasksViewProps {
  onTaskClick: (taskId: string) => void;
  refreshTrigger?: number;
}

type CompletedTab = 'my_completed' | 'created_by_me';

const CZECH_MONTHS = [
  'Leden', 'Unor', 'Brezen', 'Duben', 'Kveten', 'Cerven',
  'Cervenec', 'Srpen', 'Zari', 'Rijen', 'Listopad', 'Prosinec'
];

function getMonthKey(dateString: string | null): string {
  if (!dateString) return 'unknown';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string): string {
  if (key === 'unknown') return 'Bez data';
  const [year, month] = key.split('-');
  return `${CZECH_MONTHS[parseInt(month) - 1]} ${year}`;
}

export function CompletedTasksView({ onTaskClick, refreshTrigger }: CompletedTasksViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CompletedTab>('my_completed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentUser();
    loadCategories();
    loadUsers();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadTasks();
    }
  }, [currentUserId, refreshTrigger]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('completed-tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => loadTasks()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  }

  async function loadCategories() {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    setCategories(data || []);
  }

  async function loadUsers() {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, avatar_url, display_name')
      .order('email', { ascending: true });
    setUsers(data || []);
  }

  async function loadTasks() {
    if (!currentUserId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .is('parent_task_id', null)
      .eq('status', 'completed')
      .or(`assigned_to.eq.${currentUserId},created_by.eq.${currentUserId}`)
      .order('completed_at', { ascending: false });

    if (error) {
      console.error('Error loading completed tasks:', error);
      setLoading(false);
      return;
    }

    setTasks(data || []);
    setLoading(false);
  }

  async function updateTaskStatus(taskId: string, status: Task['status']) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updateData: Record<string, unknown> = {
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (status !== 'completed' && task.previous_folder_id) {
      updateData.folder_id = task.previous_folder_id;
      updateData.previous_folder_id = null;
    }

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task status:', error);
      return;
    }

    loadTasks();
  }

  const filteredTasks = useMemo(() => {
    if (!currentUserId) return [];

    let filtered = tasks;

    if (activeTab === 'my_completed') {
      filtered = filtered.filter(t => t.assigned_to === currentUserId);
    } else {
      filtered = filtered.filter(t => t.created_by === currentUserId && t.assigned_to !== currentUserId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(q));
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category_id === selectedCategory);
    }

    if (selectedPriority !== 'all') {
      filtered = filtered.filter(t => t.priority === selectedPriority);
    }

    return filtered;
  }, [tasks, currentUserId, activeTab, searchQuery, selectedCategory, selectedPriority]);

  const groupedByMonth = useMemo(() => {
    const groups: { key: string; label: string; tasks: Task[] }[] = [];
    const map = new Map<string, Task[]>();

    for (const task of filteredTasks) {
      const key = getMonthKey(task.completed_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }

    const sortedKeys = [...map.keys()].sort((a, b) => b.localeCompare(a));
    for (const key of sortedKeys) {
      groups.push({ key, label: getMonthLabel(key), tasks: map.get(key)! });
    }

    return groups;
  }, [filteredTasks]);

  const toggleMonth = (key: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const myCompletedCount = tasks.filter(t => t.assigned_to === currentUserId).length;
  const createdByMeCount = tasks.filter(t => t.created_by === currentUserId && t.assigned_to !== currentUserId).length;

  const hasActiveFilters = selectedCategory !== 'all' || selectedPriority !== 'all';

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
        <button
          onClick={() => setActiveTab('my_completed')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'my_completed'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <CheckCircle2Icon className="w-3.5 h-3.5" />
          <span>Moje dokoncene</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
            activeTab === 'my_completed' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
          }`}>
            {myCompletedCount}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('created_by_me')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'created_by_me'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ClipboardListIcon className="w-3.5 h-3.5" />
          <span>Zadane mnou</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
            activeTab === 'created_by_me' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
          }`}>
            {createdByMeCount}
          </span>
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat v dokoncených..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
            hasActiveFilters
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FilterIcon className="w-3.5 h-3.5" />
          Filtr
        </button>
      </div>

      {showFilters && (
        <div className="flex gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Vsechny kategorie</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">Vsechny priority</option>
            <option value="urgent">Urgentni</option>
            <option value="high">Vysoka</option>
            <option value="medium">Stredni</option>
            <option value="low">Nizka</option>
          </select>
          {hasActiveFilters && (
            <button
              onClick={() => { setSelectedCategory('all'); setSelectedPriority('all'); }}
              className="px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              Zrusit
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-sm text-gray-500">Nacitani...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle2Icon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {searchQuery || hasActiveFilters
              ? 'Zadne dokoncene ukoly neodpovidaji filtru'
              : activeTab === 'my_completed'
              ? 'Zatim zadne dokoncene ukoly'
              : 'Zatim zadne dokoncene zadane ukoly'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByMonth.map(group => {
            const isCollapsed = collapsedMonths.has(group.key);
            return (
              <div key={group.key}>
                <button
                  onClick={() => toggleMonth(group.key)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  <span>{group.label}</span>
                  <span className="text-[10px] font-normal text-gray-500">
                    ({group.tasks.length})
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-1 mt-1">
                    {group.tasks.map(task => {
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
                          onParentTaskClick={onTaskClick}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center text-[10px] text-gray-400 pt-2">
        {filteredTasks.length} z {tasks.filter(t =>
          activeTab === 'my_completed'
            ? t.assigned_to === currentUserId
            : t.created_by === currentUserId && t.assigned_to !== currentUserId
        ).length} ukolu
      </div>
    </div>
  );
}
