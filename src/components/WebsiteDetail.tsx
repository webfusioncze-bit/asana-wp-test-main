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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Website, WebsiteStatus } from '../types';

interface WebsiteDetailProps {
  websiteId: string;
  onClose: () => void;
}

export function WebsiteDetail({ websiteId, onClose }: WebsiteDetailProps) {
  const [website, setWebsite] = useState<Website | null>(null);
  const [latestStatus, setLatestStatus] = useState<WebsiteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadWebsiteData();
    syncWebsiteOnOpen();
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

  async function syncWebsiteOnOpen() {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-websites`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ websiteId }),
      });

      if (response.ok) {
        await loadWebsiteData();
      }
    } catch (error) {
      console.error('Background sync error:', error);
    }
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
        body: JSON.stringify({ websiteId }),
      });

      if (!response.ok) {
        throw new Error('Failed to sync website');
      }

      await loadWebsiteData();
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

  const getScreenshotUrl = () => {
    if (website.screenshot_url) return website.screenshot_url;
    return `https://api.screenshotone.com/take?url=${encodeURIComponent(website.url)}&viewport_width=1920&viewport_height=1080&device_scale_factor=1&format=jpg&block_ads=true&block_cookie_banners=true&block_trackers=true&cache=true&cache_ttl=2592000`;
  };

  const adminLoginUrl = latestStatus?.ult
    ? `${website.url}?login_token=${latestStatus.ult}`
    : `${website.url}/wp-admin`;

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XIcon className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-gray-900">{website.name}</h1>
                {website.is_available ? (
                  <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    <CheckCircleIcon className="w-3 h-3" />
                    Online
                    {website.response_time_ms && (
                      <span className="ml-1 text-green-600">({website.response_time_ms}ms)</span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                    <XCircleIcon className="w-3 h-3" />
                    Offline
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <a
                  href={website.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  {website.url}
                  <ExternalLinkIcon className="w-3 h-3" />
                </a>
                {latestStatus?.ult && (
                  <a
                    href={adminLoginUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded hover:bg-blue-100 transition-colors"
                  >
                    <LogInIcon className="w-3 h-3" />
                    Přihlásit do administrace
                  </a>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={syncWebsite}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCwIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchronizuji...' : 'Synchronizovat'}
          </button>
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
          <div className="max-w-7xl mx-auto p-6 space-y-6">
            {website.sync_error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-red-900 mb-1">Chyba synchronizace</h3>
                    <p className="text-sm text-red-700">{website.sync_error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <div className="aspect-video bg-gray-100 relative">
                <img
                  src={getScreenshotUrl()}
                  alt={`Náhled ${website.name}`}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENáhled není k dispozici%3C/text%3E%3C/svg%3E';
                  }}
                />
                <div className="absolute top-4 right-4">
                  <a
                    href={website.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm text-gray-900 rounded-lg hover:bg-white transition-colors shadow-md"
                  >
                    <ExternalLinkIcon className="w-4 h-4" />
                    Navštívit web
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                icon={<ClockIcon className="w-5 h-5" />}
                label="Poslední aktualizace"
                value={latestStatus.last_updated || '-'}
                color="blue"
              />
              <StatCard
                icon={<ServerIcon className="w-5 h-5" />}
                label="Server uptime"
                value={latestStatus.uptime || '-'}
                color="green"
              />
              <StatCard
                icon={<TrendingUpIcon className="w-5 h-5" />}
                label="Zatížení serveru"
                value={latestStatus.server_load || '-'}
                color="orange"
              />
              <StatCard
                icon={<ZapIcon className="w-5 h-5" />}
                label="Úložiště"
                value={latestStatus.storage_usage || '-'}
                color="purple"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Technické informace" icon={<ServerIcon className="w-5 h-5" />}>
                <InfoRow label="WordPress" value={latestStatus.wordpress_version} />
                <InfoRow label="PHP" value={latestStatus.php_version} />
                <InfoRow label="MySQL" value={latestStatus.mysql_version} />
                <InfoRow label="Memory limit" value={latestStatus.memory_limit} />
                <InfoRow label="Max. velikost uploadu" value={latestStatus.upload_max_filesize} />
              </Section>

              <Section title="Bezpečnost" icon={<ShieldCheckIcon className="w-5 h-5" />}>
                <InfoRow
                  label="HTTPS"
                  value={latestStatus.https_status}
                  badge={latestStatus.https_status === 'enabled' ? 'success' : 'warning'}
                />
                <InfoRow
                  label="Indexování"
                  value={latestStatus.indexing_allowed === 'true' ? 'Povoleno' : 'Zakázáno'}
                  badge={latestStatus.indexing_allowed === 'true' ? 'success' : 'info'}
                />
              </Section>

              <Section title="Obsah webu" icon={<FileTextIcon className="w-5 h-5" />}>
                <div className="grid grid-cols-2 gap-4">
                  <ContentStat
                    icon={<FileTextIcon className="w-5 h-5 text-blue-600" />}
                    label="Stránky"
                    value={latestStatus.num_pages}
                  />
                  <ContentStat
                    icon={<FileTextIcon className="w-5 h-5 text-green-600" />}
                    label="Příspěvky"
                    value={latestStatus.num_posts}
                  />
                  <ContentStat
                    icon={<MessageSquareIcon className="w-5 h-5 text-purple-600" />}
                    label="Komentáře"
                    value={latestStatus.num_comments}
                  />
                  <ContentStat
                    icon={<ImageIcon className="w-5 h-5 text-orange-600" />}
                    label="Média"
                    value={latestStatus.num_media_files}
                  />
                  <ContentStat
                    icon={<UsersIcon className="w-5 h-5 text-gray-600" />}
                    label="Uživatelé"
                    value={latestStatus.num_users}
                  />
                </div>
              </Section>

              <Section title="Motiv & Pluginy" icon={<PackageIcon className="w-5 h-5" />}>
                <InfoRow label="Název motivu" value={latestStatus.theme_name} />
                <InfoRow label="Verze motivu" value={latestStatus.theme_version} />
                <div className="pt-3 mt-3 border-t border-gray-100">
                  <InfoRow
                    label="Aktivní pluginy"
                    value={latestStatus.active_plugins_count.toString()}
                    badge="success"
                  />
                  <InfoRow
                    label="Neaktivní pluginy"
                    value={latestStatus.inactive_plugins_count.toString()}
                    badge="info"
                  />
                  {latestStatus.update_plugins_count > 0 && (
                    <InfoRow
                      label="Dostupné aktualizace"
                      value={latestStatus.update_plugins_count.toString()}
                      badge="warning"
                    />
                  )}
                </div>
              </Section>
            </div>

            {latestStatus.raw_data?.active_plugins && latestStatus.raw_data.active_plugins.length > 0 && (
              <Section title="Aktivní pluginy" icon={<PackageIcon className="w-5 h-5" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {latestStatus.raw_data.active_plugins.map((plugin, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{plugin.name}</p>
                        <p className="text-xs text-gray-500 truncate">{plugin.author}</p>
                      </div>
                      <span className="ml-3 text-xs text-gray-600 font-mono bg-white px-2 py-1 rounded">{plugin.version}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {latestStatus.raw_data?.update_plugins && latestStatus.raw_data.update_plugins.length > 0 && (
              <Section title="Pluginy vyžadující aktualizaci" icon={<AlertTriangleIcon className="w-5 h-5 text-orange-600" />}>
                <div className="space-y-2">
                  {latestStatus.raw_data.update_plugins.map((plugin, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{plugin.name}</p>
                        <p className="text-xs text-gray-500 truncate">{plugin.author}</p>
                      </div>
                      <span className="ml-3 text-xs text-orange-700 font-mono bg-white px-2 py-1 rounded">{plugin.version}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {latestStatus.raw_data?.users && latestStatus.raw_data.users.length > 0 && (
              <Section title="Uživatelé" icon={<UsersIcon className="w-5 h-5" />}>
                <div className="space-y-2">
                  {latestStatus.raw_data.users.map((user, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{user.username}</p>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      </div>
                      <span className="ml-3 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        {user.role}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'orange' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${colorClasses[color]}`}>
        {icon}
      </div>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-lg font-semibold text-gray-900 truncate">{value}</p>
    </div>
  );
}

function ContentStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-600 mt-1">{label}</p>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <div className="text-gray-600">{icon}</div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string | null | undefined;
  badge?: 'success' | 'warning' | 'info';
}) {
  const badgeClasses = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-orange-100 text-orange-700',
    info: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-600">{label}</span>
      {badge ? (
        <span className={`px-2 py-1 text-xs font-medium rounded ${badgeClasses[badge]}`}>
          {value || '-'}
        </span>
      ) : (
        <span className="text-sm font-medium text-gray-900">{value || '-'}</span>
      )}
    </div>
  );
}
