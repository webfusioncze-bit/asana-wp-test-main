import { useState, useEffect } from 'react';
import { CheckCircle2Icon, CircleIcon, UserIcon, CalendarIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Task, Category, User } from '../types';

interface TaskItemSimpleProps {
  task: Task;
  category?: Category;
  assignedUser?: User;
  onClick: () => void;
  onUpdateStatus: (status: Task['status']) => void;
  onSubtaskClick?: (taskId: string) => void;
}

export function TaskItemSimple({ task, category, assignedUser, onClick, onUpdateStatus, onSubtaskClick }: TaskItemSimpleProps) {
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [subtaskCategories, setSubtaskCategories] = useState<Category[]>([]);
  const [subtaskUsers, setSubtaskUsers] = useState<User[]>([]);

  useEffect(() => {
    loadSubtasks();
  }, [task.id]);

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
        className="bg-white border border-gray-200 rounded hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer p-2"
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

          {assignedUser && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-700">
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
