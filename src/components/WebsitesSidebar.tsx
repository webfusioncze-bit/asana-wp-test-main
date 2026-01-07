import { GlobeIcon, CalendarIcon } from 'lucide-react';

interface WebsitesSidebarProps {
  selectedView: 'websites' | 'updates';
  onSelectView: (view: 'websites' | 'updates') => void;
}

export function WebsitesSidebar({ selectedView, onSelectView }: WebsitesSidebarProps) {
  return (
    <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Weby
          </h2>

          <div className="space-y-1">
            <button
              onClick={() => onSelectView('websites')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedView === 'websites'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <GlobeIcon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">Weby</span>
            </button>

            <button
              onClick={() => onSelectView('updates')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedView === 'updates'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <CalendarIcon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">Aktualizace</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
