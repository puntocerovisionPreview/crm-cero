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
  DollarSign, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface Props {
  projects: Project[];
  incomes?: IncomeRecord[];
  studioSettings?: StudioPaymentSettings;
  privacyMode?: boolean;
  onNavigate?: (path: string) => void;
  onRegisterPayment: (project: Project) => void;
}

export const TodayCollectionsUnifiedBanner: React.FC<Props> = ({
  projects,
  incomes = [],
  studioSettings,
  privacyMode = false,
  onNavigate,
  onRegisterPayment,
}) => {
  const today = getTodayString();
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ui_hoy_cobros_expanded') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleExpanded = () => {
    hapticFeedback.light();
    setIsExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem('ui_hoy_cobros_expanded', String(next));
      } catch {}
      return next;
    });
  };

  // Active projects with billing
  const activeProjects = projects.filter(p => !p.archived && p.status !== 'Graduados' && p.status !== 'No concretado');

  // Find commitments due today or overdue
  const urgentCollections: Array<{
    project: Project;
    commitment: any;
    isOverdue: boolean;
    amount: number;
    currency: string;
    title: string;
  }> = [];

  activeProjects.forEach(project => {
    const billing = calculateProjectBilling(project, incomes);
    billing.commitments.forEach(c => {
      if (c.status !== 'cobrado' && c.dueDate) {
        if (c.dueDate === today) {
          urgentCollections.push({
            project,
            commitment: c,
            isOverdue: false,
            amount: c.amount,
            currency: billing.currency,
            title: c.title || 'Compromiso de pago',
          });
        } else if (c.dueDate < today) {
          urgentCollections.push({
            project,
            commitment: c,
            isOverdue: true,
            amount: c.amount,
            currency: billing.currency,
            title: c.title || 'Cuota vencida',
          });
        }
      }
    });
  });

  // RULE: Only appears if there are cobros vencidos or due today
  if (urgentCollections.length === 0) {
    return null;
  }

  const overdueCount = urgentCollections.filter(c => c.isOverdue).length;
  const todayCount = urgentCollections.length - overdueCount;

  return (
    <div className="card-swiss border-[#D97706]/40 bg-[#D97706]/5 overflow-hidden transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-200">
      {/* Header banner */}
      <div 
        onClick={toggleExpanded}
        className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer select-none gap-3 hover:bg-[#D97706]/10 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#D97706]/20 text-[#D97706] flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4 stroke-[2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-[var(--text-primary)] font-heading">
                Cobros pendientes para hoy
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#D97706]/20 text-[#D97706] font-semibold">
                {urgentCollections.length} {urgentCollections.length === 1 ? 'cobro' : 'cobros'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] truncate">
              {overdueCount > 0 ? `${overdueCount} atrasado(s)` : ''}
              {overdueCount > 0 && todayCount > 0 ? ' · ' : ''}
              {todayCount > 0 ? `${todayCount} para hoy` : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleExpanded}
          aria-label={isExpanded ? 'Colapsar cobros' : 'Expandir cobros'}
          className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded list of cobros */}
      {isExpanded && (
        <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] bg-[var(--bg-app)]/40">
          {urgentCollections.map((item, idx) => {
            const rawPhone = item.project.clientPhone || '';
            const wpText = buildSmartWhatsAppPaymentMessage({
              project: item.project,
              studioSettings,
              incomes,
            });
            const wpUrl = rawPhone ? formatWhatsAppUrl(rawPhone, wpText) : null;

            return (
              <div 
                key={item.commitment.id || idx}
                className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span 
                      onClick={() => onNavigate && onNavigate(`/clientes/${item.project.id}`)}
                      className="text-xs font-semibold text-[var(--text-primary)] hover:underline cursor-pointer truncate"
                    >
                      {item.project.clientName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 text-xs">
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {privacyMode ? '$ ••••••' : formatCurrencyAmount(item.amount, item.currency)}
                    </span>
                    <span className="text-[var(--text-tertiary)]">·</span>
                    <span className={`text-[11px] font-medium ${item.isOverdue ? 'text-rose-500' : 'text-[#D97706]'}`}>
                      {item.isOverdue ? `Atrasado (${item.commitment.dueDate})` : 'Vence hoy'}
                    </span>
                  </div>
                </div>

                {/* Direct Action Buttons: WhatsApp & Registrar pago */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {wpUrl ? (
                    <a
                      href={wpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => hapticFeedback.light()}
                      className="min-h-[44px] px-3 py-2 rounded-[var(--radius-control)] border border-emerald-600/30 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                      title="Enviar recordatorio y datos de cobro por WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5 stroke-[2]" />
                      <span>WhatsApp</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="min-h-[44px] px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] opacity-60 text-xs flex items-center gap-1.5"
                      title="Sin teléfono de contacto"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Sin tel.</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.medium();
                      onRegisterPayment(item.project);
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-[var(--radius-control)] btn-solid-primary text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                    title="Registrar cobro de este cliente"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2]" />
                    <span>Registrar pago</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
