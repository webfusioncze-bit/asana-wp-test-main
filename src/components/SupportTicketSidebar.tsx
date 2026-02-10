import { useState, useEffect } from 'react';
import {
  HeadphonesIcon,
  RefreshCwIcon,
  ClockIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  UserIcon,
  UsersIcon,
  FilterXIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ListIcon,
  Loader2Icon,
  BuildingIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface TicketFilters {
  status: string | null;
  operatorUserId: string | null;
  clientId: string | null;
  showResolved: boolean;
}

interface StatusCount {
  status: string;
  count: number;
}

interface OperatorInfo {
  userId: string;
  name: string;
  count: number;
}

interface ClientInfo {
  clientId: string;
  name: string;
  count: number;
}

interface SupportTicketSidebarProps {
  filters: TicketFilters;
  onFiltersChange: (filters: TicketFilters) => void;
  onSync: () => void;
  syncing: boolean;
}

const STATUS_ICONS: Record<string, typeof ClockIcon> = {
  'V pořadí': ClockIcon,
  'V řešení': Loader2Icon,
  'Čeká na operátora': UserIcon,
  'Potřebujeme součinnost': AlertTriangleIcon,
  'Vyřešeno': CheckCircle2Icon,
};

const STATUS_COLORS: Record<string, string> = {
  'V pořadí': 'text-blue-600',
  'V řešení': 'text-amber-600',
  'Čeká na operátora': 'text-orange-600',
  'Potřebujeme součinnost': 'text-rose-600',
  'Vyřešeno': 'text-emerald-600',
};

const STATUS_ORDER = ['V pořadí', 'Čeká na operátora', 'V řešení', 'Potřebujeme součinnost', 'Vyřešeno'];

export function SupportTicketSidebar({ filters, onFiltersChange, onSync, syncing }: SupportTicketSidebarProps) {
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [operators, setOperators] = useState<OperatorInfo[]>([]);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [showOperators, setShowOperators] = useState(false);
  const [showClients, setShowClients] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSidebarData();
  }, []);

  async function loadSidebarData() {
    setLoading(true);

    const { data: tickets } = await supabase
      .from('support_tickets')
      .select('status, operator_user_id, client_id');

    if (!tickets) {
      setLoading(false);
      return;
    }

    const counts: Record<string, number> = {};
    const opCounts: Record<string, number> = {};
    const clientCounts: Record<string, number> = {};

    for (const t of tickets) {
      counts[t.status] = (counts[t.status] || 0) + 1;
      if (t.operator_user_id) {
        opCounts[t.operator_user_id] = (opCounts[t.operator_user_id] || 0) + 1;
      }
      if (t.client_id) {
        clientCounts[t.client_id] = (clientCounts[t.client_id] || 0) + 1;
      }
    }

    setStatusCounts(
      STATUS_ORDER.map(s => ({ status: s, count: counts[s] || 0 }))
    );

    const opUserIds = Object.keys(opCounts);
    if (opUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, display_name, email')
        .in('id', opUserIds);

      if (profiles) {
        setOperators(
          profiles
            .map(p => ({
              userId: p.id,
              name: p.display_name || p.email || '',
              count: opCounts[p.id] || 0,
            }))
            .sort((a, b) => b.count - a.count)
        );
      }
    }

    const clientIds = Object.keys(clientCounts);
    if (clientIds.length > 0) {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name')
        .in('id', clientIds);

      if (clientsData) {
        setClients(
          clientsData
            .map(c => ({
              clientId: c.id,
              name: c.name,
              count: clientCounts[c.id] || 0,
            }))
            .sort((a, b) => b.count - a.count)
        );
      }
    }

    setLoading(false);
  }

  const totalActive = statusCounts
    .filter(s => s.status !== 'Vyřešeno')
    .reduce((sum, s) => sum + s.count, 0);

  const totalAll = statusCounts.reduce((sum, s) => sum + s.count, 0);

  const hasActiveFilters = filters.status !== null || filters.operatorUserId !== null || filters.clientId !== null;

  return (
    <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HeadphonesIcon className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold text-gray-900">Podpora</h2>
          </div>
          <button
            onClick={onSync}
            disabled={syncing}
            className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Synchronizovat"
          >
            <RefreshCwIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {hasActiveFilters && (
          <button
            onClick={() => onFiltersChange({ status: null, operatorUserId: null, clientId: null, showResolved: false })}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors w-full justify-center"
          >
            <FilterXIcon className="w-3.5 h-3.5" />
            Zrusit filtry
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <button
          onClick={() => onFiltersChange({ ...filters, status: null, showResolved: false })}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
            filters.status === null && !filters.showResolved
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ListIcon className="w-4 h-4" />
            <span>Aktivni</span>
          </div>
          <span className="text-xs text-gray-400 tabular-nums">{totalActive}</span>
        </button>

        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            <div className="pt-2 pb-1">
              <p className="px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Stav</p>
            </div>

            {statusCounts.map(({ status, count }) => {
              if (status === 'Vyřešeno') return null;
              const Icon = STATUS_ICONS[status] || ClockIcon;
              const color = STATUS_COLORS[status] || 'text-gray-600';
              const isActive = filters.status === status;

              return (
                <button
                  key={status}
                  onClick={() => onFiltersChange({
                    ...filters,
                    status: isActive ? null : status,
                    showResolved: false,
                  })}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : color}`} />
                    <span className="truncate">{status}</span>
                  </div>
                  <span className={`text-xs tabular-nums ${isActive ? 'text-primary' : 'text-gray-400'}`}>{count}</span>
                </button>
              );
            })}

            {statusCounts.find(s => s.status === 'Vyřešeno') && (
              <button
                onClick={() => onFiltersChange({ ...filters, status: 'Vyřešeno', showResolved: true })}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  filters.showResolved
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2Icon className={`w-4 h-4 ${filters.showResolved ? 'text-primary' : 'text-emerald-600'}`} />
                  <span>Vyreseno</span>
                </div>
                <span className={`text-xs tabular-nums ${filters.showResolved ? 'text-primary' : 'text-gray-400'}`}>
                  {statusCounts.find(s => s.status === 'Vyřešeno')?.count || 0}
                </span>
              </button>
            )}

            <div className="pt-3 pb-1">
              <button
                onClick={() => setShowOperators(!showOperators)}
                className="flex items-center gap-1.5 px-3 w-full"
              >
                {showOperators ? <ChevronDownIcon className="w-3 h-3 text-gray-400" /> : <ChevronRightIcon className="w-3 h-3 text-gray-400" />}
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Operator</span>
              </button>
            </div>

            {showOperators && operators.map(op => {
              const isActive = filters.operatorUserId === op.userId;
              return (
                <button
                  key={op.userId}
                  onClick={() => onFiltersChange({
                    ...filters,
                    operatorUserId: isActive ? null : op.userId,
                  })}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <UserIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate text-xs">{op.name}</span>
                  </div>
                  <span className="text-[10px] tabular-nums text-gray-400">{op.count}</span>
                </button>
              );
            })}

            <div className="pt-3 pb-1">
              <button
                onClick={() => setShowClients(!showClients)}
                className="flex items-center gap-1.5 px-3 w-full"
              >
                {showClients ? <ChevronDownIcon className="w-3 h-3 text-gray-400" /> : <ChevronRightIcon className="w-3 h-3 text-gray-400" />}
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Klient</span>
              </button>
            </div>

            {showClients && clients.map(cl => {
              const isActive = filters.clientId === cl.clientId;
              return (
                <button
                  key={cl.clientId}
                  onClick={() => onFiltersChange({
                    ...filters,
                    clientId: isActive ? null : cl.clientId,
                  })}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <BuildingIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate text-xs">{cl.name}</span>
                  </div>
                  <span className="text-[10px] tabular-nums text-gray-400">{cl.count}</span>
                </button>
              );
            })}
          </>
        )}
      </div>

      <div className="p-3 border-t border-gray-100">
        <div className="text-[10px] text-gray-400 text-center">
          Celkem {totalAll} tiketu
        </div>
      </div>
    </div>
  );
}
