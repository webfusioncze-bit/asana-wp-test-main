import { useState, useEffect } from 'react';
import {
  GlobeIcon,
  ServerIcon,
  DatabaseIcon,
  HardDriveIcon,
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

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XIcon className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{website.name}</h1>
              <a
                href={website.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {website.url}
              </a>
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
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Section title="Technické informace" icon={<ServerIcon className="w-5 h-5" />}>
                <InfoRow label="WordPress" value={latestStatus.wordpress_version} />
                <InfoRow label="PHP" value={latestStatus.php_version} />
                <InfoRow label="MySQL" value={latestStatus.mysql_version} />
                <InfoRow label="Memory limit" value={latestStatus.memory_limit} />
                <InfoRow label="Max. velikost uploadu" value={latestStatus.upload_max_filesize} />
                <InfoRow label="Úložiště" value={latestStatus.storage_usage} />
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

              <Section title="Obsah" icon={<FileTextIcon className="w-5 h-5" />}>
                <InfoRow
                  label="Stránky"
                  value={latestStatus.num_pages.toString()}
                  icon={<FileTextIcon className="w-4 h-4 text-blue-600" />}
                />
                <InfoRow
                  label="Příspěvky"
                  value={latestStatus.num_posts.toString()}
                  icon={<FileTextIcon className="w-4 h-4 text-green-600" />}
                />
                <InfoRow
                  label="Komentáře"
                  value={latestStatus.num_comments.toString()}
                  icon={<MessageSquareIcon className="w-4 h-4 text-purple-600" />}
                />
                <InfoRow
                  label="Mediální soubory"
                  value={latestStatus.num_media_files.toString()}
                  icon={<ImageIcon className="w-4 h-4 text-orange-600" />}
                />
                <InfoRow
                  label="Uživatelé"
                  value={latestStatus.num_users.toString()}
                  icon={<UsersIcon className="w-4 h-4 text-gray-600" />}
                />
              </Section>

              <Section title="Motiv" icon={<PackageIcon className="w-5 h-5" />}>
                <InfoRow label="Název motivu" value={latestStatus.theme_name} />
                <InfoRow label="Verze motivu" value={latestStatus.theme_version} />
              </Section>

              <Section
                title={`Pluginy (${latestStatus.active_plugins_count})`}
                icon={<PackageIcon className="w-5 h-5" />}
              >
                <div className="space-y-2">
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
              <Section title="Seznam aktivních pluginů" icon={<PackageIcon className="w-5 h-5" />}>
                <div className="space-y-2">
                  {latestStatus.raw_data.active_plugins.map((plugin, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{plugin.name}</p>
                        <p className="text-sm text-gray-500">{plugin.author}</p>
                      </div>
                      <span className="text-sm text-gray-600 font-mono">{plugin.version}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {latestStatus.raw_data?.update_plugins && latestStatus.raw_data.update_plugins.length > 0 && (
              <Section title="Pluginy s dostupnými aktualizacemi" icon={<AlertTriangleIcon className="w-5 h-5 text-orange-600" />}>
                <div className="space-y-2">
                  {latestStatus.raw_data.update_plugins.map((plugin, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{plugin.name}</p>
                        <p className="text-sm text-gray-500">{plugin.author}</p>
                      </div>
                      <span className="text-sm text-orange-600 font-mono">{plugin.version}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {latestStatus.raw_data?.users && latestStatus.raw_data.users.length > 0 && (
              <Section title="Uživatelé" icon={<UsersIcon className="w-5 h-5" />}>
                <div className="space-y-2">
                  {latestStatus.raw_data.users.map((user, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{user.username}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
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
  color: 'blue' | 'green' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${colorClasses[color]}`}>
        {icon}
      </div>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
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
  icon,
  badge,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
  badge?: 'success' | 'warning' | 'info';
}) {
  const badgeClasses = {
    success: 'bg-green-100 text-green-700',
    warning: 'bg-orange-100 text-orange-700',
    info: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-gray-600">{label}</span>
      </div>
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
