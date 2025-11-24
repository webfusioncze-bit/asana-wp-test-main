import { useState, useEffect } from 'react';
import { AlertCircleIcon, CalendarIcon, TrendingUpIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TaskItemSimple } from './TaskItemSimple';
import type { Task, Category, User } from '../types';

interface TaskOverviewProps {
  onTaskClick: (taskId: string) => void;
}

export function TaskOverview({ onTaskClick }: TaskOverviewProps) {
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [thisWeekTasks, setThisWeekTasks] = useState<Task[]>([]);
  const [nextWeekTasks, setNextWeekTasks] = useState<Task[]>([]);
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
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const today = now.toISOString();

    const endOfThisWeek = new Date(now);
    endOfThisWeek.setDate(now.getDate() + (7 - now.getDay()));
    endOfThisWeek.setHours(23, 59, 59, 999);

    const endOfNextWeek = new Date(endOfThisWeek);
    endOfNextWeek.setDate(endOfThisWeek.getDate() + 7);

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .neq('status', 'completed')
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error loading tasks:', error);
      return;
    }

    const allTasks = data || [];

    const overdue: Task[] = [];
    const thisWeek: Task[] = [];
    const nextWeek: Task[] = [];

    allTasks.forEach(task => {
      if (!task.due_date) return;

      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < now) {
        overdue.push(task);
      } else if (dueDate <= endOfThisWeek) {
        thisWeek.push(task);
      } else if (dueDate <= endOfNextWeek) {
        nextWeek.push(task);
      }
    });

    setOverdueTasks(overdue);
    setThisWeekTasks(thisWeek);
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

  const totalTasks = overdueTasks.length + thisWeekTasks.length + nextWeekTasks.length;

  if (totalTasks === 0) {
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

      {thisWeekTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarIcon className="w-5 h-5 text-orange-600" />
            <h3 className="text-sm font-semibold text-orange-600 uppercase tracking-wide">
              Tento týden ({thisWeekTasks.length})
            </h3>
          </div>
          <div className="space-y-1.5">
            {thisWeekTasks.map(task => {
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

      {nextWeekTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUpIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
              Příští týden ({nextWeekTasks.length})
            </h3>
          </div>
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
        </div>
      )}
    </div>
  );
}
