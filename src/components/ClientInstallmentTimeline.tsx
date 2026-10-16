import React from 'react';
import { 
  Project, 
  IncomeRecord, 
  BillingAgreement, 
  BillingInstallment, 
  CuotaStatus 
} from '../types';
import { 
  resolveProjectAgreement, 
  formatCurrencyAmount, 
  getCuotaStatusBadge 
} from '../utils/paymentPlans';
import { hapticFeedback } from '../utils/haptics';
import { 
  Check, 
  Clock, 
  AlertCircle, 
  PieChart, 
  Circle, 
  Sliders, 
  Plus, 
  ChevronRight,
  TrendingUp,
  CreditCard
} from 'lucide-react';

interface Props {
  project: Project;
  incomes?: IncomeRecord[];
  privacyMode?: boolean;
  onSelectCuota: (cuotaId: string) => void;
  onOpenRegisterPayment: () => void;
  onOpenAgreementEditor: () => void;
}

export const ClientInstallmentTimeline: React.FC<Props> = ({
  project,
  incomes = [],
  privacyMode = false,
  onSelectCuota,
  onOpenRegisterPayment,
  onOpenAgreementEditor,
}) => {
  const agreement: BillingAgreement = resolveProjectAgreement(project, incomes);
  const installments = agreement.installments || [];

  // Metrics
  const totalExpected = installments.reduce((sum, i) => sum + (Number(i.expectedAmount) || 0), 0);
  const totalPaid = installments.reduce((sum, i) => sum + (Number(i.actualPaidAmount) || 0), 0);
  const totalPending = Math.max(0, totalExpected - totalPaid);

  const paidCount = installments.filter(
    i => i.status === 'pagado_a_tiempo' || i.status === 'pagado_tarde' || i.actualPaidAmount >= i.expectedAmount
  ).length;

  const currentCuotaIndex = installments.findIndex(
    i => i.status !== 'pagado_a_tiempo' && i.status !== 'pagado_tarde' && i.actualPaidAmount < i.expectedAmount
  );

  const currentCuotaNumber = currentCuotaIndex !== -1 ? currentCuotaIndex + 1 : installments.length;
  const progressPct = totalExpected > 0 ? Math.min(100, Math.round((totalPaid / totalExpected) * 100)) : (totalPaid > 0 ? 100 : 0);

  // Helper to render icon for status
  const renderStatusIcon = (status: CuotaStatus) => {
    switch (status) {
      case 'pagado_a_tiempo':
        return <Check className="w-3.5 h-3.5 stroke-[2.5]" />;
      case 'pagado_tarde':
        return <Clock className="w-3.5 h-3.5 stroke-[2.5]" />;
      case 'vence_hoy':
      case 'vencido':
        return <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />;
      case 'parcial':
        return <PieChart className="w-3.5 h-3.5 stroke-[2.5]" />;
      case 'pendiente':
        return <Clock className="w-3.5 h-3.5 stroke-[2]" />;
      case 'futuro':
      default:
        return <Circle className="w-3.5 h-3.5 stroke-[2]" />;
    }
  };

  const formatShortDate = (d?: string) => {
    if (!d || !d.includes('-')) return '';
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
  };

  if (installments.length === 0) {
    return (
      <div className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-[var(--text-primary)]">Acuerdo de cobro</span>
          </div>
          <button
            type="button"
            onClick={onOpenAgreementEditor}
            className="px-3 py-1.5 rounded-[var(--radius-control)] btn-secondary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configurar acuerdo</span>
          </button>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] italic">
          Todavía no hay cuotas definidas para este cliente. Creá el acuerdo de cobro (cuotas, hitos, abono mensual o pago único).
        </p>
      </div>
    );
  }

  // Label below progress bar
  let progressDescription = '';
  if (agreement.type === 'retainer') {
    progressDescription = `Abono mensual recurrente · Cobrado ${privacyMode ? '$ ••••••' : formatCurrencyAmount(totalPaid, agreement.currency, true)} de ${privacyMode ? '$ ••••••' : formatCurrencyAmount(totalExpected, agreement.currency, true)} (período visible) · Falta ${privacyMode ? '$ ••••••' : formatCurrencyAmount(totalPending, agreement.currency, true)}`;
  } else if (agreement.type === 'hitos') {
    progressDescription = `Va por el hito ${currentCuotaNumber} de ${installments.length} · Cobrado ${privacyMode ? '$ ••••••' : formatCurrencyAmount(totalPaid, agreement.currency, true)} de ${privacyMode ? '$ ••••••' : formatCurrencyAmount(totalExpected, agreement.currency, true)} · Falta ${privacyMode ? '$ ••••••' : formatCurrencyAmount(totalPending, agreement.currency, true)}`;
  } else if (agreement.type === 'unico') {
    progressDescription = `Pago único · Cobrado ${privacyMode ? '$ ••••••' : formatCurrencyAmount(totalPaid, agreement.currency, true)} de ${privacyMode ? '$ ••••••' : formatCurrencyAmount(totalExpected, agreement.currency, true)} · Falta ${privacyMode ? '$ ••••••' : formatCurrencyAmount(totalPending, agreement.currency, true)}`;
  } else {
    progressDescription = `Va por el mes ${currentCuotaNumber} de ${installments.length} · Cobrado ${privacyMode ? '$ ••••••' : formatCurrencyAmount(totalPaid, agreement.currency, true)} de ${privacyMode ? '$ ••••••' : formatCurrencyAmount(totalExpected, agreement.currency, true)} · Falta ${privacyMode ? '$ ••••••' : formatCurrencyAmount(totalPending, agreement.currency, true)}`;
  }

  return (
    <div className="card-swiss p-3.5 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3.5 shadow-sm">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[var(--text-primary)] font-heading">
                Cronograma de Cobros
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-[var(--bg-app)] text-[var(--text-secondary)] border border-[var(--border-subtle)] font-medium">
                {agreement.type === 'cuotas' ? `Programa en cuotas (${installments.length})` : 
                 agreement.type === 'hitos' ? 'Hitos de entrega' : 
                 agreement.type === 'retainer' ? 'Retainer mensual' : 
                 agreement.type === 'por_hora' ? 'Por hora / suelto' : 'Pago único'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              onOpenAgreementEditor();
            }}
            className="px-2.5 py-1.5 rounded-[var(--radius-control)] btn-secondary text-[11px] font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Editar acuerdo y cuotas de cobro"
          >
            <Sliders className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <span>Editar acuerdo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.medium();
              onOpenRegisterPayment();
            }}
            className="px-3 py-1.5 rounded-[var(--radius-control)] btn-solid-primary text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
            title="Registrar cobro para este cliente"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Registrar pago</span>
          </button>
        </div>
      </div>

      {/* Horizontal Timeline Chips (3) */}
      <div className="relative">
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar scroll-smooth">
          {installments.map((cuota, index) => {
            const badge = getCuotaStatusBadge(cuota.status, cuota.delayDays);
            const isFullyPaid = cuota.status === 'pagado_a_tiempo' || cuota.status === 'pagado_tarde';
            const displayAmount = privacyMode ? '$ ••••••' : formatCurrencyAmount(cuota.expectedAmount, cuota.currency);
            const shortDue = formatShortDate(cuota.dueDate);

            return (
              <button
                key={cuota.id || index}
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  onSelectCuota(cuota.id);
                }}
                className={`group flex-shrink-0 min-w-[130px] sm:min-w-[145px] p-2.5 rounded-xl border text-left transition-all duration-150 active:scale-[0.98] cursor-pointer hover:border-[var(--border-strong)] hover:shadow-xs relative bg-[var(--bg-app)]/70 ${
                  cuota.status === 'vencido' ? 'border-rose-500/40 bg-rose-500/5' :
                  cuota.status === 'vence_hoy' ? 'border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20' :
                  isFullyPaid ? 'border-emerald-500/30' : 'border-[var(--border-subtle)]'
                }`}
                title={`Ver detalle de ${cuota.title}`}
              >
                {/* Header: Title + Status Icon */}
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <span className="text-[11px] font-bold text-[var(--text-primary)] truncate max-w-[85px]">
                    {cuota.title}
                  </span>
                  <span 
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md shrink-0 ${badge.badgeClass}`}
                    title={badge.label}
                  >
                    {renderStatusIcon(cuota.status)}
                  </span>
                </div>

                {/* Amount */}
                <div className="font-mono text-xs font-bold text-[var(--text-primary)]">
                  {displayAmount}
                </div>

                {/* Status Text & Due Date */}
                <div className="flex items-center justify-between text-[10px] mt-1 pt-1 border-t border-[var(--border-subtle)]">
                  <span className={`font-medium truncate ${
                    cuota.status === 'vencido' ? 'text-rose-400 font-semibold' :
                    cuota.status === 'vence_hoy' ? 'text-amber-400 font-semibold' :
                    isFullyPaid ? 'text-emerald-400' :
                    cuota.status === 'parcial' ? 'text-sky-400' :
                    'text-[var(--text-tertiary)]'
                  }`}>
                    {badge.label}
                  </span>

                  {shortDue && (
                    <span className="font-mono text-[9.5px] text-[var(--text-tertiary)] ml-1 shrink-0">
                      {shortDue}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress Bar & Clear Text (Va por el mes 3 de 6 · cobrado X de Y · falta Z) */}
      <div className="space-y-1.5 pt-1">
        <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
          <div 
            className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
          <p className="text-[11px] text-[var(--text-secondary)] font-medium">
            {progressDescription}
          </p>
          <span className="text-[11px] font-mono font-bold text-emerald-400 shrink-0">
            {progressPct}% cobrado
          </span>
        </div>
      </div>
    </div>
  );
};
