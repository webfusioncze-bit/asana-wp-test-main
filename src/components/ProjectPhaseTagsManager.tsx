import { useState, useEffect } from 'react';
import { TagIcon, PlusIcon, XIcon, EditIcon, TrashIcon, CheckIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ProjectPhaseTag } from '../types';

interface ProjectPhaseTagsManagerProps {
  canManage: boolean;
}

export function ProjectPhaseTagsManager({ canManage }: ProjectPhaseTagsManagerProps) {
  const [tags, setTags] = useState<ProjectPhaseTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<ProjectPhaseTag | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3b82f6'
  });

  useEffect(() => {
    loadTags();
  }, []);

  async function loadTags() {
    setLoading(true);
    const { data, error } = await supabase
      .from('project_phase_tags')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading phase tags:', error);
    } else {
      setTags(data || []);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name.trim()) return;

    try {
      if (editingTag) {
        const { error } = await supabase
          .from('project_phase_tags')
          .update({
            name: formData.name.trim(),
            color: formData.color
          })
          .eq('id', editingTag.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_phase_tags')
          .insert({
            name: formData.name.trim(),
            color: formData.color
          });

        if (error) throw error;
      }

      setFormData({ name: '', color: '#3b82f6' });
      setShowForm(false);
      setEditingTag(null);
      loadTags();
    } catch (error) {
      console.error('Error saving phase tag:', error);
      alert('Nepodařilo se uložit štítek činnosti');
    }
  }

  async function handleDelete(tagId: string) {
    if (!confirm('Opravdu chcete smazat tento štítek činnosti? Bude odebrán ze všech činností.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('project_phase_tags')
        .delete()
        .eq('id', tagId);

      if (error) throw error;
      loadTags();
    } catch (error) {
      console.error('Error deleting phase tag:', error);
      alert('Nepodařilo se smazat štítek činnosti');
    }
  }

  function startEdit(tag: ProjectPhaseTag) {
    setEditingTag(tag);
    setFormData({ name: tag.name, color: tag.color });
    setShowForm(true);
  }

  function cancelEdit() {
    setEditingTag(null);
    setFormData({ name: '', color: '#3b82f6' });
    setShowForm(false);
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Načítání štítků činností...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TagIcon className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Štítky činností</h2>
        </div>
        {canManage && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <PlusIcon className="w-4 h-4" />
            Přidat štítek
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Název štítku
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Název štítku"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Barva
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-10 w-20 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <CheckIcon className="w-4 h-4" />
              {editingTag ? 'Uložit změny' : 'Přidat štítek'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Zrušit
            </button>
          </div>
        </form>
      )}

      {tags.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          Zatím nebyly vytvořeny žádné štítky činností
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 group hover:shadow-sm transition-shadow"
              style={{ backgroundColor: `${tag.color}15` }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span className="text-sm font-medium" style={{ color: tag.color }}>
                {tag.name}
              </span>
              {canManage && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(tag)}
                    className="p-1 hover:bg-white rounded transition-colors"
                    title="Upravit"
                  >
                    <EditIcon className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="p-1 hover:bg-white rounded transition-colors"
                    title="Smazat"
                  >
                    <TrashIcon className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
