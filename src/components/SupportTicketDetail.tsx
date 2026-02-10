import { useState, useEffect } from 'react';
import {
  XIcon,
  ExternalLinkIcon,
  ClockIcon,
  UserIcon,
  GlobeIcon,
  CalendarIcon,
  MessageSquareIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
  ImageIcon,
  PaperclipIcon,
  DollarSignIcon,
  ShieldIcon,
  CornerDownRightIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SupportTicket, SupportTicketComment } from '../types';

interface SupportTicketDetailProps {
  ticketId: string;
  onClose: () => void;
  onNavigateToWebsite?: (websiteId: string) => void;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  'V pořadí': { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  'V řešení': { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  'Čeká na operátora': { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  'Potřebujeme součinnost': { color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  'Vyřešeno': { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  'Vysoká priorita': { color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  'Střední priorita': { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  'Nízká priorita': { color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
};

export function SupportTicketDetail({ ticketId, onClose, onNavigateToWebsite }: SupportTicketDetailProps) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [comments, setComments] = useState<SupportTicketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [operatorName, setOperatorName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [clientName, setClientName] = useState('');
  const [activeTab, setActiveTab] = useState<'detail' | 'comments'>('detail');

  useEffect(() => {
    loadTicketData();
  }, [ticketId]);

  async function loadTicketData() {
    setLoading(true);

    const { data: ticketData } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();

    if (!ticketData) {
      setLoading(false);
      return;
    }

    setTicket(ticketData);

    const { data: commentsData } = await supabase
      .from('support_ticket_comments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('portal_date', { ascending: true });

    setComments(commentsData || []);

    if (ticketData.operator_user_id) {
      const { data: opProfile } = await supabase
        .from('user_profiles')
        .select('display_name, email')
        .eq('id', ticketData.operator_user_id)
        .maybeSingle();
      if (opProfile) setOperatorName(opProfile.display_name || opProfile.email || '');
    }

    if (ticketData.manager_user_id) {
      const { data: mgrProfile } = await supabase
        .from('user_profiles')
        .select('display_name, email')
        .eq('id', ticketData.manager_user_id)
        .maybeSingle();
      if (mgrProfile) setManagerName(mgrProfile.display_name || mgrProfile.email || '');
    }

    if (ticketData.client_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('name')
        .eq('id', ticketData.client_id)
        .maybeSingle();
      if (clientData) setClientName(clientData.name);
    }

    setLoading(false);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatDateTime(dateStr: string | null) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('cs-CZ', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function buildCommentTree(flatComments: SupportTicketComment[]) {
    const topLevel: SupportTicketComment[] = [];
    const replies: Record<number, SupportTicketComment[]> = {};

    for (const comment of flatComments) {
      if (!comment.parent_portal_comment_id || comment.parent_portal_comment_id === 0) {
        topLevel.push(comment);
      } else {
        if (!replies[comment.parent_portal_comment_id]) {
          replies[comment.parent_portal_comment_id] = [];
        }
        replies[comment.parent_portal_comment_id].push(comment);
      }
    }

    return { topLevel, replies };
  }

  function stripHtml(html: string) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  if (loading) {
    return (
      <div className="w-[520px] flex-shrink-0 border-l border-gray-200 bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="w-[520px] flex-shrink-0 border-l border-gray-200 bg-white flex items-center justify-center text-gray-400">
        Tiket nenalezen
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['V pořadí'];
  const priorityConf = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG['Nízká priorita'];
  const { topLevel, replies } = buildCommentTree(comments);

  return (
    <div className="w-[520px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col h-full">
      <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs text-gray-400 font-mono">#{ticket.portal_id}</span>
              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${statusConf.bg} ${statusConf.color}`}>
                {ticket.status}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${priorityConf.bg} ${priorityConf.color}`}>
                {ticket.priority}
              </span>
              {ticket.is_complaint && (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 border border-red-200">
                  Reklamace
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-gray-900 leading-snug">{ticket.title}</h2>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {ticket.portal_link && (
              <a
                href={ticket.portal_link}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-50 transition-colors"
                title="Otevrit na portalu"
              >
                <ExternalLinkIcon className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-gray-100 -mx-5 px-5 -mb-4 pb-0">
          <button
            onClick={() => setActiveTab('detail')}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'detail'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Detail
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'comments'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquareIcon className="w-3.5 h-3.5" />
            Komentare ({comments.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'detail' ? (
          <div className="p-5 space-y-5">
            {ticket.description && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Popis</h3>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {ticket.description}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {ticket.website_name && (
                <InfoCard
                  icon={<GlobeIcon className="w-4 h-4" />}
                  label="Web"
                  value={ticket.website_name.replace(/^https?:\/\//, '')}
                  onClick={ticket.website_id && onNavigateToWebsite
                    ? () => onNavigateToWebsite(ticket.website_id!)
                    : undefined}
                />
              )}
              {clientName && (
                <InfoCard
                  icon={<UserIcon className="w-4 h-4" />}
                  label="Klient"
                  value={clientName}
                />
              )}
              {operatorName && (
                <InfoCard
                  icon={<ShieldIcon className="w-4 h-4" />}
                  label="Operator"
                  value={operatorName}
                />
              )}
              {managerName && (
                <InfoCard
                  icon={<UserIcon className="w-4 h-4" />}
                  label="Manager"
                  value={managerName}
                />
              )}
              {ticket.portal_created_at && (
                <InfoCard
                  icon={<CalendarIcon className="w-4 h-4" />}
                  label="Vytvoreno"
                  value={formatDate(ticket.portal_created_at)}
                />
              )}
              {ticket.estimated_completion && (
                <InfoCard
                  icon={<CalendarIcon className="w-4 h-4" />}
                  label="Odhad dokonceni"
                  value={formatDate(ticket.estimated_completion)}
                />
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cas a sazba</h3>
              <div className="bg-gray-50 rounded-lg border border-gray-100 divide-y divide-gray-100">
                <TimeRow icon={<DollarSignIcon className="w-4 h-4" />} label="Hodinova sazba" value={ticket.hourly_rate ? `${ticket.hourly_rate} Kc/h` : '-'} />
                <TimeRow icon={<ClockIcon className="w-4 h-4" />} label="Odhadovany cas" value={ticket.estimated_hours || '-'} />
                <TimeRow icon={<ClockIcon className="w-4 h-4" />} label="Skutecny cas" value={ticket.actual_time ? `${ticket.actual_time} h` : '-'} />
                <TimeRow icon={<ClockIcon className="w-4 h-4" />} label="Cas managera" value={ticket.manager_time ? `${ticket.manager_time} h` : '-'} />
                <TimeRow icon={<CheckCircle2Icon className="w-4 h-4" />} label="Schvaleny cas" value={ticket.approved_time ? `${ticket.approved_time} h` : '-'} />
              </div>
            </div>

            {(ticket.screenshot_url || ticket.attachment_url) && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Prilohy</h3>
                <div className="space-y-2">
                  {ticket.screenshot_url && (
                    <a
                      href={ticket.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ImageIcon className="w-4 h-4" />
                      Screenshot
                    </a>
                  )}
                  {ticket.attachment_url && (
                    <a
                      href={ticket.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <PaperclipIcon className="w-4 h-4" />
                      Priloha
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="text-[11px] text-gray-400 pt-2 border-t border-gray-100 space-y-0.5">
              <p>Posledni synchronizace: {formatDateTime(ticket.last_sync_at)}</p>
              <p>Posledni uprava na portalu: {formatDateTime(ticket.portal_modified_at)}</p>
            </div>
          </div>
        ) : (
          <div className="p-5">
            {comments.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                Zadne komentare
              </div>
            ) : (
              <div className="space-y-4">
                {topLevel.map(comment => (
                  <CommentThread
                    key={comment.id}
                    comment={comment}
                    replies={replies[comment.portal_comment_id] || []}
                    formatDateTime={formatDateTime}
                    stripHtml={stripHtml}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={`flex items-start gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-100 ${
        onClick ? 'hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-colors text-left' : ''
      }`}
    >
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
      </div>
    </Comp>
  );
}

function TimeRow({ icon, label, value }: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

function CommentThread({ comment, replies, formatDateTime, stripHtml }: {
  comment: SupportTicketComment;
  replies: SupportTicketComment[];
  formatDateTime: (d: string | null) => string;
  stripHtml: (html: string) => string;
}) {
  return (
    <div>
      <div className="bg-gray-50 rounded-lg border border-gray-100 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-medium text-gray-800">{comment.author_name || 'Neznamy'}</span>
          </div>
          <span className="text-[10px] text-gray-400">{formatDateTime(comment.portal_date)}</span>
        </div>
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-8">
          {stripHtml(comment.content)}
        </div>
      </div>

      {replies.length > 0 && (
        <div className="ml-6 mt-2 space-y-2">
          {replies.map(reply => (
            <div key={reply.id} className="bg-white rounded-lg border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CornerDownRightIcon className="w-3.5 h-3.5 text-gray-300" />
                  <div className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center">
                    <UserIcon className="w-3 h-3" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">{reply.author_name || 'Neznamy'}</span>
                </div>
                <span className="text-[10px] text-gray-400">{formatDateTime(reply.portal_date)}</span>
              </div>
              <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap pl-8">
                {stripHtml(reply.content)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
