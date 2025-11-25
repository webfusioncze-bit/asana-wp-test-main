import { useState, useEffect } from 'react';
import { TagIcon, PlusIcon, Edit2Icon, TrashIcon, XIcon, CheckIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { FolderTag } from '../types';

interface FolderTagsManagerProps {
  folderId: string;
  onTagsUpdated?: () => void;
}

export function FolderTagsManager({ folderId, onTagsUpdated }: FolderTagsManagerProps) {
  const [tags, setTags] = useState<FolderTag[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [newTag, setNewTag] = useState({ name: '', color: '#6B7280' });
  const [editedTag, setEditedTag] = useState({ name: '', color: '' });

  const defaultColors = [
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
    '#EC4899', '#6B7280', '#14B8A6', '#F97316', '#06B6D4'
  ];

  useEffect(() => {
    loadTags();
  }, [folderId]);

  async function loadTags() {
    const { data, error } = await supabase
      .from('folder_tags')
      .select('*')
      .eq('folder_id', folderId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading tags:', error);
      return;
    }

    setTags(data || []);
  }

  async function createTag() {
    if (!newTag.name.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const maxPosition = tags.length > 0 ? Math.max(...tags.map(t => t.position)) : -1;

    const { error } = await supabase
      .from('folder_tags')
      .insert({
        folder_id: folderId,
        name: newTag.name.trim(),
        color: newTag.color,
        position: maxPosition + 1,
        created_by: user.id
      });

    if (error) {
      console.error('Error creating tag:', error);
      return;
    }

    setNewTag({ name: '', color: '#6B7280' });
    setIsCreating(false);
    loadTags();
    onTagsUpdated?.();
  }

  async function updateTag(tagId: string) {
    if (!editedTag.name.trim()) return;

    const { error } = await supabase
      .from('folder_tags')
      .update({
        name: editedTag.name.trim(),
        color: editedTag.color
      })
      .eq('id', tagId);

    if (error) {
      console.error('Error updating tag:', error);
      return;
    }

    setEditingTagId(null);
    loadTags();
    onTagsUpdated?.();
  }

  async function deleteTag(tagId: string) {
    if (!confirm('Opravdu chcete smazat tento tag? Bude odebrán ze všech úkolů.')) return;

    const { error } = await supabase
      .from('folder_tags')
      .delete()
      .eq('id', tagId);

    if (error) {
      console.error('Error deleting tag:', error);
      return;
    }

    loadTags();
    onTagsUpdated?.();
  }

  function startEditing(tag: FolderTag) {
    setEditingTagId(tag.id);
    setEditedTag({ name: tag.name, color: tag.color });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TagIcon className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Tagy složky</h3>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Nový tag
          </button>
        )}
      </div>

      <div className="space-y-2">
        {isCreating && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Název tagu
                </label>
                <input
                  type="text"
                  value={newTag.name}
                  onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                  placeholder="Zadejte název..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createTag();
                    if (e.key === 'Escape') {
                      setIsCreating(false);
                      setNewTag({ name: '', color: '#6B7280' });
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Barva
                </label>
                <div className="flex gap-2 flex-wrap">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewTag({ ...newTag, color })}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        newTag.color === color ? 'border-gray-900 scale-110' : 'border-gray-300 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={createTag}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                >
                  <CheckIcon className="w-4 h-4" />
                  Vytvořit
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewTag({ name: '', color: '#6B7280' });
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm"
                >
                  <XIcon className="w-4 h-4" />
                  Zrušit
                </button>
              </div>
            </div>
          </div>
        )}

        {tags.length === 0 && !isCreating && (
          <p className="text-sm text-gray-500 py-4 text-center">
            Ve složce nejsou žádné tagy. Vytvořte první tag.
          </p>
        )}

        {tags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
          >
            {editingTagId === tag.id ? (
              <div className="flex-1 space-y-3">
                <input
                  type="text"
                  value={editedTag.name}
                  onChange={(e) => setEditedTag({ ...editedTag, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') updateTag(tag.id);
                    if (e.key === 'Escape') setEditingTagId(null);
                  }}
                />
                <div className="flex gap-2 flex-wrap">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditedTag({ ...editedTag, color })}
                      className={`w-7 h-7 rounded-lg border-2 transition-all ${
                        editedTag.color === color ? 'border-gray-900 scale-110' : 'border-gray-300 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateTag(tag.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                  >
                    <CheckIcon className="w-4 h-4" />
                    Uložit
                  </button>
                  <button
                    onClick={() => setEditingTagId(null)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm"
                  >
                    <XIcon className="w-4 h-4" />
                    Zrušit
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm font-medium text-gray-900">{tag.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEditing(tag)}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                    title="Upravit tag"
                  >
                    <Edit2Icon className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => deleteTag(tag.id)}
                    className="p-1.5 hover:bg-red-50 rounded transition-colors"
                    title="Smazat tag"
                  >
                    <TrashIcon className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
