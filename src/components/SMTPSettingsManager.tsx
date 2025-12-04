import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MailIcon, SaveIcon, EyeIcon, EyeOffIcon, CheckCircle2Icon, XCircleIcon, ClockIcon, RefreshCwIcon } from 'lucide-react';

interface SMTPSettings {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  use_ssl: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EmailLog {
  id: string;
  to_email: string;
  from_email: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  status: 'sent' | 'failed' | 'pending';
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export function SMTPSettingsManager() {
  const [settings, setSettings] = useState<SMTPSettings | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'logs'>('settings');

  const [formData, setFormData] = useState({
    host: '',
    port: 587,
    username: '',
    password: '',
    from_email: '',
    from_name: '',
    use_tls: true,
    use_ssl: false,
    is_active: true
  });

  useEffect(() => {
    loadSettings();
    loadEmailLogs();
  }, []);

  async function loadSettings() {
    try {
      const { data, error } = await supabase
        .from('smtp_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
        setFormData({
          host: data.host,
          port: data.port,
          username: data.username,
          password: data.password,
          from_email: data.from_email,
          from_name: data.from_name,
          use_tls: data.use_tls,
          use_ssl: data.use_ssl,
          is_active: data.is_active
        });
      }
    } catch (error) {
      console.error('Error loading SMTP settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadEmailLogs() {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEmailLogs(data || []);
    } catch (error) {
      console.error('Error loading email logs:', error);
    }
  }

  async function saveSettings() {
    if (!formData.host || !formData.username || !formData.password || !formData.from_email) {
      alert('Vyplňte všechna povinná pole');
      return;
    }

    setSaving(true);

    try {
      if (settings?.id) {
        const { error } = await supabase
          .from('smtp_settings')
          .update({
            host: formData.host,
            port: formData.port,
            username: formData.username,
            password: formData.password,
            from_email: formData.from_email,
            from_name: formData.from_name,
            use_tls: formData.use_tls,
            use_ssl: formData.use_ssl,
            is_active: formData.is_active
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('smtp_settings')
          .insert({
            host: formData.host,
            port: formData.port,
            username: formData.username,
            password: formData.password,
            from_email: formData.from_email,
            from_name: formData.from_name,
            use_tls: formData.use_tls,
            use_ssl: formData.use_ssl,
            is_active: formData.is_active
          });

        if (error) throw error;
      }

      alert('SMTP nastavení bylo uloženo');
      loadSettings();
    } catch (error) {
      console.error('Error saving SMTP settings:', error);
      alert('Chyba při ukládání nastavení');
    } finally {
      setSaving(false);
    }
  }

  function formatDateTime(dateString: string | null): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('cs-CZ');
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'sent':
        return <CheckCircle2Icon className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircleIcon className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <ClockIcon className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case 'sent':
        return 'Odesláno';
      case 'failed':
        return 'Chyba';
      case 'pending':
        return 'Čeká';
      default:
        return status;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Načítání...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'settings'
              ? 'text-cyan-600 border-b-2 border-cyan-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Nastavení SMTP
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'logs'
              ? 'text-cyan-600 border-b-2 border-cyan-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Historie emailů
        </button>
      </div>

      {activeTab === 'settings' ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <MailIcon className="w-6 h-6 text-cyan-600" />
            <h3 className="text-lg font-semibold text-gray-900">Konfigurace SMTP</h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SMTP Server *
                </label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="smtp.example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Port *
                </label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 587 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="587"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Uživatelské jméno *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Heslo *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="w-4 h-4" />
                    ) : (
                      <EyeIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Odesílatel (email) *
                </label>
                <input
                  type="email"
                  value={formData.from_email}
                  onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="noreply@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jméno odesílatele
                </label>
                <input
                  type="text"
                  value={formData.from_name}
                  onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Systémové upozornění"
                />
              </div>
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.use_tls}
                  onChange={(e) => setFormData({ ...formData, use_tls: e.target.checked })}
                  className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                />
                <span className="text-sm text-gray-700">Použít TLS</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.use_ssl}
                  onChange={(e) => setFormData({ ...formData, use_ssl: e.target.checked })}
                  className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                />
                <span className="text-sm text-gray-700">Použít SSL</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                />
                <span className="text-sm text-gray-700">Aktivní</span>
              </label>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SaveIcon className="w-4 h-4" />
                {saving ? 'Ukládání...' : 'Uložit nastavení'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Historie odeslaných emailů</h3>
            <button
              onClick={loadEmailLogs}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <RefreshCwIcon className="w-4 h-4" />
              Obnovit
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Příjemce</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Předmět</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Odesláno</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vytvořeno</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chyba</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {emailLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Zatím nebyly odeslány žádné emaily
                    </td>
                  </tr>
                ) : (
                  emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span className="text-sm text-gray-900">{getStatusText(log.status)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{log.to_email}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{log.subject}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(log.sent_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(log.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-red-600">
                        {log.error_message ? (
                          <span className="truncate max-w-xs block" title={log.error_message}>
                            {log.error_message}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
