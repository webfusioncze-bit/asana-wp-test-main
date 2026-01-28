import { useState, useEffect, useRef } from 'react';
import { ArrowLeft as ArrowLeftIcon, Plus as PlusIcon, Bitcoin as EditIcon, Save as SaveIcon, Bone as XIcon, Trash as TrashIcon, Clock as ClockIcon, UserPlus as UserPlusIcon, RefreshCw as RefreshCwIcon, FolderOpen as FolderOpenIcon, Folder as FolderIcon, CheckCircle2 as CheckCircle2Icon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Project, ProjectPhase, ProjectPhaseAssignment, ProjectTimeEntry, User, ProjectPhaseTag } from '../types';
import { ProjectMilestones } from './ProjectMilestones';
import { ProjectTagsManager } from './ProjectTagsManager';
import { ProjectPhaseTagsManager } from './ProjectPhaseTagsManager';
import { TimeEntryTagsEdit } from './TimeEntryTagsEdit';

interface ProjectDetailProps {
  projectId: string;
  onClose: () => void;
  onProjectChange: (projectId: string) => void;
  canManage: boolean;
}

export function ProjectDetail({ projectId, onClose, onProjectChange, canManage }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [assignments, setAssignments] = useState<Record<string, ProjectPhaseAssignment[]>>({});
  const [timeEntries, setTimeEntries] = useState<Record<string, ProjectTimeEntry[]>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [showPhaseForm, setShowPhaseForm] = useState(false);
  const [showTimeFormForPhase, setShowTimeFormForPhase] = useState<string | null>(null);
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<ProjectPhaseTag[]>([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [timeEntryTags, setTimeEntryTags] = useState<Record<string, string[]>>({});
  const phaseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    project_type: '',
    project_category: '',
    client_company_name: '',
    client_contact_person: '',
    client_phone: '',
    client_email: '',
    client_ico: '',
    price_offer: 0,
    hour_budget: 0,
    start_date: '',
    delivery_date: '',
    status: 'aktivní'
  });

  const [phaseForm, setPhaseForm] = useState({
    name: '',
    description: '',
    status: 'čeká na zahájení',
    estimated_hours: 0,
    start_date: '',
    end_date: ''
  });

  const [timeForm, setTimeForm] = useState({
    description: '',
    hours: '',
    entry_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadProject();
    loadCurrentUser();
    loadPhases();
    loadUsers();
    loadAllProjects();
    loadAvailableTags();
  }, [projectId]);

  useEffect(() => {
    if (phases.length > 0) {
      loadAllTimeEntryTags();
    }
  }, [phases, timeEntries]);

  useEffect(() => {
    if (phases.length === 0) return;

    const phaseIds = new Set(phases.map(p => p.id));

    const channel = supabase
      .channel('project_time_entries_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_time_entries'
        },
        (payload) => {
          const newEntry = payload.new as ProjectTimeEntry;
          if (phaseIds.has(newEntry.phase_id)) {
            setTimeEntries(prev => ({
              ...prev,
              [newEntry.phase_id]: [newEntry, ...(prev[newEntry.phase_id] || [])]
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [phases]);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      let closestPhase: string | null = null;
      let closestDistance = Infinity;

      Object.entries(phaseRefs.current).forEach(([phaseId, element]) => {
        if (element) {
          const rect = element.getBoundingClientRect();
          const distance = Math.abs(rect.top - 100);
          if (distance < closestDistance && rect.top < window.innerHeight / 2) {
            closestDistance = distance;
            closestPhase = phaseId;
          }
        }
      });

      if (closestPhase) {
        setActivePhaseId(closestPhase);
      }
    };

    const scrollContainer = document.querySelector('.project-detail-content');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [phases]);

  function scrollToPhase(phaseId: string) {
    const element = phaseRefs.current[phaseId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActivePhaseId(phaseId);
    }
  }

  async function loadProject() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (error) {
      console.error('Error loading project:', error);
      setLoading(false);
      return;
    }

    setProject(data);
    setProjectForm({
      name: data?.name || '',
      description: data?.description || '',
      project_type: data?.project_type || '',
      project_category: data?.project_category || '',
      client_company_name: data?.client_company_name || '',
      client_contact_person: data?.client_contact_person || '',
      client_phone: data?.client_phone || '',
      client_email: data?.client_email || '',
      client_ico: data?.client_ico || '',
      price_offer: data?.price_offer || 0,
      hour_budget: data?.hour_budget || 0,
      start_date: data?.start_date || '',
      delivery_date: data?.delivery_date || '',
      status: data?.status || 'aktivní'
    });
    setLoading(false);
  }

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  }

  async function loadPhases() {
    const { data, error } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', projectId)
      .is('parent_phase_id', null)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading phases:', error);
      return;
    }

    setPhases(data || []);

    for (const phase of data || []) {
      await loadPhaseAssignments(phase.id);
      await loadPhaseTimeEntries(phase.id);
    }
  }

  async function loadPhaseAssignments(phaseId: string) {
    const { data, error } = await supabase
      .from('project_phase_assignments')
      .select('*')
      .eq('phase_id', phaseId);

    if (error) {
      console.error('Error loading assignments:', error);
      return;
    }

    setAssignments(prev => ({ ...prev, [phaseId]: data || [] }));
  }

  async function loadPhaseTimeEntries(phaseId: string) {
    const { data, error } = await supabase
      .from('project_time_entries')
      .select('*')
      .eq('phase_id', phaseId)
      .order('entry_date', { ascending: false });

    if (error) {
      console.error('Error loading time entries:', error);
      return;
    }

    setTimeEntries(prev => ({ ...prev, [phaseId]: data || [] }));
  }

  async function loadUsers() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*');

    if (error) {
      console.error('Error loading users:', error);
    } else {
      setUsers(data || []);
    }
  }

  async function loadAllProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, status')
      .order('name');

    if (!error && data) {
      setAllProjects(data);
    }
  }

  async function loadAvailableTags() {
    const { data } = await supabase
      .from('project_phase_tags')
      .select('*')
      .order('name');

    if (data) {
      setAvailableTags(data);
    }
  }

  async function loadAllTimeEntryTags() {
    const allEntryIds = Object.values(timeEntries).flat().map(e => e.id);
    if (allEntryIds.length === 0) return;

    const { data } = await supabase
      .from('project_time_entry_tags')
      .select('time_entry_id, tag_id')
      .in('time_entry_id', allEntryIds);

    if (data) {
      const tagsMap: Record<string, string[]> = {};
      data.forEach(item => {
        if (!tagsMap[item.time_entry_id]) {
          tagsMap[item.time_entry_id] = [];
        }
        tagsMap[item.time_entry_id].push(item.tag_id);
      });
      setTimeEntryTags(tagsMap);
    }
  }

  async function saveProject() {
    if (!projectForm.name.trim()) {
      alert('Vyplňte název projektu');
      return;
    }

    const { error } = await supabase
      .from('projects')
      .update({
        name: projectForm.name,
        description: projectForm.description,
        project_type: projectForm.project_type,
        project_category: projectForm.project_category,
        client_company_name: projectForm.client_company_name,
        client_contact_person: projectForm.client_contact_person || null,
        client_phone: projectForm.client_phone || null,
        client_email: projectForm.client_email || null,
        client_ico: projectForm.client_ico || null,
        price_offer: projectForm.price_offer || null,
        hour_budget: projectForm.hour_budget || null,
        start_date: projectForm.start_date || null,
        delivery_date: projectForm.delivery_date || null,
        status: projectForm.status
      })
      .eq('id', projectId);

    if (error) {
      console.error('Error updating project:', error);
      alert('Chyba při aktualizaci projektu');
      return;
    }

    setEditingProject(false);
    loadProject();
  }

  async function addPhase() {
    if (!phaseForm.name.trim()) {
      alert('Vyplňte název fáze');
      return;
    }

    const maxPosition = phases.length > 0 ? Math.max(...phases.map(p => p.position || 0)) : 0;

    const { error } = await supabase
      .from('project_phases')
      .insert({
        project_id: projectId,
        name: phaseForm.name,
        description: phaseForm.description,
        status: phaseForm.status,
        estimated_hours: phaseForm.estimated_hours || null,
        start_date: phaseForm.start_date || null,
        end_date: phaseForm.end_date || null,
        position: maxPosition + 1
      });

    if (error) {
      console.error('Error creating phase:', error);
      alert('Chyba při vytváření fáze');
      return;
    }

    setPhaseForm({
      name: '',
      description: '',
      status: 'čeká na zahájení',
      estimated_hours: 0,
      start_date: '',
      end_date: ''
    });
    setShowPhaseForm(false);
    loadPhases();
  }

  async function updatePhase(phaseId: string) {
    const phase = phases.find(p => p.id === phaseId);
    if (!phase) return;

    const { error } = await supabase
      .from('project_phases')
      .update({
        name: phase.name,
        description: phase.description,
        status: phase.status,
        estimated_hours: phase.estimated_hours,
        start_date: phase.start_date,
        end_date: phase.end_date
      })
      .eq('id', phaseId);

    if (error) {
      console.error('Error updating phase:', error);
      alert('Chyba při aktualizaci fáze');
      return;
    }

    setEditingPhaseId(null);
    loadPhases();
  }

  async function deletePhase(phaseId: string) {
    if (!confirm('Opravdu chcete smazat tuto fázi?')) return;

    const { error } = await supabase
      .from('project_phases')
      .delete()
      .eq('id', phaseId);

    if (error) {
      console.error('Error deleting phase:', error);
      alert('Chyba při mazání fáze');
      return;
    }

    loadPhases();
  }

  async function assignUserToPhase(phaseId: string, userId: string) {
    const { error } = await supabase
      .from('project_phase_assignments')
      .insert({
        phase_id: phaseId,
        user_id: userId,
        role: 'člen týmu'
      });

    if (error) {
      console.error('Error assigning user:', error);
      return;
    }

    loadPhaseAssignments(phaseId);
  }

  async function removeAssignment(assignmentId: string, phaseId: string) {
    const { error } = await supabase
      .from('project_phase_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      console.error('Error removing assignment:', error);
      return;
    }

    loadPhaseAssignments(phaseId);
  }

  async function addTimeEntry(phaseId: string) {
    if (!timeForm.description.trim() || !timeForm.hours || Number(timeForm.hours) <= 0) {
      alert('Vyplňte činnost a čas');
      return;
    }

    const { error } = await supabase
      .from('project_time_entries')
      .insert({
        phase_id: phaseId,
        user_id: currentUserId,
        description: timeForm.description,
        hours: Number(timeForm.hours),
        entry_date: timeForm.entry_date
      });

    if (error) {
      console.error('Error adding time entry:', error);
      alert('Chyba při přidání časového záznamu');
      return;
    }

    setTimeForm({
      description: '',
      hours: '',
      entry_date: new Date().toISOString().split('T')[0]
    });
    setShowTimeFormForPhase(null);
    loadPhaseTimeEntries(phaseId);
  }

  async function deleteTimeEntry(entryId: string, phaseId: string) {
    if (!confirm('Opravdu chcete smazat tento časový záznam?')) return;

    const { error } = await supabase
      .from('project_time_entries')
      .delete()
      .eq('id', entryId);

    if (error) {
      console.error('Error deleting time entry:', error);
      return;
    }

    loadPhaseTimeEntries(phaseId);
  }

  function getUserName(userId: string): string {
    const user = users.find(u => u.id === userId);
    return user?.display_name || user?.email || 'Neznámý uživatel';
  }

  function getTotalHours(phaseId: string): number {
    const entries = timeEntries[phaseId] || [];
    return entries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  }

  function canAddTimeToPhase(phaseId: string): boolean {
    const phaseAssignments = assignments[phaseId] || [];
    return canManage || phaseAssignments.some(a => a.user_id === currentUserId);
  }

  function calculateProjectStats() {
    let totalSpentHours = 0;
    let totalEstimatedHours = 0;

    phases.forEach(phase => {
      const phaseSpent = getTotalHours(phase.id);
      totalSpentHours += phaseSpent;

      if (phase.estimated_hours) {
        totalEstimatedHours += phase.estimated_hours;
      }
    });

    const budgetPercentage = project?.hour_budget ? (totalSpentHours / project.hour_budget) * 100 : 0;

    const daysToDeadline = project?.delivery_date
      ? Math.ceil((new Date(project.delivery_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      totalSpentHours,
      totalEstimatedHours,
      budgetPercentage,
      daysToDeadline
    };
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

  function isPhaseOverBudget(phaseId: string): boolean {
    const phase = phases.find(p => p.id === phaseId);
    if (!phase || !phase.estimated_hours) return false;
    return getTotalHours(phaseId) > phase.estimated_hours;
  }

  function updatePhaseField(phaseId: string, field: string, value: any) {
    setPhases(phases.map(p => p.id === phaseId ? { ...p, [field]: value } : p));
  }

  const statusColors: Record<string, string> = {
    'čeká na zahájení': 'bg-gray-100 text-gray-700',
    'fáze probíhá': 'bg-blue-100 text-blue-700',
    'čeká se na klienta': 'bg-yellow-100 text-yellow-700',
    'zrušena': 'bg-red-100 text-red-700',
    'dokončena': 'bg-green-100 text-green-700'
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Načítání projektu...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Projekt nenalezen</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-gray-50 h-full overflow-hidden">
      <div className="w-56 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors w-full"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            <span>Zpět na projekty</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {project && (
            <div className="mb-4 pb-3 border-b border-gray-200">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Projekt
              </div>
              <div className="text-sm font-bold text-gray-900 mb-1">{project.name}</div>
              {project.status && (
                <div className="text-xs text-gray-500 mb-2">{project.status}</div>
              )}
              {project.sync_enabled && project.import_source_url && (
                <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 rounded px-2 py-1.5 mt-2">
                  <CheckCircle2Icon className="w-3 h-3 flex-shrink-0" />
                  <span className="text-xs">Synchronizováno</span>
                </div>
              )}
              {project.last_sync_at && (
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1.5">
                  <RefreshCwIcon className="w-3 h-3" />
                  <span>{formatRelativeTime(project.last_sync_at)}</span>
                </div>
              )}
            </div>
          )}

          {project && phases.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Fáze projektu
              </div>
            </div>
          )}

          <div className="space-y-1">
            {phases.map((phase) => {
              const assignedUser = phase.assigned_user_id ? users.find(u => u.id === phase.assigned_user_id) : null;
              const isActive = activePhaseId === phase.id;
              const isOverBudget = isPhaseOverBudget(phase.id);

              return (
                <button
                  key={phase.id}
                  onClick={() => scrollToPhase(phase.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <FolderIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      isOverBudget ? 'text-red-600' : 'text-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${
                        isActive ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {phase.name}
                      </div>
                      {assignedUser && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          {assignedUser.display_name || assignedUser.email}
                        </div>
                      )}
                      {isOverBudget && (
                        <div className="text-xs text-red-600 font-semibold mt-0.5">
                          Přečerpáno
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1">
            {editingProject ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  className="text-2xl font-bold w-full px-3 py-1 border border-gray-300 rounded"
                  placeholder="Název projektu"
                />
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="Popis projektu"
                  rows={2}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Typ projektu</label>
                    <select
                      value={projectForm.project_type}
                      onChange={(e) => setProjectForm({ ...projectForm, project_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="vývoj">Vývoj</option>
                      <option value="údržba">Údržba</option>
                      <option value="konzultace">Konzultace</option>
                      <option value="jiné">Jiné</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Kategorie</label>
                    <select
                      value={projectForm.project_category}
                      onChange={(e) => setProjectForm({ ...projectForm, project_category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="klientský">Klientský</option>
                      <option value="interní">Interní</option>
                      <option value="open-source">Open-source</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Stav</label>
                    <select
                      value={projectForm.status}
                      onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="aktivní">Aktivní</option>
                      <option value="dokončen">Dokončen</option>
                      <option value="pozastaven">Pozastaven</option>
                      <option value="čeká se na klienta">Čeká se na klienta</option>
                      <option value="zrušen">Zrušen</option>
                    </select>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Informace o klientovi</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Název firmy</label>
                      <input
                        type="text"
                        value={projectForm.client_company_name}
                        onChange={(e) => setProjectForm({ ...projectForm, client_company_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        placeholder="Název firmy klienta"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Kontaktní osoba</label>
                      <input
                        type="text"
                        value={projectForm.client_contact_person}
                        onChange={(e) => setProjectForm({ ...projectForm, client_contact_person: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        placeholder="Jméno kontaktní osoby"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">IČO</label>
                      <input
                        type="text"
                        value={projectForm.client_ico}
                        onChange={(e) => setProjectForm({ ...projectForm, client_ico: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        placeholder="12345678"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Telefon</label>
                      <input
                        type="tel"
                        value={projectForm.client_phone}
                        onChange={(e) => setProjectForm({ ...projectForm, client_phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        placeholder="+420 123 456 789"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={projectForm.client_email}
                        onChange={(e) => setProjectForm({ ...projectForm, client_email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        placeholder="email@klient.cz"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Rozpočet a termíny</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Cenová nabídka (Kč)</label>
                      <input
                        type="number"
                        value={projectForm.price_offer}
                        onChange={(e) => setProjectForm({ ...projectForm, price_offer: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Hodinový rozpočet (h)</label>
                      <input
                        type="number"
                        value={projectForm.hour_budget}
                        onChange={(e) => setProjectForm({ ...projectForm, hour_budget: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Datum zahájení</label>
                      <input
                        type="date"
                        value={projectForm.start_date}
                        onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Datum dodání</label>
                      <input
                        type="date"
                        value={projectForm.delivery_date}
                        onChange={(e) => setProjectForm({ ...projectForm, delivery_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveProject}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                  >
                    <SaveIcon className="w-4 h-4" />
                    Uložit
                  </button>
                  <button
                    onClick={() => {
                      setEditingProject(false);
                      loadProject();
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
                  {canManage && (
                    <button
                      onClick={() => setEditingProject(true)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <EditIcon className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                  )}
                </div>
                {project.description && (
                  <p className="text-sm text-gray-600 mt-0.5">{project.description}</p>
                )}
                <div className="mt-3 space-y-3">
                  <ProjectTagsManager projectId={projectId} canManage={canManage} />
                  <ProjectPhaseTagsManager canManage={canManage} />
                </div>
              </>
            )}
          </div>
        </div>

        {!editingProject && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-wrap gap-1.5">
              {project.project_type && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                  {project.project_type}
                </span>
              )}
              {project.project_category && (
                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                  {project.project_category}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                project.status === 'aktivní' ? 'bg-green-100 text-green-700' :
                project.status === 'dokončen' ? 'bg-gray-100 text-gray-700' :
                project.status === 'pozastaven' ? 'bg-yellow-100 text-yellow-700' :
                project.status === 'čeká se na klienta' ? 'bg-blue-100 text-blue-700' :
                'bg-red-100 text-red-700'
              }`}>
                {project.status}
              </span>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              {project.hour_budget && (() => {
                const stats = calculateProjectStats();
                const isOverBudget = stats.budgetPercentage > 100;
                return (
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${
                    isOverBudget
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : stats.budgetPercentage > 80
                        ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                        : 'bg-green-50 border-green-300 text-green-700'
                  }`}>
                    <span className="font-medium">Vyčerpání rozpočtu</span>
                    <span className="font-bold">{stats.budgetPercentage.toFixed(0)}%</span>
                    <span className="text-gray-600">({stats.totalSpentHours.toFixed(1)}h / {project.hour_budget}h)</span>
                    {isOverBudget && (
                      <span className="font-semibold">+{(stats.totalSpentHours - project.hour_budget).toFixed(1)}h</span>
                    )}
                  </div>
                );
              })()}

              {(() => {
                const stats = calculateProjectStats();
                if (stats.daysToDeadline !== null) {
                  const isOverdue = stats.daysToDeadline < 0;
                  const isUrgent = stats.daysToDeadline >= 0 && stats.daysToDeadline <= 7;
                  return (
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${
                      isOverdue
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : isUrgent
                          ? 'bg-orange-50 border-orange-300 text-orange-700'
                          : 'bg-blue-50 border-blue-300 text-blue-700'
                    }`}>
                      <span className="font-medium">Do dodání</span>
                      <span className="font-bold">{Math.abs(stats.daysToDeadline)}</span>
                      <span className="text-gray-600">{isOverdue ? 'po termínu' : 'dní'}</span>
                      {project.delivery_date && (
                        <span className="text-gray-500">({new Date(project.delivery_date).toLocaleDateString('cs-CZ')})</span>
                      )}
                    </div>
                  );
                }
              })()}

              {project.price_offer && (
                <span className="text-xs px-2 py-1 bg-green-50 border border-green-300 text-green-700 rounded">
                  <span className="font-medium">Nabídka:</span> {project.price_offer.toLocaleString('cs-CZ')} Kč
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 project-detail-content">
        {canManage && (
          <div className="mb-6">
            {!showPhaseForm ? (
              <button
                onClick={() => setShowPhaseForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Přidat fázi
              </button>
            ) : (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">Nová fáze</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={phaseForm.name}
                    onChange={(e) => setPhaseForm({ ...phaseForm, name: e.target.value })}
                    placeholder="Název fáze *"
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                  <textarea
                    value={phaseForm.description}
                    onChange={(e) => setPhaseForm({ ...phaseForm, description: e.target.value })}
                    placeholder="Popis fáze"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={phaseForm.status}
                      onChange={(e) => setPhaseForm({ ...phaseForm, status: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded"
                    >
                      <option value="čeká na zahájení">Čeká na zahájení</option>
                      <option value="fáze probíhá">Fáze probíhá</option>
                      <option value="čeká se na klienta">Čeká se na klienta</option>
                      <option value="dokončena">Dokončena</option>
                      <option value="zrušena">Zrušena</option>
                    </select>
                    <input
                      type="number"
                      value={phaseForm.estimated_hours}
                      onChange={(e) => setPhaseForm({ ...phaseForm, estimated_hours: Number(e.target.value) })}
                      placeholder="Odhadované hodiny"
                      className="px-3 py-2 border border-gray-300 rounded"
                    />
                    <input
                      type="date"
                      value={phaseForm.start_date}
                      onChange={(e) => setPhaseForm({ ...phaseForm, start_date: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded"
                    />
                    <input
                      type="date"
                      value={phaseForm.end_date}
                      onChange={(e) => setPhaseForm({ ...phaseForm, end_date: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addPhase}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Přidat
                    </button>
                    <button
                      onClick={() => {
                        setShowPhaseForm(false);
                        setPhaseForm({
                          name: '',
                          description: '',
                          status: 'čeká na zahájení',
                          estimated_hours: 0,
                          start_date: '',
                          end_date: ''
                        });
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Zrušit
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {availableTags.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Filtrovat podle štítku:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedTagFilter(null)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    selectedTagFilter === null
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Všechny činnosti
                </button>
                {availableTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTagFilter(tag.id)}
                    className={`px-3 py-1 text-sm rounded-full border transition-all ${
                      selectedTagFilter === tag.id
                        ? 'border-2 font-medium'
                        : 'border border-gray-200 hover:shadow-sm'
                    }`}
                    style={{
                      backgroundColor: selectedTagFilter === tag.id ? `${tag.color}25` : `${tag.color}10`,
                      color: tag.color,
                      borderColor: selectedTagFilter === tag.id ? tag.color : 'transparent'
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {phases.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              Žádné fáze projektu. {canManage && 'Vytvořte první fázi pomocí tlačítka výše.'}
            </div>
          ) : (
            phases.map((phase) => {
              const phaseAssignments = assignments[phase.id] || [];
              let phaseTimeEntries = timeEntries[phase.id] || [];

              if (selectedTagFilter) {
                phaseTimeEntries = phaseTimeEntries.filter(entry =>
                  timeEntryTags[entry.id]?.includes(selectedTagFilter)
                );
              }

              if (selectedTagFilter && phaseTimeEntries.length === 0) {
                return null;
              }

              const totalHours = getTotalHours(phase.id);
              const isEditing = editingPhaseId === phase.id;
              const assignedUser = phase.assigned_user_id ? users.find(u => u.id === phase.assigned_user_id) : null;
              const isOverBudget = isPhaseOverBudget(phase.id);

              return (
                <div
                  key={phase.id}
                  ref={(el) => { phaseRefs.current[phase.id] = el; }}
                  className={`bg-white rounded-lg border-2 overflow-hidden ${
                    isOverBudget ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="p-4 border-b border-gray-200">
                    {isEditing ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={phase.name}
                          onChange={(e) => updatePhaseField(phase.id, 'name', e.target.value)}
                          className="text-lg font-semibold w-full px-3 py-1 border border-gray-300 rounded"
                        />
                        <textarea
                          value={phase.description || ''}
                          onChange={(e) => updatePhaseField(phase.id, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          rows={2}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <select
                            value={phase.status}
                            onChange={(e) => updatePhaseField(phase.id, 'status', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded text-sm"
                          >
                            <option value="čeká na zahájení">Čeká na zahájení</option>
                            <option value="fáze probíhá">Fáze probíhá</option>
                            <option value="čeká se na klienta">Čeká se na klienta</option>
                            <option value="dokončena">Dokončena</option>
                            <option value="zrušena">Zrušena</option>
                          </select>
                          <input
                            type="number"
                            value={phase.estimated_hours || 0}
                            onChange={(e) => updatePhaseField(phase.id, 'estimated_hours', Number(e.target.value))}
                            placeholder="Odhadované hodiny"
                            className="px-3 py-2 border border-gray-300 rounded text-sm"
                          />
                          <input
                            type="date"
                            value={phase.start_date || ''}
                            onChange={(e) => updatePhaseField(phase.id, 'start_date', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded text-sm"
                          />
                          <input
                            type="date"
                            value={phase.end_date || ''}
                            onChange={(e) => updatePhaseField(phase.id, 'end_date', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updatePhase(phase.id)}
                            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center gap-1"
                          >
                            <SaveIcon className="w-3 h-3" />
                            Uložit
                          </button>
                          <button
                            onClick={() => {
                              setEditingPhaseId(null);
                              loadPhases();
                            }}
                            className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                          >
                            Zrušit
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-semibold text-gray-900">{phase.name}</h3>
                              {canManage && (
                                <>
                                  <button
                                    onClick={() => setEditingPhaseId(phase.id)}
                                    className="p-1 hover:bg-gray-100 rounded"
                                  >
                                    <EditIcon className="w-3 h-3 text-gray-600" />
                                  </button>
                                  <button
                                    onClick={() => deletePhase(phase.id)}
                                    className="p-1 hover:bg-red-100 rounded"
                                  >
                                    <TrashIcon className="w-3 h-3 text-red-600" />
                                  </button>
                                </>
                              )}
                            </div>
                            {phase.description && (
                              <p className="text-sm text-gray-600">{phase.description}</p>
                            )}
                          </div>
                          {assignedUser ? (
                            <div className="ml-4 flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 rounded-lg border border-blue-200">
                              {assignedUser.avatar_url ? (
                                <img
                                  src={assignedUser.avatar_url}
                                  alt={assignedUser.display_name || assignedUser.email}
                                  className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm border-2 border-white shadow-sm">
                                  {(assignedUser.display_name || assignedUser.email).charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-xs font-medium text-blue-900">Operátor fáze</span>
                                <span className="text-sm font-semibold text-blue-700">{assignedUser.display_name || assignedUser.email}</span>
                              </div>
                            </div>
                          ) : canManage && (
                            <div className="ml-4">
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    updatePhaseField(phase.id, 'assigned_user_id', e.target.value);
                                    updatePhase(phase.id);
                                  }
                                }}
                                className="text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                              >
                                <option value="">+ Přiřadit operátora</option>
                                {users.map(u => (
                                  <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${statusColors[phase.status] || 'bg-gray-100 text-gray-700'}`}>
                            {phase.status}
                          </span>
                          {phase.estimated_hours > 0 && (
                            <span className={`text-xs px-2 py-1 rounded font-medium ${
                              isOverBudget
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              Odhad: {phase.estimated_hours}h
                            </span>
                          )}
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            isOverBudget
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            Vykázáno: {totalHours.toFixed(2)}h
                          </span>
                          {isOverBudget && (
                            <span className="text-xs px-2 py-1 bg-red-600 text-white rounded font-semibold">
                              PŘEČERPÁNO +{(totalHours - (phase.estimated_hours || 0)).toFixed(1)}h
                            </span>
                          )}
                          {phase.start_date && (
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              {new Date(phase.start_date).toLocaleDateString('cs-CZ')}
                              {phase.end_date && ` - ${new Date(phase.end_date).toLocaleDateString('cs-CZ')}`}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="p-4 space-y-4">
                    <ProjectMilestones phaseId={phase.id} canManage={canManage} />

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <ClockIcon className="w-4 h-4" />
                          Evidence času
                        </h4>
                        {canAddTimeToPhase(phase.id) && (
                          <button
                            onClick={() => setShowTimeFormForPhase(showTimeFormForPhase === phase.id ? null : phase.id)}
                            className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            {showTimeFormForPhase === phase.id ? 'Zrušit' : '+ Vykázat čas'}
                          </button>
                        )}
                      </div>

                      {showTimeFormForPhase === phase.id && (
                        <div className="mb-3 p-3 bg-gray-50 rounded border border-gray-200">
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <input
                              type="date"
                              value={timeForm.entry_date}
                              onChange={(e) => setTimeForm({ ...timeForm, entry_date: e.target.value })}
                              className="px-2 py-1.5 text-sm border border-gray-300 rounded"
                            />
                            <input
                              type="number"
                              step="0.25"
                              value={timeForm.hours}
                              onChange={(e) => setTimeForm({ ...timeForm, hours: e.target.value })}
                              placeholder="Hodiny (např. 0.75)"
                              className="px-2 py-1.5 text-sm border border-gray-300 rounded"
                            />
                          </div>
                          <textarea
                            value={timeForm.description}
                            onChange={(e) => setTimeForm({ ...timeForm, description: e.target.value })}
                            placeholder="Popis činnosti..."
                            rows={2}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded mb-2"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => addTimeEntry(phase.id)}
                              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                            >
                              Přidat
                            </button>
                            <button
                              onClick={() => setShowTimeFormForPhase(null)}
                              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                            >
                              Zrušit
                            </button>
                          </div>
                        </div>
                      )}

                      {phaseTimeEntries.length === 0 ? (
                        <div className="text-xs text-gray-500 py-2">Žádné časové záznamy</div>
                      ) : (
                        <div className="space-y-1">
                          {phaseTimeEntries.map(entry => (
                            <div key={entry.id} className="group flex items-start justify-between gap-2 p-2 bg-gray-50 rounded text-xs hover:bg-gray-100 transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-gray-900">{getUserName(entry.user_id)}</span>
                                  <span className="text-blue-600 font-semibold">{entry.hours}h</span>
                                  <span className="text-gray-500">{new Date(entry.entry_date).toLocaleDateString('cs-CZ')}</span>
                                  <TimeEntryTagsEdit timeEntryId={entry.id} canManage={canManage} />
                                </div>
                                <p className="text-gray-700">{entry.description}</p>
                              </div>
                              {entry.user_id === currentUserId && (
                                <button
                                  onClick={() => deleteTimeEntry(entry.id, phase.id)}
                                  className="p-1 hover:bg-red-100 rounded flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <TrashIcon className="w-3 h-3 text-red-600" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
