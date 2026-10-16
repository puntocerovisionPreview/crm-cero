import React, { useState, useEffect } from 'react';
import { Project, ProjectInstallment, IncomeRecord } from '../types';
import { 
  CreditCard, 
  Calendar, 
  MessageCircle, 
  CheckCircle2, 
  Circle, 
  RefreshCw, 
  Plus, 
  Clock, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Lock, 
  DollarSign, 
  Sparkles 
} from 'lucide-react';
import { 
  getPaymentUrgency, 
  buildInstallmentWhatsAppMessage,
  getProjectInstallments,
  formatCurrencyAmount,
  addMonthsToDate,
  resolveProjectCurrency
} from '../utils/paymentPlans';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';

interface Props {
  project: Project;
  incomes: IncomeRecord[];
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onAddIncome?: (income: Omit<IncomeRecord, 'id' | 'createdAt'>) => void;
  onToggleIncomeStatus?: (id: string) => void;
  onDeleteIncome?: (id: string) => void;
  privacyMode?: boolean;
}

export const PaymentPlanManager: React.FC<Props> = ({
  project,
  incomes,
  onUpdateProject,
  onAddIncome,
  onToggleIncomeStatus,
  privacyMode = false,
}) => {
  const currentInstallments = getProjectInstallments(project);

  // Derive initial values based on project type and existing state
  const isPaf = project.projectType?.startsWith('paf');
  const isPafPro = project.projectType === 'paf_pro';
  const isPafBase = project.projectType === 'paf_base';

  // Resolve true currency accurately
  const resolvedCur = resolveProjectCurrency(
    project.estimatedCurrency, 
    project.estimatedPrice || (currentInstallments[0]?.amount), 
    project.projectType
  );
  const projectCurrency = (currentInstallments[0]?.currency as 'USD' | 'ARS') || (project.estimatedCurrency as 'USD' | 'ARS') || resolvedCur;

  // Default suggested price if not set
  const defaultTotalForType = isPafPro ? 1500000 : isPafBase ? 920000 : (projectCurrency === 'USD' ? 450 : 450000);
  const initialTotal = project.estimatedPrice && project.estimatedPrice > 0 
    ? project.estimatedPrice 
    : defaultTotalForType;

  const [showConfig, setShowConfig] = useState<boolean>(currentInstallments.length === 0);
  const [currency, setCurrency] = useState<'USD' | 'ARS'>(projectCurrency);
  const [totalAmount, setTotalAmount] = useState<number | ''>(initialTotal);
  const [installmentsCount, setInstallmentsCount] = useState<number>(
    currentInstallments.length > 0 ? currentInstallments.length : 2
  );
  const [startDate, setStartDate] = useState<string>(
    project.startDate || project.pafStartDate || getTodayString()
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Sync state whenever project changes
  useEffect(() => {
    const list = getProjectInstallments(project);
    const newResolvedCur = resolveProjectCurrency(
      project.estimatedCurrency,
      project.estimatedPrice || list[0]?.amount,
      project.projectType
    );
    const cur = (list[0]?.currency as 'USD' | 'ARS') || (project.estimatedCurrency as 'USD' | 'ARS') || newResolvedCur;
    setCurrency(cur);

    if (list.length > 0) {
      setInstallmentsCount(list.length);
      const sum = list.reduce((acc, i) => acc + (i.amount || 0), 0);
      setTotalAmount(sum);
    } else {
      const defaultTotal = isPafPro ? 1500000 : isPafBase ? 920000 : (cur === 'USD' ? 450 : 450000);
      setTotalAmount(project.estimatedPrice || defaultTotal);
    }
  }, [project.id]);

  const effectiveCurrency = currency;

  // Paid vs Pending Calculations
  const paidInstallments = currentInstallments.filter(i => i.paid);
  const pendingInstallments = currentInstallments.filter(i => !i.paid);
  
  const totalPaid = paidInstallments.reduce((acc, i) => acc + (i.amount || 0), 0);
  const totalPending = pendingInstallments.reduce((acc, i) => acc + (i.amount || 0), 0);
  const totalCalculated = currentInstallments.length > 0 
    ? currentInstallments.reduce((acc, i) => acc + (i.amount || 0), 0)
    : (typeof totalAmount === 'number' ? totalAmount : 0);
  
  const progressPercent = totalCalculated > 0 
    ? Math.min(100, Math.round((totalPaid / totalCalculated) * 100)) 
    : 0;

  // 1. Switch currency cleanly for all pending items
  const handleToggleCurrency = (newCur: 'USD' | 'ARS') => {
    hapticFeedback.selection();
    setCurrency(newCur);

    // If changing currency and values are in opposite scale, adapt totalAmount sensibly
    if (typeof totalAmount === 'number' && totalAmount > 0) {
      if (newCur === 'USD' && totalAmount > 10000) {
        setTotalAmount(isPafPro ? 1500 : isPafBase ? 920 : 700);
      } else if (newCur === 'ARS' && totalAmount < 5000) {
        setTotalAmount(isPafPro ? 1500000 : isPafBase ? 920000 : 700000);
      }
    }

    if (currentInstallments.length > 0) {
      const updated = currentInstallments.map(item => ({
        ...item,
        currency: newCur,
      }));
      onUpdateProject(project.id, {
        estimatedCurrency: newCur,
        installments: updated,
        pafInstallmentDates: updated.map(i => ({
          number: i.number,
          dueDate: i.dueDate,
          amount: i.amount,
          paid: i.paid,
          paidAt: i.paidAt,
        })),
      });
    }
  };

  // 2. Select preset values for PAF Pro or PAF Base
  const handleSelectPreset = (pCount: number, pAmount: number, pCur: 'USD' | 'ARS' = 'ARS') => {
    hapticFeedback.selection();
    setInstallmentsCount(pCount);
    setTotalAmount(pAmount);
    setCurrency(pCur);
  };

  // 3. APPLY / RECALCULATE SCHEDULE - PROTECTING COMPLETED/FINALIZED PAYMENTS
  const handleApplySchedule = () => {
    hapticFeedback.success();
    const newTotal = typeof totalAmount === 'number' && totalAmount > 0 ? totalAmount : 0;
    const count = Math.max(1, installmentsCount);
    const start = startDate || getTodayString();

    // RULE: Completed / paid installments MUST NEVER be modified or overwritten!
    const existingPaid = currentInstallments.filter(i => i.paid);
    const paidSum = existingPaid.reduce((acc, i) => acc + (i.amount || 0), 0);
    const remainingBalance = Math.max(0, newTotal - paidSum);
    const neededPendingCount = Math.max(0, count - existingPaid.length);

    let updatedInstallments: ProjectInstallment[] = [];

    // Keep all paid installments exactly as they are
    existingPaid.forEach((paidInst, idx) => {
      updatedInstallments.push({
        ...paidInst,
        number: idx + 1,
        currency,
      });
    });

    // If more installments are requested, distribute the remaining balance
    if (neededPendingCount > 0) {
      const baseCuota = Math.floor(remainingBalance / neededPendingCount);
      const residue = remainingBalance - (baseCuota * neededPendingCount);

      for (let i = 0; i < neededPendingCount; i++) {
        const itemNumber = existingPaid.length + i + 1;
        const dueDate = addMonthsToDate(start, itemNumber - 1);
        const amount = (i === neededPendingCount - 1) ? baseCuota + residue : baseCuota;

        updatedInstallments.push({
          id: `inst_${project.id}_${itemNumber}_${Date.now()}`,
          number: itemNumber,
          dueDate,
          amount,
          currency,
          paid: false,
          note: count === 2 
            ? (itemNumber === 1 ? '50% Anticipo / Seña' : '50% Saldo contra entrega')
            : `Cuota ${itemNumber}/${count}`,
        });
      }
    }

    onUpdateProject(project.id, {
      estimatedPrice: newTotal,
      estimatedCurrency: currency,
      installments: updatedInstallments,
      pafInstallmentDates: updatedInstallments.map(i => ({
        number: i.number,
        dueDate: i.dueDate,
        amount: i.amount,
        paid: i.paid,
        paidAt: i.paidAt,
      })),
      pafPlan: `${count}_pagos`,
    });

    setShowConfig(false);
  };

  // 4. Toggle single installment paid status
  const handleToggleInstallment = (installmentId: string, currentPaid: boolean) => {
    hapticFeedback.selection();
    playTaskDone();
    const today = getTodayString();
    const target = currentInstallments.find(i => i.id === installmentId);

    const updated = currentInstallments.map(item => {
      if (item.id === installmentId) {
        return {
          ...item,
          paid: !currentPaid,
          paidAt: !currentPaid ? today : undefined,
        };
      }
      return item;
    });

    onUpdateProject(project.id, {
      installments: updated,
      pafInstallmentDates: updated.map(i => ({
        number: i.number,
        dueDate: i.dueDate,
        amount: i.amount,
        paid: i.paid,
        paidAt: i.paidAt,
      })),
    });

    // Optionally toggle linked income record
    if (target?.incomeRecordId && onToggleIncomeStatus) {
      onToggleIncomeStatus(target.incomeRecordId);
    }
  };

  // 5. Direct editing of an individual installment amount or date
  const handleUpdateInstallment = (id: string, updates: Partial<ProjectInstallment>) => {
    const updated = currentInstallments.map(item => {
      if (item.id === id) {
        return { ...item, ...updates };
      }
      return item;
    });

    // Recalculate total estimated price from all cuotas
    const newTotalSum = updated.reduce((acc, i) => acc + (i.amount || 0), 0);

    onUpdateProject(project.id, {
      estimatedPrice: newTotalSum,
      installments: updated,
      pafInstallmentDates: updated.map(i => ({
        number: i.number,
        dueDate: i.dueDate,
        amount: i.amount,
        paid: i.paid,
        paidAt: i.paidAt,
      })),
    });
    setTotalAmount(newTotalSum);
  };

  // 6. WhatsApp reminder action
  const handleSendReminder = (inst: ProjectInstallment) => {
    hapticFeedback.medium();
    const urgency = getPaymentUrgency(inst.dueDate, inst.paid);
    const instCurrency = (inst.currency as 'USD' | 'ARS') || effectiveCurrency;

    const message = buildInstallmentWhatsAppMessage({
      clientName: project.clientName,
      projectTitle: isPaf ? 'Programa Método PAF' : 'Proyecto Web',
      installmentNumber: inst.number,
      totalInstallments: currentInstallments.length,
      amount: inst.amount,
      currency: instCurrency,
      dueDate: inst.dueDate,
      isOverdue: urgency.status === 'overdue',
    });

    const phoneDigits = project.clientPhone ? project.clientPhone.replace(/\D/g, '') : '';
    if (phoneDigits) {
      const url = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    } else {
      navigator.clipboard.writeText(message);
      setCopiedId(inst.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  // 7. Silent sync to finances
  const handleSyncToFinances = () => {
    if (!onAddIncome) return;
    hapticFeedback.success();

    let count = 0;
    currentInstallments.forEach(inst => {
      const exists = incomes.some(
        inc => inc.projectId === project.id && (inc.id === inst.incomeRecordId || inc.title.includes(`Cuota ${inst.number}/${currentInstallments.length}`))
      );

      if (!exists) {
        onAddIncome({
          title: `Cuota ${inst.number}/${currentInstallments.length} - ${project.clientName}`,
          amount: inst.amount,
          currency: (inst.currency as 'USD' | 'ARS') || effectiveCurrency,
          status: inst.paid ? 'cobrado' : 'pendiente',
          date: inst.dueDate,
          month: inst.dueDate.slice(0, 7),
          projectId: project.id,
          projectName: project.clientName,
        });
        count++;
      }
    });

    setSyncFeedback(count > 0 ? `✓ ${count} cuotas sincronizadas en Finanzas` : '✓ Todas las cuotas ya están en Finanzas');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const formatMoney = (val: number, cur: 'USD' | 'ARS') => {
    if (privacyMode) return '$ ••••••';
    return formatCurrencyAmount(val, cur, true);
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-zinc-100 truncate">
                Plan de Pagos
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700/80 whitespace-nowrap">
                {currentInstallments.length > 0 ? `${currentInstallments.length} cuotas` : 'Sin configurar'}
              </span>

              {/* Fast Segmented Currency Switcher */}
              <div className="inline-flex rounded-xl bg-zinc-950 p-0.5 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleToggleCurrency('ARS')}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    effectiveCurrency === 'ARS'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Cobrar en Pesos Argentinos ($ ARS)"
                >
                  🇦🇷 ARS
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleCurrency('USD')}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    effectiveCurrency === 'USD'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Cobrar en Dólares Estadounidenses (US$ USD)"
                >
                  🇺🇸 USD
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Header Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          {currentInstallments.length > 0 && onAddIncome && (
            <button
              type="button"
              onClick={handleSyncToFinances}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition border border-zinc-700/80 flex items-center gap-1.5 cursor-pointer"
              title="Sincronizar cuotas con la sección de Finanzas"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowConfig(prev => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition border border-zinc-700 cursor-pointer"
          >
            <span>{showConfig ? 'Cerrar' : 'Ajustar Plan'}</span>
            {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Sync feedback notification banner */}
      {syncFeedback && (
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold text-center animate-in fade-in">
          {syncFeedback}
        </div>
      )}

      {/* Financial Summary: 3 Clear Metric Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Box 1: Total */}
        <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/80 space-y-1">
          <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">
            Total Acordado
          </div>
          <div className="text-base sm:text-lg font-black text-zinc-100 font-mono tracking-tight">
            {formatMoney(totalCalculated, effectiveCurrency)}
          </div>
        </div>

        {/* Box 2: Cobrado */}
        <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/80 space-y-1">
          <div className="text-[11px] text-emerald-400 font-medium uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Cobrado</span>
            </span>
            <span className="font-bold">{progressPercent}%</span>
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-400 font-mono tracking-tight">
            {formatMoney(totalPaid, effectiveCurrency)}
          </div>
        </div>

        {/* Box 3: Por Cobrar */}
        <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/80 space-y-1">
          <div className="text-[11px] text-amber-400 font-medium uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>Por Cobrar</span>
          </div>
          <div className="text-base sm:text-lg font-black text-amber-400 font-mono tracking-tight">
            {formatMoney(totalPending, effectiveCurrency)}
          </div>
        </div>
      </div>

      {/* CONFIGURATION / RECALCULATOR DRAWER */}
      {showConfig && (
        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Configuración del Plan & Precios</span>
            </span>
            <span className="text-[11px] text-zinc-400">
              Personalizá el total y las cuotas
            </span>
          </div>

          {/* Quick Presets for PAF Pro, PAF Base, or Web Development */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-zinc-300 block">
              Precios sugeridos según {isPaf ? 'programa PAF' : 'proyecto web'}:
            </span>

            {isPaf ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* PAF Pro Presets */}
                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                  <div className="text-[11px] font-bold text-[var(--accent)] flex items-center justify-between">
                    <span>PAF Completo / Pro (12 Sem)</span>
                    <span className="text-[10px] text-zinc-400 font-mono">ARS</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectPreset(1, 1100000, 'ARS')}
                      className="p-1.5 rounded-lg text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition cursor-pointer"
                    >
                      <div className="font-bold text-[11px]">1 Pago</div>
                      <div className="text-[10px] text-zinc-400 font-mono">$1.1M</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset(2, 1500000, 'ARS')}
                      className="p-1.5 rounded-lg text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition cursor-pointer"
                    >
                      <div className="font-bold text-[11px]">2 Pagos</div>
                      <div className="text-[10px] text-zinc-400 font-mono">2x $750k</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset(3, 1650000, 'ARS')}
                      className="p-1.5 rounded-lg text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition cursor-pointer"
                    >
                      <div className="font-bold text-[11px]">3 Pagos</div>
                      <div className="text-[10px] text-zinc-400 font-mono">3x $550k</div>
                    </button>
                  </div>
                </div>

                {/* PAF Base Presets */}
                <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                  <div className="text-[11px] font-bold text-amber-400 flex items-center justify-between">
                    <span>PAF Base (Inicial)</span>
                    <span className="text-[10px] text-zinc-400 font-mono">ARS</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelectPreset(1, 800000, 'ARS')}
                      className="p-1.5 rounded-lg text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition cursor-pointer"
                    >
                      <div className="font-bold text-[11px]">1 Pago</div>
                      <div className="text-[10px] text-zinc-400 font-mono">$800k</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset(2, 920000, 'ARS')}
                      className="p-1.5 rounded-lg text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition cursor-pointer"
                    >
                      <div className="font-bold text-[11px]">2 Pagos</div>
                      <div className="text-[10px] text-zinc-400 font-mono">2x $460k</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset(3, 1110000, 'ARS')}
                      className="p-1.5 rounded-lg text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition cursor-pointer"
                    >
                      <div className="font-bold text-[11px]">3 Pagos</div>
                      <div className="text-[10px] text-zinc-400 font-mono">3x $370k</div>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
                <div className="text-[11px] font-bold text-blue-400 flex items-center justify-between">
                  <span>Planes Estándar Desarrollo Web</span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {effectiveCurrency === 'USD' ? 'US$ USD' : '$ ARS'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(1, effectiveCurrency === 'USD' ? 450 : 450000, effectiveCurrency)}
                    className="p-1.5 rounded-lg text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition cursor-pointer"
                  >
                    <div className="font-bold text-[11px]">1 Pago</div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      {effectiveCurrency === 'USD' ? 'US$ 450' : '$ 450k'}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(2, effectiveCurrency === 'USD' ? 450 : 450000, effectiveCurrency)}
                    className="p-1.5 rounded-lg text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition cursor-pointer"
                  >
                    <div className="font-bold text-[11px]">2 Pagos (50/50)</div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      {effectiveCurrency === 'USD' ? '2x US$ 225' : '2x $ 225k'}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(3, effectiveCurrency === 'USD' ? 450 : 450000, effectiveCurrency)}
                    className="p-1.5 rounded-lg text-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition cursor-pointer"
                  >
                    <div className="font-bold text-[11px]">3 Pagos</div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      {effectiveCurrency === 'USD' ? '3x US$ 150' : '3x $ 150k'}
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Editable Inputs: Total Price, Currency, Installments Count, Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Monto Total Acordado:
              </label>
              <div className="flex rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden focus-within:border-[var(--accent)]">
                <select
                  value={currency}
                  onChange={e => handleToggleCurrency(e.target.value as 'USD' | 'ARS')}
                  className="bg-zinc-800 text-zinc-200 text-xs font-bold px-2.5 py-2 border-r border-zinc-700 focus:outline-none cursor-pointer"
                >
                  <option value="ARS">ARS ($)</option>
                  <option value="USD">USD (US$)</option>
                </select>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={e => setTotalAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ej. 1500000"
                  className="w-full bg-transparent text-zinc-100 text-xs font-mono font-bold px-2.5 py-2 focus:outline-none placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Cantidad de Cuotas:
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 6].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setInstallmentsCount(num);
                      hapticFeedback.selection();
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                      installmentsCount === num
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1">
                Fecha del 1° pago:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-zinc-900 text-zinc-100 text-xs p-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Protection Notice: If there are completed payments */}
          {paidInstallments.length > 0 && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                <strong>Protección activa:</strong> Hay {paidInstallments.length} cuota{paidInstallments.length > 1 ? 's' : ''} ya cobrada{paidInstallments.length > 1 ? 's' : ''}. Se mantendrán intactas con su monto y fecha registrada.
              </span>
            </div>
          )}

          {/* Save Action */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => setShowConfig(false)}
              className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApplySchedule}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Plan de {installmentsCount} Cuotas</span>
            </button>
          </div>
        </div>
      )}

      {/* INSTALLMENTS LIST (CRONOGRAMA DE CUOTAS) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 px-1">
          <span>Cronograma de Cuotas ({currentInstallments.length})</span>
          <span className="text-[11px] text-zinc-500">
            {project.clientPhone ? `WhatsApp: ${project.clientPhone}` : 'Sin teléfono'}
          </span>
        </div>

        {currentInstallments.length === 0 ? (
          <div className="p-6 text-center bg-zinc-950/60 rounded-2xl border border-dashed border-zinc-800 space-y-2">
            <p className="text-xs text-zinc-400">
              No hay un plan de cuotas configurado para este cliente.
            </p>
            <button
              type="button"
              onClick={() => handleApplySchedule()}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Plan de 2 Cuotas</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {currentInstallments.map((inst, idx) => {
              const urgency = getPaymentUrgency(inst.dueDate, inst.paid);
              const instCurrency = (inst.currency as 'USD' | 'ARS') || effectiveCurrency;
              const phoneDigits = project.clientPhone ? project.clientPhone.replace(/\D/g, '') : null;
              const isCopied = copiedId === inst.id;

              return (
                <div
                  key={inst.id || idx}
                  className={`p-3 sm:p-4 rounded-xl border transition space-y-2.5 ${
                    inst.paid
                      ? 'bg-emerald-950/15 border-emerald-500/25'
                      : urgency.status === 'overdue'
                      ? 'bg-rose-950/20 border-rose-500/30'
                      : urgency.status === 'due_today' || urgency.status === 'due_soon'
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : 'bg-zinc-950/80 border-zinc-800'
                  }`}
                >
                  {/* Top Row: Checkmark, Title, Urgency Badge, and Amount */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleInstallment(inst.id, inst.paid)}
                        className="p-1 rounded-lg transition shrink-0 cursor-pointer"
                        title={inst.paid ? 'Marcar como pendiente' : 'Marcar como cobrado'}
                      >
                        {inst.paid ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-zinc-500 hover:text-emerald-400" />
                        )}
                      </button>

                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className={`text-xs sm:text-sm font-bold ${
                          inst.paid ? 'line-through text-zinc-400' : 'text-zinc-100'
                        }`}>
                          Cuota {inst.number} de {currentInstallments.length}
                        </span>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap border ${urgency.badgeClass}`}>
                          {inst.paid && inst.paidAt ? `✓ Cobrado (${inst.paidAt})` : urgency.label}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-mono font-bold text-zinc-400">
                        {instCurrency === 'USD' ? 'US$' : '$'}
                      </span>
                      {inst.paid ? (
                        <span className="text-xs sm:text-sm font-mono font-black text-emerald-400 px-2.5 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/25">
                          {Math.round(inst.amount).toLocaleString('es-AR')}
                        </span>
                      ) : (
                        <input
                          type="number"
                          value={inst.amount}
                          onChange={e => handleUpdateInstallment(inst.id, { amount: Number(e.target.value) || 0 })}
                          className="w-24 sm:w-28 bg-zinc-900 text-zinc-100 text-xs sm:text-sm font-mono font-bold px-2 py-1 rounded-lg border border-zinc-700 text-right focus:outline-none focus:border-[var(--accent)]"
                          title="Modificar precio de esta cuota"
                        />
                      )}
                      <span className="text-[10px] font-mono text-zinc-400">
                        {instCurrency}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Due date on left, WhatsApp action on right */}
                  <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="text-[11px] shrink-0 text-zinc-400">Vencimiento:</span>
                      {inst.paid ? (
                        <span className="font-mono text-zinc-300 text-xs">{inst.dueDate}</span>
                      ) : (
                        <input
                          type="date"
                          value={inst.dueDate}
                          onChange={e => handleUpdateInstallment(inst.id, { dueDate: e.target.value })}
                          className="bg-zinc-900 text-zinc-200 text-xs px-2 py-1 rounded-lg border border-zinc-700/80 focus:outline-none focus:border-[var(--accent)]"
                        />
                      )}
                    </div>

                    {!inst.paid && (
                      <button
                        type="button"
                        onClick={() => handleSendReminder(inst)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ml-auto ${
                          phoneDigits
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                            : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}
                        title={phoneDigits ? 'Enviar recordatorio por WhatsApp' : 'Copiar mensaje de cobro'}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copiado</span>
                          </>
                        ) : phoneDigits ? (
                          <>
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Recordar WhatsApp</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar mensaje</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
