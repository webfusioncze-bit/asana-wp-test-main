import { useState, useEffect } from 'react';
import { BriefcaseIcon, PlusIcon, SearchIcon, XIcon, CalendarIcon, DollarSignIcon, DownloadIcon, Trash2Icon, RefreshCwIcon, CheckCircle2Icon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Project } from '../types';
import { ProjectImport } from './ProjectImport';
import { ProjectListSkeleton } from './LoadingSkeleton';
interface ProjectListProps {
  canManage: boolean;
  onSelectProject: (projectId: string) => void;
}

export function ProjectList({ canManage, onSelectProject }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    project_type: 'vývoj' as const,
    project_category: 'klientský' as const,
    client_company_name: '',
    client_contact_person: '',
    client_phone: '',
    client_email: '',
    client_ico: '',
    price_offer: '',
    hour_budget: '',
    start_date: '',
    delivery_date: '',
    status: 'aktivní' as const
  });

  useEffect(() => {
    loadCurrentUser();
    loadProjects();
  }, []);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  }

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    if (!projectForm.name.trim()) {
      alert('Vyplňte název projektu');
      return;
    }

    const { error } = await supabase
      .from('projects')
      .insert({
        name: projectForm.name,
        description: projectForm.description || null,
        project_type: projectForm.project_type,
        project_category: projectForm.project_category,
        client_company_name: projectForm.client_company_name || null,
        client_contact_person: projectForm.client_contact_person || null,
        client_phone: projectForm.client_phone || null,
        client_email: projectForm.client_email || null,
        client_ico: projectForm.client_ico || null,
        price_offer: projectForm.price_offer ? Number(projectForm.price_offer) : null,
        hour_budget: projectForm.hour_budget ? Number(projectForm.hour_budget) : null,
        start_date: projectForm.start_date || null,
        delivery_date: projectForm.delivery_date || null,
        status: projectForm.status,
        priority: 'medium',
        created_by: currentUserId
      });

    if (error) {
      console.error('Error creating project:', error);
      alert('Chyba při vytváření projektu');
      return;
    }

    setProjectForm({
      name: '',
      description: '',
      project_type: 'vývoj',
      project_category: 'klientský',
      client_company_name: '',
      client_contact_person: '',
      client_phone: '',
      client_email: '',
      client_ico: '',
      price_offer: '',
      hour_budget: '',
      start_date: '',
      delivery_date: '',
      status: 'aktivní'
    });
    setShowCreateForm(false);
    loadProjects();
  }

  async function deleteProject(projectId: string, projectName: string, e: React.MouseEvent) {
    e.stopPropagation();

    if (!confirm(`Opravdu chcete smazat projekt "${projectName}"?\n\nTato akce je nevratná a smaže i všechny fáze, časové záznamy a milestones.`)) {
      return;
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      console.error('Error deleting project:', error);
      alert('Chyba při mazání projektu: ' + error.message);
      return;
    }

    loadProjects();
  }

  function formatRelativeTime(dateString: string | null): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'právě teď';
    if (diffMinutes < 60) return `před ${diffMinutes} min`;
    if (diffHours < 24) return `před ${diffHours} h`;
    if (diffDays < 7) return `před ${diffDays} dny`;
    if (diffDays < 30) return `před ${Math.floor(diffDays / 7)} týdny`;
    if (diffDays < 365) return `před ${Math.floor(diffDays / 30)} měsíci`;
    return `před ${Math.floor(diffDays / 365)} roky`;
  }

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (project.client_company_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (project.client_contact_person?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <ProjectListSkeleton />;
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <header className="bg-dark border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <BriefcaseIcon className="w-6 h-6 text-white" />
            <h1 className="text-xl font-semibold text-white">Projekty</h1>
          </div>

          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Hledat projekty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 w-64"
            />
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <DownloadIcon className="w-4 h-4" />
              Import
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Nový projekt
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-auto p-6">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <BriefcaseIcon className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              {searchTerm ? 'Žádné projekty nenalezeny' : 'Zatím žádné projekty'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm
                ? 'Zkuste upravit vyhledávací kritéria'
                : 'Začněte vytvořením prvního projektu'}
            </p>
            {!searchTerm && canManage && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Vytvořit projekt
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer relative group"
              >
                {canManage && (
                  <button
                    onClick={(e) => deleteProject(project.id, project.name, e)}
                    className="absolute top-3 right-3 p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Smazat projekt"
                  >
                    <Trash2Icon className="w-4 h-4" />
                  </button>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{project.name}</h3>
                      {project.sync_enabled && project.import_source_url && (
                        <div
                          className="flex items-center gap-1 text-xs text-green-600"
                          title={`Synchronizováno ${formatRelativeTime(project.last_sync_at)}`}
                        >
                          <CheckCircle2Icon className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          project.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {project.status === 'active' ? 'Aktivní' : 'Neaktivní'}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          project.priority === 'high' || project.priority === 'urgent'
                            ? 'bg-red-100 text-red-700'
                            : project.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {project.priority === 'urgent' ? 'Urgentní' :
                         project.priority === 'high' ? 'Vysoká' :
                         project.priority === 'medium' ? 'Střední' : 'Nízká'}
                      </span>
                    </div>
                  </div>
                </div>

                {project.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                    {project.description}
                  </p>
                )}

                {project.client_company_name && (
                  <div className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">Klient:</span> {project.client_company_name}
                  </div>
                )}

                <div className="space-y-2 mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {(project.price_offer || project.budget) && (
                      <div className="flex items-center gap-1">
                        <DollarSignIcon className="w-3 h-3" />
                        {(project.price_offer || project.budget || 0).toLocaleString('cs-CZ')} Kč
                      </div>
                    )}
                    {(project.delivery_date || project.deadline) && (
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        {new Date(project.delivery_date || project.deadline!).toLocaleDateString('cs-CZ')}
                      </div>
                    )}
                    {project.project_type && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                        {project.project_type}
                      </span>
                    )}
                  </div>
                  {project.sync_enabled && project.last_sync_at && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <RefreshCwIcon className="w-3 h-3" />
                      <span>Synchronizováno {formatRelativeTime(project.last_sync_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Nový projekt</h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                <XIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Typ zakázky *
                  </label>
                  <select
                    value={projectForm.project_type}
                    onChange={(e) => setProjectForm({ ...projectForm, project_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="vývoj">Vývoj</option>
                    <option value="tvorba webu">Tvorba webu</option>
                    <option value="grafika">Grafika</option>
                    <option value="integrace">Integrace</option>
                    <option value="převzetí do správy">Převzetí do správy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zařazení projektu *
                  </label>
                  <select
                    value={projectForm.project_category}
                    onChange={(e) => setProjectForm({ ...projectForm, project_category: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="interní">Interní</option>
                    <option value="klientský">Klientský</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Název projektu *
                </label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Název projektu"
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Údaje o zadavateli (klientovi)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Název firmy
                    </label>
                    <input
                      type="text"
                      value={projectForm.client_company_name}
                      onChange={(e) => setProjectForm({ ...projectForm, client_company_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="Název firmy klienta"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kontaktní osoba
                      </label>
                      <input
                        type="text"
                        value={projectForm.client_contact_person}
                        onChange={(e) => setProjectForm({ ...projectForm, client_contact_person: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="Jméno a příjmení"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        IČO
                      </label>
                      <input
                        type="text"
                        value={projectForm.client_ico}
                        onChange={(e) => setProjectForm({ ...projectForm, client_ico: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="IČO"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Telefon
                      </label>
                      <input
                        type="tel"
                        value={projectForm.client_phone}
                        onChange={(e) => setProjectForm({ ...projectForm, client_phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="+420 123 456 789"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={projectForm.client_email}
                        onChange={(e) => setProjectForm({ ...projectForm, client_email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="email@klient.cz"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Rozpočet a termíny</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cenová nabídka (Kč)
                    </label>
                    <input
                      type="number"
                      value={projectForm.price_offer}
                      onChange={(e) => setProjectForm({ ...projectForm, price_offer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hodinový rozpočet (h)
                    </label>
                    <input
                      type="number"
                      value={projectForm.hour_budget}
                      onChange={(e) => setProjectForm({ ...projectForm, hour_budget: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Datum zahájení
                    </label>
                    <input
                      type="date"
                      value={projectForm.start_date}
                      onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Datum dodání
                    </label>
                    <input
                      type="date"
                      value={projectForm.delivery_date}
                      onChange={(e) => setProjectForm({ ...projectForm, delivery_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stav projektu
                </label>
                <select
                  value={projectForm.status}
                  onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="aktivní">Aktivní</option>
                  <option value="pozastaven">Pozastaven</option>
                  <option value="čeká se na klienta">Čeká se na klienta</option>
                  <option value="zrušen">Zrušen</option>
                  <option value="dokončen">Dokončen</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Popis projektu
                </label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Podrobný popis projektu..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
              >
                Zrušit
              </button>
              <button
                onClick={createProject}
                className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors"
              >
                Vytvořit projekt
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportForm && (
        <ProjectImport
          onClose={() => setShowImportForm(false)}
          onImportComplete={() => {
            loadProjects();
            setShowImportForm(false);
          }}
        />
      )}

    </div>
  );
}
