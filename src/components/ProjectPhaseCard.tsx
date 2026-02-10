import { useState } from 'react';
import { PencilIcon, TrashIcon, ClockIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon, SaveIcon, XIcon, UserIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProjectMilestones } from './ProjectMilestones';
import { TimeEntryTagsEdit } from './TimeEntryTagsEdit';
import type { ProjectPhase, ProjectPhaseAssignment, ProjectTimeEntry, User, ProjectPhaseTag } from '../types';

interface ProjectPhaseCardProps {
  phase: ProjectPhase;
  assignments: ProjectPhaseAssignment[];
  timeEntries: ProjectTimeEntry[];
  users: User[];
  currentUserId: string | null;
  canManage: boolean;
  totalHours: number;
  isOverBudget: boolean;
  selectedTagFilter: string | null;
  timeEntryTags: Record<string, string[]>;
  availableTags: ProjectPhaseTag[];
  onPhaseUpdated: () => void;
  onPhaseDeleted: () => void;
  onTimeEntryAdded: (phaseId: string) => void;
  onTimeEntryDeleted: (entryId: string, phaseId: string) => void;
  onAssignUser: (phaseId: string, userId: string) => void;
}

const statusStyles: Record<string, string> = {
  'ceka na zahajeni': 'bg-gray-100 text-gray-700',
  'faze probiha': 'bg-sky-100 text-sky-700',
  'ceka se na klienta': 'bg-amber-100 text-amber-700',
  'zrusena': 'bg-red-100 text-red-700',
  'dokoncena': 'bg-emerald-100 text-emerald-700',
};

function getPhaseStatusStyle(status: string) {
  const key = status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const [k, v] of Object.entries(statusStyles)) {
    if (key.includes(k)) return v;
  }
  return 'bg-gray-100 text-gray-700';
}

export function ProjectPhaseCard({
  phase, assignments, timeEntries, users, currentUserId,
  canManage, totalHours, isOverBudget, selectedTagFilter, timeEntryTags,
  availableTags, onPhaseUpdated, onPhaseDeleted, onTimeEntryAdded, onTimeEntryDeleted,
  onAssignUser,
}: ProjectPhaseCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: phase.name,
    description: phase.description || '',
    status: phase.status,
    estimated_hours: phase.estimated_hours || 0,
    start_date: phase.start_date || '',
    end_date: phase.end_date || '',
  });
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [timeForm, setTimeForm] = useState({
    description: '',
    hours: '',
    entry_date: new Date().toISOString().split('T')[0],
  });
  const [showMilestones, setShowMilestones] = useState(false);
  const [showTimeEntries, setShowTimeEntries] = useState(true);

  const assignedUser = phase.assigned_user_id ? users.find(u => u.id === phase.assigned_user_id) : null;
  const canAddTime = canManage || assignments.some(a => a.user_id === currentUserId);

  let filteredEntries = timeEntries;
  if (selectedTagFilter) {
    filteredEntries = timeEntries.filter(e => timeEntryTags[e.id]?.includes(selectedTagFilter));
  }

  const budgetPercent = phase.estimated_hours > 0 ? (totalHours / phase.estimated_hours) * 100 : 0;

  function getUserName(userId: string): string {
    const u = users.find(x => x.id === userId);
    return u?.display_name || u?.email || 'Neznamy';
  }

  async function savePhase() {
    const { error } = await supabase
      .from('project_phases')
      .update({
        name: editForm.name,
        description: editForm.description || null,
        status: editForm.status,
        estimated_hours: editForm.estimated_hours || null,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
      })
      .eq('id', phase.id);

    if (error) {
      console.error('Error updating phase:', error);
      return;
    }
    setIsEditing(false);
    onPhaseUpdated();
  }

  async function addTimeEntry() {
    if (!timeForm.description.trim() || !timeForm.hours || Number(timeForm.hours) <= 0) return;

    const { error } = await supabase
      .from('project_time_entries')
      .insert({
        phase_id: phase.id,
        user_id: currentUserId,
        description: timeForm.description,
        hours: Number(timeForm.hours),
        entry_date: timeForm.entry_date,
      });

    if (error) {
      console.error('Error adding time entry:', error);
      return;
    }

    setTimeForm({ description: '', hours: '', entry_date: new Date().toISOString().split('T')[0] });
    setShowTimeForm(false);
    onTimeEntryAdded(phase.id);
  }

  return (
    <div className={`bg-white rounded-lg border overflow-hidden transition-colors ${
      isOverBudget ? 'border-red-200' : 'border-gray-200'
    }`}>
      <div className="px-4 py-3">
        {isEditing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={editForm.name}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full text-sm font-semibold px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <textarea
              value={editForm.description}
              onChange={e => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
              rows={2}
              placeholder="Popis faze"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={editForm.status}
                onChange={e => setEditForm({ ...editForm, status: e.target.value as ProjectPhase['status'] })}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-md"
              >
                <option value="ceka na zahajeni">Ceka na zahajeni</option>
                <option value="faze probiha">Faze probiha</option>
                <option value="ceka se na klienta">Ceka se na klienta</option>
                <option value="dokoncena">Dokoncena</option>
                <option value="zrusena">Zrusena</option>
              </select>
              <input
                type="number"
                value={editForm.estimated_hours}
                onChange={e => setEditForm({ ...editForm, estimated_hours: Number(e.target.value) })}
                placeholder="Odhad hodin"
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-md"
              />
              <input
                type="date"
                value={editForm.start_date}
                onChange={e => setEditForm({ ...editForm, start_date: e.target.value })}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-md"
              />
              <input
                type="date"
                value={editForm.end_date}
                onChange={e => setEditForm({ ...editForm, end_date: e.target.value })}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={savePhase} className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 text-white text-xs rounded-md hover:bg-sky-700">
                <SaveIcon className="w-3 h-3" /> Ulozit
              </button>
              <button onClick={() => { setIsEditing(false); setEditForm({ name: phase.name, description: phase.description || '', status: phase.status, estimated_hours: phase.estimated_hours || 0, start_date: phase.start_date || '', end_date: phase.end_date || '' }); }} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md">
                Zrusit
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-gray-900">{phase.name}</h3>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${getPhaseStatusStyle(phase.status)}`}>
                  {phase.status}
                </span>
                {canManage && (
                  <>
                    <button onClick={() => setIsEditing(true)} className="p-0.5 rounded hover:bg-gray-100">
                      <PencilIcon className="w-3 h-3 text-gray-400" />
                    </button>
                    <button onClick={onPhaseDeleted} className="p-0.5 rounded hover:bg-red-50">
                      <TrashIcon className="w-3 h-3 text-red-400" />
                    </button>
                  </>
                )}
              </div>
              {phase.description && (
                <p className="text-xs text-gray-500 mt-1">{phase.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {phase.estimated_hours > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isOverBudget ? 'bg-red-500' : budgetPercent > 80 ? 'bg-amber-500' : 'bg-sky-500'}`}
                        style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-medium ${isOverBudget ? 'text-red-600' : 'text-gray-500'}`}>
                      {totalHours.toFixed(1)}h / {phase.estimated_hours}h
                    </span>
                    {isOverBudget && (
                      <span className="text-[11px] font-semibold text-red-600">
                        +{(totalHours - phase.estimated_hours).toFixed(1)}h
                      </span>
                    )}
                  </div>
                )}
                {!phase.estimated_hours && totalHours > 0 && (
                  <span className="text-[11px] text-gray-500">{totalHours.toFixed(1)}h vykazano</span>
                )}
                {phase.start_date && (
                  <span className="text-[11px] text-gray-400">
                    {new Date(phase.start_date).toLocaleDateString('cs-CZ')}
                    {phase.end_date && ` - ${new Date(phase.end_date).toLocaleDateString('cs-CZ')}`}
                  </span>
                )}
              </div>
            </div>
            <div className="ml-3 shrink-0">
              {assignedUser ? (
                <div className="flex items-center gap-2 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                  {assignedUser.avatar_url ? (
                    <img src={assignedUser.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-semibold">
                      {(assignedUser.display_name || assignedUser.email).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs text-gray-700">{assignedUser.display_name || assignedUser.email}</span>
                </div>
              ) : canManage ? (
                <select
                  onChange={e => { if (e.target.value) onAssignUser(phase.id, e.target.value); }}
                  className="text-xs px-2 py-1 border border-gray-200 rounded-md bg-white"
                  defaultValue=""
                >
                  <option value="">Prirazeni...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100">
        <button
          onClick={() => setShowMilestones(!showMilestones)}
          className="w-full flex items-center gap-1.5 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {showMilestones ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
          Milestones
        </button>
        {showMilestones && (
          <div className="px-4 pb-3">
            <ProjectMilestones phaseId={phase.id} canManage={canManage} />
          </div>
        )}
      </div>

      <div className="border-t border-gray-100">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={() => setShowTimeEntries(!showTimeEntries)}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors"
          >
            {showTimeEntries ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
            <ClockIcon className="w-3 h-3" />
            Evidence casu ({filteredEntries.length})
          </button>
          {canAddTime && (
            <button
              onClick={() => setShowTimeForm(!showTimeForm)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              <PlusIcon className="w-3 h-3" />
              Vykazat
            </button>
          )}
        </div>

        {showTimeForm && (
          <div className="mx-4 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                type="date"
                value={timeForm.entry_date}
                onChange={e => setTimeForm({ ...timeForm, entry_date: e.target.value })}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded-md"
              />
              <input
                type="number"
                step="0.25"
                value={timeForm.hours}
                onChange={e => setTimeForm({ ...timeForm, hours: e.target.value })}
                placeholder="Hodiny"
                className="px-2 py-1.5 text-xs border border-gray-300 rounded-md"
              />
            </div>
            <textarea
              value={timeForm.description}
              onChange={e => setTimeForm({ ...timeForm, description: e.target.value })}
              placeholder="Popis cinnosti..."
              rows={2}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md mb-2"
            />
            <div className="flex gap-2">
              <button onClick={addTimeEntry} className="px-3 py-1 bg-emerald-600 text-white text-xs rounded-md hover:bg-emerald-700">
                Pridat
              </button>
              <button onClick={() => setShowTimeForm(false)} className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-md">
                Zrusit
              </button>
            </div>
          </div>
        )}

        {showTimeEntries && (
          <div className="px-4 pb-3">
            {filteredEntries.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">Zadne casove zaznamy</p>
            ) : (
              <div className="space-y-1">
                {filteredEntries.map(entry => (
                  <div key={entry.id} className="group flex items-start gap-2 p-2 rounded-md hover:bg-gray-50 transition-colors text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-gray-900">{getUserName(entry.user_id)}</span>
                        <span className="font-semibold text-sky-600">{entry.hours}h</span>
                        <span className="text-gray-400">{new Date(entry.entry_date).toLocaleDateString('cs-CZ')}</span>
                        <TimeEntryTagsEdit timeEntryId={entry.id} canManage={canManage} />
                      </div>
                      <p className="text-gray-600">{entry.description}</p>
                    </div>
                    {entry.user_id === currentUserId && (
                      <button
                        onClick={() => onTimeEntryDeleted(entry.id, phase.id)}
                        className="p-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <TrashIcon className="w-3 h-3 text-red-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
