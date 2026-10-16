import React, { useState } from 'react';
import { 
  Project, 
  PersonalAccount, 
  MercadoPagoIncomingPayment, 
  IncomeCategory, 
  DEFAULT_INCOME_CATEGORIES,
  PaymentMethod 
} from '../types';
import { formatCurrency } from '../utils/pricingCatalog';
import { hapticFeedback } from '../utils/haptics';
import { playItemCreated, playTaskDone } from '../utils/sound';
import { 
  CheckCircle2, 
  X, 
  FolderKanban, 
  Wallet, 
  Building2, 
  DollarSign, 
  ArrowRight, 
  User, 
  Mail, 
  Clock, 
  FileText, 
  AlertCircle 
} from 'lucide-react';
import { todayLocal } from '../utils/dates';
import { DEFAULT_USD_RATE } from '../utils/currency';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  payment: MercadoPagoIncomingPayment | null;
  projects: Project[];
  personalAccounts: PersonalAccount[];
  usdRate?: number;
  onReconcileAsProjectPayment: (
    projectId: string, 
    paymentData: {
      amount: number;
      currency: 'ARS' | 'USD';
      date: string;
      method: PaymentMethod;
      note?: string;
      destinationAccountId?: string;
      invoiced?: boolean;
    },
    mpPaymentId: string
  ) => void;
  onReconcileAsStudioIncome: (
    incomeData: {
      title: string;
      amount: number;
      currency: 'ARS' | 'USD';
      date: string;
      category: IncomeCategory;
      notes?: string;
    },
    mpPaymentId: string
  ) => void;
  onReconcileAsPersonalTransaction: (
    transactionData: {
      accountId: string;
      amount: number;
      currency: 'ARS' | 'USD';
      date: string;
      note: string;
      category?: string;
    },
    mpPaymentId: string
  ) => void;
  onDismissPayment: (mpPaymentId: string) => void;
}

type ReconcileDestination = 'cliente' | 'estudio_libre' | 'personal';

export const MercadoPagoReconcileModal: React.FC<Props> = ({
  isOpen,
  onClose,
  payment,
  projects,
  personalAccounts,
  usdRate = DEFAULT_USD_RATE,
  onReconcileAsProjectPayment,
  onReconcileAsStudioIncome,
  onReconcileAsPersonalTransaction,
  onDismissPayment,
}) => {
  if (!isOpen || !payment) return null;

  const [destination, setDestination] = useState<ReconcileDestination>('cliente');
  
  // Opción 1: Cliente
  const activeProjects = projects.filter(p => p.status !== 'completado' && p.status !== 'cancelado');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjects[0]?.id || projects[0]?.id || '');
  const [invoiced, setInvoiced] = useState(false);
  const [noteProject, setNoteProject] = useState(payment.description || `Cobro Mercado Pago de ${payment.payerName || 'Cliente'}`);

  // Opción 2: Estudio Libre
  const [studioCategory, setStudioCategory] = useState<IncomeCategory>(DEFAULT_INCOME_CATEGORIES[0] || 'Desarrollo Web');
  const [studioTitle, setStudioTitle] = useState(payment.description || `Ingreso Mercado Pago - ${payment.payerName || 'Servicio'}`);

  // Opción 3: Personal
  const mpPersonalAccount = personalAccounts.find(a => a.name.toLowerCase().includes('mercado') || a.name.toLowerCase().includes('mp'));
  const [personalAccountId, setPersonalAccountId] = useState<string>(mpPersonalAccount?.id || personalAccounts[0]?.id || '');
  const [personalNote, setPersonalNote] = useState(payment.description || `Acreditación Mercado Pago de ${payment.payerName || 'Transferencia'}`);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const projectTotalPaid = (selectedProject?.payments || []).reduce((acc, p) => acc + (p.amount || 0), 0);
  const projectAgreedTotal = Number(selectedProject?.montoAcordado ?? selectedProject?.estimatedPrice ?? 0);
  const projectPendingBalance = Math.max(0, projectAgreedTotal - projectTotalPaid);

  const handleConfirm = () => {
    hapticFeedback.success();
    playItemCreated();

    if (destination === 'cliente' && selectedProjectId) {
      onReconcileAsProjectPayment(
        selectedProjectId,
        {
          amount: payment.amount,
          currency: payment.currency,
          date: payment.dateCreated || todayLocal(),
          method: 'mercadopago',
          note: noteProject,
          destinationAccountId: personalAccountId || undefined,
          invoiced,
        },
        payment.id
      );
    } else if (destination === 'estudio_libre') {
      onReconcileAsStudioIncome(
        {
          title: studioTitle,
          amount: payment.amount,
          currency: payment.currency,
          date: payment.dateCreated || todayLocal(),
          category: studioCategory,
          notes: `Pago MP #${payment.mpPaymentId} por ${payment.payerName || 'Pagador'}`,
        },
        payment.id
      );
    } else if (destination === 'personal' && personalAccountId) {
      onReconcileAsPersonalTransaction(
        {
          accountId: personalAccountId,
          amount: payment.amount,
          currency: payment.currency,
          date: payment.dateCreated || todayLocal(),
          note: personalNote,
        },
        payment.id
      );
    }

    onClose();
  };

  const handleDismiss = () => {
    hapticFeedback.light();
    onDismissPayment(payment.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden t-modal-enter my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-sky-400">
                Mercado Pago · Nuevo Pago Recibido
              </span>
              <h3 className="text-base font-bold text-zinc-100 font-heading">
                Conciliar Pago Entrante
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Payment Summary Banner */}
        <div className="p-4 bg-gradient-to-r from-sky-950/40 via-zinc-900 to-sky-950/20 border-b border-zinc-800/80 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Monto Acreditado</span>
            <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
              {formatCurrency(payment.amount, payment.currency)}
            </div>
          </div>
          <div className="text-right text-xs">
            <div className="font-bold text-zinc-200 flex items-center justify-end gap-1.5">
              <User className="w-3.5 h-3.5 text-zinc-400" />
              <span>{payment.payerName || 'Pagador Mercado Pago'}</span>
            </div>
            {payment.payerEmail && (
              <div className="text-[11px] text-zinc-400 flex items-center justify-end gap-1 mt-0.5 font-mono">
                <Mail className="w-3 h-3 text-zinc-500" />
                <span>{payment.payerEmail}</span>
              </div>
            )}
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              ID Operación: #{payment.mpPaymentId}
            </div>
          </div>
        </div>

        {/* Question & Options */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          <div>
            <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider block mb-2">
              ¿A qué corresponde este ingreso?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Option 1: Cliente */}
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setDestination('cliente');
                }}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer t-press flex flex-col justify-between gap-1.5 ${
                  destination === 'cliente'
                    ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-white shadow-sm'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <FolderKanban className={`w-4 h-4 ${destination === 'cliente' ? 'text-[var(--accent)]' : 'text-zinc-500'}`} />
                <div>
                  <div className="font-bold text-[11px]">Cliente / Proyecto</div>
                  <div className="text-[9.5px] opacity-75 leading-tight">Saldar cuota o acuerdo</div>
                </div>
              </button>

              {/* Option 2: Estudio Libre */}
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setDestination('estudio_libre');
                }}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer t-press flex flex-col justify-between gap-1.5 ${
                  destination === 'estudio_libre'
                    ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-sm'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <DollarSign className={`w-4 h-4 ${destination === 'estudio_libre' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <div>
                  <div className="font-bold text-[11px]">Ingreso Libre</div>
                  <div className="text-[9.5px] opacity-75 leading-tight">Trabajo suelto o extra</div>
                </div>
              </button>

              {/* Option 3: Personal */}
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setDestination('personal');
                }}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer t-press flex flex-col justify-between gap-1.5 ${
                  destination === 'personal'
                    ? 'bg-blue-500/15 border-blue-500 text-white shadow-sm'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Wallet className={`w-4 h-4 ${destination === 'personal' ? 'text-blue-400' : 'text-zinc-500'}`} />
                <div>
                  <div className="font-bold text-[11px]">Mis Finanzas</div>
                  <div className="text-[9.5px] opacity-75 leading-tight">Billetera personal</div>
                </div>
              </button>
            </div>
          </div>

          {/* Configuration for Destination: Cliente */}
          {destination === 'cliente' && (
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Seleccionar Cliente / Proyecto:
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none cursor-pointer"
                >
                  {projects.map(p => {
                    const pPaid = (p.payments || []).reduce((acc, pay) => acc + (pay.amount || 0), 0);
                    const pPrice = Number(p.montoAcordado ?? p.estimatedPrice ?? 0);
                    const pRest = Math.max(0, pPrice - pPaid);
                    const pCurr = (p.estimatedCurrency || (p.billingAgreement?.currency as 'USD' | 'ARS') || 'ARS');
                    return (
                      <option key={p.id} value={p.id}>
                        {p.clientName} ({pCurr}) — {pRest > 0 ? `Resta saldar ${formatCurrency(pRest, pCurr)}` : 'Al día'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedProject && (
                <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-400">Saldo pendiente del cliente:</span>
                  <span className="font-bold text-amber-400">
                    {formatCurrency(projectPendingBalance, (selectedProject.estimatedCurrency || 'ARS') as 'USD' | 'ARS')}
                  </span>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Nota / Detalle del Pago:
                </label>
                <input
                  type="text"
                  value={noteProject}
                  onChange={(e) => setNoteProject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none"
                  placeholder="Ej. Cuota 2/3 - Transferencia Mercado Pago"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-zinc-400">¿Emitir comprobante / Facturado?</span>
                <input
                  type="checkbox"
                  checked={invoiced}
                  onChange={(e) => setInvoiced(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-0 cursor-pointer accent-purple-600"
                />
              </div>
            </div>
          )}

          {/* Configuration for Destination: Estudio Libre */}
          {destination === 'estudio_libre' && (
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Concepto / Título del Ingreso:
                </label>
                <input
                  type="text"
                  value={studioTitle}
                  onChange={(e) => setStudioTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none"
                  placeholder="Ej. Consultoría extra, Setup de campaña"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Categoría de Ingreso:
                </label>
                <select
                  value={studioCategory}
                  onChange={(e) => setStudioCategory(e.target.value as IncomeCategory)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none cursor-pointer"
                >
                  {DEFAULT_INCOME_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Configuration for Destination: Personal */}
          {destination === 'personal' && (
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Cuenta de Destino en Mis Finanzas:
                </label>
                <select
                  value={personalAccountId}
                  onChange={(e) => setPersonalAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none cursor-pointer"
                >
                  {personalAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Nota / Detalle:
                </label>
                <input
                  type="text"
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs focus:outline-none"
                  placeholder="Ej. Transferencia personal de amigo, reintegro"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-3.5 py-2 rounded-xl text-zinc-400 hover:text-red-400 text-xs font-semibold hover:bg-zinc-900 transition cursor-pointer"
          >
            Ignorar este pago
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
            >
              Preguntarme luego
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 cursor-pointer t-press"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar y Conciliar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
