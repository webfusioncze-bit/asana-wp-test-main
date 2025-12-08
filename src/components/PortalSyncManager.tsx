import { useState, useEffect } from 'react';
import { GlobeIcon, RefreshCwIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon } from 'lucide-react';
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
  created_at: string;
  updated_at: string;
}

export function PortalSyncManager() {
  const [config, setConfig] = useState<PortalSyncConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingProjects, setSyncingProjects] = useState(false);
  const [syncingClients, setSyncingClients] = useState(false);
  const [portalUrl, setPortalUrl] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [projectsPortalUrl, setProjectsPortalUrl] = useState('');
  const [projectsSyncEnabled, setProjectsSyncEnabled] = useState(false);
  const [clientsPortalUrl, setClientsPortalUrl] = useState('');
  const [clientsSyncEnabled, setClientsSyncEnabled] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);

    const { data: configData, error: configError } = await supabase
      .from('portal_sync_config')
      .select('*')
      .maybeSingle();

    if (configError) {
      console.error('Error loading config:', configError);
    }

    const { data: websitesData } = await supabase
      .from('websites')
      .select('last_sync_at')
      .order('last_sync_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configData) {
      setConfig(configData);
      setPortalUrl(configData.portal_url || 'https://portal.webfusion.cz/wp-json/wp/v2/web');
      setIsEnabled(configData.is_enabled);
      setProjectsPortalUrl(configData.projects_portal_url || 'https://portal.webfusion.cz/wp-json/wp/v2/projekt');
      setProjectsSyncEnabled(configData.projects_sync_enabled);
      setClientsPortalUrl(configData.clients_portal_url || 'https://portal.webfusion.cz/wp-json/webfusion/v1/klienti');
      setClientsSyncEnabled(configData.clients_sync_enabled);
    } else {
      setConfig(null);
      setPortalUrl('https://portal.webfusion.cz/wp-json/wp/v2/web');
      setIsEnabled(false);
      setProjectsPortalUrl('https://portal.webfusion.cz/wp-json/wp/v2/projekt');
      setProjectsSyncEnabled(false);
      setClientsPortalUrl('https://portal.webfusion.cz/wp-json/webfusion/v1/klienti');
      setClientsSyncEnabled(false);
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
        <p className="text-gray-500">Načítání...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <GlobeIcon className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-semibold text-gray-900">Synchronizace s portálem</h2>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h3 className="text-lg font-semibold text-gray-900 pb-3 border-b border-gray-200">
            Synchronizace webů
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL portálu webů
            </label>
            <input
              type="text"
              value={portalUrl}
              onChange={(e) => setPortalUrl(e.target.value)}
              placeholder="https://portal.webfusion.cz/wp-json/wp/v2/web"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL JSON API endpointu, který vrací seznam webů z portálu
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
              Povolit automatickou synchronizaci každých 15 minut
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
                  <h3 className="font-medium text-green-900 mb-1">Poslední synchronizace</h3>
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
                  <li>Systém načte seznam webů z portálu z JSON API</li>
                  <li>Pro každý web v portálu zkontroluje pole <code className="bg-blue-100 px-1 py-0.5 rounded">acf.url_adresa_webu</code></li>
                  <li>Pokud web v databázi neexistuje, přidá ho</li>
                  <li>Pokud web v databázi existuje, ale není v portálu, odstraní ho</li>
                  <li>Po přidání webů se automaticky spustí synchronizace jejich stavů (XML feed každých 5 minut)</li>
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
              {syncing ? 'Synchronizuji...' : 'Synchronizovat nyní'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 pb-3 border-b border-gray-200">
            Synchronizace projektů
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL portálu projektů
            </label>
            <input
              type="text"
              value={projectsPortalUrl}
              onChange={(e) => setProjectsPortalUrl(e.target.value)}
              placeholder="https://portal.webfusion.cz/wp-json/wp/v2/projekt"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL JSON API endpointu, který vrací seznam projektů z portálu
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
              Povolit automatickou synchronizaci každých 15 minut
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
                  <h3 className="font-medium text-green-900 mb-1">Poslední synchronizace</h3>
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
                  <li>Systém načte seznam projektů z portálu z JSON API</li>
                  <li>Pro každý projekt získá ID a název</li>
                  <li>Pokud projekt v databázi neexistuje, vytvoří ho</li>
                  <li>Pro každý projekt nastaví import_source_url na detail projektu</li>
                  <li>Pokud projekt v databázi existuje, ale není v portálu, odstraní ho</li>
                  <li>Po přidání projektů se automaticky spustí synchronizace jejich detailů (každých 15 minut)</li>
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
              {syncingProjects ? 'Synchronizuji...' : 'Synchronizovat nyní'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 pb-3 border-b border-gray-200">
            Synchronizace klientů
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL portálu klientů
            </label>
            <input
              type="text"
              value={clientsPortalUrl}
              onChange={(e) => setClientsPortalUrl(e.target.value)}
              placeholder="https://portal.webfusion.cz/wp-json/webfusion/v1/klienti"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL JSON API endpointu, který vrací seznam klientů z portálu
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
              Povolit automatickou synchronizaci každých 15 minut
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
                  <h3 className="font-medium text-green-900 mb-1">Poslední synchronizace</h3>
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
                  <li>Systém načte seznam klientů z portálu z JSON API se stránkováním</li>
                  <li>Pro každého klienta získá fakturační údaje a unikátní ID</li>
                  <li>Pokud klient v databázi neexistuje, vytvoří ho</li>
                  <li>Synchronizuje faktury a propojí weby s klientem</li>
                  <li>Pokud klient v databázi existuje, ale není v portálu, odstraní ho</li>
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
              {syncingClients ? 'Synchronizuji...' : 'Synchronizovat nyní'}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={saveConfig}
            disabled={saving || !portalUrl.trim() || !projectsPortalUrl.trim() || !clientsPortalUrl.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Ukládání...' : 'Uložit konfiguraci'}
          </button>
        </div>
      </div>
    </div>
  );
}
