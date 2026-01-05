import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { WebhookIcon, CheckIcon, XIcon, CopyIcon, RefreshCwIcon, TrashIcon, EditIcon } from 'lucide-react';
import type { ZapierSource, ZapierWebhookLog } from '../types';

export function ZapierIntegrationManager() {
  const [sources, setSources] = useState<ZapierSource[]>([]);
  const [logs, setLogs] = useState<ZapierWebhookLog[]>([]);
  const [selectedSource, setSelectedSource] = useState<ZapierSource | null>(null);
  const [isMapping, setIsMapping] = useState(false);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [sourceName, setSourceName] = useState('');
  const [loading, setLoading] = useState(true);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // Available request fields for mapping
  const requestFields = [
    { value: 'title', label: 'Název poptávky' },
    { value: 'description', label: 'Popis' },
    { value: 'client_name', label: 'Jméno klienta' },
    { value: 'client_email', label: 'Email klienta' },
    { value: 'client_phone', label: 'Telefon klienta' },
    { value: 'subpage_count', label: 'Počet podstránek' },
    { value: 'source', label: 'Zdroj' },
    { value: 'storage_url', label: 'URL úložiště' },
    { value: 'current_website_url', label: 'URL současného webu' },
    { value: 'budget', label: 'Rozpočet' },
    { value: 'additional_services', label: 'Další poptávané služby' },
    { value: 'accepted_price', label: 'Akceptovaná cena' },
    { value: 'delivery_speed', label: 'Rychlost dodání' },
    { value: 'ai_usage', label: 'Využití AI' },
    { value: 'project_materials_link', label: 'Podklady k projektu' },
  ];

  useEffect(() => {
    loadSources();
    loadLogs();
  }, []);

  async function loadSources() {
    setLoading(true);
    const { data, error } = await supabase
      .from('zapier_sources')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading sources:', error);
    } else {
      setSources(data || []);
    }
    setLoading(false);
  }

  async function loadLogs() {
    const { data, error } = await supabase
      .from('zapier_webhooks_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading logs:', error);
    } else {
      setLogs(data || []);
    }
  }

  function openMappingModal(source: ZapierSource) {
    setSelectedSource(source);
    setSourceName(source.name);
    setMappings(source.field_mapping || {});
    setIsMapping(true);
  }

  async function saveMappings() {
    if (!selectedSource) return;

    const { error } = await supabase
      .from('zapier_sources')
      .update({
        name: sourceName,
        field_mapping: mappings,
        is_active: true,
      })
      .eq('id', selectedSource.id);

    if (error) {
      alert('Chyba při ukládání mapování: ' + error.message);
      return;
    }

    setIsMapping(false);
    setSelectedSource(null);
    loadSources();
    alert('Mapování bylo úspěšně uloženo!');
  }

  async function deleteSource(id: string) {
    if (!confirm('Opravdu chcete smazat tento webhook?')) return;

    const { error } = await supabase
      .from('zapier_sources')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Chyba při mazání: ' + error.message);
      return;
    }

    loadSources();
  }

  async function toggleActive(source: ZapierSource) {
    const { error } = await supabase
      .from('zapier_sources')
      .update({ is_active: !source.is_active })
      .eq('id', source.id);

    if (error) {
      alert('Chyba při změně stavu: ' + error.message);
      return;
    }

    loadSources();
  }

  function copyWebhookUrl(token: string) {
    const url = `${supabaseUrl}/functions/v1/zapier-webhook?token=${token}`;
    navigator.clipboard.writeText(url);
    alert('URL zkopírována do schránky!');
  }

  function addMapping(webhookField: string) {
    setMappings({ ...mappings, [webhookField]: '' });
  }

  function updateMapping(webhookField: string, requestField: string) {
    setMappings({ ...mappings, [webhookField]: requestField });
  }

  function removeMapping(webhookField: string) {
    const newMappings = { ...mappings };
    delete newMappings[webhookField];
    setMappings(newMappings);
  }

  const getSampleFields = () => {
    if (!selectedSource?.sample_data) return [];
    return Object.keys(selectedSource.sample_data);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Zapier Integrace</h2>
          <p className="text-sm text-gray-600 mt-1">
            Spravujte webhooky pro automatický import poptávek z Zapier
          </p>
        </div>
        <button
          onClick={() => { loadSources(); loadLogs(); }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <RefreshCwIcon className="w-4 h-4" />
          Obnovit
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Načítání...</div>
      ) : sources.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <WebhookIcon className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-center mb-2">Žádné webhook integrace</h3>
          <p className="text-sm text-gray-600 text-center mb-4">
            Pro vytvoření nové integrace pošlete testovací požadavek z Zapier na URL:
          </p>
          <div className="bg-white rounded-lg p-4 font-mono text-sm break-all">
            {supabaseUrl}/functions/v1/zapier-webhook?token=UNIQUE_TOKEN
          </div>
          <p className="text-xs text-gray-500 text-center mt-3">
            Token bude automaticky vygenerován při prvním požadavku
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sources.map((source) => (
            <div
              key={source.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">{source.name}</h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        source.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {source.is_active ? 'Aktivní' : 'Neaktivní'}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded p-2 font-mono text-xs break-all mb-2">
                    {supabaseUrl}/functions/v1/zapier-webhook?token={source.webhook_token}
                  </div>
                  {source.sample_data && (
                    <p className="text-sm text-gray-600">
                      Ukázková data: {Object.keys(source.sample_data).length} polí
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => copyWebhookUrl(source.webhook_token)}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                    title="Kopírovat URL"
                  >
                    <CopyIcon className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => openMappingModal(source)}
                    className="p-2 hover:bg-blue-50 rounded transition-colors"
                    title="Upravit mapování"
                  >
                    <EditIcon className="w-4 h-4 text-blue-600" />
                  </button>
                  <button
                    onClick={() => toggleActive(source)}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                    title={source.is_active ? 'Deaktivovat' : 'Aktivovat'}
                  >
                    {source.is_active ? (
                      <XIcon className="w-4 h-4 text-orange-600" />
                    ) : (
                      <CheckIcon className="w-4 h-4 text-green-600" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteSource(source.id)}
                    className="p-2 hover:bg-red-50 rounded transition-colors"
                    title="Smazat"
                  >
                    <TrashIcon className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>

              {Object.keys(source.field_mapping || {}).length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">Mapování polí:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(source.field_mapping).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-gray-600">{key}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-primary font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mapping Modal */}
      {isMapping && selectedSource && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Mapování polí</h3>
              <p className="text-sm text-gray-600 mt-1">
                Namapujte pole z webhooku na pole poptávky
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Název integrace
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="např. Kontaktní formulář - Homepage"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Dostupná pole poptávky:
                </p>
                <div className="flex flex-wrap gap-2">
                  {requestFields.map((field) => {
                    const isMapped = Object.values(mappings).includes(field.value);
                    return (
                      <div
                        key={field.value}
                        className={`px-3 py-1 rounded-lg text-sm font-medium ${
                          isMapped
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : 'bg-red-100 text-red-800 border border-red-300'
                        }`}
                        title={isMapped ? 'Namapováno' : 'Není namapováno'}
                      >
                        {field.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedSource.sample_data && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Dostupná pole z webhooku:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {getSampleFields().map((field) => (
                      <button
                        key={field}
                        onClick={() => addMapping(field)}
                        disabled={field in mappings}
                        className={`px-3 py-1 rounded-lg text-sm ${
                          field in mappings
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-white border border-gray-300 hover:border-primary hover:bg-primary/5 transition-colors'
                        }`}
                      >
                        {field}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Mapování:</p>
                {Object.entries(mappings).map(([webhookField, requestField]) => (
                  <div key={webhookField} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-1">Pole z webhooku:</p>
                      <p className="font-medium text-gray-800">{webhookField}</p>
                      {selectedSource.sample_data?.[webhookField] && (
                        <p className="text-xs text-gray-500 mt-1">
                          Ukázka: {String(selectedSource.sample_data[webhookField])}
                        </p>
                      )}
                    </div>
                    <span className="text-gray-400">→</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-1">Pole poptávky:</p>
                      <select
                        value={requestField}
                        onChange={(e) => updateMapping(webhookField, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">-- Vyberte pole --</option>
                        {requestFields
                          .filter((field) => {
                            // Show current value or fields that are not yet mapped
                            return field.value === requestField || !Object.values(mappings).includes(field.value);
                          })
                          .map((field) => (
                            <option key={field.value} value={field.value}>
                              {field.label}
                            </option>
                          ))}
                      </select>
                    </div>
                    <button
                      onClick={() => removeMapping(webhookField)}
                      className="p-2 hover:bg-red-50 rounded transition-colors"
                      title="Odstranit mapování"
                    >
                      <TrashIcon className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
                {Object.keys(mappings).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Klikněte na pole výše pro přidání mapování
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setIsMapping(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Zrušit
              </button>
              <button
                onClick={saveMappings}
                disabled={Object.keys(mappings).length === 0}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Uložit mapování
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Logs */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Poslední webhook požadavky</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Zatím žádné záznamy</p>
        ) : (
          <div className="space-y-2">
            {logs.slice(0, 10).map((log) => {
              const source = sources.find((s) => s.id === log.source_id);
              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {source?.name || 'Neznámý zdroj'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString('cs-CZ')}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      log.status === 'success'
                        ? 'bg-green-100 text-green-700'
                        : log.status === 'error'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {log.status === 'success'
                      ? 'Úspěch'
                      : log.status === 'error'
                      ? 'Chyba'
                      : 'Čeká na mapování'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
