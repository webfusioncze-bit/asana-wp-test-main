import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, UserPlusIcon, XIcon, EditIcon, TrashIcon, SaveIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Project, ProjectPhase, ProjectPhaseAssignment, User } from '../types';
import { ProjectMilestones } from './ProjectMilestones';
import { ProjectTimeTracking } from './ProjectTimeTracking';

interface ProjectDetailProps {
  project: Project;
  onClose: () => void;
  onUpdate: () => void;
  canManage: boolean;
}

export function ProjectDetail({ project, onClose, onUpdate, canManage }: ProjectDetailProps) {
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Record<string, ProjectPhaseAssignment[]>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showPhaseForm, setShowPhaseForm] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [newPhaseParentId, setNewPhaseParentId] = useState<string | null>(null);

  const [phaseForm, setPhaseForm] = useState({
    name: '',
    description: '',
    assigned_user_id: '',
    estimated_hours: 0,
    hour_budget: 0,
    start_date: '',
    end_date: ''
  });


  useEffect(() => {
    loadCurrentUser();
    loadPhases();
    loadUsers();
  }, [project.id]);

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
      .eq('project_id', project.id)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading phases:', error);
      return;
    }

    setPhases(data || []);

    for (const phase of data || []) {
      await loadPhaseAssignments(phase.id);
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


  async function loadUsers() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('email');

    if (error) {
      console.error('Error loading users:', error);
      return;
    }

    setUsers(data || []);
  }

  async function createPhase() {
    if (!phaseForm.name.trim()) return;

    const siblings = phases.filter(p => p.parent_phase_id === newPhaseParentId);
    const position = siblings.length;

    const { error } = await supabase
      .from('project_phases')
      .insert({
        project_id: project.id,
        parent_phase_id: newPhaseParentId,
        name: phaseForm.name,
        description: phaseForm.description,
        assigned_user_id: phaseForm.assigned_user_id || null,
        estimated_hours: phaseForm.estimated_hours,
        hour_budget: phaseForm.hour_budget,
        start_date: phaseForm.start_date || null,
        end_date: phaseForm.end_date || null,
        position,
        status: 'čeká na zahájení'
      });

    if (error) {
      console.error('Error creating phase:', error);
      alert('Chyba při vytváření fáze');
      return;
    }

    setPhaseForm({ name: '', description: '', assigned_user_id: '', estimated_hours: 0, hour_budget: 0, start_date: '', end_date: '' });
    setShowPhaseForm(false);
    setNewPhaseParentId(null);
    loadPhases();
    onUpdate();
  }

  async function updatePhase(phaseId: string) {
    if (!phaseForm.name.trim()) return;

    const { error } = await supabase
      .from('project_phases')
      .update({
        name: phaseForm.name,
        description: phaseForm.description,
        assigned_user_id: phaseForm.assigned_user_id || null,
        estimated_hours: phaseForm.estimated_hours,
        hour_budget: phaseForm.hour_budget,
        start_date: phaseForm.start_date || null,
        end_date: phaseForm.end_date || null
      })
      .eq('id', phaseId);

    if (error) {
      console.error('Error updating phase:', error);
      alert('Chyba při úpravě fáze');
      return;
    }

    setPhaseForm({ name: '', description: '', assigned_user_id: '', estimated_hours: 0, hour_budget: 0, start_date: '', end_date: '' });
    setEditingPhaseId(null);
    loadPhases();
    onUpdate();
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
    onUpdate();
  }

  async function updatePhaseStatus(phaseId: string, newStatus: ProjectPhase['status']) {
    const { error } = await supabase
      .from('project_phases')
      .update({ status: newStatus })
      .eq('id', phaseId);

    if (error) {
      console.error('Error updating phase status:', error);
      return;
    }

    loadPhases();
    onUpdate();
  }


  async function assignUserToPhase(phaseId: string, userId: string) {
    const { error } = await supabase
      .from('project_phase_assignments')
      .insert({
        phase_id: phaseId,
        user_id: userId,
        role: 'member'
      });

    if (error) {
      console.error('Error assigning user:', error);
      alert('Chyba při přiřazení uživatele');
      return;
    }

    loadPhaseAssignments(phaseId);
    onUpdate();
  }

  async function removeUserFromPhase(assignmentId: string, phaseId: string) {
    const { error } = await supabase
      .from('project_phase_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      console.error('Error removing assignment:', error);
      return;
    }

    loadPhaseAssignments(phaseId);
    onUpdate();
  }

  function togglePhase(phaseId: string) {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(phaseId)) {
      newExpanded.delete(phaseId);
    } else {
      newExpanded.add(phaseId);
    }
    setExpandedPhases(newExpanded);
  }


  function getUserName(userId: string): string {
    const user = users.find(u => u.id === userId);
    return user?.display_name || user?.email || 'Neznámý uživatel';
  }


  function renderPhase(phase: ProjectPhase, level: number = 0) {
    const childPhases = phases.filter(p => p.parent_phase_id === phase.id);
    const hasChildren = childPhases.length > 0;
    const isExpanded = expandedPhases.has(phase.id);
    const phaseAssignments = assignments[phase.id] || [];
    const isEditing = editingPhaseId === phase.id;

    const statusColors: Record<string, string> = {
      'čeká na zahájení': 'bg-gray-100 text-gray-700',
      'fáze probíhá': 'bg-blue-100 text-blue-700',
      'čeká se na klienta': 'bg-yellow-100 text-yellow-700',
      'zrušena': 'bg-red-100 text-red-700',
      'dokončena': 'bg-green-100 text-green-700'
    };

    const statusLabels: Record<string, string> = {
      'čeká na zahájení': 'Čeká na zahájení',
      'fáze probíhá': 'Fáze probíhá',
      'čeká se na klienta': 'Čeká se na klienta',
      'zrušena': 'Zrušena',
      'dokončena': 'Dokončena'
    };

    return (
      <div key={phase.id} className="border-b border-gray-200">
        <div
          className="flex items-start gap-3 p-4 hover:bg-gray-50"
          style={{ paddingLeft: `${16 + level * 24}px` }}
        >
          {hasChildren && (
            <button
              onClick={() => togglePhase(phase.id)}
              className="mt-1 p-0.5 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronRightIcon className="w-4 h-4 text-gray-600" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-5" />}

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-3 mb-4">
                <input
                  type="text"
                  value={phaseForm.name}
                  onChange={(e) => setPhaseForm({ ...phaseForm, name: e.target.value })}
                  placeholder="Název fáze"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                  value={phaseForm.description}
                  onChange={(e) => setPhaseForm({ ...phaseForm, description: e.target.value })}
                  placeholder="Popis"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={phaseForm.assigned_user_id}
                  onChange={(e) => setPhaseForm({ ...phaseForm, assigned_user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Operátor fáze (assignee)</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.display_name || user.email}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-4 gap-3">
                  <input
                    type="number"
                    value={phaseForm.estimated_hours}
                    onChange={(e) => setPhaseForm({ ...phaseForm, estimated_hours: Number(e.target.value) })}
                    placeholder="Odhad hodin"
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    value={phaseForm.hour_budget}
                    onChange={(e) => setPhaseForm({ ...phaseForm, hour_budget: Number(e.target.value) })}
                    placeholder="Hodinový rozpočet"
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={phaseForm.start_date}
                    onChange={(e) => setPhaseForm({ ...phaseForm, start_date: e.target.value })}
                    placeholder="Začátek"
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={phaseForm.end_date}
                    onChange={(e) => setPhaseForm({ ...phaseForm, end_date: e.target.value })}
                    placeholder="Konec"
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updatePhase(phase.id)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                  >
                    <SaveIcon className="w-4 h-4" />
                    Uložit
                  </button>
                  <button
                    onClick={() => {
                      setEditingPhaseId(null);
                      setPhaseForm({ name: '', description: '', assigned_user_id: '', estimated_hours: 0, hour_budget: 0, start_date: '', end_date: '' });
                    }}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{phase.name}</h4>
                    {phase.description && (
                      <p className="text-sm text-gray-600 mt-1">{phase.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className={`text-xs px-2 py-1 rounded ${statusColors[phase.status]}`}>
                        {statusLabels[phase.status]}
                      </span>
                      {phase.estimated_hours > 0 && (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          Odhad: {phase.estimated_hours}h
                        </span>
                      )}
                      {phase.start_date && (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {new Date(phase.start_date).toLocaleDateString('cs-CZ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex gap-1">
                      <select
                        value={phase.status}
                        onChange={(e) => updatePhaseStatus(phase.id, e.target.value as ProjectPhase['status'])}
                        className="text-xs px-2 py-1 border border-gray-300 rounded"
                      >
                        <option value="čeká na zahájení">Čeká na zahájení</option>
                        <option value="fáze probíhá">Fáze probíhá</option>
                        <option value="čeká se na klienta">Čeká se na klienta</option>
                        <option value="zrušena">Zrušena</option>
                        <option value="dokončena">Dokončena</option>
                      </select>
                      <button
                        onClick={() => {
                          setEditingPhaseId(phase.id);
                          setPhaseForm({
                            name: phase.name,
                            description: phase.description || '',
                            assigned_user_id: phase.assigned_user_id || '',
                            estimated_hours: phase.estimated_hours,
                            hour_budget: phase.hour_budget,
                            start_date: phase.start_date || '',
                            end_date: phase.end_date || ''
                          });
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                        title="Upravit"
                      >
                        <EditIcon className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => deletePhase(phase.id)}
                        className="p-1 hover:bg-red-100 rounded"
                        title="Smazat"
                      >
                        <TrashIcon className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-700">Přiřazení uživatelé:</span>
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
                            .map(user => (
                              <option key={user.id} value={user.id}>
                                {user.display_name || user.email}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {phaseAssignments.map(assignment => (
                        <div
                          key={assignment.id}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                        >
                          <span>{getUserName(assignment.user_id)}</span>
                          {canManage && (
                            <button
                              onClick={() => removeUserFromPhase(assignment.id, phase.id)}
                              className="hover:bg-blue-100 rounded p-0.5"
                            >
                              <XIcon className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <ProjectMilestones phaseId={phase.id} canManage={canManage} />

                  {canManage && (
                    <button
                      onClick={() => {
                        setNewPhaseParentId(phase.id);
                        setShowPhaseForm(true);
                        const newExpanded = new Set(expandedPhases);
                        newExpanded.add(phase.id);
                        setExpandedPhases(newExpanded);
                      }}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
                    >
                      <PlusIcon className="w-3 h-3" />
                      Přidat pod-fázi
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div>
            {childPhases.map(child => renderPhase(child, level + 1))}
          </div>
        )}
      </div>
    );
  }

  const rootPhases = phases.filter(p => !p.parent_phase_id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{project.name}</h2>
            {project.description && (
              <p className="text-gray-600 mt-1">{project.description}</p>
            )}
            <div className="flex gap-2 mt-2">
              {project.client_name && (
                <span className="text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  Klient: {project.client_name}
                </span>
              )}
              {project.budget && (
                <span className="text-sm px-2 py-1 bg-green-100 text-green-700 rounded">
                  Budget: {project.budget} Kč
                </span>
              )}
              {project.deadline && (
                <span className="text-sm px-2 py-1 bg-red-100 text-red-700 rounded">
                  Deadline: {new Date(project.deadline).toLocaleDateString('cs-CZ')}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
          >
            <XIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {canManage && (
            <div className="mb-4">
              {!showPhaseForm ? (
                <button
                  onClick={() => {
                    setShowPhaseForm(true);
                    setNewPhaseParentId(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                >
                  <PlusIcon className="w-5 h-5" />
                  Přidat hlavní fázi
                </button>
              ) : !editingPhaseId && (
                <div className="p-4 bg-gray-50 rounded space-y-3">
                  <h3 className="font-semibold">Nová fáze {newPhaseParentId && '(pod-fáze)'}</h3>
                  <input
                    type="text"
                    value={phaseForm.name}
                    onChange={(e) => setPhaseForm({ ...phaseForm, name: e.target.value })}
                    placeholder="Název fáze"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <textarea
                    value={phaseForm.description}
                    onChange={(e) => setPhaseForm({ ...phaseForm, description: e.target.value })}
                    placeholder="Popis"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={phaseForm.assigned_user_id}
                    onChange={(e) => setPhaseForm({ ...phaseForm, assigned_user_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Operátor fáze (assignee)</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.display_name || user.email}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-4 gap-3">
                    <input
                      type="number"
                      value={phaseForm.estimated_hours}
                      onChange={(e) => setPhaseForm({ ...phaseForm, estimated_hours: Number(e.target.value) })}
                      placeholder="Odhad hodin"
                      className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      value={phaseForm.hour_budget}
                      onChange={(e) => setPhaseForm({ ...phaseForm, hour_budget: Number(e.target.value) })}
                      placeholder="Hodinový rozpočet"
                      className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="date"
                      value={phaseForm.start_date}
                      onChange={(e) => setPhaseForm({ ...phaseForm, start_date: e.target.value })}
                      placeholder="Začátek"
                      className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="date"
                      value={phaseForm.end_date}
                      onChange={(e) => setPhaseForm({ ...phaseForm, end_date: e.target.value })}
                      placeholder="Konec"
                      className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={createPhase}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Vytvořit
                    </button>
                    <button
                      onClick={() => {
                        setShowPhaseForm(false);
                        setNewPhaseParentId(null);
                        setPhaseForm({ name: '', description: '', assigned_user_id: '', estimated_hours: 0, hour_budget: 0, start_date: '', end_date: '' });
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Zrušit
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            {rootPhases.length > 0 ? (
              rootPhases.map(phase => renderPhase(phase))
            ) : (
              <div className="p-8 text-center text-gray-500">
                Žádné fáze projektu. {canManage && 'Vytvořte první fázi pomocí tlačítka výše.'}
              </div>
            )}
          </div>

          <ProjectTimeTracking projectId={project.id} />
        </div>
      </div>
    </div>
  );
}
