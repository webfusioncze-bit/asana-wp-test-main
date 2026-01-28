import { useState, useEffect, useRef } from 'react';
import { BriefcaseIcon, SearchIcon, CalendarIcon, DollarSignIcon, ClockIcon, AlertTriangleIcon, CheckCircleIcon, RefreshCwIcon, TrendingUpIcon, TagIcon, FilterIcon, XIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Project, ProjectTag, User } from '../types';

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
  tags?: ProjectTag[];
  assigned_user_ids?: string[];
}

export function ProjectList({ canManage, onSelectProject, selectedProjectId, showCompleted, onToggleCompleted }: ProjectListProps) {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [allTags, setAllTags] = useState<ProjectTag[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const letterRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    loadProjects();
    loadUsers();
    loadTags();
  }, [showCompleted]);

  async function loadUsers() {
    const { data } = await supabase
      .from('user_profiles_view')
      .select('*')
      .order('display_name');

    if (data) {
      setUsers(data);
    }
  }

  async function loadTags() {
    const { data } = await supabase
      .from('project_tags')
      .select('*')
      .order('name');

    if (data) {
      setAllTags(data);
    }
  }

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
          .select('id, assigned_user_id')
          .eq('project_id', project.id);

        const { data: tagAssignments } = await supabase
          .from('project_tag_assignments')
          .select('tag_id, project_tags(*)')
          .eq('project_id', project.id);

        const projectTags = (tagAssignments || [])
          .map(ta => ta.project_tags)
          .filter(Boolean) as ProjectTag[];

        const assignedUserIds = [...new Set(
          (phases || [])
            .map(p => p.assigned_user_id)
            .filter(Boolean) as string[]
        )];

        if (!phases || phases.length === 0) {
          return {
            ...project,
            total_hours: 0,
            hour_budget_percentage: 0,
            is_over_budget: false,
            tags: projectTags,
            assigned_user_ids: assignedUserIds,
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
          tags: projectTags,
          assigned_user_ids: assignedUserIds,
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

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.client_company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.client_contact_person || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedTagIds.length > 0) {
      const projectTagIds = (project.tags || []).map(tag => tag.id);
      const hasSelectedTag = selectedTagIds.some(tagId => projectTagIds.includes(tagId));
      if (!hasSelectedTag) return false;
    }

    if (selectedUserIds.length > 0) {
      const projectUserIds = project.assigned_user_ids || [];
      const hasSelectedUser = selectedUserIds.some(userId => projectUserIds.includes(userId));
      if (!hasSelectedUser) return false;
    }

    return true;
  });

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

  const toggleUserFilter = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const clearFilters = () => {
    setSelectedUserIds([]);
    setSelectedTagIds([]);
  };

  const hasActiveFilters = selectedUserIds.length > 0 || selectedTagIds.length > 0;

  const predefinedColors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#64748b', '#6b7280', '#000000'
  ];

  async function createTag() {
    if (!newTagName.trim()) return;

    const { data: newTag, error } = await supabase
      .from('project_tags')
      .insert({
        name: newTagName.trim(),
        color: newTagColor,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating tag:', error);
      return;
    }

    if (newTag) {
      setAllTags(prev => [...prev, newTag]);
    }

    setNewTagName('');
    setNewTagColor('#3b82f6');
  }

  async function deleteTag(tagId: string) {
    if (!confirm('Opravdu chcete odstranit tento štítek? Bude odstraněn ze všech projektů.')) return;

    const { error } = await supabase
      .from('project_tags')
      .delete()
      .eq('id', tagId);

    if (error) {
      console.error('Error deleting tag:', error);
      return;
    }

    setAllTags(prev => prev.filter(t => t.id !== tagId));
    await loadProjects();
  }

  return (
    <div className="flex-1 flex flex-col bg-white h-full">
      <div className="border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-semibold text-gray-900">Projekty</h1>
          <div className="flex items-center gap-3">
            {canManage && (
              <button
                onClick={() => setShowTagManager(!showTagManager)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <TagIcon className="w-4 h-4" />
                Spravovat štítky
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                hasActiveFilters
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FilterIcon className="w-4 h-4" />
              Filtry
              {hasActiveFilters && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {selectedUserIds.length + selectedTagIds.length}
                </span>
              )}
            </button>
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

        {showTagManager && canManage && (
          <div className="mt-3 p-4 bg-white border border-gray-200 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Správa štítků</h3>
              <button
                onClick={() => setShowTagManager(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Název nového štítku
                </label>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Např. Prioritní, Interní..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      createTag();
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block">
                  Barva štítku
                </label>
                <div className="flex flex-wrap gap-2">
                  {predefinedColors.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewTagColor(color)}
                      className={`w-8 h-8 rounded-lg transition-all ${
                        newTagColor === color
                          ? 'ring-2 ring-offset-2 ring-blue-500 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={createTag}
                disabled={!newTagName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <TagIcon className="w-4 h-4" />
                Vytvořit štítek
              </button>
            </div>

            {allTags.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-xs font-medium text-gray-700 mb-3">Existující štítky ({allTags.length})</h4>
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => (
                    <div
                      key={tag.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border"
                      style={{
                        backgroundColor: tag.color + '10',
                        color: tag.color,
                        borderColor: tag.color + '30',
                      }}
                    >
                      <TagIcon className="w-3.5 h-3.5" />
                      <span>{tag.name}</span>
                      <button
                        onClick={() => deleteTag(tag.id)}
                        className="ml-1 hover:opacity-70"
                        title="Odstranit štítek"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {showFilters && (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Aktivní filtry</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Vymazat vše
                </button>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">
                Přiřazení uživatelé ve fázích
              </label>
              <div className="flex flex-wrap gap-2">
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => toggleUserFilter(user.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedUserIds.includes(user.id)
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-200'
                    }`}
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.display_name || user.email}
                        className="w-5 h-5 rounded-full"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-xs text-white font-medium">
                        {(user.display_name || user.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span>{user.display_name || user.email}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block">
                Štítky
              </label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTagFilter(tag.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedTagIds.includes(tag.id)
                        ? 'border-2 shadow-sm'
                        : 'border hover:shadow-sm'
                    }`}
                    style={{
                      backgroundColor: selectedTagIds.includes(tag.id) ? tag.color + '20' : 'white',
                      borderColor: selectedTagIds.includes(tag.id) ? tag.color : '#e5e7eb',
                      color: tag.color,
                    }}
                  >
                    <TagIcon className="w-3.5 h-3.5" />
                    <span className="font-medium">{tag.name}</span>
                  </button>
                ))}
                {allTags.length === 0 && (
                  <p className="text-sm text-gray-500">Zatím nejsou vytvořeny žádné štítky</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex relative overflow-hidden">
        <div className="flex-1 overflow-y-auto h-full">
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
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm font-medium text-gray-900">{project.name}</h3>
                                    {project.sync_enabled && project.last_sync_at && (
                                      <RefreshCwIcon className="w-3 h-3 text-green-500 flex-shrink-0" title="Synchronizováno z portálu" />
                                    )}
                                    {project.tags && project.tags.length > 0 && (
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        {project.tags.slice(0, 3).map(tag => (
                                          <span
                                            key={tag.id}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                                            style={{
                                              backgroundColor: tag.color + '20',
                                              color: tag.color,
                                            }}
                                          >
                                            {tag.name}
                                          </span>
                                        ))}
                                        {project.tags.length > 3 && (
                                          <span className="text-xs text-gray-400">
                                            +{project.tags.length - 3}
                                          </span>
                                        )}
                                      </div>
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
