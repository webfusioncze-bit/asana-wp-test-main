import { useState, useEffect } from 'react';
import { BriefcaseIcon, PlusIcon, SearchIcon, XIcon, CalendarIcon, DollarSignIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Project } from '../types';
import { ProjectDetail } from './ProjectDetail';

interface ProjectListProps {
  canManage: boolean;
}

export function ProjectList({ canManage }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    client_name: '',
    budget: '',
    deadline: '',
    priority: 'medium',
    status: 'active'
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
        client_name: projectForm.client_name || null,
        budget: projectForm.budget ? Number(projectForm.budget) : null,
        deadline: projectForm.deadline || null,
        priority: projectForm.priority,
        status: projectForm.status,
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
      client_name: '',
      budget: '',
      deadline: '',
      priority: 'medium',
      status: 'active'
    });
    setShowCreateForm(false);
    loadProjects();
  }

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (project.client_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Načítání projektů...</div>
      </div>
    );
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
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Nový projekt
          </button>
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
                onClick={() => setSelectedProject(project)}
                className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{project.name}</h3>
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

                {project.client_name && (
                  <div className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">Klient:</span> {project.client_name}
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
                  {project.budget && (
                    <div className="flex items-center gap-1">
                      <DollarSignIcon className="w-3 h-3" />
                      {project.budget.toLocaleString('cs-CZ')} Kč
                    </div>
                  )}
                  {project.deadline && (
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {new Date(project.deadline).toLocaleDateString('cs-CZ')}
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

            <div className="p-6 space-y-4">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Popis
                </label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Popis projektu"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Klient
                  </label>
                  <input
                    type="text"
                    value={projectForm.client_name}
                    onChange={(e) => setProjectForm({ ...projectForm, client_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Název klienta"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Budget (Kč)
                  </label>
                  <input
                    type="number"
                    value={projectForm.budget}
                    onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={projectForm.deadline}
                    onChange={(e) => setProjectForm({ ...projectForm, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priorita
                  </label>
                  <select
                    value={projectForm.priority}
                    onChange={(e) => setProjectForm({ ...projectForm, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="low">Nízká</option>
                    <option value="medium">Střední</option>
                    <option value="high">Vysoká</option>
                    <option value="urgent">Urgentní</option>
                  </select>
                </div>
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

      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onUpdate={loadProjects}
          canManage={canManage}
        />
      )}
    </div>
  );
}
