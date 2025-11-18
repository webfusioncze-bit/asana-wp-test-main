import React, { useState } from 'react';
import { Folder, FolderPlus, ChevronRight, ChevronDown } from 'lucide-react';
import { Folder as FolderType, User } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

interface FolderSidebarProps {
  folders: FolderType[];
  selectedFolder: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onRefresh: () => void;
  supabase: SupabaseClient;
  currentUser: User;
}

export const FolderSidebar: React.FC<FolderSidebarProps> = ({
  folders,
  selectedFolder,
  onSelectFolder,
  onRefresh,
  supabase,
  currentUser,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await supabase.from('folders').insert({
        name: newFolderName,
        parent_id: newFolderParent,
        owner_id: currentUser.id,
        position: folders.length,
      });

      setNewFolderName('');
      setNewFolderParent(null);
      setIsCreating(false);
      onRefresh();
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const renderFolder = (folder: FolderType, level: number = 0) => {
    const children = folders.filter(f => f.parent_id === folder.id);
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolder === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={`atm-folder-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
        >
          {children.length > 0 && (
            <button
              className="atm-folder-toggle"
              onClick={() => toggleFolder(folder.id)}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          <button
            className="atm-folder-link"
            onClick={() => onSelectFolder(folder.id)}
          >
            <Folder size={16} style={{ color: folder.color }} />
            <span>{folder.name}</span>
          </button>
        </div>
        {isExpanded && children.map(child => renderFolder(child, level + 1))}
      </div>
    );
  };

  const rootFolders = folders.filter(f => !f.parent_id);

  return (
    <div className="atm-folder-sidebar">
      <div className="atm-folder-header">
        <h2>Složky</h2>
        <button
          className="atm-icon-button"
          onClick={() => setIsCreating(!isCreating)}
          title="Nová složka"
        >
          <FolderPlus size={18} />
        </button>
      </div>

      {isCreating && (
        <div className="atm-folder-create">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Název složky"
            autoFocus
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') setIsCreating(false);
            }}
          />
          <button onClick={handleCreateFolder}>Vytvořit</button>
          <button onClick={() => setIsCreating(false)}>Zrušit</button>
        </div>
      )}

      <div className="atm-folder-list">
        <div
          className={`atm-folder-item ${selectedFolder === null ? 'selected' : ''}`}
          style={{ paddingLeft: '12px' }}
        >
          <button
            className="atm-folder-link"
            onClick={() => onSelectFolder(null)}
          >
            <List size={16} />
            <span>Všechny úkoly</span>
          </button>
        </div>

        {rootFolders.map(folder => renderFolder(folder))}
      </div>
    </div>
  );
};
