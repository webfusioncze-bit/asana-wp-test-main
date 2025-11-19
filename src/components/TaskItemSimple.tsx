import { CheckCircle2Icon, CircleIcon, UserIcon, CalendarIcon } from 'lucide-react';
import type { Task, Category, User } from '../types';

interface TaskItemSimpleProps {
  task: Task;
  category?: Category;
  assignedUser?: User;
  onClick: () => void;
  onUpdateStatus: (status: Task['status']) => void;
}

export function TaskItemSimple({ task, category, assignedUser, onClick, onUpdateStatus }: TaskItemSimpleProps) {
  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.status === 'completed') {
      onUpdateStatus('todo');
    } else {
      onUpdateStatus('completed');
    }
  };

  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Zpožděno', color: 'text-red-600' };
    if (diffDays === 0) return { text: 'Dnes', color: 'text-orange-600' };
    if (diffDays === 1) return { text: 'Zítra', color: 'text-yellow-600' };
    return { text: date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' }), color: 'text-gray-600' };
  };

  const dueDate = formatDueDate(task.due_date);

  return (
    <div
      onClick={onClick}
      className="group bg-white border border-gray-200 rounded hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer p-2"
    >
      <div className="flex items-center gap-2">
        <button
          onClick={handleStatusClick}
          className="hover:scale-110 transition-transform flex-shrink-0"
        >
          {task.status === 'completed' ? (
            <CheckCircle2Icon className="w-4 h-4 text-green-600 fill-green-50" />
          ) : (
            <CircleIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          )}
        </button>

        <span
          className={`flex-1 text-sm ${
            task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'
          }`}
        >
          {task.title}
        </span>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {category && (
            <div
              className="px-1.5 py-0.5 text-xs font-medium rounded"
              style={{
                backgroundColor: category.color + '15',
                color: category.color
              }}
            >
              {category.name}
            </div>
          )}

          {assignedUser && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-700">
              <UserIcon className="w-3 h-3" />
              <span>{assignedUser.email.split('@')[0]}</span>
            </div>
          )}

          {dueDate && (
            <div className={`flex items-center gap-1 text-xs ${dueDate.color}`}>
              <CalendarIcon className="w-3 h-3" />
              <span>{dueDate.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
