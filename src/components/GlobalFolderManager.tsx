import { useState, useEffect } from 'react';
import { FolderIcon, PlusIcon, TrashIcon, PencilIcon, XIcon, CheckIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Folder } from '../types';

export function GlobalFolderManager() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');
  const [newFolderType, setNewFolderType] = useState<'tasks' | 'requests'>('tasks');

  useEffect(() => {
    loadGlobalFolders();
  }, []);

  async function loadGlobalFolders() {
    setLoading(true);
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('is_global', true)
      .is('parent_id', null)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading global folders:', error);
      return;
    }

    setFolders(data || []);
    setLoading(false);
  }

  async function createGlobalFolder() {
    if (!newFolderName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('folders')
      .insert({
        name: newFolderName.trim(),
        color: newFolderColor,
        folder_type: newFolderType,
        is_global: true,
        owner_id: user.id,
        position: folders.length,
        parent_id: null
      });

    if (error) {
      console.error('Error creating global folder:', error);
      alert('Chyba při vytváření globální složky');
      return;
    }

    setNewFolderName('');
    setNewFolderColor('#3B82F6');
    setNewFolderType('tasks');
    setCreating(false);
    loadGlobalFolders();
  }

  async function updateFolder(folderId: string, name: string, color: string) {
    const { error } = await supabase
      .from('folders')
      .update({ name, color })
      .eq('id', folderId);

    if (error) {
      console.error('Error updating folder:', error);
      alert('Chyba při aktualizaci složky');
      return;
    }

    setEditingId(null);
    loadGlobalFolders();
  }

  async function deleteFolder(folderId: string) {
    if (!confirm('Opravdu chcete smazat tuto globální složku? Všechny úkoly v ní budou také smazány.')) {
      return;
    }

    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId);

    if (error) {
      console.error('Error deleting folder:', error);
      alert('Chyba při mazání složky');
      return;
    }

    loadGlobalFolders();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Načítání...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Globální složky</h2>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <PlusIcon className="w-4 h-4" />
            Nová globální složka
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Globální složky jsou viditelné pro všechny uživatele a lze do nich vytvářet úkoly
        </p>
      </div>

      <div className="p-6">
        {creating && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Nová globální složka</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Název
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Název složky"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Barva
                  </label>
                  <input
                    type="color"
                    value={newFolderColor}
                    onChange={(e) => setNewFolderColor(e.target.value)}
                    className="w-full h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Typ
                  </label>
                  <select
                    value={newFolderType}
                    onChange={(e) => setNewFolderType(e.target.value as 'tasks' | 'requests')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="tasks">Úkoly</option>
                    <option value="requests">Požadavky</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setCreating(false);
                    setNewFolderName('');
                    setNewFolderColor('#3B82F6');
                    setNewFolderType('tasks');
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                >
                  Zrušit
                </button>
                <button
                  onClick={createGlobalFolder}
                  disabled={!newFolderName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Vytvořit
                </button>
              </div>
            </div>
          </div>
        )}

        {folders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FolderIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Žádné globální složky</p>
            <p className="text-xs text-gray-400 mt-1">
              Vytvořte první globální složku pro všechny uživatele
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {folders.map((folder) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                isEditing={editingId === folder.id}
                onEdit={() => setEditingId(folder.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={updateFolder}
                onDelete={deleteFolder}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface FolderItemProps {
  folder: Folder;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (folderId: string, name: string, color: string) => void;
  onDelete: (folderId: string) => void;
}

function FolderItem({ folder, isEditing, onEdit, onCancelEdit, onSave, onDelete }: FolderItemProps) {
  const [name, setName] = useState(folder.name);
  const [color, setColor] = useState(folder.color);

  useEffect(() => {
    setName(folder.name);
    setColor(folder.color);
  }, [folder.name, folder.color, isEditing]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoFocus
        />
        <span className="text-xs text-gray-500 px-2 py-1 bg-white rounded border border-gray-200">
          {folder.folder_type === 'tasks' ? 'Úkoly' : 'Požadavky'}
        </span>
        <button
          onClick={() => onSave(folder.id, name, color)}
          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          title="Uložit"
        >
          <CheckIcon className="w-5 h-5" />
        </button>
        <button
          onClick={onCancelEdit}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Zrušit"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      <div
        className="w-10 h-10 rounded flex items-center justify-center"
        style={{ backgroundColor: folder.color }}
      >
        <FolderIcon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1">
        <div className="font-medium text-gray-900">{folder.name}</div>
        <div className="text-xs text-gray-500">
          {folder.folder_type === 'tasks' ? 'Úkoly' : 'Požadavky'}
        </div>
      </div>
      <button
        onClick={onEdit}
        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="Upravit"
      >
        <PencilIcon className="w-4 h-4" />
      </button>
      <button
        onClick={() => onDelete(folder.id)}
        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        title="Smazat"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
