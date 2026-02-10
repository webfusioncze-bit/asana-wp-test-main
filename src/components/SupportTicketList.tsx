import { useState, useEffect } from 'react';
import {
  SearchIcon,
  RefreshCwIcon,
  HeadphonesIcon,
  ClockIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  UserIcon,
  GlobeIcon,
  FilterIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SupportTicket } from '../types';

interface SupportTicketListProps {
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: typeof ClockIcon }> = {
  'V pořadí': { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: ClockIcon },
  'V řešení': { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: RefreshCwIcon },
  'Čeká na operátora': { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: UserIcon },
  'Potřebujeme součinnost': { color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', icon: AlertTriangleIcon },
  'Vyřešeno': { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2Icon },
};

const PRIORITY_CONFIG: Record<string, { color: string; dot: string }> = {
  'Vysoká priorita': { color: 'text-red-600', dot: 'bg-red-500' },
  'Střední priorita': { color: 'text-amber-600', dot: 'bg-amber-500' },
  'Nízká priorita': { color: 'text-gray-500', dot: 'bg-gray-400' },
};

export function SupportTicketList({ selectedTicketId, onSelectTicket }: SupportTicketListProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all_active');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [operatorNames, setOperatorNames] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTickets();
    loadOperatorNames();
  }, []);

  async function loadOperatorNames() {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, display_name, email');

    if (data) {
      const names: Record<string, string> = {};
      for (const user of data) {
        names[user.id] = user.display_name || user.email || '';
      }
      setOperatorNames(names);
    }
  }

  async function loadTickets() {
    setLoading(true);

    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('portal_created_at', { ascending: false });

    if (error) {
      console.error('Error loading tickets:', error);
      setLoading(false);
      return;
    }

    setTickets(data || []);
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-support-tickets`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      const result = await response.json();
      if (result.success) {
        await loadTickets();
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
    setSyncing(false);
  }

  const statuses = ['all_active', 'V pořadí', 'V řešení', 'Čeká na operátora', 'Potřebujeme součinnost', 'Vyřešeno', 'all'];

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = searchQuery === '' ||
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ticket.website_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ticket.author_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === 'all_active') {
      matchesStatus = ticket.status !== 'Vyřešeno';
    } else if (statusFilter !== 'all') {
      matchesStatus = ticket.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const statusCounts = tickets.reduce((acc, ticket) => {
    acc[ticket.status] = (acc[ticket.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeCount = tickets.filter(t => t.status !== 'Vyřešeno').length;

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
  }

  function getStatusLabel(filter: string) {
    if (filter === 'all_active') return `Aktivni (${activeCount})`;
    if (filter === 'all') return `Vse (${tickets.length})`;
    return `${filter} (${statusCounts[filter] || 0})`;
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 bg-white">
      <div className="px-5 pt-5 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HeadphonesIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">Podpora</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {filteredTickets.length}
            </span>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <RefreshCwIcon className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Hledat tikety..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors w-full justify-between"
          >
            <div className="flex items-center gap-1.5">
              <FilterIcon className="w-3.5 h-3.5" />
              {getStatusLabel(statusFilter)}
            </div>
            <ChevronDownIcon className="w-3.5 h-3.5" />
          </button>
          {showStatusDropdown && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {statuses.map(s => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setShowStatusDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${
                    statusFilter === s ? 'bg-primary/5 text-primary font-medium' : 'text-gray-700'
                  }`}
                >
                  {getStatusLabel(s)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            Zadne tikety k zobrazeni
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTickets.map(ticket => {
              const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['V pořadí'];
              const priorityConf = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG['Nízká priorita'];
              const isSelected = ticket.id === selectedTicketId;

              return (
                <button
                  key={ticket.id}
                  onClick={() => onSelectTicket(ticket.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all group ${
                    isSelected
                      ? 'bg-primary/5 border border-primary/20 shadow-sm'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${priorityConf.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-gray-400 font-mono">#{ticket.portal_id}</span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${statusConf.bg} ${statusConf.color}`}>
                          {ticket.status}
                        </span>
                        {ticket.is_complaint && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-100 text-red-700 border border-red-200">
                            Reklamace
                          </span>
                        )}
                      </div>
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>
                        {ticket.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                        {ticket.website_name && (
                          <span className="flex items-center gap-1 truncate">
                            <GlobeIcon className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{ticket.website_name.replace(/^https?:\/\//, '')}</span>
                          </span>
                        )}
                        {ticket.operator_user_id && operatorNames[ticket.operator_user_id] && (
                          <span className="flex items-center gap-1 truncate">
                            <UserIcon className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{operatorNames[ticket.operator_user_id]?.split(' ')[0]}</span>
                          </span>
                        )}
                        {ticket.portal_created_at && (
                          <span className="flex items-center gap-1 flex-shrink-0">
                            <ClockIcon className="w-3 h-3" />
                            {formatDate(ticket.portal_created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    {ticket.portal_link && (
                      <a
                        href={ticket.portal_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-primary transition-all"
                      >
                        <ExternalLinkIcon className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
