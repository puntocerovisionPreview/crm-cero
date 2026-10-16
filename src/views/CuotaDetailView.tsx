import React, { useState } from 'react';
import { 
  Project, 
  IncomeRecord, 
  BillingInstallment, 
  PersonalAccount, 
  StudioPaymentSettings, 
  Payment,
  PaymentMethod
} from '../types';
import { 
  resolveProjectAgreement, 
  formatCurrencyAmount, 
  getCuotaStatusBadge, 
  buildSmartWhatsAppPaymentMessage,
  diffDays
} from '../utils/paymentPlans';
import { formatWhatsAppUrl } from '../utils/contact';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { 
  ArrowLeft, 
  Check, 
  Clock, 
  AlertCircle, 
  PieChart, 
  Circle, 
  MessageCircle, 
  Plus, 
  DollarSign, 
  Calendar, 
  CreditCard, 
  Trash2, 
  Edit3, 
  CheckCircle2,
  Building2,
  Wallet
} from 'lucide-react';
import { DEFAULT_USD_RATE } from '../utils/currency';

interface Props {
  project: Project;
  cuotaId: string;
  incomes?: IncomeRecord[];
  personalAccounts?: PersonalAccount[];
  studioSettings?: StudioPaymentSettings;
  privacyMode?: boolean;
  usdRate?: number;
  onBack: () => void;
  onOpenRegisterPayment: (cuota: BillingInstallment) => void;
  onUpdateCuota: (updatedCuota: BillingInstallment) => void;
  onDeletePayment: (paymentId: string) => void;
}

export const CuotaDetailView: React.FC<Props> = ({
  project,
  cuotaId,
  incomes = [],
  personalAccounts = [],
  studioSettings,
  privacyMode = false,
  usdRate = DEFAULT_USD_RATE,
  onBack,
  onOpenRegisterPayment,
  onUpdateCuota,
  onDeletePayment,
}) => {
  const today = getTodayString();
  const agreement = resolveProjectAgreement(project, incomes);
  const cuota = agreement.installments.find(i => i.id === cuotaId) || agreement.installments[0];

  // Inline edit state for this individual cuota
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(cuota?.title || '');
  const [editAmount, setEditAmount] = useState(cuota ? String(cuota.expectedAmount) : '');
  const [editDueDate, setEditDueDate] = useState(cuota?.dueDate || today);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  if (!cuota) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-4 text-center">
        <p className="text-xs text-[var(--text-tertiary)]">Cuota no encontrada.</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl btn-secondary text-xs font-semibold"
        >
          Volver a la ficha
        </button>
      </div>
    );
  }

  const badge = getCuotaStatusBadge(cuota.status, cuota.delayDays);
  const pendingAmount = Math.max(0, cuota.expectedAmount - cuota.actualPaidAmount);
  const isFullyPaid = cuota.status === 'pagado_a_tiempo' || cuota.status === 'pagado_tarde';

  // Matched real payments from project
  const realPayments = (project.payments || []).filter(p => 
    p.id === cuota.paymentId || 
    (p.note && p.note.toLowerCase().includes(cuota.title.toLowerCase())) ||
    (cuota.incomeRecordId && p.incomeRecordId === cuota.incomeRecordId)
  );

  // WhatsApp reminder message
  const rawPhone = project.clientPhone || '';
  const wpText = buildSmartWhatsAppPaymentMessage({
    project,
    studioSettings,
    commitment: {
      id: cuota.id,
      title: cuota.title,
      amount: pendingAmount > 0 ? pendingAmount : cuota.expectedAmount,
      dueDate: cuota.dueDate,
      currency: cuota.currency,
      status: 'pendiente',
    },
    customAmount: pendingAmount > 0 ? pendingAmount : cuota.expectedAmount,
  });
  const wpUrl = rawPhone ? formatWhatsAppUrl(rawPhone, wpText) : null;

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(editAmount) || cuota.expectedAmount;
    const updated: BillingInstallment = {
      ...cuota,
      title: editTitle.trim() || cuota.title,
      expectedAmount: parsedAmt,
      dueDate: editDueDate,
    };
    onUpdateCuota(updated);
    setIsEditing(false);
    hapticFeedback.success();
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Top Bar with Dedicated Back */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <button
          type="button"
          onClick={() => {
            hapticFeedback.light();
            onBack();
          }}
          className="min-h-[44px] sm:min-h-[36px] px-3 py-1.5 rounded-[var(--radius-control)] btn-secondary text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2]" />
          <span>Volver a {project.clientName}</span>
        </button>

        <span className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider">
          Detalle de Cuota
        </span>
      </div>

      {/* Main Cuota Card */}
      <div className="card-swiss p-4 sm:p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4 shadow-sm">
        {/* Title and Status Badge */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <span className="text-[11px] font-mono uppercase text-[var(--text-tertiary)] tracking-wider block">
              {project.clientName} · {project.rubro || 'Cliente'}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-heading mt-0.5">
              {cuota.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${badge.badgeClass}`}>
              {cuota.status === 'pagado_a_tiempo' && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
              {cuota.status === 'pagado_tarde' && <Clock className="w-3.5 h-3.5 stroke-[2.5]" />}
              {(cuota.status === 'vencido' || cuota.status === 'vence_hoy') && <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />}
              {cuota.status === 'parcial' && <PieChart className="w-3.5 h-3.5 stroke-[2.5]" />}
              {(cuota.status === 'pendiente' || cuota.status === 'futuro') && <Circle className="w-3.5 h-3.5 stroke-[2]" />}
              <span>{badge.label}</span>
            </span>
          </div>
        </div>

        {/* Amounts Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
            <span className="text-[10.5px] uppercase font-mono text-[var(--text-tertiary)] block">
              Monto esperado
            </span>
            <span className="text-base sm:text-lg font-mono font-bold text-[var(--text-primary)] mt-0.5 block">
              {privacyMode ? '$ ••••••' : formatCurrencyAmount(cuota.expectedAmount, cuota.currency, true)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
            <span className="text-[10.5px] uppercase font-mono text-[var(--text-tertiary)] block">
              Cobrado real
            </span>
            <span className="text-base sm:text-lg font-mono font-bold text-emerald-400 mt-0.5 block">
              {privacyMode ? '$ ••••••' : formatCurrencyAmount(cuota.actualPaidAmount, cuota.currency, true)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] col-span-2 sm:col-span-1">
            <span className="text-[10.5px] uppercase font-mono text-[var(--text-tertiary)] block">
              Saldo pendiente
            </span>
            <span className={`text-base sm:text-lg font-mono font-bold mt-0.5 block ${
              pendingAmount > 0 ? (cuota.status === 'vencido' ? 'text-rose-400' : 'text-amber-400') : 'text-zinc-500'
            }`}>
              {privacyMode ? '$ ••••••' : formatCurrencyAmount(pendingAmount, cuota.currency, true)}
            </span>
          </div>
        </div>

        {/* Dates and Details list */}
        <div className="divide-y divide-[var(--border-subtle)] text-xs pt-1">
          <div className="py-2.5 flex items-center justify-between">
            <span className="text-[var(--text-secondary)]">Fecha de vencimiento:</span>
            <span className={`font-mono font-semibold ${
              cuota.status === 'vencido' ? 'text-rose-400 font-bold' : 
              cuota.status === 'vence_hoy' ? 'text-amber-400 font-bold' : 'text-[var(--text-primary)]'
            }`}>
              {cuota.dueDate || 'Sin definir'}
              {cuota.status === 'vencido' && cuota.delayDays ? ` (Atrasado ${cuota.delayDays} días)` : ''}
              {cuota.status === 'vence_hoy' ? ' (¡VENCE HOY!)' : ''}
            </span>
          </div>

          {cuota.paidAt && (
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Fecha real de cobro:</span>
              <span className="font-mono font-semibold text-emerald-400">
                {cuota.paidAt}
                {cuota.status === 'pagado_tarde' && cuota.delayDays ? ` (+${cuota.delayDays} días de atraso)` : ' (A tiempo)'}
              </span>
            </div>
          )}

          {cuota.paymentMethod && (
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Medio de pago:</span>
              <span className="font-mono uppercase text-[var(--text-primary)]">
                {cuota.paymentMethod}
              </span>
            </div>
          )}

          {cuota.destinationAccountId && (
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Cuenta acreditada:</span>
              <span className="text-[var(--text-primary)] font-medium">
                {personalAccounts.find(a => a.id === cuota.destinationAccountId)?.name || 'Cuenta vinculada'}
              </span>
            </div>
          )}

          {cuota.note && (
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Nota:</span>
              <span className="text-[var(--text-primary)] italic">{cuota.note}</span>
            </div>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              hapticFeedback.medium();
              onOpenRegisterPayment(cuota);
            }}
            className="w-full sm:flex-1 min-h-[44px] px-4 py-2.5 rounded-[var(--radius-control)] btn-solid-primary text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{isFullyPaid ? 'Registrar pago adicional' : 'Registrar pago de esta cuota'}</span>
          </button>

          {wpUrl && (
            <a
              href={wpUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => hapticFeedback.light()}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-[var(--radius-control)] border border-emerald-600/30 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 stroke-[2]" />
              <span>Cobrar por WhatsApp</span>
            </a>
          )}

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="w-full sm:w-auto min-h-[44px] px-3.5 py-2.5 rounded-[var(--radius-control)] btn-secondary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-4 h-4" />
            <span>{isEditing ? 'Cancelar edición' : 'Editar cuota'}</span>
          </button>
        </div>
      </div>

      {/* Inline Form to Edit this Individual Cuota */}
      {isEditing && (
        <form onSubmit={handleSaveEdit} className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3.5">
          <h4 className="text-xs font-bold text-[var(--text-primary)] font-heading">
            Editar datos de {cuota.title}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-mono text-[var(--text-tertiary)] block mb-1">
                Título o Concepto
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-medium"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-[var(--text-tertiary)] block mb-1">
                Monto esperado ({cuota.currency})
              </label>
              <input
                type="number"
                value={editAmount}
                onChange={e => setEditAmount(e.target.value)}
                min="0"
                step="any"
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-[var(--text-tertiary)] block mb-1">
                Fecha de vencimiento
              </label>
              <input
                type="date"
                value={editDueDate}
                onChange={e => setEditDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded-xl btn-secondary text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl btn-solid-primary text-xs font-bold"
            >
              Guardar cambios
            </button>
          </div>
        </form>
      )}

      {/* Historial de Pagos Efectivos Vinculados */}
      <div className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-[var(--text-primary)] font-heading">
              Historial de cobros de esta cuota ({realPayments.length})
            </h4>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400">
            Total: {privacyMode ? '$ ••••••' : formatCurrencyAmount(cuota.actualPaidAmount, cuota.currency, true)}
          </span>
        </div>

        {realPayments.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)] py-3 text-center italic">
            Todavía no hay cobros asentados para esta cuota. Tocá "Registrar pago" para asentar la transferencia o cobro real.
          </p>
        ) : (
          <div className="space-y-2">
            {realPayments.map(p => (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                      {privacyMode ? '$ ••••••' : formatCurrencyAmount(p.amount, p.currency, true)}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] uppercase">
                      {p.method}
                    </span>
                    {p.facturado && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/30">
                        Facturado
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-tertiary)] font-mono mt-0.5">
                    {p.date} {p.note ? `· ${p.note}` : ''}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (deletingPaymentId === p.id) {
                      hapticFeedback.medium();
                      onDeletePayment(p.id);
                      setDeletingPaymentId(null);
                    } else {
                      hapticFeedback.light();
                      setDeletingPaymentId(p.id);
                      setTimeout(() => {
                        setDeletingPaymentId(prev => (prev === p.id ? null : prev));
                      }, 4000);
                    }
                  }}
                  className={`p-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    deletingPaymentId === p.id
                      ? 'bg-rose-600 text-white font-bold text-[10px] animate-pulse shadow-md shadow-rose-600/25'
                      : 'text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10'
                  }`}
                  title={deletingPaymentId === p.id ? 'Hacé clic de nuevo para confirmar eliminación' : 'Eliminar este pago'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deletingPaymentId === p.id && <span>¿Borrar?</span>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
