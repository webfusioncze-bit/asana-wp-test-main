import { CheckCircle2Icon, CircleIcon, ClockIcon, AlertCircleIcon, ChevronRightIcon, ChevronDownIcon, FileTextIcon, PlayCircleIcon } from 'lucide-react';
import type { Task, Request } from '../types';

interface TaskItemProps {
  task: Task;
  isSelected: boolean;
  categoryColor: string;
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

export function TaskItem({ task, isSelected, categoryColor, onSelect, onUpdateStatus, hasSubtasks = false, subtaskCount = 0, isExpanded = false, onToggleExpand, isSubtask = false, request, onRequestClick }: TaskItemProps) {
  const getPriorityIcon = () => {
    switch (task.priority) {
      case 'urgent':
        return <AlertCircleIcon className="w-4 h-4 text-red-500" />;
      case 'high':
        return <AlertCircleIcon className="w-4 h-4 text-orange-500" />;
      case 'medium':
        return <ClockIcon className="w-4 h-4 text-yellow-500" />;
      default:
        return <ClockIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'in_progress':
        return 'bg-primary/5 border-primary/20';
      default:
        return 'bg-white border-gray-200';
    }
  };

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const statusOrder: Task['status'][] = ['todo', 'in_progress', 'completed'];
    const currentIndex = statusOrder.indexOf(task.status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    onUpdateStatus(nextStatus);
  };

  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Zpožděno', color: 'text-red-600' };
    if (diffDays === 0) return { text: 'Dnes', color: 'text-orange-600' };
    if (diffDays === 1) return { text: 'Zítra', color: 'text-yellow-600' };
    if (diffDays <= 7) return { text: `${diffDays} dní`, color: 'text-primary' };
    return { text: date.toLocaleDateString('cs-CZ'), color: 'text-gray-600' };
  };

  const dueDate = formatDueDate(task.due_date);

  const getPriorityBadge = () => {
    const colors = {
      urgent: 'bg-red-100 text-red-700 border-red-300',
      high: 'bg-orange-100 text-orange-700 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      low: 'bg-gray-100 text-gray-700 border-gray-300',
    };
    const labels = {
      urgent: 'Urgentní',
      high: 'Vysoká',
      medium: 'Střední',
      low: 'Nízká',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded border ${colors[task.priority]}`}>
        {labels[task.priority]}
      </span>
    );
  };

  return (
    <div
      onClick={onSelect}
      className={`p-2 border-l-4 rounded-lg cursor-pointer transition-all hover:shadow-md ${getStatusColor()} ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      style={{ borderLeftColor: categoryColor }}
    >
      <div className="flex items-center gap-2">
        {hasSubtasks && onToggleExpand && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
            )}
          </button>
        )}
        <button
          onClick={handleStatusClick}
          className="hover:scale-110 transition-transform"
          title={
            task.status === 'completed'
              ? 'Dokončeno - klikni pro vrácení do "K dokončení"'
              : task.status === 'in_progress'
              ? 'Probíhá - klikni pro dokončení'
              : 'K dokončení - klikni pro změnu na "Probíhá"'
          }
        >
          {task.status === 'completed' ? (
            <CheckCircle2Icon className="w-5 h-5 text-green-500" />
          ) : task.status === 'in_progress' ? (
            <PlayCircleIcon className="w-5 h-5 text-primary" />
          ) : (
            <CircleIcon className="w-5 h-5 text-gray-400" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className={`font-medium text-sm text-gray-800 truncate ${
                task.status === 'completed' ? 'line-through text-gray-500' : ''
              }`}
            >
              {task.title}
            </h3>
          </div>
          {request && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onRequestClick && task.request_id) {
                  onRequestClick(task.request_id);
                }
              }}
              className="flex items-center gap-1.5 mt-1 hover:bg-blue-50 rounded px-1.5 py-0.5 -ml-1.5 transition-colors"
            >
              <FileTextIcon className="w-3 h-3 text-blue-500 flex-shrink-0" />
              <span className="text-xs text-blue-600 font-medium truncate">
                {request.title}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {getPriorityBadge()}
          {hasSubtasks && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
              {subtaskCount}
            </span>
          )}
          {dueDate && (
            <div className={`flex items-center gap-1 text-xs ${dueDate.color}`}>
              <ClockIcon className="w-3 h-3" />
              <span>{dueDate.text}</span>
            </div>
          )}
          <div
            className="px-2 py-0.5 rounded text-xs"
            style={{ backgroundColor: categoryColor + '20', color: categoryColor }}
          >
            {task.status === 'todo' && 'K dokončení'}
            {task.status === 'in_progress' && 'Probíhá'}
            {task.status === 'completed' && 'Dokončeno'}
          </div>
        </div>
      </div>
    </div>
  );
}
