import React from 'react';
import { Project, ProjectInstallment } from '../types';
import { formatCurrency } from '../utils/pricingCatalog';
import { getPaymentUrgency, buildInstallmentWhatsAppMessage } from '../utils/paymentPlans';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { 
  DollarSign, 
  MessageCircle, 
  CheckCircle2, 
  ArrowRight, 
  Trash2 
} from 'lucide-react';

interface Props {
  projects: Project[];
  onMarkPaid: (projectId: string, installmentId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  privacyMode?: boolean;
  onViewAll?: () => void;
}

interface PendingCollectionItem {
  project: Project;
  installment: ProjectInstallment;
  urgency: ReturnType<typeof getPaymentUrgency>;
}

export const TodayCollectionsBanner: React.FC<Props> = ({
  projects,
  onMarkPaid,
  onDeleteProject,
  privacyMode = false,
  onViewAll,
}) => {
  const today = getTodayString();
  const [processingIds, setProcessingIds] = React.useState<Set<string>>(new Set());

  // Find all unpaid installments due today or overdue
  const pendingItems: PendingCollectionItem[] = [];

  projects.forEach(p => {
    if (!p.installments || p.installments.length === 0) return;
    p.installments.forEach(inst => {
      if (!inst.paid && inst.dueDate <= today) {
        pendingItems.push({
          project: p,
          installment: inst,
          urgency: getPaymentUrgency(inst.dueDate, inst.paid),
        });
      }
    });
  });

  if (pendingItems.length === 0) return null;

  // Sort: overdue first, then by amount descending
  pendingItems.sort((a, b) => {
    if (a.installment.dueDate !== b.installment.dueDate) {
      return a.installment.dueDate.localeCompare(b.installment.dueDate);
    }
    return (b.installment.amount || 0) - (a.installment.amount || 0);
  });

  const handleSendWhatsApp = (item: PendingCollectionItem) => {
    hapticFeedback.medium();
    const { project, installment } = item;
    const msg = buildInstallmentWhatsAppMessage({
      clientName: project.clientName,
      projectTitle: project.projectType?.startsWith('paf') ? 'Programa Método PAF' : 'Proyecto Web',
      installmentNumber: installment.number,
      totalInstallments: project.installments?.length || 1,
      amount: installment.amount,
      currency: (installment.currency as 'USD' | 'ARS') || 'ARS',
      dueDate: installment.dueDate,
      isOverdue: item.urgency.status === 'overdue',
    });

    const phoneDigits = project.clientPhone ? project.clientPhone.replace(/\D/g, '') : '';
    if (phoneDigits) {
      window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      navigator.clipboard.writeText(msg);
      alert('¡Mensaje de recordatorio copiado al portapapeles! Pegalo en WhatsApp.');
    }
  };

  const handleQuickPay = (item: PendingCollectionItem) => {
    const instId = item.installment.id || `inst_${item.installment.number || 1}`;
    const key = `${item.project.id}_${instId}`;
    setProcessingIds(prev => new Set(prev).add(key));
    hapticFeedback.success();
    playTaskDone();
    onMarkPaid(item.project.id, instId);
  };

  const handleDeleteDuplicate = (item: PendingCollectionItem) => {
    hapticFeedback.medium();
    onDeleteProject?.(item.project.id);
  };

  return (
    <div className="card-swiss p-4 sm:p-5 mb-4 relative overflow-hidden transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset]">
      {/* Widget Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[#16A34A]">
            <DollarSign className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
                Cobros de Hoy
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                {pendingItems.length} {pendingItems.length === 1 ? 'pendiente' : 'pendientes'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Cuotas con vencimiento hoy o pendientes de regularización
            </p>
          </div>
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {pendingItems.map(({ project, installment, urgency }, idx) => {
          const isOverdue = urgency.status === 'overdue';
          const isToday = installment.dueDate === today;
          const cur = (installment.currency as 'USD' | 'ARS') || 'ARS';
          const itemKey = `${project.id}_${installment.id || 'inst'}_${installment.number || idx}_${idx}`;
          const isProcessing = processingIds.has(`${project.id}_${installment.id}`);

          return (
            <div
              key={itemKey}
              className={`p-3 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)] hover:border-[var(--text-tertiary)] transition space-y-2 ${
                isProcessing ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isOverdue ? 'bg-[#DC2626]' : 'bg-[#D97706]'
                    }`}
                  />
                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate" title={project.clientName}>
                    {project.clientName}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] font-mono shrink-0">
                    C.{installment.number}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                    {privacyMode ? '$ ••••••' : formatCurrency(installment.amount, cur)}
                  </span>
                  {onDeleteProject && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDuplicate({ project, installment, urgency })}
                      className="p-1 rounded text-[var(--text-tertiary)] hover:text-[#DC2626] transition cursor-pointer"
                      title="Descartar cobro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status and Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border-divider)] text-[11px]">
                <span className={isOverdue ? 'text-[#DC2626] font-medium' : isToday ? 'text-[#D97706] font-medium' : 'text-[var(--text-secondary)]'}>
                  {isToday ? 'Vence hoy' : urgency.label}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSendWhatsApp({ project, installment, urgency })}
                    className="px-2 py-1 rounded-[var(--radius-control)] text-xs font-medium border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] flex items-center gap-1 transition cursor-pointer active:scale-95"
                  >
                    <MessageCircle className="w-3 h-3 text-[#16A34A]" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleQuickPay({ project, installment, urgency })}
                    className="btn-solid-primary px-2.5 py-1 text-xs font-medium flex items-center gap-1 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3 h-3 text-[#16A34A]" />
                    <span>{isProcessing ? '...' : 'Cobrado'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Link "Ver todo →" */}
      {onViewAll && (
        <div className="pt-2 text-right">
          <button
            onClick={onViewAll}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium inline-flex items-center gap-1 transition"
          >
            <span>Ver finanzas</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
