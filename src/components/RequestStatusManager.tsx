import { useState, useEffect } from 'react';
import { PlusIcon, EditIcon, TrashIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { RequestStatusCustom } from '../types';

export function RequestStatusManager() {
  const [requestStatuses, setRequestStatuses] = useState<RequestStatusCustom[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStatus, setEditingStatus] = useState<RequestStatusCustom | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3B82F6',
    position: '0',
  });

  useEffect(() => {
    loadRequestStatuses();
  }, []);

  async function loadRequestStatuses() {
    setLoading(true);
    const { data, error } = await supabase
      .from('request_statuses')
      .select('*')
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading request statuses:', error);
    } else {
      setRequestStatuses(data || []);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingStatus) {
      const { error: updateStatusError } = await supabase
        .from('request_statuses')
        .update({
          name: formData.name,
          color: formData.color,
          position: parseInt(formData.position),
        })
        .eq('id', editingStatus.id);

      if (updateStatusError) {
        console.error('Error updating request status:', updateStatusError);
        alert('Chyba při úpravě stavu: ' + updateStatusError.message);
        return;
      }

      const { error: updateFolderError } = await supabase
        .from('folders')
        .update({
          name: formData.name,
          color: formData.color,
          position: parseInt(formData.position),
        })
        .eq('id', editingStatus.id);

      if (updateFolderError) {
        console.error('Error updating folder:', updateFolderError);
      }
    } else {
      const { data: newStatus, error: insertStatusError } = await supabase
        .from('request_statuses')
        .insert({
          name: formData.name,
          color: formData.color,
          position: parseInt(formData.position),
          created_by: user.id,
        })
        .select()
        .single();

      if (insertStatusError) {
        console.error('Error creating request status:', insertStatusError);
        alert('Chyba při vytváření stavu: ' + insertStatusError.message);
        return;
      }

      if (newStatus) {
        const { error: folderError } = await supabase
          .from('folders')
          .insert({
            id: newStatus.id,
            name: formData.name,
            color: formData.color,
            position: parseInt(formData.position),
            folder_type: 'requests',
            owner_id: user.id,
          });

        if (folderError) {
          console.error('Error creating folder:', folderError);
        }
      }
    }

    setFormData({ name: '', color: '#3B82F6', position: '0' });
    setEditingStatus(null);
    setShowForm(false);
    loadRequestStatuses();
  }

  async function handleDelete(id: string) {
    const { data: requests, error: checkError } = await supabase
      .from('requests')
      .select('id')
      .eq('request_status_id', id);

    if (checkError) {
      console.error('Error checking requests:', checkError);
      alert('Chyba při kontrole poptávek: ' + checkError.message);
      return;
    }

    if (requests && requests.length > 0) {
      alert(`Nelze smazat tento stav. Ve složce je ${requests.length} poptávek. Nejprve je přesuňte do jiného stavu.`);
      return;
    }

    if (!confirm('Opravdu chcete smazat tento stav? Složka bude také smazána.')) return;

    const { error } = await supabase
      .from('request_statuses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting request status:', error);
      alert('Chyba při mazání stavu: ' + error.message);
      return;
    }

    loadRequestStatuses();
  }

  function startEdit(status: RequestStatusCustom) {
    setEditingStatus(status);
    setFormData({
      name: status.name,
      color: status.color,
      position: status.position.toString(),
    });
    setShowForm(true);
  }

  function cancelEdit() {
    setEditingStatus(null);
    setFormData({ name: '', color: '#3B82F6', position: '0' });
    setShowForm(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Stavy poptávek</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
        >
          <PlusIcon className="w-4 h-4" />
          Nový stav
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">Automatické zařazování do složek</p>
        <p>Poptávky se automaticky zařadí do složek podle stavu. Vytvořený stav = složka. Nová poptávka bez stavu bude v hlavním feedu.</p>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Název stavu
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="např. Čeká na cenovou nabídku, V realizaci..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Barva
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-14 h-10 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pořadí
              </label>
              <input
                type="number"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
            >
              {editingStatus ? 'Uložit změny' : 'Vytvořit'}
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
      ) : requestStatuses.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Zatím žádné stavy poptávek</p>
      ) : (
        <div className="space-y-2">
          {requestStatuses.map((status) => (
            <div
              key={status.id}
              className="bg-white p-4 rounded-lg border border-gray-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded"
                  style={{ backgroundColor: status.color }}
                />
                <div>
                  <span className="font-medium text-gray-900">{status.name}</span>
                  <p className="text-xs text-gray-500">Pořadí: {status.position}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(status)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <EditIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(status.id)}
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
