import React, { useState, useMemo } from 'react';
import { 
  IncomeRecord, 
  ExpenseRecord, 
  Project, 
  DEFAULT_EXPENSE_CATEGORIES, 
  DEFAULT_INCOME_CATEGORIES,
  ExpenseCategory,
  IncomeCategory,
  FlexiblePaymentCommitment,
  PaymentCommitmentStatus,
  RecurringIncomePlan,
  RecurringFrequency,
  Payment,
  PersonalAccount,
  StudioFixedExpense
} from '../types';
import { StudioFixedExpensesSection } from '../components/StudioFixedExpensesSection';
import { ProjectPaymentProgressBar } from '../components/ProjectPaymentProgressBar';
import { RegisterPaymentModal } from '../components/RegisterPaymentModal';
import { 
  formatMonthTitle, 
  getTodayString, 
  getMonthKey,
  MONTH_NAMES,
  MONTH_SHORT_NAMES
} from '../utils/storage';
import { 
  calculateProjectFinancials, 
  generateFlexibleSchedule, 
  ScheduleTemplateType, 
  calculateCommitmentStatus,
  addMonthsToDate,
  addDaysToDate
} from '../utils/paymentPlans';
import { calculateMonthlyCashProjection } from '../utils/monthlyCashProjection';
import { 
  DollarSign, 
  TrendingDown, 
  TrendingUp,
  Plus, 
  Trash2, 
  Calendar, 
  CheckCircle2, 
  Circle,
  Clock, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  Building2,
  Tag,
  Repeat,
  Sparkles,
  ArrowUpRight,
  Sliders,
  Percent,
  Check,
  Edit2,
  AlertCircle,
  FolderKanban,
  PieChart,
  FileText,
  Server,
  Globe,
  Copy,
  Download,
  Share2,
  X
} from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { playItemCreated, playItemDeleted, playTaskDone } from '../utils/sound';
import { ActiveClientsCashflowProjection } from '../components/ActiveClientsCashflowProjection';
import { CategoryBudgetManager } from '../components/CategoryBudgetManager';
import { StudioMonthlyRevenueOverview } from '../components/StudioMonthlyRevenueOverview';

interface Props {
  incomes: IncomeRecord[];
  expenses?: ExpenseRecord[];
  projects?: Project[];
  onAddIncome: (income: Omit<IncomeRecord, 'id' | 'createdAt'>) => void;
  onUpdateIncome: (id: string, updates: Partial<IncomeRecord>) => void;
  onDeleteIncome: (id: string) => void;
  onAddExpense?: (expense: Omit<ExpenseRecord, 'id' | 'createdAt'>) => void;
  onUpdateExpense?: (id: string, updates: Partial<ExpenseRecord>) => void;
  onDeleteExpense?: (id: string) => void;
  onUpdateProject?: (id: string, updates: Partial<Project>) => void;
  onOpenProject360?: (project: Project) => void;
  privacyMode?: boolean;
  onSavePayment?: (projectId: string, payment: Payment, options?: any) => void;
  onDeletePayment?: (projectId: string, paymentId: string) => void;
  personalAccounts?: PersonalAccount[];
  usdRate?: number;
  studioFixedExpenses?: StudioFixedExpense[];
  onAddFixedExpense?: (item: Omit<StudioFixedExpense, 'id' | 'createdAt'>) => void;
  onUpdateFixedExpense?: (id: string, updates: Partial<StudioFixedExpense>) => void;
  onDeleteFixedExpense?: (id: string) => void;
}

type FinancialSubTab = 'resumen' | 'movimientos' | 'cronogramas' | 'recurrentes' | 'gastos-fijos' | 'proyeccion' | 'presupuestos';

export const IncomeView: React.FC<Props> = ({
  incomes,
  expenses = [],
  projects = [],
  onAddIncome,
  onUpdateIncome,
  onDeleteIncome,
  onAddExpense = () => {},
  onUpdateExpense = () => {},
  onDeleteExpense = () => {},
  onUpdateProject = () => {},
  onOpenProject360,
  privacyMode = false,
  onSavePayment,
  onDeletePayment,
  personalAccounts = [],
  usdRate = 1250,
  studioFixedExpenses = [],
  onAddFixedExpense = () => {},
  onUpdateFixedExpense = () => {},
  onDeleteFixedExpense = () => {},
}) => {
  const today = getTodayString();
  const currentYear = Number(today.slice(0, 4));
  const currentMonthNumber = today.slice(5, 7); // "01" to "12"

  // Active Sub-tab - default to Resumen Mensual per user request
  const [subTab, setSubTab] = useState<FinancialSubTab>('resumen');

  // Urgent fixed expenses count (< 30 days)
  const urgentFixedExpensesList = useMemo(() => {
    return studioFixedExpenses.filter(e => {
      if (!e.active || !e.nextDueDate) return false;
      const diff = new Date(e.nextDueDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days <= 30;
    });
  }, [studioFixedExpenses, today]);
  const [movementType, setMovementType] = useState<'ingresos' | 'gastos'>('ingresos');

  // Year and Month filter state
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthNumber);

  // Inline forms toggles (NO POPUPS)
  const [showInlineAddMovement, setShowInlineAddMovement] = useState(false);
  const [showInlineAddRecurring, setShowInlineAddRecurring] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // New Income / Expense Form State
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formCurrency, setFormCurrency] = useState<'USD' | 'ARS'>('USD');
  const [formDate, setFormDate] = useState<string>(today);
  const [formStatus, setFormStatus] = useState<'cobrado' | 'pendiente' | 'pagado'>('cobrado');
  const [formCategory, setFormCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [formProjectId, setFormProjectId] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // New Recurring Plan Form State
  const [recTitle, setRecTitle] = useState('');
  const [recAmount, setRecAmount] = useState<number | ''>('');
  const [recCurrency, setRecCurrency] = useState<'USD' | 'ARS'>('USD');
  const [recFrequency, setRecFrequency] = useState<RecurringFrequency>('mensual');
  const [recStartDate, setRecStartDate] = useState<string>(today);
  const [recProjectId, setRecProjectId] = useState<string>('');

  // Facturación filter & Quick Register Payment modal
  const [invoicingFilter, setInvoicingFilter] = useState<'all' | 'pending' | 'invoiced'>('all');
  const [selectedProjectForPayment, setSelectedProjectForPayment] = useState<Project | null>(null);
  const [showRegisterPaymentModal, setShowRegisterPaymentModal] = useState(false);

  // Month navigation
  const handlePrevMonth = () => {
    const currentM = Number(selectedMonth === 'all' ? currentMonthNumber : selectedMonth);
    if (currentM === 1) {
      setSelectedYear(y => y - 1);
      setSelectedMonth('12');
    } else {
      setSelectedMonth(String(currentM - 1).padStart(2, '0'));
    }
  };

  const handleNextMonth = () => {
    const currentM = Number(selectedMonth === 'all' ? currentMonthNumber : selectedMonth);
    if (currentM === 12) {
      setSelectedYear(y => y + 1);
      setSelectedMonth('01');
    } else {
      setSelectedMonth(String(currentM + 1).padStart(2, '0'));
    }
  };

  // Submit Free Movement (Income or Expense)
  const handleSubmitMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formAmount || Number(formAmount) <= 0) return;

    hapticFeedback.success();
    playItemCreated();
    const monthKey = getMonthKey(formDate);
    const linkedProj = projects.find(p => p.id === formProjectId);

    if (movementType === 'ingresos') {
      onAddIncome({
        title: formTitle.trim(),
        concept: formTitle.trim(),
        category: formCategory,
        amount: Number(formAmount),
        currency: formCurrency,
        date: formDate,
        month: monthKey,
        status: formStatus === 'pagado' ? 'cobrado' : (formStatus as 'cobrado' | 'pendiente'),
        projectId: linkedProj ? linkedProj.id : undefined,
        projectName: linkedProj ? linkedProj.clientName : undefined,
        notes: formNotes.trim() || undefined,
      });
    } else {
      onAddExpense({
        title: formTitle.trim(),
        amount: Number(formAmount),
        currency: formCurrency,
        category: formCategory as ExpenseCategory,
        date: formDate,
        month: monthKey,
        status: formStatus === 'cobrado' ? 'pagado' : (formStatus as 'pagado' | 'pendiente'),
        projectId: linkedProj ? linkedProj.id : undefined,
        projectName: linkedProj ? linkedProj.clientName : undefined,
        notes: formNotes.trim() || undefined,
      });
    }

    // Reset Form
    setFormTitle('');
    setFormAmount('');
    setFormNotes('');
    setShowInlineAddMovement(false);
  };

  // Submit Recurring Plan
  const handleSubmitRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recTitle.trim() || !recAmount || Number(recAmount) <= 0) return;

    hapticFeedback.success();
    playItemCreated();
    const linkedProj = projects.find(p => p.id === recProjectId);

    const newPlan: RecurringIncomePlan = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: recTitle.trim(),
      amount: Number(recAmount),
      currency: recCurrency,
      frequency: recFrequency,
      startDate: recStartDate,
      nextDueDate: recStartDate,
      active: true,
      projectId: linkedProj ? linkedProj.id : undefined,
      clientName: linkedProj ? linkedProj.clientName : undefined,
      createdAt: getTodayString(),
    };

    if (linkedProj) {
      const existing = linkedProj.recurringPlans || [];
      onUpdateProject(linkedProj.id, {
        recurringPlans: [...existing, newPlan],
      });
    }

    setRecTitle('');
    setRecAmount('');
    setShowInlineAddRecurring(false);
  };

  // Monthly Filtered Data
  const targetMonthKey = selectedMonth === 'all' ? null : `${selectedYear}-${selectedMonth}`;

  const monthIncomes = useMemo(() => {
    return incomes.filter(inc => {
      const m = inc.month || getMonthKey(inc.date);
      if (targetMonthKey) return m === targetMonthKey;
      return m.startsWith(String(selectedYear));
    });
  }, [incomes, targetMonthKey, selectedYear]);

  const pendingInvoiceCount = useMemo(() => {
    return monthIncomes.filter(inc => !inc.facturado && inc.status === 'cobrado').length;
  }, [monthIncomes]);

  const displayedIncomes = useMemo(() => {
    if (invoicingFilter === 'pending') {
      return monthIncomes.filter(inc => !inc.facturado);
    }
    if (invoicingFilter === 'invoiced') {
      return monthIncomes.filter(inc => !!inc.facturado);
    }
    return monthIncomes;
  }, [monthIncomes, invoicingFilter]);

  const monthExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const m = exp.month || getMonthKey(exp.date);
      if (targetMonthKey) return m === targetMonthKey;
      return m.startsWith(String(selectedYear));
    });
  }, [expenses, targetMonthKey, selectedYear]);

  // Extract all pending commitments for the selected month across all projects
  const monthPendingCommitments = useMemo(() => {
    const list: { commitment: FlexiblePaymentCommitment; project: Project }[] = [];
    projects.forEach(proj => {
      const fin = calculateProjectFinancials(proj, incomes);
      fin.commitments.forEach(c => {
        const m = getMonthKey(c.dueDate);
        const match = targetMonthKey ? m === targetMonthKey : m.startsWith(String(selectedYear));
        if (match && c.status !== 'cobrado') {
          list.push({ commitment: c, project: proj });
        }
      });
    });
    return list;
  }, [projects, incomes, targetMonthKey, selectedYear]);

  // Monthly Overview Totals Powered by Shared monthlyCashProjection Helper
  const cashProjection = useMemo(() => {
    return calculateMonthlyCashProjection({
      monthKey: targetMonthKey || 'all',
      year: selectedYear,
      incomes,
      projects,
      expenses,
      usdRate,
    });
  }, [targetMonthKey, selectedYear, incomes, projects, expenses, usdRate]);

  const monthlyTotals = useMemo(() => {
    return {
      cobradoARS: cashProjection.cobradoARS,
      cobradoUSD: cashProjection.cobradoUSD,
      porCobrarARS: cashProjection.porCobrarARS,
      porCobrarUSD: cashProjection.porCobrarUSD,
      retainersARS: cashProjection.retainersARS,
      retainersUSD: cashProjection.retainersUSD,
      gastosARS: cashProjection.gastosARS,
      gastosUSD: cashProjection.gastosUSD,
      netoARS: cashProjection.netoARS,
      netoUSD: cashProjection.netoUSD,
      totalMesARS: cashProjection.totalMesARS,
      totalMesUSD: cashProjection.totalMesUSD,
    };
  }, [cashProjection]);

  // Format money helper
  const fmt = (amount: number, currency: 'USD' | 'ARS') => {
    if (privacyMode) return '••••';
    if (currency === 'USD') {
      return `US$ ${amount.toLocaleString('es-AR')}`;
    }
    return `$ ${amount.toLocaleString('es-AR')}`;
  };

  // Helper to apply a flexible schedule template to a project
  const handleApplyTemplateToProject = (project: Project, template: ScheduleTemplateType) => {
    hapticFeedback.medium();
    const amount = Number(project.montoAcordado ?? project.estimatedPrice ?? 0);
    const currency = project.estimatedCurrency || 'USD';
    const schedule = generateFlexibleSchedule({
      template,
      totalAmount: amount,
      currency,
      startDate: project.startDate || today,
      projectId: project.id,
      clientName: project.clientName,
    });
    onUpdateProject(project.id, {
      paymentCommitments: schedule,
    });
  };

  // Helper to add a custom commitment to a project
  const handleAddCustomCommitment = (project: Project) => {
    hapticFeedback.light();
    const fin = calculateProjectFinancials(project, incomes);
    const current = fin.commitments;
    const newCommitment: FlexiblePaymentCommitment = {
      id: `cmt_${Date.now()}_${current.length + 1}`,
      title: `Compromiso ${current.length + 1}`,
      dueDate: today,
      amount: fin.saldoPendiente > 0 ? fin.saldoPendiente : 0,
      currency: project.estimatedCurrency || 'USD',
      status: 'pendiente',
      projectId: project.id,
      clientName: project.clientName,
    };
    onUpdateProject(project.id, {
      paymentCommitments: [...current, newCommitment],
    });
  };

  // Helper to delete a commitment
  const handleDeleteCommitment = (project: Project, commitmentId: string) => {
    hapticFeedback.selection();
    const fin = calculateProjectFinancials(project, incomes);
    const updated = fin.commitments.filter(c => c.id !== commitmentId);
    onUpdateProject(project.id, {
      paymentCommitments: updated,
    });
  };

  // Helper to update a commitment inline
  const handleUpdateCommitment = (project: Project, commitmentId: string, updates: Partial<FlexiblePaymentCommitment>) => {
    const fin = calculateProjectFinancials(project, incomes);
    const updated = fin.commitments.map(c => {
      if (c.id === commitmentId) {
        const merged = { ...c, ...updates };
        return {
          ...merged,
          status: calculateCommitmentStatus(merged),
        };
      }
      return c;
    });
    onUpdateProject(project.id, {
      paymentCommitments: updated,
    });
  };

  // Quick Register Payment from Commitment
  const handleRegisterPaymentFromCommitment = (project: Project, commitment: FlexiblePaymentCommitment) => {
    hapticFeedback.success();
    playTaskDone();
    const amountToPay = Math.max(0, Number(commitment.amount) - Number(commitment.amountPaid || 0));
    if (amountToPay <= 0) return;

    // Create Income Record
    onAddIncome({
      title: `${project.clientName} · ${commitment.title}`,
      concept: commitment.title,
      amount: amountToPay,
      currency: commitment.currency || project.estimatedCurrency || 'USD',
      date: today,
      month: getMonthKey(today),
      status: 'cobrado',
      projectId: project.id,
      projectName: project.clientName,
      commitmentId: commitment.id,
    });

    // Mark commitment paid
    handleUpdateCommitment(project, commitment.id, {
      amountPaid: commitment.amount,
      paid: true,
      paidAt: today,
      status: 'cobrado',
    });
  };

  // Badge render for commitment status
  const renderStatusBadge = (status?: PaymentCommitmentStatus) => {
    switch (status) {
      case 'cobrado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 inline-flex items-center gap-1">
            <Check className="w-2.5 h-2.5" /> Cobrado
          </span>
        );
      case 'parcial':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 inline-flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> Parcial
          </span>
        );
      case 'atrasado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/10 text-red-500 border border-red-500/20 inline-flex items-center gap-1">
            <AlertCircle className="w-2.5 h-2.5" /> Atrasado
          </span>
        );
      case 'pendiente':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 inline-flex items-center gap-1">
            <Circle className="w-2 h-2" /> Pendiente
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-5 pb-20">
      {/* 1. Header & Navigation Control Strip */}
      <div className="card-swiss p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="label-swiss text-[11px] font-bold">Finanzas Flexibles</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
              {selectedMonth === 'all' ? `Todo el año ${selectedYear}` : formatMonthTitle(`${selectedYear}-${selectedMonth}`)}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-heading tracking-tight mt-1">
            Control de Caja, Compromisos & Proyecciones
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Movimientos libres sin ataduras, cronogramas 100% editables y cálculo automático de saldos.
          </p>
        </div>

        {/* Year / Month Selector Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Year Switcher */}
          <div className="flex items-center bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle)] p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setSelectedYear(y => y - 1)}
              className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
              title="Año anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-bold text-[var(--text-primary)]">{selectedYear}</span>
            <button
              type="button"
              onClick={() => setSelectedYear(y => y + 1)}
              className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
              title="Año siguiente"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Month Switcher */}
          <div className="flex items-center bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle)] p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
              title="Mes anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-[var(--text-primary)] px-1 focus:outline-none cursor-pointer"
            >
              {MONTH_NAMES.map((name, i) => {
                const mStr = String(i + 1).padStart(2, '0');
                return (
                  <option key={mStr} value={mStr} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                    {name}
                  </option>
                );
              })}
              <option value="all" className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                Todo el año
              </option>
            </select>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
              title="Mes siguiente"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Generar Informe Ejecutivo (1-Clic) */}
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setShowReportModal(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-2xs"
            title="Generar Resumen Ejecutivo Mensual para WhatsApp o Archivo"
          >
            <FileText className="w-3.5 h-3.5 text-[#E8590C]" />
            <span className="hidden sm:inline">Informe Ejecutivo</span>
            <span className="sm:hidden">Informe</span>
          </button>
        </div>
      </div>

      {/* 2. Monthly Summary Overview Cards (Cobrado · Por cobrar · Gastos · Neto) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Cobrado */}
        <div className="card-swiss p-4 space-y-1 bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <span>Cobrado</span>
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div className="space-y-0.5 pt-1">
            <div className="text-lg sm:text-xl font-bold font-mono text-[var(--text-primary)]">
              {fmt(monthlyTotals.cobradoUSD, 'USD')}
            </div>
            {monthlyTotals.cobradoARS > 0 && (
              <div className="text-xs font-mono text-[var(--text-secondary)]">
                + {fmt(monthlyTotals.cobradoARS, 'ARS')}
              </div>
            )}
          </div>
        </div>

        {/* Por Cobrar */}
        <div className="card-swiss p-4 space-y-1 bg-blue-500/5 border-blue-500/20">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider">
            <span>Por Cobrar</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="space-y-0.5 pt-1">
            <div className="text-lg sm:text-xl font-bold font-mono text-[var(--text-primary)]">
              {fmt(monthlyTotals.porCobrarUSD, 'USD')}
            </div>
            {monthlyTotals.porCobrarARS > 0 && (
              <div className="text-xs font-mono text-[var(--text-secondary)]">
                + {fmt(monthlyTotals.porCobrarARS, 'ARS')}
              </div>
            )}
          </div>
        </div>

        {/* Gastos */}
        <div className="card-swiss p-4 space-y-1 bg-red-500/5 border-red-500/20">
          <div className="flex items-center justify-between text-red-600 dark:text-red-400 text-xs font-semibold uppercase tracking-wider">
            <span>Gastos</span>
            <TrendingDown className="w-3.5 h-3.5" />
          </div>
          <div className="space-y-0.5 pt-1">
            <div className="text-lg sm:text-xl font-bold font-mono text-[var(--text-primary)]">
              {fmt(monthlyTotals.gastosUSD, 'USD')}
            </div>
            {monthlyTotals.gastosARS > 0 && (
              <div className="text-xs font-mono text-[var(--text-secondary)]">
                + {fmt(monthlyTotals.gastosARS, 'ARS')}
              </div>
            )}
          </div>
        </div>

        {/* Neto */}
        <div className="card-swiss p-4 space-y-1 bg-[var(--bg-surface)]">
          <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider">
            <span>Resultado Neto</span>
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <div className="space-y-0.5 pt-1">
            <div className={`text-lg sm:text-xl font-bold font-mono ${
              monthlyTotals.netoUSD >= 0 ? 'text-emerald-500' : 'text-red-500'
            }`}>
              {fmt(monthlyTotals.netoUSD, 'USD')}
            </div>
            {monthlyTotals.netoARS !== 0 && (
              <div className={`text-xs font-mono ${monthlyTotals.netoARS >= 0 ? 'text-emerald-600' : 'text-red-400'}`}>
                {monthlyTotals.netoARS >= 0 ? '+' : ''}{fmt(monthlyTotals.netoARS, 'ARS')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Sub-tabs Switcher */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-xs overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            setSubTab('resumen');
          }}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer shrink-0 ${
            subTab === 'resumen'
              ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-semibold shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Resumen Mensual
        </button>

        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            setSubTab('movimientos');
          }}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer shrink-0 ${
            subTab === 'movimientos'
              ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-semibold shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Movimientos Libres
        </button>

        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            setSubTab('cronogramas');
          }}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer shrink-0 ${
            subTab === 'cronogramas'
              ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-semibold shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Cronogramas por Proyecto
        </button>

        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            setSubTab('recurrentes');
          }}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer shrink-0 ${
            subTab === 'recurrentes'
              ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-semibold shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Abonos Recurrentes
        </button>

        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            setSubTab('gastos-fijos');
          }}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer shrink-0 flex items-center gap-1.5 ${
            subTab === 'gastos-fijos'
              ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-semibold shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span>Gastos Fijos & Vencimientos</span>
          {urgentFixedExpensesList.length > 0 ? (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[9.5px] font-bold">
              {urgentFixedExpensesList.length}
            </span>
          ) : (
            <span className="text-[10px] opacity-75 font-mono">
              ({studioFixedExpenses.length})
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            setSubTab('proyeccion');
          }}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer shrink-0 ${
            subTab === 'proyeccion'
              ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-semibold shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Proyección Cashflow
        </button>

        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            setSubTab('presupuestos');
          }}
          className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer shrink-0 ${
            subTab === 'presupuestos'
              ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-semibold shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Presupuestos de Gasto
        </button>
      </div>

      {/* 4. Subtab Body 0: RESUMEN MENSUAL Y COBROS (4 Big Numbers, Chart & Urgency Client List) */}
      {subTab === 'resumen' && (
        <div className="space-y-4">
          {/* Banner de Vencimientos Próximos de Gastos Fijos (Hosting, Dominios, IAs) */}
          {urgentFixedExpensesList.length > 0 && (
            <div className="card-swiss p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-amber-300">
                    {urgentFixedExpensesList.length} servicio{urgentFixedExpensesList.length > 1 ? 's' : ''} vence{urgentFixedExpensesList.length > 1 ? 'n' : ''} en los próximos 30 días
                  </div>
                  <div className="text-[11px] text-amber-400/80 truncate">
                    {urgentFixedExpensesList.map(u => `${u.name} (${u.nextDueDate})`).join(' · ')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setSubTab('gastos-fijos');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shrink-0 cursor-pointer transition active:scale-95 shadow-xs"
              >
                Ver Gastos Fijos & Renovar →
              </button>
            </div>
          )}

          <StudioMonthlyRevenueOverview
            projects={projects}
            incomes={incomes}
            privacyMode={privacyMode}
            usdRate={usdRate}
            onNavigateToProject={(id) => {
              const p = projects.find(x => x.id === id);
              if (p && onOpenProject360) onOpenProject360(p);
            }}
            onRegisterPaymentForProject={(p) => {
              setSelectedProjectForPayment(p);
              setShowRegisterPaymentModal(true);
            }}
          />

          {/* Tarjeta de Acceso Rápido a Gastos Fijos, Dominios & IAs */}
          <div className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border-[var(--border-subtle)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Gastos Fijos del Estudio & Vencimientos
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Dominios de clientes pasados, suscripciones de IA (ChatGPT, Claude, Cursor) y Hosting anual
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.selection();
                  setSubTab('gastos-fijos');
                }}
                className="btn-solid-primary px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <span>Administrar Gastos Fijos & Dominios →</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {/* Suscripciones IA */}
              <div className="p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
                <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase block">Suscripciones IA</span>
                <span className="text-xs font-bold text-purple-400 font-mono">
                  {privacyMode ? '$ •••' : (() => {
                    const iaUSD = studioFixedExpenses.filter(e => e.active && e.category === 'ia' && e.currency === 'USD').reduce((acc, curr) => acc + curr.amount, 0);
                    const iaARS = studioFixedExpenses.filter(e => e.active && e.category === 'ia' && e.currency === 'ARS').reduce((acc, curr) => acc + curr.amount, 0);
                    if (iaUSD === 0 && iaARS === 0) return '$0/mes';
                    return `${iaUSD > 0 ? `u$s ${iaUSD}` : ''}${iaUSD > 0 && iaARS > 0 ? ' + ' : ''}${iaARS > 0 ? `$${iaARS.toLocaleString('es-AR')}` : ''}/mes`;
                  })()}
                </span>
                <span className="text-[9.5px] text-[var(--text-tertiary)] block mt-0.5">ChatGPT, Claude, Cursor</span>
              </div>

              {/* Dominios Clientes */}
              <div className="p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
                <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase block">Dominios Clientes</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  {privacyMode ? '$ •••' : (() => {
                    const domUSD = studioFixedExpenses.filter(e => e.active && e.category === 'dominios' && e.currency === 'USD').reduce((acc, curr) => acc + curr.amount, 0);
                    const domARS = studioFixedExpenses.filter(e => e.active && e.category === 'dominios' && e.currency === 'ARS').reduce((acc, curr) => acc + curr.amount, 0);
                    const count = studioFixedExpenses.filter(e => e.active && e.category === 'dominios').length;
                    if (domUSD === 0 && domARS === 0) return `${count} registrados ($0)`;
                    return `${domARS > 0 ? `$${domARS.toLocaleString('es-AR')}` : ''}${domARS > 0 && domUSD > 0 ? ' + ' : ''}${domUSD > 0 ? `u$s ${domUSD}` : ''} (${count})`;
                  })()}
                </span>
                <span className="text-[9.5px] text-[var(--text-tertiary)] block mt-0.5">Suma total dominios</span>
              </div>

              {/* Hosting & Nube */}
              <div className="p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
                <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase block">Hosting & Nube</span>
                <span className="text-xs font-bold text-sky-400 font-mono">
                  {privacyMode ? '$ •••' : (() => {
                    const hostUSD = studioFixedExpenses.filter(e => e.active && e.category === 'hosting' && e.currency === 'USD').reduce((acc, curr) => acc + curr.amount, 0);
                    const hostARS = studioFixedExpenses.filter(e => e.active && e.category === 'hosting' && e.currency === 'ARS').reduce((acc, curr) => acc + curr.amount, 0);
                    const count = studioFixedExpenses.filter(e => e.active && e.category === 'hosting').length;
                    if (hostUSD === 0 && hostARS === 0) return `${count} servicios ($0)`;
                    return `${hostUSD > 0 ? `u$s ${hostUSD}` : ''}${hostUSD > 0 && hostARS > 0 ? ' + ' : ''}${hostARS > 0 ? `$${hostARS.toLocaleString('es-AR')}` : ''} (${count})`;
                  })()}
                </span>
                <span className="text-[9.5px] text-[var(--text-tertiary)] block mt-0.5">Hostinger Anual & VPS</span>
              </div>

              {/* Próximos Vencimientos */}
              <div className="p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
                <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase block">Próximos Vencimientos</span>
                <span className="text-xs font-bold text-amber-400 font-mono">
                  {privacyMode ? '$ •••' : (() => {
                    if (urgentFixedExpensesList.length === 0) return 'Al día ($0)';
                    const urgUSD = urgentFixedExpensesList.filter(e => e.currency === 'USD').reduce((acc, curr) => acc + curr.amount, 0);
                    const urgARS = urgentFixedExpensesList.filter(e => e.currency === 'ARS').reduce((acc, curr) => acc + curr.amount, 0);
                    const moneyStr = `${urgARS > 0 ? `$${urgARS.toLocaleString('es-AR')}` : ''}${urgARS > 0 && urgUSD > 0 ? ' + ' : ''}${urgUSD > 0 ? `u$s ${urgUSD}` : ''}`;
                    return `${urgentFixedExpensesList.length} en <30d (${moneyStr})`;
                  })()}
                </span>
                <span className="text-[9.5px] text-[var(--text-tertiary)] block mt-0.5">Suma a renovar pronto</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Subtab Body 1: MOVIMIENTOS LIBRES */}
      {subTab === 'movimientos' && (
        <div className="space-y-4">
          {/* Movement Type Toggle & Invoicing Filter & Add Trigger */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex p-0.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-xs">
                <button
                  type="button"
                  onClick={() => setMovementType('ingresos')}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                    movementType === 'ingresos'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Ingresos ({monthIncomes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType('gastos')}
                  className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                    movementType === 'gastos'
                      ? 'bg-rose-600 text-white font-bold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Gastos ({monthExpenses.length})
                </button>
              </div>

              {/* Facturación Filter (for Incomes) */}
              {movementType === 'ingresos' && (
                <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-xs">
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)] px-1.5 uppercase font-bold hidden sm:inline">
                    Facturación:
                  </span>
                  <button
                    type="button"
                    onClick={() => setInvoicingFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                      invoicingFilter === 'all'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoicingFilter('pending')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer flex items-center gap-1.5 ${
                      invoicingFilter === 'pending'
                        ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30'
                        : 'text-[var(--text-secondary)] hover:text-amber-400'
                    }`}
                  >
                    <span>Pendientes</span>
                    {pendingInvoiceCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[9px] font-bold">
                        {pendingInvoiceCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoicingFilter('invoiced')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                      invoicingFilter === 'invoiced'
                        ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                        : 'text-[var(--text-secondary)] hover:text-emerald-400'
                    }`}
                  >
                    Facturados
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setShowInlineAddMovement(prev => !prev);
              }}
              className="btn-solid-primary py-2 px-4 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{movementType === 'ingresos' ? '+ Nuevo Ingreso Libre' : '+ Nuevo Gasto'}</span>
            </button>
          </div>

          {/* INLINE ADD MOVEMENT PANEL (NO POPUPS) */}
          {showInlineAddMovement && (
            <form onSubmit={handleSubmitMovement} className="card-swiss p-4 sm:p-5 space-y-4 bg-[var(--bg-surface)] border-[var(--text-primary)] animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-[var(--border-divider)] pb-2">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--text-primary)]">
                  Registrar {movementType === 'ingresos' ? 'Ingreso Libre' : 'Gasto'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowInlineAddMovement(false)}
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Concept / Title */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Concepto / Descripción:</label>
                  <input
                    type="text"
                    required
                    placeholder={movementType === 'ingresos' ? 'Ej: Mantenimiento web mensual, Setup Meta Ads, Landing Page' : 'Ej: Servidor Vercel, Inversión Meta Ads, Licencia Figma'}
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Monto:</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                  />
                </div>

                {/* Currency */}
                <div>
                  <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Moneda:</label>
                  <select
                    value={formCurrency}
                    onChange={e => setFormCurrency(e.target.value as 'USD' | 'ARS')}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="USD">USD (Dólares)</option>
                    <option value="ARS">ARS (Pesos)</option>
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Fecha:</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                {/* Optional Project Link */}
                <div>
                  <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Proyecto / Cliente (Opcional):</label>
                  <select
                    value={formProjectId}
                    onChange={e => setFormProjectId(e.target.value)}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">— Ninguno (Cobro suelto / libre) —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.clientName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Categoría:</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    {(movementType === 'ingresos' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                {movementType === 'ingresos' ? (
                  <div>
                    <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Estado del Cobro:</label>
                    <select
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value as any)}
                      className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
                    >
                      <option value="cobrado">Cobrado / Recibido</option>
                      <option value="pendiente">Pendiente de cobro</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Estado del Gasto:</label>
                    <select
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value as any)}
                      className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
                    >
                      <option value="cobrado">Pagado</option>
                      <option value="pendiente">Pendiente de pago</option>
                    </select>
                  </div>
                )}

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Notas (Opcional):</label>
                  <input
                    type="text"
                    placeholder="Detalles, comprobante, referencia..."
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowInlineAddMovement(false)}
                  className="btn-swiss-secondary py-1.5 px-3 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-solid-primary py-1.5 px-4 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Guardar {movementType === 'ingresos' ? 'Ingreso' : 'Gasto'}
                </button>
              </div>
            </form>
          )}

          {/* Movements List Table */}
          <div className="card-swiss overflow-hidden">
            <div className="divide-y divide-[var(--border-subtle)]">
              {(movementType === 'ingresos' ? displayedIncomes : monthExpenses).length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-tertiary)]">
                  {movementType === 'ingresos' && invoicingFilter !== 'all'
                    ? `No hay ingresos ${invoicingFilter === 'pending' ? 'pendientes de facturar' : 'facturados'} en este período.`
                    : `No hay ${movementType} registrados para este período.`}
                </div>
              ) : (
                (movementType === 'ingresos' ? displayedIncomes : monthExpenses).map(item => {
                  const isIncome = movementType === 'ingresos';
                  const isDone = isIncome 
                    ? (item as IncomeRecord).status === 'cobrado'
                    : (item as ExpenseRecord).status === 'pagado';
                  const incRecord = isIncome ? (item as IncomeRecord) : null;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-[var(--bg-surface-muted)]/40 transition text-xs"
                    >
                      {/* Checkbox and Details */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => {
                            hapticFeedback.light();
                            if (isIncome) {
                              onUpdateIncome(item.id, {
                                status: (item as IncomeRecord).status === 'cobrado' ? 'pendiente' : 'cobrado'
                              });
                            } else {
                              onUpdateExpense(item.id, {
                                status: (item as ExpenseRecord).status === 'pagado' ? 'pendiente' : 'pagado'
                              });
                            }
                          }}
                          className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)] shrink-0"
                          title={isDone ? 'Marcar como pendiente' : 'Marcar como cobrado/pagado'}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/10" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[var(--text-primary)] truncate">
                              {item.title}
                            </span>
                            {/* Facturación Badge for Income */}
                            {incRecord && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  hapticFeedback.light();
                                  onUpdateIncome(incRecord.id, { facturado: !incRecord.facturado });
                                }}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition active:scale-95 ${
                                  incRecord.facturado
                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20'
                                }`}
                                title="Clic para alternar estado de facturación"
                              >
                                <FileText className="w-2.5 h-2.5" />
                                <span>{incRecord.facturado ? 'Facturado' : 'Pend. facturar'}</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)] font-mono mt-0.5 flex-wrap">
                            <span>{item.date}</span>
                            {item.projectName && (
                              <span className="px-1.5 py-0.2 rounded bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                                {item.projectName}
                              </span>
                            )}
                            {(item as ExpenseRecord).category && (
                              <span>· {(item as ExpenseRecord).category}</span>
                            )}
                            {item.notes && <span>· {item.notes}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Amount and Delete */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className={`font-mono font-bold text-sm ${
                          isDone ? (isIncome ? 'text-emerald-500' : 'text-red-500') : 'text-[var(--text-secondary)]'
                        }`}>
                          {fmt(item.amount, item.currency)}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            hapticFeedback.selection();
                            playItemDeleted();
                            if (isIncome) onDeleteIncome(item.id);
                            else onDeleteExpense(item.id);
                          }}
                          className="p-1 text-[var(--text-tertiary)] hover:text-red-500 rounded transition cursor-pointer"
                          title="Eliminar movimiento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Subtab Body 2: CRONOGRAMAS POR PROYECTO & SALDO AUTOMÁTICO */}
      {subTab === 'cronogramas' && (
        <div className="space-y-4">
          <div className="text-xs text-[var(--text-secondary)]">
            Cada proyecto tiene un <strong>Monto Acordado</strong> y el saldo pendiente se recalcula automáticamente restando los pagos cobrados. Puedes configurar hitos, cuotas o trabajar libremente sin cronograma.
          </div>

          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="card-swiss p-8 text-center text-xs text-[var(--text-tertiary)]">
                No hay proyectos creados aún.
              </div>
            ) : (
              projects.map(proj => {
                const fin = calculateProjectFinancials(proj, incomes);
                const isExpanded = expandedProjectId === proj.id;

                return (
                  <div key={proj.id} className="card-swiss overflow-hidden">
                    {/* Project Financial Header Card */}
                    <div 
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-[var(--bg-surface-muted)]/30 transition"
                      onClick={() => setExpandedProjectId(isExpanded ? null : proj.id)}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
                          <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading truncate">
                            {proj.clientName}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-secondary)]">
                          <span>Acordado: <strong className="text-[var(--text-primary)]">{fmt(fin.montoAcordado, fin.currency)}</strong></span>
                          <span>· Cobrado: <strong className="text-emerald-500">{fmt(fin.totalCobrado, fin.currency)}</strong></span>
                          <span>· Saldo: <strong className={fin.saldoPendiente > 0 ? 'text-blue-500' : 'text-zinc-400'}>{fmt(fin.saldoPendiente, fin.currency)}</strong></span>
                        </div>
                      </div>

                      {/* Reusable ProjectPaymentProgressBar + Registrar Pago Button */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                        <div className="w-48 sm:w-56" onClick={e => e.stopPropagation()}>
                          <ProjectPaymentProgressBar project={proj} incomes={incomes} compact={true} />
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              hapticFeedback.light();
                              setSelectedProjectForPayment(proj);
                              setShowRegisterPaymentModal(true);
                            }}
                            className="btn-solid-primary py-1 px-2.5 text-[11px] rounded-lg flex items-center gap-1 cursor-pointer"
                            title="Registrar pago a este proyecto"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Cobro</span>
                          </button>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />}
                        </div>
                      </div>
                    </div>

                    {/* EXPANDED INLINE SCHEDULE EDITOR */}
                    {isExpanded && (
                      <div className="p-4 pt-2 border-t border-[var(--border-subtle)] bg-[var(--bg-app)]/50 space-y-4 animate-in fade-in duration-100">
                        {/* Monto Acordado input & Template quick-starts */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-[var(--text-secondary)]">Monto Acordado:</label>
                            <input
                              type="number"
                              min="0"
                              value={proj.montoAcordado ?? proj.estimatedPrice ?? ''}
                              onChange={e => {
                                const val = Number(e.target.value);
                                onUpdateProject(proj.id, { montoAcordado: val });
                              }}
                              className="w-32 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-[var(--text-primary)] focus:outline-none"
                            />
                            <span className="text-xs font-mono text-[var(--text-tertiary)]">{fin.currency}</span>
                          </div>

                          {/* Template Starter Chips */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono uppercase text-[var(--text-tertiary)] mr-1">Plantilla:</span>
                            <button
                              type="button"
                              onClick={() => handleApplyTemplateToProject(proj, 'pago_unico')}
                              className="px-2 py-0.5 rounded-md bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[10px] font-mono hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              100% Único
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyTemplateToProject(proj, 'dos_cuotas')}
                              className="px-2 py-0.5 rounded-md bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[10px] font-mono hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              50 / 50
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyTemplateToProject(proj, 'hitos_40_30_30')}
                              className="px-2 py-0.5 rounded-md bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[10px] font-mono hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              40 / 30 / 30
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyTemplateToProject(proj, 'mensual')}
                              className="px-2 py-0.5 rounded-md bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[10px] font-mono hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              Mensual (3m)
                            </button>
                          </div>
                        </div>

                        {/* Commitments Table / List */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
                            <span>Cronograma de Pagos / Hitos ({fin.commitments.length})</span>
                            <button
                              type="button"
                              onClick={() => handleAddCustomCommitment(proj)}
                              className="btn-swiss-secondary py-1 px-2.5 text-[11px] rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+ Agregar Cuota</span>
                            </button>
                          </div>

                          {fin.commitments.length === 0 ? (
                            <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center text-xs text-[var(--text-tertiary)]">
                              Sin cronograma pactado. Puedes aplicar una plantilla arriba o registrar pagos sueltos.
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {fin.commitments.map((cmt, idx) => (
                                <div
                                  key={cmt.id}
                                  className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                >
                                  {/* Inputs: Title, DueDate, Amount */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                                    <input
                                      type="text"
                                      value={cmt.title}
                                      onChange={e => handleUpdateCommitment(proj, cmt.id, { title: e.target.value })}
                                      placeholder="Concepto..."
                                      className="bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] focus:outline-none"
                                    />
                                    <input
                                      type="date"
                                      value={cmt.dueDate}
                                      onChange={e => handleUpdateCommitment(proj, cmt.id, { dueDate: e.target.value })}
                                      className="bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1 text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                                    />
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min="0"
                                        value={cmt.amount}
                                        onChange={e => handleUpdateCommitment(proj, cmt.id, { amount: Number(e.target.value) })}
                                        className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-[var(--text-primary)] focus:outline-none"
                                      />
                                      <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{cmt.currency || fin.currency}</span>
                                    </div>
                                  </div>

                                  {/* Status badge & Quick Register Payment CTA */}
                                  <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0 pt-1 sm:pt-0">
                                    {renderStatusBadge(cmt.status)}

                                    {cmt.status !== 'cobrado' && (
                                      <button
                                        type="button"
                                        onClick={() => handleRegisterPaymentFromCommitment(proj, cmt)}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center gap-1 transition cursor-pointer shadow-xs"
                                        title="Registrar cobro de esta cuota"
                                      >
                                        <Check className="w-3 h-3" />
                                        <span>Cobrar</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCommitment(proj, cmt.id)}
                                      className="p-1 text-[var(--text-tertiary)] hover:text-red-500 rounded transition cursor-pointer"
                                      title="Borrar cuota"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 6. Subtab Body 3: ABONOS RECURRENTES */}
      {subTab === 'recurrentes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-[var(--text-secondary)]">
              Abonos fijos periódicos (mantenimientos, retainers SEO/consultoría) con ajuste de tarifa e historial.
            </div>

            <button
              type="button"
              onClick={() => setShowInlineAddRecurring(prev => !prev)}
              className="btn-solid-primary py-2 px-4 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Abono Recurrente</span>
            </button>
          </div>

          {/* INLINE ADD RECURRING FORM */}
          {showInlineAddRecurring && (
            <form onSubmit={handleSubmitRecurring} className="card-swiss p-4 sm:p-5 space-y-4 bg-[var(--bg-surface)] border-[var(--text-primary)] animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-[var(--border-divider)] pb-2">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--text-primary)]">
                  Nuevo Abono Recurrente
                </h3>
                <button
                  type="button"
                  onClick={() => setShowInlineAddRecurring(false)}
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Nombre del Abono:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Mantenimiento Web Estudio Cane"
                    value={recTitle}
                    onChange={e => setRecTitle(e.target.value)}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Monto por período:</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="0.00"
                    value={recAmount}
                    onChange={e => setRecAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Frecuencia:</label>
                  <select
                    value={recFrequency}
                    onChange={e => setRecFrequency(e.target.value as RecurringFrequency)}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="mensual">Mensual (cada 30 días)</option>
                    <option value="quincenal">Quincenal (cada 15 días)</option>
                    <option value="semanal">Semanal (cada 7 días)</option>
                    <option value="bimestral">Bimestral (cada 2 meses)</option>
                    <option value="trimestral">Trimestral (cada 3 meses)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Fecha Primer Cobro:</label>
                  <input
                    type="date"
                    required
                    value={recStartDate}
                    onChange={e => setRecStartDate(e.target.value)}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Vincular a Proyecto:</label>
                  <select
                    value={recProjectId}
                    onChange={e => setRecProjectId(e.target.value)}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">— Ninguno (Abono libre) —</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.clientName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowInlineAddRecurring(false)}
                  className="btn-swiss-secondary py-1.5 px-3 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-solid-primary py-1.5 px-4 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Crear Abono
                </button>
              </div>
            </form>
          )}

          {/* List of Recurring Plans across projects */}
          <div className="space-y-3">
            {projects.flatMap(p => (p.recurringPlans || []).map(r => ({ plan: r, project: p }))).length === 0 ? (
              <div className="card-swiss p-8 text-center text-xs text-[var(--text-tertiary)]">
                No hay abonos recurrentes activos.
              </div>
            ) : (
              projects.flatMap(p => (p.recurringPlans || []).map(r => ({ plan: r, project: p }))).map(({ plan, project }) => (
                <div key={plan.id} className="card-swiss p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Repeat className="w-4 h-4 text-emerald-500" />
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">{plan.title}</h4>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[var(--bg-app)] border border-[var(--border-subtle)] capitalize">
                        {plan.frequency}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-[var(--text-secondary)]">
                      Cliente: <strong>{project.clientName}</strong> · Próximo cobro: {plan.nextDueDate}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right font-mono">
                      <div className="text-sm font-bold text-emerald-500">{fmt(plan.amount, plan.currency)}</div>
                      <div className="text-[10px] text-[var(--text-tertiary)]">por período</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.success();
                        playTaskDone();
                        // Register income for this month
                        onAddIncome({
                          title: `${project.clientName} · ${plan.title} (${plan.frequency})`,
                          amount: plan.amount,
                          currency: plan.currency,
                          date: today,
                          month: getMonthKey(today),
                          status: 'cobrado',
                          projectId: project.id,
                          projectName: project.clientName,
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title="Registrar cobro de este período"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Cobrar</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 6.5 Subtab Body: GASTOS FIJOS DEL ESTUDIO, HOSTING, DOMINIOS E IAS */}
      {subTab === 'gastos-fijos' && (
        <StudioFixedExpensesSection
          expenses={studioFixedExpenses}
          projects={projects}
          usdRate={usdRate}
          privacyMode={privacyMode}
          onAddFixedExpense={onAddFixedExpense}
          onUpdateFixedExpense={onUpdateFixedExpense}
          onDeleteFixedExpense={onDeleteFixedExpense}
          onRecordRealExpense={onAddExpense}
        />
      )}

      {/* 7. Subtab Body 4: PROYECCIÓN CASHFLOW */}
      {subTab === 'proyeccion' && (
        <ActiveClientsCashflowProjection
          projects={projects}
          incomes={incomes}
          onSelectProject={onOpenProject360}
          onUpdateProject={onUpdateProject}
          onToggleIncomeStatus={(id) => {
            const item = incomes.find(i => i.id === id);
            if (item) {
              onUpdateIncome(id, { status: item.status === 'cobrado' ? 'pendiente' : 'cobrado' });
            }
          }}
          privacyMode={privacyMode}
        />
      )}

      {/* 8. Subtab Body 5: PRESUPUESTOS DE GASTO */}
      {subTab === 'presupuestos' && (
        <CategoryBudgetManager
          expenses={expenses}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          privacyMode={privacyMode}
        />
      )}

      {/* Quick Register Payment Modal from /finanzas */}
      {selectedProjectForPayment && (
        <RegisterPaymentModal
          isOpen={showRegisterPaymentModal}
          onClose={() => {
            setShowRegisterPaymentModal(false);
            setSelectedProjectForPayment(null);
          }}
          project={selectedProjectForPayment}
          incomes={incomes}
          personalAccounts={personalAccounts}
          usdRate={usdRate}
          onSavePayment={(payment, options) => {
            if (onSavePayment) {
              onSavePayment(selectedProjectForPayment.id, payment, options);
            }
            setShowRegisterPaymentModal(false);
            setSelectedProjectForPayment(null);
          }}
          onDeletePayment={(paymentId) => {
            if (onDeletePayment) {
              onDeletePayment(selectedProjectForPayment.id, paymentId);
            }
          }}
        />
      )}

      {/* MODAL INFORME EJECUTIVO MENSUAL (1-CLIC WHATSAPP & DESCARGA) */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl flex flex-col max-h-[90vh] t-modal-enter">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#E8590C]/15 border border-[#E8590C]/30 flex items-center justify-center text-[#E8590C]">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">
                    Informe Ejecutivo — {selectedMonth === 'all' ? `Año ${selectedYear}` : formatMonthTitle(`${selectedYear}-${selectedMonth}`)}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Listo para compartir por WhatsApp o archivar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview Box */}
            <div className="flex-1 overflow-y-auto bg-zinc-950/80 rounded-2xl p-4 border border-zinc-800 font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed select-all">
              {(() => {
                const monthTitle = selectedMonth === 'all' ? `Año ${selectedYear}` : formatMonthTitle(`${selectedYear}-${selectedMonth}`);
                const lines = [
                  `📊 RESUMEN EJECUTIVO FINANCIERO — ${monthTitle.toUpperCase()}`,
                  `💼 .CERO CRM (Operador Único)`,
                  `📅 Fecha: ${today}`,
                  `──────────────────────────────────────────`,
                  `💰 COBRADO:`,
                  `   • USD: ${fmt(monthlyTotals.cobradoUSD, 'USD')}`,
                  `   • ARS: ${fmt(monthlyTotals.cobradoARS, 'ARS')}`,
                  ``,
                  `⏳ PENDIENTE POR COBRAR:`,
                  `   • USD: ${fmt(monthlyTotals.porCobrarUSD, 'USD')}`,
                  `   • ARS: ${fmt(monthlyTotals.porCobrarARS, 'ARS')}`,
                  ``,
                  `📉 GASTOS FIJOS / SERVICIOS:`,
                  `   • USD: ${fmt(monthlyTotals.gastosUSD, 'USD')}`,
                  `   • ARS: ${fmt(monthlyTotals.gastosARS, 'ARS')}`,
                  ``,
                  `🟢 SALDO NETO ESTIMADO:`,
                  `   • USD: ${fmt(monthlyTotals.netoUSD, 'USD')}`,
                  `   • ARS: ${fmt(monthlyTotals.netoARS, 'ARS')}`,
                  `──────────────────────────────────────────`,
                  `📁 CLIENTES ACTIVOS:`,
                  ...projects
                    .filter(p => p.status !== 'completado' && p.status !== 'cancelado')
                    .map(p => `   • ${p.clientName} (${p.status || 'Activo'})`),
                  `──────────────────────────────────────────`,
                  `Generado con .Cero CRM`
                ];
                return lines.join('\n');
              })()}
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const monthTitle = selectedMonth === 'all' ? `Año ${selectedYear}` : formatMonthTitle(`${selectedYear}-${selectedMonth}`);
                  const lines = [
                    `📊 RESUMEN EJECUTIVO FINANCIERO — ${monthTitle.toUpperCase()}`,
                    `💼 .CERO CRM (Operador Único)`,
                    `📅 Fecha: ${today}`,
                    `──────────────────────────────────────────`,
                    `💰 COBRADO:`,
                    `   • USD: ${fmt(monthlyTotals.cobradoUSD, 'USD')}`,
                    `   • ARS: ${fmt(monthlyTotals.cobradoARS, 'ARS')}`,
                    ``,
                    `⏳ PENDIENTE POR COBRAR:`,
                    `   • USD: ${fmt(monthlyTotals.porCobrarUSD, 'USD')}`,
                    `   • ARS: ${fmt(monthlyTotals.porCobrarARS, 'ARS')}`,
                    ``,
                    `📉 GASTOS FIJOS / SERVICIOS:`,
                    `   • USD: ${fmt(monthlyTotals.gastosUSD, 'USD')}`,
                    `   • ARS: ${fmt(monthlyTotals.gastosARS, 'ARS')}`,
                    ``,
                    `🟢 SALDO NETO ESTIMADO:`,
                    `   • USD: ${fmt(monthlyTotals.netoUSD, 'USD')}`,
                    `   • ARS: ${fmt(monthlyTotals.netoARS, 'ARS')}`,
                    `──────────────────────────────────────────`,
                    `📁 CLIENTES ACTIVOS:`,
                    ...projects
                      .filter(p => p.status !== 'completado' && p.status !== 'cancelado')
                      .map(p => `   • ${p.clientName} (${p.status || 'Activo'})`),
                    `──────────────────────────────────────────`,
                    `Generado con .Cero CRM`
                  ];
                  const text = lines.join('\n');
                  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `informe-financiero-${selectedYear}-${selectedMonth}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                  hapticFeedback.light();
                }}
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar .TXT</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const monthTitle = selectedMonth === 'all' ? `Año ${selectedYear}` : formatMonthTitle(`${selectedYear}-${selectedMonth}`);
                  const lines = [
                    `📊 RESUMEN EJECUTIVO FINANCIERO — ${monthTitle.toUpperCase()}`,
                    `💼 .CERO CRM (Operador Único)`,
                    `📅 Fecha: ${today}`,
                    `──────────────────────────────────────────`,
                    `💰 COBRADO:`,
                    `   • USD: ${fmt(monthlyTotals.cobradoUSD, 'USD')}`,
                    `   • ARS: ${fmt(monthlyTotals.cobradoARS, 'ARS')}`,
                    ``,
                    `⏳ PENDIENTE POR COBRAR:`,
                    `   • USD: ${fmt(monthlyTotals.porCobrarUSD, 'USD')}`,
                    `   • ARS: ${fmt(monthlyTotals.porCobrarARS, 'ARS')}`,
                    ``,
                    `📉 GASTOS FIJOS / SERVICIOS:`,
                    `   • USD: ${fmt(monthlyTotals.gastosUSD, 'USD')}`,
                    `   • ARS: ${fmt(monthlyTotals.gastosARS, 'ARS')}`,
                    ``,
                    `🟢 SALDO NETO ESTIMADO:`,
                    `   • USD: ${fmt(monthlyTotals.netoUSD, 'USD')}`,
                    `   • ARS: ${fmt(monthlyTotals.netoARS, 'ARS')}`,
                    `──────────────────────────────────────────`,
                    `📁 CLIENTES ACTIVOS:`,
                    ...projects
                      .filter(p => p.status !== 'completado' && p.status !== 'cancelado')
                      .map(p => `   • ${p.clientName} (${p.status || 'Activo'})`),
                    `──────────────────────────────────────────`,
                    `Generado con .Cero CRM`
                  ];
                  navigator.clipboard.writeText(lines.join('\n'));
                  hapticFeedback.success();
                  setCopiedReport(true);
                  setTimeout(() => setCopiedReport(false), 2500);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-lg shadow-emerald-600/25 cursor-pointer"
              >
                {copiedReport ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedReport ? '¡Copiado al Portapapeles!' : 'Copiar para WhatsApp'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncomeView;
