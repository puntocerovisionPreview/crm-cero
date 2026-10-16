import React, { useState } from 'react';
import { Project, Payment, PaymentMethod, PersonalAccount, IncomeRecord } from '../types';
import { calculateProjectBilling, formatCurrencyAmount } from '../utils/paymentPlans';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { 
  ArrowLeft, 
  DollarSign, 
  Calendar, 
  Wallet, 
  FileText, 
  Check, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

interface Props {
  project: Project;
  incomes?: IncomeRecord[];
  personalAccounts?: PersonalAccount[];
  usdRate?: number;
  privacyMode?: boolean;
  prefillCuotaId?: string;
  prefillAmount?: number;
  prefillTitle?: string;
  fromPath?: string;
  onSavePayment: (
    projectId: string,
    payment: Payment,
    options?: {
      destinationAccountId?: string;
      followUpCommitment?: { amount: number; dueDate: string; title?: string };
      cuotaId?: string;
    }
  ) => void;
  onBack: () => void;
}

export const NewPaymentView: React.FC<Props> = ({
  project,
  incomes = [],
  personalAccounts = [],
  usdRate = 1250,
  privacyMode = false,
  prefillCuotaId,
  prefillAmount,
  prefillTitle,
  fromPath = '/hoy',
  onSavePayment,
  onBack,
}) => {
  const billing = calculateProjectBilling(project, incomes);
  const today = getTodayString();

  const initialAmount = prefillAmount !== undefined && prefillAmount > 0 
    ? String(prefillAmount) 
    : (billing.saldoPendiente > 0 ? String(billing.saldoPendiente) : '');

  const [amount, setAmount] = useState<string>(initialAmount);
  const [currency, setCurrency] = useState<'USD' | 'ARS'>(billing.currency);
  const [date, setDate] = useState<string>(today);
  const [method, setMethod] = useState<PaymentMethod>('transferencia');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');
  const [invoiced, setInvoiced] = useState<boolean>(false);
  const [note, setNote] = useState<string>(prefillTitle || '');

  const [showFollowUp, setShowFollowUp] = useState<boolean>(false);
  const [followUpAmount, setFollowUpAmount] = useState<string>('');
  const [followUpDate, setFollowUpDate] = useState<string>('');
  const [followUpTitle, setFollowUpTitle] = useState<string>('');

  const parsedAmount = parseFloat(amount) || 0;
  const remainingAfter = Math.max(0, billing.saldoPendiente - parsedAmount);

  const handleFillFullBalance = () => {
    hapticFeedback.light();
    if (billing.saldoPendiente > 0) {
      setAmount(String(billing.saldoPendiente));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      alert('Por favor ingresá un monto mayor a 0');
      return;
    }

    hapticFeedback.success();

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newPayment: Payment = {
      id: paymentId,
      projectId: project.id,
      amount: parsedAmount,
      currency,
      date,
      method,
      note: note.trim() || undefined,
      destinationAccountId: destinationAccountId || undefined,
      invoiced,
      facturado: invoiced,
      createdAt: new Date().toISOString(),
    };

    const options: any = {
      destinationAccountId: destinationAccountId || undefined,
      cuotaId: prefillCuotaId,
    };

    if (showFollowUp && parseFloat(followUpAmount) > 0 && followUpDate) {
      options.followUpCommitment = {
        amount: parseFloat(followUpAmount),
        dueDate: followUpDate,
        title: followUpTitle.trim() || 'Próxima cuota acordada',
      };
    }

    onSavePayment(project.id, newPayment, options);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-[var(--bg-app)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] px-4 py-3 flex items-center justify-between safe-area-top-header">
        <button
          type="button"
          onClick={() => {
            hapticFeedback.light();
            onBack();
          }}
          className="min-h-[44px] sm:min-h-[36px] px-3 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver</span>
        </button>

        <h1 className="text-sm font-semibold text-[var(--text-primary)] font-heading truncate max-w-[200px] sm:max-w-md">
          Registrar cobro · {project.clientName}
        </h1>

        <div className="w-16" />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-xl mx-auto w-full pb-16">
        {/* Billing Overview Card */}
        <div className="card-swiss p-4 mb-5 space-y-2 bg-[var(--bg-surface-muted)]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)]">Cliente:</span>
            <span className="font-semibold text-[var(--text-primary)]">{project.clientName}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)]">Monto total acordado:</span>
            <span className="font-mono font-semibold text-[var(--text-primary)]">
              {privacyMode ? '$ ••••••' : formatCurrencyAmount(billing.montoAcordado, billing.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)]">Total ya cobrado:</span>
            <span className="font-mono text-emerald-500 font-semibold">
              {privacyMode ? '$ ••••••' : formatCurrencyAmount(billing.totalCobrado, billing.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--border-subtle)]">
            <span className="font-semibold text-[var(--text-primary)]">Saldo pendiente actual:</span>
            <span className="font-mono font-bold text-[var(--accent)]">
              {privacyMode ? '$ ••••••' : formatCurrencyAmount(billing.saldoPendiente, billing.currency)}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Monto y Moneda con Botón Saldo Completo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                Monto del cobro *
              </label>
              {billing.saldoPendiente > 0 && (
                <button
                  type="button"
                  onClick={handleFillFullBalance}
                  className="text-[11px] font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                >
                  Saldo completo ({privacyMode ? '$ ••••••' : formatCurrencyAmount(billing.saldoPendiente, billing.currency)})
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--text-tertiary)]">
                  {currency === 'USD' ? 'u$s' : '$'}
                </span>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm font-mono font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] transition"
                  autoFocus
                />
              </div>

              <div className="flex rounded-[var(--radius-control)] border border-[var(--border-subtle)] p-0.5 bg-[var(--bg-surface)]">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-3 py-1.5 rounded-[var(--radius-control)] text-xs font-mono font-semibold transition ${
                    currency === 'USD' ? 'btn-solid-primary' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  USD
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('ARS')}
                  className={`px-3 py-1.5 rounded-[var(--radius-control)] text-xs font-mono font-semibold transition ${
                    currency === 'ARS' ? 'btn-solid-primary' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  ARS
                </button>
              </div>
            </div>

            {parsedAmount > 0 && (
              <p className="text-[11px] text-[var(--text-secondary)]">
                Saldo restante proyectado:{' '}
                <strong className="font-mono text-[var(--text-primary)]">
                  {formatCurrencyAmount(remainingAfter, currency)}
                </strong>
              </p>
            )}
          </div>

          {/* Fecha y Medio de Pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                Fecha del pago
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                Medio de pago
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] transition"
              >
                <option value="transferencia">Transferencia bancaria</option>
                <option value="efectivo">Efectivo</option>
                <option value="crypto">Cripto (USDT / USDC)</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>

          {/* Acreditar en cuenta de Mis Finanzas */}
          {personalAccounts.length > 0 && (
            <div className="space-y-1 pt-1">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>¿En qué cuenta ingresó el dinero? (Mis Finanzas)</span>
              </label>
              <select
                value={destinationAccountId}
                onChange={(e) => setDestinationAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] transition"
              >
                <option value="">No vincular con cuenta personal</option>
                {personalAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Facturado / Comprobante emitido */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="payment-invoiced-check"
              checked={invoiced}
              onChange={(e) => setInvoiced(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border-subtle)] text-[#16A34A] focus:ring-0 cursor-pointer"
            />
            <label htmlFor="payment-invoiced-check" className="text-xs text-[var(--text-primary)] cursor-pointer select-none">
              Facturado (comprobante o factura emitida)
            </label>
          </div>

          {/* Nota / Detalle */}
          <div className="space-y-1 pt-1">
            <label className="text-xs font-semibold text-[var(--text-primary)]">
              Nota o concepto (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Anticipo 50%, Cuota 2, etc."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onBack}
              className="min-h-[44px] px-4 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-xs font-semibold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-[var(--radius-control)] btn-solid-primary text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Guardar cobro</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
