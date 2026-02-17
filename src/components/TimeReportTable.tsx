import { useMemo, useState } from 'react';
import {
  BriefcaseIcon,
  CheckSquareIcon,
  InboxIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from 'lucide-react';
import type { UnifiedTimeEntry } from './TimeReports';

interface Props {
  entries: UnifiedTimeEntry[];
  groupBy: 'date' | 'user' | 'type';
}

interface EntryGroup {
  key: string;
  label: string;
  entries: UnifiedTimeEntry[];
  totalHours: number;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Ne', 'Po', 'Ut', 'St', 'Ct', 'Pa', 'So'];
  return `${days[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'project': return 'Projekty';
    case 'task': return 'Ukoly';
    case 'request': return 'Poptavky';
    default: return type;
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'project': return BriefcaseIcon;
    case 'task': return CheckSquareIcon;
    case 'request': return InboxIcon;
    default: return CheckSquareIcon;
  }
}

function getTypeBadgeClasses(type: string): string {
  switch (type) {
    case 'project': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'task': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'request': return 'bg-rose-50 text-rose-700 border-rose-200';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

export function TimeReportTable({ entries, groupBy }: Props) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const groups = useMemo<EntryGroup[]>(() => {
    const map = new Map<string, UnifiedTimeEntry[]>();

    for (const entry of entries) {
      let key: string;
      switch (groupBy) {
        case 'date':
          key = entry.date;
          break;
        case 'user':
          key = entry.userId;
          break;
        case 'type':
          key = entry.type;
          break;
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }

    const result: EntryGroup[] = [];
    for (const [key, groupEntries] of map) {
      let label: string;
      switch (groupBy) {
        case 'date':
          label = formatDate(key);
          break;
        case 'user':
          label = groupEntries[0].userName;
          break;
        case 'type':
          label = getTypeLabel(key);
          break;
      }
      result.push({
        key,
        label,
        entries: groupEntries,
        totalHours: groupEntries.reduce((sum, e) => sum + e.hours, 0),
      });
    }

    if (groupBy === 'date') {
      result.sort((a, b) => b.key.localeCompare(a.key));
    } else if (groupBy === 'user') {
      result.sort((a, b) => b.totalHours - a.totalHours);
    } else {
      const order = { project: 0, task: 1, request: 2 };
      result.sort((a, b) => (order[a.key as keyof typeof order] || 0) - (order[b.key as keyof typeof order] || 0));
    }

    return result;
  }, [entries, groupBy]);

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {groups.map(group => {
        const isCollapsed = collapsedGroups.has(group.key);

        return (
          <div key={group.key} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleGroup(group.key)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isCollapsed ? (
                  <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-sm font-semibold text-gray-800">{group.label}</span>
                <span className="text-xs text-gray-400">{group.entries.length} zaznamu</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{group.totalHours.toFixed(1)} h</span>
            </button>

            {!isCollapsed && (
              <div className="border-t border-gray-100">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/50">
                      {groupBy !== 'date' && (
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">
                          Datum
                        </th>
                      )}
                      {groupBy !== 'user' && (
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[140px]">
                          Uzivatel
                        </th>
                      )}
                      {groupBy !== 'type' && (
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">
                          Typ
                        </th>
                      )}
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kontext
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Činnost
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[70px]">
                        Hodiny
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.entries.map(entry => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        showDate={groupBy !== 'date'}
                        showUser={groupBy !== 'user'}
                        showType={groupBy !== 'type'}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EntryRow({
  entry,
  showDate,
  showUser,
  showType,
}: {
  entry: UnifiedTimeEntry;
  showDate: boolean;
  showUser: boolean;
  showType: boolean;
}) {
  const Icon = getTypeIcon(entry.type);
  const badgeClasses = getTypeBadgeClasses(entry.type);

  function getContext(): string {
    const parts: string[] = [];
    if (entry.type === 'project') {
      if (entry.projectName) parts.push(entry.projectName);
      if (entry.phaseName) parts.push(entry.phaseName);
    } else if (entry.type === 'task') {
      if (entry.folderName) parts.push(entry.folderName);
      if (entry.taskTitle) parts.push(entry.taskTitle);
    } else {
      if (entry.requestTitle) parts.push(entry.requestTitle);
    }
    return parts.join(' / ') || '-';
  }

  const d = new Date(entry.date + 'T00:00:00');
  const shortDate = `${d.getDate()}. ${d.getMonth() + 1}.`;

  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      {showDate && (
        <td className="px-4 py-2.5 text-sm text-gray-600 whitespace-nowrap">
          {shortDate}
        </td>
      )}
      {showUser && (
        <td className="px-4 py-2.5">
          <span className="text-sm text-gray-700 truncate block max-w-[140px]">{entry.userName}</span>
        </td>
      )}
      {showType && (
        <td className="px-4 py-2.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${badgeClasses}`}>
            <Icon className="w-3 h-3" />
            {entry.type === 'project' ? 'Projekt' : entry.type === 'task' ? 'Ukol' : 'Poptavka'}
          </span>
        </td>
      )}
      <td className="px-4 py-2.5">
        <ContextCell entry={entry} />
      </td>
      <td className="px-4 py-2.5">
        <span className="text-sm text-gray-600 line-clamp-2">{entry.description || '-'}</span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="text-sm font-semibold text-gray-900">{entry.hours.toFixed(2)}</span>
      </td>
    </tr>
  );
}

function ContextCell({ entry }: { entry: UnifiedTimeEntry }) {
  if (entry.type === 'project') {
    return (
      <div className="flex flex-col">
        {entry.projectName && (
          <span className="text-sm font-medium text-gray-800">{entry.projectName}</span>
        )}
        {entry.phaseName && (
          <span className="text-xs text-gray-500">{entry.phaseName}</span>
        )}
      </div>
    );
  }

  if (entry.type === 'task') {
    return (
      <div className="flex flex-col">
        {entry.taskTitle && (
          <span className="text-sm font-medium text-gray-800 line-clamp-1">{entry.taskTitle}</span>
        )}
        {entry.folderName && (
          <span className="text-xs text-gray-500">{entry.folderName}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {entry.requestTitle && (
        <span className="text-sm font-medium text-gray-800 line-clamp-1">{entry.requestTitle}</span>
      )}
    </div>
  );
}
