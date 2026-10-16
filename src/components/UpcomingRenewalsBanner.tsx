import React, { useState } from 'react';
import { 
  Globe, 
  Server, 
  AlertTriangle, 
  Bell, 
  BellRing, 
  ExternalLink, 
  Check, 
  ChevronRight, 
  X,
  MessageCircle
} from 'lucide-react';
import { StudioFixedExpense, Project } from '../types';
import { 
  getDaysUntilDue, 
  getNotificationPermissionState, 
  requestNotificationPermission, 
  getWhatsAppRenewalUrl,
  triggerRenewalBrowserNotification 
} from '../utils/renewalNotifications';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  expenses: StudioFixedExpense[];
  projects?: Project[];
  onOpenRenewModal?: (item: StudioFixedExpense) => void;
  onNavigate?: (path: string) => void;
}

export const UpcomingRenewalsBanner: React.FC<Props> = ({
  expenses,
  projects = [],
  onOpenRenewModal,
  onNavigate,
}) => {
  const [permission, setPermission] = useState(getNotificationPermissionState());
  const [dismissed, setDismissed] = useState(false);
  const [testSent, setTestSent] = useState(false);

  // Filter domain and hosting expenses with deadline <= 15 days
  const urgentRenewals = expenses
    .filter(e => {
      if (!e.active) return false;
      if (e.category !== 'dominios' && e.category !== 'hosting') return false;
      const days = getDaysUntilDue(e.nextDueDate);
      return days <= 15;
    })
    .sort((a, b) => getDaysUntilDue(a.nextDueDate) - getDaysUntilDue(b.nextDueDate));

  if (dismissed || urgentRenewals.length === 0) {
    return null;
  }

  const handleEnablePush = async () => {
    hapticFeedback.medium();
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
    if (granted && urgentRenewals.length > 0) {
      triggerRenewalBrowserNotification(urgentRenewals[0], getDaysUntilDue(urgentRenewals[0].nextDueDate));
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    }
  };

  const overdueCount = urgentRenewals.filter(e => getDaysUntilDue(e.nextDueDate) < 0).length;
  const criticalCount = urgentRenewals.filter(e => {
    const d = getDaysUntilDue(e.nextDueDate);
    return d >= 0 && d <= 3;
  }).length;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 sm:p-4 text-xs space-y-3 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
            {overdueCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
            ) : (
              <BellRing className="w-4 h-4 text-amber-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[var(--text-primary)] font-heading">
                {overdueCount > 0 
                  ? `¡Atención! ${overdueCount} vencimiento${overdueCount > 1 ? 's' : ''} pendiente${overdueCount > 1 ? 's' : ''}`
                  : `Alertas de Vencimiento: ${urgentRenewals.length} servicio${urgentRenewals.length > 1 ? 's' : ''} en próximos 15 días`}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                {urgentRenewals.length}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Dominios y hosting que requieren pago o aviso al cliente para no caerse.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {permission !== 'granted' && permission !== 'unsupported' && (
            <button
              type="button"
              onClick={handleEnablePush}
              className="px-2.5 py-1 rounded-xl bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] hover:opacity-90 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-xs"
              title="Activar alertas nativas del navegador"
            >
              <Bell className="w-3 h-3" />
              <span>Activar alertas PWA</span>
            </button>
          )}

          {permission === 'granted' && (
            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" />
              <span>Alertas activas</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-black/10 dark:hover:bg-white/10 transition cursor-pointer"
            title="Cerrar aviso temporalmente"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {testSent && (
        <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          <span>¡Notificación de prueba enviada exitosamente a tu dispositivo!</span>
        </div>
      )}

      {/* Grid of urgent renewals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
        {urgentRenewals.slice(0, 3).map((item) => {
          const days = getDaysUntilDue(item.nextDueDate);
          const isOverdue = days < 0;
          const isCritical = days >= 0 && days <= 3;
          const isDomain = item.category === 'dominios';

          const linkedProject = projects.find(p => p.id === item.projectId || p.clientName.toLowerCase() === (item.clientName || '').toLowerCase());
          const clientPhone = linkedProject?.clientPhone;
          const waUrl = getWhatsAppRenewalUrl(item, clientPhone);

          return (
            <div 
              key={item.id}
              className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2 shadow-xs"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    isDomain ? 'bg-emerald-500/15 text-emerald-500' : 'bg-sky-500/15 text-sky-500'
                  }`}>
                    {isDomain ? <Globe className="w-3.5 h-3.5" /> : <Server className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-[var(--text-primary)] truncate block">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] truncate block">
                      {item.clientName || item.provider || 'Estudio Propio'}
                    </span>
                  </div>
                </div>

                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                  isOverdue 
                    ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' 
                    : isCritical 
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' 
                    : 'bg-zinc-500/15 text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                }`}>
                  {isOverdue 
                    ? `Venció hace ${Math.abs(days)}d` 
                    : days === 0 
                    ? 'Vence HOY' 
                    : days === 1 
                    ? 'Mañana' 
                    : `${days} días`}
                </span>
              </div>

              {/* Amount & Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]">
                <span className="font-mono font-bold text-xs text-[var(--text-primary)]">
                  {item.currency === 'USD' ? 'u$s ' : '$'}{item.amount.toLocaleString('es-AR')}
                </span>

                <div className="flex items-center gap-1.5">
                  {/* WhatsApp Aviso al Cliente */}
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => hapticFeedback.light()}
                    className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[10.5px] font-semibold flex items-center gap-1 transition"
                    title="Enviar aviso de renovación al cliente por WhatsApp"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>Avisar WA</span>
                  </a>

                  {onOpenRenewModal && (
                    <button
                      type="button"
                      onClick={() => onOpenRenewModal(item)}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-surface-muted)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] text-[10.5px] font-semibold transition cursor-pointer"
                    >
                      Renovar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {urgentRenewals.length > 3 && onNavigate && (
        <div className="text-right pt-0.5">
          <button
            type="button"
            onClick={() => onNavigate('/gastos-fijos')}
            className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Ver los {urgentRenewals.length} vencimientos en Gastos Fijos</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
