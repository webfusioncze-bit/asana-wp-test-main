import { useState, useEffect, useMemo } from 'react';
import {
  FilterIcon,
  DownloadIcon,
  SearchIcon,
  XIcon,
  GlobeIcon,
  ServerIcon,
  PackageIcon,
  LayoutGridIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2Icon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WebsiteFilterEntry {
  id: string;
  name: string;
  url: string;
  client_name: string | null;
  wordpress_version: string | null;
  php_version: string | null;
  theme_name: string | null;
  theme_version: string | null;
  active_plugins: string[];
  inactive_plugins: string[];
  update_plugins: string[];
  is_available: boolean | null;
}

interface Filters {
  wpVersion: string;
  phpVersion: string;
  theme: string;
  plugin: string;
  pluginType: 'active' | 'inactive' | 'needs_update' | 'any';
  searchName: string;
}

function normalizePlugins(plugins: any[]): string[] {
  if (!Array.isArray(plugins)) return [];
  return plugins
    .map(p => {
      if (typeof p === 'string') return p;
      if (typeof p === 'object' && p !== null) return p.name || null;
      return null;
    })
    .filter((n): n is string => !!n && n.trim() !== '');
}

export function WebsiteFilter() {
  const [websites, setWebsites] = useState<WebsiteFilterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    wpVersion: '',
    phpVersion: '',
    theme: '',
    plugin: '',
    pluginType: 'any',
    searchName: '',
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadWebsites();
  }, []);

  async function loadWebsites() {
    setLoading(true);

    const { data: websitesData } = await supabase
      .from('websites')
      .select('id, name, url')
      .order('name');

    if (!websitesData) {
      setLoading(false);
      return;
    }

    const websiteIds = websitesData.map(w => w.id);

    const [statusData, viewData] = await Promise.all([
      supabase
        .from('website_status')
        .select('website_id, wordpress_version, php_version, theme_name, theme_version, raw_data, created_at')
        .in('website_id', websiteIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('websites_with_status')
        .select('id, is_available, client_name')
        .in('id', websiteIds),
    ]);

    const latestStatusMap = new Map<string, any>();
    for (const row of statusData.data || []) {
      if (!latestStatusMap.has(row.website_id)) {
        latestStatusMap.set(row.website_id, row);
      }
    }

    const availabilityMap = new Map<string, { is_available: boolean | null; client_name: string | null }>();
    for (const row of viewData.data || []) {
      availabilityMap.set(row.id, { is_available: row.is_available, client_name: row.client_name });
    }

    const entries: WebsiteFilterEntry[] = websitesData.map(w => {
      const status = latestStatusMap.get(w.id);
      const avail = availabilityMap.get(w.id);
      const rawData = status?.raw_data || {};
      return {
        id: w.id,
        name: w.name,
        url: w.url,
        client_name: avail?.client_name || null,
        is_available: avail?.is_available ?? null,
        wordpress_version: status?.wordpress_version || null,
        php_version: status?.php_version || null,
        theme_name: status?.theme_name || null,
        theme_version: status?.theme_version || null,
        active_plugins: normalizePlugins(rawData.active_plugins || []),
        inactive_plugins: normalizePlugins(rawData.inactive_plugins || []),
        update_plugins: normalizePlugins(rawData.update_plugins || []),
      };
    });

    setWebsites(entries);
    setLoading(false);
  }

  const allWpVersions = useMemo(() => {
    const s = new Set<string>();
    for (const w of websites) if (w.wordpress_version) s.add(w.wordpress_version);
    return Array.from(s).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [websites]);

  const allPhpVersions = useMemo(() => {
    const s = new Set<string>();
    for (const w of websites) if (w.php_version) s.add(w.php_version);
    return Array.from(s).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [websites]);

  const allThemes = useMemo(() => {
    const s = new Set<string>();
    for (const w of websites) if (w.theme_name) s.add(w.theme_name);
    return Array.from(s).sort();
  }, [websites]);

  const allPlugins = useMemo(() => {
    const s = new Set<string>();
    for (const w of websites) {
      for (const p of w.active_plugins) s.add(p);
      for (const p of w.inactive_plugins) s.add(p);
    }
    return Array.from(s).sort();
  }, [websites]);

  const filteredWebsites = useMemo(() => {
    return websites.filter(w => {
      if (filters.searchName) {
        const q = filters.searchName.toLowerCase();
        if (!w.name.toLowerCase().includes(q) && !(w.url || '').toLowerCase().includes(q)) return false;
      }
      if (filters.wpVersion && w.wordpress_version !== filters.wpVersion) return false;
      if (filters.phpVersion && w.php_version !== filters.phpVersion) return false;
      if (filters.theme && w.theme_name !== filters.theme) return false;
      if (filters.plugin) {
        const query = filters.plugin.toLowerCase();
        const checkList = (list: string[]) => list.some(p => p.toLowerCase().includes(query));
        if (filters.pluginType === 'active') return checkList(w.active_plugins);
        if (filters.pluginType === 'inactive') return checkList(w.inactive_plugins);
        if (filters.pluginType === 'needs_update') return checkList(w.update_plugins);
        return checkList(w.active_plugins) || checkList(w.inactive_plugins);
      }
      return true;
    });
  }, [websites, filters]);

  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (filters.wpVersion) c++;
    if (filters.phpVersion) c++;
    if (filters.theme) c++;
    if (filters.plugin) c++;
    if (filters.searchName) c++;
    return c;
  }, [filters]);

  function clearAllFilters() {
    setFilters({ wpVersion: '', phpVersion: '', theme: '', plugin: '', pluginType: 'any', searchName: '' });
  }

  function toggleRow(id: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCSV() {
    const headers = ['Název', 'URL', 'Klient', 'WordPress', 'PHP', 'Motiv', 'Verze motivu', 'Aktivní pluginy', 'Neaktivní pluginy', 'Potřebují aktualizaci', 'Dostupnost'];
    const rows = filteredWebsites.map(w => [
      w.name,
      w.url,
      w.client_name || '',
      w.wordpress_version || '',
      w.php_version || '',
      w.theme_name || '',
      w.theme_version || '',
      w.active_plugins.join('; '),
      w.inactive_plugins.join('; '),
      w.update_plugins.join('; '),
      w.is_available === true ? 'Online' : w.is_available === false ? 'Offline' : 'Neznámé',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filtrace-webu.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2Icon className="w-6 h-6 text-blue-600 animate-spin" />
        <span className="ml-3 text-sm text-gray-500">Nacitam weby...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FilterIcon className="w-5 h-5 text-gray-500" />
            <h1 className="text-lg font-semibold text-gray-900">Filtrace webů</h1>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
              {filteredWebsites.length} / {websites.length}
            </span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                {activeFiltersCount} filtr{activeFiltersCount > 1 ? 'y' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 border border-gray-200 rounded-lg hover:border-red-300 transition-colors"
              >
                <XIcon className="w-3.5 h-3.5" />
                Zrusit filtry
              </button>
            )}
            <button
              onClick={exportCSV}
              disabled={filteredWebsites.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DownloadIcon className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Hledat web..."
              value={filters.searchName}
              onChange={e => setFilters(f => ({ ...f, searchName: e.target.value }))}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="relative">
            <ServerIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <select
              value={filters.wpVersion}
              onChange={e => setFilters(f => ({ ...f, wpVersion: e.target.value }))}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
            >
              <option value="">WordPress verze</option>
              {allWpVersions.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <ServerIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <select
              value={filters.phpVersion}
              onChange={e => setFilters(f => ({ ...f, phpVersion: e.target.value }))}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
            >
              <option value="">PHP verze</option>
              {allPhpVersions.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <LayoutGridIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <select
              value={filters.theme}
              onChange={e => setFilters(f => ({ ...f, theme: e.target.value }))}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
            >
              <option value="">Šablona</option>
              {allThemes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-1.5 col-span-2 lg:col-span-1">
            <div className="relative flex-1">
              <PackageIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                list="plugin-suggestions"
                placeholder="Plugin..."
                value={filters.plugin}
                onChange={e => setFilters(f => ({ ...f, plugin: e.target.value }))}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <datalist id="plugin-suggestions">
                {allPlugins.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <select
              value={filters.pluginType}
              onChange={e => setFilters(f => ({ ...f, pluginType: e.target.value as Filters['pluginType'] }))}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              title="Typ pluginu"
            >
              <option value="any">Vše</option>
              <option value="active">Aktivní</option>
              <option value="inactive">Neaktivní</option>
              <option value="needs_update">K aktualizaci</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredWebsites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FilterIcon className="w-12 h-12 mb-3" />
            <p className="text-sm">Zadne weby neodpovidaji filtrum</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredWebsites.map(w => {
              const isExpanded = expandedRows.has(w.id);
              return (
                <div key={w.id} className="bg-white">
                  <div
                    className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => toggleRow(w.id)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        w.is_available === true ? 'bg-green-500' :
                        w.is_available === false ? 'bg-red-500' : 'bg-gray-300'
                      }`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{w.name}</p>
                        {w.client_name && (
                          <p className="text-xs text-gray-500 truncate">{w.client_name}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      {w.wordpress_version && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <ServerIcon className="w-3 h-3 text-gray-400" />
                          <span>WP {w.wordpress_version}</span>
                        </div>
                      )}
                      {w.php_version && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <ServerIcon className="w-3 h-3 text-gray-400" />
                          <span>PHP {w.php_version}</span>
                        </div>
                      )}
                      {w.theme_name && (
                        <div className="flex items-center gap-1 text-xs text-gray-600 max-w-[140px]">
                          <LayoutGridIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{w.theme_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <PackageIcon className="w-3 h-3" />
                        <span>{w.active_plugins.length}</span>
                      </div>
                      {w.update_plugins.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                          {w.update_plugins.length} aktualizaci
                        </span>
                      )}
                      <GlobeIcon className="w-3.5 h-3.5 text-gray-400" />
                    </div>

                    {isExpanded
                      ? <ChevronUpIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      : <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    }
                  </div>

                  {isExpanded && (
                    <div className="px-6 pb-4 bg-gray-50 border-t border-gray-100">
                      <div className="pt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <PackageIcon className="w-3.5 h-3.5" />
                            Aktivni pluginy ({w.active_plugins.length})
                          </p>
                          {w.active_plugins.length > 0 ? (
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {w.active_plugins.map((p, i) => (
                                <div key={i} className={`text-xs px-2 py-1 rounded flex items-center gap-1.5 ${
                                  w.update_plugins.some(u => u.toLowerCase().includes(p.toLowerCase().substring(0, 15)))
                                    ? 'bg-orange-50 text-orange-800'
                                    : 'bg-white text-gray-700'
                                }`}>
                                  {w.update_plugins.some(u => u.toLowerCase().includes(p.toLowerCase().substring(0, 15))) && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                                  )}
                                  {p}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">Zadne pluginy</p>
                          )}
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <PackageIcon className="w-3.5 h-3.5" />
                            Neaktivni pluginy ({w.inactive_plugins.length})
                          </p>
                          {w.inactive_plugins.length > 0 ? (
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {w.inactive_plugins.map((p, i) => (
                                <div key={i} className="text-xs px-2 py-1 rounded bg-white text-gray-500">
                                  {p}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">Zadne neaktivni pluginy</p>
                          )}
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <LayoutGridIcon className="w-3.5 h-3.5" />
                            Informace
                          </p>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500">URL</span>
                              <a href={w.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[160px]" onClick={e => e.stopPropagation()}>
                                {w.url.replace(/^https?:\/\//, '')}
                              </a>
                            </div>
                            {w.theme_name && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">Sablon</span>
                                <span className="font-medium text-gray-800">{w.theme_name} {w.theme_version && `(${w.theme_version})`}</span>
                              </div>
                            )}
                            {w.wordpress_version && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">WordPress</span>
                                <span className="font-medium text-gray-800">{w.wordpress_version}</span>
                              </div>
                            )}
                            {w.php_version && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">PHP</span>
                                <span className="font-medium text-gray-800">{w.php_version}</span>
                              </div>
                            )}
                            {w.update_plugins.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-semibold text-orange-600 mb-1">K aktualizaci:</p>
                                {w.update_plugins.map((p, i) => (
                                  <div key={i} className="text-xs text-orange-700 bg-orange-50 px-2 py-0.5 rounded mb-0.5">{p}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
