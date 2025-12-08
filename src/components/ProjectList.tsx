import { useState, useEffect, useRef } from 'react';
import { BriefcaseIcon, SearchIcon, CalendarIcon, DollarSignIcon, ClockIcon, AlertTriangleIcon, CheckCircleIcon, RefreshCwIcon, TrendingUpIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Project } from '../types';

interface ProjectListProps {
  canManage: boolean;
  onSelectProject: (projectId: string) => void;
  selectedProjectId: string | null;
  showCompleted: boolean;
  onToggleCompleted: (show: boolean) => void;
}

interface ProjectWithStats extends Project {
  total_hours: number;
  hour_budget_percentage: number;
  is_over_budget: boolean;
}

export function ProjectList({ canManage, onSelectProject, selectedProjectId, showCompleted, onToggleCompleted }: ProjectListProps) {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const letterRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    loadProjects();
  }, [showCompleted]);

  async function loadProjects() {
    setLoading(true);

    const statusFilter = showCompleted ? 'dokončen' : 'aktivní';

    const { data: projectsData, error } = await supabase
      .from('projects')
      .select('*')
      .eq('status', statusFilter)
      .order('name');

    if (error) {
      console.error('Error loading projects:', error);
      setLoading(false);
      return;
    }

    const projectsWithStats = await Promise.all(
      (projectsData || []).map(async (project) => {
        const { data: phases } = await supabase
          .from('project_phases')
          .select('id')
          .eq('project_id', project.id);

        if (!phases || phases.length === 0) {
          return {
            ...project,
            total_hours: 0,
            hour_budget_percentage: 0,
            is_over_budget: false,
          };
        }

        const phaseIds = phases.map(p => p.id);

        const { data: timeEntries } = await supabase
          .from('project_time_entries')
          .select('hours')
          .in('phase_id', phaseIds);

        const total_hours = (timeEntries || []).reduce((sum, entry) => sum + (entry.hours || 0), 0);
        const hour_budget = project.hour_budget || 0;
        const hour_budget_percentage = hour_budget > 0 ? (total_hours / hour_budget) * 100 : 0;
        const is_over_budget = hour_budget > 0 && total_hours > hour_budget;

        return {
          ...project,
          total_hours,
          hour_budget_percentage,
          is_over_budget,
        };
      })
    );

    setProjects(projectsWithStats);
    setLoading(false);
  }

  const getFirstLetter = (name: string): string => {
    const firstChar = name.charAt(0).toUpperCase();
    return /[A-Z]/.test(firstChar) ? firstChar : '#';
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.client_company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.client_contact_person || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    return a.name.localeCompare(b.name, 'cs');
  });

  const projectsByLetter: { [key: string]: ProjectWithStats[] } = {};
  sortedProjects.forEach((project) => {
    const letter = getFirstLetter(project.name);
    if (!projectsByLetter[letter]) {
      projectsByLetter[letter] = [];
    }
    projectsByLetter[letter].push(project);
  });

  const availableLetters = Object.keys(projectsByLetter).sort();
  const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');

  const scrollToLetter = (letter: string) => {
    const element = letterRefs.current[letter];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <p className="text-gray-500">Načítání projektů...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <div className="border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-semibold text-gray-900">Projekty</h1>
          <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onToggleCompleted(false)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                !showCompleted
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Aktivní
            </button>
            <button
              onClick={() => onToggleCompleted(true)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                showCompleted
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dokončené
            </button>
          </div>
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Vyhledat projekt..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-auto">
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <BriefcaseIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Zatím nejsou synchronizovány žádné projekty</p>
              <p className="text-gray-400 text-sm">Projekty se synchronizují automaticky z portálu</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Žádné projekty neodpovídají vyhledávání</p>
            </div>
          ) : (
            <div>
              {availableLetters.map((letter) => (
                <div key={letter}>
                  <div
                    ref={(el) => (letterRefs.current[letter] = el)}
                    className="sticky top-0 bg-gray-50 border-b border-gray-200 px-6 py-2 z-10"
                  >
                    <h2 className="text-lg font-semibold text-gray-700">{letter}</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {projectsByLetter[letter].map((project) => {
                      const budgetStatus = project.hour_budget && project.hour_budget > 0 ? (
                        project.is_over_budget ? {
                          label: 'Přečerpáno',
                          color: 'text-red-600',
                          bgColor: 'bg-red-50',
                          icon: AlertTriangleIcon
                        } : project.hour_budget_percentage > 90 ? {
                          label: 'Blíží se limitu',
                          color: 'text-orange-500',
                          bgColor: 'bg-orange-50',
                          icon: AlertTriangleIcon
                        } : {
                          label: 'V rozpočtu',
                          color: 'text-green-600',
                          bgColor: 'bg-green-50',
                          icon: CheckCircleIcon
                        }
                      ) : null;

                      return (
                        <div
                          key={project.id}
                          onClick={() => onSelectProject(project.id)}
                          className={`group px-6 py-2.5 cursor-pointer transition-all hover:bg-gray-50 ${
                            selectedProjectId === project.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <BriefcaseIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-medium text-gray-900 truncate">{project.name}</h3>
                                    {project.sync_enabled && project.last_sync_at && (
                                      <RefreshCwIcon className="w-3 h-3 text-green-500" title="Synchronizováno z portálu" />
                                    )}
                                  </div>
                                  {project.client_company_name && (
                                    <p className="text-xs text-gray-500 truncate">{project.client_company_name}</p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-4 flex-shrink-0">
                                {project.hour_budget && project.hour_budget > 0 && (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 text-xs">
                                      <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                                      <span className={`font-medium ${project.is_over_budget ? 'text-red-600' : 'text-gray-600'}`}>
                                        {project.total_hours.toFixed(1)}h
                                      </span>
                                      <span className="text-gray-400">/</span>
                                      <span className="text-gray-600">{project.hour_budget}h</span>
                                    </div>
                                    {budgetStatus && (
                                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${budgetStatus.bgColor}`}>
                                        <budgetStatus.icon className={`w-3 h-3 ${budgetStatus.color}`} />
                                        <span className={`text-xs font-medium ${budgetStatus.color}`}>
                                          {budgetStatus.label}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {project.price_offer && (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <DollarSignIcon className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-gray-600">
                                      {project.price_offer.toLocaleString('cs-CZ')} Kč
                                    </span>
                                  </div>
                                )}

                                {project.delivery_date && (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-gray-600">
                                      {new Date(project.delivery_date).toLocaleDateString('cs-CZ')}
                                    </span>
                                  </div>
                                )}

                                <div className="flex items-center gap-2">
                                  {project.status && (
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded-full ${
                                        project.status === 'active'
                                          ? 'bg-green-100 text-green-700'
                                          : project.status === 'completed'
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-gray-100 text-gray-700'
                                      }`}
                                    >
                                      {project.status === 'active' ? 'Aktivní' :
                                       project.status === 'completed' ? 'Dokončen' :
                                       project.status}
                                    </span>
                                  )}
                                  {project.priority && (
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
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-8 border-l border-gray-200 bg-gray-50 flex flex-col items-center py-2 gap-0.5 overflow-y-auto flex-shrink-0">
          {allLetters.map((letter) => (
            <button
              key={letter}
              onClick={() => scrollToLetter(letter)}
              disabled={!availableLetters.includes(letter)}
              className={`text-[10px] w-6 h-6 flex items-center justify-center rounded transition-colors ${
                availableLetters.includes(letter)
                  ? 'text-blue-600 hover:bg-blue-100 cursor-pointer'
                  : 'text-gray-300 cursor-default'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
