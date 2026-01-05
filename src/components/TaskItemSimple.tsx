import { useState, useEffect } from 'react';
import { CheckCircle2Icon, CircleIcon, UserIcon, CalendarIcon, ChevronDownIcon, ChevronRightIcon, AlertCircleIcon, PaperclipIcon, GripVerticalIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TaskTagsQuickEdit } from './TaskTagsQuickEdit';
import type { Task, Category, User, FolderTag } from '../types';

interface TaskItemSimpleProps {
  task: Task;
  category?: Category;
  assignedUser?: User;
  createdByUser?: User;
  onClick: () => void;
  onUpdateStatus: (status: Task['status']) => void;
  onSubtaskClick?: (taskId: string) => void;
  onDragStart?: (task: Task) => void;
  draggable?: boolean;
}

export function TaskItemSimple({ task, category, assignedUser, createdByUser, onClick, onUpdateStatus, onSubtaskClick, onDragStart, draggable = false }: TaskItemSimpleProps) {
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [subtaskCategories, setSubtaskCategories] = useState<Category[]>([]);
  const [subtaskUsers, setSubtaskUsers] = useState<User[]>([]);
  const [hasAttachments, setHasAttachments] = useState(false);
  const [taskTags, setTaskTags] = useState<FolderTag[]>([]);
  const [taskTagIds, setTaskTagIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadSubtasks();
    checkAttachments();
    loadTaskTags();
  }, [task.id]);

  async function loadTaskTags() {
    if (!task.folder_id) return;

    const { data: taskTagsData, error } = await supabase
      .from('task_tags')
      .select('tag_id, folder_tags(*)')
      .eq('task_id', task.id);

    if (error) {
      console.error('Error loading task tags:', error);
      return;
    }

    const tags = taskTagsData
      ?.map(tt => tt.folder_tags)
      .filter(Boolean) as FolderTag[];

    setTaskTags(tags || []);
    setTaskTagIds(taskTagsData?.map(tt => tt.tag_id) || []);
  }

  async function checkAttachments() {
    const { data, error } = await supabase
      .from('task_attachments')
      .select('id')
      .eq('task_id', task.id)
      .limit(1);

    if (!error && data && data.length > 0) {
      setHasAttachments(true);
    }
  }

  async function loadSubtasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_task_id', task.id)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading subtasks:', error);
      return;
    }

    setSubtasks(data || []);

    if (data && data.length > 0) {
      const categoryIds = [...new Set(data.map(t => t.category_id).filter(Boolean))];
      const userIds = [...new Set(data.map(t => t.assigned_to).filter(Boolean))];

      if (categoryIds.length > 0) {
        const { data: cats } = await supabase
          .from('categories')
          .select('*')
          .in('id', categoryIds);
        setSubtaskCategories(cats || []);
      }

      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('user_profiles')
          .select('id, email')
          .in('id', userIds);
        setSubtaskUsers(users || []);
      }
    }
  }

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
  const completedSubtasks = subtasks.filter(s => s.status === 'completed').length;
  const totalSubtasks = subtasks.length;

  const getPriorityInfo = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent':
        return { text: 'Urgentní', color: 'text-red-600', bgColor: 'bg-red-50' };
      case 'high':
        return { text: 'Vysoká', color: 'text-orange-600', bgColor: 'bg-orange-50' };
      case 'medium':
        return { text: 'Střední', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
      case 'low':
        return { text: 'Nízká', color: 'text-gray-600', bgColor: 'bg-gray-50' };
      default:
        return null;
    }
  };

  const priorityInfo = getPriorityInfo(task.priority);

  const uniqueSubtaskAssignees = [...new Set(subtasks.map(s => s.assigned_to).filter(Boolean))];
  const subtaskAssigneeUsers = uniqueSubtaskAssignees
    .map(id => subtaskUsers.find(u => u.id === id))
    .filter(Boolean) as User[];

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleSubtaskStatusClick = async (e: React.MouseEvent, subtaskId: string, currentStatus: Task['status']) => {
    e.stopPropagation();
    const newStatus = currentStatus === 'completed' ? 'todo' : 'completed';

    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (newStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();

      const { data: subtaskData } = await supabase
        .from('tasks')
        .select('folder_id')
        .eq('id', subtaskId)
        .maybeSingle();

      if (subtaskData?.folder_id) {
        const { data: completedSection } = await supabase
          .from('task_sections')
          .select('id')
          .eq('folder_id', subtaskData.folder_id)
          .eq('name', 'Dokončené')
          .maybeSingle();

        if (completedSection) {
          updateData.section_id = completedSection.id;
        } else {
          const { data: sections } = await supabase
            .from('task_sections')
            .select('position')
            .eq('folder_id', subtaskData.folder_id)
            .order('position', { ascending: false })
            .limit(1);

          const maxPosition = sections?.[0]?.position ?? -1;

          const { data: newSection } = await supabase
            .from('task_sections')
            .insert({
              folder_id: subtaskData.folder_id,
              name: 'Dokončené',
              position: maxPosition + 1,
              is_collapsed: false
            })
            .select()
            .single();

          if (newSection) {
            updateData.section_id = newSection.id;
          }
        }
      }
    } else {
      updateData.completed_at = null;
      updateData.section_id = null;
    }

    await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', subtaskId);

    loadSubtasks();
  };

  return (
    <div className="group">
      <div
        onClick={onClick}
        className={`bg-white border border-gray-200 rounded hover:border-blue-300 hover:shadow-sm transition-all p-2 cursor-pointer ${
          isDragging ? 'opacity-50' : ''
        }`}
      >
        <div className="flex items-center gap-2">
        {draggable && (
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              setIsDragging(true);
              if (onDragStart) {
                onDragStart(task);
              }
            }}
            onDragEnd={() => {
              setTimeout(() => setIsDragging(false), 100);
            }}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            title="Přetáhnout úkol"
          >
            <GripVerticalIcon className="w-4 h-4" />
          </div>
        )}
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
          {totalSubtasks > 0 && (
            <button
              onClick={handleExpandClick}
              className="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-700 transition-colors"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-3 h-3" />
              ) : (
                <ChevronRightIcon className="w-3 h-3" />
              )}
              <span>{completedSubtasks}/{totalSubtasks}</span>
            </button>
          )}

          {subtaskAssigneeUsers.length > 0 && (
            <div className="flex -space-x-1">
              {subtaskAssigneeUsers.slice(0, 3).map((user, index) => (
                <div
                  key={user.id}
                  className="relative"
                  title={user.display_name || user.email}
                  style={{ zIndex: subtaskAssigneeUsers.length - index }}
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name || user.email}
                      className="w-5 h-5 rounded-full object-cover border-2 border-white"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center">
                      <UserIcon className="w-3 h-3 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}
              {subtaskAssigneeUsers.length > 3 && (
                <div
                  className="w-5 h-5 rounded-full bg-gray-400 border-2 border-white flex items-center justify-center text-xs text-white font-medium"
                  title={`+${subtaskAssigneeUsers.length - 3} dalších`}
                >
                  +{subtaskAssigneeUsers.length - 3}
                </div>
              )}
            </div>
          )}

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

          {taskTags.map((tag) => (
            <div
              key={tag.id}
              className="px-1.5 py-0.5 text-xs font-medium rounded"
              style={{
                backgroundColor: tag.color + '20',
                color: tag.color,
                borderLeft: `3px solid ${tag.color}`
              }}
              title={tag.name}
            >
              {tag.name}
            </div>
          ))}

          <TaskTagsQuickEdit
            taskId={task.id}
            folderId={task.folder_id}
            selectedTagIds={taskTagIds}
            onTagsChanged={loadTaskTags}
          />

          {priorityInfo && (
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${priorityInfo.color} ${priorityInfo.bgColor}`} title="Priorita">
              <AlertCircleIcon className="w-3 h-3" />
              <span>{priorityInfo.text}</span>
            </div>
          )}

          {hasAttachments && (
            <div className="flex items-center px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600" title="Má přílohy">
              <PaperclipIcon className="w-3 h-3" />
            </div>
          )}

          {createdByUser && createdByUser.id !== assignedUser?.id && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 rounded text-xs text-blue-700" title="Vytvořilo">
              {createdByUser.avatar_url ? (
                <img
                  src={createdByUser.avatar_url}
                  alt={createdByUser.display_name || createdByUser.email}
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-3 h-3" />
              )}
              <span>{createdByUser.display_name || createdByUser.email.split('@')[0]}</span>
            </div>
          )}

          {assignedUser && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-700" title="Přiřazeno">
              {assignedUser.avatar_url ? (
                <img
                  src={assignedUser.avatar_url}
                  alt={assignedUser.display_name || assignedUser.email}
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-3 h-3" />
              )}
              <span>{assignedUser.display_name || assignedUser.email.split('@')[0]}</span>
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

    {isExpanded && totalSubtasks > 0 && (
      <div className="ml-6 mt-1 space-y-1">
        {subtasks.map(subtask => {
          const subtaskCategory = subtaskCategories.find(c => c.id === subtask.category_id);
          const subtaskUser = subtaskUsers.find(u => u.id === subtask.assigned_to);
          const subtaskDueDate = formatDueDate(subtask.due_date);

          return (
            <div
              key={subtask.id}
              onClick={() => onSubtaskClick ? onSubtaskClick(subtask.id) : onClick()}
              className="bg-gray-50 border border-gray-200 rounded hover:border-blue-300 hover:bg-white transition-all cursor-pointer p-2"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleSubtaskStatusClick(e, subtask.id, subtask.status)}
                  className="hover:scale-110 transition-transform flex-shrink-0"
                >
                  {subtask.status === 'completed' ? (
                    <CheckCircle2Icon className="w-4 h-4 text-green-600 fill-green-50" />
                  ) : (
                    <CircleIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  )}
                </button>

                <span
                  className={`flex-1 text-sm ${
                    subtask.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'
                  }`}
                >
                  {subtask.title}
                </span>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {subtaskCategory && (
                    <div
                      className="px-1.5 py-0.5 text-xs font-medium rounded"
                      style={{
                        backgroundColor: subtaskCategory.color + '15',
                        color: subtaskCategory.color
                      }}
                    >
                      {subtaskCategory.name}
                    </div>
                  )}

                  {subtaskUser && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-700">
                      {subtaskUser.avatar_url ? (
                        <img
                          src={subtaskUser.avatar_url}
                          alt={subtaskUser.display_name || subtaskUser.email}
                          className="w-4 h-4 rounded-full object-cover"
                        />
                      ) : (
                        <UserIcon className="w-3 h-3" />
                      )}
                      <span>{subtaskUser.display_name || subtaskUser.email.split('@')[0]}</span>
                    </div>
                  )}

                  {subtaskDueDate && (
                    <div className={`flex items-center gap-1 text-xs ${subtaskDueDate.color}`}>
                      <CalendarIcon className="w-3 h-3" />
                      <span>{subtaskDueDate.text}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
  );
}
