import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Task, User, Category } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';
import { TaskItem } from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  users: User[];
  categories: Category[];
  onSelectTask: (task: Task) => void;
  onRefresh: () => void;
  supabase: SupabaseClient;
  currentUser: User;
  selectedFolder: string | null;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  users,
  categories,
  onSelectTask,
  onRefresh,
  supabase,
  currentUser,
  selectedFolder,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;

    try {
      await supabase.from('tasks').insert({
        title: newTaskTitle,
        description: '',
        folder_id: selectedFolder,
        assigned_to: currentUser.id,
        created_by: currentUser.id,
        priority: 'medium',
        status: 'todo',
        position: tasks.length,
      });

      setNewTaskTitle('');
      setIsCreating(false);
      onRefresh();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const mainTasks = tasks.filter(t => !t.parent_task_id);

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'completed') return false;
    return new Date(task.due_date) < new Date();
  };

  const isToday = (task: Task) => {
    if (!task.due_date || task.status === 'completed') return false;
    const today = new Date();
    const dueDate = new Date(task.due_date);
    return (
      dueDate.getDate() === today.getDate() &&
      dueDate.getMonth() === today.getMonth() &&
      dueDate.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="atm-task-list">
      <div className="atm-task-list-header">
        <button
          className="atm-add-task-button"
          onClick={() => setIsCreating(true)}
        >
          <Plus size={16} />
          Přidat úkol
        </button>
      </div>

      {isCreating && (
        <div className="atm-task-create">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Název úkolu"
            autoFocus
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleCreateTask();
              if (e.key === 'Escape') setIsCreating(false);
            }}
          />
          <div className="atm-task-create-actions">
            <button onClick={handleCreateTask}>Vytvořit</button>
            <button onClick={() => setIsCreating(false)}>Zrušit</button>
          </div>
        </div>
      )}

      {mainTasks.length === 0 ? (
        <div className="atm-empty-state">
          <p>Žádné úkoly k zobrazení</p>
        </div>
      ) : (
        <div className="atm-tasks">
          {mainTasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              tasks={tasks}
              users={users}
              categories={categories}
              onSelectTask={onSelectTask}
              onRefresh={onRefresh}
              supabase={supabase}
              currentUser={currentUser}
              isOverdue={isOverdue(task)}
              isToday={isToday(task)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
