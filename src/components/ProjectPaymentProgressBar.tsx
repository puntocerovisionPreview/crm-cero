import React from 'react';
import { Project, IncomeRecord } from '../types';
import { calculateProjectBilling, formatCurrencyAmount } from '../utils/paymentPlans';
import { AlertCircle, CheckCircle2, TrendingUp, Clock, Plus } from 'lucide-react';

interface Props {
  project: Project;
  incomes?: IncomeRecord[];
  usdRate?: number;
  privacyMode?: boolean;
  compact?: boolean;
  onOpenRegisterPayment?: () => void;
  className?: string;
}

export const ProjectPaymentProgressBar: React.FC<Props> = ({
  project,
  incomes = [],
  usdRate,
  privacyMode = false,
  compact = false,
  onOpenRegisterPayment,
  className = '',
}) => {
  const billing = calculateProjectBilling(project, incomes);
  const {
    montoAcordado,
    currency,
    totalCobrado,
    saldoPendiente,
    porcentajeCobrado,
    excedente,
    estado,
    isOverdue,
    overdueCommitment,
  } = billing;

  const displayPaid = privacyMode ? '$ ••••••' : formatCurrencyAmount(totalCobrado, currency, true);
  const displayTotal = privacyMode ? '$ ••••••' : formatCurrencyAmount(montoAcordado, currency, true);
  const displayPending = privacyMode ? '$ ••••••' : formatCurrencyAmount(saldoPendiente, currency, true);
  const displayExcedente = privacyMode ? '$ ••••••' : formatCurrencyAmount(excedente, currency, true);

  // Status color styles (Sobrio / Swiss design)
  let statusBadge = {
    label: 'Sin cobrar',
    bgClass: 'bg-[var(--bg-surface-muted)] text-[var(--text-tertiary)] border-[var(--border-subtle)]',
    barClass: 'bg-[var(--text-tertiary)]',
  };

  if (isOverdue) {
    statusBadge = {
      label: 'Pago atrasado',
      bgClass: 'bg-red-500/10 text-red-500 border-red-500/30',
      barClass: 'bg-red-500',
    };
  } else if (estado === 'excedente') {
    statusBadge = {
      label: `Cobrado completo (+${displayExcedente})`,
      bgClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
      barClass: 'bg-emerald-500',
    };
  } else if (estado === 'cobrado_completo') {
    statusBadge = {
      label: '100% Cobrado',
      bgClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
      barClass: 'bg-emerald-500',
    };
  } else if (estado === 'parcial') {
    statusBadge = {
      label: 'Cobro parcial',
      bgClass: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
      barClass: 'bg-amber-500',
    };
  }

  // Equivalent in USD for ARS projects (informational)
  const usdEquivalent = !privacyMode && currency === 'ARS' && usdRate && usdRate > 0 && montoAcordado > 0
    ? `≈ US$ ${Math.round(montoAcordado / usdRate).toLocaleString('es-AR')}`
    : null;

  if (compact) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <div className="flex items-center justify-between text-[11px] gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-mono font-bold text-[var(--text-primary)]">{displayPaid}</span>
            <span className="text-[var(--text-tertiary)]">/ {displayTotal}</span>
            <span className="font-mono text-[10px] text-[var(--text-secondary)] font-medium">
              ({porcentajeCobrado}%)
            </span>
          </div>

          <div className="shrink-0 flex items-center gap-1">
            {saldoPendiente > 0 && (
              <span className={`text-[10px] font-mono ${isOverdue ? 'text-red-500 font-bold' : 'text-[var(--text-secondary)]'}`}>
                Faltan {displayPending}
              </span>
            )}
            {excedente > 0 && (
              <span className="text-[10px] font-mono text-emerald-500 font-semibold">
                +{displayExcedente}
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-1.5 bg-[var(--bg-surface-muted)] rounded-full overflow-hidden flex">
          <div 
            className={`h-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300 ${statusBadge.barClass}`}
            style={{ width: `${Math.min(100, Math.max(0, porcentajeCobrado))}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2.5 ${className}`}>
      {/* Header Info */}
      <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5">
            <span>Estado de Cobro</span>
            {usdEquivalent && (
              <span className="text-[var(--text-secondary)] font-sans">({usdEquivalent})</span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
            <span className="text-base sm:text-lg font-bold font-mono text-[var(--text-primary)]">
              {displayPaid}
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              de {displayTotal}
            </span>
            <span className="text-xs font-mono font-bold text-[var(--text-primary)] px-1.5 py-0.2 rounded bg-[var(--bg-surface-muted)]">
              {porcentajeCobrado}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full border ${statusBadge.bgClass} flex items-center gap-1`}>
            {isOverdue ? <AlertCircle className="w-3 h-3" /> : (estado === 'cobrado_completo' ? <CheckCircle2 className="w-3 h-3" /> : null)}
            <span>{statusBadge.label}</span>
          </span>

          {onOpenRegisterPayment && (
            <button
              type="button"
              onClick={onOpenRegisterPayment}
              className="px-2.5 py-1 rounded-lg btn-solid-primary text-xs font-semibold flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
              title="Registrar nuevo pago"
            >
              <Plus className="w-3 h-3" />
              <span>Registrar pago</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Visual Progress Bar */}
      <div className="relative w-full h-2.5 bg-[var(--bg-surface-muted)] rounded-full overflow-hidden flex">
        <div 
          className={`h-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-500 rounded-full ${statusBadge.barClass}`}
          style={{ width: `${Math.min(100, Math.max(0, porcentajeCobrado))}%` }}
        />
      </div>

      {/* Footer Info / Remaining / Overdue details */}
      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pt-0.5 flex-wrap gap-1 font-mono">
        <div>
          {saldoPendiente > 0 ? (
            <span className={isOverdue ? 'text-red-500 font-bold' : ''}>
              Faltan por cobrar: <strong className="text-[var(--text-primary)]">{displayPending}</strong>
            </span>
          ) : excedente > 0 ? (
            <span className="text-emerald-500 font-bold">
              Excedente registrado: +{displayExcedente}
            </span>
          ) : (
            <span className="text-emerald-500 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Cuenta saldada en su totalidad
            </span>
          )}
        </div>

        {overdueCommitment && isOverdue && (
          <div className="text-[11px] text-red-500 font-medium">
            Vencido: {overdueCommitment.title} ({overdueCommitment.dueDate})
          </div>
        )}
      </div>
    </div>
  );
};
