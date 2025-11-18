import { useState, useEffect } from 'react';
import { PlusIcon, TagIcon, TrashIcon, Edit2Icon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Category } from '../types';

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6');

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading categories:', error);
      return;
    }

    setCategories(data || []);
  }

  async function createCategory() {
    if (!newCategoryName.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('categories')
      .insert({
        name: newCategoryName,
        color: newCategoryColor,
        owner_id: user.id,
      });

    if (error) {
      console.error('Error creating category:', error);
      alert('Chyba při vytváření kategorie: ' + error.message);
      return;
    }

    setNewCategoryName('');
    setNewCategoryColor('#3B82F6');
    setIsCreating(false);
    loadCategories();
  }

  async function updateCategory(id: string, name: string, color: string) {
    const { error } = await supabase
      .from('categories')
      .update({ name, color })
      .eq('id', id);

    if (error) {
      console.error('Error updating category:', error);
      alert('Chyba při úpravě kategorie: ' + error.message);
      return;
    }

    setEditingId(null);
    loadCategories();
  }

  async function deleteCategory(id: string) {
    if (!confirm('Opravdu chcete smazat tuto kategorii?')) return;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting category:', error);
      alert('Chyba při mazání kategorie: ' + error.message);
      return;
    }

    loadCategories();
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Kategorie</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nová kategorie
        </button>
      </div>

      {isCreating && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Název kategorie"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <input
              type="color"
              value={newCategoryColor}
              onChange={(e) => setNewCategoryColor(e.target.value)}
              className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createCategory}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Vytvořit
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewCategoryName('');
                setNewCategoryColor('#3B82F6');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Zrušit
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {categories.length === 0 ? (
          <p className="text-center py-8 text-gray-500">Zatím žádné kategorie</p>
        ) : (
          categories.map(category => (
            <div
              key={category.id}
              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              {editingId === category.id ? (
                <>
                  <input
                    type="color"
                    defaultValue={category.color}
                    onBlur={(e) => updateCategory(category.id, category.name, e.target.value)}
                    className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    defaultValue={category.name}
                    onBlur={(e) => updateCategory(category.id, e.target.value, category.color)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateCategory(category.id, e.currentTarget.value, category.color);
                      }
                    }}
                    className="flex-1 px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                  >
                    Hotovo
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="w-8 h-8 rounded"
                    style={{ backgroundColor: category.color }}
                  />
                  <TagIcon className="w-4 h-4 text-gray-400" />
                  <span className="flex-1 text-gray-800">{category.name}</span>
                  <button
                    onClick={() => setEditingId(category.id)}
                    className="p-2 hover:bg-gray-200 rounded transition-colors"
                  >
                    <Edit2Icon className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => deleteCategory(category.id)}
                    className="p-2 hover:bg-red-50 rounded transition-colors"
                  >
                    <TrashIcon className="w-4 h-4 text-red-500" />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
