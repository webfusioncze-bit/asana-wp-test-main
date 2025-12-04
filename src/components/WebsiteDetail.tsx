import { useState, useEffect } from 'react';
import {
  GlobeIcon,
  ServerIcon,
  DatabaseIcon,
  UsersIcon,
  FileTextIcon,
  ImageIcon,
  MessageSquareIcon,
  PackageIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  ClockIcon,
  TrendingUpIcon,
  RefreshCwIcon,
  XIcon,
  ExternalLinkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ZapIcon,
  LogInIcon,
  LayoutGridIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Website, WebsiteStatus } from '../types';

interface WebsiteDetailProps {
  websiteId: string;
  onClose: () => void;
}

type TabType = 'overview' | 'plugins' | 'users';

export function WebsiteDetail({ websiteId, onClose }: WebsiteDetailProps) {
  const [website, setWebsite] = useState<Website | null>(null);
  const [latestStatus, setLatestStatus] = useState<WebsiteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    loadWebsiteData();
  }, [websiteId]);

  async function loadWebsiteData() {
    setLoading(true);

    const { data: websiteData } = await supabase
      .from('websites')
      .select('*')
      .eq('id', websiteId)
      .maybeSingle();

    const { data: statusData } = await supabase
      .from('website_status')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setWebsite(websiteData);
    setLatestStatus(statusData);
    setLoading(false);
  }

  async function syncWebsite() {
    setSyncing(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-websites`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to sync website');
      }

      const result = await response.json();
      console.log('Sync result:', result);

      setTimeout(async () => {
        await loadWebsiteData();
      }, 2000);
    } catch (error) {
      console.error('Sync error:', error);
      alert('Chyba při synchronizaci webu');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <p className="text-gray-500">Načítání...</p>
      </div>
    );
  }

  if (!website) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <p className="text-gray-500">Web nebyl nalezen</p>
      </div>
    );
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSyncStatus = (lastSyncAt: string | null) => {
    if (!lastSyncAt) {
      return { status: 'never', icon: ClockIcon, color: 'text-gray-400', bgColor: 'bg-gray-50', label: 'Nikdy', detail: '' };
    }

    const now = new Date();
    const lastSync = new Date(lastSyncAt);
    const minutesDiff = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60));

    if (minutesDiff <= 5) {
      return {
        status: 'current',
        icon: CheckCircleIcon,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        label: 'Aktuální',
        detail: `Před ${minutesDiff} min`
      };
    } else if (minutesDiff <= 10) {
      return {
        status: 'warning',
        icon: AlertTriangleIcon,
        color: 'text-orange-500',
        bgColor: 'bg-orange-50',
        label: 'Upozornění',
        detail: `Před ${minutesDiff} min`
      };
    } else {
      return {
        status: 'stale',
        icon: XCircleIcon,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        label: 'Zastaralá',
        detail: formatDate(lastSyncAt)
      };
    }
  };

  const getScreenshotUrl = () => {
    if (website.screenshot_url) return website.screenshot_url;
    const auth = '75912-task';
    return `https://image.thum.io/get/auth/${auth}/${website.url}`;
  };

  const adminLoginUrl = latestStatus?.ult
    ? `${website.url}?login_token=${latestStatus.ult}`
    : `${website.url}/wp-admin`;

  const normalizePlugins = (plugins: any[]): string[] => {
    if (!Array.isArray(plugins)) return [];
    return plugins
      .map(p => {
        if (typeof p === 'string') return p;
        if (typeof p === 'object' && p !== null) {
          return p.name || null;
        }
        return null;
      })
      .filter((name): name is string => !!name && name.trim() !== '');
  };

  const normalizeUpdatePlugins = (plugins: any[]): Array<{name: string; current_version?: string; new_version?: string}> => {
    if (!Array.isArray(plugins)) return [];
    return plugins
      .map(p => {
        if (typeof p === 'object' && p !== null && p.name) {
          return {
            name: p.name,
            current_version: p.current_version,
            new_version: p.new_version,
          };
        }
        return null;
      })
      .filter((p): p is {name: string; current_version?: string; new_version?: string} => p !== null);
  };

  const normalizeUsers = (users: any[]): string[] => {
    if (!Array.isArray(users)) return [];
    return users
      .map(u => {
        if (typeof u === 'string') return u;
        if (typeof u === 'object' && u !== null) {
          return u.username || u.email || null;
        }
        return null;
      })
      .filter((name): name is string => !!name && name.trim() !== '');
  };

  const activePlugins = normalizePlugins(latestStatus?.raw_data?.active_plugins || []);
  const updatePlugins = normalizeUpdatePlugins(latestStatus?.raw_data?.update_plugins || []);
  const inactivePlugins = normalizePlugins(latestStatus?.raw_data?.inactive_plugins || []);
  const users = normalizeUsers(latestStatus?.raw_data?.users || []);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XIcon className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-gray-900">{website.name}</h1>
                {website.is_available ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                    <CheckCircleIcon className="w-3 h-3" />
                    Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                    <XCircleIcon className="w-3 h-3" />
                    Offline
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <a
                  href={website.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  {website.url}
                  <ExternalLinkIcon className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {latestStatus?.ult && (
              <a
                href={adminLoginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                <LogInIcon className="w-4 h-4" />
                WP Admin
              </a>
            )}
            <button
              onClick={syncWebsite}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCwIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Synchronizuji...' : 'Synchronizovat'}
            </button>
          </div>
        </div>
      </div>

      {!latestStatus ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <GlobeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">Zatím nejsou k dispozici žádné údaje</p>
            <p className="text-sm text-gray-400">Klikněte na tlačítko Synchronizovat</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {/* Error Alert */}
            {website.sync_error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangleIcon className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-red-900">Chyba synchronizace</h3>
                    <p className="text-xs text-red-700 mt-0.5">{website.sync_error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Content Grid */}
            <div className="grid grid-cols-12 gap-4">
              {/* Left Column - Screenshot */}
              <div className="col-span-12 lg:col-span-4">
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 sticky top-4">
                  <div className="aspect-video bg-gray-100">
                    <img
                      src={getScreenshotUrl()}
                      alt={`Náhled ${website.name}`}
                      className="w-full h-full object-cover object-top"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="12" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENáhled není k dispozici%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                  <div className="p-3 space-y-2">
                    <InfoRow label="Poslední aktualizace" value={formatDate(latestStatus.last_updated)} small />
                    {(() => {
                      const syncStatus = getSyncStatus(website.last_sync_at);
                      const Icon = syncStatus.icon;
                      return (
                        <div className="flex items-start justify-between text-xs">
                          <span className="text-gray-600">Synchronizace</span>
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${syncStatus.bgColor}`}>
                            <Icon className={`w-3.5 h-3.5 ${syncStatus.color}`} />
                            <div className="flex flex-col items-end">
                              <span className={`font-medium ${syncStatus.color}`}>{syncStatus.label}</span>
                              <span className="text-gray-600">{syncStatus.detail}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Right Column - Tabs & Content */}
              <div className="col-span-12 lg:col-span-8">
                {/* Tabs */}
                <div className="flex gap-1 mb-4 border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'overview'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <LayoutGridIcon className="w-4 h-4" />
                      Přehled
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('plugins')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'plugins'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <PackageIcon className="w-4 h-4" />
                      Pluginy ({activePlugins.length})
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'users'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <UsersIcon className="w-4 h-4" />
                      Uživatelé ({users.length})
                    </div>
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <QuickStat icon={<ServerIcon className="w-4 h-4" />} label="Uptime" value={latestStatus.uptime || '-'} />
                      <QuickStat icon={<TrendingUpIcon className="w-4 h-4" />} label="Zatížení" value={latestStatus.server_load || '-'} />
                      <QuickStat icon={<ZapIcon className="w-4 h-4" />} label="Úložiště" value={latestStatus.storage_usage || '-'} />
                      <QuickStat icon={<UsersIcon className="w-4 h-4" />} label="Uživatelé" value={latestStatus.num_users?.toString() || '0'} />
                    </div>

                    {/* Content Stats */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Obsah webu</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <ContentStat icon={<FileTextIcon className="w-5 h-5 text-blue-600" />} label="Stránky" value={latestStatus.num_pages || 0} />
                        <ContentStat icon={<FileTextIcon className="w-5 h-5 text-green-600" />} label="Příspěvky" value={latestStatus.num_posts || 0} />
                        <ContentStat icon={<MessageSquareIcon className="w-5 h-5 text-purple-600" />} label="Komentáře" value={latestStatus.num_comments || 0} />
                        <ContentStat icon={<ImageIcon className="w-5 h-5 text-orange-600" />} label="Média" value={latestStatus.num_media_files || 0} />
                      </div>
                    </div>

                    {/* Technical Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <ServerIcon className="w-4 h-4" />
                          Technické informace
                        </h3>
                        <div className="space-y-2">
                          <InfoRow label="WordPress" value={latestStatus.wordpress_version} small />
                          <InfoRow label="PHP" value={latestStatus.php_version} small />
                          <InfoRow label="MySQL" value={latestStatus.mysql_version} small />
                          <InfoRow label="Memory limit" value={latestStatus.memory_limit} small />
                          <InfoRow label="Max. upload" value={latestStatus.upload_max_filesize} small />
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <ShieldCheckIcon className="w-4 h-4" />
                          Bezpečnost
                        </h3>
                        <div className="space-y-2">
                          <InfoRow
                            label="HTTPS"
                            value={latestStatus.https_status}
                            badge={latestStatus.https_status === 'enabled' ? 'success' : 'warning'}
                            small
                          />
                          <InfoRow
                            label="Indexování"
                            value={latestStatus.indexing_allowed || 'Neznámý'}
                            badge={latestStatus.indexing_allowed === 'Povoleno' ? 'success' : 'info'}
                            small
                          />
                        </div>
                      </div>
                    </div>

                    {/* Theme & Plugins Summary */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <PackageIcon className="w-4 h-4" />
                        Motiv & Pluginy
                      </h3>
                      <div className="space-y-2">
                        <InfoRow label="Motiv" value={`${latestStatus.theme_name} (${latestStatus.theme_version})`} small />
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                              {latestStatus.active_plugins_count}
                            </span>
                            <span className="text-gray-600">aktivních</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                              {latestStatus.inactive_plugins_count}
                            </span>
                            <span className="text-gray-600">neaktivních</span>
                          </div>
                          {latestStatus.update_plugins_count > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                                {latestStatus.update_plugins_count}
                              </span>
                              <span className="text-gray-600">aktualizací</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'plugins' && (
                  <div className="space-y-4">
                    {updatePlugins.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <AlertTriangleIcon className="w-4 h-4 text-orange-600" />
                          Vyžadují aktualizaci ({updatePlugins.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {updatePlugins.map((plugin, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1.5 bg-orange-50 text-orange-700 text-xs font-medium rounded-full border border-orange-200 hover:bg-orange-100 transition-colors"
                              title={plugin.current_version && plugin.new_version ? `${plugin.current_version} → ${plugin.new_version}` : 'Dostupná aktualizace'}
                            >
                              {plugin.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {activePlugins.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <CheckCircleIcon className="w-4 h-4 text-green-600" />
                          Aktivní pluginy ({activePlugins.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {activePlugins.map((plugin: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200 hover:bg-green-100 transition-colors"
                            >
                              {plugin}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {inactivePlugins.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <XCircleIcon className="w-4 h-4 text-gray-400" />
                          Neaktivní pluginy ({inactivePlugins.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {inactivePlugins.map((plugin: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full border border-gray-200"
                            >
                              {plugin}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {activePlugins.length === 0 && updatePlugins.length === 0 && inactivePlugins.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <PackageIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Žádné pluginy nenalezeny</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'users' && (
                  <div>
                    {users.length > 0 ? (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <UsersIcon className="w-4 h-4 text-blue-600" />
                          Uživatelé ({users.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {users.map((user: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                              {user}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <UsersIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Žádní uživatelé nenalezeni</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="text-gray-500">{icon}</div>
        <p className="text-xs text-gray-600">{label}</p>
      </div>
      <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
    </div>
  );
}

function ContentStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  badge,
  small = false,
}: {
  label: string;
  value: string | null | undefined;
  badge?: 'success' | 'warning' | 'info';
  small?: boolean;
}) {
  const badgeClasses = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-orange-100 text-orange-700',
    info: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className={`flex items-center justify-between ${small ? 'py-1' : 'py-2'}`}>
      <span className={`${small ? 'text-xs' : 'text-sm'} text-gray-600`}>{label}</span>
      {badge ? (
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${badgeClasses[badge]}`}>
          {value || '-'}
        </span>
      ) : (
        <span className={`${small ? 'text-xs' : 'text-sm'} font-medium text-gray-900 truncate ml-2`}>
          {value || '-'}
        </span>
      )}
    </div>
  );
}
