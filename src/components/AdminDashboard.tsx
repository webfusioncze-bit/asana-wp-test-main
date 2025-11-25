import { useState, useEffect } from 'react';
import { ShieldIcon, UsersIcon, FolderIcon, CheckSquareIcon, KeyIcon, TrashIcon, ShieldCheckIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CategoryManager } from './CategoryManager';
import { RequestTypeManager } from './RequestTypeManager';
import { RequestStatusManager } from './RequestStatusManager';
import { ZapierIntegrationManager } from './ZapierIntegrationManager';
import { UserPermissionsManager } from './UserPermissionsManager';
import { UserGroupManager } from './UserGroupManager';
import { GlobalFolderManager } from './GlobalFolderManager';

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
}

interface Stats {
  totalUsers: number;
  totalTasks: number;
  totalFolders: number;
  totalCategories: number;
}

export function AdminDashboard() {
  const [users, setUsers] = useState<(AuthUser & { role?: string })[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalTasks: 0,
    totalFolders: 0,
    totalCategories: 0,
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  useEffect(() => {
    loadUsers();
    loadStats();
  }, []);

  async function loadUsers() {
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, email, role, first_name, last_name, display_name');

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
      setIsCreatingUser(false);
      loadUsers();
      alert('Uživatel byl úspěšně vytvořen');
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě při vytváření uživatele');
    }
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Správa uživatelů a přehled systému</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <UsersIcon className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-1">{stats.totalUsers}</h3>
          <p className="text-gray-600 text-sm">Uživatelů celkem</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckSquareIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-1">{stats.totalTasks}</h3>
          <p className="text-gray-600 text-sm">Úkolů celkem</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <FolderIcon className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-1">{stats.totalFolders}</h3>
          <p className="text-gray-600 text-sm">Složek celkem</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <ShieldIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-1">{stats.totalCategories}</h3>
          <p className="text-gray-600 text-sm">Kategorií celkem</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <CategoryManager />
        <RequestTypeManager />
      </div>

      <div className="mb-8">
        <RequestStatusManager />
      </div>

      <div className="mb-8">
        <ZapierIntegrationManager />
      </div>

      <div className="mb-8">
        <UserPermissionsManager />
      </div>

      <div className="mb-8">
        <UserGroupManager />
      </div>

      <div className="mb-8">
        <GlobalFolderManager />
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Správa uživatelů</h2>
          <button
            onClick={() => setIsCreatingUser(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <UsersIcon className="w-4 h-4" />
            Vytvořit uživatele
          </button>
        </div>

        {isCreatingUser && (
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Email"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Heslo (min. 6 znaků)"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={createUser}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Vytvořit
              </button>
              <button
                onClick={() => {
                  setIsCreatingUser(false);
                  setNewUserEmail('');
                  setNewUserPassword('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vytvořeno
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Akce
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'admin'
                          ? 'bg-primary/10 text-primary-dark'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.role === 'admin' ? 'Admin' : 'Uživatel'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString('cs-CZ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleUserRole(user.id, user.role || 'user')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-xs ${
                          user.role === 'admin'
                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            : 'bg-primary text-white hover:bg-primary-dark'
                        }`}
                      >
                        {user.role === 'admin' ? 'Odebrat admin' : 'Povýšit na admin'}
                      </button>
                      <button
                        onClick={() => resetUserPassword(user.id, user.email)}
                        className="p-1.5 text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        title="Resetovat heslo"
                      >
                        <KeyIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteUser(user.id, user.email)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
    </div>
  );
}
