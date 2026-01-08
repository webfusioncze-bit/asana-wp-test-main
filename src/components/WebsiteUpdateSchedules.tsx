import { useState, useEffect, useRef } from 'react';
import { Plus as PlusIcon, Trash2 as TrashIcon, Calendar as CalendarIcon, Repeat as RepeatIcon, CheckCircle as CheckCircleIcon, XCircle as XCircleIcon, Search as SearchIcon, ChevronDown as ChevronDownIcon, Pencil as EditIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Website, WebsiteUpdateSchedule, WebsiteUpdateInstance, User } from '../types';

interface WebsiteUpdateSchedulesProps {
  canManage: boolean;
  onTaskClick?: (taskId: string) => void;
}

const INTERVAL_OPTIONS = [
  { value: 1, label: '1 měsíc' },
  { value: 2, label: '2 měsíce' },
  { value: 3, label: '3 měsíce' },
  { value: 6, label: '6 měsíců' },
  { value: 12, label: '1 rok' },
];

export function WebsiteUpdateSchedules({ canManage, onTaskClick }: WebsiteUpdateSchedulesProps) {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [schedules, setSchedules] = useState<WebsiteUpdateSchedule[]>([]);
  const [instances, setInstances] = useState<WebsiteUpdateInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState('');
  const [intervalMonths, setIntervalMonths] = useState<1 | 2 | 3 | 6 | 12>(1);
  const [firstUpdateDate, setFirstUpdateDate] = useState('');
  const [websiteSearchQuery, setWebsiteSearchQuery] = useState('');
  const [showWebsiteDropdown, setShowWebsiteDropdown] = useState(false);
  const websiteDropdownRef = useRef<HTMLDivElement>(null);
  const [showTaskAssignModal, setShowTaskAssignModal] = useState(false);
  const [taskAssignInstanceId, setTaskAssignInstanceId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [taskAssignUserId, setTaskAssignUserId] = useState('');
  const [userAssignSearchQuery, setUserAssignSearchQuery] = useState('');
  const [showUserAssignDropdown, setShowUserAssignDropdown] = useState(false);
  const userAssignDropdownRef = useRef<HTMLDivElement>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editIntervalMonths, setEditIntervalMonths] = useState<1 | 2 | 3 | 6 | 12>(1);
  const [editFirstUpdateDate, setEditFirstUpdateDate] = useState('');
  const [taskDataMap, setTaskDataMap] = useState<Record<string, { assigned_to: string | null }>>({});

  useEffect(() => {
    loadData();
    loadUsers();
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (schedules.length > 0) {
      loadInstances();
    }
  }, [schedules]);

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userAssignDropdownRef.current && !userAssignDropdownRef.current.contains(event.target as Node)) {
        setShowUserAssignDropdown(false);
      }
    }

    if (showUserAssignDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showUserAssignDropdown]);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadWebsites(), loadSchedules()]);
    setLoading(false);
  }

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setTaskAssignUserId(user.id);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.display_name) {
        setUserAssignSearchQuery(profile.display_name);
      }
    }
  }

  async function loadUsers() {
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, avatar_url, display_name');

    if (error) {
      console.error('Error loading user profiles:', error);
      return;
    }

    setUsers((profiles || []).map(p => ({
      id: p.id,
      email: p.email || '',
      first_name: p.first_name,
      last_name: p.last_name,
      avatar_url: p.avatar_url,
      display_name: p.display_name
    })));
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
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const endDate = new Date(today.getFullYear(), today.getMonth() + 24, 0);

    const { data, error } = await supabase
      .from('website_update_instances')
      .select(`
        *,
        schedule:website_update_schedules(
          *,
          website:websites(*)
        )
      `)
      .gte('scheduled_date', startDate.toISOString().split('T')[0])
      .lte('scheduled_date', endDate.toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true });

    if (error) {
      console.error('Error loading instances:', error);
      return;
    }

    setInstances(data || []);

    const taskIds = (data || []).filter(i => i.task_id).map(i => i.task_id);
    if (taskIds.length > 0) {
      const { data: tasksData } = await supabase
        .rpc('get_website_update_task_assignments', { task_ids: taskIds });

      if (tasksData) {
        const map: Record<string, { assigned_to: string | null }> = {};
        tasksData.forEach((t: { task_id: string; assigned_to: string | null }) => {
          map[t.task_id] = { assigned_to: t.assigned_to };
        });
        setTaskDataMap(map);
      }
    }
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

  const filteredAssignUsers = users.filter(user => {
    const searchLower = userAssignSearchQuery.toLowerCase();
    return (
      user.display_name?.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower)
    );
  });

  function selectAssignUser(user: User) {
    setTaskAssignUserId(user.id);
    setUserAssignSearchQuery(user.display_name || user.email);
    setShowUserAssignDropdown(false);
  }

  function openEditSchedule(schedule: WebsiteUpdateSchedule) {
    setEditingScheduleId(schedule.id);
    setEditIntervalMonths(schedule.interval_months as 1 | 2 | 3 | 6 | 12);
    setEditFirstUpdateDate(schedule.first_update_date);
  }

  async function saveEditSchedule() {
    if (!editingScheduleId || !editFirstUpdateDate) return;

    const { error } = await supabase
      .from('website_update_schedules')
      .update({
        interval_months: editIntervalMonths,
        first_update_date: editFirstUpdateDate,
      })
      .eq('id', editingScheduleId);

    if (error) {
      console.error('Error updating schedule:', error);
      alert('Chyba při aktualizaci plánu');
      return;
    }

    setEditingScheduleId(null);
    setEditIntervalMonths(1);
    setEditFirstUpdateDate('');
    loadData();
  }

  function cancelEdit() {
    setEditingScheduleId(null);
    setEditIntervalMonths(1);
    setEditFirstUpdateDate('');
  }

  async function deleteSchedule(scheduleId: string) {
    if (!confirm('Opravdu chcete smazat tento plán aktualizací?')) return;

    const { error: instancesError } = await supabase
      .from('website_update_instances')
      .delete()
      .eq('schedule_id', scheduleId)
      .eq('status', 'pending')
      .is('task_id', null);

    if (instancesError) {
      console.error('Error deleting future instances:', instancesError);
    }

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

  function openTaskAssignModal(instanceId: string) {
    setTaskAssignInstanceId(instanceId);
    setShowTaskAssignModal(true);
  }

  async function confirmCreateTask() {
    if (!taskAssignInstanceId || !taskAssignUserId) {
      alert('Vyberte uživatele, kterému chcete úkol přiřadit');
      return;
    }

    const instance = instances.find(i => i.id === taskAssignInstanceId);
    if (!instance || !instance.schedule) return;

    const website = instance.schedule.website;
    if (!website) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let folderId: string | null = null;

    const { data: unassignedFolder } = await supabase
      .from('folders')
      .select('id')
      .eq('owner_id', taskAssignUserId)
      .eq('name', 'Nepřiřazené')
      .eq('is_global', false)
      .maybeSingle();

    if (unassignedFolder) {
      folderId = unassignedFolder.id;
    } else {
      const { data: globalFolder } = await supabase
        .from('folders')
        .select('id')
        .eq('is_global', true)
        .eq('name', 'Klienti')
        .maybeSingle();

      if (globalFolder) {
        folderId = globalFolder.id;
      } else {
        const { data: anyGlobalFolder } = await supabase
          .from('folders')
          .select('id')
          .eq('is_global', true)
          .limit(1)
          .maybeSingle();

        folderId = anyGlobalFolder?.id || null;
      }
    }

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: `Aktualizace webu ${website.name}`,
        description: `Provést aktualizaci webu ${website.url}`,
        assigned_to: taskAssignUserId,
        created_by: user.id,
        priority: 'medium',
        status: 'todo',
        due_date: instance.scheduled_date,
        folder_id: folderId,
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
      .eq('id', taskAssignInstanceId);

    if (updateError) {
      console.error('Error linking task:', updateError);
    }

    setShowTaskAssignModal(false);
    setTaskAssignInstanceId(null);
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

  const instancesByMonth = instances.reduce((acc, instance) => {
    const date = new Date(instance.scheduled_date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(instance);
    return acc;
  }, {} as Record<string, typeof instances>);

  const sortedMonthKeys = Object.keys(instancesByMonth).sort();

  const currentMonthKey = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  const currentMonthRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentMonthRef.current && sortedMonthKeys.length > 0) {
      setTimeout(() => {
        currentMonthRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [sortedMonthKeys.length]);

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
        <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Plány aktualizací</h2>
          {canManage && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Nový plán"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {showCreateForm && (
          <div className="p-3 border-b border-gray-200 bg-gray-50 space-y-2">
            <div className="relative" ref={websiteDropdownRef}>
              <input
                type="text"
                value={websiteSearchQuery}
                onChange={(e) => {
                  setWebsiteSearchQuery(e.target.value);
                  setShowWebsiteDropdown(true);
                  if (!e.target.value) setSelectedWebsiteId('');
                }}
                onFocus={() => setShowWebsiteDropdown(true)}
                placeholder="Vybrat web..."
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {showWebsiteDropdown && filteredWebsites.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto">
                  {filteredWebsites.map((website) => (
                    <button
                      key={website.id}
                      type="button"
                      onClick={() => selectWebsite(website)}
                      className="w-full text-left px-2 py-1 text-xs hover:bg-gray-50"
                    >
                      {website.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={intervalMonths}
                onChange={(e) => setIntervalMonths(parseInt(e.target.value) as 1 | 2 | 3 | 6 | 12)}
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                type="date"
                value={firstUpdateDate}
                onChange={(e) => setFirstUpdateDate(e.target.value)}
                className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={createSchedule}
                disabled={!selectedWebsiteId || !firstUpdateDate}
                className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
              >
                Vytvořit
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
              >
                Zrušit
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-gray-100">
            {websites.map((website) => {
              const schedule = schedules.find(s => s.website_id === website.id);
              const isEditing = schedule && editingScheduleId === schedule.id;

              return (
                <div
                  key={website.id}
                  className={`px-3 py-1.5 hover:bg-gray-50 transition-colors border-l-2 ${
                    schedule ? 'border-l-green-400' : 'border-l-gray-200 bg-gray-50/50'
                  }`}
                >
                  {isEditing && schedule ? (
                    <div className="space-y-2 py-1">
                      <div className="text-xs font-medium text-gray-900 truncate">{website.name}</div>
                      <div className="flex gap-2">
                        <select
                          value={editIntervalMonths}
                          onChange={(e) => setEditIntervalMonths(parseInt(e.target.value) as 1 | 2 | 3 | 6 | 12)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {INTERVAL_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={editFirstUpdateDate}
                          onChange={(e) => setEditFirstUpdateDate(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={saveEditSchedule}
                          className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          Uložit
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                        >
                          Zrušit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex-1 text-xs truncate ${
                          schedule ? 'text-gray-700' : 'text-gray-400 italic'
                        }`}
                        title={website.name}
                      >
                        {website.name}
                      </span>
                      {schedule ? (
                        <>
                          <span className="text-[10px] text-gray-500 whitespace-nowrap font-medium">
                            {schedule.interval_months}M
                          </span>
                          {canManage && (
                            <>
                              <button
                                onClick={() => openEditSchedule(schedule)}
                                className="p-0.5 text-gray-400 hover:text-blue-600 transition-colors"
                              >
                                <EditIcon className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => deleteSchedule(schedule.id)}
                                className="p-0.5 text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <TrashIcon className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-300">bez plánu</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Plánované aktualizace</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {instances.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">Žádné plánované aktualizace</p>
            </div>
          ) : (
            <div>
              {sortedMonthKeys.map((monthKey) => {
                const [year, month] = monthKey.split('-');
                const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                const monthName = monthDate.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
                const isCurrentMonth = monthKey === currentMonthKey;
                const monthInstances = instancesByMonth[monthKey];

                return (
                  <div
                    key={monthKey}
                    ref={isCurrentMonth ? currentMonthRef : null}
                    className="border-b border-gray-200"
                  >
                    <div className={`sticky top-0 z-10 px-4 py-2 bg-gray-50 border-b border-gray-200 ${isCurrentMonth ? 'bg-blue-50' : ''}`}>
                      <h3 className={`text-sm font-semibold capitalize ${isCurrentMonth ? 'text-blue-900' : 'text-gray-700'}`}>
                        {monthName}
                        <span className={`ml-2 text-xs font-medium ${isCurrentMonth ? 'text-blue-700' : 'text-gray-600'}`}>
                          ({monthInstances.length})
                        </span>
                        {isCurrentMonth && <span className="ml-2 text-xs font-normal text-blue-600">(aktuální)</span>}
                      </h3>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {monthInstances.map((instance) => {
                        const website = instance.schedule?.website;
                        const date = new Date(instance.scheduled_date);
                        const dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isOverdue = date < today && instance.status === 'pending' && !instance.task_id;
                        const taskData = instance.task_id ? taskDataMap[instance.task_id] : null;
                        const assignedUser = taskData?.assigned_to
                          ? users.find(u => u.id === taskData.assigned_to)
                          : null;

                        return (
                          <div
                            key={instance.id}
                            className={`px-4 py-2.5 transition-colors flex items-center justify-between gap-3 ${
                              isOverdue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'
                            } ${instance.task_id && onTaskClick ? 'cursor-pointer' : ''}`}
                            onClick={() => {
                              if (instance.task_id && onTaskClick) {
                                onTaskClick(instance.task_id);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className={`text-xs font-medium w-12 flex-shrink-0 ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                                {dateStr}
                              </span>
                              <span className="text-sm text-gray-900 truncate">
                                {website?.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {instance.task_id && assignedUser ? (
                                <div className="flex items-center gap-2">
                                  {assignedUser.avatar_url ? (
                                    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                                      <img
                                        src={assignedUser.avatar_url}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs text-gray-600">
                                        {(assignedUser.first_name?.[0] || assignedUser.email[0]).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <span className="text-xs text-gray-700 whitespace-nowrap">
                                    {assignedUser.display_name || assignedUser.first_name || assignedUser.email}
                                  </span>
                                </div>
                              ) : instance.task_id ? (
                                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                              ) : canManage && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openTaskAssignModal(instance.id);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                >
                                  Vytvořit úkol
                                </button>
                              )}

                              {canManage && instance.status === 'pending' && !instance.task_id && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateInstanceStatus(instance.id, 'completed');
                                    }}
                                    className="p-1 hover:bg-green-50 rounded transition-colors"
                                    title="Označit jako hotovo"
                                  >
                                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateInstanceStatus(instance.id, 'skipped');
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                                    title="Přeskočit"
                                  >
                                    <XCircleIcon className="w-4 h-4 text-gray-400" />
                                  </button>
                                </>
                              )}

                              {instance.status === 'completed' && !instance.task_id && (
                                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                              )}
                              {instance.status === 'skipped' && (
                                <XCircleIcon className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showTaskAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Přiřadit úkol uživateli
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Přiřadit uživateli
              </label>
              <div className="relative" ref={userAssignDropdownRef}>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={userAssignSearchQuery}
                    onChange={(e) => {
                      setUserAssignSearchQuery(e.target.value);
                      setShowUserAssignDropdown(true);
                      if (!e.target.value) {
                        setTaskAssignUserId('');
                      }
                    }}
                    onFocus={() => setShowUserAssignDropdown(true)}
                    placeholder="Začněte psát jméno nebo email..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                {showUserAssignDropdown && filteredAssignUsers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredAssignUsers.map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => selectAssignUser(user)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                          taskAssignUserId === user.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-xs text-gray-600">
                              {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {user.display_name || user.email}
                          </div>
                          {user.display_name && (
                            <div className="text-xs text-gray-500 truncate">{user.email}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmCreateTask}
                disabled={!taskAssignUserId}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Vytvořit úkol
              </button>
              <button
                onClick={() => {
                  setShowTaskAssignModal(false);
                  setTaskAssignInstanceId(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
