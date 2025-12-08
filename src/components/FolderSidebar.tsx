import { useState, useEffect } from 'react';
import { FolderIcon, PlusIcon, ChevronRightIcon, ChevronDownIcon, Share2Icon, Edit2Icon, TrashIcon, FolderPlusIcon, UsersIcon, MoreVerticalIcon, GlobeIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Folder, User, FolderShare, Project } from '../types';
import { FolderSettingsModal } from './FolderSettingsModal';
import { FolderSidebarSkeleton } from './LoadingSkeleton';
import { useDataCache } from '../contexts/DataCacheContext';

interface FolderSidebarProps {
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  folderType: 'tasks' | 'requests' | 'projects';
  showCompletedProjects?: boolean;
  onToggleCompletedProjects?: (show: boolean) => void;
}

export function FolderSidebar({ selectedFolderId, onSelectFolder, folderType, showCompletedProjects, onToggleCompletedProjects }: FolderSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [globalFolders, setGlobalFolders] = useState<Folder[]>([]);
  const [sharedFolders, setSharedFolders] = useState<Folder[]>([]);
  const [myFolders, setMyFolders] = useState<Folder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['global', 'shared', 'my']));
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingSubfolderFor, setCreatingSubfolderFor] = useState<string | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const [settingsFolderId, setSettingsFolderId] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState<'general' | 'sharing'>('general');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [allTasksCount, setAllTasksCount] = useState(0);
  const [folderShares, setFolderShares] = useState<Record<string, number>>({});
  const [openMenuFolderId, setOpenMenuFolderId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { loadFolders: loadCachedFolders, invalidateFolders, isLoading: cacheLoading } = useDataCache();

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadData();
    }
  }, [folderType, currentUserId, showCompletedProjects]);

  useEffect(() => {
    if (!currentUserId || folderType === 'projects') return;

    // Subscribe to realtime changes in tasks table
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        () => {
          // Reload folders to update counts
          loadFolders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, folderType]);

  async function loadData() {
    setLoading(true);
    if (folderType === 'projects') {
      await loadProjects();
    } else {
      await Promise.all([
        loadFolders(),
        loadFolderShares()
      ]);
    }
    setLoading(false);
  }

  async function loadProjects() {
    const statusFilter = showCompletedProjects ? 'dokončen' : 'aktivní';

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('status', statusFilter)
      .order('name');

    if (error) {
      console.error('Error loading projects:', error);
      return;
    }

    setProjects(data || []);
  }

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  }

  async function loadFolders() {
    if (!currentUserId) return;

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
            is_global: false,
            created_at: '',
            parent_id: null,
            color: status.color,
            item_count: count || 0,
          };
        })
      );

      setMyFolders(foldersWithCounts);
      setGlobalFolders([]);
      setSharedFolders([]);
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

      const allFolders = data || [];

      const global: Folder[] = [];
      const shared: Folder[] = [];
      const my: Folder[] = [];

      // Helper funkce pro kontrolu, zda je složka v globální hierarchii
      const isInGlobalHierarchy = (folder: Folder): boolean => {
        if (folder.is_global) return true;
        if (!folder.parent_id) return false;

        const parent = allFolders.find(f => f.id === folder.parent_id);
        if (!parent) return false;

        return isInGlobalHierarchy(parent);
      };

      const getFolderTaskCount = async (folderId: string, folderName: string, includeCompleted: boolean): Promise<number> => {
        const childFolderIds = allFolders.filter(f => f.parent_id === folderId).map(f => f.id);

        let query = supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .is('parent_task_id', null);

        // Special handling for "Nepřiřazené" folder - show tasks with no folder
        if (folderName === 'Nepřiřazené') {
          query = query.is('folder_id', null);
        } else {
          query = query.eq('folder_id', folderId);
        }

        if (!includeCompleted) {
          query = query.neq('status', 'completed');
        }

        const { count } = await query;
        let totalCount = count || 0;

        for (const childId of childFolderIds) {
          const childFolder = allFolders.find(f => f.id === childId);
          if (childFolder) {
            totalCount += await getFolderTaskCount(childId, childFolder.name, includeCompleted);
          }
        }

        return totalCount;
      };

      // Načíst seznam skutečně sdílených složek
      const { data: sharedFolderData } = await supabase
        .from('folder_shares')
        .select('folder_id')
        .or(`user_id.eq.${currentUserId},group_id.in.(SELECT group_id FROM user_group_members WHERE user_id = '${currentUserId}')`);

      const sharedFolderIds = new Set((sharedFolderData || []).map(s => s.folder_id));

      for (const folder of allFolders) {
        const includeCompleted = folder.name === 'Dokončené';
        const itemCount = await getFolderTaskCount(folder.id, folder.name, includeCompleted);
        const folderWithCount = { ...folder, item_count: itemCount };

        // Složky v globální hierarchii jdou do "global" kategorie
        if (folder.is_global || isInGlobalHierarchy(folder)) {
          global.push(folderWithCount);
        } else if (folder.owner_id === currentUserId) {
          // Moje vlastní složky
          my.push(folderWithCount);
        } else if (sharedFolderIds.has(folder.id)) {
          // Složky, které mi byly explicitně sdíleny
          shared.push(folderWithCount);
        }
        // Ignorovat všechny ostatní složky (cizí nessdílené)
      }

      setGlobalFolders(global);
      setSharedFolders(shared);
      setMyFolders(my);

      // Spočítat všechny úkoly, které jsou přiřazeny nebo vytvořeny uživatelem
      const { count: allCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .or(`assigned_to.eq.${currentUserId},created_by.eq.${currentUserId}`)
        .neq('status', 'completed')
        .is('parent_task_id', null);
      setAllTasksCount(allCount || 0);
    }
  }

  async function createFolder() {
    if (!newFolderName.trim() || !currentUserId) return;

    const { error } = await supabase
      .from('folders')
      .insert({
        name: newFolderName,
        owner_id: currentUserId,
        position: myFolders.length,
        folder_type: folderType,
        is_global: false,
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
    if (!newSubfolderName.trim() || !currentUserId) return;

    const allFolders = [...globalFolders, ...sharedFolders, ...myFolders];
    const siblingFolders = allFolders.filter(f => f.parent_id === parentId);

    const { error } = await supabase
      .from('folders')
      .insert({
        name: newSubfolderName,
        owner_id: currentUserId,
        parent_id: parentId,
        position: siblingFolders.length,
        folder_type: folderType,
        is_global: false,
      });

    if (error) {
      console.error('Error creating subfolder:', error);
      alert('Chyba při vytváření pod-složky: ' + error.message);
      return;
    }

    setNewSubfolderName('');
    setCreatingSubfolderFor(null);

    const newExpanded = new Set(expandedFolders);
    newExpanded.add(parentId);
    setExpandedFolders(newExpanded);

    loadFolders();
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

  function toggleFolder(folderId: string) {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  }

  function toggleCategory(category: string) {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
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
    const allFolders = [...globalFolders, ...sharedFolders, ...myFolders];
    const hasChildren = allFolders.some(f => f.parent_id === folder.id);
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const canEdit = folder.owner_id === currentUserId || folder.is_global;

    return (
      <div key={folder.id}>
        <div
          className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-gray-100 transition-colors relative ${
            isSelected ? 'bg-blue-50' : ''
          } ${level > 0 ? 'bg-gray-50/50' : ''}`}
          style={{ paddingLeft: `${8 + level * 24}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleFolder(folder.id);
            }
            onSelectFolder(folder.id);
          }}
        >
          {isSelected && (
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
          )}
          {level > 0 && (
            <div
              className="absolute left-0 top-0 bottom-0 w-px bg-gray-300"
              style={{ left: `${8 + (level - 1) * 24 + 12}px` }}
            />
          )}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folder.id);
              }}
              className="p-0.5 hover:bg-gray-200 rounded flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-3.5 h-3.5 text-gray-600" />
              ) : (
                <ChevronRightIcon className="w-3.5 h-3.5 text-gray-600" />
              )}
            </button>
          ) : (
            <div className="w-4 flex-shrink-0"></div>
          )}
          <FolderIcon className="w-4 h-4 flex-shrink-0" style={{ color: folder.color }} />
          {folder.is_global && (
            <GlobeIcon className="w-3 h-3 text-blue-500 flex-shrink-0" />
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
              className="flex-1 text-sm px-2 py-1 border border-blue-500 rounded focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className={`${level > 0 ? 'text-xs' : 'text-[13px]'} text-gray-700 break-words font-medium`} style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{folder.name}</span>
                {folderShares[folder.id] > 0 && (
                  <div className="flex items-center gap-0.5 px-1 py-0.5 bg-blue-50 rounded flex-shrink-0" title={`Sdíleno ${folderShares[folder.id]}× (uživatelům/skupinám)`}>
                    <UsersIcon className="w-2.5 h-2.5 text-blue-600" />
                    <span className="text-[10px] text-blue-600 font-medium">{folderShares[folder.id]}</span>
                  </div>
                )}
              </div>
              {folder.item_count !== undefined && (
                <span className={`${level > 0 ? 'text-[10px]' : 'text-xs'} text-gray-500 px-1.5 py-0.5 bg-gray-100 rounded-full flex-shrink-0 font-medium`}>
                  {folder.item_count}
                </span>
              )}
            </div>
          )}
          {folderType === 'tasks' && canEdit && (
            <div className="relative flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuFolderId(openMenuFolderId === folder.id ? null : folder.id);
                }}
                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded transition-opacity"
                title="Nastavení složky"
              >
                <MoreVerticalIcon className="w-4 h-4 text-gray-500" />
              </button>
              {openMenuFolderId === folder.id && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuFolderId(null);
                    }}
                  />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                    {!folder.is_global && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCreatingSubfolderFor(folder.id);
                          setNewSubfolderName('');
                          const newExpanded = new Set(expandedFolders);
                          newExpanded.add(folder.id);
                          setExpandedFolders(newExpanded);
                          setOpenMenuFolderId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                      >
                        <FolderPlusIcon className="w-4 h-4 text-green-600" />
                        Přidat pod-složku
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFolderId(folder.id);
                        setEditingFolderName(folder.name);
                        setOpenMenuFolderId(null);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Edit2Icon className="w-4 h-4 text-gray-600" />
                      Upravit složku
                    </button>
                    {!folder.is_global && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettingsFolderId(folder.id);
                          setSettingsModalTab('sharing');
                          setShowSettingsModal(true);
                          setOpenMenuFolderId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                      >
                        <Share2Icon className="w-4 h-4 text-blue-600" />
                        Sdílet složku
                      </button>
                    )}
                    <div className="border-t border-gray-200 my-1"></div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFolder(folder.id, folder.name);
                        setOpenMenuFolderId(null);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Smazat složku
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {isExpanded && (
          <div>
            {creatingSubfolderFor === folder.id && (
              <div
                className="flex gap-2 py-2 px-2 bg-gray-50"
                style={{ paddingLeft: `${32 + (level + 1) * 24}px` }}
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
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={() => createSubfolder(folder.id)}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  OK
                </button>
                <button
                  onClick={() => {
                    setCreatingSubfolderFor(null);
                    setNewSubfolderName('');
                  }}
                  className="px-1.5 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  ×
                </button>
              </div>
            )}
            {hasChildren && [...globalFolders, ...sharedFolders, ...myFolders]
              .filter(f => f.parent_id === folder.id)
              .map(childFolder => renderFolder(childFolder, level + 1))}
          </div>
        )}
      </div>
    );
  }

  function renderFolderCategory(title: string, folders: Folder[], categoryKey: string, icon: React.ReactNode) {
    if (folders.length === 0) return null;

    const isExpanded = expandedCategories.has(categoryKey);
    const rootFolders = folders.filter(f => !f.parent_id);

    return (
      <div className="border-b border-gray-200">
        <button
          onClick={() => toggleCategory(categoryKey)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
              {folders.length}
            </span>
          </div>
          {isExpanded ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-gray-500" />
          )}
        </button>
        {isExpanded && (
          <div>
            {rootFolders.map(folder => renderFolder(folder))}
          </div>
        )}
      </div>
    );
  }

  const folderTypeLabel = folderType === 'tasks' ? 'Úkoly' : folderType === 'requests' ? 'Poptávky' : 'Projekty';

  if (loading || cacheLoading.folders) {
    return <FolderSidebarSkeleton />;
  }

  return (
    <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen">
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
              {folderType === 'projects' ? 'Seznam projektů' : folderType === 'requests' ? 'Stavy (spravováno v administraci)' : 'Složky'}
            </p>
          </div>
          {folderType === 'tasks' && (
            <button
              onClick={() => setIsCreating(true)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Vytvořit novou složku"
            >
              <PlusIcon className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>
        {folderType === 'projects' && onToggleCompletedProjects && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-3">
            <button
              onClick={() => onToggleCompletedProjects(false)}
              className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                !showCompletedProjects
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Aktivní
            </button>
            <button
              onClick={() => onToggleCompletedProjects(true)}
              className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                showCompletedProjects
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dokončené
            </button>
          </div>
        )}
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
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={createFolder}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              OK
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {folderType === 'projects' ? (
          <div className="py-1">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-100 transition-colors relative ${
                  selectedFolderId === project.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => onSelectFolder(project.id)}
              >
                {selectedFolderId === project.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                )}
                <FolderIcon className={`w-3.5 h-3.5 flex-shrink-0 ${selectedFolderId === project.id ? 'text-blue-600' : 'text-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate ${
                    selectedFolderId === project.id ? 'text-blue-900' : 'text-gray-700'
                  }`}>
                    {project.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors relative ${
                selectedFolderId === null ? 'bg-blue-50' : ''
              }`}
              onClick={() => onSelectFolder(null)}
            >
              {selectedFolderId === null && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
              )}
              <FolderIcon className="w-4 h-4 text-gray-600" />
              <span className="text-[13px] text-gray-700 flex-1">
                {folderType === 'tasks' ? 'Všechny úkoly' : 'Nové poptávky'}
              </span>
              {folderType === 'tasks' && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {allTasksCount}
                </span>
              )}
            </div>

            {folderType === 'tasks' ? (
              <>
                {renderFolderCategory(
                  'Globální složky',
                  globalFolders,
                  'global',
                  <GlobeIcon className="w-4 h-4 text-blue-600" />
                )}
                {renderFolderCategory(
                  'Sdílené složky',
                  sharedFolders,
                  'shared',
                  <Share2Icon className="w-4 h-4 text-green-600" />
                )}
                {renderFolderCategory(
                  'Moje složky',
                  myFolders,
                  'my',
                  <FolderIcon className="w-4 h-4 text-gray-600" />
                )}
              </>
            ) : (
              myFolders.map(folder => renderFolder(folder))
            )}
          </>
        )}
      </div>

      {showSettingsModal && settingsFolderId && (
        <FolderSettingsModal
          folder={[...globalFolders, ...sharedFolders, ...myFolders].find(f => f.id === settingsFolderId)!}
          onClose={() => {
            setShowSettingsModal(false);
            setSettingsFolderId(null);
            setSettingsModalTab('general');
          }}
          onUpdate={() => {
            loadFolders();
            loadFolderShares();
          }}
          initialTab={settingsModalTab}
        />
      )}
    </div>
  );
}
