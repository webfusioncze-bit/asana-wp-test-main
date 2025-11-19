import { useState, useEffect } from 'react';
import { FolderIcon, PlusIcon, ChevronRightIcon, ChevronDownIcon, Share2Icon, Edit2Icon, TrashIcon, FolderPlusIcon, UsersIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Folder, User, FolderShare } from '../types';
import { FolderSharingManager } from './FolderSharingManager';

interface FolderSidebarProps {
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  folderType: 'tasks' | 'requests';
}

export function FolderSidebar({ selectedFolderId, onSelectFolder, folderType }: FolderSidebarProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingSubfolderFor, setCreatingSubfolderFor] = useState<string | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const [sharingFolderId, setSharingFolderId] = useState<string | null>(null);
  const [showSharingManager, setShowSharingManager] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [allTasksCount, setAllTasksCount] = useState(0);
  const [folderShares, setFolderShares] = useState<Record<string, number>>({});

  useEffect(() => {
    loadFolders();
    loadUsers();
    loadFolderShares();
  }, [folderType]);

  async function loadFolders() {
    if (folderType === 'requests') {
      const { data, error } = await supabase
        .from('request_statuses')
        .select('id, name, color, position')
        .order('position', { ascending: true });

      if (error) {
        console.error('Error loading request statuses:', error);
        return;
      }

      const foldersWithCounts = await Promise.all(
        (data || []).map(async (status) => {
          const { count } = await supabase
            .from('requests')
            .select('*', { count: 'exact', head: true })
            .eq('request_status_id', status.id);

          return {
            id: status.id,
            name: status.name,
            owner_id: '',
            position: status.position,
            folder_type: 'requests' as const,
            created_at: '',
            parent_id: null,
            color: status.color,
            item_count: count || 0,
          };
        })
      );

      setFolders(foldersWithCounts);
    } else {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('folder_type', folderType)
        .order('position', { ascending: true });

      if (error) {
        console.error('Error loading folders:', error);
        return;
      }

      const foldersWithCounts = await Promise.all(
        (data || []).map(async (folder) => {
          let query = supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('folder_id', folder.id)
            .is('parent_task_id', null);

          if (folder.name !== 'Dokončené') {
            query = query.neq('status', 'completed');
          }

          const { count } = await query;

          return {
            ...folder,
            item_count: count || 0,
          };
        })
      );

      setFolders(foldersWithCounts);

      const { count: allCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'completed')
        .is('parent_task_id', null);
      setAllTasksCount(allCount || 0);
    }
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('folders')
      .insert({
        name: newFolderName,
        owner_id: user.id,
        position: folders.length,
        folder_type: folderType,
      });

    if (error) {
      console.error('Error creating folder:', error);
      return;
    }

    setNewFolderName('');
    setIsCreating(false);
    loadFolders();
  }

  async function createSubfolder(parentId: string) {
    if (!newSubfolderName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Počet existujících pod-složek pro určení pozice
    const siblingFolders = folders.filter(f => f.parent_id === parentId);

    const { error } = await supabase
      .from('folders')
      .insert({
        name: newSubfolderName,
        owner_id: user.id,
        parent_id: parentId,
        position: siblingFolders.length,
        folder_type: folderType,
      });

    if (error) {
      console.error('Error creating subfolder:', error);
      alert('Chyba při vytváření pod-složky: ' + error.message);
      return;
    }

    setNewSubfolderName('');
    setCreatingSubfolderFor(null);

    // Automaticky rozbal parent složku
    const newExpanded = new Set(expandedFolders);
    newExpanded.add(parentId);
    setExpandedFolders(newExpanded);

    loadFolders();
  }

  async function loadUsers() {
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, email');

    if (error) {
      console.error('Error loading user profiles:', error);
      return;
    }

    setUsers((profiles || []).map(p => ({ id: p.id, email: p.email || '' })));
  }

  async function loadFolderShares() {
    const { data, error } = await supabase
      .from('folder_shares')
      .select('folder_id');

    if (error) {
      console.error('Error loading folder shares:', error);
      return;
    }

    const shareCounts: Record<string, number> = {};
    (data || []).forEach((share: FolderShare) => {
      shareCounts[share.folder_id] = (shareCounts[share.folder_id] || 0) + 1;
    });

    setFolderShares(shareCounts);
  }

  async function shareFolder() {
    if (!sharingFolderId || !selectedUserId) return;

    const { error } = await supabase
      .from('folder_permissions')
      .insert({
        folder_id: sharingFolderId,
        user_id: selectedUserId,
        permission_type: 'view',
      });

    if (error) {
      console.error('Error sharing folder:', error);
      alert('Chyba při sdílení složky: ' + error.message);
      return;
    }

    setSharingFolderId(null);
    setSelectedUserId('');
    loadFolderShares();
    alert('Složka byla úspěšně sdílena!');
  }

  function toggleFolder(folderId: string) {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  }

  async function updateFolder() {
    if (!editingFolderId || !editingFolderName.trim()) return;

    const { error } = await supabase
      .from('folders')
      .update({ name: editingFolderName })
      .eq('id', editingFolderId);

    if (error) {
      console.error('Error updating folder:', error);
      alert('Chyba při úpravě složky');
      return;
    }

    setEditingFolderId(null);
    setEditingFolderName('');
    loadFolders();
  }

  async function deleteFolder(folderId: string, folderName: string) {
    if (!confirm(`Opravdu chcete smazat složku "${folderName}"? Tasky v této složce zůstanou zachovány.`)) {
      return;
    }

    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId);

    if (error) {
      console.error('Error deleting folder:', error);
      alert('Chyba při mazání složky');
      return;
    }

    if (selectedFolderId === folderId) {
      onSelectFolder(null);
    }
    loadFolders();
  }

  function renderFolder(folder: Folder, level: number = 0) {
    const hasChildren = folders.some(f => f.parent_id === folder.id);
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={`group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors ${
            isSelected ? 'bg-primary/5 border-l-4 border-primary' : ''
          }`}
          style={{ paddingLeft: `${12 + level * 20}px` }}
          onClick={() => onSelectFolder(folder.id)}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder.id);
              }}
              className="p-0.5 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronRightIcon className="w-4 h-4 text-gray-600" />
              )}
            </button>
          )}
          {folderType === 'requests' && folder.color && (
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: folder.color }} />
          )}
          {folderType === 'tasks' && (
            <FolderIcon className="w-4 h-4" style={{ color: folder.color }} />
          )}
          {editingFolderId === folder.id ? (
            <input
              type="text"
              value={editingFolderName}
              onChange={(e) => setEditingFolderName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') updateFolder();
                if (e.key === 'Escape') {
                  setEditingFolderId(null);
                  setEditingFolderName('');
                }
              }}
              onBlur={updateFolder}
              autoFocus
              className="flex-1 text-sm px-2 py-1 border border-primary rounded focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm text-gray-700">{folder.name}</span>
                {folderShares[folder.id] > 0 && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 rounded" title={`Sdíleno ${folderShares[folder.id]}× (uživatelům/skupinám)`}>
                    <UsersIcon className="w-3 h-3 text-blue-600" />
                    <span className="text-xs text-blue-600 font-medium">{folderShares[folder.id]}</span>
                  </div>
                )}
              </div>
              {folder.item_count !== undefined && (
                <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded-full">
                  {folder.item_count}
                </span>
              )}
            </div>
          )}
          {folderType === 'tasks' && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCreatingSubfolderFor(folder.id);
                  setNewSubfolderName('');
                  // Automaticky rozbal složku
                  const newExpanded = new Set(expandedFolders);
                  newExpanded.add(folder.id);
                  setExpandedFolders(newExpanded);
                }}
                className="p-1 hover:bg-green-100 rounded"
                title="Přidat pod-složku"
              >
                <FolderPlusIcon className="w-3 h-3 text-green-600" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingFolderId(folder.id);
                  setEditingFolderName(folder.name);
                }}
                className="p-1 hover:bg-gray-200 rounded"
                title="Upravit složku"
              >
                <Edit2Icon className="w-3 h-3 text-gray-500" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSharingFolderId(folder.id);
                  setShowSharingManager(true);
                }}
                className="p-1 hover:bg-gray-200 rounded"
                title="Sdílet složku"
              >
                <Share2Icon className="w-3 h-3 text-gray-500" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFolder(folder.id, folder.name);
                }}
                className="p-1 hover:bg-red-100 rounded"
                title="Smazat složku"
              >
                <TrashIcon className="w-3 h-3 text-red-500" />
              </button>
            </div>
          )}
        </div>
        {isExpanded && (
          <div>
            {creatingSubfolderFor === folder.id && (
              <div
                className="flex gap-2 py-2 px-3"
                style={{ paddingLeft: `${32 + (level + 1) * 20}px` }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={newSubfolderName}
                  onChange={(e) => setNewSubfolderName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') createSubfolder(folder.id);
                    if (e.key === 'Escape') {
                      setCreatingSubfolderFor(null);
                      setNewSubfolderName('');
                    }
                  }}
                  placeholder="Název pod-složky"
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <button
                  onClick={() => createSubfolder(folder.id)}
                  className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                >
                  OK
                </button>
                <button
                  onClick={() => {
                    setCreatingSubfolderFor(null);
                    setNewSubfolderName('');
                  }}
                  className="px-2 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  ×
                </button>
              </div>
            )}
            {hasChildren && folders
              .filter(f => f.parent_id === folder.id)
              .map(childFolder => renderFolder(childFolder, level + 1))}
          </div>
        )}
      </div>
    );
  }

  const rootFolders = folders.filter(f => !f.parent_id);

  const folderTypeLabel = folderType === 'tasks' ? 'Úkoly' : 'Poptávky';

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen">
      <div className="p-4 border-b border-gray-200">
        <div className="mb-6">
          <img
            src="https://webfusion.io/wp-content/uploads/2021/02/webfusion-logo-white-com.png"
            alt="WebFusion"
            className="h-8 w-auto bg-dark px-3 py-1.5 rounded"
          />
        </div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{folderTypeLabel}</h2>
            <p className="text-xs text-gray-500">
              {folderType === 'requests' ? 'Stavy (spravováno v administraci)' : 'Složky'}
            </p>
          </div>
          {folderType === 'tasks' && (
            <button
              onClick={() => setIsCreating(true)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <PlusIcon className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>
        {isCreating && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createFolder();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewFolderName('');
                }
              }}
              placeholder="Název složky"
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <button
              onClick={createFolder}
              className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark transition-colors"
            >
              OK
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors ${
            selectedFolderId === null ? 'bg-primary/5 border-l-4 border-primary' : ''
          }`}
          onClick={() => onSelectFolder(null)}
        >
          <FolderIcon className="w-4 h-4 text-gray-600" />
          <span className="text-sm text-gray-700 flex-1">
            {folderType === 'tasks' ? 'Všechny úkoly' : 'Nové poptávky'}
          </span>
          {folderType === 'tasks' && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {allTasksCount}
            </span>
          )}
        </div>
        {rootFolders.map(folder => renderFolder(folder))}
      </div>

      {showSharingManager && sharingFolderId && (
        <FolderSharingManager
          folderId={sharingFolderId}
          onClose={() => {
            setShowSharingManager(false);
            setSharingFolderId(null);
            loadFolderShares();
          }}
        />
      )}
    </div>
  );
}
