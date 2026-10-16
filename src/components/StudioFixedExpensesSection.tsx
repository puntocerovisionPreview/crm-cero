import React, { useState, useMemo } from 'react';
import { 
  StudioFixedExpense, 
  StudioFixedExpenseCategory, 
  StudioBillingCycle, 
  Project, 
  ExpenseRecord 
} from '../types';
import { hapticFeedback } from '../utils/haptics';
import { playItemCreated, playTaskDone } from '../utils/sound';
import { getTodayString, getMonthKey } from '../utils/storage';
import { ModalPortal } from './ModalPortal';
import { 
  Server, 
  Globe, 
  Bot, 
  Laptop, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Plus, 
  RefreshCw, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  Sparkles, 
  Check, 
  X, 
  DollarSign, 
  Building2, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  Search,
  CreditCard,
  Layers,
  CheckCircle,
  TrendingUp,
  Receipt
} from 'lucide-react';

interface Props {
  expenses: StudioFixedExpense[];
  projects?: Project[];
  usdRate?: number;
  privacyMode?: boolean;
  onAddFixedExpense: (item: Omit<StudioFixedExpense, 'id' | 'createdAt'>) => void;
  onUpdateFixedExpense: (id: string, updates: Partial<StudioFixedExpense>) => void;
  onDeleteFixedExpense: (id: string) => void;
  onRecordRealExpense?: (expense: Omit<ExpenseRecord, 'id' | 'createdAt'>) => void;
}

export const StudioFixedExpensesSection: React.FC<Props> = ({
  expenses = [],
  projects = [],
  usdRate = 1250,
  privacyMode = false,
  onAddFixedExpense,
  onUpdateFixedExpense,
  onDeleteFixedExpense,
  onRecordRealExpense,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formProvider, setFormProvider] = useState('');
  const [formCategory, setFormCategory] = useState<StudioFixedExpenseCategory>('hosting');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formCurrency, setFormCurrency] = useState<'USD' | 'ARS'>('USD');
  const [formCycle, setFormCycle] = useState<StudioBillingCycle>('anual');
  const [formDueDate, setFormDueDate] = useState(getTodayString());
  const [formLastPaidDate, setFormLastPaidDate] = useState('');
  const [formAutoRenew, setFormAutoRenew] = useState(true);
  const [formProjectId, setFormProjectId] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('');

  // Renewal Confirmation Modal / Inline Drawer
  const [renewingItem, setRenewingItem] = useState<StudioFixedExpense | null>(null);
  const [recordInRealExpenses, setRecordInRealExpenses] = useState(true);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const today = getTodayString();

  // Helper to calculate monthly equivalent cost
  const getMonthlyAmount = (amount: number, cycle: StudioBillingCycle) => {
    switch (cycle) {
      case 'mensual': return amount;
      case 'anual': return amount / 12;
      case 'bianual': return amount / 24;
      case 'trimestral': return amount / 3;
      case 'semestral': return amount / 6;
      default: return amount;
    }
  };

  // Helper to calculate days until due
  const getDaysUntilDue = (dueDate: string) => {
    if (!dueDate) return 999;
    const diff = new Date(dueDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Current Month Key for checking paid vs pending status
  const currentMonthKey = getMonthKey(today);

  // Metrics computation (Summing all fixed expenses)
  const metrics = useMemo(() => {
    let monthlyUSD = 0;
    let monthlyARS = 0;
    let grossTotalUSD = 0;
    let grossTotalARS = 0;

    let aiUSD = 0;
    let aiARS = 0;
    let hostingUSD = 0;
    let hostingARS = 0;
    let domainsUSD = 0;
    let domainsARS = 0;
    let softwareUSD = 0;
    let softwareARS = 0;
    let servicesUSD = 0;
    let servicesARS = 0;
    let otherUSD = 0;
    let otherARS = 0;

    let domainsCount = 0;
    let domainsNextRenewal: StudioFixedExpense | null = null;
    let urgentRenewalsCount = 0;
    let urgentUSD = 0;
    let urgentARS = 0;

    // Monthly Paid vs Pending tracking
    let paidThisMonthUSD = 0;
    let paidThisMonthARS = 0;
    let paidThisMonthCount = 0;

    let pendingThisMonthUSD = 0;
    let pendingThisMonthARS = 0;
    let pendingThisMonthCount = 0;

    expenses.filter(e => e.active).forEach(item => {
      const monthly = getMonthlyAmount(item.amount, item.billingCycle);

      if (item.currency === 'USD') {
        monthlyUSD += monthly;
        grossTotalUSD += item.amount;
        if (item.category === 'ia') aiUSD += monthly;
        if (item.category === 'hosting') hostingUSD += monthly;
        if (item.category === 'dominios') domainsUSD += item.amount;
        if (item.category === 'software') softwareUSD += monthly;
        if (item.category === 'servicios') servicesUSD += monthly;
        if (item.category === 'otro') otherUSD += monthly;
      } else {
        monthlyARS += monthly;
        grossTotalARS += item.amount;
        if (item.category === 'ia') aiARS += monthly;
        if (item.category === 'hosting') hostingARS += monthly;
        if (item.category === 'dominios') domainsARS += item.amount;
        if (item.category === 'software') softwareARS += monthly;
        if (item.category === 'servicios') servicesARS += monthly;
        if (item.category === 'otro') otherARS += monthly;
      }

      if (item.category === 'dominios') {
        domainsCount++;
        if (!domainsNextRenewal || item.nextDueDate < domainsNextRenewal.nextDueDate) {
          domainsNextRenewal = item;
        }
      }

      const days = getDaysUntilDue(item.nextDueDate);
      if (days <= 30) {
        urgentRenewalsCount++;
        if (item.currency === 'USD') urgentUSD += item.amount;
        else urgentARS += item.amount;
      }

      // Check payment status for the current month
      const isPaidInCurrentMonth = item.lastPaidDate && item.lastPaidDate.startsWith(currentMonthKey);
      const isDueInCurrentMonth = item.nextDueDate && item.nextDueDate.startsWith(currentMonthKey);

      if (isPaidInCurrentMonth) {
        paidThisMonthCount++;
        if (item.currency === 'USD') paidThisMonthUSD += item.amount;
        else paidThisMonthARS += item.amount;
      } else if (isDueInCurrentMonth || days <= 0) {
        pendingThisMonthCount++;
        if (item.currency === 'USD') pendingThisMonthUSD += item.amount;
        else pendingThisMonthARS += item.amount;
      }
    });

    const totalCombinedARS = monthlyARS + (monthlyUSD * usdRate);
    const totalCombinedUSD = monthlyUSD + (usdRate > 0 ? monthlyARS / usdRate : 0);

    return {
      monthlyUSD,
      monthlyARS,
      grossTotalUSD,
      grossTotalARS,
      totalCombinedARS,
      totalCombinedUSD,
      aiUSD,
      aiARS,
      hostingUSD,
      hostingARS,
      domainsUSD,
      domainsARS,
      domainsCount,
      domainsNextRenewal,
      softwareUSD,
      softwareARS,
      servicesUSD,
      servicesARS,
      otherUSD,
      otherARS,
      urgentRenewalsCount,
      urgentUSD,
      urgentARS,
      paidThisMonthUSD,
      paidThisMonthARS,
      paidThisMonthCount,
      pendingThisMonthUSD,
      pendingThisMonthARS,
      pendingThisMonthCount,
    };
  }, [expenses, usdRate, today, currentMonthKey]);

  // Filtered and Sorted list
  const filteredExpenses = useMemo(() => {
    return expenses.filter(item => {
      // Category filter
      if (selectedCategory === 'urgentes') {
        const days = getDaysUntilDue(item.nextDueDate);
        if (days > 30) return false;
      } else if (selectedCategory !== 'todos' && item.category !== selectedCategory) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesProvider = item.provider?.toLowerCase().includes(q);
        const matchesClient = item.clientName?.toLowerCase().includes(q);
        const matchesNotes = item.notes?.toLowerCase().includes(q);
        if (!matchesName && !matchesProvider && !matchesClient && !matchesNotes) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Sort by nextDueDate ascending (closer renewals first)
      return (a.nextDueDate || '').localeCompare(b.nextDueDate || '');
    });
  }, [expenses, selectedCategory, searchQuery, today]);

  // Sum of currently filtered expenses
  const filteredTotals = useMemo(() => {
    let rawUSD = 0;
    let rawARS = 0;
    let monthlyUSD = 0;
    let monthlyARS = 0;

    filteredExpenses.forEach(item => {
      const monthly = getMonthlyAmount(item.amount, item.billingCycle);
      if (item.currency === 'USD') {
        rawUSD += item.amount;
        monthlyUSD += monthly;
      } else {
        rawARS += item.amount;
        monthlyARS += monthly;
      }
    });

    const combinedMonthlyARS = monthlyARS + (monthlyUSD * usdRate);

    return {
      rawUSD,
      rawARS,
      monthlyUSD,
      monthlyARS,
      combinedMonthlyARS,
      count: filteredExpenses.length,
    };
  }, [filteredExpenses, usdRate]);

  // Reset form
  const resetForm = () => {
    setFormName('');
    setFormProvider('');
    setFormCategory('hosting');
    setFormAmount('');
    setFormCurrency('USD');
    setFormCycle('anual');
    setFormDueDate(getTodayString());
    setFormLastPaidDate('');
    setFormAutoRenew(true);
    setFormProjectId('');
    setFormClientName('');
    setFormNotes('');
    setFormPaymentMethod('');
    setEditingId(null);
    setShowAddForm(false);
  };

  // Open edit mode
  const handleStartEdit = (item: StudioFixedExpense) => {
    setEditingId(item.id);
    setFormName(item.name);
    setFormProvider(item.provider || '');
    setFormCategory(item.category);
    setFormAmount(String(item.amount));
    setFormCurrency(item.currency);
    setFormCycle(item.billingCycle);
    setFormDueDate(item.nextDueDate);
    setFormLastPaidDate(item.lastPaidDate || '');
    setFormAutoRenew(item.autoRenew ?? true);
    setFormProjectId(item.projectId || '');
    setFormClientName(item.clientName || '');
    setFormNotes(item.notes || '');
    setFormPaymentMethod(item.paymentMethod || '');
    setShowAddForm(true);
  };

  // Apply Quick Preset
  const handleApplyPreset = (preset: {
    name: string;
    provider: string;
    category: StudioFixedExpenseCategory;
    amount: number;
    currency: 'USD' | 'ARS';
    cycle: StudioBillingCycle;
    notes?: string;
  }) => {
    hapticFeedback.light();
    setFormName(preset.name);
    setFormProvider(preset.provider);
    setFormCategory(preset.category);
    setFormAmount(String(preset.amount));
    setFormCurrency(preset.currency);
    setFormCycle(preset.cycle);
    if (preset.notes) setFormNotes(preset.notes);
  };

  // Submit Add / Edit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAmount || Number(formAmount) <= 0) return;

    hapticFeedback.success();
    playItemCreated();

    const linkedProject = projects.find(p => p.id === formProjectId);
    const resolvedClientName = linkedProject ? linkedProject.clientName : formClientName.trim() || undefined;

    const payload = {
      name: formName.trim(),
      provider: formProvider.trim() || undefined,
      category: formCategory,
      amount: Number(formAmount),
      currency: formCurrency,
      billingCycle: formCycle,
      nextDueDate: formDueDate,
      lastPaidDate: formLastPaidDate || undefined,
      autoRenew: formAutoRenew,
      projectId: formProjectId || undefined,
      clientName: resolvedClientName,
      notes: formNotes.trim() || undefined,
      paymentMethod: formPaymentMethod.trim() || undefined,
      active: true,
    };

    if (editingId) {
      onUpdateFixedExpense(editingId, payload);
    } else {
      onAddFixedExpense(payload);
    }

    resetForm();
  };

  // Calculate next cycle date
  const computeNextCycleDate = (currentDueDate: string, cycle: StudioBillingCycle): string => {
    try {
      const d = new Date(currentDueDate + 'T00:00:00');
      if (cycle === 'anual') {
        d.setFullYear(d.getFullYear() + 1);
      } else if (cycle === 'bianual') {
        d.setFullYear(d.getFullYear() + 2);
      } else if (cycle === 'semestral') {
        d.setMonth(d.getMonth() + 6);
      } else if (cycle === 'trimestral') {
        d.setMonth(d.getMonth() + 3);
      } else {
        d.setMonth(d.getMonth() + 1);
      }
      return d.toISOString().split('T')[0];
    } catch {
      return getTodayString();
    }
  };

  // Execute Renewal
  const handleConfirmRenewal = () => {
    if (!renewingItem) return;
    hapticFeedback.success();
    playTaskDone();

    const nextDate = computeNextCycleDate(renewingItem.nextDueDate, renewingItem.billingCycle);

    // 1. Update Fixed Expense item
    onUpdateFixedExpense(renewingItem.id, {
      lastPaidDate: today,
      nextDueDate: nextDate,
    });

    // 2. Optionally record as real expense in Studio cashflow
    if (recordInRealExpenses && onRecordRealExpense) {
      const mappedCategory = 
        renewingItem.category === 'dominios' || renewingItem.category === 'hosting'
          ? 'Servidores, Hosting & Dominios'
          : renewingItem.category === 'ia' || renewingItem.category === 'software'
          ? 'Software, SaaS & IA (Figma, GitHub, OpenAI)'
          : 'General de Estudio';

      onRecordRealExpense({
        title: `Renovación: ${renewingItem.name} (${renewingItem.billingCycle})`,
        amount: renewingItem.amount,
        currency: renewingItem.currency,
        category: mappedCategory,
        date: today,
        month: getMonthKey(today),
        status: 'pagado',
        projectId: renewingItem.projectId,
        projectName: renewingItem.clientName,
        notes: `Registrado automáticamente desde Gastos Fijos & Vencimientos. Próximo vencimiento: ${nextDate}`,
      });
    }

    setRenewingItem(null);
  };

  const getCategoryIcon = (category: StudioFixedExpenseCategory) => {
    switch (category) {
      case 'hosting': return <Server className="w-4 h-4 text-sky-400" />;
      case 'dominios': return <Globe className="w-4 h-4 text-emerald-400" />;
      case 'ia': return <Bot className="w-4 h-4 text-purple-400" />;
      case 'software': return <Laptop className="w-4 h-4 text-amber-400" />;
      default: return <Layers className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getCategoryLabel = (category: StudioFixedExpenseCategory) => {
    switch (category) {
      case 'hosting': return 'Hosting & VPS';
      case 'dominios': return 'Dominios & DNS';
      case 'ia': return 'Inteligencia Artificial';
      case 'software': return 'Software & SaaS';
      case 'servicios': return 'Servicios';
      default: return 'Otro';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Summary Cards */}
      <div className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border-[var(--border-subtle)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="label-swiss text-[11px] font-bold text-sky-400">Gastos Fijos & Infraestructura</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
                {expenses.length} suscripciones y servicios
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-heading tracking-tight mt-1">
              Control de Vencimientos, Hosting, Dominios & IAs
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 max-w-2xl">
              Calculá tu costo operativo mensualizado, llevá el control de fechas de renovación anual de Hostinger y dominios de clientes pasados, y sabé exactamente cuánto invertís en IAs cada mes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              if (showAddForm) {
                resetForm();
              } else {
                setShowAddForm(true);
              }
            }}
            className="btn-solid-primary py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto shadow-xs active:scale-95"
          >
            {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{showAddForm ? 'Cerrar Formulario' : '+ Nuevo Gasto Fijo'}</span>
          </button>
        </div>

        {/* Financial KPI Grid (Full sums across categories and currencies) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {/* KPI 1: Costo Mensual Total */}
          <div className="p-3.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] block">
              Gasto Mensual Estimado
            </span>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg sm:text-xl font-mono font-bold text-[var(--text-primary)]">
                {privacyMode ? '$ •••' : `≈ u$s ${metrics.totalCombinedUSD.toFixed(1)}`}
              </span>
              <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                /mes
              </span>
            </div>
            <p className="text-[10px] font-mono text-emerald-400 truncate">
              {privacyMode ? '$ ••••••' : `Suma: $${Math.round(metrics.totalCombinedARS).toLocaleString('es-AR')} ARS/mes`}
            </p>
          </div>

          {/* KPI 2: Inversión en IAs */}
          <div className="p-3.5 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-purple-300">
                Inversión en IAs
              </span>
              <Bot className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-lg sm:text-xl font-mono font-bold text-purple-300 flex items-baseline gap-1 flex-wrap">
              {privacyMode ? '$ •••' : `u$s ${metrics.aiUSD.toFixed(0)}`}
              {metrics.aiARS > 0 && !privacyMode && (
                <span className="text-xs text-purple-400 font-normal">+ ${Math.round(metrics.aiARS).toLocaleString('es-AR')}</span>
              )}
              <span className="text-xs text-purple-400/80 font-normal ml-0.5">/mes</span>
            </div>
            <p className="text-[10px] font-mono text-purple-400/70 truncate">
              ChatGPT, Claude, Cursor, Midjourney
            </p>
          </div>

          {/* KPI 3: Hosting & Servidores */}
          <div className="p-3.5 rounded-2xl bg-sky-500/5 border border-sky-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-300">
                Hosting & Nube
              </span>
              <Server className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-lg sm:text-xl font-mono font-bold text-sky-300 flex items-baseline gap-1 flex-wrap">
              {privacyMode ? '$ •••' : `u$s ${metrics.hostingUSD.toFixed(1)}`}
              {metrics.hostingARS > 0 && !privacyMode && (
                <span className="text-xs text-sky-400 font-normal">+ ${Math.round(metrics.hostingARS).toLocaleString('es-AR')}</span>
              )}
              <span className="text-xs text-sky-400/80 font-normal ml-0.5">/mes</span>
            </div>
            <p className="text-[10px] font-mono text-sky-400/70 truncate">
              Hostinger, Vercel, VPS
            </p>
          </div>

          {/* KPI 4: Dominios & Vencimientos */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300">
                Dominios Clientes
              </span>
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-base sm:text-lg font-mono font-bold text-emerald-300 truncate">
              {privacyMode ? '$ •••' : (
                <>
                  {metrics.domainsARS > 0 ? `$${Math.round(metrics.domainsARS).toLocaleString('es-AR')}` : ''}
                  {metrics.domainsARS > 0 && metrics.domainsUSD > 0 ? ' + ' : ''}
                  {metrics.domainsUSD > 0 ? `u$s ${metrics.domainsUSD}` : ''}
                  {metrics.domainsARS === 0 && metrics.domainsUSD === 0 ? '$0' : ''}
                </>
              )}
            </div>
            <p className="text-[10px] font-mono text-emerald-400/80 truncate">
              {metrics.domainsCount} {metrics.domainsCount === 1 ? 'dominio registrado' : 'dominios registrados'}
            </p>
          </div>
        </div>

        {/* Monthly Control & Summation Strip */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--bg-app)] border border-sky-500/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-heading">
                Control de Pagos del Mes ({new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })})
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{metrics.paidThisMonthCount} pagados</span>
              </span>
              <span className="text-zinc-600">|</span>
              <span className={metrics.pendingThisMonthCount > 0 ? 'text-amber-400 font-semibold flex items-center gap-1' : 'text-zinc-400 flex items-center gap-1'}>
                <Clock className="w-3.5 h-3.5" />
                <span>{metrics.pendingThisMonthCount} pendientes</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] block">
                Total Estimado del Mes
              </span>
              <div className="text-sm sm:text-base font-bold font-mono text-[var(--text-primary)]">
                {privacyMode ? '$ •••' : (
                  <>
                    {metrics.monthlyARS > 0 ? `$${Math.round(metrics.monthlyARS).toLocaleString('es-AR')} ARS` : ''}
                    {metrics.monthlyARS > 0 && metrics.monthlyUSD > 0 ? ' + ' : ''}
                    {metrics.monthlyUSD > 0 ? `u$s ${metrics.monthlyUSD.toFixed(1)} USD` : ''}
                    {metrics.monthlyARS === 0 && metrics.monthlyUSD === 0 && '$0'}
                  </>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 block">
                ✓ Ya Pagado este Mes
              </span>
              <div className="text-sm sm:text-base font-bold font-mono text-emerald-400">
                {privacyMode ? '$ •••' : (
                  <>
                    {metrics.paidThisMonthARS > 0 ? `$${Math.round(metrics.paidThisMonthARS).toLocaleString('es-AR')} ARS` : ''}
                    {metrics.paidThisMonthARS > 0 && metrics.paidThisMonthUSD > 0 ? ' + ' : ''}
                    {metrics.paidThisMonthUSD > 0 ? `u$s ${metrics.paidThisMonthUSD.toLocaleString('es-AR')} USD` : ''}
                    {metrics.paidThisMonthARS === 0 && metrics.paidThisMonthUSD === 0 && '$0'}
                  </>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300 block">
                ⏳ Pendiente de Pago este Mes
              </span>
              <div className="text-sm sm:text-base font-bold font-mono text-amber-400">
                {privacyMode ? '$ •••' : (
                  <>
                    {metrics.pendingThisMonthARS > 0 ? `$${Math.round(metrics.pendingThisMonthARS).toLocaleString('es-AR')} ARS` : ''}
                    {metrics.pendingThisMonthARS > 0 && metrics.pendingThisMonthUSD > 0 ? ' + ' : ''}
                    {metrics.pendingThisMonthUSD > 0 ? `u$s ${metrics.pendingThisMonthUSD.toLocaleString('es-AR')} USD` : ''}
                    {metrics.pendingThisMonthARS === 0 && metrics.pendingThisMonthUSD === 0 && '$0 (Al día)'}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Add / Edit Form Panel */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border-[var(--text-primary)] space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-[var(--border-divider)] pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--text-primary)]">
                {editingId ? 'Editar Gasto Fijo / Servicio' : 'Registrar Nuevo Gasto Fijo o Suscripción'}
              </h3>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          {/* Quick Presets for 1-Click filling */}
          {!editingId && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] block">
                Carga rápida de plantillas frecuentes:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { name: 'Hostinger Cloud / Web Hosting', provider: 'Hostinger', category: 'hosting' as const, amount: 96, currency: 'USD' as const, cycle: 'anual' as const, notes: 'Hosting anual del estudio para múltiples sitios' },
                  { name: 'Dominio en Nic.ar (.com.ar)', provider: 'Nic.ar', category: 'dominios' as const, amount: 8500, currency: 'ARS' as const, cycle: 'anual' as const, notes: 'Renovación anual obligatoria en Nic.ar' },
                  { name: 'Dominio Cliente (.com)', provider: 'Donweb / Namecheap', category: 'dominios' as const, amount: 14000, currency: 'ARS' as const, cycle: 'anual' as const, notes: 'Dominio registrado que se refactura al cliente' },
                  { name: 'ChatGPT Plus', provider: 'OpenAI', category: 'ia' as const, amount: 20, currency: 'USD' as const, cycle: 'mensual' as const, notes: 'Suscripción IA mensual' },
                  { name: 'Claude Pro', provider: 'Anthropic', category: 'ia' as const, amount: 20, currency: 'USD' as const, cycle: 'mensual' as const, notes: 'Suscripción IA mensual' },
                  { name: 'Cursor AI Pro', provider: 'Cursor', category: 'ia' as const, amount: 20, currency: 'USD' as const, cycle: 'mensual' as const, notes: 'IDE con IA mensual' },
                ].map(p => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="px-2.5 py-1 rounded-lg bg-[var(--bg-app)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-secondary)] hover:text-sky-300 transition shrink-0 cursor-pointer"
                  >
                    + {p.name.split(' ')[0]} {p.amount ? `(${p.currency === 'USD' ? 'u$s' : '$'}${p.amount})` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Service Name */}
            <div className="sm:col-span-2">
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">
                Nombre del Servicio o Dominio *
              </label>
              <input
                type="text"
                required
                placeholder="ej: Hostinger Business, Dominio cliente-arq.com.ar, Claude Pro, Midjourney"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
              />
            </div>

            {/* Provider */}
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">
                Proveedor / Empresa
              </label>
              <input
                type="text"
                placeholder="ej: Hostinger, Nic.ar, OpenAI, Anthropic, Donweb"
                value={formProvider}
                onChange={e => setFormProvider(e.target.value)}
                className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">
                Categoría *
              </label>
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value as StudioFixedExpenseCategory)}
                className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
              >
                <option value="hosting">⚡ Hosting & Servidores</option>
                <option value="dominios">🌐 Dominios & DNS</option>
                <option value="ia">🤖 Inteligencia Artificial</option>
                <option value="software">🛠️ Software & SaaS</option>
                <option value="servicios">💼 Servicios & Asesoría</option>
                <option value="otro">📁 Otro Gasto Fijo</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">
                Monto que se paga *
              </label>
              <input
                type="number"
                required
                min="0"
                step="any"
                placeholder="ej: 20 o 96"
                value={formAmount}
                onChange={e => setFormAmount(e.target.value)}
                className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">
                Moneda *
              </label>
              <select
                value={formCurrency}
                onChange={e => setFormCurrency(e.target.value as 'USD' | 'ARS')}
                className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs font-mono text-[var(--text-primary)] focus:outline-none"
              >
                <option value="USD">USD (Dólares)</option>
                <option value="ARS">ARS (Pesos)</option>
              </select>
            </div>

            {/* Billing Cycle */}
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">
                Frecuencia de Pago *
              </label>
              <select
                value={formCycle}
                onChange={e => setFormCycle(e.target.value as StudioBillingCycle)}
                className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
              >
                <option value="mensual">Mensual (Cada mes)</option>
                <option value="anual">Anual (1 vez al año - ej: Hostinger, Dominios)</option>
                <option value="trimestral">Trimestral (Cada 3 meses)</option>
                <option value="semestral">Semestral (Cada 6 meses)</option>
                <option value="bianual">Bianual (Cada 2 años)</option>
              </select>
              {formAmount && Number(formAmount) > 0 && formCycle !== 'mensual' && (
                <span className="text-[10px] font-mono text-sky-400 mt-1 block">
                  ≈ {formCurrency === 'USD' ? 'u$s' : '$'} {getMonthlyAmount(Number(formAmount), formCycle).toFixed(1)} /mes equivalente
                </span>
              )}
            </div>

            {/* Next Due Date */}
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">
                Próximo Vencimiento / Renovación *
              </label>
              <input
                type="date"
                required
                value={formDueDate}
                onChange={e => setFormDueDate(e.target.value)}
                className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs font-mono text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            {/* Last Paid Date (Optional) */}
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">
                Última fecha que lo pagaste (Opcional)
              </label>
              <input
                type="date"
                value={formLastPaidDate}
                onChange={e => setFormLastPaidDate(e.target.value)}
                className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs font-mono text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            {/* Associated Project / Client */}
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">
                Cliente o Proyecto Vinculado (Opcional)
              </label>
              <select
                value={formProjectId}
                onChange={e => {
                  setFormProjectId(e.target.value);
                  const p = projects.find(item => item.id === e.target.value);
                  if (p) setFormClientName(p.clientName);
                }}
                className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
              >
                <option value="">— Ninguno (Propio del estudio) —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.clientName}
                  </option>
                ))}
              </select>
            </div>

            {/* Free Client Name (if not in project list) */}
            {!formProjectId && (
              <div>
                <label className="text-[11px] text-[var(--text-secondary)] block mb-1">
                  Cliente Pasado / Referencia (Texto libre)
                </label>
                <input
                  type="text"
                  placeholder="ej: Estudio Jurídico Perez (Web 2024)"
                  value={formClientName}
                  onChange={e => setFormClientName(e.target.value)}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                />
              </div>
            )}

            {/* Payment Method */}
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">
                Medio de Pago habitual
              </label>
              <input
                type="text"
                placeholder="ej: Tarjeta Santander Débito, Mercado Pago"
                value={formPaymentMethod}
                onChange={e => setFormPaymentMethod(e.target.value)}
                className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            {/* Auto-renew checkbox */}
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="autoRenewCheck"
                checked={formAutoRenew}
                onChange={e => setFormAutoRenew(e.target.checked)}
                className="rounded accent-sky-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="autoRenewCheck" className="text-xs text-[var(--text-primary)] cursor-pointer select-none">
                Débito automático en tarjeta (o manual si está desmarcado)
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] text-[var(--text-secondary)] block mb-1">
              Notas, DNS, Plan o Recordatorios:
            </label>
            <input
              type="text"
              placeholder="ej: DNS en Cloudflare, plan incluye 100 sitios, se refactura al cliente cuando renueva..."
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-solid-primary px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Check className="w-4 h-4 stroke-[2]" />
              <span>{editingId ? 'Guardar Cambios' : 'Registrar Gasto Fijo'}</span>
            </button>
          </div>
        </form>
      )}

      {/* 3. Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'urgentes', label: `⚠️ Vencen pronto (<30d)` },
            { id: 'hosting', label: '⚡ Hosting' },
            { id: 'dominios', label: '🌐 Dominios' },
            { id: 'ia', label: '🤖 IAs' },
            { id: 'software', label: '🛠️ Software' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setSelectedCategory(tab.id);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === tab.id
                  ? 'btn-solid-primary shadow-xs'
                  : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre, cliente, proveedor..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
          />
        </div>
      </div>

      {/* 4. Expenses List */}
      {filteredExpenses.length === 0 ? (
        <div className="card-swiss p-8 text-center space-y-3 bg-[var(--bg-surface)]">
          <div className="w-12 h-12 rounded-2xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-tertiary)] mx-auto">
            <Server className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-[var(--text-primary)]">
            No se encontraron gastos fijos
          </div>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'todos'
              ? 'Probá cambiando los filtros o la búsqueda.'
              : 'Agregá los servicios que pagás mes a mes o año a año para nunca perder un vencimiento de dominio o hosting.'}
          </p>
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="btn-solid-primary px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer mt-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar primer servicio</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Header strip with total sum of filtered expenses */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[var(--text-primary)]">
                {filteredTotals.count} {filteredTotals.count === 1 ? 'gasto fijo' : 'gastos fijos'}
              </span>
              <span className="text-zinc-600">·</span>
              <span className="font-mono text-emerald-400 font-bold">
                Suma Total: {privacyMode ? '••••' : (
                  <>
                    {filteredTotals.rawARS > 0 ? `$${Math.round(filteredTotals.rawARS).toLocaleString('es-AR')} ARS` : ''}
                    {filteredTotals.rawARS > 0 && filteredTotals.rawUSD > 0 ? ' + ' : ''}
                    {filteredTotals.rawUSD > 0 ? `u$s ${filteredTotals.rawUSD.toLocaleString('es-AR')} USD` : ''}
                    {filteredTotals.rawARS === 0 && filteredTotals.rawUSD === 0 ? '$0' : ''}
                  </>
                )}
              </span>
            </div>
            <div className="font-mono text-[11px] text-[var(--text-secondary)]">
              ≈ Suma mensual: <strong className="text-[var(--text-primary)]">{privacyMode ? '••••' : `$${Math.round(filteredTotals.combinedMonthlyARS).toLocaleString('es-AR')} ARS/mes`}</strong>
            </div>
          </div>

          {filteredExpenses.map(item => {
            const daysLeft = getDaysUntilDue(item.nextDueDate);
            const isOverdue = daysLeft < 0;
            const isUrgent = daysLeft >= 0 && daysLeft <= 15;
            const isSoon = daysLeft > 15 && daysLeft <= 30;
            const monthlyAmount = getMonthlyAmount(item.amount, item.billingCycle);
            const isPaidThisMonth = Boolean(item.lastPaidDate && item.lastPaidDate.startsWith(currentMonthKey));

            return (
              <div
                key={item.id}
                className={`card-swiss p-4 rounded-2xl transition border ${
                  isOverdue
                    ? 'border-rose-500/50 bg-rose-500/5'
                    : isUrgent
                    ? 'border-amber-500/50 bg-amber-500/5'
                    : isSoon
                    ? 'border-sky-500/40 bg-[var(--bg-surface)]'
                    : isPaidThisMonth
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-divider)]'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left: Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] shrink-0 mt-0.5">
                      {getCategoryIcon(item.category)}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[var(--text-primary)]">
                          {item.name}
                        </span>
                        {item.provider && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                            {item.provider}
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                          {item.billingCycle.toUpperCase()}
                        </span>
                        {item.clientName && (
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            <span>{item.clientName}</span>
                          </span>
                        )}
                        {isPaidThisMonth && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>Pagado este mes</span>
                          </span>
                        )}
                      </div>

                      {item.notes && (
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-1">
                          {item.notes}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-secondary)] pt-0.5 flex-wrap">
                        {item.lastPaidDate && (
                          <span>Último pago: {item.lastPaidDate}</span>
                        )}
                        {item.paymentMethod && (
                          <span>· Medio: {item.paymentMethod}</span>
                        )}
                        <span>· {item.autoRenew ? 'Débito automático' : 'Pago manual'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amounts, Countdown & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--border-subtle)]">
                    {/* Amount Block */}
                    <div className="text-left md:text-right">
                      <div className="font-mono font-bold text-base sm:text-lg text-[var(--text-primary)]">
                        {privacyMode ? '$ •••' : `${item.currency === 'USD' ? 'u$s' : '$'} ${item.amount.toLocaleString('es-AR')}`}
                        <span className="text-[10px] font-normal text-[var(--text-secondary)] ml-1">
                          /{item.billingCycle}
                        </span>
                      </div>
                      {item.billingCycle !== 'mensual' && (
                        <div className="text-[10.5px] font-mono text-sky-400">
                          {privacyMode ? '$ •••' : `≈ ${item.currency === 'USD' ? 'u$s' : '$'} ${monthlyAmount.toFixed(1)}/mes`}
                        </div>
                      )}
                    </div>

                    {/* Due Date & Badge */}
                    <div className="text-left md:text-right space-y-0.5 min-w-[110px]">
                      <div className="text-[11px] font-mono font-semibold text-[var(--text-primary)]">
                        {item.nextDueDate}
                      </div>
                      <div>
                        {isOverdue ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Venció hace {Math.abs(daysLeft)}d</span>
                          </span>
                        ) : isUrgent ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                            <Clock className="w-3 h-3" />
                            <span>Vence en {daysLeft} días</span>
                          </span>
                        ) : isSoon ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                            <span>En {daysLeft} días</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                            <span>En {daysLeft} días</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          hapticFeedback.light();
                          setRenewingItem(item);
                        }}
                        className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                          isPaidThisMonth
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-xs active:scale-95'
                        }`}
                        title={isPaidThisMonth ? 'Pagado este mes (click para renovar siguiente ciclo)' : 'Marcar Pagado y Sumar a Caja'}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                          {isPaidThisMonth ? 'Renovar' : 'Pagar'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="p-2 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition cursor-pointer"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (deletingExpenseId === item.id) {
                            hapticFeedback.medium();
                            onDeleteFixedExpense(item.id);
                            setDeletingExpenseId(null);
                          } else {
                            hapticFeedback.light();
                            setDeletingExpenseId(item.id);
                            setTimeout(() => {
                              setDeletingExpenseId(prev => (prev === item.id ? null : prev));
                            }, 4000);
                          }
                        }}
                        className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                          deletingExpenseId === item.id
                            ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/25 animate-pulse'
                            : 'bg-[var(--bg-app)] hover:bg-rose-500/10 text-[var(--text-tertiary)] hover:text-rose-400 border border-[var(--border-subtle)]'
                        }`}
                        title={deletingExpenseId === item.id ? 'Confirmar eliminación' : 'Eliminar'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deletingExpenseId === item.id && (
                          <span className="text-[10px] font-bold">¿Borrar?</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Renewal Confirmation Dialog (Modal wrapped with ModalPortal) */}
      {renewingItem && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="card-swiss p-5 sm:p-6 bg-[var(--bg-surface)] border-[var(--text-primary)] max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--border-divider)] pb-2.5">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold font-heading text-[var(--text-primary)]">
                    Registrar Pago / Renovación de Gasto Fijo
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRenewingItem(null)}
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-1">
                <div className="font-bold text-sm text-[var(--text-primary)]">
                  {renewingItem.name}
                </div>
                <div className="text-xs font-mono text-[var(--text-secondary)]">
                  {renewingItem.provider ? `${renewingItem.provider} · ` : ''}
                  {renewingItem.currency === 'USD' ? 'u$s' : '$'} {renewingItem.amount.toLocaleString('es-AR')} ({renewingItem.billingCycle})
                </div>
                <div className="text-xs font-mono text-emerald-400 pt-1">
                  Próximo ciclo pasará a: <strong>{computeNextCycleDate(renewingItem.nextDueDate, renewingItem.billingCycle)}</strong>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-2.5 text-xs text-[var(--text-primary)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={recordInRealExpenses}
                    onChange={e => setRecordInRealExpenses(e.target.checked)}
                    className="rounded accent-emerald-500 w-4 h-4 mt-0.5 cursor-pointer shrink-0"
                  />
                  <span>
                    <strong>Sumar a egresos de caja del estudio</strong> como gasto pagado hoy ({renewingItem.currency === 'USD' ? 'u$s' : '$'} {renewingItem.amount.toLocaleString('es-AR')}) para computarlo en el balance neto.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setRenewingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRenewal}
                  className="btn-solid-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4 stroke-[2]" />
                  <span>Confirmar Pago y Sumar</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
