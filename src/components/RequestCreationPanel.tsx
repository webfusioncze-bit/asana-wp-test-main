import { useState, useEffect } from 'react';
import { Bone as XIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Folder, User, RequestType, RequestStatusCustom } from '../types';

interface RequestCreationPanelProps {
  folderId: string | null;
  onClose: () => void;
  onRequestCreated: () => void;
}

export function RequestCreationPanel({ folderId, onClose, onRequestCreated }: RequestCreationPanelProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [requestStatuses, setRequestStatuses] = useState<RequestStatusCustom[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    estimated_hours: '',
    budget: '',
    deadline: '',
    folder_id: folderId || '',
    assigned_to: '',
    request_type_id: '',
    request_status_id: '',
    subpage_count: '1',
    source: '',
    storage_url: '',
    current_website_url: '',
    additional_services: '',
    accepted_price: '',
    favorite_eshop: '',
    product_count: '',
  });

  useEffect(() => {
    loadFolders();
    loadUsers();
    loadRequestTypes();
    loadRequestStatuses();
  }, []);

  async function loadFolders() {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('folder_type', 'requests')
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading folders:', error);
      return;
    }

    setFolders(data || []);
  }

  async function loadUsers() {
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, email');

    if (error) {
      console.error('Error loading users:', error);
      return;
    }

    setUsers((profiles || []).map(p => ({ id: p.id, email: p.email || '' })));
  }

  async function loadRequestTypes() {
    const { data, error } = await supabase
      .from('request_types')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading request types:', error);
      return;
    }

    setRequestTypes(data || []);
  }

  async function loadRequestStatuses() {
    const { data, error } = await supabase
      .from('request_statuses')
      .select('*')
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading request statuses:', error);
      return;
    }

    setRequestStatuses(data || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Musíte být přihlášeni');
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('requests')
      .insert({
        title: formData.title,
        description: formData.description,
        client_name: formData.client_name || null,
        client_email: formData.client_email || null,
        client_phone: formData.client_phone || null,
        status: 'new',
        priority: formData.priority,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : 0,
        budget: formData.budget || null,
        deadline: formData.deadline || null,
        folder_id: formData.folder_id || null,
        assigned_to: formData.assigned_to || user.id,
        created_by: user.id,
        request_type_id: formData.request_type_id || null,
        request_status_id: formData.request_status_id || null,
        subpage_count: formData.subpage_count ? parseInt(formData.subpage_count) : 1,
        additional_services: formData.additional_services || null,
        accepted_price: formData.accepted_price ? parseFloat(formData.accepted_price) : 0,
        source: formData.source || null,
        storage_url: formData.storage_url || null,
        current_website_url: formData.current_website_url || null,
        favorite_eshop: formData.favorite_eshop || null,
        product_count: formData.product_count ? parseInt(formData.product_count) : null,
      });

    setLoading(false);

    if (error) {
      console.error('Error creating request:', error);
      alert('Chyba při vytváření poptávky: ' + error.message);
      return;
    }

    onRequestCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Nová poptávka</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Název poptávky *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Název poptávky..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Popis poptávky</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailní popis poptávky..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jméno a příjmení klienta
              </label>
              <input
                type="text"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="Jan Novák"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email klienta
              </label>
              <input
                type="email"
                value={formData.client_email}
                onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                placeholder="email@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefon klienta
              </label>
              <input
                type="tel"
                value={formData.client_phone}
                onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                placeholder="+420 123 456 789"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Typ poptávky</label>
              <select
                value={formData.request_type_id}
                onChange={(e) => setFormData({ ...formData, request_type_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Vyberte typ</option>
                {requestTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stav poptávky</label>
              <select
                value={formData.request_status_id}
                onChange={(e) => setFormData({
                  ...formData,
                  request_status_id: e.target.value,
                  folder_id: e.target.value
                })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Nový (bez stavu)</option>
                {requestStatuses.map(status => (
                  <option key={status.id} value={status.id}>{status.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priorita</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="low">Nízká</option>
                <option value="medium">Střední</option>
                <option value="high">Vysoká</option>
                <option value="urgent">Urgentní</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Počet podstránek
              </label>
              <input
                type="number"
                min="0"
                value={formData.subpage_count}
                onChange={(e) => setFormData({ ...formData, subpage_count: e.target.value })}
                placeholder="1"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zdroj
              </label>
              <input
                type="text"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                placeholder="např. Google Ads, doporučení..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Odhad hodin
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={formData.estimated_hours}
                onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                placeholder="0"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aktuální adresa webu
            </label>
            <input
              type="url"
              value={formData.current_website_url}
              onChange={(e) => setFormData({ ...formData, current_website_url: e.target.value })}
              placeholder="https://..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Odkaz na uložiště
            </label>
            <input
              type="url"
              value={formData.storage_url}
              onChange={(e) => setFormData({ ...formData, storage_url: e.target.value })}
              placeholder="https://..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Další poptávané služby
            </label>
            <textarea
              value={formData.additional_services}
              onChange={(e) => setFormData({ ...formData, additional_services: e.target.value })}
              rows={3}
              placeholder="Popište další požadované služby..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rozpočet
              </label>
              <input
                type="text"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                placeholder="např. 50000 Kč nebo 'Dle dohody'"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Akceptovaná cena (Kč)
              </label>
              <input
                type="number"
                step="1000"
                min="0"
                value={formData.accepted_price}
                onChange={(e) => setFormData({ ...formData, accepted_price: e.target.value })}
                placeholder="0"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Termín</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                E-shop, který se mi líbí
              </label>
              <input
                type="url"
                value={formData.favorite_eshop}
                onChange={(e) => setFormData({ ...formData, favorite_eshop: e.target.value })}
                placeholder="https://..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Počet produktů e-shopu
              </label>
              <input
                type="number"
                min="0"
                value={formData.product_count}
                onChange={(e) => setFormData({ ...formData, product_count: e.target.value })}
                placeholder="0"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Přiřadit
            </label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Automaticky (já)</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Složka</label>
            <select
              value={formData.folder_id}
              onChange={(e) => setFormData({ ...formData, folder_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Bez složky</option>
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Vytváření...' : 'Vytvořit poptávku'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Zrušit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
