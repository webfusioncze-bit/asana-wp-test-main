import { useState, useEffect } from 'react';
import { UsersIcon, SettingsIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Folder, User, UserGroup } from '../types';

interface FolderDetailHeaderProps {
  folder: Folder;
  onOpenSettings?: () => void;
}

export function FolderDetailHeader({ folder, onOpenSettings }: FolderDetailHeaderProps) {
  const [sharedUsers, setSharedUsers] = useState<User[]>([]);
  const [sharedGroups, setSharedGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSharingInfo();
  }, [folder.id]);

  async function loadSharingInfo() {
    setLoading(true);

    const { data: shares } = await supabase
      .from('folder_shares')
      .select('*')
      .eq('folder_id', folder.id);

    const users: User[] = [];
    const groups: UserGroup[] = [];

    if (shares) {
      for (const share of shares) {
        if (share.shared_with_user_id) {
          const { data: userData } = await supabase
            .from('user_profiles')
            .select('id, email')
            .eq('id', share.shared_with_user_id)
            .maybeSingle();

          if (userData) {
            users.push({ id: userData.id, email: userData.email || '' });
          }
        }

        if (share.shared_with_group_id) {
          const { data: groupData } = await supabase
            .from('user_groups')
            .select('*')
            .eq('id', share.shared_with_group_id)
            .maybeSingle();

          if (groupData) {
            groups.push(groupData);
          }
        }
      }
    }

    setSharedUsers(users);
    setSharedGroups(groups);
    setLoading(false);
  }

  const hasSharing = sharedUsers.length > 0 || sharedGroups.length > 0;

  if (loading) return null;

  return (
    <div className="bg-blue-50 border-b border-blue-100 px-4 py-2">
      <div className="flex items-center justify-between">
        {hasSharing ? (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <UsersIcon className="w-4 h-4 text-blue-600" />
            <span className="font-medium">Sdíleno s:</span>
            <span>
              {sharedUsers.map(u => u.email).join(', ')}
              {sharedUsers.length > 0 && sharedGroups.length > 0 && ', '}
              {sharedGroups.map(g => g.name).join(', ')}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">{folder.name}</span>
          </div>
        )}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-100 rounded-lg transition-colors"
            title="Nastavení složky"
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Nastavení</span>
          </button>
        )}
      </div>
    </div>
  );
}
