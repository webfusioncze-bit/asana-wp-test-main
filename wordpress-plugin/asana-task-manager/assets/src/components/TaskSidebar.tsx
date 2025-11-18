import React, { useState, useEffect } from 'react';
import {
  X,
  Circle,
  CheckCircle2,
  Calendar,
  User as UserIcon,
  Tag,
  Folder,
  Trash2,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { Task, User, Category, Folder as FolderType, TaskComment } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

interface TaskSidebarProps {
  task: Task;
  users: User[];
  categories: Category[];
  folders: FolderType[];
  tasks: Task[];
  onClose: () => void;
  onRefresh: () => void;
  supabase: SupabaseClient;
  currentUser: User;
}

export const TaskSidebar: React.FC<TaskSidebarProps> = ({
  task,
  users,
  categories,
  folders,
  tasks,
  onClose,
  onRefresh,
  supabase,
  currentUser,
}) => {
  const [editedTask, setEditedTask] = useState(task);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  useEffect(() => {
    setEditedTask(task);
    loadComments();
    loadSubtasks();
  }, [task.id]);

  const loadComments = async () => {
    const { data } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: true });

    if (data) setComments(data);
  };

  const loadSubtasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_task_id', task.id)
      .order('position');

    if (data) setSubtasks(data);
  };

  const handleUpdate = async (field: keyof Task, value: any) => {
    const updated = { ...editedTask, [field]: value, updated_at: new Date().toISOString() };
    setEditedTask(updated);

    try {
      await supabase.from('tasks').update({ [field]: value }).eq('id', task.id);
      onRefresh();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleToggleComplete = async () => {
    const newStatus = editedTask.status === 'completed' ? 'todo' : 'completed';
    const completed_at = newStatus === 'completed' ? new Date().toISOString() : null;

    setEditedTask({ ...editedTask, status: newStatus, completed_at });

    try {
      await supabase.from('tasks').update({ status: newStatus, completed_at }).eq('id', task.id);
      onRefresh();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Opravdu chcete smazat tento úkol?')) return;

    try {
      await supabase.from('tasks').delete().eq('id', task.id);
      onClose();
      onRefresh();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await supabase.from('task_comments').insert({
        task_id: task.id,
        user_id: currentUser.id,
        comment: newComment,
      });

      setNewComment('');
      loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;

    try {
      await supabase.from('tasks').insert({
        title: newSubtaskTitle,
        parent_task_id: task.id,
        assigned_to: currentUser.id,
        created_by: currentUser.id,
        priority: 'medium',
        status: 'todo',
        folder_id: task.folder_id,
        position: subtasks.length,
      });

      setNewSubtaskTitle('');
      setIsAddingSubtask(false);
      loadSubtasks();
      onRefresh();
    } catch (error) {
      console.error('Error adding subtask:', error);
    }
  };

  const handleToggleSubtask = async (subtask: Task) => {
    const newStatus = subtask.status === 'completed' ? 'todo' : 'completed';
    const completed_at = newStatus === 'completed' ? new Date().toISOString() : null;

    try {
      await supabase.from('tasks').update({ status: newStatus, completed_at }).eq('id', subtask.id);
      loadSubtasks();
      onRefresh();
    } catch (error) {
      console.error('Error updating subtask:', error);
    }
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      low: 'Nízká',
      medium: 'Střední',
      high: 'Vysoká',
      urgent: 'Urgentní',
    };
    return labels[priority] || priority;
  };

  const assignedUser = users.find(u => u.id === editedTask.assigned_to);

  return (
    <div className="atm-sidebar">
      <div className="atm-sidebar-header">
        <button className="atm-sidebar-close" onClick={onClose}>
          <X size={20} />
        </button>
        <button className="atm-sidebar-delete" onClick={handleDelete} title="Smazat úkol">
          <Trash2 size={18} />
        </button>
      </div>

      <div className="atm-sidebar-content">
        <div className="atm-sidebar-section">
          <button className="atm-task-complete-button" onClick={handleToggleComplete}>
            {editedTask.status === 'completed' ? (
              <>
                <CheckCircle2 size={20} />
                Označit jako nedokončené
              </>
            ) : (
              <>
                <Circle size={20} />
                Označit jako dokončené
              </>
            )}
          </button>

          <input
            type="text"
            className="atm-task-title-input"
            value={editedTask.title}
            onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
            onBlur={() => handleUpdate('title', editedTask.title)}
          />

          <textarea
            className="atm-task-description-input"
            value={editedTask.description}
            onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
            onBlur={() => handleUpdate('description', editedTask.description)}
            placeholder="Popis úkolu..."
            rows={4}
          />
        </div>

        <div className="atm-sidebar-section">
          <div className="atm-field">
            <label>
              <UserIcon size={16} />
              Přiřazeno
            </label>
            <select
              value={editedTask.assigned_to}
              onChange={(e) => handleUpdate('assigned_to', e.target.value)}
            >
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="atm-field">
            <label>
              <Calendar size={16} />
              Termín
            </label>
            <input
              type="date"
              value={editedTask.due_date ? editedTask.due_date.split('T')[0] : ''}
              onChange={(e) => handleUpdate('due_date', e.target.value ? new Date(e.target.value).toISOString() : null)}
            />
          </div>

          <div className="atm-field">
            <label>
              <Tag size={16} />
              Priorita
            </label>
            <select
              value={editedTask.priority}
              onChange={(e) => handleUpdate('priority', e.target.value)}
            >
              <option value="low">Nízká</option>
              <option value="medium">Střední</option>
              <option value="high">Vysoká</option>
              <option value="urgent">Urgentní</option>
            </select>
          </div>

          <div className="atm-field">
            <label>
              <Tag size={16} />
              Kategorie
            </label>
            <select
              value={editedTask.category_id || ''}
              onChange={(e) => handleUpdate('category_id', e.target.value || null)}
            >
              <option value="">Bez kategorie</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="atm-field">
            <label>
              <Folder size={16} />
              Složka
            </label>
            <select
              value={editedTask.folder_id || ''}
              onChange={(e) => handleUpdate('folder_id', e.target.value || null)}
            >
              <option value="">Bez složky</option>
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="atm-sidebar-section">
          <h3>Subtasky</h3>
          <div className="atm-subtasks-list">
            {subtasks.map(subtask => (
              <div key={subtask.id} className="atm-subtask-item">
                <button onClick={() => handleToggleSubtask(subtask)}>
                  {subtask.status === 'completed' ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <Circle size={16} />
                  )}
                </button>
                <span className={subtask.status === 'completed' ? 'completed' : ''}>
                  {subtask.title}
                </span>
              </div>
            ))}
          </div>

          {isAddingSubtask ? (
            <div className="atm-subtask-create">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Název subtasku"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleAddSubtask();
                  if (e.key === 'Escape') setIsAddingSubtask(false);
                }}
              />
              <button onClick={handleAddSubtask}>Přidat</button>
              <button onClick={() => setIsAddingSubtask(false)}>Zrušit</button>
            </div>
          ) : (
            <button className="atm-add-subtask-button" onClick={() => setIsAddingSubtask(true)}>
              <Plus size={14} />
              Přidat subtask
            </button>
          )}
        </div>

        <div className="atm-sidebar-section">
          <h3>
            <MessageSquare size={16} />
            Komentáře
          </h3>
          <div className="atm-comments-list">
            {comments.map(comment => {
              const commentUser = users.find(u => u.id === comment.user_id);
              return (
                <div key={comment.id} className="atm-comment">
                  <div className="atm-comment-header">
                    <strong>{commentUser?.display_name}</strong>
                    <span>{new Date(comment.created_at).toLocaleDateString('cs-CZ')}</span>
                  </div>
                  <div className="atm-comment-body">{comment.comment}</div>
                </div>
              );
            })}
          </div>

          <div className="atm-comment-create">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Napište komentář..."
              rows={3}
            />
            <button onClick={handleAddComment}>Přidat komentář</button>
          </div>
        </div>
      </div>
    </div>
  );
};
