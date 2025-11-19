import { useState, useEffect } from 'react';
import { FolderIcon, PlusIcon, UsersIcon, Share2Icon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Folder, User, UserGroup } from '../types';

interface SubfolderGridProps {
  parentFolderId: string | null;
  folders: Folder[];
  onFolderSelect: (folderId: string) => void;
  onFolderCreated: () => void;
}

interface FolderWithSharing extends Folder {
  sharedUsers?: User[];
  sharedGroups?: UserGroup[];
  isShared?: boolean;
}

export function SubfolderGrid({ parentFolderId, folders, onFolderSelect, onFolderCreated }: SubfolderGridProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3b82f6');
  const [foldersWithSharing, setFoldersWithSharing] = useState<FolderWithSharing[]>([]);
  const [loading, setLoading] = useState(false);

  const subfolders = folders.filter(f => f.parent_id === parentFolderId);

  useEffect(() => {
    loadFolderSharingInfo();
  }, [folders, parentFolderId]);

  async function loadFolderSharingInfo() {
    setLoading(true);
    const enrichedFolders: FolderWithSharing[] = [];

    for (const folder of subfolders) {
      const { data: shares } = await supabase
        .from('folder_shares')
        .select('*, user_profiles!shared_with_user_id(id, email), user_groups!shared_with_group_id(*)')
        .eq('folder_id', folder.id);

      const sharedUsers = shares
        ?.filter(s => s.shared_with_user_id)
        .map(s => ({
          id: s.user_profiles?.id || '',
          email: s.user_profiles?.email || ''
        })) || [];

      const sharedGroups = shares
        ?.filter(s => s.shared_with_group_id)
        .map(s => s.user_groups)
        .filter(Boolean) || [];

      enrichedFolders.push({
        ...folder,
        sharedUsers,
        sharedGroups,
        isShared: (sharedUsers.length + sharedGroups.length) > 0
      });
    }

    setFoldersWithSharing(enrichedFolders);
    setLoading(false);
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const maxPosition = Math.max(...subfolders.map(f => f.position), -1);

    const { error } = await supabase.from('folders').insert({
      name: newFolderName,
      parent_id: parentFolderId,
      owner_id: user.id,
      color: newFolderColor,
      position: maxPosition + 1,
      folder_type: 'tasks'
    });

    if (error) {
      console.error('Error creating folder:', error);
      return;
    }

    setNewFolderName('');
    setNewFolderColor('#3b82f6');
    setIsCreating(false);
    onFolderCreated();
    loadFolderSharingInfo();
  }

  const displayFolders = loading ? subfolders.map(f => ({ ...f, isShared: false })) : foldersWithSharing;

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayFolders.map(folder => (
          <button
            key={folder.id}
            onClick={() => onFolderSelect(folder.id)}
            className="relative group bg-white rounded-lg border-2 border-gray-200 p-4 hover:border-blue-400 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <FolderIcon
                  className="w-6 h-6"
                  style={{ color: folder.color }}
                />
                <h3 className="font-medium text-gray-900">{folder.name}</h3>
              </div>
              {folder.isShared && (
                <Share2Icon className="w-4 h-4 text-blue-500" />
              )}
            </div>

            {folder.isShared && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <UsersIcon className="w-3 h-3" />
                  <span>
                    Sdíleno: {folder.sharedUsers?.length || 0} uživatelů, {folder.sharedGroups?.length || 0} skupin
                  </span>
                </div>
                {folder.sharedUsers && folder.sharedUsers.length > 0 && (
                  <div className="mt-1 text-xs text-gray-600">
                    {folder.sharedUsers.slice(0, 2).map(u => u.email).join(', ')}
                    {folder.sharedUsers.length > 2 && ` +${folder.sharedUsers.length - 2}`}
                  </div>
                )}
              </div>
            )}

            {folder.item_count !== undefined && (
              <div className="mt-2 text-sm text-gray-500">
                {folder.item_count} úkolů
              </div>
            )}
          </button>
        ))}

        {isCreating ? (
          <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-4">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Název složky..."
              className="w-full px-3 py-2 mb-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="mb-3">
              <label className="block text-sm text-gray-600 mb-1">Barva</label>
              <input
                type="color"
                value={newFolderColor}
                onChange={(e) => setNewFolderColor(e.target.value)}
                className="w-full h-10 rounded cursor-pointer"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={createFolder}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                Vytvořit
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewFolderName('');
                }}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                Zrušit
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-4 hover:border-blue-400 hover:bg-gray-100 transition-all flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-blue-500"
          >
            <PlusIcon className="w-6 h-6" />
            <span className="text-sm font-medium">Nová složka</span>
          </button>
        )}
      </div>
    </div>
  );
}
