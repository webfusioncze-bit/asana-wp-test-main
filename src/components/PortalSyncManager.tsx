import { useState, useEffect } from 'react';
import { GlobeIcon, RefreshCwIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PortalSyncConfig {
  id: string;
  portal_url: string;
  is_enabled: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export function PortalSyncManager() {
  const [config, setConfig] = useState<PortalSyncConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [portalUrl, setPortalUrl] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);

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
      const updatedConfig = {
        ...configData,
        last_sync_at: websitesData?.last_sync_at || configData.last_sync_at
      };
      setConfig(updatedConfig);
      setPortalUrl(configData.portal_url || 'https://portal.webfusion.cz/webs_feed.xml');
      setIsEnabled(true);
    } else {
      setConfig({
        id: '',
        portal_url: 'https://portal.webfusion.cz/webs_feed.xml',
        is_enabled: true,
        last_sync_at: websitesData?.last_sync_at || null,
        sync_error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      setPortalUrl('https://portal.webfusion.cz/webs_feed.xml');
      setIsEnabled(true);
    }
    setLoading(false);
  }

  async function saveConfig() {
    setSaving(true);

    const configData = {
      portal_url: portalUrl,
      is_enabled: isEnabled,
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
        alert(`Synchronizace dokončena:\n\nSynchronizováno: ${result.syncedWebsites} webů\nCelkem v portálu: ${result.totalWebsites}${result.failedWebsites > 0 ? `\nSelhalo: ${result.failedWebsites}` : ''}`);
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL portálu
            </label>
            <input
              type="text"
              value={portalUrl}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL XML feedu, který vrací seznam webů z portálu
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_enabled"
              checked={true}
              readOnly
              disabled
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="is_enabled" className="text-sm font-medium text-gray-700">
              Automatická synchronizace každých 5 minut (aktivní)
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
                  <li>Systém načte seznam webů z portálu z XML feedu</li>
                  <li>Pro každý web v portálu zjistí všechny dostupné údaje</li>
                  <li>Pokud web v databázi neexistuje, automaticky ho přidá</li>
                  <li>Data se ukládají do databáze včetně historie stavů</li>
                  <li>Synchronizace probíhá automaticky každých 5 minut na pozadí</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={syncNow}
              disabled={syncing}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCwIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Synchronizuji...' : 'Synchronizovat nyní'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
