import { useState, useEffect } from 'react';
import { Share2Icon, XIcon, TrashIcon, UsersIcon, UserIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Folder, FolderShare, UserGroup, User } from '../types';

interface FolderSharingManagerProps {
  folderId: string;
  onClose: () => void;
}

export function FolderSharingManager({ folderId, onClose }: FolderSharingManagerProps) {
  const [folder, setFolder] = useState<Folder | null>(null);
  const [shares, setShares] = useState<FolderShare[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [shareType, setShareType] = useState<'user' | 'group'>('user');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [permissionLevel, setPermissionLevel] = useState<'view' | 'edit'>('view');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [folderId]);

  async function loadData() {
    setIsLoading(true);
    await Promise.all([
      loadFolder(),
      loadShares(),
      loadGroups(),
      loadUsers(),
    ]);
    setIsLoading(false);
  }

  async function loadFolder() {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('id', folderId)
      .single();

    if (error) {
      console.error('Error loading folder:', error);
      return;
    }

    setFolder(data);
  }

  async function loadShares() {
    const { data, error } = await supabase
      .from('folder_shares')
      .select('*')
      .eq('folder_id', folderId);

    if (error) {
      console.error('Error loading shares:', error);
      return;
    }

    setShares(data || []);
  }

  async function loadGroups() {
    const { data, error } = await supabase
      .from('user_groups')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading groups:', error);
      return;
    }

    setGroups(data || []);
  }

  async function loadUsers() {
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, email');

    if (error) {
      console.error('Error loading users:', error);
      return;
    }

    setUsers((profiles || []).map(p => ({ id: p.id, email: p.email || '' })));
  }

  async function addShare() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (shareType === 'user' && !selectedUserId) {
      alert('Vyberte uživatele');
      return;
    }

    if (shareType === 'group' && !selectedGroupId) {
      alert('Vyberte skupinu');
      return;
    }

    const { error } = await supabase
      .from('folder_shares')
      .insert({
        folder_id: folderId,
        shared_with_user_id: shareType === 'user' ? selectedUserId : null,
        shared_with_group_id: shareType === 'group' ? selectedGroupId : null,
        permission_level: permissionLevel,
        created_by: user.id,
      });

    if (error) {
      if (error.code === '23505') {
        alert('Toto sdílení již existuje');
      } else {
        console.error('Error adding share:', error);
        alert('Chyba při sdílení: ' + error.message);
      }
      return;
    }

    setSelectedUserId('');
    setSelectedGroupId('');
    loadShares();
  }

  async function removeShare(shareId: string) {
    if (!confirm('Opravdu chcete odebrat toto sdílení?')) {
      return;
    }

    const { error } = await supabase
      .from('folder_shares')
      .delete()
      .eq('id', shareId);

    if (error) {
      console.error('Error removing share:', error);
      alert('Chyba při odstraňování sdílení');
      return;
    }

    loadShares();
  }

  function getShareDisplayName(share: FolderShare): string {
    if (share.shared_with_user_id) {
      const user = users.find(u => u.id === share.shared_with_user_id);
      return user?.email || 'Neznámý uživatel';
    }
    if (share.shared_with_group_id) {
      const group = groups.find(g => g.id === share.shared_with_group_id);
      return group?.name || 'Neznámá skupina';
    }
    return 'Neznámé';
  }

  function getShareIcon(share: FolderShare) {
    if (share.shared_with_user_id) {
      return <UserIcon className="w-4 h-4 text-blue-600" />;
    }
    return <UsersIcon className="w-4 h-4 text-green-600" />;
  }

  function getShareColor(share: FolderShare): string {
    if (share.shared_with_group_id) {
      const group = groups.find(g => g.id === share.shared_with_group_id);
      return group?.color || '#3B82F6';
    }
    return '#3B82F6';
  }

  const availableUsers = users.filter(u =>
    !shares.some(s => s.shared_with_user_id === u.id) && u.id !== folder?.owner_id
  );

  const availableGroups = groups.filter(g =>
    !shares.some(s => s.shared_with_group_id === g.id)
  );

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p>Načítání...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Share2Icon className="w-6 h-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Sdílení složky</h3>
              <p className="text-sm text-gray-600">{folder?.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="font-medium mb-3">Přidat sdílení</h4>

          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setShareType('user')}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                  shareType === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <UserIcon className="w-4 h-4" />
                  Uživatel
                </div>
              </button>
              <button
                onClick={() => setShareType('group')}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                  shareType === 'group'
                    ? 'bg-primary text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <UsersIcon className="w-4 h-4" />
                  Skupina
                </div>
              </button>
            </div>

            {shareType === 'user' ? (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Vyberte uživatele...</option>
                {availableUsers.map(user => (
                  <option key={user.id} value={user.id}>{user.email}</option>
                ))}
              </select>
            ) : (
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Vyberte skupinu...</option>
                {availableGroups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Úroveň oprávnění
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPermissionLevel('view')}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    permissionLevel === 'view'
                      ? 'bg-primary text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Zobrazení
                </button>
                <button
                  onClick={() => setPermissionLevel('edit')}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                    permissionLevel === 'edit'
                      ? 'bg-primary text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Úpravy
                </button>
              </div>
            </div>

            <button
              onClick={addShare}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Přidat sdílení
            </button>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-3">Aktuální sdílení</h4>
          {shares.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              Složka zatím není sdílena
            </p>
          ) : (
            <div className="space-y-2">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${getShareColor(share)}20` }}
                    >
                      {getShareIcon(share)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">
                        {getShareDisplayName(share)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {share.shared_with_user_id ? 'Uživatel' : 'Skupina'} •
                        {share.permission_level === 'view' ? ' Zobrazení' : ' Úpravy'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeShare(share.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Odebrat sdílení"
                  >
                    <TrashIcon className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
