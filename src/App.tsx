import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { PasswordSetup } from './components/PasswordSetup';
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
import { ProjectDetail } from './components/ProjectDetail';
import { WebsiteList } from './components/WebsiteList';
import { WebsiteDetail } from './components/WebsiteDetail';
import { WebsitesSidebar } from './components/WebsitesSidebar';
import type { WebsitesViewMode } from './components/WebsitesSidebar';
import { WebsiteFilter } from './components/WebsiteFilter';
import { ClientList } from './components/ClientList';
import { ClientDetail } from './components/ClientDetail';
import { SupportTicketSidebar } from './components/SupportTicketSidebar';
import type { TicketFilters } from './components/SupportTicketSidebar';
import { SupportTicketList } from './components/SupportTicketList';
import { SupportTicketDetail } from './components/SupportTicketDetail';
import { DataCacheProvider } from './contexts/DataCacheContext';
import { LogOutIcon, ShieldIcon, LayoutDashboardIcon, UserIcon, PlusIcon } from 'lucide-react';
import type { User, UserRole, Request } from './types';

type ViewMode = 'tasks' | 'requests' | 'projects' | 'websites' | 'clients' | 'support_tickets';

function App() {
  const hash = window.location.hash;
  const hasRecoveryType = hash && (hash.includes('type=recovery') || hash.includes('type=invite'));
  const hasToken = hash && (hash.includes('token=') || hash.includes('token_hash=') || hash.includes('access_token='));
  const isPasswordSetup = hasRecoveryType && hasToken;

  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [isRequestEditing, setIsRequestEditing] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('tasks');
  const [requestsRefreshKey, setRequestsRefreshKey] = useState(0);
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);
  const [hasRequestsPermission, setHasRequestsPermission] = useState(false);
  const [hasProjectsPermission, setHasProjectsPermission] = useState(false);
  const [hasWebsitesPermission, setHasWebsitesPermission] = useState(false);
  const [hasClientsPermission, setHasClientsPermission] = useState(false);
  const [hasSupportTicketsPermission, setHasSupportTicketsPermission] = useState(false);
  const [selectedSupportTicketId, setSelectedSupportTicketId] = useState<string | null>(null);
  const [ticketFilters, setTicketFilters] = useState<TicketFilters>({ status: null, operatorUserId: null, clientId: null, showResolved: false });
  const [ticketsSyncing, setTicketsSyncing] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [showTaskCreation, setShowTaskCreation] = useState(false);
  const [showRequestCreation, setShowRequestCreation] = useState(false);
  const [showCompletedProjects, setShowCompletedProjects] = useState(false);
  const [websitesViewMode, setWebsitesViewMode] = useState<WebsitesViewMode>('websites');

  useEffect(() => {
    const hash = window.location.hash;
    const hasRecoveryType = hash && (hash.includes('type=recovery') || hash.includes('type=invite'));
    const hasToken = hash && (hash.includes('token=') || hash.includes('token_hash=') || hash.includes('access_token='));
    const isRecoveryLink = hasRecoveryType && hasToken;

    if (!isRecoveryLink) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          ensureUserRoleExists(session.user.id);
        } else {
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentHash = window.location.hash;
      const currentHasRecoveryType = currentHash && (currentHash.includes('type=recovery') || currentHash.includes('type=invite'));
      const currentHasToken = currentHash && (currentHash.includes('token=') || currentHash.includes('token_hash=') || currentHash.includes('access_token='));
      const isCurrentlyRecovery = currentHasRecoveryType && currentHasToken;

      if (!isCurrentlyRecovery) {
        setUser(session?.user ?? null);
        if (session?.user) {
          ensureUserRoleExists(session.user.id);
        } else {
          setUserRole(null);
          setShowAdmin(false);
        }
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

    setUserRole(data);

    const isAdmin = data?.role === 'admin';

    const [permissionsResult, profileResult] = await Promise.all([
      loadAllPermissions(userId, isAdmin),
      loadUserProfile(userId),
    ]);

    void permissionsResult;
    void profileResult;

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

  async function loadAllPermissions(userId: string, isAdmin: boolean) {
    if (isAdmin) {
      setHasRequestsPermission(true);
      setHasProjectsPermission(true);
      setHasWebsitesPermission(true);
      setHasClientsPermission(true);
      setHasSupportTicketsPermission(true);
      return;
    }

    const { data } = await supabase
      .from('user_permissions')
      .select('permission')
      .eq('user_id', userId)
      .in('permission', [
        'view_requests',
        'manage_projects',
        'manage_websites',
        'manage_clients',
        'manage_support_tickets',
      ]);

    const granted = new Set((data || []).map(r => r.permission));
    setHasRequestsPermission(granted.has('view_requests'));
    setHasProjectsPermission(granted.has('manage_projects'));
    setHasWebsitesPermission(granted.has('manage_websites'));
    setHasClientsPermission(granted.has('manage_clients'));
    setHasSupportTicketsPermission(granted.has('manage_support_tickets'));
  }

  async function handleSyncTickets() {
    setTicketsSyncing(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-support-tickets`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Sync error:', error);
    }
    setTicketsSyncing(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (isPasswordSetup) {
    return <PasswordSetup />;
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
    <DataCacheProvider>
      <div className="flex h-screen bg-gray-50">
      {!showAdmin && viewMode === 'projects' && (
        <FolderSidebar
          key={`${viewMode}-${tasksRefreshKey}-${requestsRefreshKey}`}
          selectedFolderId={selectedProjectId}
          onSelectFolder={setSelectedProjectId}
          folderType={viewMode}
          showCompletedProjects={showCompletedProjects}
          onToggleCompletedProjects={setShowCompletedProjects}
        />
      )}
      {!showAdmin && viewMode === 'websites' && (
        <WebsitesSidebar
          selectedView={websitesViewMode}
          onSelectView={(view) => {
            setWebsitesViewMode(view);
            if (view === 'filter') setSelectedWebsiteId(null);
          }}
        />
      )}
      {!showAdmin && viewMode === 'support_tickets' && (
        <SupportTicketSidebar
          filters={ticketFilters}
          onFiltersChange={setTicketFilters}
          onSync={handleSyncTickets}
          syncing={ticketsSyncing}
        />
      )}
      {!showAdmin && viewMode !== 'projects' && viewMode !== 'websites' && viewMode !== 'support_tickets' && viewMode !== 'clients' && (
        <FolderSidebar
          key={`${viewMode}-${tasksRefreshKey}-${requestsRefreshKey}`}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          folderType={viewMode}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-dark border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!showAdmin && (viewMode === 'tasks' || viewMode === 'requests') && (
              <button
                onClick={() => viewMode === 'tasks' ? setShowTaskCreation(true) : setShowRequestCreation(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-600 text-gray-200 rounded-lg hover:bg-dark-light hover:border-gray-500 transition-colors text-sm font-medium"
              >
                <PlusIcon className="w-4 h-4" />
                {viewMode === 'tasks' ? 'Nový úkol' : 'Nová poptávka'}
              </button>
            )}
            {!showAdmin && (hasRequestsPermission || hasProjectsPermission || hasWebsitesPermission || hasClientsPermission || hasSupportTicketsPermission) && (
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
                {hasWebsitesPermission && (
                  <button
                    onClick={() => setViewMode('websites')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'websites'
                        ? 'bg-primary text-white'
                        : 'text-gray-300 hover:bg-dark-light'
                    }`}
                  >
                    Weby
                  </button>
                )}
                {hasClientsPermission && (
                  <button
                    onClick={() => setViewMode('clients')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'clients'
                        ? 'bg-primary text-white'
                        : 'text-gray-300 hover:bg-dark-light'
                    }`}
                  >
                    Klienti
                  </button>
                )}
                {(hasSupportTicketsPermission || isAdmin) && (
                  <button
                    onClick={() => setViewMode('support_tickets')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'support_tickets'
                        ? 'bg-primary text-white'
                        : 'text-gray-300 hover:bg-dark-light'
                    }`}
                  >
                    Podpora
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
                <div className="w-[480px] flex flex-col h-full">
                  <TaskDetail
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                    onTaskUpdated={() => {
                      setTasksRefreshKey(prev => prev + 1);
                    }}
                    onOpenRequest={(requestId) => {
                      setSelectedTaskId(null);
                      setViewMode('requests');
                      setSelectedRequestId(requestId);
                    }}
                    onSelectTask={setSelectedTaskId}
                  />
                </div>
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
                    onClose={() => {
                      setSelectedRequestId(null);
                      setIsRequestEditing(false);
                    }}
                    onRequestUpdated={() => {
                      setRequestsRefreshKey(prev => prev + 1);
                      loadSelectedRequest();
                    }}
                    onEditModeChange={setIsRequestEditing}
                  />
                  {selectedRequest && !isRequestEditing && (
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
          ) : viewMode === 'projects' ? (
            selectedProjectId ? (
              <ProjectDetail
                projectId={selectedProjectId}
                onClose={() => setSelectedProjectId(null)}
                onProjectChange={setSelectedProjectId}
                canManage={hasProjectsPermission}
              />
            ) : (
              <ProjectList
                canManage={hasProjectsPermission}
                onSelectProject={setSelectedProjectId}
                selectedProjectId={selectedProjectId}
                showCompleted={showCompletedProjects}
                onToggleCompleted={setShowCompletedProjects}
              />
            )
          ) : viewMode === 'websites' ? (
            <div className="flex h-full">
              {websitesViewMode === 'filter' ? (
                <WebsiteFilter />
              ) : selectedWebsiteId ? (
                <WebsiteDetail
                  websiteId={selectedWebsiteId}
                  onClose={() => setSelectedWebsiteId(null)}
                />
              ) : (
                <WebsiteList
                  selectedWebsiteId={selectedWebsiteId}
                  onSelectWebsite={setSelectedWebsiteId}
                  canManage={hasWebsitesPermission}
                  viewMode={websitesViewMode}
                />
              )}
            </div>
          ) : viewMode === 'clients' ? (
            <div className="flex h-full overflow-hidden">
              <ClientList
                selectedClientId={selectedClientId}
                onSelectClient={setSelectedClientId}
                canManage={hasClientsPermission}
              />
              {selectedClientId && (
                <ClientDetail
                  clientId={selectedClientId}
                  onClose={() => setSelectedClientId(null)}
                  onNavigateToWebsite={(websiteId) => {
                    setViewMode('websites');
                    setSelectedWebsiteId(websiteId);
                  }}
                />
              )}
            </div>
          ) : viewMode === 'support_tickets' ? (
            <div className="flex h-full overflow-hidden">
              <SupportTicketList
                selectedTicketId={selectedSupportTicketId}
                onSelectTicket={setSelectedSupportTicketId}
                filters={ticketFilters}
              />
              {selectedSupportTicketId && (
                <SupportTicketDetail
                  ticketId={selectedSupportTicketId}
                  onClose={() => setSelectedSupportTicketId(null)}
                  onNavigateToWebsite={(websiteId) => {
                    setViewMode('websites');
                    setSelectedWebsiteId(websiteId);
                  }}
                />
              )}
            </div>
          ) : null}
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
    </DataCacheProvider>
  );
}

export default App;
