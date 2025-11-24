import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, GripVerticalIcon, Edit2Icon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TaskItemSimple } from './TaskItemSimple';
import type { Task, TaskSection, Category, User } from '../types';

interface TaskSectionListProps {
  folderId: string;
  onTaskClick: (taskId: string) => void;
  refreshTrigger?: number;
  isCompletedFolder?: boolean;
}

export function TaskSectionList({ folderId, onTaskClick, refreshTrigger, isCompletedFolder }: TaskSectionListProps) {
  const [sections, setSections] = useState<TaskSection[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isCreatingSection, setIsCreatingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [quickAddTaskSection, setQuickAddTaskSection] = useState<string | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');

  useEffect(() => {
    loadSections();
    loadTasks();
    loadCategories();
    loadUsers();
  }, [folderId, refreshTrigger]);

  async function loadSections() {
    if (isCompletedFolder) {
      setSections([]);
      return;
    }

    const { data, error } = await supabase
      .from('task_sections')
      .select('*')
      .eq('folder_id', folderId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading sections:', error);
      return;
    }

    setSections(data || []);
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
    let query = supabase
      .from('tasks')
      .select('*')
      .is('parent_task_id', null)
      .order('position', { ascending: true });

    if (isCompletedFolder) {
      query = query.eq('status', 'completed');
    } else {
      query = query.eq('folder_id', folderId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading tasks:', error);
      return;
    }

    setTasks(data || []);
  }

  async function createSection() {
    if (!newSectionName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const maxPosition = Math.max(...sections.map(s => s.position), -1);

    const { error } = await supabase.from('task_sections').insert({
      folder_id: folderId,
      name: newSectionName,
      position: maxPosition + 1,
      created_by: user.id
    });

    if (error) {
      console.error('Error creating section:', error);
      return;
    }

    setNewSectionName('');
    setIsCreatingSection(false);
    loadSections();
  }

  async function updateSectionName(sectionId: string, newName: string) {
    if (!newName.trim()) return;

    const { error } = await supabase
      .from('task_sections')
      .update({ name: newName })
      .eq('id', sectionId);

    if (error) {
      console.error('Error updating section:', error);
      return;
    }

    setEditingSectionId(null);
    setEditingSectionName('');
    loadSections();
  }

  function startEditingSection(section: TaskSection) {
    setEditingSectionId(section.id);
    setEditingSectionName(section.name);
  }

  async function updateTaskStatus(taskId: string, status: Task['status']) {
    const { error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task status:', error);
      return;
    }

    loadTasks();
  }

  async function deleteSection(sectionId: string) {
    const { error } = await supabase
      .from('task_sections')
      .delete()
      .eq('id', sectionId);

    if (error) {
      console.error('Error deleting section:', error);
      return;
    }

    loadSections();
    loadTasks();
  }

  async function createQuickTask(sectionId: string | null) {
    if (!quickTaskTitle.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const tasksInSection = tasks.filter(t => t.section_id === sectionId);
    const maxPosition = Math.max(...tasksInSection.map(t => t.position), -1);

    const { error } = await supabase.from('tasks').insert({
      title: quickTaskTitle,
      description: '',
      folder_id: folderId,
      section_id: sectionId,
      assigned_to: user.id,
      created_by: user.id,
      priority: 'medium',
      status: 'todo',
      position: maxPosition + 1
    });

    if (error) {
      console.error('Error creating task:', error);
      return;
    }

    setQuickTaskTitle('');
    setQuickAddTaskSection(null);
    loadTasks();
  }

  async function moveTaskToSection(taskId: string, newSectionId: string | null) {
    const { error } = await supabase
      .from('tasks')
      .update({ section_id: newSectionId })
      .eq('id', taskId);

    if (error) {
      console.error('Error moving task:', error);
      return;
    }

    loadTasks();
  }

  function handleDragStart(task: Task) {
    setDraggedTask(task);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent, sectionId: string | null) {
    e.preventDefault();
    if (draggedTask) {
      moveTaskToSection(draggedTask.id, sectionId);
      setDraggedTask(null);
    }
  }

  const tasksWithoutSection = tasks.filter(t => !t.section_id);

  return (
    <div className="space-y-3">
      {tasksWithoutSection.length > 0 && (
        <div className="space-y-1 mb-3">
          {tasksWithoutSection.map(task => {
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
      )}

      {tasksWithoutSection.length === 0 && sections.length === 0 && (
        <div className="mb-3">
          {quickAddTaskSection === null ? (
            <button
              onClick={() => setQuickAddTaskSection(null)}
              className="w-full py-1.5 text-xs text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors flex items-center justify-center gap-1"
            >
              <PlusIcon className="w-3 h-3" />
              Přidat úkol
            </button>
          ) : (
            <div className="flex gap-1">
              <input
                type="text"
                value={quickTaskTitle}
                onChange={(e) => setQuickTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createQuickTask(null);
                  if (e.key === 'Escape') setQuickAddTaskSection(null);
                }}
                placeholder="Název úkolu..."
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={() => createQuickTask(null)}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs"
              >
                Přidat
              </button>
            </div>
          )}
        </div>
      )}

      {sections.map(section => {
        const sectionTasks = tasks.filter(t => t.section_id === section.id);
        return (
          <div key={section.id} className="bg-white rounded border border-gray-200">
            <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                <GripVerticalIcon className="w-3 h-3 text-gray-400" />
                {editingSectionId === section.id ? (
                  <input
                    type="text"
                    value={editingSectionName}
                    onChange={(e) => setEditingSectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') updateSectionName(section.id, editingSectionName);
                      if (e.key === 'Escape') setEditingSectionId(null);
                    }}
                    onBlur={() => updateSectionName(section.id, editingSectionName)}
                    className="flex-1 px-2 py-1 text-sm font-medium border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                ) : (
                  <>
                    <h3 className="text-sm font-medium text-gray-900">{section.name}</h3>
                    <span className="text-xs text-gray-500">({sectionTasks.length})</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                {editingSectionId !== section.id && (
                  <button
                    onClick={() => startEditingSection(section)}
                    className="text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    <Edit2Icon className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => deleteSection(section.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="p-2 space-y-1">
              {sectionTasks.map(task => {
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
              {quickAddTaskSection === section.id ? (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={quickTaskTitle}
                    onChange={(e) => setQuickTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createQuickTask(section.id);
                      if (e.key === 'Escape') setQuickAddTaskSection(null);
                    }}
                    placeholder="Název úkolu..."
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={() => createQuickTask(section.id)}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs"
                  >
                    Přidat
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setQuickAddTaskSection(section.id)}
                  className="w-full py-1.5 text-xs text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors flex items-center justify-center gap-1"
                >
                  <PlusIcon className="w-3 h-3" />
                  Přidat úkol
                </button>
              )}
            </div>
          </div>
        );
      })}

      {!isCompletedFolder && (
        <>
          {isCreatingSection ? (
            <div className="bg-gray-50 rounded border border-dashed border-gray-300 p-2">
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createSection();
                  if (e.key === 'Escape') setIsCreatingSection(false);
                }}
                placeholder="Název sekce..."
                className="w-full px-2 py-1 mb-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex gap-1">
                <button
                  onClick={createSection}
                  className="flex-1 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs"
                >
                  Vytvořit
                </button>
                <button
                  onClick={() => {
                    setIsCreatingSection(false);
                    setNewSectionName('');
                  }}
                  className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-xs"
                >
                  Zrušit
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreatingSection(true)}
              className="w-full py-2 bg-gray-50 rounded border border-dashed border-gray-300 hover:border-blue-400 hover:bg-gray-100 transition-all flex items-center justify-center gap-1 text-gray-500 hover:text-blue-500"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Nová sekce</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
