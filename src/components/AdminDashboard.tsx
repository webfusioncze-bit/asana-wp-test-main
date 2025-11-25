import { useState, useEffect } from 'react';
import { ShieldIcon, UsersIcon, FolderIcon, CheckSquareIcon, KeyIcon, TrashIcon, ShieldCheckIcon, Settings, Webhook, UserCog, Users as UsersGroupIcon, FolderOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CategoryManager } from './CategoryManager';
import { RequestTypeManager } from './RequestTypeManager';
import { RequestStatusManager } from './RequestStatusManager';
import { ZapierIntegrationManager } from './ZapierIntegrationManager';
import { UserPermissionsManager } from './UserPermissionsManager';
import { UserGroupManager } from './UserGroupManager';
import { GlobalFolderManager } from './GlobalFolderManager';

type TabType = 'overview' | 'users' | 'settings' | 'integrations' | 'permissions' | 'groups' | 'folders';

interface UserRole {
  id: string;
  user_id: string;
  role: 'user' | 'admin';
  created_at: string;
}

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  avatar_url?: string;
  external_id?: string;
}

interface Stats {
  totalUsers: number;
  totalTasks: number;
  totalFolders: number;
  totalCategories: number;
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [users, setUsers] = useState<(AuthUser & { role?: string })[]>([]);
  const [editingExternalId, setEditingExternalId] = useState<string | null>(null);
  const [editingExternalIdValue, setEditingExternalIdValue] = useState<string>('');
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalTasks: 0,
    totalFolders: 0,
    totalCategories: 0,
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserExternalId, setNewUserExternalId] = useState('');

  useEffect(() => {
    loadUsers();
    loadStats();
  }, []);

  async function loadUsers() {
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, email, role, first_name, last_name, display_name, avatar_url, external_id');

    if (profilesError) {
      console.error('Error loading profiles:', profilesError);
      return;
    }

    const usersWithRoles = (profiles || []).map(profile => ({
      id: profile.id,
      email: profile.email || '',
      created_at: '',
      role: profile.role || 'user',
      display_name: profile.display_name,
      first_name: profile.first_name,
      last_name: profile.last_name,
      avatar_url: profile.avatar_url,
      external_id: profile.external_id,
    }));

    setUsers(usersWithRoles);
  }

  async function loadStats() {
    const [tasks, folders, categories, userRoles] = await Promise.all([
      supabase.from('tasks').select('id', { count: 'exact', head: true }),
      supabase.from('folders').select('id', { count: 'exact', head: true }),
      supabase.from('categories').select('id', { count: 'exact', head: true }),
      supabase.from('user_roles').select('id', { count: 'exact', head: true }),
    ]);

    setStats({
      totalUsers: userRoles.count || 0,
      totalTasks: tasks.count || 0,
      totalFolders: folders.count || 0,
      totalCategories: categories.count || 0,
    });
  }

  async function toggleUserRole(userId: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';

    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating role:', error);
      alert('Chyba při změně role: ' + error.message);
      return;
    }

    loadUsers();
  }

  async function resetUserPassword(userId: string, email: string) {
    const newPassword = prompt(`Zadejte nové heslo pro uživatele ${email}:`);
    if (!newPassword || newPassword.length < 6) {
      alert('Heslo musí mít alespoň 6 znaků');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Nejste přihlášeni');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-operations`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reset-password',
          userId,
          newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error resetting password:', result.error);
        alert('Chyba při resetování hesla: ' + result.error);
        return;
      }

      alert('Heslo bylo úspěšně změněno');
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě při resetování hesla');
    }
  }

  function startEditingExternalId(userId: string, currentValue: string) {
    setEditingExternalId(userId);
    setEditingExternalIdValue(currentValue || '');
  }

  function cancelEditingExternalId() {
    setEditingExternalId(null);
    setEditingExternalIdValue('');
  }

  async function saveExternalId(userId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Nejste přihlášeni');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-operations`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'set-external-id',
          userId,
          externalId: editingExternalIdValue.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error setting external ID:', result.error);
        alert('Chyba při nastavení External ID: ' + result.error);
        return;
      }

      setEditingExternalId(null);
      setEditingExternalIdValue('');
      loadUsers();
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě při nastavení External ID');
    }
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`Opravdu chcete smazat uživatele ${email}? Tato akce je nevratná!`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Nejste přihlášeni');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-operations`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete-user',
          userId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error deleting user:', result.error);
        alert('Chyba při mazání uživatele: ' + result.error);
        return;
      }

      alert('Uživatel byl úspěšně smazán');
      loadUsers();
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě při mazání uživatele');
    }
  }

  async function reassignPhasesByExternalIds() {
    if (!confirm('Tato akce přiřadí uživatele k fázím projektů podle jejich External ID. Pokračovat?')) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('reassign_phases_by_external_ids');

      if (error) {
        console.error('Error reassigning phases:', error);
        alert('Chyba při přiřazování: ' + error.message);
        return;
      }

      if (data && data.length > 0) {
        const assignedCount = data.filter((p: any) => p.assigned_user_id).length;
        alert(`Úspěšně přiřazeno: ${assignedCount} fází\n\nDetail:\n${data.map((p: any) =>
          `- ${p.phase_name}: ${p.assigned_user_id ? p.user_email : 'nebyl nalezen uživatel'}`
        ).join('\n')}`);
      } else {
        alert('Žádné fáze nebyly přiřazeny. Zkontrolujte, zda uživatelé mají nastavené External ID.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě při přiřazování');
    }
  }

  async function createUser() {
    if (!newUserEmail.trim() || !newUserPassword.trim()) {
      alert('Vyplňte email i heslo');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Nejste přihlášeni');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          externalId: newUserExternalId || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error creating user:', result.error);
        alert('Chyba při vytváření uživatele: ' + result.error);
        return;
      }

      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserExternalId('');
      setIsCreatingUser(false);
      loadUsers();
      alert('Uživatel byl úspěšně vytvořen');
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě při vytváření uživatele');
    }
  }

  const tabs = [
    { id: 'overview' as TabType, label: 'Přehled', icon: ShieldIcon },
    { id: 'users' as TabType, label: 'Uživatelé', icon: UsersIcon },
    { id: 'permissions' as TabType, label: 'Oprávnění', icon: UserCog },
    { id: 'groups' as TabType, label: 'Skupiny', icon: UsersGroupIcon },
    { id: 'folders' as TabType, label: 'Globální složky', icon: FolderOpen },
    { id: 'settings' as TabType, label: 'Nastavení', icon: Settings },
    { id: 'integrations' as TabType, label: 'Integrace', icon: Webhook },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-sm text-gray-600">Správa uživatelů a systému</p>
        </div>

        <div className="px-6">
          <nav className="flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <UsersIcon className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-1">{stats.totalUsers}</h3>
                <p className="text-gray-600 text-xs">Uživatelů celkem</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <CheckSquareIcon className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-1">{stats.totalTasks}</h3>
                <p className="text-gray-600 text-xs">Úkolů celkem</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-yellow-50 rounded-lg">
                    <FolderIcon className="w-5 h-5 text-yellow-600" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-1">{stats.totalFolders}</h3>
                <p className="text-gray-600 text-xs">Složek celkem</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <ShieldIcon className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-1">{stats.totalCategories}</h3>
                <p className="text-gray-600 text-xs">Kategorií celkem</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Správa uživatelů</h2>
              <div className="flex gap-2">
                <button
                  onClick={reassignPhasesByExternalIds}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title="Přiřadí uživatele k fázím projektů podle External ID"
                >
                  <UserCog className="w-4 h-4" />
                  Přiřadit k fázím
                </button>
                <button
                  onClick={() => setIsCreatingUser(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <UsersIcon className="w-4 h-4" />
                  Vytvořit uživatele
                </button>
              </div>
            </div>

            {isCreatingUser && (
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="Email"
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Heslo (min. 6 znaků)"
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="text"
                    value={newUserExternalId}
                    onChange={(e) => setNewUserExternalId(e.target.value)}
                    placeholder="External ID (volitelné)"
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createUser}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Vytvořit
                  </button>
                  <button
                    onClick={() => {
                      setIsCreatingUser(false);
                      setNewUserEmail('');
                      setNewUserPassword('');
                      setNewUserExternalId('');
                    }}
                    className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uživatel
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      External ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Akce
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt={user.display_name || user.email}
                                className="w-10 h-10 rounded-full object-cover border border-gray-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <UsersIcon className="w-5 h-5 text-gray-500" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.first_name || user.last_name
                                ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                                : user.display_name || user.email}
                            </div>
                            {(user.first_name || user.last_name) && (
                              <div className="text-xs text-gray-500">{user.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {editingExternalId === user.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingExternalIdValue}
                              onChange={(e) => setEditingExternalIdValue(e.target.value)}
                              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="ID"
                              autoFocus
                            />
                            <button
                              onClick={() => saveExternalId(user.id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Uložit"
                            >
                              <CheckSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditingExternalId}
                              className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                              title="Zrušit"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditingExternalId(user.id, user.external_id || '')}
                            className="text-sm text-gray-700 hover:text-blue-600 hover:underline text-left"
                          >
                            {user.external_id || <span className="text-gray-400 italic">Nastavit ID</span>}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.role === 'admin'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.role === 'admin' ? 'Admin' : 'Uživatel'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toggleUserRole(user.id, user.role || 'user')}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                              user.role === 'admin'
                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            {user.role === 'admin' ? 'Odebrat admin' : 'Admin'}
                          </button>
                          <button
                            onClick={() => resetUserPassword(user.id, user.email)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Resetovat heslo"
                          >
                            <KeyIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteUser(user.id, user.email)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Smazat uživatele"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'permissions' && <UserPermissionsManager />}
        {activeTab === 'groups' && <UserGroupManager />}
        {activeTab === 'folders' && <GlobalFolderManager />}
        {activeTab === 'integrations' && <ZapierIntegrationManager />}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CategoryManager />
              <RequestTypeManager />
            </div>
            <RequestStatusManager />
          </div>
        )}
      </div>
    </div>
  );
}
