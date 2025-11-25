import { useState } from 'react';
import { DownloadIcon, XIcon, CheckCircleIcon, AlertCircleIcon, LoaderIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProjectImportProps {
  onClose: () => void;
  onImportComplete: () => void;
}

export function ProjectImport({ onClose, onImportComplete }: ProjectImportProps) {
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    projectName?: string;
    stats?: { phases: number; timeEntries: number };
  } | null>(null);

  async function handleImport() {
    if (!url.trim()) {
      alert('Zadejte URL adresu projektu');
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Nejste přihlášeni');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-project`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: 'Import byl úspěšně dokončen!',
          projectName: data.project?.name,
          stats: data.stats,
        });
        setTimeout(() => {
          onImportComplete();
          onClose();
        }, 2000);
      } else {
        setResult({
          success: false,
          message: data.error || 'Import se nezdařil',
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Neočekávaná chyba při importu',
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DownloadIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Import projektu</h2>
              <p className="text-sm text-gray-500">Importujte projekt z WordPress API</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <XIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL WordPress API projektu
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={importing}
              placeholder="https://portal.webfusion.cz/wp-json/wp/v2/projekt/6896"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="mt-2 text-xs text-gray-500">
              Zadejte URL adresu JSON API projektu z WordPressu. Projekt bude importován včetně všech fází, časových záznamů a milestones.
            </p>
          </div>

          {result && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${
              result.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {result.success ? (
                <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${
                  result.success ? 'text-green-900' : 'text-red-900'
                }`}>
                  {result.message}
                </p>
                {result.success && result.projectName && (
                  <div className="mt-2 text-sm text-green-800">
                    <p className="font-semibold">{result.projectName}</p>
                    {result.stats && (
                      <div className="mt-1 text-xs">
                        <span className="inline-block mr-3">
                          Fází: {result.stats.phases}
                        </span>
                        <span className="inline-block">
                          Časových záznamů: {result.stats.timeEntries}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Co bude importováno?</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Základní údaje projektu (název, popis, typ, kategorie, klient, rozpočet, termíny)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Všechny fáze projektu s jejich nastavením</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Časové záznamy pro každou fázi (včetně viditelnosti pro klienta)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Milestones přiřazené k fázím</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Zrušit
          </button>
          <button
            onClick={handleImport}
            disabled={importing || !url.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {importing ? (
              <>
                <LoaderIcon className="w-4 h-4 animate-spin" />
                Importuji...
              </>
            ) : (
              <>
                <DownloadIcon className="w-4 h-4" />
                Importovat projekt
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
