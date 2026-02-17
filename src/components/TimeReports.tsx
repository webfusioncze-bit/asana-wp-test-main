import { useState, useEffect, useMemo } from 'react';
import {
  ClockIcon,
  DownloadIcon,
  FilterIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  BriefcaseIcon,
  CheckSquareIcon,
  InboxIcon,
  LayersIcon,
  UserIcon,
  CalendarIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TimeReportTable } from './TimeReportTable';

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
}

export interface UnifiedTimeEntry {
  id: string;
  userId: string;
  userName: string;
  date: string;
  hours: number;
  description: string;
  type: 'project' | 'task' | 'request';
  projectName: string | null;
  phaseName: string | null;
  taskTitle: string | null;
  requestTitle: string | null;
  folderName: string | null;
}

interface MonthSummary {
  totalHours: number;
  projectHours: number;
  taskHours: number;
  requestHours: number;
  userBreakdown: Map<string, { name: string; hours: number }>;
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function getUserName(profile: UserProfile): string {
  if (profile.first_name || profile.last_name) {
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
  }
  return profile.display_name || profile.email;
}

const MONTH_NAMES = [
  'Leden', 'Unor', 'Brezen', 'Duben', 'Kveten', 'Cerven',
  'Cervenec', 'Srpen', 'Zari', 'Rijen', 'Listopad', 'Prosinec',
];

export function TimeReports() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [entries, setEntries] = useState<UnifiedTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'date' | 'user' | 'type'>('user');

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadTimeEntries();
  }, [selectedYear, selectedMonth]);

  async function loadUsers() {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, display_name')
      .order('email');

    if (data) setUsers(data);
  }

  async function loadTimeEntries() {
    setLoading(true);
    const { start, end } = getMonthRange(selectedYear, selectedMonth);

    const userMap = new Map<string, UserProfile>();
    for (const u of users) userMap.set(u.id, u);

    if (users.length === 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, display_name');
      if (profiles) {
        setUsers(profiles);
        for (const u of profiles) userMap.set(u.id, u);
      }
    }

    const unified: UnifiedTimeEntry[] = [];

    const [timeEntriesResult, projectEntriesResult] = await Promise.all([
      supabase
        .from('time_entries')
        .select('id, user_id, task_id, request_id, description, hours, date')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false }),
      supabase
        .from('project_time_entries')
        .select('id, user_id, description, hours, entry_date, project_phases(name, project_id, projects(name))')
        .gte('entry_date', start)
        .lte('entry_date', end)
        .order('entry_date', { ascending: false }),
    ]);

    const timeEntries = timeEntriesResult.data || [];
    const requestIds = [...new Set(timeEntries.filter(t => t.request_id).map(t => t.request_id))];
    const taskIds = [...new Set(timeEntries.filter(t => t.task_id).map(t => t.task_id))];

    const [requestsResult, tasksResult] = await Promise.all([
      requestIds.length > 0
        ? supabase.from('requests').select('id, title').in('id', requestIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      taskIds.length > 0
        ? supabase.from('tasks').select('id, title, folders(name)').in('id', taskIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const requestMap = new Map<string, string>();
    for (const r of requestsResult.data || []) {
      requestMap.set(r.id, r.title);
    }
    const taskMap = new Map<string, { title: string; folderName: string | null }>();
    for (const t of tasksResult.data || []) {
      taskMap.set(t.id, { title: t.title, folderName: (t.folders as any)?.name || null });
    }

    for (const te of timeEntries) {
      const user = userMap.get(te.user_id);
      const taskInfo = te.task_id ? taskMap.get(te.task_id) : null;
      const requestTitle = te.request_id ? requestMap.get(te.request_id) : null;
      unified.push({
        id: te.id,
        userId: te.user_id,
        userName: user ? getUserName(user) : te.user_id,
        date: te.date,
        hours: Number(te.hours),
        description: te.description || '',
        type: te.request_id ? 'request' : 'task',
        projectName: null,
        phaseName: null,
        taskTitle: taskInfo?.title || null,
        requestTitle: requestTitle || null,
        folderName: taskInfo?.folderName || null,
      });
    }

    for (const pte of projectEntriesResult.data || []) {
      const user = userMap.get(pte.user_id);
      const phase = pte.project_phases as any;
      unified.push({
        id: pte.id,
        userId: pte.user_id,
        userName: user ? getUserName(user) : pte.user_id,
        date: pte.entry_date,
        hours: Number(pte.hours),
        description: pte.description || '',
        type: 'project',
        projectName: phase?.projects?.name || null,
        phaseName: phase?.name || null,
        taskTitle: null,
        requestTitle: null,
        folderName: null,
      });
    }

    unified.sort((a, b) => b.date.localeCompare(a.date));

    setEntries(unified);
    setLoading(false);
  }

  const filteredEntries = useMemo(() => {
    if (selectedUserId === 'all') return entries;
    return entries.filter(e => e.userId === selectedUserId);
  }, [entries, selectedUserId]);

  const summary = useMemo<MonthSummary>(() => {
    const userBreakdown = new Map<string, { name: string; hours: number }>();
    let totalHours = 0;
    let projectHours = 0;
    let taskHours = 0;
    let requestHours = 0;

    for (const e of filteredEntries) {
      totalHours += e.hours;
      if (e.type === 'project') projectHours += e.hours;
      else if (e.type === 'task') taskHours += e.hours;
      else requestHours += e.hours;

      const existing = userBreakdown.get(e.userId);
      if (existing) {
        existing.hours += e.hours;
      } else {
        userBreakdown.set(e.userId, { name: e.userName, hours: e.hours });
      }
    }

    return { totalHours, projectHours, taskHours, requestHours, userBreakdown };
  }, [filteredEntries]);

  function navigateMonth(direction: -1 | 1) {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  }

  function exportCSV() {
    const headers = ['Datum', 'Uzivatel', 'Typ', 'Projekt', 'Faze', 'Ukol', 'Poptavka', 'Slozka', 'Cinnost', 'Hodiny'];
    const rows = filteredEntries.map(e => [
      e.date,
      e.userName,
      e.type === 'project' ? 'Projekt' : e.type === 'task' ? 'Ukol' : 'Poptavka',
      e.projectName || '',
      e.phaseName || '',
      e.taskTitle || '',
      e.requestTitle || '',
      e.folderName || '',
      e.description,
      e.hours.toFixed(2),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vykazy-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeUsers = useMemo(() => {
    const userIds = new Set(entries.map(e => e.userId));
    return users.filter(u => userIds.has(u.id));
  }, [entries, users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200">
            <CalendarIcon className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-800 min-w-[120px] text-center">
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </span>
          </div>
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronRightIcon className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FilterIcon className="w-4 h-4 text-gray-400" />
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Vsichni uzivatele</option>
              {activeUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {getUserName(u)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {([
              { value: 'user', label: 'Uzivatel' },
              { value: 'date', label: 'Datum' },
              { value: 'type', label: 'Typ' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setGroupBy(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  groupBy === opt.value
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={exportCSV}
            disabled={filteredEntries.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DownloadIcon className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={ClockIcon}
          label="Celkem hodin"
          value={summary.totalHours}
          color="blue"
          count={filteredEntries.length}
        />
        <SummaryCard
          icon={BriefcaseIcon}
          label="Projekty"
          value={summary.projectHours}
          color="emerald"
        />
        <SummaryCard
          icon={CheckSquareIcon}
          label="Ukoly"
          value={summary.taskHours}
          color="amber"
        />
        <SummaryCard
          icon={InboxIcon}
          label="Poptavky"
          value={summary.requestHours}
          color="rose"
        />
      </div>

      {selectedUserId === 'all' && summary.userBreakdown.size > 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <UserIcon className="w-4 h-4" />
            Rozdeleni dle uzivatelu
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from(summary.userBreakdown.entries())
              .sort((a, b) => b[1].hours - a[1].hours)
              .map(([userId, data]) => (
                <button
                  key={userId}
                  onClick={() => setSelectedUserId(userId)}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-colors text-left"
                >
                  <span className="text-sm text-gray-700 truncate mr-2">{data.name}</span>
                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{data.hours.toFixed(1)}h</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2Icon className="w-6 h-6 text-blue-600 animate-spin" />
          <span className="ml-3 text-sm text-gray-500">Nacitam vykazy...</span>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <LayersIcon className="w-12 h-12 mb-3" />
          <p className="text-sm">Zadne vykazy pro vybrany mesic</p>
        </div>
      ) : (
        <TimeReportTable entries={filteredEntries} groupBy={groupBy} />
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
  count,
}: {
  icon: typeof ClockIcon;
  label: string;
  value: number;
  color: string;
  count?: number;
}) {
  const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-600' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-600' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', text: 'text-amber-600' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-600', text: 'text-rose-600' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${c.bg}`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{value.toFixed(1)}</span>
        <span className="text-sm text-gray-400">hodin</span>
      </div>
      {count !== undefined && (
        <p className="text-xs text-gray-400 mt-1">{count} zaznamu</p>
      )}
    </div>
  );
}
