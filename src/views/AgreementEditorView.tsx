import React, { useState } from 'react';
import { 
  Project, 
  IncomeRecord, 
  BillingAgreement, 
  BillingAgreementType, 
  BillingInstallment, 
  PaymentMethod 
} from '../types';
import { 
  resolveProjectAgreement, 
  generateAgreementInstallments, 
  formatCurrencyAmount 
} from '../utils/paymentPlans';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { 
  ArrowLeft, 
  Check, 
  Layers, 
  DollarSign, 
  Calendar, 
  CreditCard, 
  Plus, 
  Trash2, 
  Repeat, 
  Clock, 
  Sparkles,
  HelpCircle,
  Save
} from 'lucide-react';

interface Props {
  project: Project;
  incomes?: IncomeRecord[];
  privacyMode?: boolean;
  onBack: () => void;
  onSaveAgreement: (updatedAgreement: BillingAgreement) => void;
}

export const AgreementEditorView: React.FC<Props> = ({
  project,
  incomes = [],
  privacyMode = false,
  onBack,
  onSaveAgreement,
}) => {
  const currentAgreement = resolveProjectAgreement(project, incomes);

  const [type, setType] = useState<BillingAgreementType>(currentAgreement.type || 'cuotas');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(currentAgreement.currency || 'ARS');
  const [totalAmount, setTotalAmount] = useState<string>(
    currentAgreement.totalAmount ? String(currentAgreement.totalAmount) : ''
  );
  const [installmentsCount, setInstallmentsCount] = useState<number>(
    currentAgreement.installmentsCount || currentAgreement.installments.length || 3
  );
  const [monthlyAmount, setMonthlyAmount] = useState<string>(
    currentAgreement.monthlyAmount ? String(currentAgreement.monthlyAmount) : ''
  );
  const [startDate, setStartDate] = useState<string>(currentAgreement.startDate || getTodayString());
  const [endDate, setEndDate] = useState<string>(currentAgreement.endDate || '');
  const [dueDayRule, setDueDayRule] = useState<string>(
    currentAgreement.dueDayRule ? String(currentAgreement.dueDayRule) : '10'
  );
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<PaymentMethod>(
    currentAgreement.preferredPaymentMethod || 'transferencia'
  );
  const [notes, setNotes] = useState<string>(currentAgreement.notes || '');

  // Editable list of installments
  const [installments, setInstallments] = useState<BillingInstallment[]>(
    currentAgreement.installments || []
  );

  // Regenerate installments based on current settings
  const handleRegenerateFromType = (newType: BillingAgreementType) => {
    setType(newType);
    hapticFeedback.light();

    const parsedTot = parseFloat(totalAmount) || 0;
    const parsedMonthly = parseFloat(monthlyAmount) || (parsedTot > 0 ? Math.round(parsedTot / 3) : 0);
    const parsedDueDay = parseInt(dueDayRule, 10) || undefined;

    const generated = generateAgreementInstallments({
      type: newType,
      totalAmount: parsedTot,
      currency,
      startDate,
      endDate: endDate || undefined,
      installmentsCount,
      monthlyAmount: parsedMonthly,
      dueDayRule: parsedDueDay,
      preferredPaymentMethod,
    });

    setInstallments(generated);
  };

  const handleUpdateInstallmentRow = (index: number, updates: Partial<BillingInstallment>) => {
    setInstallments(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleAddInstallmentRow = () => {
    hapticFeedback.light();
    const nextNumber = installments.length + 1;
    const newRow: BillingInstallment = {
      id: `inst_custom_${Date.now()}_${nextNumber}`,
      number: nextNumber,
      totalInstallments: nextNumber,
      title: type === 'hitos' ? `Hito ${nextNumber}` : `Cuota ${nextNumber}`,
      dueDate: getTodayString(),
      expectedAmount: 0,
      currency,
      actualPaidAmount: 0,
      status: 'pendiente',
    };
    setInstallments(prev => [...prev, newRow]);
  };

  const handleDeleteInstallmentRow = (index: number) => {
    hapticFeedback.light();
    setInstallments(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    hapticFeedback.success();

    const parsedTot = parseFloat(totalAmount) || installments.reduce((sum, i) => sum + (Number(i.expectedAmount) || 0), 0);
    const parsedMonthly = parseFloat(monthlyAmount) || (parsedTot > 0 ? Math.round(parsedTot / 3) : 0);
    const parsedDueDay = parseInt(dueDayRule, 10) || undefined;

    const finalAgreement: BillingAgreement = {
      id: currentAgreement.id || `agr_${project.id}`,
      type,
      title: project.clientName,
      currency,
      totalAmount: parsedTot,
      installmentsCount: installments.length,
      monthlyAmount: parsedMonthly,
      startDate,
      endDate: endDate.trim() || undefined,
      dueDayRule: parsedDueDay,
      preferredPaymentMethod,
      notes: notes.trim() || undefined,
      installments,
    };

    onSaveAgreement(finalAgreement);
  };

  const typesList: { id: BillingAgreementType; label: string; desc: string }[] = [
    { 
      id: 'cuotas', 
      label: 'Programa en cuotas', 
      desc: 'N cuotas mensuales (ej. Método PAF o plan a medida con cuotas fijas/editables)' 
    },
    { 
      id: 'unico', 
      label: 'Pago único', 
      desc: '1 solo pago por el total del servicio o proyecto' 
    },
    { 
      id: 'hitos', 
      label: 'Hitos de entrega', 
      desc: 'Cobros escalonados (ej. 50% anticipo / 25% intermedio / 25% entrega final)' 
    },
    { 
      id: 'retainer', 
      label: 'Abono mensual recurrente', 
      desc: 'Retainer mensual recurrente sin fecha de fin (mantenimiento, fee continuo)' 
    },
    { 
      id: 'por_hora', 
      label: 'Por hora o trabajo suelto', 
      desc: 'Cobro por bolsa de horas, consultoría por sesión o entregas sueltas' 
    },
  ];

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Bar with Back */}
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
          Configurar Acuerdo de Cobro
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Type Selection */}
        <div className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-[var(--text-primary)] font-heading uppercase tracking-wider">
              1. Tipo de acuerdo de cobro
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {typesList.map(t => {
              const isSelected = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleRegenerateFromType(t.id)}
                  className={`p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-xs'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-app)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {t.label}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                    {t.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Terms and Parameters */}
        <div className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-[var(--text-primary)] font-heading uppercase tracking-wider">
              2. Parámetros del acuerdo
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Moneda */}
            <div>
              <label className="text-[11px] font-mono text-[var(--text-tertiary)] block mb-1">
                Moneda
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--bg-app)] rounded-xl border border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setCurrency('ARS')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition ${
                    currency === 'ARS' ? 'bg-emerald-600 text-white shadow-xs' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  ARS ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition ${
                    currency === 'USD' ? 'bg-emerald-600 text-white shadow-xs' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  USD (u$s)
                </button>
              </div>
            </div>

            {/* Monto Total o Mensual */}
            {type === 'retainer' ? (
              <div>
                <label className="text-[11px] font-mono text-[var(--text-tertiary)] block mb-1">
                  Abono mensual ({currency})
                </label>
                <input
                  type="number"
                  value={monthlyAmount}
                  onChange={e => setMonthlyAmount(e.target.value)}
                  placeholder="ej. 150000"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono font-bold"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="text-[11px] font-mono text-[var(--text-tertiary)] block mb-1">
                  Monto total acordado ({currency})
                </label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={e => setTotalAmount(e.target.value)}
                  placeholder="ej. 1650000"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono font-bold"
                  required
                />
              </div>
            )}

            {/* Cantidad de cuotas (si aplica) */}
            {type === 'cuotas' && (
              <div>
                <label className="text-[11px] font-mono text-[var(--text-tertiary)] block mb-1">
                  Cantidad de cuotas
                </label>
                <select
                  value={installmentsCount}
                  onChange={e => {
                    const c = parseInt(e.target.value, 10);
                    setInstallmentsCount(c);
                    handleRegenerateFromType('cuotas');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-medium"
                >
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'cuota' : 'cuotas mensuales'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Fecha de inicio */}
            <div>
              <label className="text-[11px] font-mono text-[var(--text-tertiary)] block mb-1">
                Fecha de inicio
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono"
                required
              />
            </div>

            {/* Fecha de fin (opcional) */}
            <div>
              <label className="text-[11px] font-mono text-[var(--text-tertiary)] block mb-1">
                Fecha de fin (opcional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono"
              />
            </div>

            {/* Día de vencimiento habitual */}
            <div>
              <label className="text-[11px] font-mono text-[var(--text-tertiary)] block mb-1">
                Día habitual de vencimiento
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={dueDayRule}
                onChange={e => setDueDayRule(e.target.value)}
                placeholder="ej. 10"
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono"
              />
            </div>

            {/* Medio de pago preferido */}
            <div>
              <label className="text-[11px] font-mono text-[var(--text-tertiary)] block mb-1">
                Medio de pago preferido
              </label>
              <select
                value={preferredPaymentMethod}
                onChange={e => setPreferredPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-medium"
              >
                <option value="transferencia">Transferencia bancaria / CVU</option>
                <option value="mercadopago">Mercado Pago / Enlace de cobro</option>
                <option value="usdt">Cripto / USDT</option>
                <option value="efectivo">Efectivo en mano</option>
                <option value="otro">Otro medio</option>
              </select>
            </div>

            {/* Notas libres */}
            <div className="sm:col-span-2">
              <label className="text-[11px] font-mono text-[var(--text-tertiary)] block mb-1">
                Notas libres del acuerdo (condiciones especiales, facturación, etc.)
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="ej. Transferir antes del día 10. Factura A mensual."
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Individual Cuotas / Milestones Editor */}
        <div className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-[var(--text-primary)] font-heading uppercase tracking-wider">
                3. Cuotas e hitos individuales ({installments.length})
              </h3>
            </div>

            <button
              type="button"
              onClick={handleAddInstallmentRow}
              className="px-3 py-1.5 rounded-[var(--radius-control)] btn-secondary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Agregar cuota</span>
            </button>
          </div>

          <p className="text-[11px] text-[var(--text-secondary)]">
            Podés personalizar el título, la fecha límite y el monto exacto de cada cuota individualmente según lo acordado con el cliente.
          </p>

          <div className="space-y-2.5">
            {installments.map((cuota, idx) => (
              <div
                key={cuota.id || idx}
                className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
              >
                {/* Cuota title */}
                <div className="flex-1 min-w-[120px]">
                  <input
                    type="text"
                    value={cuota.title}
                    onChange={e => handleUpdateInstallmentRow(idx, { title: e.target.value })}
                    placeholder="Título de la cuota"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-medium"
                    required
                  />
                </div>

                {/* Due Date */}
                <div className="w-full sm:w-36">
                  <input
                    type="date"
                    value={cuota.dueDate}
                    onChange={e => handleUpdateInstallmentRow(idx, { dueDate: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono"
                    required
                  />
                </div>

                {/* Amount */}
                <div className="w-full sm:w-32">
                  <input
                    type="number"
                    value={cuota.expectedAmount}
                    onChange={e => handleUpdateInstallmentRow(idx, { expectedAmount: parseFloat(e.target.value) || 0 })}
                    placeholder="Monto"
                    min="0"
                    step="any"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono font-bold"
                    required
                  />
                </div>

                {/* Delete row */}
                <button
                  type="button"
                  onClick={() => handleDeleteInstallmentRow(idx)}
                  className="self-end sm:self-center p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                  title="Eliminar cuota"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 rounded-[var(--radius-control)] btn-secondary text-xs font-semibold cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-[var(--radius-control)] btn-solid-primary text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
          >
            <Save className="w-4 h-4 stroke-[2]" />
            <span>Guardar acuerdo de cobro</span>
          </button>
        </div>
      </form>
    </div>
  );
};
