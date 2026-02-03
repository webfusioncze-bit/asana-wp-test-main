import { useState, useEffect } from 'react';
import { Globe as GlobeIcon, Server as ServerIcon, Database as DatabaseIcon, Users as UsersIcon, FileText as FileTextIcon, Image as ImageIcon, MessageSquare as MessageSquareIcon, Package as PackageIcon, ShieldCheck as ShieldCheckIcon, AlertTriangle as AlertTriangleIcon, Clock as ClockIcon, TrendingUp as TrendingUpIcon, RefreshCw as RefreshCwIcon, Bone as XIcon, ExternalLink as ExternalLinkIcon, CheckCircle as CheckCircleIcon, XCircle as XCircleIcon, Zap as ZapIcon, LogIn as LogInIcon, LayoutGrid as LayoutGridIcon, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Website, WebsiteStatus, WebsiteUpdateInstance } from '../types';
import { TaskDetail } from './TaskDetail';

interface WebsiteDetailProps {
  websiteId: string;
  onClose: () => void;
}

type TabType = 'overview' | 'plugins' | 'users' | 'updates';

export function WebsiteDetail({ websiteId, onClose }: WebsiteDetailProps) {
  const [website, setWebsite] = useState<Website | null>(null);
  const [latestStatus, setLatestStatus] = useState<WebsiteStatus | null>(null);
  const [clientInfo, setClientInfo] = useState<{ name: string; company_name: string | null; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [updateInstances, setUpdateInstances] = useState<WebsiteUpdateInstance[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; email: string; display_name: string | null; first_name: string | null; last_name: string | null; avatar_url: string | null }>>([]);
  const [assigningInstanceId, setAssigningInstanceId] = useState<string | null>(null);

  useEffect(() => {
    loadWebsiteData();
  }, [websiteId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assigningInstanceId) {
        setAssigningInstanceId(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [assigningInstanceId]);

  async function loadWebsiteData() {
    setLoading(true);

    const { data: websiteData } = await supabase
      .from('websites')
      .select('*')
      .eq('id', websiteId)
      .maybeSingle();

    if (websiteData?.api_key) {
      try {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-website-status`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            websiteUrl: websiteData.url,
            apiKey: websiteData.api_key,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const { error: insertError } = await supabase
              .from('website_status')
              .insert({
                website_id: websiteId,
                ...result.data,
              });

            if (!insertError) {
              await supabase
                .from('websites')
                .update({
                  last_sync_at: new Date().toISOString(),
                  sync_error: null,
                })
                .eq('id', websiteId);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching website data via API:', error);
      }
    }

    const { data: statusData } = await supabase
      .from('website_status')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: clientWebsiteData } = await supabase
      .from('client_websites')
      .select('client_id')
      .eq('website_id', websiteId)
      .maybeSingle();

    if (clientWebsiteData?.client_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name, company_name')
        .eq('id', clientWebsiteData.client_id)
        .maybeSingle();

      setClientInfo(clientData);
    } else {
      setClientInfo(null);
    }

    const { data: scheduleData } = await supabase
      .from('website_update_schedules')
      .select('id')
      .eq('website_id', websiteId)
      .eq('is_active', true)
      .maybeSingle();

    if (scheduleData) {
      const { data: instancesData } = await supabase
        .from('website_update_instances')
        .select(`
          *,
          schedule:website_update_schedules(
            interval_months
          ),
          task:tasks(id, title, assigned_to, status, priority)
        `)
        .eq('schedule_id', scheduleData.id)
        .order('scheduled_date', { ascending: false });

      setUpdateInstances(instancesData || []);
    } else {
      setUpdateInstances([]);
    }

    const { data: usersData } = await supabase
      .from('user_profiles')
      .select('id, email, display_name, first_name, last_name, avatar_url')
      .order('display_name');

    setWebsite(websiteData);
    setLatestStatus(statusData);
    setUsers(usersData || []);
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

  async function saveApiKey() {
    if (!apiKeyInput.trim()) {
      alert('API klíč nemůže být prázdný');
      return;
    }

    try {
      const { error } = await supabase
        .from('websites')
        .update({
          api_key: apiKeyInput.trim(),
          api_key_created_at: new Date().toISOString()
        })
        .eq('id', websiteId);

      if (error) throw error;

      setWebsite(prev => prev ? {
        ...prev,
        api_key: apiKeyInput.trim(),
        api_key_created_at: new Date().toISOString()
      } : null);

      setIsEditingApiKey(false);
      alert('API klíč byl úspěšně uložen');
    } catch (error) {
      console.error('Error saving API key:', error);
      alert('Chyba při ukládání API klíče');
    }
  }

  async function assignTaskToUser(taskId: string, userId: string) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ assigned_to: userId })
        .eq('id', taskId);

      if (error) throw error;

      await loadWebsiteData();
      setAssigningInstanceId(null);
    } catch (error) {
      console.error('Error assigning task:', error);
      alert('Chyba při přiřazování úkolu');
    }
  }

  async function instantLogin() {
    if (!website.api_key) {
      const adminLoginUrl = latestStatus?.ult
        ? `${website.url}/login-token/${latestStatus.ult}`
        : `${website.url}/wp-admin`;
      window.open(adminLoginUrl, '_blank');
      return;
    }

    try {
      const response = await fetch(`${website.url}/wp-json/webfusion-connector/v1/instant-login`, {
        method: 'POST',
        headers: {
          'X-WBF-API-Key': website.api_key,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Instant login failed, falling back to ULT token');
        const adminLoginUrl = latestStatus?.ult
          ? `${website.url}/login-token/${latestStatus.ult}`
          : `${website.url}/wp-admin`;
        window.open(adminLoginUrl, '_blank');
        return;
      }

      const result = await response.json();

      if (result.success && result.login_url) {
        window.open(result.login_url, '_blank');
      } else {
        throw new Error('Invalid response from website');
      }
    } catch (error) {
      console.error('Instant login error, using fallback:', error);
      const adminLoginUrl = latestStatus?.ult
        ? `${website.url}/login-token/${latestStatus.ult}`
        : `${website.url}/wp-admin`;
      window.open(adminLoginUrl, '_blank');
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

  const activePlugins = normalizePlugins(latestStatus?.raw_data?.active_plugins || []);
  const updatePlugins = normalizeUpdatePlugins(latestStatus?.raw_data?.update_plugins || []);
  const inactivePlugins = normalizePlugins(latestStatus?.raw_data?.inactive_plugins || []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isInstanceCompleted = (inst: WebsiteUpdateInstance) => {
    const taskData = Array.isArray(inst.task) ? inst.task[0] : inst.task;
    return inst.status === 'completed' || inst.status === 'skipped' || taskData?.status === 'completed';
  };

  const upcomingInstances = updateInstances
    .filter(inst => !isInstanceCompleted(inst))
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

  const completedInstances = updateInstances
    .filter(inst => isInstanceCompleted(inst))
    .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime());

  return (
    <div className="flex-1 flex overflow-hidden">
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
              <div className="flex items-center gap-3 mt-0.5">
                <a
                  href={website.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  {website.url}
                  <ExternalLinkIcon className="w-3 h-3" />
                </a>
                {clientInfo && (
                  <>
                    <span className="text-xs text-gray-400">•</span>
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <UsersIcon className="w-3 h-3" />
                      <span>{clientInfo.company_name || clientInfo.name}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={instantLogin}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              title="Okamžité přihlášení do WP Admin (bez čekání na XML feed)"
            >
              <LogInIcon className="w-4 h-4" />
              WP Admin
            </button>
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
                  <div className="p-3 space-y-3">
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

                    {/* Data Source Badge */}
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex items-start justify-between text-xs mb-2">
                        <span className="text-gray-600">Zdroj dat</span>
                        {website.api_key ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50">
                            <ZapIcon className="w-3.5 h-3.5 text-green-600" />
                            <span className="font-medium text-green-600">API (Realtime)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-50">
                            <ClockIcon className="w-3.5 h-3.5 text-orange-600" />
                            <span className="font-medium text-orange-600">XML Feed</span>
                          </div>
                        )}
                      </div>
                      {!website.api_key && (
                        <div className="bg-orange-50 border border-orange-200 rounded p-2">
                          <p className="text-xs text-orange-800">
                            <strong>Doporučení:</strong> Aktualizujte plugin WBF Connector a nastavte API klíč pro realtime data a okamžité přihlášení.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* API Key Section - Moved from right column */}
                    <div className="pt-2 border-t border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                        <ShieldCheckIcon className="w-3.5 h-3.5" />
                        API klíč
                      </h4>
                      {!isEditingApiKey ? (
                        <div className="space-y-2">
                          <div className="flex items-start justify-between text-xs">
                            <span className="text-gray-600">Stav:</span>
                            {website.api_key ? (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                Nakonfigurováno
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                                Není nastaveno
                              </span>
                            )}
                          </div>
                          {website.api_key && (
                            <div className="flex items-start justify-between text-xs">
                              <span className="text-gray-600">Klíč:</span>
                              <code className="text-xs bg-gray-50 px-2 py-1 rounded font-mono max-w-[140px] truncate">
                                {website.api_key.substring(0, 12)}...
                              </code>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setApiKeyInput(website.api_key || '');
                              setIsEditingApiKey(true);
                            }}
                            className="mt-1 w-full px-2 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded hover:bg-blue-100 transition-colors"
                          >
                            {website.api_key ? 'Změnit klíč' : 'Nastavit klíč'}
                          </button>
                          {!website.api_key && (
                            <p className="text-xs text-gray-500 mt-1">
                              Získejte z pluginu WBF Connector v záložce "API klíč"
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder="Vložte API klíč..."
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={saveApiKey}
                              className="flex-1 px-2 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                            >
                              Uložit
                            </button>
                            <button
                              onClick={() => {
                                setIsEditingApiKey(false);
                                setApiKeyInput('');
                              }}
                              className="flex-1 px-2 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition-colors"
                            >
                              Zrušit
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
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
                  <button
                    onClick={() => setActiveTab('updates')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'updates'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      Aktualizace
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
                    {latestStatus?.raw_data?.users && Array.isArray(latestStatus.raw_data.users) && latestStatus.raw_data.users.length > 0 ? (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <UsersIcon className="w-4 h-4 text-blue-600" />
                          Uživatelé webu ({latestStatus.raw_data.users.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {latestStatus.raw_data.users.map((user: any, index: number) => {
                            const userName = typeof user === 'string' ? user : (user.username || user.email || 'Neznámý');
                            return (
                              <span
                                key={index}
                                className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200 hover:bg-blue-100 transition-colors"
                              >
                                {userName}
                              </span>
                            );
                          })}
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

                {activeTab === 'updates' && (
                  <div className="space-y-6">
                    {updateInstances.length > 0 ? (
                      <>
                        {upcomingInstances.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">
                              Plánované aktualizace ({upcomingInstances.length})
                            </h3>
                            <div className="space-y-2">
                              {upcomingInstances.map((instance) => {
                                const date = new Date(instance.scheduled_date);
                                const isOverdue = date < today && instance.status === 'pending';
                                const taskData = Array.isArray(instance.task) ? instance.task[0] : instance.task;
                                const assignedUser = taskData?.assigned_to
                                  ? users.find(u => u.id === taskData.assigned_to)
                                  : null;

                                return (
                                  <div
                                    key={instance.id}
                                    className={`p-3 rounded-lg border transition-colors ${
                                      isOverdue
                                        ? 'bg-red-50 border-red-200'
                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div
                                        className="flex items-center gap-3 flex-1 cursor-pointer"
                                        onClick={() => {
                                          if (instance.task_id) {
                                            setSelectedTaskId(instance.task_id);
                                          }
                                        }}
                                      >
                                        {isOverdue && (
                                          <AlertTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium text-gray-900">
                                              {date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </span>
                                            {isOverdue && (
                                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                                                Po termínu
                                              </span>
                                            )}
                                          </div>
                                          {instance.task && (
                                            <p className="text-xs text-gray-600 truncate">
                                              {instance.task.title}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {/* User Assignment */}
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {assignedUser ? (
                                          <div
                                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors"
                                            onClick={() => {
                                              if (instance.task_id) {
                                                setSelectedTaskId(instance.task_id);
                                              }
                                            }}
                                          >
                                            {assignedUser.avatar_url ? (
                                              <img
                                                src={assignedUser.avatar_url}
                                                alt=""
                                                className="w-6 h-6 rounded-full object-cover"
                                              />
                                            ) : (
                                              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                                <span className="text-xs font-medium text-blue-700">
                                                  {(assignedUser.first_name?.[0] || assignedUser.email[0]).toUpperCase()}
                                                </span>
                                              </div>
                                            )}
                                            <span className="text-xs font-medium text-gray-700">
                                              {assignedUser.display_name || assignedUser.first_name || assignedUser.email.split('@')[0]}
                                            </span>
                                          </div>
                                        ) : instance.task_id ? (
                                          <div className="relative">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setAssigningInstanceId(assigningInstanceId === instance.id ? null : instance.id);
                                              }}
                                              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                            >
                                              <UsersIcon className="w-4 h-4" />
                                              Přidělit
                                            </button>
                                            {assigningInstanceId === instance.id && (
                                              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                                                {users.map(user => (
                                                  <button
                                                    key={user.id}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      assignTaskToUser(instance.task_id!, user.id);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                                                  >
                                                    {user.avatar_url ? (
                                                      <img
                                                        src={user.avatar_url}
                                                        alt=""
                                                        className="w-6 h-6 rounded-full object-cover"
                                                      />
                                                    ) : (
                                                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                                        <span className="text-xs font-medium text-blue-700">
                                                          {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                                                        </span>
                                                      </div>
                                                    )}
                                                    <span className="text-gray-900">
                                                      {user.display_name || user.first_name || user.email.split('@')[0]}
                                                    </span>
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {completedInstances.length > 0 && (
                          <div>
                            <div className="flex items-center gap-3 mb-3">
                              <div className="flex-1 h-px bg-gray-200"></div>
                              <h3 className="text-sm font-semibold text-gray-500">
                                Dokončené ({completedInstances.length})
                              </h3>
                              <div className="flex-1 h-px bg-gray-200"></div>
                            </div>
                            <div className="space-y-2">
                              {completedInstances.map((instance) => {
                                const date = new Date(instance.scheduled_date);
                                const taskData = Array.isArray(instance.task) ? instance.task[0] : instance.task;
                                const assignedUser = taskData?.assigned_to
                                  ? users.find(u => u.id === taskData.assigned_to)
                                  : null;
                                const isTaskCompleted = taskData?.status === 'completed';
                                const isSkipped = instance.status === 'skipped';
                                const isCompleted = instance.status === 'completed' || isTaskCompleted;

                                return (
                                  <div
                                    key={instance.id}
                                    className="p-3 rounded-lg border bg-gray-50 border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                                    onClick={() => {
                                      if (instance.task_id) {
                                        setSelectedTaskId(instance.task_id);
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        {isCompleted ? (
                                          <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
                                        ) : isSkipped ? (
                                          <XCircleIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                        ) : (
                                          <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium text-gray-700">
                                              {date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </span>
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                              isCompleted
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-200 text-gray-600'
                                            }`}>
                                              {isCompleted ? 'Dokončeno' : 'Přeskočeno'}
                                            </span>
                                          </div>
                                          {instance.task && (
                                            <p className="text-xs text-gray-600 truncate">
                                              {instance.task.title}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {assignedUser && (
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          {assignedUser.avatar_url ? (
                                            <img
                                              src={assignedUser.avatar_url}
                                              alt=""
                                              className="w-6 h-6 rounded-full object-cover"
                                            />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                              <span className="text-xs font-medium text-blue-700">
                                                {(assignedUser.first_name?.[0] || assignedUser.email[0]).toUpperCase()}
                                              </span>
                                            </div>
                                          )}
                                          <span className="text-xs font-medium text-gray-700">
                                            {assignedUser.display_name || assignedUser.first_name || assignedUser.email.split('@')[0]}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <CalendarIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Žádné plánované aktualizace</p>
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

      {selectedTaskId && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end">
          <div className="absolute inset-0 bg-black bg-opacity-30" onClick={() => setSelectedTaskId(null)} />
          <div className="relative w-[480px] bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <TaskDetail
              taskId={selectedTaskId}
              onClose={() => setSelectedTaskId(null)}
              onTaskUpdated={() => {
                loadWebsiteData();
              }}
            />
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
