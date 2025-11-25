import { useState, useEffect } from 'react';
import { PlusIcon, CheckCircleIcon, ClockIcon, XCircleIcon, SaveIcon, TrashIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ProjectMilestone } from '../types';

interface ProjectMilestonesProps {
  phaseId: string;
  canManage: boolean;
}

export function ProjectMilestones({ phaseId, canManage }: ProjectMilestonesProps) {
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    name: '',
    description: '',
    target_date: ''
  });

  useEffect(() => {
    loadMilestones();
  }, [phaseId]);

  async function loadMilestones() {
    const { data, error } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('phase_id', phaseId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading milestones:', error);
      return;
    }

    setMilestones(data || []);
  }

  async function createMilestone() {
    if (!milestoneForm.name.trim()) return;

    const { error } = await supabase
      .from('project_milestones')
      .insert({
        phase_id: phaseId,
        name: milestoneForm.name,
        description: milestoneForm.description || null,
        target_date: milestoneForm.target_date || null,
        position: milestones.length,
        status: 'čeká'
      });

    if (error) {
      console.error('Error creating milestone:', error);
      alert('Chyba při vytváření milestonu');
      return;
    }

    setMilestoneForm({ name: '', description: '', target_date: '' });
    setShowForm(false);
    loadMilestones();
  }

  async function updateMilestone(id: string) {
    if (!milestoneForm.name.trim()) return;

    const { error } = await supabase
      .from('project_milestones')
      .update({
        name: milestoneForm.name,
        description: milestoneForm.description || null,
        target_date: milestoneForm.target_date || null
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating milestone:', error);
      alert('Chyba při úpravě milestonu');
      return;
    }

    setMilestoneForm({ name: '', description: '', target_date: '' });
    setEditingId(null);
    loadMilestones();
  }

  async function deleteMilestone(id: string) {
    if (!confirm('Opravdu chcete smazat tento milestone?')) return;

    const { error } = await supabase
      .from('project_milestones')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting milestone:', error);
      return;
    }

    loadMilestones();
  }

  async function toggleMilestoneStatus(id: string, completed: boolean) {
    const { error } = await supabase
      .from('project_milestones')
      .update({
        status: completed ? 'dokončeno' : 'čeká',
        completed_date: completed ? new Date().toISOString().split('T')[0] : null
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating milestone status:', error);
      return;
    }

    loadMilestones();
  }

  const completedCount = milestones.filter(m => m.status === 'dokončeno').length;
  const totalCount = milestones.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Milestones</h4>
          {totalCount > 0 && (
            <div className="mt-1">
              <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                <span>{completedCount} / {totalCount} dokončeno</span>
                <span>({progressPercent.toFixed(0)}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
        {canManage && !showForm && !editingId && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <PlusIcon className="w-3 h-3 inline mr-1" />
            Přidat milestone
          </button>
        )}
      </div>

      {(showForm || editingId) && (
        <div className="p-3 bg-white rounded border border-gray-200 mb-2">
          <div className="space-y-2">
            <input
              type="text"
              value={milestoneForm.name}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, name: e.target.value })}
              placeholder="Název milestonu"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
            <textarea
              value={milestoneForm.description}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
              placeholder="Popis"
              rows={2}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
            <input
              type="date"
              value={milestoneForm.target_date}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, target_date: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
            <div className="flex gap-2">
              <button
                onClick={() => editingId ? updateMilestone(editingId) : createMilestone()}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                {editingId ? 'Uložit' : 'Vytvořit'}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setMilestoneForm({ name: '', description: '', target_date: '' });
                }}
                className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {milestones.map((milestone) => {
          const isCompleted = milestone.status === 'dokončeno';
          const isOverdue = milestone.target_date &&
            new Date(milestone.target_date) < new Date() &&
            !isCompleted;

          return (
            <div
              key={milestone.id}
              className={`p-2 bg-white rounded border ${
                isCompleted ? 'border-green-300' : isOverdue ? 'border-red-300' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-2">
                <button
                  onClick={() => toggleMilestoneStatus(milestone.id, !isCompleted)}
                  className="mt-0.5 flex-shrink-0"
                >
                  {isCompleted ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  ) : (
                    <div className="w-5 h-5 border-2 border-gray-300 rounded-full hover:border-green-600" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <h5 className={`text-sm font-medium ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                    {milestone.name}
                  </h5>
                  {milestone.description && (
                    <p className="text-xs text-gray-600 mt-0.5">{milestone.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {milestone.target_date && (
                      <div className={`flex items-center gap-1 text-xs ${
                        isOverdue ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        <ClockIcon className="w-3 h-3" />
                        {new Date(milestone.target_date).toLocaleDateString('cs-CZ')}
                        {isOverdue && <span className="font-medium">(zpožděno)</span>}
                      </div>
                    )}
                    {isCompleted && milestone.completed_date && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircleIcon className="w-3 h-3" />
                        Dokončeno {new Date(milestone.completed_date).toLocaleDateString('cs-CZ')}
                      </div>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingId(milestone.id);
                        setMilestoneForm({
                          name: milestone.name,
                          description: milestone.description || '',
                          target_date: milestone.target_date || ''
                        });
                        setShowForm(false);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="Upravit"
                    >
                      <SaveIcon className="w-3 h-3 text-gray-600" />
                    </button>
                    <button
                      onClick={() => deleteMilestone(milestone.id)}
                      className="p-1 hover:bg-red-100 rounded"
                      title="Smazat"
                    >
                      <TrashIcon className="w-3 h-3 text-red-600" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {milestones.length === 0 && !showForm && (
        <div className="text-center text-xs text-gray-500 py-4">
          {canManage ? 'Žádné milestones. Přidejte první.' : 'Žádné milestones.'}
        </div>
      )}
    </div>
  );
}
