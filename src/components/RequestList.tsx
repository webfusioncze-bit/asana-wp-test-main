import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus as PlusIcon, Search as SearchIcon, MessageSquareIcon, CheckSquareIcon, ClockIcon, ZapIcon, ShoppingCart as ShoppingCartIcon, TrendingUp as TrendingUpIcon, Settings as SettingsIcon, Smartphone as SmartphoneIcon, CheckCheck as CheckCheckIcon, Trash2 as Trash2Icon, FolderIcon, XIcon, MailIcon } from 'lucide-react';
import { RequestCreationPanel } from './RequestCreationPanel';
import { RequestListSkeleton } from './LoadingSkeleton';
import { useDataCache } from '../contexts/DataCacheContext';
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
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [showBulkFolderMenu, setShowBulkFolderMenu] = useState(false);
  const { loadRequests: loadCachedRequests, invalidateRequests, isLoading: cacheLoading } = useDataCache();

  const isEshopRequest = (request: Request) => {
    return !!(request.favorite_eshop || request.product_count);
  };

  const isPPCRequest = (request: Request) => {
    return !!(request.monthly_management_budget && request.monthly_credits_budget);
  };

  const isManagementRequest = (request: Request) => {
    return !!(request.monthly_management_budget && !request.monthly_credits_budget);
  };

  const isAppRequest = (request: Request) => {
    return !!request.development_phase;
  };

  const isEmailRequest = (request: any) => {
    const sourceName = request.zapier_source?.name?.toLowerCase() || '';
    return sourceName.includes('email') || sourceName.includes('emaily');
  };

  useEffect(() => {
    loadData();
  }, [folderId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showBulkFolderMenu && !target.closest('.bulk-folder-menu')) {
        setShowBulkFolderMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBulkFolderMenu]);

  async function loadData() {
    setLoading(true);
    await Promise.all([
      loadRequestsAndStats(),
      loadRequestTypes(),
      loadRequestStatuses()
    ]);
    setLoading(false);
  }

  async function loadRequestsAndStats() {
    let query = supabase
      .from('requests')
      .select(`
        *,
        assigned_user:user_profiles!requests_assigned_to_fkey(id, email, display_name, first_name, last_name),
        zapier_source:zapier_sources!requests_zapier_source_id_fkey(id, name)
      `)
      .order('created_at', { ascending: false });

    if (folderId) {
      query = query.eq('request_status_id', folderId);
    } else {
      query = query.is('request_status_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading requests:', error);
      return;
    }

    const requestsData = data || [];
    setRequests(requestsData);

    if (requestsData.length > 0) {
      await loadRequestStats(requestsData);
    }
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

  const filteredRequests = requests.filter((request) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();

    const searchableFields = [
      request.title,
      request.description,
      request.client_name,
      request.client_email,
      request.client_phone,
      request.budget,
      request.source,
      request.storage_url,
      request.current_website_url,
      request.additional_services,
      request.delivery_speed,
      request.ai_usage,
      request.project_materials_link,
      request.favorite_eshop,
      request.marketing_goal,
      request.competitor_url,
      request.monthly_management_budget,
      request.monthly_credits_budget,
      request.development_phase,
      request.status,
      request.priority,
      request.subpage_count?.toString(),
      request.product_count?.toString(),
      request.accepted_price?.toString(),
      request.estimated_hours?.toString(),
      (request as any).assigned_user?.display_name,
      (request as any).assigned_user?.email,
      (request as any).assigned_user?.first_name,
      (request as any).assigned_user?.last_name,
      (request as any).zapier_source?.name,
    ];

    return searchableFields.some(field =>
      field && field.toString().toLowerCase().includes(query)
    );
  });

  const toggleBulkSelect = () => {
    setBulkSelectMode(!bulkSelectMode);
    setSelectedRequests(new Set());
    setShowBulkFolderMenu(false);
  };

  const toggleRequestSelection = (requestId: string) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedRequests(newSelected);
  };

  const selectAllVisible = () => {
    setSelectedRequests(new Set(filteredRequests.map(r => r.id)));
  };

  const deselectAll = () => {
    setSelectedRequests(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedRequests.size === 0) return;

    if (!confirm(`Opravdu chcete smazat ${selectedRequests.size} poptávek?`)) {
      return;
    }

    const requestIds = Array.from(selectedRequests);

    const { error } = await supabase
      .from('requests')
      .delete()
      .in('id', requestIds);

    if (error) {
      console.error('Error deleting requests:', error);
      alert('Chyba při mazání poptávek');
      return;
    }

    await loadRequestsAndStats();
    setSelectedRequests(new Set());
    setBulkSelectMode(false);
  };

  const handleQuickDismiss = async (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation();
    if (!confirm('Opravdu chcete tuto poptavku smazat?')) {
      return;
    }

    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      console.error('Error deleting request:', error);
      alert('Chyba pri mazani poptavky');
      return;
    }

    await loadRequestsAndStats();
  };

  const handleBulkMove = async (statusId: string | null) => {
    if (selectedRequests.size === 0) return;

    const requestIds = Array.from(selectedRequests);

    const { error } = await supabase
      .from('requests')
      .update({ request_status_id: statusId })
      .in('id', requestIds);

    if (error) {
      console.error('Error moving requests:', error);
      alert('Chyba při přesunu poptávek');
      return;
    }

    await loadRequestsAndStats();
    setSelectedRequests(new Set());
    setShowBulkFolderMenu(false);
    setBulkSelectMode(false);
  };

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

  if (loading || cacheLoading.requests) {
    return <RequestListSkeleton />;
  }

  return (
    <div className="w-96 border-r border-gray-200 bg-white flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {folderId ? 'Poptávky' : 'Nové poptávky'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleBulkSelect}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                bulkSelectMode
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Hromadný výběr"
            >
              <CheckCheckIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreationPanel(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
            >
              <PlusIcon className="w-4 h-4" />
              Nová poptávka
            </button>
          </div>
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

        {bulkSelectMode && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-700">
                {selectedRequests.size > 0 ? (
                  <span>Vybráno: {selectedRequests.size}</span>
                ) : (
                  <span>Vyberte poptávky</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedRequests.size < filteredRequests.length ? (
                  <button
                    onClick={selectAllVisible}
                    className="text-xs text-primary hover:text-primary-dark font-medium"
                  >
                    Vybrat vše
                  </button>
                ) : (
                  <button
                    onClick={deselectAll}
                    className="text-xs text-primary hover:text-primary-dark font-medium"
                  >
                    Zrušit výběr
                  </button>
                )}
              </div>
            </div>
            {selectedRequests.size > 0 && (
              <div className="flex items-center gap-2">
                <div className="relative bulk-folder-menu">
                  <button
                    onClick={() => setShowBulkFolderMenu(!showBulkFolderMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-sm"
                  >
                    <FolderIcon className="w-4 h-4" />
                    Přesunout
                  </button>
                  {showBulkFolderMenu && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                      <div className="p-2">
                        <button
                          onClick={() => handleBulkMove(null)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                        >
                          Nové poptávky
                        </button>
                        {requestStatuses.map((status) => (
                          <button
                            key={status.id}
                            onClick={() => handleBulkMove(status.id)}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2"
                          >
                            <div
                              className="w-3 h-3 rounded"
                              style={{ backgroundColor: status.color }}
                            />
                            {status.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                >
                  <Trash2Icon className="w-4 h-4" />
                  Smazat
                </button>
              </div>
            )}
          </div>
        )}
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

              const isSelected = selectedRequests.has(request.id);

              return (
                <div
                  key={request.id}
                  onClick={() => {
                    if (bulkSelectMode) {
                      toggleRequestSelection(request.id);
                    } else {
                      onSelectRequest(request.id);
                    }
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    bulkSelectMode && isSelected
                      ? 'border-primary bg-blue-50'
                      : selectedRequestId === request.id
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-blue-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-start gap-2 flex-1">
                      {bulkSelectMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-0.5 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                        />
                      )}
                      <h3 className="font-medium text-sm text-gray-900 flex-1">{request.title}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isEmailRequest(request) ? (
                        <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-full shadow-sm" title="Email na hello@webfusion.cz">
                          <MailIcon className="w-3 h-3" />
                        </div>
                      ) : request.source === 'zapier' && (
                        <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full shadow-sm" title="Zapier integrace">
                          <ZapIcon className="w-3 h-3" />
                        </div>
                      )}
                      {isAppRequest(request) && (
                        <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full shadow-sm" title="Vývoj aplikace">
                          <SmartphoneIcon className="w-3 h-3" />
                        </div>
                      )}
                      {isEshopRequest(request) && (
                        <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-full shadow-sm" title="E-shop poptávka">
                          <ShoppingCartIcon className="w-3 h-3" />
                        </div>
                      )}
                      {isPPCRequest(request) && (
                        <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full shadow-sm" title="PPC poptávka">
                          <TrendingUpIcon className="w-3 h-3" />
                        </div>
                      )}
                      {isManagementRequest(request) && (
                        <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full shadow-sm" title="Správa webu">
                          <SettingsIcon className="w-3 h-3" />
                        </div>
                      )}
                      {isEmailRequest(request) && (
                        <button
                          onClick={(e) => handleQuickDismiss(e, request.id)}
                          className="flex items-center justify-center w-5 h-5 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors"
                          title="Odmitnout (smazat)"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {request.client_name && (
                    <div className="text-xs text-gray-600 mb-1.5">
                      <p>Klient: {request.client_name}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-1 flex-wrap mb-2">
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

                  <div className="flex items-center gap-2 pt-1.5 border-t border-gray-100">
                    <div className="flex items-center gap-0.5 text-gray-600" title="Počet poznámek">
                      <MessageSquareIcon className="w-3 h-3" />
                      <span className="text-xs font-medium">{stats.notesCount}</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-gray-600" title="Počet úkolů">
                      <CheckSquareIcon className="w-3 h-3" />
                      <span className="text-xs font-medium">{stats.tasksCount}</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-gray-600" title="Celkový strávený čas">
                      <ClockIcon className="w-3 h-3" />
                      <span className="text-xs font-medium">{stats.totalTime}h</span>
                    </div>
                    {request.product_count && (
                      <div className="flex items-center gap-0.5 text-indigo-600" title="Počet produktů e-shopu">
                        <ShoppingCartIcon className="w-3 h-3" />
                        <span className="text-xs font-medium">{request.product_count}</span>
                      </div>
                    )}
                    <div className="ml-auto flex items-center gap-1.5">
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
