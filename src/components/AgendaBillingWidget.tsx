import React, { useState } from 'react';
import { Project, IncomeRecord, StudioPaymentSettings } from '../types';
import { calculateProjectBilling, formatCurrencyAmount, buildSmartWhatsAppPaymentMessage } from '../utils/paymentPlans';
import { formatWhatsAppUrl } from '../utils/contact';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { 
  AlertCircle, 
  Clock, 
  MessageCircle, 
  CheckCircle2, 
  DollarSign, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpRight,
  Sparkles
} from 'lucide-react';

interface Props {
  projects: Project[];
  incomes?: IncomeRecord[];
  studioSettings?: StudioPaymentSettings;
  privacyMode?: boolean;
  onNavigate?: (path: string) => void;
  onOpenRegisterPayment?: (project: Project) => void;
}

export const AgendaBillingWidget: React.FC<Props> = ({
  projects,
  incomes = [],
  studioSettings,
  privacyMode = false,
  onNavigate,
  onOpenRegisterPayment,
}) => {
  const today = getTodayString();
  const [isExpanded, setIsExpanded] = useState(false);

  // Active (non-archived) projects with billing summary
  const activeProjectsBilling = projects
    .filter(p => !p.archived && p.status !== 'Graduados' && p.status !== 'No concretado')
    .map(p => ({
      project: p,
      billing: calculateProjectBilling(p, incomes),
    }))
    .filter(item => item.billing.saldoPendiente > 0 || item.billing.commitments.some(c => c.status !== 'cobrado'));

  // Commitments due today
  const dueTodayItems = activeProjectsBilling.flatMap(({ project, billing }) => {
    return billing.commitments
      .filter(c => c.status !== 'cobrado' && c.dueDate === today)
      .map(c => ({ project, commitment: c, billing }));
  });

  // Overdue commitments
  const overdueItems = activeProjectsBilling.flatMap(({ project, billing }) => {
    return billing.commitments
      .filter(c => c.status !== 'cobrado' && c.dueDate && c.dueDate < today)
      .map(c => ({ project, commitment: c, billing }));
  });

  // Total pending across all active clients
  const totalPendingARS = activeProjectsBilling
    .filter(it => it.billing.currency === 'ARS')
    .reduce((sum, it) => sum + it.billing.saldoPendiente, 0);

  const totalPendingUSD = activeProjectsBilling
    .filter(it => it.billing.currency === 'USD')
    .reduce((sum, it) => sum + it.billing.saldoPendiente, 0);

  const hasUrgentActions = overdueItems.length > 0 || dueTodayItems.length > 0;

  // If no pending balances and no commitments at all
  if (activeProjectsBilling.length === 0) {
    return null;
  }

  const handleSendWhatsApp = (project: Project, commitment?: any) => {
    if (!project.clientPhone) {
      alert(`El cliente ${project.clientName} no tiene teléfono registrado.`);
      return;
    }
    hapticFeedback.medium();
    const message = buildSmartWhatsAppPaymentMessage({
      project,
      studioSettings,
      commitment,
      incomes,
    });
    const url = formatWhatsAppUrl(project.clientPhone, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3.5 sm:p-4 shadow-xs space-y-3">
      {/* Top Banner / Summary */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            overdueItems.length > 0 
              ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
              : dueTodayItems.length > 0
              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
          }`}>
            {overdueItems.length > 0 ? (
              <AlertCircle className="w-4 h-4" />
            ) : dueTodayItems.length > 0 ? (
              <Clock className="w-4 h-4" />
            ) : (
              <DollarSign className="w-4 h-4" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-[var(--text-primary)] font-heading">
                Cobranzas & Saldos Activos
              </h3>
              {overdueItems.length > 0 ? (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 font-bold">
                  {overdueItems.length} {overdueItems.length === 1 ? 'atrasado' : 'atrasados'}
                </span>
              ) : dueTodayItems.length > 0 ? (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold">
                  {dueTodayItems.length} para hoy
                </span>
              ) : (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                  Al día
                </span>
              )}
            </div>

            <div className="text-[11px] font-mono text-[var(--text-secondary)] mt-0.5">
              <span>Saldos por cobrar: </span>
              <strong className="text-[var(--text-primary)]">
                {privacyMode ? '$ ••••••' : [
                  totalPendingARS > 0 ? formatCurrencyAmount(totalPendingARS, 'ARS', true) : null,
                  totalPendingUSD > 0 ? formatCurrencyAmount(totalPendingUSD, 'USD', true) : null,
                ].filter(Boolean).join(' + ') || 'Sin saldos'}
              </strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setIsExpanded(prev => !prev);
            }}
            className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-muted)]/80 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium flex items-center gap-1 transition cursor-pointer"
          >
            <span>{isExpanded ? 'Ocultar' : 'Ver detalle'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Urgent Overdue & Today Actions list (Always visible if urgent) */}
      {hasUrgentActions && (
        <div className="space-y-1.5 pt-1">
          {overdueItems.map(({ project, commitment, billing }) => (
            <div 
              key={`${project.id}-${commitment.id}`}
              className="p-2.5 rounded-xl bg-red-500/5 border border-red-500/20 flex items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold text-[var(--text-primary)] truncate">{project.clientName}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-500/10 text-red-500 font-bold shrink-0">
                    Vencido {commitment.dueDate}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] font-mono truncate mt-0.5">
                  {commitment.title}: <strong className="text-[var(--text-primary)]">{formatCurrencyAmount(commitment.amount, billing.currency, true)}</strong>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {project.clientPhone && (
                  <button
                    type="button"
                    onClick={() => handleSendWhatsApp(project, commitment)}
                    className="p-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition active:scale-95"
                    title="Enviar recordatorio con datos de cobro por WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </button>
                )}

                {onOpenRegisterPayment && (
                  <button
                    type="button"
                    onClick={() => onOpenRegisterPayment(project)}
                    className="p-1.5 rounded-lg btn-solid-primary font-semibold text-[11px] flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <DollarSign className="w-3 h-3" />
                    <span>Cobrar</span>
                  </button>
                )}
              </div>
            </div>
          ))}

          {dueTodayItems.map(({ project, commitment, billing }) => (
            <div 
              key={`${project.id}-${commitment.id}`}
              className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold text-[var(--text-primary)] truncate">{project.clientName}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 font-bold shrink-0">
                    Vence hoy
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] font-mono truncate mt-0.5">
                  {commitment.title}: <strong className="text-[var(--text-primary)]">{formatCurrencyAmount(commitment.amount, billing.currency, true)}</strong>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {project.clientPhone && (
                  <button
                    type="button"
                    onClick={() => handleSendWhatsApp(project, commitment)}
                    className="p-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition active:scale-95"
                    title="Avisar por WhatsApp con datos bancarios"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </button>
                )}

                {onOpenRegisterPayment && (
                  <button
                    type="button"
                    onClick={() => onOpenRegisterPayment(project)}
                    className="p-1.5 rounded-lg btn-solid-primary font-semibold text-[11px] flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <DollarSign className="w-3 h-3" />
                    <span>Cobrar</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expanded list of all active projects with pending balances */}
      {isExpanded && (
        <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)] animate-in fade-in duration-150">
          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
            Clientes activos con saldo pendiente ({activeProjectsBilling.length}):
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {activeProjectsBilling.map(({ project, billing }) => (
              <div 
                key={project.id}
                className="p-2 rounded-xl bg-[var(--bg-surface-muted)]/50 border border-[var(--border-subtle)] flex items-center justify-between text-xs gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[var(--text-primary)] truncate">
                    {project.clientName}
                  </div>
                  <div className="text-[10.5px] font-mono text-[var(--text-secondary)]">
                    Faltan {formatCurrencyAmount(billing.saldoPendiente, billing.currency, true)} de {formatCurrencyAmount(billing.montoAcordado, billing.currency, true)} ({billing.porcentajeCobrado}%)
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {project.clientPhone && billing.saldoPendiente > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSendWhatsApp(project)}
                      className="p-1 rounded-lg text-emerald-500 hover:bg-emerald-500/10 cursor-pointer"
                      title="Enviar estado de cuenta por WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {onOpenRegisterPayment && (
                    <button
                      type="button"
                      onClick={() => onOpenRegisterPayment(project)}
                      className="px-2 py-1 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--solid-contrast-bg)] hover:text-[var(--solid-contrast-text)] text-[11px] font-medium border border-[var(--border-subtle)] transition cursor-pointer"
                    >
                      + Pago
                    </button>
                  )}

                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate(`/clientes/${project.id}`)}
                      className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                      title="Abrir ficha de cliente"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
