import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { FolderSidebar } from './components/FolderSidebar';
import { TaskList } from './components/TaskList';
import { TaskDetail } from './components/TaskDetail';
import { RequestList } from './components/RequestList';
import { RequestDetail } from './components/RequestDetail';
import RequestInfoSidebar from './components/RequestInfoSidebar';
import { AdminDashboard } from './components/AdminDashboard';
import { LogOutIcon, ShieldIcon, LayoutDashboardIcon } from 'lucide-react';
import type { User, UserRole, Request } from './types';

type ViewMode = 'tasks' | 'requests';

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

    setLoading(false);
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
            {!showAdmin && hasRequestsPermission && (
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
            <span className="text-sm text-gray-300">{user.email}</span>
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
              <TaskList
                key={tasksRefreshKey}
                folderId={selectedFolderId}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                onOpenRequest={(requestId) => {
                  setViewMode('requests');
                  setSelectedRequestId(requestId);
                  setSelectedTaskId(null);
                }}
              />
              {selectedTaskId && (
                <TaskDetail
                  taskId={selectedTaskId}
                  onClose={() => setSelectedTaskId(null)}
                  onTaskUpdated={() => {
                    setSelectedTaskId(null);
                    setTasksRefreshKey(prev => prev + 1);
                  }}
                />
              )}
            </div>
          ) : (
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
