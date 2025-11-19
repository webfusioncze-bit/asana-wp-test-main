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
    <div className="space-y-6">
      {tasksWithoutSection.length > 0 && (
        <div
          className="bg-white rounded-lg border border-gray-200"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, null)}
        >
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-700">Bez sekce</h3>
          </div>
          <div className="p-4 space-y-2">
            {tasksWithoutSection.map(task => (
              <div
                key={task.id}
                draggable
                onDragStart={() => handleDragStart(task)}
                className="cursor-move"
              >
                <TaskItem
                  task={task}
                  onClick={() => onTaskClick(task.id)}
                  onUpdate={loadTasks}
                />
              </div>
            ))}
            {quickAddTaskSection === null ? (
              <button
                onClick={() => setQuickAddTaskSection(null)}
                className="w-full py-2 text-sm text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Přidat úkol
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createQuickTask(null);
                    if (e.key === 'Escape') setQuickAddTaskSection(null);
                  }}
                  placeholder="Název úkolu..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={() => createQuickTask(null)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
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
          <div
            key={section.id}
            className="bg-white rounded-lg border border-gray-200"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, section.id)}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVerticalIcon className="w-4 h-4 text-gray-400" />
                <h3 className="font-medium text-gray-900">{section.name}</h3>
                <span className="text-sm text-gray-500">({sectionTasks.length})</span>
              </div>
              <button
                onClick={() => deleteSection(section.id)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {sectionTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => handleDragStart(task)}
                  className="cursor-move"
                >
                  <TaskItem
                    task={task}
                    onClick={() => onTaskClick(task.id)}
                    onUpdate={loadTasks}
                  />
                </div>
              ))}
              {quickAddTaskSection === section.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickTaskTitle}
                    onChange={(e) => setQuickTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createQuickTask(section.id);
                      if (e.key === 'Escape') setQuickAddTaskSection(null);
                    }}
                    placeholder="Název úkolu..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={() => createQuickTask(section.id)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                  >
                    Přidat
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setQuickAddTaskSection(section.id)}
                  className="w-full py-2 text-sm text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  Přidat úkol
                </button>
              )}
            </div>
          </div>
        );
      })}

      {isCreatingSection ? (
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-4">
          <input
            type="text"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createSection();
              if (e.key === 'Escape') setIsCreatingSection(false);
            }}
            placeholder="Název sekce..."
            className="w-full px-3 py-2 mb-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={createSection}
              className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
            >
              Vytvořit sekci
            </button>
            <button
              onClick={() => {
                setIsCreatingSection(false);
                setNewSectionName('');
              }}
              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              Zrušit
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsCreatingSection(true)}
          className="w-full py-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-gray-100 transition-all flex items-center justify-center gap-2 text-gray-500 hover:text-blue-500"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="font-medium">Nová sekce</span>
        </button>
      )}
    </div>
  );
}
