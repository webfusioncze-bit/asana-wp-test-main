import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { FolderSidebar } from './components/FolderSidebar';
import { TaskListNew } from './components/TaskListNew';
import { TaskDetail } from './components/TaskDetail';
import { TaskCreationPanel } from './components/TaskCreationPanel';
import { RequestList } from './components/RequestList';
import { RequestDetail } from './components/RequestDetail';
import { RequestCreationPanel } from './components/RequestCreationPanel';
import RequestInfoSidebar from './components/RequestInfoSidebar';
import { AdminDashboard } from './components/AdminDashboard';
import { UserProfileSettings } from './components/UserProfileSettings';
import { ProjectList } from './components/ProjectList';
import { LogOutIcon, ShieldIcon, LayoutDashboardIcon, UserIcon, PlusIcon } from 'lucide-react';
import type { User, UserRole, Request } from './types';

type ViewMode = 'tasks' | 'requests' | 'projects';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('tasks');
  const [requestsRefreshKey, setRequestsRefreshKey] = useState(0);
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);
  const [hasRequestsPermission, setHasRequestsPermission] = useState(false);
  const [hasProjectsPermission, setHasProjectsPermission] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [showTaskCreation, setShowTaskCreation] = useState(false);
  const [showRequestCreation, setShowRequestCreation] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        ensureUserRoleExists(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        ensureUserRoleExists(session.user.id);
      } else {
        setUserRole(null);
        setShowAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedRequestId) {
      loadSelectedRequest();
    } else {
      setSelectedRequest(null);
    }
  }, [selectedRequestId]);

  async function loadSelectedRequest() {
    if (!selectedRequestId) return;

    const { data } = await supabase
      .from('requests')
      .select('*')
      .eq('id', selectedRequestId)
      .maybeSingle();

    if (data) {
      setSelectedRequest(data as Request);
    }
  }

  async function ensureUserRoleExists(userId: string) {
    await supabase.rpc('create_user_role_if_not_exists', {
      user_id_param: userId
    });
    loadUserRole(userId);
  }

  async function loadUserRole(userId: string) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error loading user role:', error);
    }

    console.log('User role loaded:', data);
    setUserRole(data);

    // Zkontroluj oprávnění pro poptávky
    await checkRequestsPermission(userId, data?.role === 'admin');

    // Zkontroluj oprávnění pro projekty
    await checkProjectsPermission(userId);

    // Načti profil uživatele
    await loadUserProfile(userId);

    setLoading(false);
  }

  async function loadUserProfile(userId: string) {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      setUserProfile(data as User);
    }
  }

  async function checkRequestsPermission(userId: string, isAdmin: boolean) {
    // Admin má vždy přístup
    if (isAdmin) {
      setHasRequestsPermission(true);
      return;
    }

    // Zkontroluj, zda má uživatel oprávnění view_requests
    const { data } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('permission', 'view_requests')
      .maybeSingle();

    setHasRequestsPermission(!!data);
  }

  async function checkProjectsPermission(userId: string) {
    // Zkontroluj, jestli má uživatel oprávnění manage_projects
    const { data } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .eq('permission', 'manage_projects')
      .maybeSingle();

    // Nebo je to Milan Vodák
    const { data: { user: authUser } } = await supabase.auth.getUser();

    setHasProjectsPermission(!!data || authUser?.email === 'milan.vodak@webfusion.cz');
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Načítání...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const isAdmin = userRole?.role === 'admin';

  return (
    <div className="flex h-screen bg-gray-50">
      {!showAdmin && (
        <FolderSidebar
          key={`${viewMode}-${tasksRefreshKey}-${requestsRefreshKey}`}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          folderType={viewMode}
        />
      )}
      <div className="flex-1 flex flex-col">
        <header className="bg-dark border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold text-white">
              {showAdmin ? 'Admin Dashboard' : 'Task Manager'}
            </h1>
            {!showAdmin && viewMode !== 'projects' && (
              <button
                onClick={() => viewMode === 'tasks' ? setShowTaskCreation(true) : setShowRequestCreation(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <PlusIcon className="w-4 h-4" />
                {viewMode === 'tasks' ? 'Nový úkol' : 'Nová poptávka'}
              </button>
            )}
            {!showAdmin && (hasRequestsPermission || hasProjectsPermission) && (
              <div className="flex gap-2 border border-gray-600 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('tasks')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'tasks'
                      ? 'bg-primary text-white'
                      : 'text-gray-300 hover:bg-dark-light'
                  }`}
                >
                  Úkoly
                </button>
                {hasRequestsPermission && (
                  <button
                    onClick={() => setViewMode('requests')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'requests'
                        ? 'bg-primary text-white'
                        : 'text-gray-300 hover:bg-dark-light'
                    }`}
                  >
                    Poptávky
                  </button>
                )}
                {hasProjectsPermission && (
                  <button
                    onClick={() => setViewMode('projects')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'projects'
                        ? 'bg-primary text-white'
                        : 'text-gray-300 hover:bg-dark-light'
                    }`}
                  >
                    Projekty
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <button
                onClick={() => setShowAdmin(!showAdmin)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                {showAdmin ? (
                  <>
                    <LayoutDashboardIcon className="w-4 h-4" />
                    Úkoly
                  </>
                ) : (
                  <>
                    <ShieldIcon className="w-4 h-4" />
                    Admin
                  </>
                )}
              </button>
            )}
            {isAdmin && (
              <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                <ShieldIcon className="w-3 h-3" />
                Admin
              </div>
            )}
            <button
              onClick={() => setShowProfileSettings(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-light rounded-lg transition-colors"
            >
              {userProfile?.avatar_url ? (
                <img
                  src={userProfile.avatar_url}
                  alt="Avatar"
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-4 h-4" />
              )}
              <span>{userProfile?.display_name || user.email}</span>
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-dark-light rounded-lg transition-colors"
            >
              <LogOutIcon className="w-4 h-4" />
              Odhlásit se
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          {showAdmin ? (
            <AdminDashboard />
          ) : viewMode === 'tasks' ? (
            <div className="flex h-full">
              <TaskListNew
                key={tasksRefreshKey}
                folderId={selectedFolderId}
                onSelectTask={setSelectedTaskId}
              />
              {selectedTaskId && (
                <TaskDetail
                  taskId={selectedTaskId}
                  onClose={() => setSelectedTaskId(null)}
                  onTaskUpdated={() => {
                    setTasksRefreshKey(prev => prev + 1);
                  }}
                />
              )}
              {showTaskCreation && (
                <TaskCreationPanel
                  folderId={selectedFolderId}
                  onClose={() => setShowTaskCreation(false)}
                  onTaskCreated={() => {
                    setShowTaskCreation(false);
                    setTasksRefreshKey(prev => prev + 1);
                  }}
                />
              )}
            </div>
          ) : viewMode === 'requests' ? (
            <div className="flex h-full">
              <RequestList
                key={requestsRefreshKey}
                folderId={selectedFolderId}
                selectedRequestId={selectedRequestId}
                onSelectRequest={setSelectedRequestId}
              />
              {selectedRequestId && (
                <>
                  <RequestDetail
                    requestId={selectedRequestId}
                    onClose={() => setSelectedRequestId(null)}
                    onRequestUpdated={() => {
                      setRequestsRefreshKey(prev => prev + 1);
                      loadSelectedRequest();
                    }}
                  />
                  {selectedRequest && (
                    <RequestInfoSidebar request={selectedRequest} />
                  )}
                </>
              )}
              {showRequestCreation && (
                <RequestCreationPanel
                  folderId={selectedFolderId}
                  onClose={() => setShowRequestCreation(false)}
                  onRequestCreated={() => {
                    setShowRequestCreation(false);
                    setRequestsRefreshKey(prev => prev + 1);
                  }}
                />
              )}
            </div>
          ) : (
            <ProjectList canManage={hasProjectsPermission} />
          )}
        </div>
      </div>

      {showProfileSettings && (
        <UserProfileSettings
          onClose={() => setShowProfileSettings(false)}
          onUpdated={() => {
            if (user?.id) loadUserProfile(user.id);
          }}
        />
      )}
    </div>
  );
}

export default App;
