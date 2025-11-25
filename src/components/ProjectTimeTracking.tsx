import { useState, useEffect } from 'react';
import { ClockIcon, PlusIcon, TrashIcon, XIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ProjectTimeEntry, User } from '../types';

interface ProjectTimeTrackingProps {
  projectId: string;
}

export function ProjectTimeTracking({ projectId }: ProjectTimeTrackingProps) {
  const [timeEntries, setTimeEntries] = useState<ProjectTimeEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [timeForm, setTimeForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
    hours: ''
  });

  useEffect(() => {
    loadCurrentUser();
    loadTimeEntries();
    loadUsers();
  }, [projectId]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  }

  async function loadTimeEntries() {
    setLoading(true);
    const { data, error } = await supabase
      .from('project_time_entries')
      .select('*')
      .eq('project_id', projectId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading time entries:', error);
    } else {
      setTimeEntries(data || []);
    }
    setLoading(false);
  }

  async function loadUsers() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*');

    if (error) {
      console.error('Error loading users:', error);
    } else {
      setUsers(data || []);
    }
  }

  async function addTimeEntry() {
    if (!timeForm.description.trim() || !timeForm.hours || Number(timeForm.hours) <= 0) {
      alert('Vyplňte činnost a čas');
      return;
    }

    const { error } = await supabase
      .from('project_time_entries')
      .insert({
        project_id: projectId,
        user_id: currentUserId,
        description: timeForm.description,
        hours: Number(timeForm.hours),
        entry_date: timeForm.entry_date
      });

    if (error) {
      console.error('Error adding time entry:', error);
      alert('Chyba při přidání časového záznamu');
      return;
    }

    setTimeForm({
      entry_date: new Date().toISOString().split('T')[0],
      description: '',
      hours: ''
    });
    setShowForm(false);
    loadTimeEntries();
  }

  async function deleteTimeEntry(id: string) {
    if (!confirm('Opravdu chcete smazat tento časový záznam?')) return;

    const { error } = await supabase
      .from('project_time_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting time entry:', error);
      return;
    }

    loadTimeEntries();
  }

  function getUserName(userId: string): string {
    const user = users.find(u => u.id === userId);
    return user?.display_name || user?.email || 'Neznámý uživatel';
  }

  function getTotalHours(): number {
    return timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  }

  function groupEntriesByDate(): Record<string, ProjectTimeEntry[]> {
    const grouped: Record<string, ProjectTimeEntry[]> = {};
    timeEntries.forEach(entry => {
      const date = entry.entry_date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(entry);
    });
    return grouped;
  }

  const groupedEntries = groupEntriesByDate();
  const totalHours = getTotalHours();

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ClockIcon className="w-5 h-5" />
            Evidence času
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Celkem vykázáno: <span className="font-semibold text-blue-600">{totalHours.toFixed(2)}h</span>
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
        >
          {showForm ? (
            <>
              <XIcon className="w-4 h-4" />
              Zrušit
            </>
          ) : (
            <>
              <PlusIcon className="w-4 h-4" />
              Vykázat čas
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Nový časový záznam</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datum *
              </label>
              <input
                type="date"
                value={timeForm.entry_date}
                onChange={(e) => setTimeForm({ ...timeForm, entry_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Činnost *
              </label>
              <textarea
                value={timeForm.description}
                onChange={(e) => setTimeForm({ ...timeForm, description: e.target.value })}
                placeholder="Popis činnosti..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Čas (h) *
              </label>
              <input
                type="number"
                step="0.25"
                value={timeForm.hours}
                onChange={(e) => setTimeForm({ ...timeForm, hours: e.target.value })}
                placeholder="např. 0.75"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Tip: Použijte desetinná čísla (0.25 = 15min, 0.5 = 30min, 0.75 = 45min)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={addTimeEntry}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Přidat
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Načítání...</div>
      ) : timeEntries.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Žádné časové záznamy. Vykažte první čas pomocí tlačítka výše.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.keys(groupedEntries).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(date => (
            <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">
                    {new Date(date).toLocaleDateString('cs-CZ', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h4>
                  <span className="text-sm text-gray-600">
                    {groupedEntries[date].reduce((sum, e) => sum + Number(e.hours), 0).toFixed(2)}h
                  </span>
                </div>
              </div>
              <div className="divide-y divide-gray-200">
                {groupedEntries[date].map(entry => (
                  <div key={entry.id} className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {getUserName(entry.user_id)}
                          </span>
                          <span className="text-sm font-semibold text-blue-600">
                            {entry.hours}h
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.description}</p>
                      </div>
                      {entry.user_id === currentUserId && (
                        <button
                          onClick={() => deleteTimeEntry(entry.id)}
                          className="p-1 hover:bg-red-100 rounded transition-colors flex-shrink-0"
                          title="Smazat"
                        >
                          <TrashIcon className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
