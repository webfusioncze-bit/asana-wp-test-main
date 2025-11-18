import React from 'react';
import { CheckCircle2, Calendar, List, CheckCheck } from 'lucide-react';
import { Folder } from '../types';

interface HeaderProps {
  view: 'today' | 'upcoming' | 'all' | 'completed';
  onViewChange: (view: 'today' | 'upcoming' | 'all' | 'completed') => void;
  selectedFolder: string | null;
  folders: Folder[];
}

export const Header: React.FC<HeaderProps> = ({ view, onViewChange, selectedFolder, folders }) => {
  const getTitle = () => {
    if (selectedFolder) {
      const folder = folders.find(f => f.id === selectedFolder);
      return folder?.name || 'Složka';
    }

    switch (view) {
      case 'today':
        return 'Dnes & Po termínu';
      case 'upcoming':
        return 'Nadcházející';
      case 'completed':
        return 'Dokončené';
      default:
        return 'Všechny úkoly';
    }
  };

  return (
    <div className="atm-header">
      <div className="atm-header-title">
        <h1>{getTitle()}</h1>
      </div>

      {!selectedFolder && (
        <div className="atm-view-tabs">
          <button
            className={`atm-view-tab ${view === 'today' ? 'active' : ''}`}
            onClick={() => onViewChange('today')}
          >
            <Calendar size={16} />
            Dnes
          </button>
          <button
            className={`atm-view-tab ${view === 'upcoming' ? 'active' : ''}`}
            onClick={() => onViewChange('upcoming')}
          >
            <CheckCircle2 size={16} />
            Nadcházející
          </button>
          <button
            className={`atm-view-tab ${view === 'all' ? 'active' : ''}`}
            onClick={() => onViewChange('all')}
          >
            <List size={16} />
            Všechny
          </button>
          <button
            className={`atm-view-tab ${view === 'completed' ? 'active' : ''}`}
            onClick={() => onViewChange('completed')}
          >
            <CheckCheck size={16} />
            Dokončené
          </button>
        </div>
      )}
    </div>
  );
};
