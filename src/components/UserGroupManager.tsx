import { useState, useEffect } from 'react';
import { UsersIcon, PlusIcon, Edit2Icon, TrashIcon, XIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { UserGroup, UserGroupMember, User } from '../types';

export function UserGroupManager() {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [groupMembers, setGroupMembers] = useState<Record<string, UserGroupMember[]>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#3B82F6');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupDescription, setEditingGroupDescription] = useState('');
  const [editingGroupColor, setEditingGroupColor] = useState('');
  const [managingMembersGroupId, setManagingMembersGroupId] = useState<string | null>(null);
  const [selectedUserForAdd, setSelectedUserForAdd] = useState('');

  useEffect(() => {
    loadGroups();
    loadUsers();
  }, []);

  useEffect(() => {
    if (managingMembersGroupId) {
      loadGroupMembers(managingMembersGroupId);
    }
  }, [managingMembersGroupId]);

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

  async function loadGroupMembers(groupId: string) {
    const { data, error } = await supabase
      .from('user_group_members')
      .select('*')
      .eq('group_id', groupId);

    if (error) {
      console.error('Error loading group members:', error);
      return;
    }

    setGroupMembers(prev => ({ ...prev, [groupId]: data || [] }));
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_groups')
      .insert({
        name: newGroupName,
        description: newGroupDescription,
        color: newGroupColor,
        created_by: user.id,
      });

    if (error) {
      console.error('Error creating group:', error);
      alert('Chyba při vytváření skupiny: ' + error.message);
      return;
    }

    setNewGroupName('');
    setNewGroupDescription('');
    setNewGroupColor('#3B82F6');
    setIsCreating(false);
    loadGroups();
  }

  async function updateGroup() {
    if (!editingGroupId || !editingGroupName.trim()) return;

    const { error } = await supabase
      .from('user_groups')
      .update({
        name: editingGroupName,
        description: editingGroupDescription,
        color: editingGroupColor,
      })
      .eq('id', editingGroupId);

    if (error) {
      console.error('Error updating group:', error);
      alert('Chyba při úpravě skupiny');
      return;
    }

    setEditingGroupId(null);
    setEditingGroupName('');
    setEditingGroupDescription('');
    setEditingGroupColor('');
    loadGroups();
  }

  async function deleteGroup(groupId: string, groupName: string) {
    if (!confirm(`Opravdu chcete smazat skupinu "${groupName}"?`)) {
      return;
    }

    const { error } = await supabase
      .from('user_groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      console.error('Error deleting group:', error);
      alert('Chyba při mazání skupiny');
      return;
    }

    loadGroups();
  }

  async function addMemberToGroup() {
    if (!managingMembersGroupId || !selectedUserForAdd) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_group_members')
      .insert({
        group_id: managingMembersGroupId,
        user_id: selectedUserForAdd,
        added_by: user.id,
      });

    if (error) {
      if (error.code === '23505') {
        alert('Tento uživatel je již ve skupině');
      } else {
        console.error('Error adding member:', error);
        alert('Chyba při přidávání člena: ' + error.message);
      }
      return;
    }

    setSelectedUserForAdd('');
    loadGroupMembers(managingMembersGroupId);
  }

  async function removeMemberFromGroup(memberId: string) {
    if (!managingMembersGroupId) return;

    const { error } = await supabase
      .from('user_group_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      console.error('Error removing member:', error);
      alert('Chyba při odstraňování člena');
      return;
    }

    loadGroupMembers(managingMembersGroupId);
  }

  function getUserEmail(userId: string): string {
    return users.find(u => u.id === userId)?.email || 'Neznámý uživatel';
  }

  const colorPresets = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#6366F1', // Indigo
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UsersIcon className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-semibold text-gray-800">Správa uživatelských skupin</h2>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nová skupina
        </button>
      </div>

      {isCreating && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium mb-4">Vytvořit novou skupinu</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Název skupiny
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Management, DEV, Grafika..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Popis (volitelný)
              </label>
              <textarea
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Popis skupiny..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Barva
              </label>
              <div className="flex gap-2">
                {colorPresets.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewGroupColor(color)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      newGroupColor === color ? 'border-gray-800 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={createGroup}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Vytvořit
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewGroupName('');
                  setNewGroupDescription('');
                  setNewGroupColor('#3B82F6');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {groups.map((group) => (
          <div
            key={group.id}
            className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            {editingGroupId === group.id ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editingGroupName}
                  onChange={(e) => setEditingGroupName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <textarea
                  value={editingGroupDescription}
                  onChange={(e) => setEditingGroupDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="flex gap-2">
                  {colorPresets.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditingGroupColor(color)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        editingGroupColor === color ? 'border-gray-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={updateGroup}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    Uložit
                  </button>
                  <button
                    onClick={() => {
                      setEditingGroupId(null);
                      setEditingGroupName('');
                      setEditingGroupDescription('');
                      setEditingGroupColor('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: group.color }}
                    />
                    <div>
                      <h3 className="font-medium text-gray-800">{group.name}</h3>
                      {group.description && (
                        <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setManagingMembersGroupId(group.id)}
                      className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Spravovat členy"
                    >
                      <UsersIcon className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingGroupId(group.id);
                        setEditingGroupName(group.name);
                        setEditingGroupDescription(group.description);
                        setEditingGroupColor(group.color);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Upravit"
                    >
                      <Edit2Icon className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => deleteGroup(group.id, group.name)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Smazat"
                    >
                      <TrashIcon className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
                {groupMembers[group.id] && groupMembers[group.id].length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {groupMembers[group.id].map((member) => (
                      <span
                        key={member.id}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {getUserEmail(member.user_id)}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {managingMembersGroupId && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setManagingMembersGroupId(null)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Správa členů skupiny: {groups.find(g => g.id === managingMembersGroupId)?.name}
              </h3>
              <button
                onClick={() => setManagingMembersGroupId(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <XIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-4">
              <div className="flex gap-2">
                <select
                  value={selectedUserForAdd}
                  onChange={(e) => setSelectedUserForAdd(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Vyberte uživatele...</option>
                  {users
                    .filter(u => !groupMembers[managingMembersGroupId]?.some(m => m.user_id === u.id))
                    .map(user => (
                      <option key={user.id} value={user.id}>{user.email}</option>
                    ))}
                </select>
                <button
                  onClick={addMemberToGroup}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors whitespace-nowrap"
                >
                  Přidat
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {groupMembers[managingMembersGroupId]?.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm text-gray-700">
                    {getUserEmail(member.user_id)}
                  </span>
                  <button
                    onClick={() => removeMemberFromGroup(member.id)}
                    className="p-1 hover:bg-red-100 rounded transition-colors"
                    title="Odebrat ze skupiny"
                  >
                    <TrashIcon className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              ))}
              {(!groupMembers[managingMembersGroupId] || groupMembers[managingMembersGroupId].length === 0) && (
                <p className="text-center text-gray-500 py-4">
                  Ve skupině zatím nejsou žádní členové
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
