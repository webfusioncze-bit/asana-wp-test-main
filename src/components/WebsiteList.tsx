import { useState, useEffect, useRef } from 'react';
import { GlobeIcon, Trash2Icon, RefreshCwIcon, SearchIcon, LogInIcon, CheckCircleIcon, XCircleIcon, AlertTriangleIcon, PackageIcon, ServerIcon, CalendarIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Website, WebsiteStatus } from '../types';
import { WebsiteUpdateSchedules } from './WebsiteUpdateSchedules';

interface WebsiteListProps {
  selectedWebsiteId: string | null;
  onSelectWebsite: (websiteId: string) => void;
  canManage: boolean;
}

interface WebsiteWithStatus extends Website {
  latestStatus?: WebsiteStatus | null;
  clientName?: string | null;
  clientCompany?: string | null;
}

type ViewMode = 'websites' | 'updates';

export function WebsiteList({ selectedWebsiteId, onSelectWebsite, canManage }: WebsiteListProps) {
  const [websites, setWebsites] = useState<WebsiteWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('websites');
  const letterRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    loadWebsites();
  }, []);

  async function loadWebsites() {
    setLoading(true);

    const { data: websitesData, error } = await supabase
      .from('websites')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading websites:', error);
      setLoading(false);
      return;
    }

    const websitesWithStatus = await Promise.all(
      (websitesData || []).map(async (website) => {
        const { data: statusData } = await supabase
          .from('website_status')
          .select('*')
          .eq('website_id', website.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: clientWebsiteData } = await supabase
          .from('client_websites')
          .select('client_id')
          .eq('website_id', website.id)
          .maybeSingle();

        let clientName = null;
        let clientCompany = null;

        if (clientWebsiteData?.client_id) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('name, company_name')
            .eq('id', clientWebsiteData.client_id)
            .maybeSingle();

          if (clientData) {
            clientName = clientData.name;
            clientCompany = clientData.company_name;
          }
        }

        return {
          ...website,
          latestStatus: statusData,
          clientName,
          clientCompany,
        };
      })
    );

    setWebsites(websitesWithStatus);
    setLoading(false);
  }


  async function deleteWebsite(websiteId: string) {
    if (!confirm('Opravdu chcete smazat tento web?')) return;

    const { error } = await supabase
      .from('websites')
      .delete()
      .eq('id', websiteId);

    if (error) {
      console.error('Error deleting website:', error);
      alert('Chyba při mazání webu');
    } else {
      if (selectedWebsiteId === websiteId) {
        onSelectWebsite('');
      }
      loadWebsites();
    }
  }

  async function syncAllWebsites() {
    setSyncing(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-portal-websites`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to sync websites from portal feed');
      }

      const result = await response.json();
      console.log('Portal sync result:', result);

      await loadWebsites();

      if (result.success) {
        alert(`Synchronizováno ${result.syncedWebsites} webů z portálového feedu${result.failedWebsites > 0 ? `, ${result.failedWebsites} selhalo` : ''}`);
      } else {
        alert('Chyba při synchronizaci webů z portálového feedu');
      }
    } catch (error) {
      console.error('Portal sync error:', error);
      alert('Chyba při synchronizaci webů z portálového feedu');
    } finally {
      setSyncing(false);
    }
  }

  const getFirstLetter = (name: string): string => {
    const cleanName = name.replace(/^https?:\/\/(www\.)?/i, '');
    const firstChar = cleanName.charAt(0).toUpperCase();
    return /[A-Z]/.test(firstChar) ? firstChar : '#';
  };

  const filteredWebsites = websites.filter((website) =>
    website.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    website.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (website.clientName && website.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (website.clientCompany && website.clientCompany.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sortedWebsites = [...filteredWebsites].sort((a, b) => {
    const nameA = a.name.replace(/^https?:\/\/(www\.)?/i, '');
    const nameB = b.name.replace(/^https?:\/\/(www\.)?/i, '');
    return nameA.localeCompare(nameB, 'cs');
  });

  const websitesByLetter: { [key: string]: WebsiteWithStatus[] } = {};
  sortedWebsites.forEach((website) => {
    const letter = getFirstLetter(website.name);
    if (!websitesByLetter[letter]) {
      websitesByLetter[letter] = [];
    }
    websitesByLetter[letter].push(website);
  });

  const availableLetters = Object.keys(websitesByLetter).sort();
  const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');

  const scrollToLetter = (letter: string) => {
    const element = letterRefs.current[letter];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <p className="text-gray-500">Načítání webů...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-gray-900">Weby</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('websites')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'websites'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <GlobeIcon className="w-4 h-4" />
                Weby
              </button>
              <button
                onClick={() => setViewMode('updates')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'updates'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <CalendarIcon className="w-4 h-4" />
                Aktualizace
              </button>
            </div>
          </div>
          {viewMode === 'websites' && (
            <button
              onClick={syncAllWebsites}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCwIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Synchronizuji...' : 'Synchronizovat'}
            </button>
          )}
        </div>

        {viewMode === 'websites' && (
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Vyhledat web..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {viewMode === 'updates' ? (
        <WebsiteUpdateSchedules canManage={canManage} />
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 overflow-auto">
            {websites.length === 0 ? (
            <div className="text-center py-12">
              <GlobeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Zatím nejsou synchronizovány žádné weby</p>
              <p className="text-gray-400 text-sm">Weby se synchronizují automaticky každých 5 minut z portálu</p>
            </div>
          ) : filteredWebsites.length === 0 ? (
            <div className="text-center py-12">
              <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Žádné weby neodpovídají vyhledávání</p>
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
                    {websitesByLetter[letter].map((website) => {
                      const status = website.latestStatus;
                      const hasUpdates = status?.update_plugins_count && status.update_plugins_count > 0;
                      const adminLoginUrl = status?.ult
                        ? `${website.url}?login_token=${status.ult}`
                        : `${website.url}/wp-admin`;

                      return (
                        <div
                          key={website.id}
                          onClick={() => onSelectWebsite(website.id)}
                          className={`group px-6 py-2.5 cursor-pointer transition-all hover:bg-gray-50 ${
                            selectedWebsiteId === website.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {website.is_available ? (
                                  <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                                ) : (
                                  <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                                )}

                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm font-medium text-gray-900 truncate">{website.name}</h3>
                                  {website.clientCompany || website.clientName ? (
                                    <p className="text-xs text-gray-500 truncate">
                                      {website.clientCompany || website.clientName}
                                    </p>
                                  ) : (
                                    <a
                                      href={website.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-xs text-gray-500 hover:text-blue-600 hover:underline truncate block"
                                    >
                                      {website.url.replace(/^https?:\/\//, '')}
                                    </a>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-4 flex-shrink-0">
                                {status && (
                                  <>
                                    <div className="flex items-center gap-1.5 text-xs">
                                      <ServerIcon className="w-3.5 h-3.5 text-gray-400" />
                                      <span className="text-gray-600">
                                        WP {status.wordpress_version || '-'}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-xs">
                                      <ServerIcon className="w-3.5 h-3.5 text-gray-400" />
                                      <span className="text-gray-600">
                                        PHP {status.php_version || '-'}
                                      </span>
                                    </div>

                                    {hasUpdates && (
                                      <div className="flex items-center gap-1.5">
                                        <PackageIcon className="w-3.5 h-3.5 text-orange-500" />
                                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                                          {status.update_plugins_count}
                                        </span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {status?.ult && (
                                <a
                                  href={adminLoginUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                  <LogInIcon className="w-3.5 h-3.5" />
                                  WP-Login
                                </a>
                              )}

                              {canManage && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteWebsite(website.id);
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

        {sortedWebsites.length > 0 && (
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
                  title={isAvailable ? `Přejít na ${letter}` : `Žádné weby na ${letter}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        )}
        </div>
      )}
    </div>
  );
}
