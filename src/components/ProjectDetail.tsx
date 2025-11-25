import { useState, useEffect } from 'react';
import { ArrowLeft as ArrowLeftIcon, Plus as PlusIcon, Bitcoin as EditIcon, Save as SaveIcon, Bone as XIcon, Trash as TrashIcon, Clock as ClockIcon, UserPlus as UserPlusIcon, RefreshCw as RefreshCwIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Project, ProjectPhase, ProjectPhaseAssignment, ProjectTimeEntry, User } from '../types';
import { ProjectMilestones } from './ProjectMilestones';

interface ProjectDetailProps {
  projectId: string;
  onClose: () => void;
  canManage: boolean;
}

export function ProjectDetail({ projectId, onClose, canManage }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
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
  }, [projectId]);

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
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4 mb-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
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
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                  {canManage && (
                    <button
                      onClick={() => setEditingProject(true)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <EditIcon className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                </div>
                {project.description && (
                  <p className="text-gray-600 mt-1">{project.description}</p>
                )}
              </>
            )}
          </div>
        </div>

        {!editingProject && (
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {project.project_type && (
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                  {project.project_type}
                </span>
              )}
              {project.project_category && (
                <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded font-medium">
                  {project.project_category}
                </span>
              )}
              <span className={`text-xs px-2 py-1 rounded font-medium ${
                project.status === 'aktivní' ? 'bg-green-100 text-green-700' :
                project.status === 'dokončen' ? 'bg-gray-100 text-gray-700' :
                project.status === 'pozastaven' ? 'bg-yellow-100 text-yellow-700' :
                project.status === 'čeká se na klienta' ? 'bg-blue-100 text-blue-700' :
                'bg-red-100 text-red-700'
              }`}>
                {project.status}
              </span>
              {project.sync_enabled && (
                <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded font-medium flex items-center gap-1">
                  <RefreshCwIcon className="w-3 h-3" />
                  Synchronizace aktivní
                  {project.last_sync_at && (
                    <span className="text-green-600 ml-1">
                      (poslední: {new Date(project.last_sync_at).toLocaleString('cs-CZ')})
                    </span>
                  )}
                </span>
              )}
            </div>

            {(project.client_company_name || project.client_contact_person || project.client_email || project.client_phone || project.client_ico) && (
              <div className="bg-gray-50 rounded p-3 mb-3">
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Klient</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  {project.client_company_name && (
                    <div>
                      <span className="text-gray-500">Firma:</span>
                      <span className="ml-1 text-gray-900 font-medium">{project.client_company_name}</span>
                    </div>
                  )}
                  {project.client_contact_person && (
                    <div>
                      <span className="text-gray-500">Kontakt:</span>
                      <span className="ml-1 text-gray-900">{project.client_contact_person}</span>
                    </div>
                  )}
                  {project.client_ico && (
                    <div>
                      <span className="text-gray-500">IČO:</span>
                      <span className="ml-1 text-gray-900">{project.client_ico}</span>
                    </div>
                  )}
                  {project.client_phone && (
                    <div>
                      <span className="text-gray-500">Tel:</span>
                      <span className="ml-1 text-gray-900">{project.client_phone}</span>
                    </div>
                  )}
                  {project.client_email && (
                    <div className="md:col-span-2">
                      <span className="text-gray-500">Email:</span>
                      <a href={`mailto:${project.client_email}`} className="ml-1 text-blue-600 hover:underline">{project.client_email}</a>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {project.price_offer && (
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                  <span className="font-medium">Nabídka:</span> {project.price_offer.toLocaleString('cs-CZ')} Kč
                </span>
              )}
              {project.hour_budget && (
                <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                  <span className="font-medium">Rozpočet:</span> {project.hour_budget}h
                </span>
              )}
              {project.start_date && (
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  <span className="font-medium">Zahájení:</span> {new Date(project.start_date).toLocaleDateString('cs-CZ')}
                </span>
              )}
              {project.delivery_date && (
                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                  <span className="font-medium">Dodání:</span> {new Date(project.delivery_date).toLocaleDateString('cs-CZ')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
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

        <div className="space-y-4">
          {phases.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              Žádné fáze projektu. {canManage && 'Vytvořte první fázi pomocí tlačítka výše.'}
            </div>
          ) : (
            phases.map((phase) => {
              const phaseAssignments = assignments[phase.id] || [];
              const phaseTimeEntries = timeEntries[phase.id] || [];
              const totalHours = getTotalHours(phase.id);
              const isEditing = editingPhaseId === phase.id;

              return (
                <div key={phase.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${statusColors[phase.status] || 'bg-gray-100 text-gray-700'}`}>
                            {phase.status}
                          </span>
                          {phase.estimated_hours > 0 && (
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              Odhad: {phase.estimated_hours}h
                            </span>
                          )}
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                            Vykázáno: {totalHours.toFixed(2)}h
                          </span>
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
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-700">Přiřazení uživatelé</h4>
                        {canManage && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                assignUserToPhase(phase.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            className="text-xs px-2 py-1 border border-gray-300 rounded"
                          >
                            <option value="">+ Přidat uživatele</option>
                            {users
                              .filter(u => !phaseAssignments.some(a => a.user_id === u.id))
                              .map(u => (
                                <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                              ))}
                          </select>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {phaseAssignments.length === 0 ? (
                          <span className="text-xs text-gray-500">Žádní přiřazení uživatelé</span>
                        ) : (
                          phaseAssignments.map(assignment => (
                            <div key={assignment.id} className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                              <span>{getUserName(assignment.user_id)}</span>
                              {canManage && (
                                <button
                                  onClick={() => removeAssignment(assignment.id, phase.id)}
                                  className="hover:bg-blue-200 rounded"
                                >
                                  <XIcon className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

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
                            <div key={entry.id} className="flex items-start justify-between gap-2 p-2 bg-gray-50 rounded text-xs">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-gray-900">{getUserName(entry.user_id)}</span>
                                  <span className="text-blue-600 font-semibold">{entry.hours}h</span>
                                  <span className="text-gray-500">{new Date(entry.entry_date).toLocaleDateString('cs-CZ')}</span>
                                </div>
                                <p className="text-gray-700">{entry.description}</p>
                              </div>
                              {entry.user_id === currentUserId && (
                                <button
                                  onClick={() => deleteTimeEntry(entry.id, phase.id)}
                                  className="p-1 hover:bg-red-100 rounded flex-shrink-0"
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
  );
}
