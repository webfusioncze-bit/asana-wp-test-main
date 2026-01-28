import { useState, useEffect } from 'react';
import { TagIcon, PlusIcon, XIcon, TrashIcon, CheckIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ProjectTag } from '../types';

interface ProjectTagsManagerProps {
  projectId: string;
  canManage: boolean;
}

export function ProjectTagsManager({ projectId, canManage }: ProjectTagsManagerProps) {
  const [allTags, setAllTags] = useState<ProjectTag[]>([]);
  const [projectTags, setProjectTags] = useState<ProjectTag[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [loading, setLoading] = useState(false);

  const predefinedColors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#64748b', '#6b7280', '#000000'
  ];

  useEffect(() => {
    loadTags();
    loadProjectTags();
  }, [projectId]);

  async function loadTags() {
    const { data } = await supabase
      .from('project_tags')
      .select('*')
      .order('name');

    if (data) {
      setAllTags(data);
    }
  }

  async function loadProjectTags() {
    const { data } = await supabase
      .from('project_tag_assignments')
      .select('tag_id, project_tags(*)')
      .eq('project_id', projectId);

    if (data) {
      const tags = data
        .map(ta => ta.project_tags)
        .filter(Boolean) as ProjectTag[];
      setProjectTags(tags);
    }
  }

  async function createTag() {
    if (!newTagName.trim()) return;

    setLoading(true);

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
      setLoading(false);
      return;
    }

    if (newTag) {
      setAllTags(prev => [...prev, newTag]);
      await assignTagToProject(newTag.id);
    }

    setNewTagName('');
    setNewTagColor('#3b82f6');
    setShowNewTagForm(false);
    setLoading(false);
  }

  async function assignTagToProject(tagId: string) {
    const { error } = await supabase
      .from('project_tag_assignments')
      .insert({
        project_id: projectId,
        tag_id: tagId,
      });

    if (error) {
      console.error('Error assigning tag:', error);
      return;
    }

    await loadProjectTags();
  }

  async function removeTagFromProject(tagId: string) {
    const { error } = await supabase
      .from('project_tag_assignments')
      .delete()
      .eq('project_id', projectId)
      .eq('tag_id', tagId);

    if (error) {
      console.error('Error removing tag:', error);
      return;
    }

    await loadProjectTags();
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
    setProjectTags(prev => prev.filter(t => t.id !== tagId));
  }

  const availableTags = allTags.filter(
    tag => !projectTags.some(pt => pt.id === tag.id)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">Štítky projektu</label>
        {canManage && (
          <button
            onClick={() => setShowTagPicker(!showTagPicker)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" />
            Přidat štítek
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {projectTags.map(tag => (
          <div
            key={tag.id}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: tag.color + '20',
              color: tag.color,
              border: `1px solid ${tag.color}40`,
            }}
          >
            <TagIcon className="w-3.5 h-3.5" />
            <span>{tag.name}</span>
            {canManage && (
              <button
                onClick={() => removeTagFromProject(tag.id)}
                className="ml-1 hover:opacity-70"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {projectTags.length === 0 && (
          <p className="text-sm text-gray-500">Žádné štítky</p>
        )}
      </div>

      {showTagPicker && canManage && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700">Vyberte štítek</h4>
            <button
              onClick={() => setShowTagPicker(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => {
                    assignTagToProject(tag.id);
                    setShowTagPicker(false);
                  }}
                  className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:shadow-sm"
                  style={{
                    backgroundColor: tag.color + '10',
                    color: tag.color,
                    border: `1px solid ${tag.color}30`,
                  }}
                >
                  <TagIcon className="w-3.5 h-3.5" />
                  <span>{tag.name}</span>
                  <PlusIcon className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-gray-200 pt-3">
            {!showNewTagForm ? (
              <button
                onClick={() => setShowNewTagForm(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <PlusIcon className="w-4 h-4" />
                Vytvořit nový štítek
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Název štítku
                  </label>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Např. Prioritní, Interní..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
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

                <div className="flex items-center gap-2">
                  <button
                    onClick={createTag}
                    disabled={!newTagName.trim() || loading}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckIcon className="w-4 h-4" />
                    Vytvořit a přidat
                  </button>
                  <button
                    onClick={() => {
                      setShowNewTagForm(false);
                      setNewTagName('');
                      setNewTagColor('#3b82f6');
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            )}
          </div>

          {allTags.length > 0 && (
            <div className="border-t border-gray-200 pt-3">
              <h5 className="text-xs font-medium text-gray-700 mb-2">Správa všech štítků</h5>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <div
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: tag.color + '10',
                      color: tag.color,
                      border: `1px solid ${tag.color}30`,
                    }}
                  >
                    <span>{tag.name}</span>
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="hover:opacity-70"
                      title="Odstranit štítek"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
