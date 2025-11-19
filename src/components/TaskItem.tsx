import { CheckCircle2Icon, CircleIcon, UserIcon, ListChecksIcon, ChevronRightIcon, ChevronDownIcon } from 'lucide-react';
import type { Task, Request } from '../types';

interface TaskItemProps {
  task: Task;
  isSelected: boolean;
  categoryColor: string;
  categoryName?: string;
  assignedUserEmail?: string;
  onSelect: () => void;
  onUpdateStatus: (status: Task['status']) => void;
  hasSubtasks?: boolean;
  subtaskCount?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isSubtask?: boolean;
  request?: Request;
  onRequestClick?: (requestId: string) => void;
}

export function TaskItem({
  task,
  isSelected,
  categoryColor,
  categoryName,
  assignedUserEmail,
  onSelect,
  onUpdateStatus,
  hasSubtasks = false,
  subtaskCount = 0,
  isExpanded = false,
  onToggleExpand,
  isSubtask = false
}: TaskItemProps) {

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.status === 'completed') {
      onUpdateStatus('todo');
    } else {
      onUpdateStatus('completed');
    }
  };

  const getPriorityColor = () => {
    switch (task.priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityLabel = () => {
    switch (task.priority) {
      case 'urgent':
        return 'Urgentní';
      case 'high':
        return 'Vysoká';
      case 'medium':
        return 'Střední';
      case 'low':
        return 'Nízká';
      default:
        return 'Bez priority';
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

    if (diffDays < 0) return { text: 'Zpožděno', color: 'bg-red-100 text-red-700 border-red-200' };
    if (diffDays === 0) return { text: 'Dnes', color: 'bg-orange-100 text-orange-700 border-orange-200' };
    if (diffDays === 1) return { text: 'Zítra', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    return { text: date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' }), color: 'bg-gray-100 text-gray-700 border-gray-200' };
  };

  const dueDate = formatDueDate(task.due_date);

  return (
    <div
      onClick={onSelect}
      className={`group relative bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer mb-2 ${
        isSelected ? 'ring-2 ring-primary border-primary' : ''
      } ${isSubtask ? 'ml-8' : ''}`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasSubtasks && onToggleExpand && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="p-0.5 hover:bg-gray-100 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRightIcon className="w-4 h-4 text-gray-500" />
              )}
            </button>
          )}

          <button
            onClick={handleStatusClick}
            className="hover:scale-110 transition-transform flex-shrink-0"
          >
            {task.status === 'completed' ? (
              <CheckCircle2Icon className="w-5 h-5 text-green-600 fill-green-50" />
            ) : (
              <CircleIcon className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            )}
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <span
            className={`text-sm text-gray-900 ${
              task.status === 'completed' ? 'line-through text-gray-500' : ''
            }`}
          >
            {task.title}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {assignedUserEmail && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
              <UserIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-700">
                {assignedUserEmail.split('@')[0]}
              </span>
            </div>
          )}

          {hasSubtasks && subtaskCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md border border-gray-200">
              <ListChecksIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-700">{subtaskCount}</span>
            </div>
          )}

          {categoryName && (
            <div
              className="px-2.5 py-1 text-xs font-medium rounded-md border"
              style={{
                backgroundColor: categoryColor + '15',
                color: categoryColor,
                borderColor: categoryColor + '30'
              }}
            >
              {categoryName}
            </div>
          )}

          {task.priority !== 'low' && (
            <div className={`px-2.5 py-1 text-xs font-medium rounded-md border ${getPriorityColor()}`}>
              {getPriorityLabel()}
            </div>
          )}

          {dueDate && (
            <div className={`px-2.5 py-1 text-xs font-medium rounded-md border ${dueDate.color}`}>
              {dueDate.text}
            </div>
          )}

          {task.status === 'in_progress' && (
            <div className="px-2.5 py-1 text-xs font-medium rounded-md border bg-blue-100 text-blue-700 border-blue-200">
              Probíhá
            </div>
          )}

          {task.status === 'completed' && (
            <div className="px-2.5 py-1 text-xs font-medium rounded-md border bg-green-100 text-green-700 border-green-200">
              Dokončeno
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
