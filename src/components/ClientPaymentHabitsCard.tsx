import React from 'react';
import { Project, IncomeRecord } from '../types';
import { calculateClientPaymentHabits, formatCurrencyAmount } from '../utils/paymentPlans';
import { 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  TrendingUp, 
  HelpCircle,
  Sparkles
} from 'lucide-react';

interface Props {
  project: Project;
  incomes?: IncomeRecord[];
  privacyMode?: boolean;
}

export const ClientPaymentHabitsCard: React.FC<Props> = ({
  project,
  incomes = [],
  privacyMode = false,
}) => {
  const habits = calculateClientPaymentHabits(project, incomes);

  const getTagBadge = () => {
    switch (habits.tag) {
      case 'Puntual':
        return {
          label: 'Puntual',
          badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
          icon: CheckCircle2,
          desc: 'Paga a tiempo la gran mayoría de sus compromisos.',
        };
      case 'Se atrasa seguido':
        return {
          label: 'Se atrasa seguido',
          badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
          icon: Clock,
          desc: habits.avgDelayDays > 0 ? `Suele registrar demoras promedio de ${habits.avgDelayDays} días.` : 'Registra demoras recurrentes en sus cobros.',
        };
      case 'Sin historial suficiente':
      default:
        return {
          label: 'Sin historial suficiente',
          badgeClass: 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/60',
          icon: HelpCircle,
          desc: 'Se requieren al menos 2 pagos reales registrados para perfilar el hábito.',
        };
    }
  };

  const tagInfo = getTagBadge();
  const TagIcon = tagInfo.icon;

  return (
    <div className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3.5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--text-primary)] font-heading">
              Cómo paga este cliente
            </h4>
            <span className="text-[10.5px] text-[var(--text-tertiary)] block">
              Hábitos de pago y puntualidad calculados con el historial real
            </span>
          </div>
        </div>

        {/* Etiqueta automática */}
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${tagInfo.badgeClass}`}>
          <TagIcon className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{tagInfo.label}</span>
        </span>
      </div>

      {/* Grid of habits metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        {/* Puntualidad % */}
        <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
          <span className="text-[10px] uppercase font-mono text-[var(--text-tertiary)] block">
            Puntualidad
          </span>
          <span className="text-base sm:text-lg font-mono font-bold text-[var(--text-primary)] mt-0.5 block">
            {habits.totalPaidCycles > 0 ? `${habits.onTimePercentage}%` : '—'}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5 block">
            {habits.onTimeCount} de {habits.totalPaidCycles} pagos a tiempo
          </span>
        </div>

        {/* Atraso promedio */}
        <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
          <span className="text-[10px] uppercase font-mono text-[var(--text-tertiary)] block">
            Atraso promedio
          </span>
          <span className={`text-base sm:text-lg font-mono font-bold mt-0.5 block ${
            habits.avgDelayDays > 0 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {habits.totalPaidCycles > 0 ? `${habits.avgDelayDays} días` : '—'}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5 block">
            {habits.lateCount > 0 ? `${habits.lateCount} cuotas con demora` : 'Sin demoras registradas'}
          </span>
        </div>

        {/* Día del mes habitual */}
        <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
          <span className="text-[10px] uppercase font-mono text-[var(--text-tertiary)] block">
            Día habitual de pago
          </span>
          <span className="text-base sm:text-lg font-mono font-bold text-[var(--text-primary)] mt-0.5 block">
            {habits.usualPaymentDay ? `Día ${habits.usualPaymentDay}` : '—'}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5 block">
            {habits.usualPaymentDay ? 'del mes calendario' : 'Sin datos suficientes'}
          </span>
        </div>

        {/* Total ciclos pagados */}
        <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
          <span className="text-[10px] uppercase font-mono text-[var(--text-tertiary)] block">
            Pagos completados
          </span>
          <span className="text-base sm:text-lg font-mono font-bold text-emerald-400 mt-0.5 block">
            {habits.totalPaidCycles}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5 block">
            registrados en total
          </span>
        </div>
      </div>

      {/* Última y Próxima Cuota */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
        {/* Última cuota pagada */}
        <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <div>
            <span className="text-[10.5px] uppercase font-mono text-[var(--text-tertiary)] block">
              Último pago recibido
            </span>
            {habits.lastPaidCuota ? (
              <div className="mt-0.5">
                <span className="font-semibold text-[var(--text-primary)] block">
                  {habits.lastPaidCuota.title}
                </span>
                <span className="font-mono text-[11px] text-emerald-400 font-medium">
                  {privacyMode ? '$ ••••••' : formatCurrencyAmount(habits.lastPaidCuota.amount, habits.lastPaidCuota.currency)} · {habits.lastPaidCuota.date}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-[var(--text-tertiary)] italic mt-0.5 block">
                Sin pagos previos
              </span>
            )}
          </div>
        </div>

        {/* Próxima cuota a cobrar */}
        <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <div>
            <span className="text-[10.5px] uppercase font-mono text-[var(--text-tertiary)] block">
              Próximo cobro previsto
            </span>
            {habits.nextUpcomingCuota ? (
              <div className="mt-0.5">
                <span className="font-semibold text-[var(--text-primary)] block">
                  {habits.nextUpcomingCuota.title}
                </span>
                <span className={`font-mono text-[11px] font-medium ${
                  habits.nextUpcomingCuota.isOverdue ? 'text-rose-400 font-bold' : 'text-amber-400'
                }`}>
                  {privacyMode ? '$ ••••••' : formatCurrencyAmount(habits.nextUpcomingCuota.amount, habits.nextUpcomingCuota.currency)} · Vence {habits.nextUpcomingCuota.dueDate}
                  {habits.nextUpcomingCuota.isOverdue ? ' (Atrasada)' : ''}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-emerald-400 italic mt-0.5 block font-medium">
                ✓ Al día (sin cuotas pendientes)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
