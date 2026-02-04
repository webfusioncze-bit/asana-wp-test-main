import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus as PlusIcon, Search as SearchIcon, MessageSquareIcon, CheckSquareIcon, ClockIcon, ZapIcon, ShoppingCart as ShoppingCartIcon, TrendingUp as TrendingUpIcon, Settings as SettingsIcon, Smartphone as SmartphoneIcon, CheckCheck as CheckCheckIcon, Trash2 as Trash2Icon, FolderIcon, XIcon, MailIcon, UserIcon, ChevronDownIcon, UsersIcon, FilterIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { RequestCreationPanel } from './RequestCreationPanel';
import { RequestListSkeleton } from './LoadingSkeleton';
import { useDataCache } from '../contexts/DataCacheContext';
import type { Request, RequestType, RequestStatusCustom, User } from '../types';

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

interface RequestWithUser extends Request {
  assigned_owner?: {
    id: string;
    email: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
  zapier_source?: {
    id: string;
    name: string;
  } | null;
}

type TakenFilterType = 'mine' | 'all' | string;
type UntakenFilterType = 'unassigned' | 'assigned_pending';

const UNTAKEN_PAGE_SIZE = 5;

export function RequestList({ folderId, selectedRequestId, onSelectRequest }: RequestListProps) {
  const [requests, setRequests] = useState<RequestWithUser[]>([]);
  const [allRequests, setAllRequests] = useState<RequestWithUser[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [requestStatuses, setRequestStatuses] = useState<RequestStatusCustom[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showCreationPanel, setShowCreationPanel] = useState(false);
  const [requestStats, setRequestStats] = useState<Record<string, RequestStats>>({});
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [showBulkFolderMenu, setShowBulkFolderMenu] = useState(false);
  const [takenFilter, setTakenFilter] = useState<TakenFilterType>('mine');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [untakenPage, setUntakenPage] = useState(1);
  const [untakenFilter, setUntakenFilter] = useState<UntakenFilterType>('unassigned');
  const { isLoading: cacheLoading } = useDataCache();

  const isSearchMode = searchQuery.length > 0;

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

  const isEmailRequest = (request: RequestWithUser) => {
    const sourceName = request.zapier_source?.name?.toLowerCase() || '';
    return sourceName.includes('email') || sourceName.includes('emaily');
  };

  useEffect(() => {
    loadCurrentUser();
    loadData();
  }, [folderId]);

  useEffect(() => {
    if (searchQuery.length > 0) {
      loadAllRequests();
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showBulkFolderMenu && !target.closest('.bulk-folder-menu')) {
        setShowBulkFolderMenu(false);
      }
      if (showFilterMenu && !target.closest('.filter-menu-container')) {
        setShowFilterMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBulkFolderMenu, showFilterMenu]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  }

  async function loadData() {
    setLoading(true);
    await Promise.all([
      loadRequestsAndStats(),
      loadRequestTypes(),
      loadRequestStatuses(),
      loadAllUsers()
    ]);
    setLoading(false);
  }

  async function loadRequestsAndStats() {
    let query = supabase
      .from('requests')
      .select(`
        *,
        assigned_owner:user_profiles!requests_assigned_user_id_fkey(id, email, display_name, first_name, last_name, avatar_url),
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

    const requestsData = (data || []) as RequestWithUser[];
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

  async function loadAllUsers() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, display_name, avatar_url')
      .order('first_name');

    if (error) {
      console.error('Error loading users:', error);
    } else {
      setAllUsers(data?.map(u => ({
        id: u.id,
        email: u.email || '',
        first_name: u.first_name,
        last_name: u.last_name,
        display_name: u.display_name,
        avatar_url: u.avatar_url
      })) || []);
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

  async function loadAllRequests() {
    setSearchLoading(true);
    const { data, error } = await supabase
      .from('requests')
      .select(`
        *,
        assigned_owner:user_profiles!requests_assigned_user_id_fkey(id, email, display_name, first_name, last_name, avatar_url),
        zapier_source:zapier_sources!requests_zapier_source_id_fkey(id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading all requests:', error);
    } else {
      setAllRequests((data || []) as RequestWithUser[]);
    }
    setSearchLoading(false);
  }

  const filterRequest = (request: RequestWithUser, query: string) => {
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
      request.assigned_owner?.display_name,
      request.assigned_owner?.email,
      request.assigned_owner?.first_name,
      request.assigned_owner?.last_name,
      request.zapier_source?.name,
    ];

    return searchableFields.some(field =>
      field && field.toString().toLowerCase().includes(query)
    );
  };

  const unassignedRequests = requests.filter(r => !r.assigned_user_id);
  const assignedPendingRequests = requests.filter(r =>
    r.assigned_user_id && !r.is_taken && r.assigned_user_id !== currentUserId
  );

  const displayedUntakenRequests = untakenFilter === 'unassigned'
    ? unassignedRequests
    : assignedPendingRequests;
  const untakenTotalPages = Math.ceil(displayedUntakenRequests.length / UNTAKEN_PAGE_SIZE);
  const paginatedUntakenRequests = displayedUntakenRequests.slice(
    (untakenPage - 1) * UNTAKEN_PAGE_SIZE,
    untakenPage * UNTAKEN_PAGE_SIZE
  );

  const myPendingRequests = requests.filter(r =>
    r.assigned_user_id === currentUserId && !r.is_taken
  );

  const takenRequests = requests.filter(r => {
    if (!r.assigned_user_id) return false;
    if (r.assigned_user_id === currentUserId && !r.is_taken) return false;

    if (takenFilter === 'mine') {
      return r.assigned_user_id === currentUserId && r.is_taken;
    } else if (takenFilter === 'all') {
      return r.is_taken;
    } else {
      return r.assigned_user_id === takenFilter && r.is_taken;
    }
  });

  const pendingAssignmentCount = myPendingRequests.length;

  const globalSearchResults = isSearchMode
    ? allRequests.filter(request => filterRequest(request, searchQuery.toLowerCase()))
    : [];

  const groupedSearchResults = isSearchMode
    ? globalSearchResults.reduce((acc, request) => {
        const statusId = request.request_status_id || 'new';
        if (!acc[statusId]) {
          acc[statusId] = [];
        }
        acc[statusId].push(request);
        return acc;
      }, {} as Record<string, RequestWithUser[]>)
    : {};

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
    const allVisible = [...displayedUntakenRequests, ...takenRequests];
    setSelectedRequests(new Set(allVisible.map(r => r.id)));
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
    if (!confirm('Opravdu chcete tuto poptávku smazat?')) {
      return;
    }

    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      console.error('Error deleting request:', error);
      alert('Chyba při mazání poptávky');
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

  const getFilterLabel = () => {
    if (takenFilter === 'mine') return 'Moje';
    if (takenFilter === 'all') return 'Všechny';
    const user = allUsers.find(u => u.id === takenFilter);
    if (user) {
      return user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.display_name || user.email;
    }
    return 'Moje';
  };

  const getUserDisplayName = (user: RequestWithUser['assigned_owner']) => {
    if (!user) return '';
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.display_name || user.email || '';
  };

  const getUserInitials = (user: RequestWithUser['assigned_owner']) => {
    if (!user) return '?';
    if (user.first_name) return user.first_name.charAt(0).toUpperCase();
    if (user.email) return user.email.charAt(0).toUpperCase();
    return '?';
  };

  const renderUntakenRequestCard = (request: RequestWithUser) => {
    const requestType = requestTypes.find(t => t.id === request.request_type_id);
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
        className={`px-3 py-2 rounded-lg border cursor-pointer transition-all flex items-center gap-2 ${
          bulkSelectMode && isSelected
            ? 'border-primary bg-blue-50'
            : selectedRequestId === request.id
            ? 'border-primary bg-primary/5'
            : 'border-gray-200 hover:border-blue-300 bg-white'
        }`}
      >
        {bulkSelectMode && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer flex-shrink-0"
          />
        )}
        <h3 className="font-medium text-sm text-gray-900 flex-1 truncate">{request.title}</h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          {requestType && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                backgroundColor: requestType.color + '15',
                color: requestType.color
              }}
            >
              {requestType.name}
            </span>
          )}
          {isEmailRequest(request) ? (
            <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-full shadow-sm" title="Email">
              <MailIcon className="w-3 h-3" />
            </div>
          ) : request.source === 'zapier' && (
            <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full shadow-sm" title="Zapier">
              <ZapIcon className="w-3 h-3" />
            </div>
          )}
          {isAppRequest(request) && (
            <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full shadow-sm" title="Aplikace">
              <SmartphoneIcon className="w-3 h-3" />
            </div>
          )}
          {isEshopRequest(request) && (
            <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-full shadow-sm" title="E-shop">
              <ShoppingCartIcon className="w-3 h-3" />
            </div>
          )}
          {isPPCRequest(request) && (
            <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full shadow-sm" title="PPC">
              <TrendingUpIcon className="w-3 h-3" />
            </div>
          )}
          {isManagementRequest(request) && (
            <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full shadow-sm" title="Správa">
              <SettingsIcon className="w-3 h-3" />
            </div>
          )}
          {isEmailRequest(request) && (
            <button
              onClick={(e) => handleQuickDismiss(e, request.id)}
              className="flex items-center justify-center w-5 h-5 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors"
              title="Odmítnout (smazat)"
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderTakenRequestCard = (request: RequestWithUser, showOwner: boolean = true) => {
    const requestType = requestTypes.find(t => t.id === request.request_type_id);
    const requestStatus = requestStatuses.find(s => s.id === request.request_status_id);
    const stats = requestStats[request.id] || { notesCount: 0, tasksCount: 0, totalTime: 0 };
    const isSelected = selectedRequests.has(request.id);
    const isPendingAcceptance = request.assigned_user_id && !request.is_taken;

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
          isPendingAcceptance
            ? 'border-amber-300 bg-amber-50 hover:border-amber-400'
            : bulkSelectMode && isSelected
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
              <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-full shadow-sm" title="Email">
                <MailIcon className="w-3 h-3" />
              </div>
            ) : request.source === 'zapier' && (
              <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full shadow-sm" title="Zapier">
                <ZapIcon className="w-3 h-3" />
              </div>
            )}
            {isAppRequest(request) && (
              <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full shadow-sm" title="Aplikace">
                <SmartphoneIcon className="w-3 h-3" />
              </div>
            )}
            {isEshopRequest(request) && (
              <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-full shadow-sm" title="E-shop">
                <ShoppingCartIcon className="w-3 h-3" />
              </div>
            )}
            {isPPCRequest(request) && (
              <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full shadow-sm" title="PPC">
                <TrendingUpIcon className="w-3 h-3" />
              </div>
            )}
            {isManagementRequest(request) && (
              <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full shadow-sm" title="Správa">
                <SettingsIcon className="w-3 h-3" />
              </div>
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
          {isPendingAcceptance && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 animate-pulse">
              Čeká na převzetí
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1.5 border-t border-gray-100">
          {showOwner && request.assigned_owner && (
            <div className="flex items-center gap-1.5 mr-2" title={getUserDisplayName(request.assigned_owner)}>
              {request.assigned_owner.avatar_url ? (
                <img
                  src={request.assigned_owner.avatar_url}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600">
                  {getUserInitials(request.assigned_owner)}
                </div>
              )}
              <span className="text-xs text-gray-600 truncate max-w-[80px]">
                {getUserDisplayName(request.assigned_owner)}
              </span>
            </div>
          )}
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
  };

  if (loading || cacheLoading.requests) {
    return <RequestListSkeleton />;
  }

  return (
    <div className="w-[420px] border-r border-gray-200 bg-white flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {isSearchMode ? (
              <span>Výsledky ({globalSearchResults.length})</span>
            ) : (
              folderId ? 'Poptávky' : 'Přehled poptávek'
            )}
          </h2>
          <div className="flex items-center gap-2">
            {!isSearchMode && (
              <>
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
                  Nová
                </button>
              </>
            )}
          </div>
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Hledat ve všech poptávkách..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {isSearchMode && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {!isSearchMode && bulkSelectMode && (
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
                {selectedRequests.size < (displayedUntakenRequests.length + takenRequests.length) ? (
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

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Načítání...</div>
        ) : isSearchMode ? (
          searchLoading ? (
            <div className="text-center py-12 text-gray-500">Vyhledávám...</div>
          ) : globalSearchResults.length === 0 ? (
            <div className="text-center py-12 text-gray-500">Žádné výsledky</div>
          ) : (
            <div className="p-4 space-y-4">
              {Object.entries(groupedSearchResults).map(([statusId, groupRequests]) => {
                const status = statusId === 'new' ? null : requestStatuses.find(s => s.id === statusId);
                const statusName = status ? status.name : 'Nové poptávky';
                const statusColor = status ? status.color : '#3B82F6';

                return (
                  <div key={statusId} className="space-y-1">
                    <div className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded-lg sticky top-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: statusColor }}
                      />
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        {statusName}
                      </span>
                      <span className="text-xs text-gray-500">({groupRequests.length})</span>
                    </div>
                    <div className="space-y-2">
                      {groupRequests.map((request) => renderTakenRequestCard(request, true))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="divide-y divide-gray-200">
            {(unassignedRequests.length > 0 || assignedPendingRequests.length > 0) && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${untakenFilter === 'unassigned' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                      <button
                        onClick={() => { setUntakenFilter('unassigned'); setUntakenPage(1); }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          untakenFilter === 'unassigned'
                            ? 'bg-white text-gray-800 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Nepřiřazené
                        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                          untakenFilter === 'unassigned'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {unassignedRequests.length}
                        </span>
                      </button>
                      <button
                        onClick={() => { setUntakenFilter('assigned_pending'); setUntakenPage(1); }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          untakenFilter === 'assigned_pending'
                            ? 'bg-white text-gray-800 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Přidělené
                        {assignedPendingRequests.length > 0 && (
                          <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                            untakenFilter === 'assigned_pending'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-orange-100 text-orange-700 animate-pulse'
                          }`}>
                            {assignedPendingRequests.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                  {untakenTotalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setUntakenPage(p => Math.max(1, p - 1))}
                        disabled={untakenPage === 1}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
                      </button>
                      <span className="text-xs text-gray-600 min-w-[40px] text-center">
                        {untakenPage}/{untakenTotalPages}
                      </span>
                      <button
                        onClick={() => setUntakenPage(p => Math.min(untakenTotalPages, p + 1))}
                        disabled={untakenPage === untakenTotalPages}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronRightIcon className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  )}
                </div>
                {displayedUntakenRequests.length > 0 ? (
                  <div className="space-y-1.5">
                    {paginatedUntakenRequests.map((request) => renderUntakenRequestCard(request))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 text-center py-4">
                    {untakenFilter === 'unassigned'
                      ? 'Žádné nepřiřazené poptávky'
                      : 'Žádné přidělené nepřevzaté poptávky'}
                  </p>
                )}
              </div>
            )}

            {myPendingRequests.length > 0 && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Moje čekající na převzetí
                    </h3>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                      {myPendingRequests.length}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {myPendingRequests.map((request) => renderUntakenRequestCard(request))}
                </div>
              </div>
            )}

            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Převzaté poptávky
                  </h3>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    {takenRequests.length}
                  </span>
                </div>
                <div className="relative filter-menu-container">
                  <button
                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <FilterIcon className="w-3.5 h-3.5" />
                    {getFilterLabel()}
                    <ChevronDownIcon className="w-3.5 h-3.5" />
                  </button>
                  {showFilterMenu && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                      <div className="p-2">
                        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                          Filtry
                        </div>
                        <button
                          onClick={() => { setTakenFilter('mine'); setShowFilterMenu(false); }}
                          className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                            takenFilter === 'mine' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <UserIcon className="w-4 h-4" />
                          Moje převzaté
                        </button>
                        <button
                          onClick={() => { setTakenFilter('all'); setShowFilterMenu(false); }}
                          className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                            takenFilter === 'all' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <UsersIcon className="w-4 h-4" />
                          Všechny převzaté
                        </button>

                        {allUsers.length > 0 && (
                          <>
                            <div className="border-t border-gray-200 my-2"></div>
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                              Podle uživatele
                            </div>
                            {allUsers.map(user => (
                              <button
                                key={user.id}
                                onClick={() => { setTakenFilter(user.id); setShowFilterMenu(false); }}
                                className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                                  takenFilter === user.id ? 'bg-primary/10 text-primary font-medium' : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600">
                                    {user.first_name ? user.first_name.charAt(0) : user.email.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="truncate">
                                  {user.first_name && user.last_name
                                    ? `${user.first_name} ${user.last_name}`
                                    : user.display_name || user.email}
                                </span>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {takenRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  {takenFilter === 'mine' && 'Zatím nemáte žádné převzaté poptávky'}
                  {takenFilter === 'all' && 'Zatím žádné převzaté poptávky'}
                  {takenFilter !== 'mine' && takenFilter !== 'all' && 'Tento uživatel nemá žádné poptávky'}
                </div>
              ) : (
                <div className="space-y-2">
                  {takenRequests.map((request) => renderTakenRequestCard(request, takenFilter === 'all' || takenFilter !== 'mine'))}
                </div>
              )}
            </div>
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
