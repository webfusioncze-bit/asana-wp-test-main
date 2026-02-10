import { useState } from 'react';
import { XIcon, SaveIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Project } from '../types';

interface ProjectEditModalProps {
  project: Project;
  onClose: () => void;
  onSaved: () => void;
}

export function ProjectEditModal({ project, onClose, onSaved }: ProjectEditModalProps) {
  const [form, setForm] = useState({
    name: project.name || '',
    description: project.description || '',
    project_type: project.project_type || '',
    project_category: project.project_category || '',
    status: project.status || 'aktivni',
    client_company_name: project.client_company_name || '',
    client_contact_person: project.client_contact_person || '',
    client_phone: project.client_phone || '',
    client_email: project.client_email || '',
    client_ico: project.client_ico || '',
    price_offer: project.price_offer || 0,
    hour_budget: project.hour_budget || 0,
    start_date: project.start_date || '',
    delivery_date: project.delivery_date || '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);

    const { error } = await supabase
      .from('projects')
      .update({
        name: form.name,
        description: form.description || null,
        project_type: form.project_type,
        project_category: form.project_category,
        status: form.status,
        client_company_name: form.client_company_name || null,
        client_contact_person: form.client_contact_person || null,
        client_phone: form.client_phone || null,
        client_email: form.client_email || null,
        client_ico: form.client_ico || null,
        price_offer: form.price_offer || null,
        hour_budget: form.hour_budget || null,
        start_date: form.start_date || null,
        delivery_date: form.delivery_date || null,
      })
      .eq('id', project.id);

    setSaving(false);

    if (error) {
      console.error('Error updating project:', error);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 pt-[10vh] overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Upravit projekt</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
            <XIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nazev projektu</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Popis</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Typ</label>
              <select
                value={form.project_type}
                onChange={e => setForm({ ...form, project_type: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="vyvoj">Vyvoj</option>
                <option value="udrzba">Udrzba</option>
                <option value="konzultace">Konzultace</option>
                <option value="jine">Jine</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kategorie</label>
              <select
                value={form.project_category}
                onChange={e => setForm({ ...form, project_category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="klientsky">Klientsky</option>
                <option value="interni">Interni</option>
                <option value="open-source">Open-source</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stav</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="aktivni">Aktivni</option>
                <option value="dokoncen">Dokoncen</option>
                <option value="pozastaven">Pozastaven</option>
                <option value="ceka se na klienta">Ceka se na klienta</option>
                <option value="zrusen">Zrusen</option>
              </select>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Klient</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Firma</label>
                <input
                  type="text"
                  value={form.client_company_name}
                  onChange={e => setForm({ ...form, client_company_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kontakt</label>
                <input
                  type="text"
                  value={form.client_contact_person}
                  onChange={e => setForm({ ...form, client_contact_person: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ICO</label>
                <input
                  type="text"
                  value={form.client_ico}
                  onChange={e => setForm({ ...form, client_ico: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={form.client_phone}
                  onChange={e => setForm({ ...form, client_phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={form.client_email}
                  onChange={e => setForm({ ...form, client_email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Rozpocet a terminy</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cenova nabidka (Kc)</label>
                <input
                  type="number"
                  value={form.price_offer}
                  onChange={e => setForm({ ...form, price_offer: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hodinovy rozpocet</label>
                <input
                  type="number"
                  value={form.hour_budget}
                  onChange={e => setForm({ ...form, hour_budget: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Zahajeni</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dodani</label>
                <input
                  type="date"
                  value={form.delivery_date}
                  onChange={e => setForm({ ...form, delivery_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Zrusit
          </button>
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50"
          >
            <SaveIcon className="w-3.5 h-3.5" />
            {saving ? 'Ukladam...' : 'Ulozit zmeny'}
          </button>
        </div>
      </div>
    </div>
  );
}
