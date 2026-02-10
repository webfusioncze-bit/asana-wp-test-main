import { BuildingIcon, UserIcon, PhoneIcon, MailIcon, HashIcon, CalendarIcon, ClockIcon, BanknoteIcon, LayersIcon, TrendingUpIcon } from 'lucide-react';
import type { Project, ProjectPhase } from '../types';

interface ProjectOverviewTabProps {
  project: Project;
  phases: ProjectPhase[];
  phaseHours: Record<string, number>;
}

function StatCard({ label, value, sub, icon: Icon, color = 'blue' }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color?: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-sky-50 text-sky-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-50 text-slate-600',
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color] || colors.blue}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-base font-semibold text-gray-900">{value}</p>
          {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-xs text-gray-400 w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

export function ProjectOverviewTab({ project, phases, phaseHours }: ProjectOverviewTabProps) {
  const totalSpent = Object.values(phaseHours).reduce((s, h) => s + h, 0);
  const totalEstimated = phases.reduce((s, p) => s + (p.estimated_hours || 0), 0);

  const activePhases = phases.filter(p => p.status === 'faze probiha' || p.status === 'fáze probíhá').length;
  const completedPhases = phases.filter(p => p.status === 'dokoncena' || p.status === 'dokončena').length;

  const budgetPercent = project.hour_budget ? (totalSpent / project.hour_budget) * 100 : 0;
  const isOverBudget = budgetPercent > 100;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Celkem vykazano"
          value={`${totalSpent.toFixed(1)}h`}
          sub={project.hour_budget ? `z ${project.hour_budget}h rozpoctu` : undefined}
          icon={ClockIcon}
          color={isOverBudget ? 'red' : 'blue'}
        />
        <StatCard
          label="Faze projektu"
          value={`${phases.length}`}
          sub={`${activePhases} aktivnich, ${completedPhases} dokoncenych`}
          icon={LayersIcon}
          color="slate"
        />
        <StatCard
          label="Odhad celkem"
          value={`${totalEstimated}h`}
          sub={totalEstimated > 0 ? `Vyuzito ${((totalSpent / totalEstimated) * 100).toFixed(0)}%` : undefined}
          icon={TrendingUpIcon}
          color="amber"
        />
        <StatCard
          label="Cenova nabidka"
          value={project.price_offer ? `${project.price_offer.toLocaleString('cs-CZ')} Kc` : '-'}
          icon={BanknoteIcon}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <BuildingIcon className="w-4 h-4 text-gray-400" />
            Informace o klientovi
          </h3>
          <div className="divide-y divide-gray-100">
            <InfoRow label="Firma" value={project.client_company_name} />
            <InfoRow label="Kontakt" value={project.client_contact_person} />
            <InfoRow label="ICO" value={project.client_ico} />
            {project.client_phone && (
              <div className="flex items-center gap-3 py-2">
                <span className="text-xs text-gray-400 w-28 shrink-0">Telefon</span>
                <a href={`tel:${project.client_phone}`} className="text-sm text-sky-600 hover:underline flex items-center gap-1">
                  <PhoneIcon className="w-3 h-3" />
                  {project.client_phone}
                </a>
              </div>
            )}
            {project.client_email && (
              <div className="flex items-center gap-3 py-2">
                <span className="text-xs text-gray-400 w-28 shrink-0">Email</span>
                <a href={`mailto:${project.client_email}`} className="text-sm text-sky-600 hover:underline flex items-center gap-1">
                  <MailIcon className="w-3 h-3" />
                  {project.client_email}
                </a>
              </div>
            )}
            {!project.client_company_name && !project.client_contact_person && !project.client_phone && !project.client_email && (
              <p className="text-xs text-gray-400 py-3">Zadne informace o klientovi</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-gray-400" />
            Terminy a rozpocet
          </h3>
          <div className="divide-y divide-gray-100">
            <InfoRow label="Typ projektu" value={project.project_type} />
            <InfoRow label="Kategorie" value={project.project_category} />
            <InfoRow
              label="Zahajeni"
              value={project.start_date ? new Date(project.start_date).toLocaleDateString('cs-CZ') : null}
            />
            <InfoRow
              label="Dodani"
              value={project.delivery_date ? new Date(project.delivery_date).toLocaleDateString('cs-CZ') : null}
            />
            {project.hour_budget ? (
              <div className="py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-400">Hodinovy rozpocet</span>
                  <span className={`text-xs font-semibold ${isOverBudget ? 'text-red-600' : 'text-gray-700'}`}>
                    {budgetPercent.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOverBudget ? 'bg-red-500' : budgetPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  {totalSpent.toFixed(1)}h z {project.hour_budget}h
                </p>
              </div>
            ) : (
              <InfoRow label="Rozpocet" value="Neni nastaven" />
            )}
          </div>
        </div>
      </div>

      {phases.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Prehled fazi</h3>
          <div className="space-y-2">
            {phases.map(phase => {
              const spent = phaseHours[phase.id] || 0;
              const est = phase.estimated_hours || 0;
              const percent = est > 0 ? (spent / est) * 100 : 0;
              const over = percent > 100;
              return (
                <div key={phase.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-700 w-36 truncate shrink-0" title={phase.name}>
                    {phase.name}
                  </span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        over ? 'bg-red-500' : percent > 80 ? 'bg-amber-500' : 'bg-sky-500'
                      }`}
                      style={{ width: est > 0 ? `${Math.min(percent, 100)}%` : '0%' }}
                    />
                  </div>
                  <span className={`text-[11px] font-medium w-20 text-right shrink-0 ${over ? 'text-red-600' : 'text-gray-500'}`}>
                    {spent.toFixed(1)}h{est > 0 ? ` / ${est}h` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
