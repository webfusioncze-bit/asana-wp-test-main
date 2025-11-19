import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, GripVerticalIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TaskItem } from './TaskItem';
import type { Task, TaskSection } from '../types';

interface TaskSectionListProps {
  folderId: string;
  onTaskClick: (taskId: string) => void;
  refreshTrigger?: number;
}

export function TaskSectionList({ folderId, onTaskClick, refreshTrigger }: TaskSectionListProps) {
  const [sections, setSections] = useState<TaskSection[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isCreatingSection, setIsCreatingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [quickAddTaskSection, setQuickAddTaskSection] = useState<string | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  useEffect(() => {
    loadSections();
    loadTasks();
  }, [folderId, refreshTrigger]);

  async function loadSections() {
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

  async function loadTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('folder_id', folderId)
      .is('parent_task_id', null)
      .order('position', { ascending: true });

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
        <div className="bg-white rounded border border-gray-200">
          <div className="px-3 py-2 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Bez sekce</h3>
          </div>
          <div className="p-2 space-y-1">
            {tasksWithoutSection.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task.id)}
                onUpdate={loadTasks}
              />
            ))}
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
        </div>
      )}

      {sections.map(section => {
        const sectionTasks = tasks.filter(t => t.section_id === section.id);
        return (
          <div key={section.id} className="bg-white rounded border border-gray-200">
            <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVerticalIcon className="w-3 h-3 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-900">{section.name}</h3>
                <span className="text-xs text-gray-500">({sectionTasks.length})</span>
              </div>
              <button
                onClick={() => deleteSection(section.id)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <TrashIcon className="w-3 h-3" />
              </button>
            </div>
            <div className="p-2 space-y-1">
              {sectionTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onClick={() => onTaskClick(task.id)}
                  onUpdate={loadTasks}
                />
              ))}
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
    </div>
  );
}
