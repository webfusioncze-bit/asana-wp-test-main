import { useState, useEffect } from 'react';
import { AlertCircleIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TaskItemSimple } from './TaskItemSimple';
import type { Task, Category, User } from '../types';

interface TaskOverviewProps {
  onTaskClick: (taskId: string) => void;
}

function getWeekBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatWeekRange(start: Date, end: Date): string {
  const startStr = `${start.getDate()}.${start.getMonth() + 1}.`;
  const endStr = `${end.getDate()}.${end.getMonth() + 1}.${end.getFullYear()}`;
  return `${startStr} - ${endStr}`;
}

function getWeekLabel(weekOffset: number): string {
  if (weekOffset === 0) return 'Tento týden';
  if (weekOffset === 1) return 'Příští týden';
  if (weekOffset === 2) return 'Za 2 týdny';
  if (weekOffset === 3) return 'Za 3 týdny';
  if (weekOffset > 3) return `Za ${weekOffset} týdnů`;
  if (weekOffset === -1) return 'Minulý týden';
  if (weekOffset === -2) return 'Před 2 týdny';
  return `Před ${Math.abs(weekOffset)} týdny`;
}

export function TaskOverview({ onTaskClick }: TaskOverviewProps) {
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [currentWeekTasks, setCurrentWeekTasks] = useState<Task[]>([]);
  const [nextWeekTasks, setNextWeekTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextWeekOffset, setNextWeekOffset] = useState(1);

  useEffect(() => {
    loadAllData();
  }, [nextWeekOffset]);

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
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const { start: currentWeekStart, end: currentWeekEnd } = getWeekBounds(now);

    const nextWeekDate = new Date(now);
    nextWeekDate.setDate(now.getDate() + (nextWeekOffset * 7));
    const { start: nextWeekStart, end: nextWeekEnd } = getWeekBounds(nextWeekDate);

    // Získat ID aktuálního uživatele
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Načíst pouze úkoly vytvořené nebo přiřazené přihlášenému uživateli
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .neq('status', 'completed')
      .not('due_date', 'is', null)
      .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error loading tasks:', error);
      return;
    }

    const allTasks = data || [];
    const overdue: Task[] = [];
    const currentWeek: Task[] = [];
    const nextWeek: Task[] = [];

    allTasks.forEach(task => {
      if (!task.due_date) return;

      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < now) {
        overdue.push(task);
      } else if (dueDate >= currentWeekStart && dueDate <= currentWeekEnd) {
        currentWeek.push(task);
      } else if (dueDate >= nextWeekStart && dueDate <= nextWeekEnd) {
        nextWeek.push(task);
      }
    });

    setOverdueTasks(overdue);
    setCurrentWeekTasks(currentWeek);
    setNextWeekTasks(nextWeek);
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
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Načítání...</div>
      </div>
    );
  }

  const now = new Date();
  const { start: currentWeekStart, end: currentWeekEnd } = getWeekBounds(now);

  const nextWeekDate = new Date(now);
  nextWeekDate.setDate(now.getDate() + (nextWeekOffset * 7));
  const { start: nextWeekStart, end: nextWeekEnd } = getWeekBounds(nextWeekDate);

  const totalTasks = overdueTasks.length + currentWeekTasks.length + nextWeekTasks.length;

  if (totalTasks === 0 && nextWeekOffset === 1) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Žádné nadcházející úkoly s termínem</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {overdueTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircleIcon className="w-5 h-5 text-red-600" />
            <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wide">
              Zpožděné ({overdueTasks.length})
            </h3>
          </div>
          <div className="space-y-1.5">
            {overdueTasks.map(task => {
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
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
              Tento týden ({currentWeekTasks.length})
            </h3>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            {formatWeekRange(currentWeekStart, currentWeekEnd)}
          </span>
        </div>
        {currentWeekTasks.length > 0 ? (
          <div className="space-y-1.5">
            {currentWeekTasks.map(task => {
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
        ) : (
          <div className="text-center py-6 text-gray-400 text-sm">
            Žádné úkoly v tomto týdnu
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-green-600" />
            <h3 className="text-sm font-semibold text-green-600 uppercase tracking-wide">
              {getWeekLabel(nextWeekOffset)} ({nextWeekTasks.length})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNextWeekOffset(prev => Math.max(1, prev - 1))}
              disabled={nextWeekOffset === 1}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Předchozí týden"
            >
              <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-xs text-gray-600 font-medium min-w-[140px] text-center">
              {formatWeekRange(nextWeekStart, nextWeekEnd)}
            </span>
            <button
              onClick={() => setNextWeekOffset(prev => prev + 1)}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
              title="Další týden"
            >
              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
            </button>
            {nextWeekOffset !== 1 && (
              <button
                onClick={() => setNextWeekOffset(1)}
                className="ml-2 px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors font-medium"
              >
                Příští týden
              </button>
            )}
          </div>
        </div>
        {nextWeekTasks.length > 0 ? (
          <div className="space-y-1.5">
            {nextWeekTasks.map(task => {
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
        ) : (
          <div className="text-center py-6 text-gray-400 text-sm">
            Žádné úkoly v tomto týdnu
          </div>
        )}
      </div>
    </div>
  );
}
