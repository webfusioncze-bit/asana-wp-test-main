import React, { useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';

type DigestType = 'daily' | 'weekly' | 'next-week';

interface EmailDigestPreviewProps {
  userEmail: string;
}

export function EmailDigestPreview({ userEmail }: EmailDigestPreviewProps) {
  const [selectedDigest, setSelectedDigest] = useState<DigestType>('daily');
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const digestTypes = [
    { value: 'daily' as DigestType, label: 'Denní digest (Po-Pá 7:00)', description: 'Úkoly na dnes' },
    { value: 'weekly' as DigestType, label: 'Týdenní přehled (Po 6:00)', description: 'Úkoly na tento týden' },
    { value: 'next-week' as DigestType, label: 'Páteční preview (Pá 14:00)', description: 'Úkoly na příští týden' },
  ];

  const handlePreview = async () => {
    setLoading(true);
    setError(null);

    try {
      const previewUrl = `${supabaseUrl}/functions/v1/preview-task-digest?email=${encodeURIComponent(userEmail)}&digest_type=${selectedDigest}`;

      const response = await fetch(previewUrl, {
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      setPreviewHtml(html);
      setShowPreview(true);
    } catch (err) {
      console.error('Failed to load preview:', err);
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst náhled');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Náhled email notifikací</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Typ digestu
            </label>
            <div className="space-y-2">
              {digestTypes.map((type) => (
                <label key={type.value} className="flex items-start p-3 border border-slate-200 rounded-lg hover:border-teal-500 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="digestType"
                    value={type.value}
                    checked={selectedDigest === type.value}
                    onChange={(e) => setSelectedDigest(e.target.value as DigestType)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{type.label}</div>
                    <div className="text-xs text-slate-500">{type.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handlePreview}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
            {loading ? 'Načítám...' : 'Zobrazit náhled'}
          </button>
        </div>
      </div>

      {showPreview && previewHtml && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-900">Náhled emailu</h4>
            <button
              onClick={() => setShowPreview(false)}
              className="text-slate-500 hover:text-slate-700 text-sm font-medium"
            >
              Zavřít
            </button>
          </div>
          <div className="overflow-auto p-4" style={{ backgroundColor: '#f6f8fa' }}>
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      )}
    </div>
  );
}
