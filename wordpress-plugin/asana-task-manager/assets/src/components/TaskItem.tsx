import React, { useState } from 'react';
import { Circle, CheckCircle2, ChevronRight, ChevronDown, Calendar, AlertCircle } from 'lucide-react';
import { Task, User, Category } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

interface TaskItemProps {
  task: Task;
  tasks: Task[];
  users: User[];
  categories: Category[];
  onSelectTask: (task: Task) => void;
  onRefresh: () => void;
  supabase: SupabaseClient;
  currentUser: User;
  isOverdue: boolean;
  isToday: boolean;
  level?: number;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  tasks,
  users,
  categories,
  onSelectTask,
  onRefresh,
  supabase,
  currentUser,
  isOverdue,
  isToday,
  level = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const subtasks = tasks.filter(t => t.parent_task_id === task.id);
  const assignedUser = users.find(u => u.id === task.assigned_to);
  const category = categories.find(c => c.id === task.category_id);

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    const completed_at = newStatus === 'completed' ? new Date().toISOString() : null;

    try {
      await supabase
        .from('tasks')
        .update({ status: newStatus, completed_at })
        .eq('id', task.id);
      onRefresh();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return '#EF4444';
      case 'high':
        return '#F59E0B';
      case 'medium':
        return '#3B82F6';
      case 'low':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    ) {
      return 'Dnes';
    }

    if (
      d.getDate() === tomorrow.getDate() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getFullYear() === tomorrow.getFullYear()
    ) {
      return 'Zítra';
    }

    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
  };

  return (
    <>
      <div
        className={`atm-task-item ${task.status === 'completed' ? 'completed' : ''} ${
          isOverdue ? 'overdue' : ''
        }`}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
        onClick={() => onSelectTask(task)}
      >
        <div className="atm-task-item-left">
          <button
            className="atm-task-checkbox"
            onClick={handleToggleComplete}
            style={{ color: getPriorityColor(task.priority) }}
          >
            {task.status === 'completed' ? (
              <CheckCircle2 size={18} />
            ) : (
              <Circle size={18} />
            )}
          </button>

          <div className="atm-task-content">
            <div className="atm-task-title">{task.title}</div>
            <div className="atm-task-meta">
              {task.due_date && (
                <span
                  className={`atm-task-due ${isOverdue ? 'overdue' : ''} ${
                    isToday ? 'today' : ''
                  }`}
                >
                  {isOverdue && <AlertCircle size={12} />}
                  <Calendar size={12} />
                  {formatDate(task.due_date)}
                </span>
              )}
              {category && (
                <span className="atm-task-category" style={{ color: category.color }}>
                  {category.name}
                </span>
              )}
              {subtasks.length > 0 && (
                <span className="atm-task-subtasks">
                  {subtasks.filter(s => s.status === 'completed').length}/{subtasks.length}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="atm-task-item-right">
          {assignedUser && (
            <div className="atm-task-assignee" title={assignedUser.display_name}>
              {assignedUser.display_name.charAt(0).toUpperCase()}
            </div>
          )}

          {subtasks.length > 0 && (
            <button
              className="atm-task-expand"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
        </div>
      </div>

      {isExpanded &&
        subtasks.map(subtask => (
          <TaskItem
            key={subtask.id}
            task={subtask}
            tasks={tasks}
            users={users}
            categories={categories}
            onSelectTask={onSelectTask}
            onRefresh={onRefresh}
            supabase={supabase}
            currentUser={currentUser}
            isOverdue={!subtask.due_date ? false : new Date(subtask.due_date) < new Date()}
            isToday={
              !subtask.due_date
                ? false
                : new Date(subtask.due_date).toDateString() === new Date().toDateString()
            }
            level={level + 1}
          />
        ))}
    </>
  );
};
