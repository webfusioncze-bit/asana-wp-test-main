import { useState, useEffect } from 'react';
import { PlusIcon, LayoutDashboardIcon, LayersIcon, SettingsIcon, FolderIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Project, ProjectPhase, ProjectPhaseAssignment, ProjectTimeEntry, User, ProjectPhaseTag } from '../types';
import { ProjectDetailHeader } from './ProjectDetailHeader';
import { ProjectOverviewTab } from './ProjectOverviewTab';
import { ProjectPhaseCard } from './ProjectPhaseCard';
import { ProjectEditModal } from './ProjectEditModal';
import { ProjectTagsManager } from './ProjectTagsManager';
import { ProjectPhaseTagsManager } from './ProjectPhaseTagsManager';

interface ProjectDetailProps {
  projectId: string;
  onClose: () => void;
  onProjectChange: (projectId: string) => void;
  canManage: boolean;
}

type TabId = 'overview' | 'phases' | 'settings';

export function ProjectDetail({ projectId, onClose, onProjectChange, canManage }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [assignments, setAssignments] = useState<Record<string, ProjectPhaseAssignment[]>>({});
  const [timeEntries, setTimeEntries] = useState<Record<string, ProjectTimeEntry[]>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPhaseForm, setShowPhaseForm] = useState(false);
  const [availableTags, setAvailableTags] = useState<ProjectPhaseTag[]>([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [timeEntryTags, setTimeEntryTags] = useState<Record<string, string[]>>({});

  const [phaseForm, setPhaseForm] = useState({
    name: '',
    description: '',
    status: 'ceka na zahajeni',
    estimated_hours: 0,
    start_date: '',
    end_date: '',
  });

  useEffect(() => {
    loadAll();
  }, [projectId]);

  useEffect(() => {
    if (phases.length > 0) loadAllTimeEntryTags();
  }, [phases, timeEntries]);

  useEffect(() => {
    if (phases.length === 0) return;
    const phaseIds = new Set(phases.map(p => p.id));

    const channel = supabase
      .channel('project_time_entries_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_time_entries' }, (payload) => {
        const entry = payload.new as ProjectTimeEntry;
        if (phaseIds.has(entry.phase_id)) {
          setTimeEntries(prev => ({
            ...prev,
            [entry.phase_id]: [entry, ...(prev[entry.phase_id] || [])],
          }));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [phases]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadProject(), loadCurrentUser(), loadPhases(), loadUsers(), loadAllProjects(), loadAvailableTags()]);
    setLoading(false);
  }

  async function loadProject() {
    const { data } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
    if (data) setProject(data);
  }

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  }

  async function loadPhases() {
    const { data } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', projectId)
      .is('parent_phase_id', null)
      .order('position', { ascending: true });

    const list = data || [];
    setPhases(list);

    for (const phase of list) {
      await loadPhaseAssignments(phase.id);
      await loadPhaseTimeEntries(phase.id);
    }
  }

  async function loadPhaseAssignments(phaseId: string) {
    const { data } = await supabase.from('project_phase_assignments').select('*').eq('phase_id', phaseId);
    setAssignments(prev => ({ ...prev, [phaseId]: data || [] }));
  }

  async function loadPhaseTimeEntries(phaseId: string) {
    const { data } = await supabase
      .from('project_time_entries')
      .select('*')
      .eq('phase_id', phaseId)
      .order('entry_date', { ascending: false });
    setTimeEntries(prev => ({ ...prev, [phaseId]: data || [] }));
  }

  async function loadUsers() {
    const { data } = await supabase.from('user_profiles').select('*');
    if (data) setUsers(data);
  }

  async function loadAllProjects() {
    const { data } = await supabase.from('projects').select('id, name, status').order('name');
    if (data) setAllProjects(data);
  }

  async function loadAvailableTags() {
    const { data } = await supabase.from('project_phase_tags').select('*').order('name');
    if (data) setAvailableTags(data);
  }

  async function loadAllTimeEntryTags() {
    const allIds = Object.values(timeEntries).flat().map(e => e.id);
    if (allIds.length === 0) return;

    const { data } = await supabase.from('project_time_entry_tags').select('time_entry_id, tag_id').in('time_entry_id', allIds);
    if (data) {
      const map: Record<string, string[]> = {};
      data.forEach(item => {
        if (!map[item.time_entry_id]) map[item.time_entry_id] = [];
        map[item.time_entry_id].push(item.tag_id);
      });
      setTimeEntryTags(map);
    }
  }

  function getTotalHours(phaseId: string): number {
    return (timeEntries[phaseId] || []).reduce((s, e) => s + Number(e.hours), 0);
  }

  const phaseHours: Record<string, number> = {};
  phases.forEach(p => { phaseHours[p.id] = getTotalHours(p.id); });
  const totalProjectHours = Object.values(phaseHours).reduce((s, h) => s + h, 0);

  async function addPhase() {
    if (!phaseForm.name.trim()) return;
    const maxPos = phases.length > 0 ? Math.max(...phases.map(p => p.position || 0)) : 0;

    const { error } = await supabase.from('project_phases').insert({
      project_id: projectId,
      name: phaseForm.name,
      description: phaseForm.description || null,
      status: phaseForm.status,
      estimated_hours: phaseForm.estimated_hours || null,
      start_date: phaseForm.start_date || null,
      end_date: phaseForm.end_date || null,
      position: maxPos + 1,
    });

    if (error) {
      console.error('Error creating phase:', error);
      return;
    }

    setPhaseForm({ name: '', description: '', status: 'ceka na zahajeni', estimated_hours: 0, start_date: '', end_date: '' });
    setShowPhaseForm(false);
    loadPhases();
  }

  async function deletePhase(phaseId: string) {
    if (!confirm('Opravdu chcete smazat tuto fazi?')) return;
    await supabase.from('project_phases').delete().eq('id', phaseId);
    loadPhases();
  }

  async function deleteTimeEntry(entryId: string, phaseId: string) {
    if (!confirm('Smazat casovy zaznam?')) return;
    await supabase.from('project_time_entries').delete().eq('id', entryId);
    loadPhaseTimeEntries(phaseId);
  }

  async function assignUser(phaseId: string, userId: string) {
    await supabase.from('project_phases').update({ assigned_user_id: userId }).eq('id', phaseId);
    loadPhases();
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400">Nacitani projektu...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400">Projekt nenalezen</div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Prehled', icon: LayoutDashboardIcon },
    { id: 'phases', label: 'Faze', icon: LayersIcon },
    ...(canManage ? [{ id: 'settings' as TabId, label: 'Nastaveni', icon: SettingsIcon }] : []),
  ];

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      <ProjectDetailHeader
        project={project}
        totalSpentHours={totalProjectHours}
        onClose={onClose}
        onEdit={() => setShowEditModal(true)}
        canManage={canManage}
      />

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex items-center gap-1 -mb-px">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}

          {allProjects.length > 1 && (
            <div className="ml-auto">
              <select
                value={projectId}
                onChange={e => onProjectChange(e.target.value)}
                className="text-xs px-2 py-1 border border-gray-200 rounded-md bg-white text-gray-600"
              >
                {allProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && (
          <ProjectOverviewTab project={project} phases={phases} phaseHours={phaseHours} />
        )}

        {activeTab === 'phases' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {availableTags.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Filtr:</span>
                    <button
                      onClick={() => setSelectedTagFilter(null)}
                      className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                        !selectedTagFilter ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Vse
                    </button>
                    {availableTags.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => setSelectedTagFilter(tag.id)}
                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                          selectedTagFilter === tag.id ? 'border-current font-medium' : 'border-transparent'
                        }`}
                        style={{
                          backgroundColor: `${tag.color}${selectedTagFilter === tag.id ? '25' : '10'}`,
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {canManage && (
                <button
                  onClick={() => setShowPhaseForm(!showPhaseForm)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white text-xs rounded-lg hover:bg-sky-700 transition-colors"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Nova faze
                </button>
              )}
            </div>

            {showPhaseForm && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Nova faze</h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={phaseForm.name}
                    onChange={e => setPhaseForm({ ...phaseForm, name: e.target.value })}
                    placeholder="Nazev faze"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    autoFocus
                  />
                  <textarea
                    value={phaseForm.description}
                    onChange={e => setPhaseForm({ ...phaseForm, description: e.target.value })}
                    placeholder="Popis"
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={phaseForm.status}
                      onChange={e => setPhaseForm({ ...phaseForm, status: e.target.value })}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    >
                      <option value="ceka na zahajeni">Ceka na zahajeni</option>
                      <option value="faze probiha">Faze probiha</option>
                      <option value="ceka se na klienta">Ceka se na klienta</option>
                      <option value="dokoncena">Dokoncena</option>
                      <option value="zrusena">Zrusena</option>
                    </select>
                    <input
                      type="number"
                      value={phaseForm.estimated_hours || ''}
                      onChange={e => setPhaseForm({ ...phaseForm, estimated_hours: Number(e.target.value) })}
                      placeholder="Odhad hodin"
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                    <input
                      type="date"
                      value={phaseForm.start_date}
                      onChange={e => setPhaseForm({ ...phaseForm, start_date: e.target.value })}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                    <input
                      type="date"
                      value={phaseForm.end_date}
                      onChange={e => setPhaseForm({ ...phaseForm, end_date: e.target.value })}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addPhase} className="px-4 py-2 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700">
                      Pridat
                    </button>
                    <button
                      onClick={() => { setShowPhaseForm(false); setPhaseForm({ name: '', description: '', status: 'ceka na zahajeni', estimated_hours: 0, start_date: '', end_date: '' }); }}
                      className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Zrusit
                    </button>
                  </div>
                </div>
              </div>
            )}

            {phases.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <FolderIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Zadne faze projektu</p>
                {canManage && (
                  <p className="text-xs text-gray-400 mt-1">Vytvorte prvni fazi pomoci tlacitka vyse</p>
                )}
              </div>
            ) : (
              phases.map(phase => {
                const phaseTimeEntries = timeEntries[phase.id] || [];
                let visibleEntries = phaseTimeEntries;
                if (selectedTagFilter) {
                  visibleEntries = phaseTimeEntries.filter(e => timeEntryTags[e.id]?.includes(selectedTagFilter));
                }
                if (selectedTagFilter && visibleEntries.length === 0) return null;

                return (
                  <ProjectPhaseCard
                    key={phase.id}
                    phase={phase}
                    assignments={assignments[phase.id] || []}
                    timeEntries={phaseTimeEntries}
                    users={users}
                    currentUserId={currentUserId}
                    canManage={canManage}
                    totalHours={phaseHours[phase.id] || 0}
                    isOverBudget={(phaseHours[phase.id] || 0) > (phase.estimated_hours || Infinity)}
                    selectedTagFilter={selectedTagFilter}
                    timeEntryTags={timeEntryTags}
                    availableTags={availableTags}
                    onPhaseUpdated={loadPhases}
                    onPhaseDeleted={() => deletePhase(phase.id)}
                    onTimeEntryAdded={loadPhaseTimeEntries}
                    onTimeEntryDeleted={deleteTimeEntry}
                    onAssignUser={assignUser}
                  />
                );
              })
            )}
          </div>
        )}

        {activeTab === 'settings' && canManage && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <ProjectTagsManager projectId={projectId} canManage={canManage} />
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Stitky cinnosti</h3>
              <ProjectPhaseTagsManager canManage={canManage} />
            </div>
          </div>
        )}
      </div>

      {showEditModal && (
        <ProjectEditModal
          project={project}
          onClose={() => setShowEditModal(false)}
          onSaved={() => { setShowEditModal(false); loadProject(); }}
        />
      )}
    </div>
  );
}
