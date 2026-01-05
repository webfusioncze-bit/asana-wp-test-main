import { useState, useEffect } from 'react';
import { X as XIcon, Edit2 as EditIcon, Save as SaveIcon, Plus as PlusIcon, Clock as ClockIcon, MessageSquare as MessageSquareIcon, CheckSquare as CheckSquareIcon, Calendar as CalendarIcon, User as UserIcon, DollarSign as DollarSignIcon, ExternalLink as ExternalLinkIcon, FileText as FileTextIcon, RefreshCw as RefreshIcon, ShoppingCart as ShoppingCartIcon, Zap as ZapIcon, TrendingUp as TrendingUpIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Request, RequestType, RequestStatusCustom, User, Task, TimeEntry, RequestNote } from '../types';

interface RequestDetailProps {
  requestId: string;
  onClose: () => void;
  onRequestUpdated?: () => void;
}

type TabType = 'overview' | 'tasks' | 'time' | 'notes';

export function RequestDetail({ requestId, onClose, onRequestUpdated }: RequestDetailProps) {
  const [request, setRequest] = useState<Request | null>(null);
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [requestStatus, setRequestStatus] = useState<RequestStatusCustom | null>(null);
  const [assignedUser, setAssignedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showStatusSelector, setShowStatusSelector] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [notes, setNotes] = useState<RequestNote[]>([]);

  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [requestStatuses, setRequestStatuses] = useState<RequestStatusCustom[]>([]);

  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    request_type_id: '',
    request_status_id: '',
    subpage_count: 1,
    source: '',
    storage_url: '',
    current_website_url: '',
    budget: '',
    accepted_price: 0,
    additional_services: '',
    delivery_speed: '',
    ai_usage: '',
    project_materials_link: '',
    deadline: '',
    favorite_eshop: '',
    product_count: '',
    marketing_goal: '',
    competitor_url: '',
    monthly_management_budget: '',
    monthly_credits_budget: '',
  });

  const [newNote, setNewNote] = useState('');
  const [newTimeEntry, setNewTimeEntry] = useState({ hours: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    due_date: '',
  });

  useEffect(() => {
    loadRequestDetail();
    loadRequestTypes();
    loadRequestStatuses();
  }, [requestId]);

  useEffect(() => {
    if (activeTab === 'tasks') loadTasks();
    if (activeTab === 'time') loadTimeEntries();
    if (activeTab === 'notes') loadNotes();
  }, [activeTab, requestId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (showStatusSelector && !target.closest('.status-selector-container')) {
        setShowStatusSelector(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStatusSelector]);

  async function loadRequestDetail() {
    setLoading(true);

    const { data: requestData, error: requestError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (requestError) {
      console.error('Error loading request:', requestError);
      setLoading(false);
      return;
    }

    if (!requestData) {
      setLoading(false);
      return;
    }

    setRequest(requestData);
    setEditForm({
      title: requestData.title,
      description: requestData.description || '',
      client_name: requestData.client_name || '',
      client_email: requestData.client_email || '',
      client_phone: requestData.client_phone || '',
      request_type_id: requestData.request_type_id || '',
      request_status_id: requestData.request_status_id || '',
      subpage_count: requestData.subpage_count || 1,
      source: requestData.source || '',
      storage_url: requestData.storage_url || '',
      current_website_url: requestData.current_website_url || '',
      budget: requestData.budget || '',
      accepted_price: requestData.accepted_price || 0,
      additional_services: requestData.additional_services || '',
      delivery_speed: requestData.delivery_speed || '',
      ai_usage: requestData.ai_usage || '',
      project_materials_link: requestData.project_materials_link || '',
      deadline: requestData.deadline ? new Date(requestData.deadline).toISOString().split('T')[0] : '',
      favorite_eshop: requestData.favorite_eshop || '',
      product_count: requestData.product_count || '',
      marketing_goal: requestData.marketing_goal || '',
      competitor_url: requestData.competitor_url || '',
      monthly_management_budget: requestData.monthly_management_budget || '',
      monthly_credits_budget: requestData.monthly_credits_budget || '',
    });

    if (requestData.request_type_id) {
      const { data: typeData } = await supabase
        .from('request_types')
        .select('*')
        .eq('id', requestData.request_type_id)
        .maybeSingle();

      if (typeData) setRequestType(typeData);
    }

    if (requestData.request_status_id) {
      const { data: statusData } = await supabase
        .from('request_statuses')
        .select('*')
        .eq('id', requestData.request_status_id)
        .maybeSingle();

      if (statusData) setRequestStatus(statusData);
    }

    if (requestData.assigned_to) {
      const { data: userData } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, display_name')
        .eq('id', requestData.assigned_to)
        .maybeSingle();

      if (userData) {
        setAssignedUser({
          id: userData.id,
          email: userData.email || '',
          first_name: userData.first_name,
          last_name: userData.last_name,
          display_name: userData.display_name
        });
      }
    } else {
      setAssignedUser(null);
    }

    setLoading(false);
  }

  async function loadRequestTypes() {
    const { data } = await supabase.from('request_types').select('*');
    if (data) setRequestTypes(data);
  }

  async function loadRequestStatuses() {
    const { data } = await supabase.from('request_statuses').select('*').order('position');
    if (data) setRequestStatuses(data);
  }

  async function loadTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (data) setTasks(data);
  }

  async function loadTimeEntries() {
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('request_id', requestId)
      .order('date', { ascending: false });

    if (data) setTimeEntries(data);
  }

  async function loadNotes() {
    const { data } = await supabase
      .from('request_notes')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (data) setNotes(data);
  }

  async function handleTakeRequest() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('requests')
      .update({ assigned_to: user.id })
      .eq('id', requestId);

    if (error) {
      alert('Chyba při převzetí poptávky: ' + error.message);
      return;
    }

    loadRequestDetail();
    if (onRequestUpdated) {
      onRequestUpdated();
    }
  }

  async function handleSaveEdit() {
    const { error } = await supabase
      .from('requests')
      .update({
        title: editForm.title,
        description: editForm.description,
        client_name: editForm.client_name || null,
        client_email: editForm.client_email || null,
        client_phone: editForm.client_phone || null,
        request_type_id: editForm.request_type_id || null,
        request_status_id: editForm.request_status_id || null,
        subpage_count: editForm.subpage_count,
        source: editForm.source || null,
        storage_url: editForm.storage_url || null,
        current_website_url: editForm.current_website_url || null,
        budget: editForm.budget,
        accepted_price: editForm.accepted_price,
        additional_services: editForm.additional_services,
        delivery_speed: editForm.delivery_speed || null,
        ai_usage: editForm.ai_usage || null,
        project_materials_link: editForm.project_materials_link || null,
        deadline: editForm.deadline || null,
        favorite_eshop: editForm.favorite_eshop || null,
        product_count: editForm.product_count || null,
        marketing_goal: editForm.marketing_goal || null,
        competitor_url: editForm.competitor_url || null,
        monthly_management_budget: editForm.monthly_management_budget || null,
        monthly_credits_budget: editForm.monthly_credits_budget || null,
      })
      .eq('id', requestId);

    if (error) {
      alert('Chyba při ukládání: ' + error.message);
      return;
    }

    setIsEditing(false);
    loadRequestDetail();
    if (onRequestUpdated) {
      onRequestUpdated();
    }
  }

  async function handleStatusChange(statusId: string) {
    const { error } = await supabase
      .from('requests')
      .update({
        request_status_id: statusId
      })
      .eq('id', requestId);

    if (error) {
      alert('Chyba při změně stavu: ' + error.message);
      return;
    }

    setShowStatusSelector(false);
    loadRequestDetail();
    if (onRequestUpdated) {
      onRequestUpdated();
    }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('request_notes')
      .insert({
        request_id: requestId,
        user_id: user.id,
        note: newNote,
      });

    if (error) {
      alert('Chyba při přidávání poznámky: ' + error.message);
      return;
    }

    setNewNote('');
    loadNotes();
  }

  async function handleAddTimeEntry() {
    if (!newTimeEntry.hours || parseFloat(newTimeEntry.hours) <= 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('time_entries')
      .insert({
        request_id: requestId,
        user_id: user.id,
        hours: parseFloat(newTimeEntry.hours),
        description: newTimeEntry.description,
        date: newTimeEntry.date,
      });

    if (error) {
      alert('Chyba při přidávání času: ' + error.message);
      return;
    }

    setNewTimeEntry({ hours: '', description: '', date: new Date().toISOString().split('T')[0] });
    loadTimeEntries();
  }

  async function handleCreateTask() {
    if (!newTask.title.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('tasks')
      .insert({
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
        status: 'todo',
        assigned_to: user.id,
        created_by: user.id,
        request_id: requestId,
        folder_id: null,
        category_id: null,
        parent_task_id: null,
        position: 0,
      });

    if (error) {
      alert('Chyba při vytváření úkolu: ' + error.message);
      return;
    }

    setNewTask({
      title: '',
      description: '',
      priority: 'medium',
      due_date: '',
    });
    setShowTaskForm(false);
    loadTasks();
  }

  if (loading) {
    return (
      <div className="w-[600px] border-l border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Detail poptávky</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-gray-500">Načítání...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="w-[600px] border-l border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Detail poptávky</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-gray-500">Poptávka nenalezena</p>
        </div>
      </div>
    );
  }

  const priorityLabels = {
    low: 'Nízká',
    medium: 'Střední',
    high: 'Vysoká',
    urgent: 'Urgentní',
  };

  const priorityColors = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-primary',
    high: 'bg-orange-100 text-orange-600',
    urgent: 'bg-red-100 text-red-600',
  };

  const totalHours = timeEntries.reduce((sum, entry) => sum + parseFloat(entry.hours.toString()), 0);

  const isEshopRequest = (title: string) => {
    const eshopKeywords = ['Chci začít prodávat', 'Chci zvýšit prodeje', 'Chci nový design', 'Přechod z jiného řešení'];
    return eshopKeywords.some(keyword => title.toLowerCase().includes(keyword.toLowerCase()));
  };

  const isPPCRequest = (req: Request) => {
    return !!(req.marketing_goal || req.competitor_url || req.monthly_management_budget || req.monthly_credits_budget);
  };

  return (
    <div className="w-[600px] border-l border-gray-200 bg-white flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Detail poptávky</h2>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <>
              <div className="relative status-selector-container">
                <button
                  onClick={() => setShowStatusSelector(!showStatusSelector)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Změnit stav"
                >
                  <RefreshIcon className="w-5 h-5 text-gray-500" />
                </button>
                {showStatusSelector && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-2 space-y-1">
                      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                        Změnit stav poptávky
                      </div>
                      {requestStatuses.map((status) => (
                        <button
                          key={status.id}
                          onClick={() => handleStatusChange(status.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                            request.request_status_id === status.id
                              ? 'bg-gray-100 font-medium'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: status.color }}
                          />
                          <span className="text-sm">{status.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Upravit"
              >
                <EditIcon className="w-5 h-5 text-gray-500" />
              </button>
            </>
          )}
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 flex">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'overview' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Přehled
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'tasks' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Úkoly ({tasks.length})
        </button>
        <button
          onClick={() => setActiveTab('time')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'time' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Čas ({totalHours.toFixed(1)}h)
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'notes' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Poznámky ({notes.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Název *</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Popis</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                    <select
                      value={editForm.request_type_id}
                      onChange={(e) => setEditForm({ ...editForm, request_type_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Bez typu</option>
                      {requestTypes.map(type => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stav</label>
                    <select
                      value={editForm.request_status_id}
                      onChange={(e) => setEditForm({ ...editForm, request_status_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Nový</option>
                      {requestStatuses.map(status => (
                        <option key={status.id} value={status.id}>{status.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jméno klienta</label>
                    <input
                      type="text"
                      value={editForm.client_name}
                      onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={editForm.client_email}
                      onChange={(e) => setEditForm({ ...editForm, client_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                    <input
                      type="tel"
                      value={editForm.client_phone}
                      onChange={(e) => setEditForm({ ...editForm, client_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Počet podstránek</label>
                    <input
                      type="number"
                      value={editForm.subpage_count}
                      onChange={(e) => setEditForm({ ...editForm, subpage_count: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zdroj</label>
                    <input
                      type="text"
                      value={editForm.source}
                      onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aktuální web</label>
                  <input
                    type="url"
                    value={editForm.current_website_url}
                    onChange={(e) => setEditForm({ ...editForm, current_website_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Odkaz na uložiště</label>
                  <input
                    type="url"
                    value={editForm.storage_url}
                    onChange={(e) => setEditForm({ ...editForm, storage_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Další poptávané služby</label>
                  <textarea
                    value={editForm.additional_services}
                    onChange={(e) => setEditForm({ ...editForm, additional_services: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Další služby nebo požadavky..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rychlost dodání</label>
                    <input
                      type="text"
                      value={editForm.delivery_speed}
                      onChange={(e) => setEditForm({ ...editForm, delivery_speed: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="např. Standardní, Expres..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Využití AI</label>
                    <input
                      type="text"
                      value={editForm.ai_usage}
                      onChange={(e) => setEditForm({ ...editForm, ai_usage: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="např. Ano, Ne..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Podklady k projektu</label>
                    <input
                      type="url"
                      value={editForm.project_materials_link}
                      onChange={(e) => setEditForm({ ...editForm, project_materials_link: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-shop, který se mi líbí</label>
                    <input
                      type="url"
                      value={editForm.favorite_eshop}
                      onChange={(e) => setEditForm({ ...editForm, favorite_eshop: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Počet produktů e-shopu</label>
                    <input
                      type="text"
                      value={editForm.product_count}
                      onChange={(e) => setEditForm({ ...editForm, product_count: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="např. 50-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cíl marketingu</label>
                    <input
                      type="text"
                      value={editForm.marketing_goal}
                      onChange={(e) => setEditForm({ ...editForm, marketing_goal: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="např. Získání nových zákazníků"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresa konkurence</label>
                    <input
                      type="url"
                      value={editForm.competitor_url}
                      onChange={(e) => setEditForm({ ...editForm, competitor_url: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rozpočet na měsíční správu</label>
                    <input
                      type="text"
                      value={editForm.monthly_management_budget}
                      onChange={(e) => setEditForm({ ...editForm, monthly_management_budget: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="např. 5 000 Kč"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rozpočet na měsíční kredity</label>
                    <input
                      type="text"
                      value={editForm.monthly_credits_budget}
                      onChange={(e) => setEditForm({ ...editForm, monthly_credits_budget: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="např. 10 000 Kč"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rozpočet</label>
                    <input
                      type="text"
                      value={editForm.budget}
                      onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="např. 50000 Kč nebo 'Dle dohody'"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Akceptovaná cena (Kč)</label>
                    <input
                      type="number"
                      value={editForm.accepted_price}
                      onChange={(e) => setEditForm({ ...editForm, accepted_price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Termín</label>
                  <input
                    type="date"
                    value={editForm.deadline}
                    onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    <SaveIcon className="w-4 h-4" />
                    Uložit
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            ) : (
              <>
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{request.title}</h3>
                      {!request.assigned_to && (
                        <button
                          onClick={handleTakeRequest}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm whitespace-nowrap flex items-center gap-2"
                        >
                          <UserIcon className="w-4 h-4" />
                          Přebírám poptávku
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {requestType && (
                        <span
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                          style={{ backgroundColor: requestType.color + '20', color: requestType.color }}
                        >
                          {requestType.name}
                        </span>
                      )}
                      {requestStatus ? (
                        <span
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                          style={{ backgroundColor: requestStatus.color + '20', color: requestStatus.color }}
                        >
                          {requestStatus.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                          Nová poptávka
                        </span>
                      )}
                      {!request.assigned_to ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                          Nepřevzata
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                          Převzata
                        </span>
                      )}
                      {request.source === 'zapier' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700 gap-1">
                          <ZapIcon className="w-4 h-4" />
                          Zapier
                        </span>
                      )}
                      {isEshopRequest(request.title) && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-700 gap-1">
                          <ShoppingCartIcon className="w-4 h-4" />
                          E-shop
                        </span>
                      )}
                      {isPPCRequest(request) && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-700 gap-1">
                          <TrendingUpIcon className="w-4 h-4" />
                          PPC
                        </span>
                      )}
                    </div>
                  </div>

                  {request.description && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <FileTextIcon className="w-4 h-4" />
                        Popis poptávky
                      </h4>
                      <p className="text-gray-700 whitespace-pre-wrap">{request.description}</p>
                    </div>
                  )}

                  {request.additional_services && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Další poptávané služby</h4>
                      <p className="text-gray-700 whitespace-pre-line">{request.additional_services}</p>
                    </div>
                  )}

                  {(request.delivery_speed || request.ai_usage || request.project_materials_link || request.favorite_eshop || request.product_count || request.marketing_goal || request.competitor_url || request.monthly_management_budget || request.monthly_credits_budget) && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Doplňující informace</h4>
                      <div className="grid grid-cols-3 gap-4">
                        {request.delivery_speed && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Rychlost dodání</p>
                            <p className="text-gray-700">{request.delivery_speed}</p>
                          </div>
                        )}
                        {request.ai_usage && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Využití AI</p>
                            <p className="text-gray-700">{request.ai_usage}</p>
                          </div>
                        )}
                        {request.project_materials_link && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Podklady k projektu</p>
                            <a
                              href={request.project_materials_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              Odkaz <ExternalLinkIcon className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                        {request.favorite_eshop && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">E-shop, který se mi líbí</p>
                            <a
                              href={request.favorite_eshop}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              Odkaz <ExternalLinkIcon className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                        {request.product_count && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Počet produktů e-shopu</p>
                            <p className="text-gray-700">{request.product_count}</p>
                          </div>
                        )}
                        {request.marketing_goal && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Cíl marketingu</p>
                            <p className="text-gray-700">{request.marketing_goal}</p>
                          </div>
                        )}
                        {request.competitor_url && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Adresa konkurence</p>
                            <a
                              href={request.competitor_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              Odkaz <ExternalLinkIcon className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                        {request.monthly_management_budget && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Rozpočet na měsíční správu</p>
                            <p className="text-gray-700">{request.monthly_management_budget}</p>
                          </div>
                        )}
                        {request.monthly_credits_budget && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Rozpočet na měsíční kredity</p>
                            <p className="text-gray-700">{request.monthly_credits_budget}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700">Rozpočet a termín</h4>
                    {request.budget && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-sm">Rozpočet:</span>
                        <span className="text-gray-900 font-medium">{request.budget}</span>
                      </div>
                    )}
                    {request.accepted_price > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-sm">Akceptovaná cena:</span>
                        <span className="text-green-600 font-semibold">{request.accepted_price.toLocaleString('cs-CZ')} Kč</span>
                      </div>
                    )}
                    {request.deadline && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-sm flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          Termín:
                        </span>
                        <span className="text-gray-900 font-medium">{new Date(request.deadline).toLocaleDateString('cs-CZ')}</span>
                      </div>
                    )}
                    {assignedUser && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-sm flex items-center gap-1">
                          <UserIcon className="w-4 h-4" />
                          Přiřazeno:
                        </span>
                        <span className="text-gray-900 font-medium">
                          {assignedUser.display_name || assignedUser.email}
                        </span>
                      </div>
                    )}
                  </div>

                <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
                  <p>Vytvořeno: {new Date(request.created_at).toLocaleString('cs-CZ')}</p>
                  <p>Upraveno: {new Date(request.updated_at).toLocaleString('cs-CZ')}</p>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Úkoly poptávky</h3>
              <button
                onClick={() => setShowTaskForm(!showTaskForm)}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
              >
                <PlusIcon className="w-4 h-4" />
                Nový úkol
              </button>
            </div>

            {showTaskForm && (
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Název úkolu *</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Název úkolu..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Popis</label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    rows={2}
                    placeholder="Popis úkolu..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priorita</label>
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="low">Nízká</option>
                      <option value="medium">Střední</option>
                      <option value="high">Vysoká</option>
                      <option value="urgent">Urgentní</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Termín</label>
                    <input
                      type="date"
                      value={newTask.due_date}
                      onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCreateTask}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    <CheckSquareIcon className="w-4 h-4" />
                    Vytvořit úkol
                  </button>
                  <button
                    onClick={() => {
                      setShowTaskForm(false);
                      setNewTask({ title: '', description: '', priority: 'medium', due_date: '' });
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Zrušit
                  </button>
                </div>
              </div>
            )}

            {tasks.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Zatím žádné úkoly</p>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id} className="p-3 border border-gray-200 rounded-lg bg-white">
                    <h4 className="font-medium text-gray-900">{task.title}</h4>
                    {task.description && (
                      <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs px-2 py-1 rounded ${
                        task.status === 'completed' ? 'bg-green-100 text-green-700' :
                        task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {task.status === 'completed' ? 'Dokončeno' :
                         task.status === 'in_progress' ? 'Probíhá' : 'K dokončení'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                        task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {task.priority === 'urgent' ? 'Urgentní' :
                         task.priority === 'high' ? 'Vysoká' :
                         task.priority === 'medium' ? 'Střední' : 'Nízká'}
                      </span>
                      {task.due_date && (
                        <span className="text-xs text-gray-500">
                          Termín: {new Date(task.due_date).toLocaleDateString('cs-CZ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'time' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Vykázat čas</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hodiny *</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={newTimeEntry.hours}
                      onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hours: e.target.value })}
                      placeholder="0.0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                    <input
                      type="date"
                      value={newTimeEntry.date}
                      onChange={(e) => setNewTimeEntry({ ...newTimeEntry, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Popis</label>
                  <textarea
                    value={newTimeEntry.description}
                    onChange={(e) => setNewTimeEntry({ ...newTimeEntry, description: e.target.value })}
                    rows={2}
                    placeholder="Co jste dělali..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
                <button
                  onClick={handleAddTimeEntry}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Přidat čas
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Vykazovaný čas (celkem: {totalHours.toFixed(2)}h)
              </h3>
              {timeEntries.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Zatím žádný vykazovaný čas</p>
              ) : (
                <div className="space-y-2">
                  {timeEntries.map(entry => (
                    <div key={entry.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{parseFloat(entry.hours.toString()).toFixed(2)}h</span>
                        <span className="text-sm text-gray-500">{new Date(entry.date).toLocaleDateString('cs-CZ')}</span>
                      </div>
                      {entry.description && (
                        <p className="text-sm text-gray-600">{entry.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Přidat poznámku</h3>
              <div className="space-y-3">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={4}
                  placeholder="Poznámka z hovoru, jednání..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <button
                  onClick={handleAddNote}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                  <MessageSquareIcon className="w-4 h-4" />
                  Přidat poznámku
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Poznámky ({notes.length})</h3>
              {notes.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Zatím žádné poznámky</p>
              ) : (
                <div className="space-y-3">
                  {notes.map(note => (
                    <div key={note.id} className="p-4 border border-gray-200 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap mb-2">{note.note}</p>
                      <p className="text-xs text-gray-500">{new Date(note.created_at).toLocaleString('cs-CZ')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
