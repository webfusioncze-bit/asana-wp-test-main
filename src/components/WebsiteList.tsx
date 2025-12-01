import { useState, useEffect } from 'react';
import { GlobeIcon, PlusIcon, Trash2Icon, RefreshCwIcon, AlertCircleIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Website } from '../types';

interface WebsiteListProps {
  selectedWebsiteId: string | null;
  onSelectWebsite: (websiteId: string) => void;
  canManage: boolean;
}

export function WebsiteList({ selectedWebsiteId, onSelectWebsite, canManage }: WebsiteListProps) {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddWebsite, setShowAddWebsite] = useState(false);
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('');
  const [newWebsiteName, setNewWebsiteName] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadWebsites();
  }, []);

  async function loadWebsites() {
    setLoading(true);
    const { data, error } = await supabase
      .from('websites')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading websites:', error);
    } else {
      setWebsites(data || []);
    }
    setLoading(false);
  }

  async function addWebsite() {
    if (!newWebsiteUrl.trim() || !newWebsiteName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let url = newWebsiteUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const { error } = await supabase
      .from('websites')
      .insert({
        url,
        name: newWebsiteName.trim(),
        owner_id: user.id,
      });

    if (error) {
      console.error('Error adding website:', error);
      alert('Chyba při přidávání webu');
    } else {
      setNewWebsiteUrl('');
      setNewWebsiteName('');
      setShowAddWebsite(false);
      loadWebsites();
    }
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
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-websites`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to sync websites');
      }

      const result = await response.json();
      console.log('Sync result:', result);

      await loadWebsites();

      if (result.failedWebsites > 0) {
        alert(`Synchronizováno ${result.syncedWebsites} webů, ${result.failedWebsites} selhalo`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Chyba při synchronizaci webů');
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
      <div className="flex-1 p-6">
        <p className="text-gray-500">Načítání webů...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Weby</h1>
          <div className="flex gap-2">
            <button
              onClick={syncAllWebsites}
              disabled={syncing || websites.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCwIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Synchronizuji...' : 'Synchronizovat vše'}
            </button>
            {canManage && (
              <button
                onClick={() => setShowAddWebsite(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Přidat web
              </button>
            )}
          </div>
        </div>
      </div>

      {showAddWebsite && (
        <div className="border-b border-gray-200 px-6 py-4 bg-blue-50">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Nový web</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Název webu</label>
              <input
                type="text"
                value={newWebsiteName}
                onChange={(e) => setNewWebsiteName(e.target.value)}
                placeholder="Např. Holding DETF"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">URL webu</label>
              <input
                type="text"
                value={newWebsiteUrl}
                onChange={(e) => setNewWebsiteUrl(e.target.value)}
                placeholder="detf-holding.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={addWebsite}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Přidat
              </button>
              <button
                onClick={() => {
                  setShowAddWebsite(false);
                  setNewWebsiteUrl('');
                  setNewWebsiteName('');
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {websites.length === 0 ? (
          <div className="text-center py-12">
            <GlobeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Zatím nejsou přidány žádné weby</p>
            {canManage && (
              <button
                onClick={() => setShowAddWebsite(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Přidat první web
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {websites.map((website) => (
              <div
                key={website.id}
                onClick={() => onSelectWebsite(website.id)}
                className={`group p-5 border rounded-xl cursor-pointer transition-all hover:shadow-md ${
                  selectedWebsiteId === website.id
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <GlobeIcon className={`w-5 h-5 ${
                        selectedWebsiteId === website.id ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <h3 className="font-semibold text-gray-900">{website.name}</h3>
                    </div>
                    <a
                      href={website.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm text-blue-600 hover:underline break-all"
                    >
                      {website.url.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                  {canManage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWebsite(website.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                    >
                      <Trash2Icon className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>

                {website.sync_error ? (
                  <div className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
                    <AlertCircleIcon className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{website.sync_error}</p>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">
                    Poslední synchronizace: {formatDate(website.last_sync_at)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
