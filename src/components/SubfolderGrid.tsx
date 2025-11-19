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
        .select('*')
        .eq('folder_id', folder.id);

      const sharedUsers: User[] = [];
      const sharedGroups: UserGroup[] = [];

      if (shares) {
        for (const share of shares) {
          if (share.shared_with_user_id) {
            const { data: userData } = await supabase
              .from('user_profiles')
              .select('id, email')
              .eq('id', share.shared_with_user_id)
              .maybeSingle();

            if (userData) {
              sharedUsers.push({
                id: userData.id,
                email: userData.email || ''
              });
            }
          }

          if (share.shared_with_group_id) {
            const { data: groupData } = await supabase
              .from('user_groups')
              .select('*')
              .eq('id', share.shared_with_group_id)
              .maybeSingle();

            if (groupData) {
              sharedGroups.push(groupData);
            }
          }
        }
      }

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
    <div className="mb-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        {displayFolders.map(folder => (
          <button
            key={folder.id}
            onClick={() => onFolderSelect(folder.id)}
            className="relative group bg-white rounded border border-gray-200 p-2 hover:border-blue-400 hover:shadow transition-all text-left"
          >
            <div className="flex items-center gap-1.5">
              <FolderIcon
                className="w-4 h-4 flex-shrink-0"
                style={{ color: folder.color }}
              />
              <span className="text-sm font-medium text-gray-900 truncate flex-1">{folder.name}</span>
              {folder.isShared && (
                <Share2Icon className="w-3 h-3 text-blue-500 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}

        {isCreating ? (
          <div className="bg-gray-50 rounded border border-dashed border-gray-300 p-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createFolder();
                if (e.key === 'Escape') setIsCreating(false);
              }}
              placeholder="Název složky..."
              className="w-full px-2 py-1 mb-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <input
              type="color"
              value={newFolderColor}
              onChange={(e) => setNewFolderColor(e.target.value)}
              className="w-full h-6 rounded cursor-pointer mb-2"
            />
            <div className="flex gap-1">
              <button
                onClick={createFolder}
                className="flex-1 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs"
              >
                Vytvořit
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewFolderName('');
                }}
                className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-xs"
              >
                Zrušit
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="bg-gray-50 rounded border border-dashed border-gray-300 p-2 hover:border-blue-400 hover:bg-gray-100 transition-all flex items-center justify-center gap-1 text-gray-500 hover:text-blue-500"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="text-xs font-medium">Nová</span>
          </button>
        )}
      </div>
    </div>
  );
}
