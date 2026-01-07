import { useState, useEffect, useRef } from 'react';
import { PlusIcon, TrashIcon, CalendarIcon, RepeatIcon, CheckCircleIcon, XCircleIcon, ClockIcon, SearchIcon, ChevronDownIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Website, WebsiteUpdateSchedule, WebsiteUpdateInstance } from '../types';

interface WebsiteUpdateSchedulesProps {
  canManage: boolean;
}

const INTERVAL_OPTIONS = [
  { value: 1, label: '1 měsíc' },
  { value: 2, label: '2 měsíce' },
  { value: 3, label: '3 měsíce' },
  { value: 6, label: '6 měsíců' },
  { value: 12, label: '1 rok' },
];

export function WebsiteUpdateSchedules({ canManage }: WebsiteUpdateSchedulesProps) {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [schedules, setSchedules] = useState<WebsiteUpdateSchedule[]>([]);
  const [instances, setInstances] = useState<WebsiteUpdateInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState('');
  const [intervalMonths, setIntervalMonths] = useState<1 | 2 | 3 | 6 | 12>(1);
  const [firstUpdateDate, setFirstUpdateDate] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [websiteSearchQuery, setWebsiteSearchQuery] = useState('');
  const [showWebsiteDropdown, setShowWebsiteDropdown] = useState(false);
  const websiteDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (schedules.length > 0) {
      loadInstances();
    }
  }, [schedules, currentMonth]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (websiteDropdownRef.current && !websiteDropdownRef.current.contains(event.target as Node)) {
        setShowWebsiteDropdown(false);
      }
    }

    if (showWebsiteDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showWebsiteDropdown]);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadWebsites(), loadSchedules()]);
    setLoading(false);
  }

  async function loadWebsites() {
    const { data, error } = await supabase
      .from('websites')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading websites:', error);
      return;
    }

    setWebsites(data || []);
  }

  async function loadSchedules() {
    const { data, error } = await supabase
      .from('website_update_schedules')
      .select(`
        *,
        website:websites(*)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading schedules:', error);
      return;
    }

    setSchedules(data || []);
  }

  async function loadInstances() {
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const { data, error } = await supabase
      .from('website_update_instances')
      .select(`
        *,
        schedule:website_update_schedules(
          *,
          website:websites(*)
        ),
        task:tasks(*)
      `)
      .gte('scheduled_date', startOfMonth.toISOString().split('T')[0])
      .lte('scheduled_date', endOfMonth.toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true });

    if (error) {
      console.error('Error loading instances:', error);
      return;
    }

    setInstances(data || []);
  }

  async function createSchedule() {
    if (!selectedWebsiteId || !firstUpdateDate) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('website_update_schedules')
      .insert({
        website_id: selectedWebsiteId,
        interval_months: intervalMonths,
        first_update_date: firstUpdateDate,
        is_active: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating schedule:', error);
      alert('Chyba při vytváření plánu aktualizací');
      return;
    }

    setShowCreateForm(false);
    setSelectedWebsiteId('');
    setWebsiteSearchQuery('');
    setIntervalMonths(1);
    setFirstUpdateDate('');
    loadData();
  }

  function selectWebsite(website: Website) {
    setSelectedWebsiteId(website.id);
    setWebsiteSearchQuery(website.name);
    setShowWebsiteDropdown(false);
  }

  const filteredWebsites = websites.filter(website =>
    website.name.toLowerCase().includes(websiteSearchQuery.toLowerCase()) ||
    website.url.toLowerCase().includes(websiteSearchQuery.toLowerCase())
  );

  const selectedWebsite = websites.find(w => w.id === selectedWebsiteId);

  async function deleteSchedule(scheduleId: string) {
    if (!confirm('Opravdu chcete smazat tento plán aktualizací?')) return;

    const { error } = await supabase
      .from('website_update_schedules')
      .update({ is_active: false })
      .eq('id', scheduleId);

    if (error) {
      console.error('Error deleting schedule:', error);
      alert('Chyba při mazání plánu aktualizací');
      return;
    }

    loadData();
  }

  async function createTaskFromInstance(instanceId: string) {
    const instance = instances.find(i => i.id === instanceId);
    if (!instance || !instance.schedule) return;

    const website = instance.schedule.website;
    if (!website) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: `Aktualizace webu ${website.name}`,
        description: `Provést aktualizaci webu ${website.url}`,
        assigned_to: user.id,
        created_by: user.id,
        priority: 'medium',
        status: 'todo',
        due_date: instance.scheduled_date,
      })
      .select()
      .single();

    if (taskError) {
      console.error('Error creating task:', taskError);
      alert('Chyba při vytváření úkolu');
      return;
    }

    const { error: updateError } = await supabase
      .from('website_update_instances')
      .update({ task_id: task.id })
      .eq('id', instanceId);

    if (updateError) {
      console.error('Error linking task:', updateError);
    }

    loadInstances();
  }

  async function updateInstanceStatus(instanceId: string, status: 'pending' | 'completed' | 'skipped') {
    const { error } = await supabase
      .from('website_update_instances')
      .update({
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', instanceId);

    if (error) {
      console.error('Error updating instance status:', error);
      return;
    }

    loadInstances();
  }

  function changeMonth(offset: number) {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonth(newDate);
  }

  const monthName = currentMonth.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <p className="text-gray-500">Načítání...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-80 border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Plány aktualizací</h2>
          {canManage && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Nový plán
            </button>
          )}
        </div>

        {showCreateForm && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Vytvořit plán aktualizací</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Web
                </label>
                <div className="relative" ref={websiteDropdownRef}>
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={websiteSearchQuery}
                      onChange={(e) => {
                        setWebsiteSearchQuery(e.target.value);
                        setShowWebsiteDropdown(true);
                        if (!e.target.value) {
                          setSelectedWebsiteId('');
                        }
                      }}
                      onFocus={() => setShowWebsiteDropdown(true)}
                      placeholder="Vyhledat web..."
                      className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>

                  {showWebsiteDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredWebsites.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          Žádné weby nebyly nalezeny
                        </div>
                      ) : (
                        filteredWebsites.map((website) => (
                          <button
                            key={website.id}
                            type="button"
                            onClick={() => selectWebsite(website)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                              selectedWebsiteId === website.id ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                            }`}
                          >
                            <div className="font-medium">{website.name}</div>
                            <div className="text-xs text-gray-500">{website.url}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Interval
                </label>
                <select
                  value={intervalMonths}
                  onChange={(e) => setIntervalMonths(parseInt(e.target.value) as 1 | 2 | 3 | 6 | 12)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {INTERVAL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  První aktualizace
                </label>
                <input
                  type="date"
                  value={firstUpdateDate}
                  onChange={(e) => setFirstUpdateDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={createSchedule}
                  disabled={!selectedWebsiteId || !firstUpdateDate}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Vytvořit
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  Zrušit
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {schedules.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              Zatím nejsou vytvořeny žádné plány aktualizací
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {schedule.website?.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                        <RepeatIcon className="w-3 h-3" />
                        Každé {INTERVAL_OPTIONS.find(o => o.value === schedule.interval_months)?.label.toLowerCase()}
                      </div>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => deleteSchedule(schedule.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    První aktualizace: {new Date(schedule.first_update_date).toLocaleDateString('cs-CZ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 capitalize">{monthName}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => changeMonth(-1)}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              Předchozí
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              Aktuální
            </button>
            <button
              onClick={() => changeMonth(1)}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              Další
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {instances.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Žádné plánované aktualizace v tomto měsíci</p>
            </div>
          ) : (
            <div className="space-y-4">
              {instances.map((instance) => {
                const website = instance.schedule?.website;
                return (
                  <div
                    key={instance.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-gray-900">
                            {website?.name}
                          </h3>
                          {instance.status === 'completed' && (
                            <CheckCircleIcon className="w-5 h-5 text-green-600" />
                          )}
                          {instance.status === 'skipped' && (
                            <XCircleIcon className="w-5 h-5 text-gray-400" />
                          )}
                          {instance.status === 'pending' && (
                            <ClockIcon className="w-5 h-5 text-orange-500" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {new Date(instance.scheduled_date).toLocaleDateString('cs-CZ', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    {instance.task_id ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
                        <CheckCircleIcon className="w-4 h-4" />
                        Úkol vytvořen
                      </div>
                    ) : canManage ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => createTaskFromInstance(instance.id)}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          Vytvořit úkol
                        </button>
                        {instance.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateInstanceStatus(instance.id, 'completed')}
                              className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                              title="Označit jako hotovo"
                            >
                              <CheckCircleIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateInstanceStatus(instance.id, 'skipped')}
                              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                              title="Přeskočit"
                            >
                              <XCircleIcon className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
