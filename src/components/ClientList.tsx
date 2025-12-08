import { useState, useEffect, useRef } from 'react';
import {
  UsersIcon,
  Trash2Icon,
  RefreshCwIcon,
  SearchIcon,
  BuildingIcon,
  MailIcon,
  PhoneIcon,
  FileTextIcon,
  GlobeIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Client, ClientInvoice, ClientWebsite } from '../types';

interface ClientListProps {
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
  canManage: boolean;
}

interface ClientWithDetails extends Client {
  invoices?: ClientInvoice[];
  websites?: ClientWebsite[];
}

export function ClientList({ selectedClientId, onSelectClient, canManage }: ClientListProps) {
  const [clients, setClients] = useState<ClientWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const letterRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);

    const { data: clientsData, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading clients:', error);
      setLoading(false);
      return;
    }

    const clientsWithDetails = await Promise.all(
      (clientsData || []).map(async (client) => {
        const { data: invoices } = await supabase
          .from('client_invoices')
          .select('*')
          .eq('client_id', client.id)
          .order('invoice_date', { ascending: false });

        const { data: websites } = await supabase
          .from('client_websites')
          .select('*')
          .eq('client_id', client.id);

        return {
          ...client,
          invoices: invoices || [],
          websites: websites || [],
        };
      })
    );

    setClients(clientsWithDetails);
    setLoading(false);
  }

  async function deleteClient(clientId: string) {
    if (!confirm('Opravdu chcete smazat tohoto klienta?')) return;

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (error) {
      console.error('Error deleting client:', error);
      alert('Chyba při mazání klienta');
    } else {
      if (selectedClientId === clientId) {
        onSelectClient('');
      }
      loadClients();
    }
  }

  async function syncAllClients() {
    setSyncing(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-portal-clients`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to sync clients from portal');
      }

      const result = await response.json();
      console.log('Client sync result:', result);

      await loadClients();

      if (result.success) {
        alert(`Synchronizováno ${result.syncedClients} klientů z ${result.totalPages} stránek${result.failedClients > 0 ? `, ${result.failedClients} selhalo` : ''}`);
      } else {
        alert('Chyba při synchronizaci klientů z portálu');
      }
    } catch (error) {
      console.error('Client sync error:', error);
      alert('Chyba při synchronizaci klientů z portálu');
    } finally {
      setSyncing(false);
    }
  }

  const getFirstLetter = (name: string): string => {
    const firstChar = name.charAt(0).toUpperCase();
    return /[A-Z]/.test(firstChar) ? firstChar : '#';
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedClients = [...filteredClients].sort((a, b) => {
    return a.name.localeCompare(b.name, 'cs');
  });

  const clientsByLetter: { [key: string]: ClientWithDetails[] } = {};
  sortedClients.forEach((client) => {
    const letter = getFirstLetter(client.name);
    if (!clientsByLetter[letter]) {
      clientsByLetter[letter] = [];
    }
    clientsByLetter[letter].push(client);
  });

  const availableLetters = Object.keys(clientsByLetter).sort();
  const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');

  const scrollToLetter = (letter: string) => {
    const element = letterRefs.current[letter];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getOverdueInvoiceCount = (invoices: ClientInvoice[]) => {
    return invoices.filter(inv => inv.status?.includes('splatnosti')).length;
  };

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <p className="text-gray-500">Načítání klientů...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
      <div className="border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-semibold text-gray-900">Klienti</h1>
          <button
            onClick={syncAllClients}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCwIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchronizuji...' : 'Synchronizovat'}
          </button>
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Vyhledat klienta..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-auto">
          {clients.length === 0 ? (
            <div className="text-center py-12">
              <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Zatím nejsou synchronizováni žádní klienti</p>
              <p className="text-gray-400 text-sm">Klienti se synchronizují automaticky každých 15 minut z portálu</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12">
              <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Žádní klienti neodpovídají vyhledávání</p>
            </div>
          ) : (
            <div>
              {availableLetters.map((letter) => (
                <div key={letter}>
                  <div
                    ref={(el) => (letterRefs.current[letter] = el)}
                    className="sticky top-0 bg-gray-50 border-b border-gray-200 px-6 py-2 z-10"
                  >
                    <h2 className="text-lg font-semibold text-gray-700">{letter}</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {clientsByLetter[letter].map((client) => {
                      const overdueCount = getOverdueInvoiceCount(client.invoices || []);
                      const hasWebsites = (client.websites?.length || 0) > 0;

                      return (
                        <div
                          key={client.id}
                          onClick={() => onSelectClient(client.id)}
                          className={`group px-6 py-3 cursor-pointer transition-all hover:bg-gray-50 ${
                            selectedClientId === client.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <UsersIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-medium text-gray-900 truncate">{client.name}</h3>
                                    {overdueCount > 0 && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                                        <AlertCircleIcon className="w-3 h-3" />
                                        {overdueCount} po splatnosti
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    {client.company_name && (
                                      <div className="flex items-center gap-1">
                                        <BuildingIcon className="w-3 h-3 text-gray-400" />
                                        <span className="text-xs text-gray-500 truncate">{client.company_name}</span>
                                      </div>
                                    )}
                                    {client.email && (
                                      <div className="flex items-center gap-1">
                                        <MailIcon className="w-3 h-3 text-gray-400" />
                                        <span className="text-xs text-gray-500 truncate">{client.email}</span>
                                      </div>
                                    )}
                                    {client.phone && (
                                      <div className="flex items-center gap-1">
                                        <PhoneIcon className="w-3 h-3 text-gray-400" />
                                        <span className="text-xs text-gray-500">{client.phone}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 flex-shrink-0">
                                {(client.invoices?.length || 0) > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <FileTextIcon className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-xs text-gray-600">
                                      {client.invoices?.length} faktur
                                    </span>
                                  </div>
                                )}

                                {hasWebsites && (
                                  <div className="flex items-center gap-1.5">
                                    <GlobeIcon className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-xs text-gray-600">
                                      {client.websites?.length} webů
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {canManage && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteClient(client.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2Icon className="w-3.5 h-3.5 text-red-600" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {sortedClients.length > 0 && (
          <div className="flex flex-col items-center justify-center py-4 px-2 bg-gray-50 border-l border-gray-200">
            {allLetters.map((letter) => {
              const isAvailable = availableLetters.includes(letter);
              return (
                <button
                  key={letter}
                  onClick={() => scrollToLetter(letter)}
                  disabled={!isAvailable}
                  className={`text-xs font-medium py-0.5 px-1 transition-colors ${
                    isAvailable
                      ? 'text-blue-600 hover:text-blue-800 cursor-pointer'
                      : 'text-gray-300 cursor-default'
                  }`}
                  title={isAvailable ? `Přejít na ${letter}` : `Žádní klienti na ${letter}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
