import { useState, useEffect } from 'react';
import { CalendarIcon, ChevronDownIcon, BarChart3Icon, CheckCircleIcon, XCircleIcon, MinusCircleIcon, BanIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RequestType {
  id: string;
  name: string;
  color: string;
}

interface StatItem {
  label: string;
  count: number;
  color: string;
  icon?: React.ReactNode;
}

type PeriodType = 'week' | 'month' | 'year' | 'custom';

const OUTCOME_STATUS_NAMES = {
  accepted: ['Realizace', 'Vývoj interní', 'Vývoj externí', 'Marketing interní', 'Marketing externí'],
  rejected: ['Odmítnuto'],
  uninteresting: ['Nezajímavé'],
  nonTradeable: ['Neobchodovatelné'],
};

export function RequestStatistics() {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [categoryStats, setCategoryStats] = useState<StatItem[]>([]);
  const [outcomeStats, setOutcomeStats] = useState<{
    accepted: number;
    rejected: number;
    uninteresting: number;
    nonTradeable: number;
  }>({ accepted: 0, rejected: 0, uninteresting: 0, nonTradeable: 0 });
  const [totalRequests, setTotalRequests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, [period, customDateFrom, customDateTo]);

  function getDateRange(): { from: Date; to: Date } {
    const now = new Date();
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let from: Date;

    switch (period) {
      case 'week':
        from = new Date(now);
        from.setDate(from.getDate() - 7);
        break;
      case 'month':
        from = new Date(now);
        from.setMonth(from.getMonth() - 1);
        break;
      case 'year':
        from = new Date(now);
        from.setFullYear(from.getFullYear() - 1);
        break;
      case 'custom':
        from = customDateFrom ? new Date(customDateFrom) : new Date(now.getFullYear(), 0, 1);
        if (customDateTo) {
          return { from, to: new Date(customDateTo + 'T23:59:59') };
        }
        break;
      default:
        from = new Date(now);
        from.setMonth(from.getMonth() - 1);
    }

    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  async function loadStatistics() {
    setLoading(true);
    const { from, to } = getDateRange();

    const [typesResult, statusesResult, requestsResult] = await Promise.all([
      supabase.from('request_types').select('id, name, color'),
      supabase.from('request_statuses').select('id, name, color'),
      supabase
        .from('requests')
        .select('id, request_type_id, request_status_id, created_at')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString()),
    ]);

    const types = (typesResult.data || []) as RequestType[];
    const statuses = statusesResult.data || [];
    const requests = requestsResult.data || [];

    setTotalRequests(requests.length);

    const typeCounts: Record<string, number> = {};
    types.forEach(t => { typeCounts[t.id] = 0; });
    let noTypeCount = 0;

    requests.forEach(req => {
      if (req.request_type_id && typeCounts[req.request_type_id] !== undefined) {
        typeCounts[req.request_type_id]++;
      } else {
        noTypeCount++;
      }
    });

    const categoryItems: StatItem[] = types
      .map(type => ({
        label: type.name,
        count: typeCounts[type.id] || 0,
        color: type.color,
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);

    if (noTypeCount > 0) {
      categoryItems.push({
        label: 'Bez typu',
        count: noTypeCount,
        color: '#9CA3AF',
      });
    }

    setCategoryStats(categoryItems);

    const statusNameToId: Record<string, string> = {};
    statuses.forEach(s => { statusNameToId[s.name] = s.id; });

    const outcomes = { accepted: 0, rejected: 0, uninteresting: 0, nonTradeable: 0 };

    requests.forEach(req => {
      if (!req.request_status_id) return;

      const status = statuses.find(s => s.id === req.request_status_id);
      if (!status) return;

      if (OUTCOME_STATUS_NAMES.accepted.includes(status.name)) {
        outcomes.accepted++;
      } else if (OUTCOME_STATUS_NAMES.rejected.includes(status.name)) {
        outcomes.rejected++;
      } else if (OUTCOME_STATUS_NAMES.uninteresting.includes(status.name)) {
        outcomes.uninteresting++;
      } else if (OUTCOME_STATUS_NAMES.nonTradeable.includes(status.name)) {
        outcomes.nonTradeable++;
      }
    });

    setOutcomeStats(outcomes);
    setLoading(false);
  }

  const periodLabels: Record<PeriodType, string> = {
    week: 'Týden',
    month: 'Měsíc',
    year: 'Rok',
    custom: 'Vlastní',
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3Icon className="w-4 h-4 text-gray-600" />
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Statistiky</span>
        </div>
        <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? '' : '-rotate-90'}`} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          <div className="flex gap-1 bg-white rounded-lg p-0.5 border border-gray-200">
            {(['week', 'month', 'year', 'custom'] as PeriodType[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriod(p);
                  if (p === 'custom') {
                    setShowCustomDates(true);
                  } else {
                    setShowCustomDates(false);
                  }
                }}
                className={`flex-1 px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${
                  period === p
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {showCustomDates && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 mb-0.5">Od</label>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 mb-0.5">Do</label>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-4 text-center">
              <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full mx-auto"></div>
            </div>
          ) : (
            <>
              <div className="text-center py-2 bg-white rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-gray-900">{totalRequests}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Celkem poptávek</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-[10px] font-medium text-green-800">Přijaté</span>
                  </div>
                  <div className="text-xl font-bold text-green-700">{outcomeStats.accepted}</div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <XCircleIcon className="w-3.5 h-3.5 text-red-600" />
                    <span className="text-[10px] font-medium text-red-800">Odmítnuté</span>
                  </div>
                  <div className="text-xl font-bold text-red-700">{outcomeStats.rejected}</div>
                </div>

                <div className="bg-gray-100 border border-gray-200 rounded-lg p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MinusCircleIcon className="w-3.5 h-3.5 text-gray-600" />
                    <span className="text-[10px] font-medium text-gray-700">Nezajímavé</span>
                  </div>
                  <div className="text-xl font-bold text-gray-700">{outcomeStats.uninteresting}</div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BanIcon className="w-3.5 h-3.5 text-orange-600" />
                    <span className="text-[10px] font-medium text-orange-800">Neobchod.</span>
                  </div>
                  <div className="text-xl font-bold text-orange-700">{outcomeStats.nonTradeable}</div>
                </div>
              </div>

              {categoryStats.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-2">
                  <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-2">
                    Podle typu
                  </div>
                  <div className="space-y-1.5">
                    {categoryStats.map((stat, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: stat.color }}
                          />
                          <span className="text-xs text-gray-700">{stat.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-900">{stat.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
