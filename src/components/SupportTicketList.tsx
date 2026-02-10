import { useState, useEffect } from 'react';
import {
  SearchIcon,
  ClockIcon,
  AlertTriangleIcon,
  UserIcon,
  GlobeIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  Loader2Icon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SupportTicket } from '../types';
import type { TicketFilters } from './SupportTicketSidebar';

interface SupportTicketListProps {
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
  filters: TicketFilters;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  'V pořadí': { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  'V řešení': { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  'Čeká na operátora': { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  'Potřebujeme součinnost': { color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  'Vyřešeno': { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
};

const PRIORITY_CONFIG: Record<string, { dot: string }> = {
  'Vysoká priorita': { dot: 'bg-red-500' },
  'Střední priorita': { dot: 'bg-amber-500' },
  'Nízká priorita': { dot: 'bg-gray-400' },
};

export function SupportTicketList({ selectedTicketId, onSelectTicket, filters }: SupportTicketListProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = searchQuery === '' ||
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ticket.website_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(ticket.portal_id).includes(searchQuery);

    let matchesStatus = true;
    if (filters.status) {
      matchesStatus = ticket.status === filters.status;
    } else if (!filters.showResolved) {
      matchesStatus = ticket.status !== 'Vyřešeno';
    }

    const matchesOperator = !filters.operatorUserId || ticket.operator_user_id === filters.operatorUserId;
    const matchesClient = !filters.clientId || ticket.client_id === filters.clientId;

    return matchesSearch && matchesStatus && matchesOperator && matchesClient;
  });

  const cooperationTickets = filteredTickets.filter(t => t.status === 'Potřebujeme součinnost');
  const regularTickets = filteredTickets.filter(t => t.status !== 'Potřebujeme součinnost');

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white border-r border-gray-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="w-[420px] flex-shrink-0 flex flex-col min-w-0 border-r border-gray-200 bg-white">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Pozadavky</h2>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full tabular-nums">
              {filteredTickets.length}
            </span>
          </div>
        </div>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Hledat dle nazvu, webu, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Zadne tikety k zobrazeni
          </div>
        ) : (
          <>
            <div className="px-3 pt-3 pb-1">
              {regularTickets.length > 0 && (
                <div className="space-y-0.5">
                  {regularTickets.map(ticket => (
                    <TicketRow
                      key={ticket.id}
                      ticket={ticket}
                      isSelected={ticket.id === selectedTicketId}
                      onSelect={onSelectTicket}
                      operatorName={ticket.operator_user_id ? operatorNames[ticket.operator_user_id] : undefined}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              )}
            </div>

            {cooperationTickets.length > 0 && (
              <div className="px-3 pb-3">
                <div className="flex items-center gap-2 px-2 py-3 mt-2">
                  <div className="flex-1 h-px bg-rose-200" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-full">
                    <AlertTriangleIcon className="w-3 h-3 text-rose-500" />
                    <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider">
                      Ceka na soucinnost ({cooperationTickets.length})
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-rose-200" />
                </div>
                <div className="space-y-0.5">
                  {cooperationTickets.map(ticket => (
                    <TicketRow
                      key={ticket.id}
                      ticket={ticket}
                      isSelected={ticket.id === selectedTicketId}
                      onSelect={onSelectTicket}
                      operatorName={ticket.operator_user_id ? operatorNames[ticket.operator_user_id] : undefined}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TicketRow({ ticket, isSelected, onSelect, operatorName, formatDate }: {
  ticket: SupportTicket;
  isSelected: boolean;
  onSelect: (id: string) => void;
  operatorName?: string;
  formatDate: (d: string | null) => string;
}) {
  const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['V pořadí'];
  const priorityConf = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG['Nízká priorita'];

  return (
    <button
      onClick={() => onSelect(ticket.id)}
      className={`w-full text-left p-3 rounded-lg transition-all group ${
        isSelected
          ? 'bg-primary/5 border border-primary/20 shadow-sm'
          : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${priorityConf.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-gray-400 font-mono">#{ticket.portal_id}</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${statusConf.bg} ${statusConf.color}`}>
              {ticket.status}
            </span>
            {ticket.is_complaint && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-100 text-red-700 border border-red-200">
                Reklamace
              </span>
            )}
          </div>
          <p className={`text-sm font-medium leading-snug ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>
            {ticket.title}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
            {ticket.website_name && (
              <span className="flex items-center gap-1 truncate max-w-[140px]">
                <GlobeIcon className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{ticket.website_name.replace(/^https?:\/\//, '')}</span>
              </span>
            )}
            {operatorName && (
              <span className="flex items-center gap-1 truncate max-w-[100px]">
                <UserIcon className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{operatorName.split(' ')[0]}</span>
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
            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-primary transition-all flex-shrink-0"
          >
            <ExternalLinkIcon className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </button>
  );
}
