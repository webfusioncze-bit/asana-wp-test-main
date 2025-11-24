import { useState, useEffect } from 'react';
import { XIcon, PlusIcon, Trash2Icon, FileIcon, RepeatIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Category, Folder, User, Priority, RecurrenceRule } from '../types';

interface TaskCreationPanelProps {
  folderId: string | null;
  onClose: () => void;
  onTaskCreated: () => void;
}

export function TaskCreationPanel({ folderId, onClose, onTaskCreated }: TaskCreationPanelProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>(folderId || '');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<number[]>([]);
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number | null>(null);
  const [recurrenceMonth, setRecurrenceMonth] = useState<number | null>(null);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  useEffect(() => {
    loadCategories();
    loadFolders();
    loadUsers();
    loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setAssignedTo(user.id);
    }
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*');

    if (error) {
      console.error('Error loading categories:', error);
      return;
    }

    setCategories(data || []);
  }

  async function loadFolders() {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('folder_type', 'tasks')
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading folders:', error);
      return;
    }

    setFolders(data || []);
  }

  function buildFolderHierarchy(folders: Folder[], parentId: string | null = null, level: number = 0): JSX.Element[] {
    const children = folders.filter(f => f.parent_id === parentId);
    const result: JSX.Element[] = [];

    children.forEach(folder => {
      const indent = '\u00A0\u00A0'.repeat(level * 2);
      const prefix = level > 0 ? '└─ ' : '';
      result.push(
        <option key={folder.id} value={folder.id}>
          {indent}{prefix}{folder.name}
        </option>
      );
      result.push(...buildFolderHierarchy(folders, folder.id, level + 1));
    });

    return result;
  }

  async function loadUsers() {
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, email');

    if (error) {
      console.error('Error loading user profiles:', error);
      return;
    }

    setUsers((profiles || []).map(p => ({ id: p.id, email: p.email || '' })));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!title.trim() || !assignedTo) {
      alert('Vyplňte název úkolu a přiřaďte ho někomu');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const taskData: any = {
        title,
        description,
        folder_id: selectedFolderId || null,
        category_id: categoryId || null,
        assigned_to: assignedTo,
        created_by: user.id,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        position: 0,
      };

      if (isRecurring) {
        taskData.is_recurring = true;
        taskData.recurrence_rule = recurrenceRule;
        taskData.recurrence_interval = recurrenceInterval;
        taskData.recurrence_end_date = recurrenceEndDate ? new Date(recurrenceEndDate).toISOString() : null;

        if (recurrenceRule === 'weekly' && recurrenceDaysOfWeek.length > 0) {
          taskData.recurrence_days_of_week = recurrenceDaysOfWeek;
        }
        if (recurrenceRule === 'monthly' && recurrenceDayOfMonth) {
          taskData.recurrence_day_of_month = recurrenceDayOfMonth;
        }
        if (recurrenceRule === 'yearly') {
          if (recurrenceDayOfMonth) taskData.recurrence_day_of_month = recurrenceDayOfMonth;
          if (recurrenceMonth) taskData.recurrence_month = recurrenceMonth;
        }

        taskData.next_occurrence = dueDate || new Date().toISOString();
      }

      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (taskError) {
        console.error('Error creating task:', taskError);
        alert('Chyba při vytváření úkolu: ' + taskError.message);
        return;
      }

      if (attachments.length > 0 && task) {
        for (const file of attachments) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${user.id}/${task.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('task-attachments')
            .upload(filePath, file);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('task-attachments')
            .getPublicUrl(filePath);

          await supabase
            .from('task_attachments')
            .insert({
              task_id: task.id,
              file_name: file.name,
              file_url: publicUrl,
              file_size: file.size,
              file_type: file.type,
              uploaded_by: user.id,
            });
        }
      }

      onTaskCreated();
      onClose();
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[600px] bg-white shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">Nový úkol</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <XIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Název úkolu *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Zadejte název úkolu"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Popis
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailní popis úkolu..."
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">Můžete použít Markdown formátování</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Složka
            </label>
            <select
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Bez složky</option>
              {buildFolderHierarchy(folders)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kategorie
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Bez kategorie</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Přiřazeno *
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Vyberte uživatele</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priorita
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="low">Nízká</option>
              <option value="medium">Střední</option>
              <option value="high">Vysoká</option>
              <option value="urgent">Urgentní</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Termín dokončení
          </label>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <RepeatIcon className="w-4 h-4 text-gray-600" />
            <label className="text-sm font-medium text-gray-700">
              Opakovaný úkol
            </label>
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="ml-auto w-4 h-4 text-primary focus:ring-2 focus:ring-primary rounded"
            />
          </div>

          {isRecurring && (
            <div className="space-y-3 pl-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Frekvence</label>
                  <select
                    value={recurrenceRule}
                    onChange={(e) => setRecurrenceRule(e.target.value as RecurrenceRule)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="daily">Denně</option>
                    <option value="weekly">Týdně</option>
                    <option value="monthly">Měsíčně</option>
                    <option value="yearly">Ročně</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Interval</label>
                  <input
                    type="number"
                    min="1"
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(parseInt(e.target.value))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {recurrenceRule === 'weekly' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Dny v týdnu</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 1, label: 'Po' },
                      { value: 2, label: 'Út' },
                      { value: 3, label: 'St' },
                      { value: 4, label: 'Čt' },
                      { value: 5, label: 'Pá' },
                      { value: 6, label: 'So' },
                      { value: 0, label: 'Ne' },
                    ].map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          const newDays = recurrenceDaysOfWeek.includes(day.value)
                            ? recurrenceDaysOfWeek.filter(d => d !== day.value)
                            : [...recurrenceDaysOfWeek, day.value];
                          setRecurrenceDaysOfWeek(newDays);
                        }}
                        className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                          recurrenceDaysOfWeek.includes(day.value)
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-primary'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recurrenceRule === 'monthly' && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Den v měsíci (1-31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={recurrenceDayOfMonth || ''}
                    onChange={(e) => setRecurrenceDayOfMonth(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="např. 15"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              {recurrenceRule === 'yearly' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Den</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={recurrenceDayOfMonth || ''}
                      onChange={(e) => setRecurrenceDayOfMonth(e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="30"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Měsíc</label>
                    <select
                      value={recurrenceMonth || ''}
                      onChange={(e) => setRecurrenceMonth(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Vyberte měsíc</option>
                      <option value="1">Leden</option>
                      <option value="2">Únor</option>
                      <option value="3">Březen</option>
                      <option value="4">Duben</option>
                      <option value="5">Květen</option>
                      <option value="6">Červen</option>
                      <option value="7">Červenec</option>
                      <option value="8">Srpen</option>
                      <option value="9">Září</option>
                      <option value="10">Říjen</option>
                      <option value="11">Listopad</option>
                      <option value="12">Prosinec</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-600 mb-1">Ukončit opakování (volitelné)</label>
                <input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Přílohy
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
            <input
              type="file"
              onChange={handleFileChange}
              multiple
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <PlusIcon className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">
                Klikněte pro nahrání souborů
              </span>
            </label>
          </div>

          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <FileIcon className="w-5 h-5 text-gray-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    <Trash2Icon className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-6 border-t border-gray-200 flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Vytváření...' : 'Vytvořit úkol'}
        </button>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
        >
          Zrušit
        </button>
      </div>
    </div>
  );
}
