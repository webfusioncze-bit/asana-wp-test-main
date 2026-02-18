import { useState, useEffect, useRef } from 'react';
import { GlobeIcon, RefreshCwIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon, HeadphonesIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PortalSyncConfig {
  id: string;
  portal_url: string;
  is_enabled: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
  projects_portal_url: string | null;
  projects_sync_enabled: boolean;
  projects_last_sync_at: string | null;
  projects_sync_error: string | null;
  clients_portal_url: string | null;
  clients_sync_enabled: boolean;
  clients_last_sync_at: string | null;
  clients_sync_error: string | null;
  tickets_portal_url: string | null;
  tickets_sync_enabled: boolean;
  tickets_last_sync_at: string | null;
  tickets_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketSyncProgress {
  synced: number;
  failed: number;
  skipped: number;
  total: number;
  currentTitle: string;
  currentStatus: string;
  page: number;
  totalPages: number;
  done: boolean;
  error: string | null;
  syncedComments: number;
}

export function PortalSyncManager() {
  const [config, setConfig] = useState<PortalSyncConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingProjects, setSyncingProjects] = useState(false);
  const [syncingClients, setSyncingClients] = useState(false);
  const [syncingTickets, setSyncingTickets] = useState(false);
  const [portalUrl, setPortalUrl] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [projectsPortalUrl, setProjectsPortalUrl] = useState('');
  const [projectsSyncEnabled, setProjectsSyncEnabled] = useState(false);
  const [clientsPortalUrl, setClientsPortalUrl] = useState('');
  const [clientsSyncEnabled, setClientsSyncEnabled] = useState(false);
  const [ticketsPortalUrl, setTicketsPortalUrl] = useState('');
  const [ticketsSyncEnabled, setTicketsSyncEnabled] = useState(false);

  const [ticketProgress, setTicketProgress] = useState<TicketSyncProgress | null>(null);
  const ticketLogRef = useRef<HTMLDivElement>(null);
  const [ticketSyncLog, setTicketSyncLog] = useState<string[]>([]);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (ticketLogRef.current) {
      ticketLogRef.current.scrollTop = ticketLogRef.current.scrollHeight;
    }
  }, [ticketSyncLog]);

  async function loadConfig() {
    setLoading(true);

    const { data: configData, error: configError } = await supabase
      .from('portal_sync_config')
      .select('*')
      .maybeSingle();

    if (configError) {
      console.error('Error loading config:', configError);
    }

    if (configData) {
      setConfig(configData);
      setPortalUrl(configData.portal_url || 'https://portal.webfusion.cz/wp-json/wp/v2/web');
      setIsEnabled(configData.is_enabled);
      setProjectsPortalUrl(configData.projects_portal_url || 'https://portal.webfusion.cz/wp-json/wp/v2/projekt');
      setProjectsSyncEnabled(configData.projects_sync_enabled);
      setClientsPortalUrl(configData.clients_portal_url || 'https://portal.webfusion.cz/wp-json/webfusion/v1/klienti');
      setClientsSyncEnabled(configData.clients_sync_enabled);
      setTicketsPortalUrl(configData.tickets_portal_url || 'https://portal.webfusion.cz/wp-json/wp/v2/pozadavek-na-podporu');
      setTicketsSyncEnabled(configData.tickets_sync_enabled);
    } else {
      setConfig(null);
      setPortalUrl('https://portal.webfusion.cz/wp-json/wp/v2/web');
      setIsEnabled(false);
      setProjectsPortalUrl('https://portal.webfusion.cz/wp-json/wp/v2/projekt');
      setProjectsSyncEnabled(false);
      setClientsPortalUrl('https://portal.webfusion.cz/wp-json/webfusion/v1/klienti');
      setClientsSyncEnabled(false);
      setTicketsPortalUrl('https://portal.webfusion.cz/wp-json/wp/v2/pozadavek-na-podporu');
      setTicketsSyncEnabled(false);
    }
    setLoading(false);
  }

  async function saveConfig() {
    setSaving(true);

    const configData = {
      portal_url: portalUrl,
      is_enabled: isEnabled,
      projects_portal_url: projectsPortalUrl,
      projects_sync_enabled: projectsSyncEnabled,
      clients_portal_url: clientsPortalUrl,
      clients_sync_enabled: clientsSyncEnabled,
      tickets_portal_url: ticketsPortalUrl,
      tickets_sync_enabled: ticketsSyncEnabled,
      updated_at: new Date().toISOString(),
    };

    if (config) {
      const { error } = await supabase
        .from('portal_sync_config')
        .update(configData)
        .eq('id', config.id);

      if (error) {
        console.error('Error updating config:', error);
        alert('Chyba při ukládání konfigurace');
      } else {
        await loadConfig();
        alert('Konfigurace uložena');
      }
    } else {
      const { error } = await supabase
        .from('portal_sync_config')
        .insert(configData);

      if (error) {
        console.error('Error creating config:', error);
        alert('Chyba při vytváření konfigurace');
      } else {
        await loadConfig();
        alert('Konfigurace vytvořena');
      }
    }

    setSaving(false);
  }

  async function syncNow() {
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

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync');
      }

      await loadConfig();

      if (result.success) {
        alert(`Synchronizace dokončena:\n\nPřidáno: ${result.added}\nOdstraněno: ${result.removed}\nPřeskočeno: ${result.skipped}\nCelkem v portálu: ${result.total}`);
      } else {
        alert('Chyba při synchronizaci: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Chyba při synchronizaci: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  }

  async function syncProjectsNow() {
    setSyncingProjects(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-portal-projects`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync');
      }

      await loadConfig();

      if (result.success) {
        alert(`Synchronizace projektů dokončena:\n\nPřidáno: ${result.added}\nAktualizováno: ${result.updated || 0}\nOdstraněno: ${result.removed}\nPřeskočeno: ${result.skipped}\nCelkem v portálu: ${result.total}`);
      } else {
        alert('Chyba při synchronizaci: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Chyba při synchronizaci projektů: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSyncingProjects(false);
    }
  }

  async function syncClientsNow() {
    setSyncingClients(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-portal-clients`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync');
      }

      await loadConfig();

      if (result.success) {
        alert(`Synchronizace klientů dokončena:\n\nSynchronizováno: ${result.syncedClients} klientů\nCelkem stránek: ${result.totalPages}${result.failedClients > 0 ? `\nSelhalo: ${result.failedClients}` : ''}`);
      } else {
        alert('Chyba při synchronizaci: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Chyba při synchronizaci klientů: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSyncingClients(false);
    }
  }

  async function callSyncApi(body: Record<string, unknown>) {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-support-tickets`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async function syncTicketsNow(mode: 'full_import' | 'incremental') {
    setSyncingTickets(true);
    setTicketSyncLog([]);
    setTicketProgress({
      synced: 0, failed: 0, skipped: 0, total: 0,
      currentTitle: '', currentStatus: '', page: 0, totalPages: 0,
      done: false, error: null, syncedComments: 0,
    });

    try {
      const modeLabel = mode === 'full_import' ? 'kompletni import (preskakuje existujici)' : 'inkrementalni (pouze nevyresene)';
      setTicketSyncLog(prev => [...prev, `Zahajuji synchronizaci: ${modeLabel}...`]);

      const info = await callSyncApi({ mode, page: 0 });

      if (!info.success) throw new Error(info.error || 'Failed to get info');

      const totalPages = info.totalPages;
      const totalTickets = info.totalTickets;
      const existingCount = info.existingCount || 0;

      setTicketSyncLog(prev => [
        ...prev,
        `Celkem v portalu: ${totalTickets} pozadavku (${totalPages} stranek)`,
        ...(mode === 'full_import' ? [`Jiz existuje v DB: ${existingCount} -- budou preskoceny`] : []),
      ]);

      setTicketProgress(prev => prev ? { ...prev, total: totalTickets, totalPages } : null);

      let totalSynced = 0;
      let totalFailed = 0;
      let totalSkipped = 0;
      let totalComments = 0;

      for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
        setTicketSyncLog(prev => [...prev, `--- Strana ${currentPage}/${totalPages} ---`]);

        const pageResult = await callSyncApi({ mode, page: currentPage });

        if (!pageResult.success) {
          throw new Error(pageResult.error || `Failed on page ${currentPage}`);
        }

        totalSynced += pageResult.synced;
        totalFailed += pageResult.failed;
        totalSkipped += pageResult.skipped;
        totalComments += pageResult.comments;

        const tickets = pageResult.tickets || [];
        for (const t of tickets) {
          if (t.action === 'synced') {
            setTicketSyncLog(prev => [
              ...prev,
              `  [SYNC] #${t.id} ${t.title} (${t.status})${t.comments > 0 ? ` +${t.comments} komentaru` : ''}`,
            ]);
          } else if (t.action === 'skipped_exists') {
            // don't log individual skips to avoid spam, just count
          } else if (t.action === 'skipped_resolved') {
            // don't log individual skips
          } else if (t.action === 'error') {
            setTicketSyncLog(prev => [...prev, `  [CHYBA] #${t.id} ${t.title}`]);
          }
        }

        const skippedOnPage = tickets.filter((t: { action: string }) => t.action === 'skipped_exists' || t.action === 'skipped_resolved').length;
        if (skippedOnPage > 0) {
          setTicketSyncLog(prev => [...prev, `  Preskoceno na strane: ${skippedOnPage}`]);
        }

        setTicketProgress(prev => prev ? {
          ...prev,
          synced: totalSynced,
          failed: totalFailed,
          skipped: totalSkipped,
          syncedComments: totalComments,
          page: currentPage,
          totalPages,
          currentTitle: tickets.length > 0 ? tickets[tickets.length - 1].title : '',
          currentStatus: tickets.length > 0 ? tickets[tickets.length - 1].status : '',
        } : null);
      }

      setTicketProgress(prev => prev ? { ...prev, done: true } : null);
      setTicketSyncLog(prev => [
        ...prev,
        `=== Synchronizace dokoncena ===`,
        `Synchronizovano: ${totalSynced} pozadavku, ${totalComments} komentaru`,
        totalSkipped > 0 ? `Preskoceno: ${totalSkipped}` : '',
        totalFailed > 0 ? `Chybnych: ${totalFailed}` : '',
      ].filter(Boolean));

      await loadConfig();
    } catch (error) {
      console.error('Ticket sync error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setTicketProgress(prev => prev ? { ...prev, done: true, error: msg } : null);
      setTicketSyncLog(prev => [...prev, `[FATALNI CHYBA] ${msg}`]);
    } finally {
      setSyncingTickets(false);
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'Nikdy';
    return new Date(date).toLocaleString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Nacitani...</p>
      </div>
    );
  }

  const ticketProgressPercent = ticketProgress && ticketProgress.total > 0
    ? Math.round(((ticketProgress.synced + ticketProgress.skipped + ticketProgress.failed) / ticketProgress.total) * 100)
    : 0;

  return (
    <div className="p-6">
      <div className="max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <GlobeIcon className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-semibold text-gray-900">Synchronizace s portalem</h2>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h3 className="text-lg font-semibold text-gray-900 pb-3 border-b border-gray-200">
            Synchronizace webu
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL portalu webu
            </label>
            <input
              type="text"
              value={portalUrl}
              onChange={(e) => setPortalUrl(e.target.value)}
              placeholder="https://portal.webfusion.cz/wp-json/wp/v2/web"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL JSON API endpointu, ktery vraci seznam webu z portalu
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_enabled"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_enabled" className="text-sm font-medium text-gray-700">
              Povolit automatickou synchronizaci kazdych 15 minut
            </label>
          </div>

          {config?.sync_error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-900 mb-1">Chyba synchronizace</h3>
                  <p className="text-sm text-red-700">{config.sync_error}</p>
                </div>
              </div>
            </div>
          )}

          {config?.last_sync_at && !config.sync_error && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-900 mb-1">Posledni synchronizace</h3>
                  <p className="text-sm text-green-700">{formatDate(config.last_sync_at)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <h3 className="font-medium mb-2">Jak to funguje?</h3>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>System nacte seznam webu z portalu z JSON API</li>
                  <li>Pro kazdy web v portalu zkontroluje pole <code className="bg-blue-100 px-1 py-0.5 rounded">acf.url_adresa_webu</code></li>
                  <li>Pokud web v databazi neexistuje, prida ho</li>
                  <li>Pokud web v databazi existuje, ale neni v portalu, odstrani ho</li>
                  <li>Po pridani webu se automaticky spusti synchronizace jejich stavu (XML feed kazdych 5 minut)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={syncNow}
              disabled={syncing || !config || !config.is_enabled}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCwIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Synchronizuji...' : 'Synchronizovat nyni'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 pb-3 border-b border-gray-200">
            Synchronizace projektu
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL portalu projektu
            </label>
            <input
              type="text"
              value={projectsPortalUrl}
              onChange={(e) => setProjectsPortalUrl(e.target.value)}
              placeholder="https://portal.webfusion.cz/wp-json/wp/v2/projekt"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL JSON API endpointu, ktery vraci seznam projektu z portalu
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="projects_sync_enabled"
              checked={projectsSyncEnabled}
              onChange={(e) => setProjectsSyncEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="projects_sync_enabled" className="text-sm font-medium text-gray-700">
              Povolit automatickou synchronizaci kazdych 15 minut
            </label>
          </div>

          {config?.projects_sync_error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-900 mb-1">Chyba synchronizace</h3>
                  <p className="text-sm text-red-700">{config.projects_sync_error}</p>
                </div>
              </div>
            </div>
          )}

          {config?.projects_last_sync_at && !config.projects_sync_error && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-900 mb-1">Posledni synchronizace</h3>
                  <p className="text-sm text-green-700">{formatDate(config.projects_last_sync_at)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <h3 className="font-medium mb-2">Jak to funguje?</h3>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>System nacte seznam projektu z portalu z JSON API</li>
                  <li>Pro kazdy projekt ziska ID a nazev</li>
                  <li>Pokud projekt v databazi neexistuje, vytvori ho</li>
                  <li>Pro kazdy projekt nastavi import_source_url na detail projektu</li>
                  <li>Pokud projekt v databazi existuje, ale neni v portalu, odstrani ho</li>
                  <li>Po pridani projektu se automaticky spusti synchronizace jejich detailu (kazdych 15 minut)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={syncProjectsNow}
              disabled={syncingProjects || !config || !config.projects_sync_enabled}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCwIcon className={`w-4 h-4 ${syncingProjects ? 'animate-spin' : ''}`} />
              {syncingProjects ? 'Synchronizuji...' : 'Synchronizovat nyni'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 pb-3 border-b border-gray-200">
            Synchronizace klientu
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL portalu klientu
            </label>
            <input
              type="text"
              value={clientsPortalUrl}
              onChange={(e) => setClientsPortalUrl(e.target.value)}
              placeholder="https://portal.webfusion.cz/wp-json/webfusion/v1/klienti"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL JSON API endpointu, ktery vraci seznam klientu z portalu
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="clients_sync_enabled"
              checked={clientsSyncEnabled}
              onChange={(e) => setClientsSyncEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="clients_sync_enabled" className="text-sm font-medium text-gray-700">
              Povolit automatickou synchronizaci kazdych 15 minut
            </label>
          </div>

          {config?.clients_sync_error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-900 mb-1">Chyba synchronizace</h3>
                  <p className="text-sm text-red-700">{config.clients_sync_error}</p>
                </div>
              </div>
            </div>
          )}

          {config?.clients_last_sync_at && !config.clients_sync_error && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-900 mb-1">Posledni synchronizace</h3>
                  <p className="text-sm text-green-700">{formatDate(config.clients_last_sync_at)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <h3 className="font-medium mb-2">Jak to funguje?</h3>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>System nacte seznam klientu z portalu z JSON API se strankovasnim</li>
                  <li>Pro kazdeho klienta ziska fakturacni udaje a unikatni ID</li>
                  <li>Pokud klient v databazi neexistuje, vytvori ho</li>
                  <li>Synchronizuje faktury a propoji weby s klientem</li>
                  <li>Pokud klient v databazi existuje, ale neni v portalu, odstrani ho</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={syncClientsNow}
              disabled={syncingClients || !config || !config.clients_sync_enabled}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCwIcon className={`w-4 h-4 ${syncingClients ? 'animate-spin' : ''}`} />
              {syncingClients ? 'Synchronizuji...' : 'Synchronizovat nyni'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 mt-6">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
            <HeadphonesIcon className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Synchronizace pozadavku na podporu
            </h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL portalu pozadavku
            </label>
            <input
              type="text"
              value={ticketsPortalUrl}
              onChange={(e) => setTicketsPortalUrl(e.target.value)}
              placeholder="https://portal.webfusion.cz/wp-json/wp/v2/pozadavek-na-podporu"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL JSON API endpointu, ktery vraci seznam pozadavku na podporu z portalu
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="tickets_sync_enabled"
              checked={ticketsSyncEnabled}
              onChange={(e) => setTicketsSyncEnabled(e.target.checked)}
              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
            />
            <label htmlFor="tickets_sync_enabled" className="text-sm font-medium text-gray-700">
              Povolit automatickou synchronizaci kazdych 5 minut (pouze nevyresene)
            </label>
          </div>

          {config?.tickets_sync_error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-900 mb-1">Chyba synchronizace</h3>
                  <p className="text-sm text-red-700">{config.tickets_sync_error}</p>
                </div>
              </div>
            </div>
          )}

          {config?.tickets_last_sync_at && !config.tickets_sync_error && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-900 mb-1">Posledni synchronizace</h3>
                  <p className="text-sm text-green-700">{formatDate(config.tickets_last_sync_at)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-teal-900">
                <h3 className="font-medium mb-2">Jak to funguje?</h3>
                <ul className="list-disc list-inside space-y-1 text-teal-800">
                  <li>System nacte pozadavky na podporu z portalu z JSON API</li>
                  <li>Pro kazdy pozadavek synchronizuje vsechna ACF pole (stav, priorita, cas, operator...)</li>
                  <li>Ke kazdemu pozadavku nacte a synchronizuje komentare</li>
                  <li><strong>Automaticka sync (kazdy 5 min)</strong> synchronizuje pouze pozadavky, ktere nemaji stav "Vyreseno"</li>
                  <li><strong>Manualni kompletni sync</strong> synchronizuje uplne vsechny pozadavky vcetne vyresenych</li>
                </ul>
              </div>
            </div>
          </div>

          {ticketProgress && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">
                  {ticketProgress.done
                    ? (ticketProgress.error ? 'Synchronizace selhala' : 'Synchronizace dokoncena')
                    : 'Probiha synchronizace...'
                  }
                </span>
                <span className="text-gray-500">
                  {ticketProgressPercent}%
                </span>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    ticketProgress.error ? 'bg-red-500' :
                    ticketProgress.done ? 'bg-green-500' : 'bg-teal-500'
                  }`}
                  style={{ width: `${ticketProgressPercent}%` }}
                />
              </div>

              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-white rounded-lg p-2 border border-gray-100">
                  <div className="text-lg font-bold text-teal-600">{ticketProgress.synced}</div>
                  <div className="text-xs text-gray-500">Synchronizovano</div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-gray-100">
                  <div className="text-lg font-bold text-gray-400">{ticketProgress.skipped}</div>
                  <div className="text-xs text-gray-500">Preskoceno</div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-gray-100">
                  <div className="text-lg font-bold text-red-500">{ticketProgress.failed}</div>
                  <div className="text-xs text-gray-500">Chyb</div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-gray-100">
                  <div className="text-lg font-bold text-blue-600">{ticketProgress.syncedComments}</div>
                  <div className="text-xs text-gray-500">Komentaru</div>
                </div>
              </div>

              {ticketProgress.currentTitle && !ticketProgress.done && (
                <div className="text-xs text-gray-500 truncate">
                  Aktualne: <span className="text-gray-700">{ticketProgress.currentTitle}</span>
                  {ticketProgress.page > 0 && (
                    <span className="ml-2">(strana {ticketProgress.page}/{ticketProgress.totalPages})</span>
                  )}
                </div>
              )}
            </div>
          )}

          {ticketSyncLog.length > 0 && (
            <div
              ref={ticketLogRef}
              className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-xs"
            >
              {ticketSyncLog.map((line, i) => (
                <div
                  key={i}
                  className={`py-0.5 ${
                    line.startsWith('[CHYBA]') || line.startsWith('[FATALNI')
                      ? 'text-red-400'
                      : line.startsWith('---')
                        ? 'text-green-400 font-bold mt-1'
                        : line.startsWith('Zahajuji') || line.startsWith('Celkem') || line.startsWith('Synchronizovano') || line.startsWith('Preskoceno') || line.startsWith('Chybnych')
                          ? 'text-teal-300'
                          : 'text-gray-300'
                  }`}
                >
                  {line}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => syncTicketsNow('full_import')}
              disabled={syncingTickets || !config || !config.tickets_sync_enabled}
              className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCwIcon className={`w-4 h-4 ${syncingTickets ? 'animate-spin' : ''}`} />
              {syncingTickets ? 'Synchronizuji...' : 'Kompletni synchronizace'}
            </button>
            <button
              onClick={() => syncTicketsNow('incremental')}
              disabled={syncingTickets || !config || !config.tickets_sync_enabled}
              className="flex items-center gap-2 px-6 py-2 bg-white text-teal-700 border border-teal-300 rounded-lg hover:bg-teal-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCwIcon className={`w-4 h-4 ${syncingTickets ? 'animate-spin' : ''}`} />
              Pouze nevyresene
            </button>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={saveConfig}
            disabled={saving || !portalUrl.trim() || !projectsPortalUrl.trim() || !clientsPortalUrl.trim() || !ticketsPortalUrl.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Ukladani...' : 'Ulozit konfiguraci'}
          </button>
        </div>
      </div>
    </div>
  );
}
