import { useState, useEffect } from 'react';
import { X as XIcon, Edit2 as EditIcon, Save as SaveIcon, Plus as PlusIcon, Clock as ClockIcon, MessageSquare as MessageSquareIcon, CheckSquare as CheckSquareIcon, Calendar as CalendarIcon, User as UserIcon, DollarSign as DollarSignIcon, ExternalLink as ExternalLinkIcon, FileText as FileTextIcon, RefreshCw as RefreshIcon, ShoppingCart as ShoppingCartIcon, Zap as ZapIcon, TrendingUp as TrendingUpIcon, Settings as SettingsIcon, Tag as TagIcon, Smartphone as SmartphoneIcon, Trash2 as TrashIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TaskDetail } from './TaskDetail';
import type { Request, RequestType, RequestStatusCustom, User, Task, TimeEntry, RequestNote } from '../types';

interface RequestDetailProps {
  requestId: string;
  onClose: () => void;
  onRequestUpdated?: () => void;
  onEditModeChange?: (isEditing: boolean) => void;
}

type TabType = 'overview' | 'tasks' | 'time' | 'notes';

export function RequestDetail({ requestId, onClose, onRequestUpdated, onEditModeChange }: RequestDetailProps) {
  const [request, setRequest] = useState<Request | null>(null);
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [requestStatus, setRequestStatus] = useState<RequestStatusCustom | null>(null);
  const [assignedUser, setAssignedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showStatusSelector, setShowStatusSelector] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
    development_phase: '',
    request_date: '',
    result: '' as '' | 'success' | 'failure',
    closure_date: '',
  });

  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());
  const [recentlyAddedFields, setRecentlyAddedFields] = useState<Set<string>>(new Set());

  const addField = (fieldName: string) => {
    setVisibleFields(prev => new Set(prev).add(fieldName));
    setRecentlyAddedFields(prev => new Set(prev).add(fieldName));
    setTimeout(() => {
      setRecentlyAddedFields(prev => {
        const n = new Set(prev);
        n.delete(fieldName);
        return n;
      });
    }, 1500);
  };

  const removeField = (fieldName: string, resetValue: () => void) => {
    setVisibleFields(prev => {
      const n = new Set(prev);
      n.delete(fieldName);
      return n;
    });
    resetValue();
  };

  const [newNote, setNewNote] = useState('');
  const [newTimeEntry, setNewTimeEntry] = useState({ hours: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    due_date: '',
  });

  useEffect(() => {
    setIsEditing(false);
    loadRequestDetail();
    loadRequestTypes();
    loadRequestStatuses();
    loadTasks();
    loadTimeEntries();
    loadNotes();
  }, [requestId]);

  useEffect(() => {
    onEditModeChange?.(isEditing);
  }, [isEditing, onEditModeChange]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (showStatusSelector && !target.closest('.status-selector-container')) {
        setShowStatusSelector(false);
      }
      if (showCategorySelector && !target.closest('.category-selector-container')) {
        setShowCategorySelector(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStatusSelector, showCategorySelector]);

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
      development_phase: requestData.development_phase || '',
      request_date: requestData.request_date || '',
      result: requestData.result || '',
      closure_date: requestData.closure_date || '',
    });

    const filledFields = new Set<string>();
    if (requestData.client_name) filledFields.add('client_name');
    if (requestData.client_email) filledFields.add('client_email');
    if (requestData.client_phone) filledFields.add('client_phone');
    if (requestData.subpage_count > 1) filledFields.add('subpage_count');
    if (requestData.source) filledFields.add('source');
    if (requestData.storage_url) filledFields.add('storage_url');
    if (requestData.current_website_url) filledFields.add('current_website_url');
    if (requestData.budget) filledFields.add('budget');
    if (requestData.accepted_price > 0) filledFields.add('accepted_price');
    if (requestData.additional_services) filledFields.add('additional_services');
    if (requestData.delivery_speed) filledFields.add('delivery_speed');
    if (requestData.ai_usage) filledFields.add('ai_usage');
    if (requestData.project_materials_link) filledFields.add('project_materials_link');
    if (requestData.deadline) filledFields.add('deadline');
    if (requestData.favorite_eshop) filledFields.add('favorite_eshop');
    if (requestData.product_count) filledFields.add('product_count');
    if (requestData.marketing_goal) filledFields.add('marketing_goal');
    if (requestData.competitor_url) filledFields.add('competitor_url');
    if (requestData.monthly_management_budget) filledFields.add('monthly_management_budget');
    if (requestData.monthly_credits_budget) filledFields.add('monthly_credits_budget');
    if (requestData.development_phase) filledFields.add('development_phase');
    if (requestData.request_date) filledFields.add('request_date');
    if (requestData.result) filledFields.add('result');
    if (requestData.closure_date) filledFields.add('closure_date');
    setVisibleFields(filledFields);

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
        development_phase: editForm.development_phase || null,
        request_date: editForm.request_date || null,
        result: editForm.result || null,
        closure_date: editForm.closure_date || null,
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

  async function handleCategoryChange(category: 'app' | 'eshop' | 'ppc' | 'management' | 'none') {
    let updates: any = {};

    switch (category) {
      case 'app':
        updates = {
          development_phase: request?.development_phase || 'Neurčeno',
          favorite_eshop: null,
          product_count: null,
          monthly_management_budget: null,
          monthly_credits_budget: null,
        };
        break;
      case 'eshop':
        updates = {
          favorite_eshop: request?.favorite_eshop || '',
          product_count: request?.product_count || '',
          development_phase: null,
          monthly_management_budget: null,
          monthly_credits_budget: null,
        };
        break;
      case 'ppc':
        updates = {
          monthly_management_budget: request?.monthly_management_budget || 'Neurčeno',
          monthly_credits_budget: request?.monthly_credits_budget || 'Neurčeno',
          development_phase: null,
          favorite_eshop: null,
          product_count: null,
        };
        break;
      case 'management':
        updates = {
          monthly_management_budget: request?.monthly_management_budget || 'Neurčeno',
          monthly_credits_budget: null,
          development_phase: null,
          favorite_eshop: null,
          product_count: null,
        };
        break;
      case 'none':
        updates = {
          favorite_eshop: null,
          product_count: null,
          monthly_management_budget: null,
          monthly_credits_budget: null,
          development_phase: null,
        };
        break;
    }

    const { error } = await supabase
      .from('requests')
      .update(updates)
      .eq('id', requestId);

    if (error) {
      alert('Chyba při změně kategorie: ' + error.message);
      return;
    }

    setShowCategorySelector(false);
    loadRequestDetail();
    if (onRequestUpdated) {
      onRequestUpdated();
    }
  }

  async function handleDeleteRequest() {
    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      alert('Chyba při mazání poptávky: ' + error.message);
      return;
    }

    if (onRequestUpdated) {
      onRequestUpdated();
    }
    onClose();
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

  const isAppRequest = (req: Request) => {
    return !!req.development_phase;
  };

  const isEshopRequest = (req: Request) => {
    return !!(req.favorite_eshop || req.product_count);
  };

  const isPPCRequest = (req: Request) => {
    return !!(req.monthly_management_budget && req.monthly_credits_budget);
  };

  const isManagementRequest = (req: Request) => {
    return !!(req.monthly_management_budget && !req.monthly_credits_budget);
  };

  return (
    <div className={`${isEditing ? 'flex-1' : 'w-[600px]'} border-l border-gray-200 bg-white flex flex-col transition-all duration-300`}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Detail poptávky</h2>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <>
              <div className="relative category-selector-container">
                <button
                  onClick={() => setShowCategorySelector(!showCategorySelector)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Změnit kategorii"
                >
                  <TagIcon className="w-5 h-5 text-gray-500" />
                </button>
                {showCategorySelector && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-2 space-y-1">
                      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                        Změnit kategorii
                      </div>
                      <button
                        onClick={() => handleCategoryChange('app')}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                          isAppRequest(request)
                            ? 'bg-purple-50 font-medium'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <SmartphoneIcon className="w-4 h-4 text-purple-600" />
                        <span className="text-sm">Aplikace</span>
                      </button>
                      <button
                        onClick={() => handleCategoryChange('eshop')}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                          isEshopRequest(request)
                            ? 'bg-indigo-50 font-medium'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <ShoppingCartIcon className="w-4 h-4 text-indigo-600" />
                        <span className="text-sm">E-shop</span>
                      </button>
                      <button
                        onClick={() => handleCategoryChange('ppc')}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                          isPPCRequest(request)
                            ? 'bg-green-50 font-medium'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <TrendingUpIcon className="w-4 h-4 text-green-600" />
                        <span className="text-sm">PPC kampaň</span>
                      </button>
                      <button
                        onClick={() => handleCategoryChange('management')}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                          isManagementRequest(request)
                            ? 'bg-blue-50 font-medium'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <SettingsIcon className="w-4 h-4 text-blue-600" />
                        <span className="text-sm">Správa webu</span>
                      </button>
                      <button
                        onClick={() => handleCategoryChange('none')}
                        className="w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 hover:bg-gray-50"
                      >
                        <XIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">Žádná kategorie</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
          {isEditing && (
            <>
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
              >
                <SaveIcon className="w-4 h-4" />
                Ulozit
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
              >
                Zrusit
              </button>
            </>
          )}
          {!isEditing && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
              title="Smazat poptávku"
            >
              <TrashIcon className="w-5 h-5 text-red-500" />
            </button>
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
              <div className="flex gap-6">
                <div className="w-[60%] space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Název *</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Typ poptávky</label>
                      <select
                        value={editForm.request_type_id}
                        onChange={(e) => setEditForm({ ...editForm, request_type_id: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Bez typu</option>
                        {requestTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Stav poptávky</label>
                      <select
                        value={editForm.request_status_id}
                        onChange={(e) => setEditForm({ ...editForm, request_status_id: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Nový</option>
                        {requestStatuses.map(status => (
                          <option key={status.id} value={status.id}>{status.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Popis poptávky</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={12}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      placeholder="Podrobný popis poptávky..."
                    />
                  </div>
                  {(visibleFields.has('additional_services') || editForm.additional_services) && (
                    <div className={`transition-all duration-500 ${recentlyAddedFields.has('additional_services') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-2 -m-2' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-500">Další poptávané služby</label>
                        <button onClick={() => removeField('additional_services', () => setEditForm({...editForm, additional_services: ''}))} className="text-xs text-gray-400 hover:text-red-500">Odebrat</button>
                      </div>
                      <textarea value={editForm.additional_services} onChange={(e) => setEditForm({ ...editForm, additional_services: e.target.value })} rows={4} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none" placeholder="Další služby nebo požadavky..." />
                    </div>
                  )}
                </div>

                <div className="w-[40%] space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {(visibleFields.has('client_name') || editForm.client_name) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('client_name') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Jméno klienta</label>
                          <button onClick={() => removeField('client_name', () => setEditForm({...editForm, client_name: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="text" value={editForm.client_name} onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('client_email') || editForm.client_email) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('client_email') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">E-mail klienta</label>
                          <button onClick={() => removeField('client_email', () => setEditForm({...editForm, client_email: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="email" value={editForm.client_email} onChange={(e) => setEditForm({ ...editForm, client_email: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('client_phone') || editForm.client_phone) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('client_phone') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Telefon klienta</label>
                          <button onClick={() => removeField('client_phone', () => setEditForm({...editForm, client_phone: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="tel" value={editForm.client_phone} onChange={(e) => setEditForm({ ...editForm, client_phone: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('budget') || editForm.budget) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('budget') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Rozpočet</label>
                          <button onClick={() => removeField('budget', () => setEditForm({...editForm, budget: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="text" value={editForm.budget} onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('accepted_price') || editForm.accepted_price > 0) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('accepted_price') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Akceptovaná cena</label>
                          <button onClick={() => removeField('accepted_price', () => setEditForm({...editForm, accepted_price: 0}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="number" value={editForm.accepted_price} onChange={(e) => setEditForm({ ...editForm, accepted_price: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('deadline') || editForm.deadline) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('deadline') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Termín dodání</label>
                          <button onClick={() => removeField('deadline', () => setEditForm({...editForm, deadline: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="date" value={editForm.deadline} onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('request_date') || editForm.request_date) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('request_date') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Datum poptávky</label>
                          <button onClick={() => removeField('request_date', () => setEditForm({...editForm, request_date: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="date" value={editForm.request_date} onChange={(e) => setEditForm({ ...editForm, request_date: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('closure_date') || editForm.closure_date) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('closure_date') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Datum uzavření</label>
                          <button onClick={() => removeField('closure_date', () => setEditForm({...editForm, closure_date: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="date" value={editForm.closure_date} onChange={(e) => setEditForm({ ...editForm, closure_date: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('result') || editForm.result) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('result') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Výsledek poptávky</label>
                          <button onClick={() => removeField('result', () => setEditForm({...editForm, result: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <select value={editForm.result} onChange={(e) => setEditForm({ ...editForm, result: e.target.value as '' | 'success' | 'failure' })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary">
                          <option value="">Nerozhodnuto</option>
                          <option value="success">Úspěch</option>
                          <option value="failure">Neúspěch</option>
                        </select>
                      </div>
                    )}
                    {(visibleFields.has('subpage_count') || editForm.subpage_count > 1) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('subpage_count') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Počet podstránek</label>
                          <button onClick={() => removeField('subpage_count', () => setEditForm({...editForm, subpage_count: 1}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="number" value={editForm.subpage_count} onChange={(e) => setEditForm({ ...editForm, subpage_count: parseInt(e.target.value) || 1 })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('source') || editForm.source) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('source') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Zdroj poptávky</label>
                          <button onClick={() => removeField('source', () => setEditForm({...editForm, source: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="text" value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('current_website_url') || editForm.current_website_url) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('current_website_url') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Aktuální web</label>
                          <button onClick={() => removeField('current_website_url', () => setEditForm({...editForm, current_website_url: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="url" value={editForm.current_website_url} onChange={(e) => setEditForm({ ...editForm, current_website_url: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('storage_url') || editForm.storage_url) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('storage_url') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Odkaz na úložiště</label>
                          <button onClick={() => removeField('storage_url', () => setEditForm({...editForm, storage_url: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="url" value={editForm.storage_url} onChange={(e) => setEditForm({ ...editForm, storage_url: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('delivery_speed') || editForm.delivery_speed) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('delivery_speed') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Rychlost dodání</label>
                          <button onClick={() => removeField('delivery_speed', () => setEditForm({...editForm, delivery_speed: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="text" value={editForm.delivery_speed} onChange={(e) => setEditForm({ ...editForm, delivery_speed: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('ai_usage') || editForm.ai_usage) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('ai_usage') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Využití AI</label>
                          <button onClick={() => removeField('ai_usage', () => setEditForm({...editForm, ai_usage: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="text" value={editForm.ai_usage} onChange={(e) => setEditForm({ ...editForm, ai_usage: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('project_materials_link') || editForm.project_materials_link) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('project_materials_link') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Podklady k projektu</label>
                          <button onClick={() => removeField('project_materials_link', () => setEditForm({...editForm, project_materials_link: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="url" value={editForm.project_materials_link} onChange={(e) => setEditForm({ ...editForm, project_materials_link: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('favorite_eshop') || editForm.favorite_eshop) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('favorite_eshop') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Oblíbený e-shop</label>
                          <button onClick={() => removeField('favorite_eshop', () => setEditForm({...editForm, favorite_eshop: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="url" value={editForm.favorite_eshop} onChange={(e) => setEditForm({ ...editForm, favorite_eshop: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('product_count') || editForm.product_count) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('product_count') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Počet produktů</label>
                          <button onClick={() => removeField('product_count', () => setEditForm({...editForm, product_count: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="text" value={editForm.product_count} onChange={(e) => setEditForm({ ...editForm, product_count: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('marketing_goal') || editForm.marketing_goal) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('marketing_goal') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Cíl marketingu</label>
                          <button onClick={() => removeField('marketing_goal', () => setEditForm({...editForm, marketing_goal: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="text" value={editForm.marketing_goal} onChange={(e) => setEditForm({ ...editForm, marketing_goal: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('competitor_url') || editForm.competitor_url) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('competitor_url') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Adresa konkurence</label>
                          <button onClick={() => removeField('competitor_url', () => setEditForm({...editForm, competitor_url: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="url" value={editForm.competitor_url} onChange={(e) => setEditForm({ ...editForm, competitor_url: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('monthly_management_budget') || editForm.monthly_management_budget) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('monthly_management_budget') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Měsíční správa</label>
                          <button onClick={() => removeField('monthly_management_budget', () => setEditForm({...editForm, monthly_management_budget: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="text" value={editForm.monthly_management_budget} onChange={(e) => setEditForm({ ...editForm, monthly_management_budget: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('monthly_credits_budget') || editForm.monthly_credits_budget) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('monthly_credits_budget') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Měsíční kredity</label>
                          <button onClick={() => removeField('monthly_credits_budget', () => setEditForm({...editForm, monthly_credits_budget: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="text" value={editForm.monthly_credits_budget} onChange={(e) => setEditForm({ ...editForm, monthly_credits_budget: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                    {(visibleFields.has('development_phase') || editForm.development_phase) && (
                      <div className={`transition-all duration-500 ${recentlyAddedFields.has('development_phase') ? 'bg-green-50 ring-2 ring-green-400 rounded-lg p-1.5 -m-1.5' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-500">Fáze vývoje</label>
                          <button onClick={() => removeField('development_phase', () => setEditForm({...editForm, development_phase: ''}))} className="text-xs text-gray-400 hover:text-red-500">x</button>
                        </div>
                        <input type="text" value={editForm.development_phase} onChange={(e) => setEditForm({ ...editForm, development_phase: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-2">Přidat pole:</p>
                    <div className="flex flex-wrap gap-1">
                      {!visibleFields.has('client_name') && !editForm.client_name && (
                        <button onClick={() => addField('client_name')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Jméno klienta</button>
                      )}
                      {!visibleFields.has('client_email') && !editForm.client_email && (
                        <button onClick={() => addField('client_email')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ E-mail klienta</button>
                      )}
                      {!visibleFields.has('client_phone') && !editForm.client_phone && (
                        <button onClick={() => addField('client_phone')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Telefon klienta</button>
                      )}
                      {!visibleFields.has('budget') && !editForm.budget && (
                        <button onClick={() => addField('budget')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Rozpočet</button>
                      )}
                      {!visibleFields.has('accepted_price') && editForm.accepted_price === 0 && (
                        <button onClick={() => addField('accepted_price')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Akceptovaná cena</button>
                      )}
                      {!visibleFields.has('deadline') && !editForm.deadline && (
                        <button onClick={() => addField('deadline')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Termín dodání</button>
                      )}
                      {!visibleFields.has('request_date') && !editForm.request_date && (
                        <button onClick={() => addField('request_date')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Datum poptávky</button>
                      )}
                      {!visibleFields.has('closure_date') && !editForm.closure_date && (
                        <button onClick={() => addField('closure_date')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Datum uzavření</button>
                      )}
                      {!visibleFields.has('result') && !editForm.result && (
                        <button onClick={() => addField('result')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Výsledek poptávky</button>
                      )}
                      {!visibleFields.has('subpage_count') && editForm.subpage_count <= 1 && (
                        <button onClick={() => addField('subpage_count')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Počet podstránek</button>
                      )}
                      {!visibleFields.has('source') && !editForm.source && (
                        <button onClick={() => addField('source')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Zdroj poptávky</button>
                      )}
                      {!visibleFields.has('current_website_url') && !editForm.current_website_url && (
                        <button onClick={() => addField('current_website_url')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Aktuální web</button>
                      )}
                      {!visibleFields.has('storage_url') && !editForm.storage_url && (
                        <button onClick={() => addField('storage_url')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Odkaz na úložiště</button>
                      )}
                      {!visibleFields.has('additional_services') && !editForm.additional_services && (
                        <button onClick={() => addField('additional_services')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Další služby</button>
                      )}
                      {!visibleFields.has('delivery_speed') && !editForm.delivery_speed && (
                        <button onClick={() => addField('delivery_speed')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Rychlost dodání</button>
                      )}
                      {!visibleFields.has('ai_usage') && !editForm.ai_usage && (
                        <button onClick={() => addField('ai_usage')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Využití AI</button>
                      )}
                      {!visibleFields.has('project_materials_link') && !editForm.project_materials_link && (
                        <button onClick={() => addField('project_materials_link')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Podklady k projektu</button>
                      )}
                      {!visibleFields.has('favorite_eshop') && !editForm.favorite_eshop && (
                        <button onClick={() => addField('favorite_eshop')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Oblíbený e-shop</button>
                      )}
                      {!visibleFields.has('product_count') && !editForm.product_count && (
                        <button onClick={() => addField('product_count')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Počet produktů</button>
                      )}
                      {!visibleFields.has('marketing_goal') && !editForm.marketing_goal && (
                        <button onClick={() => addField('marketing_goal')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Cíl marketingu</button>
                      )}
                      {!visibleFields.has('competitor_url') && !editForm.competitor_url && (
                        <button onClick={() => addField('competitor_url')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Adresa konkurence</button>
                      )}
                      {!visibleFields.has('monthly_management_budget') && !editForm.monthly_management_budget && (
                        <button onClick={() => addField('monthly_management_budget')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Měsíční správa</button>
                      )}
                      {!visibleFields.has('monthly_credits_budget') && !editForm.monthly_credits_budget && (
                        <button onClick={() => addField('monthly_credits_budget')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Měsíční kredity</button>
                      )}
                      {!visibleFields.has('development_phase') && !editForm.development_phase && (
                        <button onClick={() => addField('development_phase')} className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded transition-colors">+ Fáze vývoje</button>
                      )}
                    </div>
                  </div>
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
                          className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium"
                          style={{ backgroundColor: requestType.color + '20', color: requestType.color }}
                        >
                          {requestType.name}
                        </span>
                      )}
                      {requestStatus ? (
                        <span
                          className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium"
                          style={{ backgroundColor: requestStatus.color + '20', color: requestStatus.color }}
                        >
                          {requestStatus.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                          Nová poptávka
                        </span>
                      )}
                      {!request.assigned_to ? (
                        <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800">
                          Nepřevzata
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                          Převzata
                        </span>
                      )}
                      {request.source === 'zapier' && (
                        <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700 gap-0.5">
                          <ZapIcon className="w-2 h-2" />
                          Zapier
                        </span>
                      )}
                      {isAppRequest(request) && (
                        <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700 gap-0.5">
                          <SmartphoneIcon className="w-2 h-2" />
                          Aplikace
                        </span>
                      )}
                      {isEshopRequest(request) && (
                        <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700 gap-0.5">
                          <ShoppingCartIcon className="w-2 h-2" />
                          E-shop
                        </span>
                      )}
                      {isPPCRequest(request) && (
                        <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium bg-green-100 text-green-700 gap-0.5">
                          <TrendingUpIcon className="w-2 h-2" />
                          PPC
                        </span>
                      )}
                      {isManagementRequest(request) && (
                        <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 gap-0.5">
                          <SettingsIcon className="w-2 h-2" />
                          Správa webu
                        </span>
                      )}
                      {request.result === 'success' && (
                        <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                          Úspěch
                        </span>
                      )}
                      {request.result === 'failure' && (
                        <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                          Neúspěch
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

                  {(request.delivery_speed || request.ai_usage || request.project_materials_link || request.favorite_eshop || request.product_count || request.marketing_goal || request.competitor_url || request.monthly_management_budget || request.monthly_credits_budget || request.development_phase) && (
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
                        {request.development_phase && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Fáze vývoje aplikace</p>
                            <p className="text-gray-700">{request.development_phase}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700">Rozpočet a termín</h4>
                    {request.request_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-sm flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          Datum poptávky:
                        </span>
                        <span className="text-gray-900 font-medium">{new Date(request.request_date).toLocaleDateString('cs-CZ')}</span>
                      </div>
                    )}
                    {request.closure_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-sm flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          Datum uzavreni:
                        </span>
                        <span className="text-gray-900 font-medium">{new Date(request.closure_date).toLocaleDateString('cs-CZ')}</span>
                      </div>
                    )}
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
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className="p-3 border border-gray-200 rounded-lg bg-white hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                  >
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

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Smazat poptávku?</h3>
            <p className="text-gray-600 mb-6">
              Opravdu chcete smazat tuto poptávku? Tato akce je nevratná. Budou smazány i všechny související poznámky a časové záznamy.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Zrušit
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  handleDeleteRequest();
                }}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Smazat poptávku
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTaskId && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end">
          <div className="absolute inset-0 bg-black bg-opacity-30" onClick={() => setSelectedTaskId(null)} />
          <div className="relative w-[480px] bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <TaskDetail
              taskId={selectedTaskId}
              onClose={() => setSelectedTaskId(null)}
              onTaskUpdated={() => {
                loadTasks();
                onRequestUpdated?.();
              }}
              onSelectTask={setSelectedTaskId}
            />
          </div>
        </div>
      )}
    </div>
  );
}
