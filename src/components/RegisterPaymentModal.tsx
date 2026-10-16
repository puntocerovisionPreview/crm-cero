import React, { useState, useEffect } from 'react';
import { ModalPortal } from './ModalPortal';
import { Project, Payment, PaymentMethod, PersonalAccount, IncomeRecord } from '../types';
import { calculateProjectBilling, formatCurrencyAmount } from '../utils/paymentPlans';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { playItemCreated, playItemDeleted } from '../utils/sound';
import { 
  X, 
  DollarSign, 
  Calendar, 
  Wallet, 
  FileText, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  CreditCard,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  incomes?: IncomeRecord[];
  personalAccounts?: PersonalAccount[];
  usdRate?: number;
  initialPayment?: Payment | null; // For editing existing payment
  onSavePayment: (
    payment: Payment, 
    options?: { 
      destinationAccountId?: string;
      followUpCommitment?: { amount: number; dueDate: string; title?: string };
    }
  ) => void;
  onDeletePayment?: (paymentId: string) => void;
}

export const RegisterPaymentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  project,
  incomes = [],
  personalAccounts = [],
  usdRate = 1200,
  initialPayment,
  onSavePayment,
  onDeletePayment,
}) => {
  const billing = calculateProjectBilling(project, incomes);
  const today = getTodayString();

  const isEditing = Boolean(initialPayment);

  // Core Form State
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<'USD' | 'ARS'>('USD');
  const [date, setDate] = useState<string>(today);
  const [method, setMethod] = useState<PaymentMethod>('transferencia');
  const [note, setNote] = useState<string>('');

  // Collapsed "Más opciones" state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');
  const [invoiced, setInvoiced] = useState<boolean>(false);
  const [dolarRef, setDolarRef] = useState<string>('');

  // Follow-up commitment for partial balance
  const [createFollowUpCommitment, setCreateFollowUpCommitment] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(today);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync initial state
  useEffect(() => {
    if (initialPayment) {
      setAmount(String(initialPayment.amount || ''));
      setCurrency(initialPayment.currency || billing.currency);
      setDate(initialPayment.date || today);
      setMethod(initialPayment.method || 'transferencia');
      setNote(initialPayment.note || '');
      setDestinationAccountId(initialPayment.destinationAccountId || '');
      setInvoiced(Boolean(initialPayment.invoiced));
      setDolarRef(initialPayment.dolarRef ? String(initialPayment.dolarRef) : '');
      setShowAdvanced(Boolean(initialPayment.destinationAccountId || initialPayment.invoiced || initialPayment.dolarRef));
    } else {
      // New payment: suggest remaining balance or default
      const defaultAmount = billing.saldoPendiente > 0 
        ? String(billing.saldoPendiente) 
        : (billing.montoAcordado > 0 ? String(billing.montoAcordado) : '');
      setAmount(defaultAmount);
      setCurrency(billing.currency);
      setDate(today);
      setMethod('transferencia');
      setNote('');
      setDestinationAccountId('');
      setInvoiced(false);
      setDolarRef(billing.currency === 'ARS' && usdRate ? String(usdRate) : '');
      setShowAdvanced(false);
      setCreateFollowUpCommitment(false);
    }
  }, [isOpen, initialPayment, project.id]);

  if (!isOpen) return null;

  const numAmount = Number(amount) || 0;
  const saldoRestante = Math.max(0, billing.saldoPendiente - numAmount);
  const isPartial = numAmount > 0 && numAmount < billing.saldoPendiente;

  const handleFillFullBalance = () => {
    hapticFeedback.light();
    if (billing.saldoPendiente > 0) {
      setAmount(String(billing.saldoPendiente));
    } else if (billing.montoAcordado > 0) {
      setAmount(String(billing.montoAcordado));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    hapticFeedback.success();
    playItemCreated();

    const paymentId = initialPayment ? initialPayment.id : `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newPayment: Payment = {
      id: paymentId,
      projectId: project.id,
      amount: Number(amount),
      currency,
      date,
      method,
      note: note.trim() || undefined,
      destinationAccountId: destinationAccountId || undefined,
      invoiced,
      dolarRef: dolarRef ? Number(dolarRef) : undefined,
      incomeRecordId: initialPayment?.incomeRecordId,
      createdAt: initialPayment?.createdAt || new Date().toISOString(),
    };

    onSavePayment(newPayment, {
      destinationAccountId: destinationAccountId || undefined,
      followUpCommitment: (createFollowUpCommitment && saldoRestante > 0) ? {
        amount: saldoRestante,
        dueDate: followUpDate || today,
        title: `Saldo pendiente: ${project.clientName}`,
      } : undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!initialPayment || !onDeletePayment) return;
    if (!confirmDelete) {
      hapticFeedback.light();
      setConfirmDelete(true);
      return;
    }
    hapticFeedback.medium();
    playItemDeleted();
    onDeletePayment(initialPayment.id);
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
        <div 
          className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden t-modal-enter my-auto text-zinc-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
              {project.clientName}
            </span>
            <h3 className="text-base font-bold text-[var(--text-primary)] font-heading">
              {isEditing ? 'Editar Pago Registrado' : 'Registrar Pago Real'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
          {/* Quick Context Bar */}
          <div className="p-2.5 rounded-xl bg-[var(--bg-surface-muted)]/70 border border-[var(--border-subtle)] flex items-center justify-between font-mono text-[11px]">
            <span className="text-[var(--text-secondary)]">Saldo pendiente actual:</span>
            <span className="font-bold text-[var(--text-primary)]">
              {formatCurrencyAmount(billing.saldoPendiente, billing.currency, true)}
            </span>
          </div>

          {/* Monto & Moneda */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[var(--text-primary)]">
                Monto cobrado *
              </label>
              {billing.saldoPendiente > 0 && (
                <button
                  type="button"
                  onClick={handleFillFullBalance}
                  className="text-[10.5px] font-mono text-purple-500 hover:text-purple-400 cursor-pointer font-medium"
                >
                  Autocompletar saldo ({formatCurrencyAmount(billing.saldoPendiente, billing.currency)})
                </button>
              )}
            </div>

            <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden focus-within:border-[var(--border-strong)]">
              <div className="flex items-center px-3 bg-[var(--bg-surface-muted)] border-r border-[var(--border-subtle)]">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'USD' | 'ARS')}
                  className="bg-transparent font-mono font-bold text-xs text-[var(--text-primary)] focus:outline-none cursor-pointer"
                >
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
              <input
                type="number"
                min="0"
                step="any"
                required
                autoFocus
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2.5 bg-transparent font-mono text-base font-bold text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>

          {/* Fecha & Medio de Pago */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--text-primary)] flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[var(--text-secondary)]" />
                <span>Fecha *</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--text-primary)] flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-[var(--text-secondary)]" />
                <span>Medio *</span>
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full px-2.5 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)] capitalize cursor-pointer"
              >
                <option value="transferencia">Transferencia</option>
                <option value="mercadopago">MercadoPago</option>
                <option value="efectivo">Efectivo</option>
                <option value="usdt">USDT / Cripto</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>

          {/* Nota opcional */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
              Nota o concepto (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Anticipo 50%, Seña kick-off, Saldo final"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
            />
          </div>

          {/* Aviso inteligente de pago parcial */}
          {isPartial && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Pago parcial: quedará un saldo de {formatCurrencyAmount(saldoRestante, currency, true)}</span>
              </div>
              <p className="text-[10.5px] opacity-90 leading-tight">
                El sistema ajustará el saldo automáticamente sin bloquear la ficha.
              </p>

              <div className="pt-1 border-t border-amber-500/20 space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={createFollowUpCommitment}
                    onChange={(e) => setCreateFollowUpCommitment(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-amber-500 accent-amber-500 cursor-pointer"
                  />
                  <span>Crear compromiso por el saldo ({formatCurrencyAmount(saldoRestante, currency, true)})</span>
                </label>

                {createFollowUpCommitment && (
                  <div className="flex items-center gap-2 pl-5 pt-0.5">
                    <span className="text-[10.5px] text-[var(--text-secondary)]">Fecha estimada:</span>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Desplegable "Más opciones" */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(prev => !prev)}
              className="w-full py-1.5 px-2 rounded-lg bg-[var(--bg-surface-muted)]/50 hover:bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] flex items-center justify-between text-[11px] font-medium text-[var(--text-secondary)] transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Wallet className="w-3 h-3" />
                <span>Más opciones (Acreditar en Mis Finanzas, Facturación, Dólar)</span>
              </span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] mt-2 space-y-3 animate-in fade-in duration-150">
                {/* Acreditar en Mis Finanzas */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[var(--text-primary)] flex items-center justify-between">
                    <span>Acreditar en cuenta de Mis Finanzas</span>
                    <span className="text-[10px] font-mono text-[var(--text-tertiary)]">Actualiza saldo</span>
                  </label>
                  <select
                    value={destinationAccountId}
                    onChange={(e) => setDestinationAccountId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">No acreditar en personal (solo registrar en estudio)</option>
                    {personalAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Facturación */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-[11px] font-semibold text-[var(--text-primary)]">
                      Facturado con comprobante / Factura C
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)]">
                      Marcá si ya emitiste la factura o recibo oficial
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={invoiced}
                    onChange={(e) => setInvoiced(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-0 cursor-pointer accent-purple-600"
                  />
                </div>

                {/* Referencia Dólar del Día (si es ARS) */}
                {currency === 'ARS' && (
                  <div className="space-y-1 pt-1 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--text-secondary)]">Referencia cotización dólar del día:</span>
                      <span className="font-mono text-[10px] text-[var(--text-tertiary)]">Opcional</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Ej. 1250"
                        value={dolarRef}
                        onChange={(e) => setDolarRef(e.target.value)}
                        className="w-32 px-2.5 py-1 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)] focus:outline-none"
                      />
                      {numAmount > 0 && Number(dolarRef) > 0 && (
                        <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                          ≈ US$ {Math.round(numAmount / Number(dolarRef)).toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] gap-2">
            {isEditing && onDeletePayment ? (
              <button
                type="button"
                onClick={handleDelete}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 ${
                  confirmDelete 
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/30 animate-pulse' 
                    : 'text-red-500 hover:bg-red-500/10'
                }`}
                title={confirmDelete ? 'Hacé clic de nuevo para confirmar eliminación' : 'Eliminar pago'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmDelete ? '¿Confirmar eliminar?' : 'Eliminar pago'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] font-medium text-xs transition cursor-pointer"
              >
                Cancelar
              </button>
            )}

            <button
              type="submit"
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl btn-solid-primary font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Guardar Cambios' : 'Confirmar Pago'}</span>
            </button>
          </div>
        </form>
        </div>
      </div>
    </ModalPortal>
  );
};
