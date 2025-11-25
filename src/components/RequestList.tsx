import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus as PlusIcon, Search as SearchIcon, MessageSquareIcon, CheckSquareIcon, ClockIcon, ZapIcon } from 'lucide-react';
import { RequestCreationPanel } from './RequestCreationPanel';
import type { Request, RequestType, RequestStatusCustom } from '../types';

interface RequestListProps {
  folderId: string | null;
  selectedRequestId: string | null;
  onSelectRequest: (id: string) => void;
}

interface RequestStats {
  notesCount: number;
  tasksCount: number;
  totalTime: number;
}

export function RequestList({ folderId, selectedRequestId, onSelectRequest }: RequestListProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [requestStatuses, setRequestStatuses] = useState<RequestStatusCustom[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreationPanel, setShowCreationPanel] = useState(false);
  const [requestStats, setRequestStats] = useState<Record<string, RequestStats>>({});

  useEffect(() => {
    loadRequestsAndStats();
    loadRequestTypes();
    loadRequestStatuses();
  }, [folderId]);

  async function loadRequestsAndStats() {
    setLoading(true);
    let query = supabase
      .from('requests')
      .select(`
        *,
        assigned_user:user_profiles!requests_assigned_to_fkey(id, email, display_name, first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (folderId) {
      query = query.eq('folder_id', folderId);
    } else {
      query = query.is('request_status_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading requests:', error);
      setLoading(false);
      return;
    }

    const requestsData = data || [];
    setRequests(requestsData);

    if (requestsData.length > 0) {
      await loadRequestStats(requestsData);
    }

    setLoading(false);
  }

  async function loadRequestTypes() {
    const { data, error } = await supabase
      .from('request_types')
      .select('*');

    if (error) {
      console.error('Error loading request types:', error);
    } else {
      setRequestTypes(data || []);
    }
  }

  async function loadRequestStatuses() {
    const { data, error } = await supabase
      .from('request_statuses')
      .select('*')
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading request statuses:', error);
    } else {
      setRequestStatuses(data || []);
    }
  }

  async function loadRequestStats(requestsData: Request[]) {
    if (requestsData.length === 0) {
      setRequestStats({});
      return;
    }

    const requestIds = requestsData.map(r => r.id);

    const [notesData, tasksData, timeData] = await Promise.all([
      supabase
        .from('request_notes')
        .select('request_id')
        .in('request_id', requestIds),
      supabase
        .from('tasks')
        .select('request_id')
        .in('request_id', requestIds),
      supabase
        .from('time_entries')
        .select('request_id, hours')
        .in('request_id', requestIds)
    ]);

    const stats: Record<string, RequestStats> = {};

    requestsData.forEach(request => {
      const notesCount = notesData.data?.filter(n => n.request_id === request.id).length || 0;
      const tasksCount = tasksData.data?.filter(t => t.request_id === request.id).length || 0;
      const totalTime = timeData.data
        ?.filter(t => t.request_id === request.id)
        .reduce((sum, entry) => sum + (entry.hours || 0), 0) || 0;

      stats[request.id] = {
        notesCount,
        tasksCount,
        totalTime: Math.round(totalTime * 10) / 10
      };
    });

    setRequestStats(stats);
  }

  const filteredRequests = requests.filter((request) =>
    request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    request.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    request.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColors = {
    new: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    planning: 'bg-primary/10 text-primary',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-700',
  };

  const statusLabels = {
    new: 'Nová',
    in_progress: 'Probíhá',
    planning: 'Plánování',
    completed: 'Hotovo',
    cancelled: 'Zrušená',
  };

  const priorityColors = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-primary',
    high: 'bg-orange-100 text-orange-600',
    urgent: 'bg-red-100 text-red-600',
  };

  const priorityLabels = {
    low: 'Nízká',
    medium: 'Střední',
    high: 'Vysoká',
    urgent: 'Urgentní',
  };

  return (
    <div className="w-96 border-r border-gray-200 bg-white flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {folderId ? 'Poptávky' : 'Nové poptávky'}
          </h2>
          <button
            onClick={() => setShowCreationPanel(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
          >
            <PlusIcon className="w-4 h-4" />
            Nová poptávka
          </button>
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Hledat poptávky..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Načítání...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? 'Žádné výsledky' : 'Zatím žádné poptávky'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRequests.map((request) => {
              const requestType = requestTypes.find(t => t.id === request.request_type_id);
              const requestStatus = requestStatuses.find(s => s.id === request.request_status_id);
              const stats = requestStats[request.id] || { notesCount: 0, tasksCount: 0, totalTime: 0 };

              return (
                <div
                  key={request.id}
                  onClick={() => onSelectRequest(request.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedRequestId === request.id
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-blue-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900 flex-1">{request.title}</h3>
                    {request.source === 'zapier' && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full text-xs font-medium shadow-sm">
                        <ZapIcon className="w-3 h-3" />
                        Zapier
                      </div>
                    )}
                  </div>

                  {request.client_name && (
                    <div className="text-sm text-gray-600 mb-2">
                      <p>Klient: {request.client_name}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    {requestType && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: requestType.color + '15',
                          color: requestType.color
                        }}
                      >
                        {requestType.name}
                      </span>
                    )}
                    {requestStatus ? (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: requestStatus.color + '15',
                          color: requestStatus.color
                        }}
                      >
                        {requestStatus.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        Nová
                      </span>
                    )}
                    {!request.assigned_to ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                        Nepřevzata
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Převzata
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1 text-gray-600" title="Počet poznámek">
                      <MessageSquareIcon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{stats.notesCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600" title="Počet úkolů">
                      <CheckSquareIcon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{stats.tasksCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600" title="Celkový strávený čas">
                      <ClockIcon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{stats.totalTime}h</span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {request.budget && (
                        <span className="text-xs font-medium text-gray-700">
                          {request.budget}
                        </span>
                      )}
                      {request.deadline && (
                        <span className="text-xs text-gray-500">
                          {new Date(request.deadline).toLocaleDateString('cs-CZ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreationPanel && (
        <RequestCreationPanel
          folderId={folderId}
          onClose={() => setShowCreationPanel(false)}
          onRequestCreated={loadRequestsAndStats}
        />
      )}
    </div>
  );
}
