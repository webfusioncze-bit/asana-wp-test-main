import { useState, useEffect } from 'react';
import { PlusIcon, EditIcon, TrashIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RequestType } from '../types';

export function RequestTypeManager() {
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<RequestType | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3B82F6',
  });

  useEffect(() => {
    loadRequestTypes();
  }, []);

  async function loadRequestTypes() {
    setLoading(true);
    const { data, error } = await supabase
      .from('request_types')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading request types:', error);
    } else {
      setRequestTypes(data || []);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingType) {
      const { error } = await supabase
        .from('request_types')
        .update({
          name: formData.name,
          color: formData.color,
        })
        .eq('id', editingType.id);

      if (error) {
        console.error('Error updating request type:', error);
        alert('Chyba při úpravě typu: ' + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('request_types')
        .insert({
          name: formData.name,
          color: formData.color,
          created_by: user.id,
        });

      if (error) {
        console.error('Error creating request type:', error);
        alert('Chyba při vytváření typu: ' + error.message);
        return;
      }
    }

    setFormData({ name: '', color: '#3B82F6' });
    setEditingType(null);
    setShowForm(false);
    loadRequestTypes();
  }

  async function handleDelete(id: string) {
    if (!confirm('Opravdu chcete smazat tento typ?')) return;

    const { error } = await supabase
      .from('request_types')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting request type:', error);
      alert('Chyba při mazání typu: ' + error.message);
      return;
    }

    loadRequestTypes();
  }

  function startEdit(type: RequestType) {
    setEditingType(type);
    setFormData({
      name: type.name,
      color: type.color,
    });
    setShowForm(true);
  }

  function cancelEdit() {
    setEditingType(null);
    setFormData({ name: '', color: '#3B82F6' });
    setShowForm(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Typy poptávek</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
        >
          <PlusIcon className="w-4 h-4" />
          Nový typ
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Název typu
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="např. Tvorba webu, Redesign..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
                className="w-20 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
            >
              {editingType ? 'Uložit změny' : 'Vytvořit'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              Zrušit
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500 text-center py-8">Načítání...</p>
      ) : requestTypes.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Zatím žádné typy poptávek</p>
      ) : (
        <div className="space-y-2">
          {requestTypes.map((type) => (
            <div
              key={type.id}
              className="bg-white p-4 rounded-lg border border-gray-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded"
                  style={{ backgroundColor: type.color }}
                />
                <span className="font-medium text-gray-900">{type.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(type)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(type.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
