import { useState, useEffect } from 'react';
import { ShieldCheckIcon, XIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
}

interface UserPermission {
  id: string;
  user_id: string;
  permission: string;
  created_at: string;
}

const AVAILABLE_PERMISSIONS = [
  { value: 'view_requests', label: 'Zobrazit všechny poptávky', description: 'Uživatel vidí všechny poptávky bez omezení' },
];

export function UserPermissionsManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
    loadPermissions();
  }, []);

  async function loadUsers() {
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, email')
      .order('email');

    if (error) {
      console.error('Error loading users:', error);
      return;
    }

    setUsers((profiles || []).map(p => ({ id: p.id, email: p.email || '' })));
  }

  async function loadPermissions() {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading permissions:', error);
      return;
    }

    setPermissions(data || []);
  }

  async function addPermission(userId: string, permission: string) {
    setLoading(true);

    const { error } = await supabase
      .from('user_permissions')
      .insert({
        user_id: userId,
        permission: permission,
      });

    if (error) {
      console.error('Error adding permission:', error);
      alert('Chyba při přidávání oprávnění: ' + error.message);
    } else {
      await loadPermissions();
    }

    setLoading(false);
  }

  async function removePermission(permissionId: string) {
    if (!confirm('Opravdu chcete odebrat toto oprávnění?')) return;

    setLoading(true);

    const { error } = await supabase
      .from('user_permissions')
      .delete()
      .eq('id', permissionId);

    if (error) {
      console.error('Error removing permission:', error);
      alert('Chyba při odebírání oprávnění: ' + error.message);
    } else {
      await loadPermissions();
    }

    setLoading(false);
  }

  function hasPermission(userId: string, permission: string): boolean {
    return permissions.some(p => p.user_id === userId && p.permission === permission);
  }

  function getUserPermissions(userId: string) {
    return permissions.filter(p => p.user_id === userId);
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-800">Správa oprávnění uživatelů</h2>
      </div>

      <div className="space-y-6">
        {/* Přidání oprávnění */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Přidat oprávnění</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Uživatel</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">Vyberte uživatele...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.email}</option>
                ))}
              </select>
            </div>

            {selectedUser && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700 mb-2">Dostupná oprávnění</label>
                {AVAILABLE_PERMISSIONS.map(perm => (
                  <div key={perm.value} className="flex items-start justify-between p-3 bg-white rounded border border-gray-200">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">{perm.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{perm.description}</div>
                    </div>
                    <button
                      onClick={() => addPermission(selectedUser, perm.value)}
                      disabled={loading || hasPermission(selectedUser, perm.value)}
                      className={`ml-3 px-3 py-1 text-xs rounded transition-colors ${
                        hasPermission(selectedUser, perm.value)
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-primary text-white hover:bg-primary-dark'
                      }`}
                    >
                      {hasPermission(selectedUser, perm.value) ? 'Přiděleno' : 'Přidat'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Seznam uživatelů s oprávněními */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Přehled oprávnění</h3>
          <div className="space-y-3">
            {users.map(user => {
              const userPerms = getUserPermissions(user.id);
              if (userPerms.length === 0) return null;

              return (
                <div key={user.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-sm text-gray-900">{user.email}</div>
                      <div className="text-xs text-gray-500">
                        {userPerms.length} {userPerms.length === 1 ? 'oprávnění' : 'oprávnění'}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {userPerms.map(perm => {
                      const permDef = AVAILABLE_PERMISSIONS.find(p => p.value === perm.permission);
                      return (
                        <div key={perm.id} className="flex items-center justify-between bg-white rounded p-2 border border-gray-200">
                          <div className="flex items-center gap-2">
                            <ShieldCheckIcon className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-gray-700">{permDef?.label || perm.permission}</span>
                          </div>
                          <button
                            onClick={() => removePermission(perm.id)}
                            disabled={loading}
                            className="p-1 hover:bg-red-50 rounded transition-colors"
                          >
                            <XIcon className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {permissions.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Zatím nebylo přiděleno žádné oprávnění
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
