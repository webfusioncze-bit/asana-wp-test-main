import { ArrowLeftIcon, PencilIcon, CalendarIcon, ClockIcon, DollarSignIcon, AlertTriangleIcon, CheckCircle2Icon, RefreshCwIcon } from 'lucide-react';
import type { Project } from '../types';

interface ProjectDetailHeaderProps {
  project: Project;
  totalSpentHours: number;
  onClose: () => void;
  onEdit: () => void;
  canManage: boolean;
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  'aktivni': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'dokoncen': { bg: 'bg-gray-100', text: 'text-gray-600' },
  'pozastaven': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'ceka se na klienta': { bg: 'bg-sky-100', text: 'text-sky-700' },
  'zrusen': { bg: 'bg-red-100', text: 'text-red-700' },
};

function getStatusStyle(status: string) {
  const key = status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const [k, v] of Object.entries(statusConfig)) {
    if (key.includes(k)) return v;
  }
  return { bg: 'bg-gray-100', text: 'text-gray-700' };
}

export function ProjectDetailHeader({ project, totalSpentHours, onClose, onEdit, canManage }: ProjectDetailHeaderProps) {
  const budgetPercent = project.hour_budget ? (totalSpentHours / project.hour_budget) * 100 : 0;
  const isOverBudget = budgetPercent > 100;
  const daysToDeadline = project.delivery_date
    ? Math.ceil((new Date(project.delivery_date).getTime() - Date.now()) / 86400000)
    : null;
  const isOverdue = daysToDeadline !== null && daysToDeadline < 0;
  const style = getStatusStyle(project.status);

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-6 py-3">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={onClose}
            className="p-1 -ml-1 rounded hover:bg-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4 text-gray-500" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 truncate">{project.name}</h1>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`}>
                {project.status}
              </span>
              {project.project_type && (
                <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  {project.project_type}
                </span>
              )}
              {project.sync_enabled && (
                <span className="shrink-0 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                  <RefreshCwIcon className="w-3 h-3" />
                  Sync
                </span>
              )}
              {canManage && (
                <button onClick={onEdit} className="shrink-0 p-1 rounded hover:bg-gray-100 transition-colors">
                  <PencilIcon className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>
            {project.description && (
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-2xl">{project.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 ml-8 mt-2">
          {project.hour_budget ? (
            <div className="flex items-center gap-2">
              <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
              <div className="flex items-center gap-1.5">
                <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOverBudget ? 'bg-red-500' : budgetPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-medium ${isOverBudget ? 'text-red-600' : 'text-gray-600'}`}>
                  {totalSpentHours.toFixed(1)}h / {project.hour_budget}h
                </span>
                {isOverBudget && (
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-red-600">
                    <AlertTriangleIcon className="w-3 h-3" />
                    +{(totalSpentHours - project.hour_budget).toFixed(1)}h
                  </span>
                )}
              </div>
            </div>
          ) : null}

          {daysToDeadline !== null && (
            <div className={`flex items-center gap-1.5 text-xs ${
              isOverdue ? 'text-red-600' : daysToDeadline <= 7 ? 'text-amber-600' : 'text-gray-600'
            }`}>
              <CalendarIcon className="w-3.5 h-3.5" />
              <span className="font-medium">
                {isOverdue
                  ? `${Math.abs(daysToDeadline)} dni po terminu`
                  : `${daysToDeadline} dni do dodani`}
              </span>
              {project.delivery_date && (
                <span className="text-gray-400">
                  ({new Date(project.delivery_date).toLocaleDateString('cs-CZ')})
                </span>
              )}
            </div>
          )}

          {project.price_offer ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <DollarSignIcon className="w-3.5 h-3.5 text-gray-400" />
              <span>{project.price_offer.toLocaleString('cs-CZ')} Kc</span>
            </div>
          ) : null}

          {project.client_company_name && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <CheckCircle2Icon className="w-3.5 h-3.5 text-gray-400" />
              <span>{project.client_company_name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
