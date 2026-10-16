import React, { useState, useMemo } from 'react';
import { 
  Project, 
  AgendaTask, 
  AgendaMeeting, 
  IncomeRecord, 
  ExpenseRecord, 
  DEFAULT_PROJECT_STATUSES, 
  TimeLog,
  ProjectType,
  PafStage,
  PAF_STAGES,
  PafMilestone
} from '../types';
import { 
  FolderKanban, 
  Plus, 
  Archive, 
  ArchiveRestore, 
  Trash2, 
  Sparkles, 
  Edit3, 
  Check, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  X, 
  MessageCircle, 
  Phone, 
  PieChart, 
  CheckSquare, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Search, 
  Table, 
  LayoutGrid, 
  Briefcase, 
  ArrowUpRight, 
  ChevronRight,
  MapPin,
  Building2,
  Globe,
  PhoneCall,
  AlertTriangle,
  Target,
  Award,
  ListChecks,
  ChevronDown,
  Calculator,
  Compass,
  Handshake
} from 'lucide-react';
import { PafPricingConfigModal } from '../components/PafPricingConfigModal';
import { hapticFeedback } from '../utils/haptics';
import { formatWhatsAppUrl, formatTelUrl, extractPhoneFromText } from '../utils/contact';
import { getTodayString } from '../utils/storage';
import { toSafeDateString } from '../utils/dates';
import { ProjectFicha360Modal } from '../components/ProjectFicha360Modal';
import { DeliveriesRoadmap } from '../components/DeliveriesRoadmap';
import { PafDashboard } from '../components/PafDashboard';
import { InCallDrawer } from '../components/InCallDrawer';
import { ProjectTimelineBadge } from '../components/ProjectTimelineBadge';
import { ProjectHealthBadge } from '../components/ProjectHealthBadge';
import { taskBelongsToProject } from '../utils/taskProject';
import { ActiveClientsCashflowProjection } from '../components/ActiveClientsCashflowProjection';
import { NewPafClientModal } from '../components/NewPafClientModal';
import { addMonths, formatDisplayDate, calculateProjectTimeline } from '../utils/projectTimeline';
import { formatProjectPrice, resolveProjectCurrency, calculateClientPaymentHabits } from '../utils/paymentPlans';
import { ProjectPaymentProgressBar } from '../components/ProjectPaymentProgressBar';
import { RegisterPaymentModal } from '../components/RegisterPaymentModal';
import { SuggestRetainerModal } from '../components/SuggestRetainerModal';
import { RegisterRecurringIncomeModal } from '../components/RegisterRecurringIncomeModal';
import { saveStandaloneRetainer, calculateMonthlyCashProjection } from '../utils/monthlyCashProjection';
import { ModalPortal } from '../components/ModalPortal';
import { Payment, PersonalAccount, RecurringIncomePlan } from '../types';
import { 
  getHorizonTargetGoalARS, 
  getHorizonIncludeWebInTarget, 
  setHorizonIncludeWebInTarget, 
  deriveHorizonProject 
} from '../utils/horizon';
import { 
  PAF_PRO_MILESTONES, 
  PAF_BASE_MILESTONES,
  DEFAULT_PAF_STAGE_EXIT_MILESTONES,
  checkPafPacing,
  generatePafWhatsAppMessage
} from '../utils/pafTemplates';

interface Props {
  projects: Project[];
  tasks?: AgendaTask[];
  meetings?: AgendaMeeting[];
  incomes?: IncomeRecord[];
  expenses?: ExpenseRecord[];
  timeLogs?: TimeLog[];
  serviceMode?: 'web' | 'paf' | 'all' | 'extra';
  onOpenInCallDrawer?: (projectId?: string) => void;
  onAddTimeLog?: (log: Omit<TimeLog, 'id' | 'createdAt'>) => void;
  onDeleteTimeLog?: (id: string) => void;
  onAddProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onDeleteProject: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onAddTask?: (task: Omit<AgendaTask, 'id' | 'createdAt'>) => void;
  onToggleTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onAddSubtask?: (taskId: string, title: string) => void;
  onDeleteSubtask?: (taskId: string, subtaskId: string) => void;
  onAddMeeting?: (meeting: Omit<AgendaMeeting, 'id' | 'createdAt'>) => void;
  onToggleMeeting?: (meetingId: string) => void;
  onDeleteMeeting?: (meetingId: string) => void;
  onAddIncome?: (income: Omit<IncomeRecord, 'id' | 'createdAt'>) => void;
  onToggleIncomeStatus?: (id: string) => void;
  onDeleteIncome?: (id: string) => void;
  onAddExpense?: (expense: Omit<ExpenseRecord, 'id' | 'createdAt'>) => void;
  onToggleExpenseStatus?: (id: string) => void;
  onDeleteExpense?: (id: string) => void;
  privacyMode?: boolean;
  onNavigate?: (path: string) => void;
  onNavigateToProject?: (projectId: string) => void;
  onNavigateToNewClient?: () => void;
  onSavePayment?: (projectId: string, payment: Payment, options?: any) => void;
  onDeletePayment?: (projectId: string, paymentId: string) => void;
  personalAccounts?: PersonalAccount[];
  usdRate?: number;
}

export const ProjectsSimpleView: React.FC<Props> = ({
  projects,
  tasks = [],
  meetings = [],
  incomes = [],
  expenses = [],
  timeLogs = [],
  onAddTimeLog,
  onDeleteTimeLog,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onToggleArchive,
  onAddTask = () => {},
  onToggleTask = () => {},
  onDeleteTask = () => {},
  onToggleSubtask = () => {},
  onAddSubtask = () => {},
  onDeleteSubtask = () => {},
  onAddMeeting = () => {},
  onToggleMeeting = () => {},
  onDeleteMeeting = () => {},
  onAddIncome = () => {},
  onToggleIncomeStatus = () => {},
  onDeleteIncome = () => {},
  onAddExpense = () => {},
  onToggleExpenseStatus = () => {},
  onDeleteExpense = () => {},
  privacyMode = false,
  serviceMode: initialServiceMode = 'all',
  onOpenInCallDrawer,
  onNavigate,
  onNavigateToProject,
  onNavigateToNewClient,
  onSavePayment,
  onDeletePayment,
  personalAccounts = [],
  usdRate = 1250,
}) => {
  const [serviceMode, setServiceMode] = useState<'web' | 'paf' | 'all' | 'extra'>(initialServiceMode);
  const [includeWebInTarget, setIncludeWebInTargetState] = useState<boolean>(() => getHorizonIncludeWebInTarget());
  const targetGoalARS = getHorizonTargetGoalARS();

  const handleToggleIncludeWeb = () => {
    hapticFeedback.light();
    const next = !includeWebInTarget;
    setIncludeWebInTargetState(next);
    setHorizonIncludeWebInTarget(next);
  };

  // Quick Payment & Retainer Modals State
  const [selectedProjectForPayment, setSelectedProjectForPayment] = useState<Project | null>(null);
  const [showRegisterPaymentModal, setShowRegisterPaymentModal] = useState(false);
  const [selectedProjectForRetainer, setSelectedProjectForRetainer] = useState<Project | null>(null);
  const [showSuggestRetainerModal, setShowSuggestRetainerModal] = useState(false);
  const [showRegisterFixedContractModal, setShowRegisterFixedContractModal] = useState(false);

  const handleSavePaymentForProject = (payment: Payment, options?: any) => {
    if (!selectedProjectForPayment) return;
    if (onSavePayment) {
      onSavePayment(selectedProjectForPayment.id, payment, options);
    } else {
      const currentPayments = selectedProjectForPayment.payments || [];
      const nextPayments = [payment, ...currentPayments];
      onUpdateProject(selectedProjectForPayment.id, { payments: nextPayments });
      onAddIncome({
        title: payment.note ? `${payment.note} (${selectedProjectForPayment.clientName})` : `Pago de ${selectedProjectForPayment.clientName}`,
        amount: payment.amount,
        currency: payment.currency,
        date: payment.date,
        month: payment.date.slice(0, 7),
        status: 'cobrado',
        projectId: selectedProjectForPayment.id,
        projectName: selectedProjectForPayment.clientName,
      });
    }
  };

  const handleSaveRetainerPlan = (plan: Omit<RecurringIncomePlan, 'id' | 'createdAt'>) => {
    if (!selectedProjectForRetainer) return;
    const newPlan: RecurringIncomePlan = {
      ...plan,
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    const updatedPlans = [...(selectedProjectForRetainer.recurringPlans || []), newPlan];
    onUpdateProject(selectedProjectForRetainer.id, { recurringPlans: updatedPlans });
  };

  React.useEffect(() => {
    if (initialServiceMode) {
      setServiceMode(initialServiceMode);
    }
  }, [initialServiceMode]);

  // Navigation tabs: Activos vs PAF vs Posibles (Leads / Cotizaciones) vs Roadmap de Entregas (#4) vs Proyección de Cobros vs Archivados
  const [tab, setTab] = useState<'activos' | 'paf' | 'posibles' | 'roadmap' | 'proyeccion' | 'archivados'>(() => {
    return initialServiceMode === 'paf' ? 'paf' : 'activos';
  });

  // Keep tab in sync if serviceMode prop changes
  React.useEffect(() => {
    if (serviceMode === 'paf' && tab !== 'paf' && tab !== 'posibles' && tab !== 'proyeccion' && tab !== 'archivados') {
      setTab('paf');
    } else if (serviceMode === 'web' && tab === 'paf') {
      setTab('activos');
    }
  }, [serviceMode]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showNewPafModal, setShowNewPafModal] = useState(false);
  const [showPafPricingModal, setShowPafPricingModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selected360ProjectId, setSelected360ProjectId] = useState<string | null>(null);
  const selected360Project = selected360ProjectId ? projects.find(p => p.id === selected360ProjectId) || null : null;
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // In-Call Drawer internal fallback state
  const [internalInCallDrawerOpen, setInternalInCallDrawerOpen] = useState(false);
  const [internalInCallDrawerProjectId, setInternalInCallDrawerProjectId] = useState<string | undefined>(undefined);

  const handleOpenDrawer = (projectId?: string) => {
    if (onOpenInCallDrawer) {
      onOpenInCallDrawer(projectId);
    } else {
      setInternalInCallDrawerProjectId(projectId);
      setInternalInCallDrawerOpen(true);
    }
  };

  // Quick PAF Hour Increment (+1h, +1.5h)
  const handleIncrementPafHours = (project: Project, delta: number) => {
    hapticFeedback.medium();
    const currentDone = project.pafConsultingHoursDone || 0;
    const total = project.pafConsultingHoursTotal || 26;
    const nextDone = Math.max(0, Math.min(total, Math.round((currentDone + delta) * 10) / 10));
    onUpdateProject(project.id, { pafConsultingHoursDone: nextDone });
  };

  // Toggle stage exit milestone checklist on PAF client architect card
  const handleToggleStageMilestone = (project: Project, milestoneId: string, milestoneText: string) => {
    hapticFeedback.selection();
    const stage = project.pafStage || 'Kick-off / Diagnóstico';
    const defaultMilestones = DEFAULT_PAF_STAGE_EXIT_MILESTONES[stage] || [];
    const existingList = project.pafStageChecklist?.[stage] || 
      defaultMilestones.map(m => ({ id: m.id, text: m.text, done: false }));

    const updatedList = existingList.map(item => 
      item.id === milestoneId ? { ...item, done: !item.done } : item
    );

    if (!existingList.some(item => item.id === milestoneId)) {
      updatedList.push({ id: milestoneId, text: milestoneText, done: true });
    }

    const updatedChecklistMap = {
      ...(project.pafStageChecklist || {}),
      [stage]: updatedList,
    };

    onUpdateProject(project.id, {
      pafStageChecklist: updatedChecklistMap,
    });
  };

  // Quick toggle PAF payment installments (C1, C2, C3)
  const handleToggleInstallment = (project: Project, installmentNum: number) => {
    hapticFeedback.light();
    const totalInstallments = project.pafPlan === '1_pago' ? 1 : project.pafPlan === '2_pagos' ? 2 : 3;
    const currentList = project.pafInstallmentDates || [];
    const existing = currentList.find(i => i.number === installmentNum);
    let updatedList: { number: number; dueDate: string; amount: number; paid: boolean; paidAt?: string }[];

    if (existing) {
      updatedList = currentList.map(i =>
        i.number === installmentNum
          ? { ...i, paid: !i.paid, paidAt: !i.paid ? getTodayString() : undefined }
          : i
      );
    } else {
      const perInstallmentAmount = project.estimatedPrice ? Math.round(project.estimatedPrice / totalInstallments) : 0;
      const baseList = Array.from({ length: totalInstallments }, (_, idx) => {
        const num = idx + 1;
        const found = currentList.find(item => item.number === num);
        if (found) return found;
        return {
          number: num,
          dueDate: '',
          amount: perInstallmentAmount,
          paid: false,
        };
      });
      updatedList = baseList.map(item =>
        item.number === installmentNum
          ? { ...item, paid: true, paidAt: getTodayString() }
          : item
      );
    }

    onUpdateProject(project.id, {
      pafInstallmentDates: updatedList,
      updatedAt: getTodayString(),
    });
  };

  // New Project Form State
  const [newIsLead, setNewIsLead] = useState<boolean>(false);
  const [newClientName, setNewClientName] = useState('');
  const [newEstimatedPrice, setNewEstimatedPrice] = useState<number | ''>('');
  const [newEstimatedCurrency, setNewEstimatedCurrency] = useState<'USD' | 'ARS'>('USD');
  const [newStatus, setNewStatus] = useState<string>('En curso');
  const [newNotes, setNewNotes] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newProjectType, setNewProjectType] = useState<ProjectType>(() => serviceMode === 'paf' ? 'paf_pro' : 'web');
  const [newPafStage, setNewPafStage] = useState<PafStage>('Kick-off / Diagnóstico');
  const [newPafPlan, setNewPafPlan] = useState<'1_pago' | '2_pagos' | '3_pagos'>('3_pagos');
  const [newStartDate, setNewStartDate] = useState<string>(() => getTodayString());
  const [newDeliveryDate, setNewDeliveryDate] = useState<string>('');

  // Inline Price Quick-Editing on cards
  const [editingPriceProjectId, setEditingPriceProjectId] = useState<string | null>(null);
  const [inlinePriceDraft, setInlinePriceDraft] = useState<number | ''>('');
  const [inlineCurrencyDraft, setInlineCurrencyDraft] = useState<'USD' | 'ARS'>('USD');

  // Desktop productivity states
  const todayStr = getTodayString();
  const [desktopLayout, setDesktopLayout] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Editing notes state map
  const [savedNotesIndicator, setSavedNotesIndicator] = useState<Record<string, boolean>>({});

  // Classification helper: Lead / Posible Proyecto vs Proyecto Activo
  const isProjectLead = (p: Project) => {
    return Boolean(
      p.isLead || 
      p.status === 'Posible proyecto' || 
      p.status === 'Propuesta enviada' || 
      p.status === 'En negociación'
    );
  };

  const isPafProject = (p: Project) => {
    return Boolean(
      p.projectType === 'paf_pro' ||
      p.projectType === 'paf_base' ||
      p.serviceType === 'paf' ||
      p.pafStage ||
      (p.pafMilestones && p.pafMilestones.length > 0) ||
      p.clientName.toLowerCase().includes('paf')
    );
  };

  const isExtraIncomeProject = (p: Project) => {
    return Boolean(
      !isPafProject(p) && (
        p.frente === 'Otros' ||
        p.rubro?.toLowerCase().includes('extra') ||
        p.rubro?.toLowerCase().includes('contrato') ||
        p.rubro?.toLowerCase().includes('asesoría') ||
        p.serviceType === 'otro' ||
        p.billingAgreement?.type === 'retainer' ||
        (p.recurringPlans && p.recurringPlans.length > 0)
      )
    );
  };

  // Strictly partition projects by service: Web vs PAF vs Ingreso Extra vs Todos
  const scopedProjects = projects.filter(p => {
    if (serviceMode === 'extra') return isExtraIncomeProject(p);
    if (serviceMode === 'web') return !isPafProject(p) && !isExtraIncomeProject(p);
    if (serviceMode === 'paf') return isPafProject(p);
    return true;
  });

  const activeProjects = scopedProjects.filter(p => !p.archived && !isProjectLead(p));
  const pafActiveProjects = projects.filter(p => !p.archived && isPafProject(p) && p.status !== 'No concretado');
  const extraActiveProjects = projects.filter(p => !p.archived && isExtraIncomeProject(p));
  const leadProjects = scopedProjects.filter(p => !p.archived && isProjectLead(p));
  const archivedProjects = scopedProjects.filter(p => p.archived);

  // Recurrent Income Calculations (Unified with Horizon)
  const derivedProjects = useMemo(() => {
    return projects.map(p => deriveHorizonProject(p, usdRate));
  }, [projects, usdRate]);

  // Flujo mensual compartido y exacto (Fuente única: calculateMonthlyCashProjection)
  const currentMonthKey = useMemo(() => getTodayString().slice(0, 7), []);
  const currentMonthCash = useMemo(() => {
    return calculateMonthlyCashProjection({
      monthKey: currentMonthKey,
      incomes,
      projects,
      usdRate,
    });
  }, [currentMonthKey, incomes, projects, usdRate]);

  const monthlyPafARS = currentMonthCash.cobradoARS;
  const monthlyExtraARS = currentMonthCash.retainersARS;
  const monthlyWebARS = currentMonthCash.porCobrarARS;
  const totalMonthlyProjectedARS = currentMonthCash.totalMesARS;
  const totalPureRecurringARS = currentMonthCash.cobradoARS + currentMonthCash.retainersARS;
  const targetProgressPercent = targetGoalARS > 0 ? Math.min(150, Math.round((totalMonthlyProjectedARS / targetGoalARS) * 100)) : 0;

  // Pipeline Totals for Leads / Posibles Proyectos
  const leadPipelineUSD = leadProjects
    .filter(p => (p.estimatedCurrency || 'USD') === 'USD' && p.estimatedPrice && p.estimatedPrice > 0)
    .reduce((acc, p) => acc + (p.estimatedPrice || 0), 0);

  const leadPipelineARS = leadProjects
    .filter(p => p.estimatedCurrency === 'ARS' && p.estimatedPrice && p.estimatedPrice > 0)
    .reduce((acc, p) => acc + (p.estimatedPrice || 0), 0);

  // Operational Tasks Metrics
  const activePendingTasks = tasks.filter(t => !t.completed && activeProjects.some(p => taskBelongsToProject(t, p))).length;
  const activeWithPending = activeProjects.filter(p => 
    tasks.some(t => !t.completed && taskBelongsToProject(t, p))
  ).length;

  // Selected Projects per active Tab
  const displayedProjects = 
    tab === 'activos' 
      ? activeProjects 
      : tab === 'posibles' 
      ? leadProjects 
      : archivedProjects;

  // Search & Status filtering
  const filteredProjects = displayedProjects.filter(p => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      p.clientName.toLowerCase().includes(q) || 
      (p.notes && p.notes.toLowerCase().includes(q)) || 
      (p.clientPhone && p.clientPhone.includes(q));
    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenAddModal = (forLead: boolean = false, defaultType?: ProjectType) => {
    hapticFeedback.light();
    setNewIsLead(forLead);
    const resolvedType: ProjectType = defaultType || (serviceMode === 'paf' ? 'paf_pro' : 'web');
    setNewProjectType(resolvedType);
    setNewPafStage('Kick-off / Diagnóstico');
    setNewPafPlan('3_pagos');
    setNewStatus(forLead ? 'Posible proyecto' : 'En curso');
    setNewClientName('');
    setNewEstimatedPrice(resolvedType === 'paf_pro' ? 1800 : resolvedType === 'paf_base' ? 950 : '');
    setNewEstimatedCurrency('USD');
    setNewNotes('');
    setNewPhone('');
    const today = getTodayString();
    setNewStartDate(today);
    const isPaf = resolvedType === 'paf_pro' || resolvedType === 'paf_base';
    setNewDeliveryDate(isPaf ? addMonths(today, 3) : '');
    setShowAddModal(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    hapticFeedback.success();

    const isPaf = newProjectType === 'paf_pro' || newProjectType === 'paf_base';
    const milestones: PafMilestone[] | undefined = isPaf 
      ? (newProjectType === 'paf_pro' ? PAF_PRO_MILESTONES : PAF_BASE_MILESTONES).map((m, idx) => ({
          id: `paf_${m.month}_${idx}`,
          month: m.month,
          pillar: m.pillar,
          title: m.title,
          week: m.week,
          description: m.description,
          completed: false,
        }))
      : undefined;

    const finalDeliveryDate = newDeliveryDate.trim() 
      ? newDeliveryDate.trim() 
      : (isPaf && newStartDate ? addMonths(newStartDate, 3) : undefined);

    onAddProject({
      clientName: newClientName.trim(),
      status: newStatus,
      notes: newNotes.trim(),
      archived: false,
      clientPhone: newPhone.trim() || undefined,
      isLead: newIsLead,
      estimatedPrice: newEstimatedPrice !== '' && Number(newEstimatedPrice) > 0 ? Number(newEstimatedPrice) : undefined,
      estimatedCurrency: newEstimatedCurrency,
      projectType: newProjectType,
      startDate: newStartDate || undefined,
      deliveryDate: finalDeliveryDate,
      pafStartDate: isPaf ? (newStartDate || undefined) : undefined,
      pafStage: isPaf ? newPafStage : undefined,
      pafPlan: isPaf ? newPafPlan : undefined,
      pafConsultingHoursTotal: newProjectType === 'paf_pro' ? 26 : undefined,
      pafConsultingHoursDone: isPaf ? 0 : undefined,
      pafMilestones: milestones,
    });

    setNewClientName('');
    setNewNotes('');
    setNewPhone('');
    setNewEstimatedPrice('');
    setNewStatus('En curso');
    setNewProjectType('otro');
    setNewPafStage('Kick-off / Diagnóstico');
    setNewStartDate(getTodayString());
    setNewDeliveryDate('');
    setShowAddModal(false);
  };

  const handleNotesChange = (id: string, notes: string) => {
    onUpdateProject(id, { notes });
    setSavedNotesIndicator(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setSavedNotesIndicator(prev => ({ ...prev, [id]: false }));
    }, 1500);
  };

  const handleQuickConvertToActive = (project: Project) => {
    hapticFeedback.success();
    onUpdateProject(project.id, {
      isLead: false,
      status: 'En curso',
    });
  };

  const handleSaveInlinePrice = (projectId: string) => {
    hapticFeedback.success();
    onUpdateProject(projectId, {
      estimatedPrice: inlinePriceDraft !== '' && Number(inlinePriceDraft) > 0 ? Number(inlinePriceDraft) : undefined,
      estimatedCurrency: inlineCurrencyDraft,
    });
    setEditingPriceProjectId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Posible proyecto':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Propuesta enviada':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'En negociación':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'En curso':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Esperando contenido':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'En revisión':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'Entregado':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Pausado':
      case 'No concretado':
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-700';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const formatPrice = (price?: number, currency: 'USD' | 'ARS' = 'USD') => {
    if (!price || price <= 0) return null;
    if (privacyMode) return '$ ••••••';
    return formatProjectPrice(price, currency);
  };

  // Alerta de clientes inactivos (15 o 30 días sin contacto)
  const getDaysSinceLastContact = (project: Project) => {
    const today = getTodayString();
    const dates: string[] = [];

    const dContact = toSafeDateString(project.lastContactDate);
    if (dContact) dates.push(dContact);

    const dUpdated = toSafeDateString(project.updatedAt);
    if (dUpdated) dates.push(dUpdated);

    const dCreated = toSafeDateString(project.createdAt);
    if (dCreated) dates.push(dCreated);

    // Check meetings
    meetings.forEach(m => {
      if (
        m.projectId === project.id || 
        (m.projectName && m.projectName.toLowerCase() === project.clientName.toLowerCase()) ||
        (m.title && m.title.toLowerCase().includes(project.clientName.toLowerCase()))
      ) {
        if (m.date) dates.push(m.date);
      }
    });

    // Check tasks
    tasks.forEach(t => {
      if (taskBelongsToProject(t, project)) {
        if (t.date) dates.push(t.date);
      }
    });

    if (dates.length === 0) {
      return { days: 0, lastDateStr: today, isInactive15: false, isInactive30: false };
    }

    dates.sort();
    const latestDate = dates[dates.length - 1];

    try {
      const d1 = new Date(today);
      const d2 = new Date(latestDate);
      const diffTime = Math.max(0, d1.getTime() - d2.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return {
        days: diffDays,
        lastDateStr: latestDate,
        isInactive15: diffDays >= 15 && diffDays < 30,
        isInactive30: diffDays >= 30,
      };
    } catch {
      return { days: 0, lastDateStr: today, isInactive15: false, isInactive30: false };
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Pestañas de Vista de Clientes: Lista | Horizonte */}
      <div className="flex items-center justify-between gap-3 p-1.5 rounded-2xl bg-zinc-950/90 border border-zinc-800 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-white shadow-xs cursor-default"
          >
            <FolderKanban className="w-3.5 h-3.5 text-zinc-300" />
            <span>Lista de Clientes</span>
          </button>
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              if (onNavigate) onNavigate('/horizonte');
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer group"
            title="Ir a Horizonte: Línea de tiempo de proyectos, ocupación y capacidad mensual"
          >
            <Compass className="w-3.5 h-3.5 text-sky-400 group-hover:rotate-45 transition-transform" />
            <span>Horizonte (Largo Plazo)</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
              Gantt
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            hapticFeedback.light();
            if (onNavigate) onNavigate('/horizonte');
          }}
          className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-sky-500/10 transition cursor-pointer shrink-0"
        >
          <span>Abrir Horizonte</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 1. Top Header Card & Segment Switcher */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/25 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#E8590C] uppercase tracking-wider mb-0.5">
              {serviceMode === 'paf' ? (
                <>
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400">Método PAF · Infraestructura Comercial para Estudios</span>
                </>
              ) : serviceMode === 'web' ? (
                <>
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-blue-400">Desarrollo Web & Software</span>
                </>
              ) : (
                <>
                  <FolderKanban className="w-3.5 h-3.5" />
                  <span>Gestión Comercial & Proyectos</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-2xl font-bold text-zinc-100 tracking-tight">
                {serviceMode === 'paf'
                  ? 'Clientes Método PAF (Estudios de Arquitectura)'
                  : serviceMode === 'web'
                  ? 'Control de Proyectos Web'
                  : 'Control de Proyectos & Pipeline'}
              </h2>
              <button
                onClick={() => setShowInfoModal(true)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
                title="Información y guía de uso"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 hidden sm:block">
              {serviceMode === 'paf'
                ? 'Seguimiento de estudios de arquitectura en 12 semanas (Web comercial, Ads, VSL, Cierres), consultorías 1:1 y planes de pago.'
                : serviceMode === 'web'
                ? 'Sitios corporativos, tiendas e-commerce y aplicaciones en ejecución, cotizaciones y entregas.'
                : 'Administrá proyectos activos, cotizaciones estimadas y seguimiento directo con clientes.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {serviceMode === 'paf' && (
              <button
                type="button"
                onClick={() => setShowPafPricingModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-[#1A2233] hover:bg-[#263047] border border-[#263047] text-[#E8ECF4] text-xs font-bold transition active:scale-95 shadow-sm cursor-pointer"
                title="Configurar precios y cuotas de PAF Pro y Base"
              >
                <Calculator className="w-3.5 h-3.5 text-[#34C38F]" />
                <span className="hidden sm:inline">Precios PAF</span>
              </button>
            )}

            {/* Botón rápido para registrar ingresos extra recurrentes */}
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setShowRegisterFixedContractModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-300 text-xs font-bold transition active:scale-95 shadow-sm cursor-pointer"
              title="Registrar ingreso extra recurrente, asesoría externa o servicio especial"
            >
              <Handshake className="w-3.5 h-3.5 text-violet-400" />
              <span>+ Ingreso Extra</span>
            </button>

            <button
              onClick={() => handleOpenAddModal(true, serviceMode === 'paf' ? 'paf_pro' : 'web')}
              className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-bold transition active:scale-95 shadow-sm cursor-pointer"
              title={serviceMode === 'paf' ? 'Registrar entrevista o estudio potencial' : 'Registrar una cotización o prospecto en negociación'}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{serviceMode === 'paf' ? '+ Entrevista' : '+ Propuesta'}</span>
            </button>

            <button
              onClick={() => {
                if (onNavigateToNewClient) {
                  onNavigateToNewClient();
                  return;
                }
                if (serviceMode === 'paf') {
                  setShowNewPafModal(true);
                } else {
                  handleOpenAddModal(false, 'web');
                }
              }}
              className={`flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-white text-xs font-bold transition shadow-lg active:scale-95 cursor-pointer ${
                serviceMode === 'paf' 
                  ? 'bg-[#E8590C] hover:bg-[#cf4d07] shadow-[#E8590C]/20' 
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
              }`}
              title={serviceMode === 'paf' ? 'Registrar nuevo estudio en el programa PAF' : 'Registrar un proyecto web activo en curso'}
            >
              <Plus className="w-4 h-4" />
              <span>{serviceMode === 'paf' ? '+ Cliente PAF' : '+ Proyecto Web'}</span>
            </button>
          </div>
        </div>

        {/* Primary Service Selector Pills */}
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                setServiceMode('paf');
                setTab('activos');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                serviceMode === 'paf'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Método PAF</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                setServiceMode('web');
                setTab('activos');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                serviceMode === 'web'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>Desarrollo Web</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                setServiceMode('extra');
                setTab('activos');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                serviceMode === 'extra'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Handshake className="w-3.5 h-3.5 text-violet-400" />
              <span>Ingresos Extra</span>
              {extraActiveProjects.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-violet-500/30 text-violet-200">
                  {extraActiveProjects.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                setServiceMode('all');
                setTab('activos');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                serviceMode === 'all'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>Todos</span>
            </button>
          </div>

          {/* Pestaña: Lista | Horizonte */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 shrink-0">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 text-white shadow-xs cursor-default"
            >
              <FolderKanban className="w-3.5 h-3.5 text-zinc-300" />
              <span>Lista</span>
            </button>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                if (onNavigate) onNavigate('/horizonte');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
              title="Ir a vista Horizonte de largo plazo"
            >
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span>Horizonte</span>
            </button>
          </div>
        </div>
      </div>

      {/* Widget de Ingresos Recurrentes & Meta Mensual ($1.500.000 ARS) */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900/95 to-zinc-950 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white font-heading">
                  Meta de Ingresos Recurrentes Mensuales
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Objetivo: ${targetGoalARS.toLocaleString('es-AR')} ARS/mes
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Medición mensual basada en cuotas PAF, ingresos extra fijos y facturación web.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setShowRegisterFixedContractModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-violet-600/25 hover:bg-violet-600/35 border border-violet-500/40 text-violet-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              title="Registrar un ingreso extra recurrente"
            >
              <Handshake className="w-3.5 h-3.5 text-violet-400" />
              <span>+ Ingreso Extra</span>
            </button>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                if (onNavigate) onNavigate('/horizonte');
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-zinc-200 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
              title="Ver planificación temporal y balance de frentes en Horizonte"
            >
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span>Ver Horizonte →</span>
            </button>
          </div>
        </div>

        {/* 3 Bloques de Desglose */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div 
            onClick={() => {
              setServiceMode('paf');
              setTab('activos');
            }}
            className="p-3 rounded-xl bg-zinc-900/90 border border-emerald-500/30 cursor-pointer hover:border-emerald-400/60 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pagos Recurrentes PAF</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-bold">
                3 pagos
              </span>
            </div>
            <div className="mt-1 text-sm font-mono font-bold text-emerald-300">
              {privacyMode ? '$ ••••••' : `$ ${monthlyPafARS.toLocaleString('es-AR')} ARS/mes`}
            </div>
          </div>

          <div 
            onClick={() => {
              setServiceMode('extra');
              setTab('activos');
            }}
            className="p-3 rounded-xl bg-zinc-900/90 border border-violet-500/30 cursor-pointer hover:border-violet-400/60 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5">
                <Handshake className="w-3.5 h-3.5 text-violet-400" />
                <span>Ingresos Extra Recurrentes</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-violet-500/15 text-violet-300 font-bold">
                Fijo
              </span>
            </div>
            <div className="mt-1 text-sm font-mono font-bold text-violet-300">
              {privacyMode ? '$ ••••••' : `$ ${monthlyExtraARS.toLocaleString('es-AR')} ARS/mes`}
            </div>
          </div>

          <div className={`p-3 rounded-xl border transition ${
            includeWebInTarget 
              ? 'bg-zinc-900/90 border-sky-500/30' 
              : 'bg-zinc-950/60 border-zinc-800/80 opacity-60'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>Desarrollo Web (Puntual)</span>
              </span>
              <button
                type="button"
                onClick={handleToggleIncludeWeb}
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold cursor-pointer transition ${
                  includeWebInTarget ? 'bg-sky-500/20 text-sky-300' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {includeWebInTarget ? 'Sumando' : 'Excluido'}
              </button>
            </div>
            <div className="mt-1 text-sm font-mono font-bold text-sky-300">
              {privacyMode ? '$ ••••••' : `$ ${monthlyWebARS.toLocaleString('es-AR')} ARS/mes`}
            </div>
          </div>
        </div>

        {/* Barra de Progreso hacia $1.500.000 */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono">
            <div className="text-zinc-300 flex items-center gap-1.5 flex-wrap">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Cobro mensual proyectado:</span>
              <span className="font-bold text-emerald-400 text-sm">
                {privacyMode ? '$ ••••••' : `$ ${totalMonthlyProjectedARS.toLocaleString('es-AR')} ARS`}
              </span>
              <span className="text-zinc-500 text-[11px]">
                (Recurrente puro: ${totalPureRecurringARS.toLocaleString('es-AR')})
              </span>
            </div>
            <span className={`font-bold shrink-0 ${targetProgressPercent >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {targetProgressPercent}% de la meta
            </span>
          </div>

          <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 relative">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                targetProgressPercent >= 100 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                  : 'bg-gradient-to-r from-amber-500 to-emerald-500'
              }`}
              style={{ width: `${Math.min(100, targetProgressPercent)}%` }}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] text-zinc-400 pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeWebInTarget}
                onChange={handleToggleIncludeWeb}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
              />
              <span>Sumar facturación Web al objetivo mensual</span>
            </label>

            <span className="shrink-0">
              {targetProgressPercent >= 100 ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> ¡Meta de $1.5M alcanzada!
                </span>
              ) : (
                <span>Te faltan ${(targetGoalARS - totalMonthlyProjectedARS).toLocaleString('es-AR')} para los ${targetGoalARS.toLocaleString('es-AR')}</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Executive Overview / KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {serviceMode === 'paf' ? (
          <>
            {/* PAF Card 1: Estudios Activos */}
            <div 
              onClick={() => setTab('activos')}
              className={`cursor-pointer bg-zinc-900/90 border rounded-2xl p-4 transition shadow-sm hover:border-zinc-700 flex flex-col justify-between ${
                tab === 'activos' ? 'border-[#E8590C]/60 bg-[#E8590C]/10 shadow-md' : 'border-zinc-800/80'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase">
                <span className="flex items-center gap-1.5 text-[#E8590C]">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Estudios Activos</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E8590C]/15 text-[#E8590C] font-semibold">
                  En Programa
                </span>
              </div>
              <div className="my-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono">
                  {activeProjects.length}
                </span>
                <span className="text-xs text-zinc-400">
                  {activeProjects.length === 1 ? 'estudio activo' : 'estudios activos'}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2 flex items-center justify-between">
                <span>Tablero PAF:</span>
                <span className="text-[#E8590C] font-semibold hover:underline">Ver etapas →</span>
              </div>
            </div>

            {/* PAF Card 2: Estudios Pro */}
            <div 
              className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 transition shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>PAF Pro (12 Sem)</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold">
                  26hs 1:1
                </span>
              </div>
              <div className="my-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono">
                  {activeProjects.filter(p => p.projectType === 'paf_pro').length}
                </span>
                <span className="text-xs text-zinc-400">consultorías intensivas</span>
              </div>
              <div className="text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2 flex items-center justify-between">
                <span>Seguimiento:</span>
                <span className="text-zinc-300 font-medium">Hitos semanales</span>
              </div>
            </div>

            {/* PAF Card 3: Estudios Base */}
            <div 
              className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 transition shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>PAF Base</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-semibold">
                  Acceso Base
                </span>
              </div>
              <div className="my-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono">
                  {activeProjects.filter(p => p.projectType === 'paf_base').length}
                </span>
                <span className="text-xs text-zinc-400">estudios base</span>
              </div>
              <div className="text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2 flex items-center justify-between">
                <span>Entregables:</span>
                <span className="text-zinc-300 font-medium">Landing & Toolkit</span>
              </div>
            </div>

            {/* PAF Card 4: Entrevistas & Leads */}
            <div 
              onClick={() => setTab('posibles')}
              className={`cursor-pointer bg-zinc-900/90 border rounded-2xl p-4 transition shadow-sm hover:border-zinc-700 flex flex-col justify-between ${
                tab === 'posibles' ? 'border-amber-500/50 bg-amber-950/10' : 'border-zinc-800/80'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Entrevistas PAF</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">
                  Pipeline
                </span>
              </div>
              <div className="my-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono">
                  {leadProjects.length}
                </span>
                <span className="text-xs text-zinc-400">postulantes en evaluación</span>
              </div>
              <div className="text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2 flex items-center justify-between">
                <span>Potencial:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {privacyMode ? '$ ••••••' : leadPipelineUSD > 0 ? `US$ ${leadPipelineUSD.toLocaleString('es-AR')}` : `${leadProjects.length} postulaciones`}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Web Card 1: Proyectos Web Activos */}
            <div 
              onClick={() => setTab('activos')}
              className={`cursor-pointer bg-zinc-900/90 border rounded-2xl p-4 transition shadow-sm hover:border-zinc-700 flex flex-col justify-between ${
                tab === 'activos' ? 'border-blue-500/50 bg-blue-950/10' : 'border-zinc-800/80'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase">
                <span className="flex items-center gap-1.5 text-blue-400">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Sitios Web Activos</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold">
                  En Ejecución
                </span>
              </div>

              <div className="my-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono">
                  {activeProjects.length}
                </span>
                <span className="text-xs text-zinc-400">
                  {activeProjects.length === 1 ? 'sitio activo' : 'sitios activos'}
                </span>
              </div>

              <div className="text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2 flex items-center justify-between">
                <span>Operativa:</span>
                <span className="text-zinc-300 font-medium">
                  {activeWithPending > 0 ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {activeWithPending} pendientes
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-semibold">✓ Al día</span>
                  )}
                </span>
              </div>
            </div>

            {/* Web Card 2: Posibles Proyectos (Pipeline Económico) */}
            <div 
              onClick={() => setTab('posibles')}
              className={`cursor-pointer bg-zinc-900/90 border rounded-2xl p-4 transition shadow-sm hover:border-zinc-700 flex flex-col justify-between ${
                tab === 'posibles' ? 'border-amber-500/50 bg-amber-950/10' : 'border-zinc-800/80'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Presupuestos Web</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold">
                  Cotizaciones
                </span>
              </div>

              <div className="my-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono">
                  {leadProjects.length}
                </span>
                <span className="text-xs text-zinc-400">
                  {leadProjects.length === 1 ? 'propuesta' : 'propuestas'}
                </span>
              </div>

              <div className="text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2 flex items-center justify-between">
                <span>Valor estimado:</span>
                <span className="font-mono font-bold text-emerald-400 truncate">
                  {privacyMode ? (
                    '$ ••••••'
                  ) : leadPipelineUSD > 0 || leadPipelineARS > 0 ? (
                    <span>
                      {leadPipelineUSD > 0 && `US$ ${leadPipelineUSD.toLocaleString('es-AR')}`}
                      {leadPipelineUSD > 0 && leadPipelineARS > 0 && ' · '}
                      {leadPipelineARS > 0 && `$ ${leadPipelineARS.toLocaleString('es-AR')}`}
                    </span>
                  ) : (
                    <span className="text-zinc-500 font-normal">-</span>
                  )}
                </span>
              </div>
            </div>

            {/* Web Card 3: Roadmap de Entregas */}
            <div 
              onClick={() => setTab('roadmap')}
              className={`cursor-pointer bg-zinc-900/90 border rounded-2xl p-4 transition shadow-sm hover:border-zinc-700 flex flex-col justify-between ${
                tab === 'roadmap' ? 'border-indigo-500/50 bg-indigo-950/10' : 'border-zinc-800/80'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase">
                <span className="flex items-center gap-1.5 text-indigo-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Entregas Web</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-semibold">
                  Roadmap
                </span>
              </div>

              <div className="my-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono">
                  {activeProjects.filter(p => p.deliveryDate).length}
                </span>
                <span className="text-xs text-zinc-400">
                  con fecha fijada
                </span>
              </div>

              <div className="text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2 flex items-center justify-between">
                <span>Planificador:</span>
                <span className="text-indigo-300 font-medium hover:underline">Ver cronograma →</span>
              </div>
            </div>

            {/* Web Card 4: Carga Operativa & Tareas */}
            <div 
              className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 transition shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase">
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <CheckSquare className="w-3.5 h-3.5 text-[#E8590C]" />
                  <span>Tareas & Citas</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-semibold">
                  Agenda
                </span>
              </div>

              <div className="my-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono">
                  {activePendingTasks}
                </span>
                <span className="text-xs text-zinc-400">
                  tareas pendientes
                </span>
              </div>

              <div className="text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2 flex items-center justify-between">
                <span>Reuniones:</span>
                <span className="text-zinc-300 font-medium">
                  {meetings.filter(m => !m.completed).length} citas activas
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. Navigation Tabs, Search & Filters Bar */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-2.5 sm:p-3 space-y-2.5">
        {/* Responsive Tabs Bar with horizontal touch scroll on mobile and seamless grid on desktop */}
        <div className="w-full overflow-x-auto scrollbar-none -mx-1 px-1">
          <div className="p-1 bg-zinc-950/90 border border-zinc-800/80 rounded-xl flex items-center gap-1 min-w-max md:grid md:grid-cols-5 md:min-w-0 md:w-full">
            {serviceMode === 'paf' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setTab('paf');
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    tab === 'paf'
                      ? 'bg-[#E8590C] text-white shadow-sm font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                  title="Tablero & Etapas del Método PAF"
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Tablero & Etapas</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setTab('activos');
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    tab === 'activos'
                      ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                  title="Clientes Arquitectos Activos"
                >
                  <Briefcase className="w-3.5 h-3.5 shrink-0" />
                  <span>Arquitectos Activos ({activeProjects.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setTab('proyeccion');
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    tab === 'proyeccion'
                      ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                      : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 border border-emerald-500/20'
                  }`}
                  title="Proyección de Cobros & Cuotas"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Cobros & Cuotas</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setTab('posibles');
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    tab === 'posibles'
                      ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                  title="Entrevistas y Posibles Clientes PAF"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Entrevistas ({leadProjects.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setTab('archivados');
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    tab === 'archivados'
                      ? 'bg-zinc-700 text-white shadow-sm font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                  title="Estudios Graduados o Archivados"
                >
                  <Archive className="w-3.5 h-3.5 shrink-0" />
                  <span>Archivados ({archivedProjects.length})</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setTab('activos');
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    tab === 'activos'
                      ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                  title="Sitios Web en Desarrollo Activo"
                >
                  <Briefcase className="w-3.5 h-3.5 shrink-0" />
                  <span>Sitios Activos ({activeProjects.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setTab('proyeccion');
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    tab === 'proyeccion'
                      ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                      : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 border border-emerald-500/20'
                  }`}
                  title="Proyección de Cobros Web (50% / 50%)"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Cobros 50/50</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setTab('posibles');
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    tab === 'posibles'
                      ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                  title="Presupuestos Web Solicitados"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Presupuestos ({leadProjects.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setTab('roadmap');
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    tab === 'roadmap'
                      ? 'bg-[#E8590C] text-white shadow-sm font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                  title="Cronograma de Entregas Web"
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>Roadmap Entregas</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setTab('archivados');
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition text-center shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    tab === 'archivados'
                      ? 'bg-zinc-700 text-white shadow-sm font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                  title="Proyectos Web Finalizados y Archivados"
                >
                  <Archive className="w-3.5 h-3.5 shrink-0" />
                  <span>Archivados ({archivedProjects.length})</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search, Filter & Layout Switcher Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-zinc-800/50">
          <div className="flex items-center gap-2 flex-1 w-full">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente, nota, teléfono..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#E8590C] transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-[#E8590C] cursor-pointer shrink-0"
            >
              <option value="todos">Todos los estados</option>
              {DEFAULT_PROJECT_STATUSES.map(st => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            {/* Desktop Layout Toggle (Grid vs Table) */}
            <div className="hidden md:flex items-center bg-zinc-950 p-0.5 rounded-xl border border-zinc-800 shadow-inner">
              <button
                type="button"
                onClick={() => setDesktopLayout('grid')}
                className={`p-1.5 rounded-lg transition ${
                  desktopLayout === 'grid'
                    ? 'bg-[#E8590C] text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
                title="Vista en Tarjetas 360°"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDesktopLayout('table')}
                className={`p-1.5 rounded-lg transition ${
                  desktopLayout === 'table'
                    ? 'bg-[#E8590C] text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
                title="Vista en Tabla Ejecutiva"
              >
                <Table className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Projects Display: PAF vs Roadmap vs Proyeccion vs (Grid vs Table) */}
      {tab === 'paf' ? (
        <PafDashboard
          projects={projects}
          onUpdateProject={onUpdateProject}
          onSelectProject={(p) => {
            if (onNavigateToProject) {
              onNavigateToProject(p.id);
            } else {
              setSelected360ProjectId(p.id);
            }
          }}
          onOpenNewPafModal={() => setShowNewPafModal(true)}
        />
      ) : tab === 'roadmap' ? (
        <DeliveriesRoadmap
          projects={projects}
          tasks={tasks}
          onSelectProject={(p) => {
            if (onNavigateToProject) {
              onNavigateToProject(p.id);
            } else {
              setSelected360ProjectId(p.id);
            }
          }}
          onUpdateProjectDeliveryDate={(projectId, date) => {
            onUpdateProject(projectId, { deliveryDate: date });
          }}
        />
      ) : tab === 'proyeccion' ? (
        <ActiveClientsCashflowProjection
          projects={projects}
          incomes={incomes}
          onSelectProject={(p) => {
            if (onNavigateToProject) {
              onNavigateToProject(p.id);
            } else {
              setSelected360ProjectId(p.id);
            }
          }}
          onUpdateProject={onUpdateProject}
          onToggleIncomeStatus={onToggleIncomeStatus}
          privacyMode={privacyMode}
        />
      ) : filteredProjects.length > 0 ? (
        <>
          {/* Executive Table View (Desktop) */}
          {desktopLayout === 'table' && (
            <div className="hidden md:block bg-zinc-900/90 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-lg shadow-black/20">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/70 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Cliente / Proyecto</th>
                      <th className="py-3.5 px-4">Tipo</th>
                      <th className="py-3.5 px-4">Valor Cotizado</th>
                      <th className="py-3.5 px-4">Estado</th>
                      <th className="py-3.5 px-4">Cronograma / Meses</th>
                      <th className="py-3.5 px-4">Tareas</th>
                      <th className="py-3.5 px-4">Rentabilidad</th>
                      <th className="py-3.5 px-4">Notas Rápidas</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-xs">
                    {filteredProjects.map(project => {
                      const isLead = isProjectLead(project);
                      const projTasks = tasks.filter(t => taskBelongsToProject(t, project));
                      const projIncomes = incomes.filter(i => i.projectId === project.id || (!i.projectId && i.title.toLowerCase().includes(project.clientName.toLowerCase())));
                      const projExpenses = expenses.filter(e => e.projectId === project.id || (!e.projectId && e.title.toLowerCase().includes(project.clientName.toLowerCase())));
                      
                      const pendingTasks = projTasks.filter(t => !t.completed).length;
                      const completedTasks = projTasks.filter(t => t.completed).length;
                      const totalTasks = projTasks.length;

                      const usdCobrado = projIncomes.filter(i => i.currency === 'USD' && i.status === 'cobrado').reduce((a, b) => a + b.amount, 0);
                      const usdGastos = projExpenses.filter(e => e.currency === 'USD' && e.status === 'pagado').reduce((a, b) => a + b.amount, 0);
                      const netUSD = usdCobrado - usdGastos;

                      const arsCobrado = projIncomes.filter(i => i.currency === 'ARS' && i.status === 'cobrado').reduce((a, b) => a + b.amount, 0);
                      const arsGastos = projExpenses.filter(e => e.currency === 'ARS' && e.status === 'pagado').reduce((a, b) => a + b.amount, 0);
                      const netARS = arsCobrado - arsGastos;

                      return (
                        <tr key={project.id} className="hover:bg-zinc-800/30 transition group">
                          {/* Cliente & Contacto */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-zinc-100 flex items-center gap-2">
                              <span className="truncate max-w-[180px]">{project.clientName}</span>
                              {project.clientPhone && (
                                <a
                                  href={formatWhatsAppUrl(project.clientPhone, `Hola! Te contacto sobre el proyecto ${project.clientName}`)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition"
                                  title={`WhatsApp: ${project.clientPhone}`}
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                            {/* Inactive client tag in table */}
                            {(() => {
                              const contactInfo = getDaysSinceLastContact(project);
                              if (contactInfo.isInactive30 && !project.archived) {
                                return (
                                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                                    <span>+{contactInfo.days}d sin contacto</span>
                                  </span>
                                );
                              }
                              if (contactInfo.isInactive15 && !project.archived) {
                                return (
                                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                    <Clock className="w-2.5 h-2.5 text-amber-400" />
                                    <span>+{contactInfo.days}d sin contacto</span>
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            {/* Indicador chico de puntualidad (Requisito 5) */}
                            {(() => {
                              const habits = calculateClientPaymentHabits(project, incomes);
                              if (habits.tag === 'Puntual') {
                                return (
                                  <span className="inline-flex items-center gap-1 mt-1 ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" title={`${habits.onTimePercentage}% de cuotas pagadas a tiempo`}>
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                    <span>Puntual</span>
                                  </span>
                                );
                              }
                              if (habits.tag === 'Se atrasa seguido') {
                                return (
                                  <span className="inline-flex items-center gap-1 mt-1 ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30" title={`Atraso promedio de ${habits.avgDelayDays} días`}>
                                    <Clock className="w-2.5 h-2.5 text-amber-400" />
                                    <span>Demora ~{habits.avgDelayDays}d</span>
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </td>

                          {/* Tipo (Activo vs Posible) */}
                          <td className="py-3 px-4">
                            {isExtraIncomeProject(project) ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/40">
                                🤝 Ingreso Extra
                              </span>
                            ) : isLead ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                💡 Posible
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                🚀 Activo
                              </span>
                            )}
                          </td>

                          {/* Valor Cotizado */}
                          <td className="py-3 px-4">
                            {project.estimatedPrice && project.estimatedPrice > 0 ? (
                              <span className="font-mono font-bold text-emerald-400 text-xs">
                                {formatPrice(project.estimatedPrice, project.estimatedCurrency)}
                              </span>
                            ) : (
                              <span className="text-zinc-500 text-[11px] italic">Sin cotizar</span>
                            )}
                          </td>

                          {/* Estado */}
                          <td className="py-3 px-4">
                            <select
                              value={project.status}
                              onChange={e => onUpdateProject(project.id, { status: e.target.value })}
                              className={`text-[11px] font-semibold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${getStatusBadge(project.status)} bg-zinc-950`}
                            >
                              {DEFAULT_PROJECT_STATUSES.map(st => (
                                <option key={st} value={st} className="bg-zinc-900 text-zinc-200">
                                  {st}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Cronograma / Conteo de Meses */}
                          <td className="py-3 px-4 min-w-[210px]">
                            <ProjectTimelineBadge project={project} onUpdateProject={onUpdateProject} compact />
                          </td>

                          {/* Tareas y Salud de Proyecto */}
                          <td className="py-3 px-4 min-w-[200px]">
                            <div className="space-y-1">
                              <ProjectHealthBadge 
                                tasks={projTasks} 
                                deliveryDate={project.deliveryDate} 
                                showBar={true} 
                                compact={false} 
                                className="!p-2 !space-y-1" 
                              />
                              <div className="flex items-center justify-between text-[10px] text-zinc-400 px-0.5">
                                <span>
                                  {pendingTasks > 0 ? (
                                    <strong className="text-amber-400">{pendingTasks} pendiente{pendingTasks > 1 ? 's' : ''}</strong>
                                  ) : totalTasks > 0 ? (
                                    <span className="text-emerald-400 font-semibold">Al día</span>
                                  ) : (
                                    'Sin tareas'
                                  )}
                                </span>
                                {projTasks.some(t => !t.completed && t.date && t.date < todayStr) && (
                                  <span className="text-rose-400 font-bold animate-pulse">Atrasada(s)</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Rentabilidad */}
                          <td className="py-3 px-4">
                            <div className="text-[11px] space-y-0.5">
                              {(netUSD !== 0 || netARS === 0) && (
                                <div className={`font-mono font-semibold ${netUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {privacyMode ? '••••' : `USD $${netUSD.toLocaleString('es-AR')}`}
                                </div>
                              )}
                              {netARS !== 0 && (
                                <div className={`font-mono text-[10px] ${netARS >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {privacyMode ? '••••' : `ARS $${netARS.toLocaleString('es-AR')}`}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Notas */}
                          <td className="py-3 px-4 max-w-[200px]">
                            <input
                              type="text"
                              defaultValue={project.notes || ''}
                              onBlur={e => handleNotesChange(project.id, e.target.value)}
                              placeholder="Agregar nota rápida..."
                              className="w-full bg-transparent text-zinc-300 placeholder-zinc-600 text-xs focus:bg-zinc-950 px-2 py-1 rounded border border-transparent focus:border-zinc-700 outline-none truncate"
                            />
                          </td>

                          {/* Acciones */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Botón rápido para convertir lead a activo */}
                              {isLead && (
                                <button
                                  onClick={() => handleQuickConvertToActive(project)}
                                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-xs"
                                  title="Pasar a Proyecto Activo en curso (Ganado)"
                                >
                                  <span>✨ Activar</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  if (onNavigateToProject) {
                                    onNavigateToProject(project.id);
                                  } else {
                                    setSelected360ProjectId(project.id);
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-[#E8590C] hover:text-white text-zinc-200 text-xs font-bold transition flex items-center gap-1 shadow-xs"
                                title="Abrir Ficha 360°"
                              >
                                <PieChart className="w-3 h-3" />
                                <span>360°</span>
                              </button>

                              <button
                                onClick={() => onToggleArchive(project.id)}
                                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition"
                                title={project.archived ? 'Desarchivar' : 'Archivar'}
                              >
                                {project.archived ? <ArchiveRestore className="w-3.5 h-3.5 text-sky-400" /> : <Archive className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                onClick={() => {
                                  hapticFeedback.warning();
                                  setProjectToDelete(project);
                                }}
                                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cards Grid View (Pristine, Clear, Balanced Spacing) */}
          <div className={`${desktopLayout === 'table' ? 'md:hidden' : 'grid'} grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`}>
            {filteredProjects.map(project => {
              const isLead = isProjectLead(project);
              const projTasks = tasks.filter(t => taskBelongsToProject(t, project));
              const projMeetings = meetings.filter(m => m.projectId === project.id || (!m.projectId && m.title.toLowerCase().includes(project.clientName.toLowerCase())));
              const projIncomes = incomes.filter(i => i.projectId === project.id || (!i.projectId && i.title.toLowerCase().includes(project.clientName.toLowerCase())));
              const projExpenses = expenses.filter(e => e.projectId === project.id || (!e.projectId && e.title.toLowerCase().includes(project.clientName.toLowerCase())));

              const pendingTasks = projTasks.filter(t => !t.completed).length;
              const usdCobrado = projIncomes.filter(i => i.currency === 'USD' && i.status === 'cobrado').reduce((a, b) => a + b.amount, 0);
              const usdGastos = projExpenses.filter(e => e.currency === 'USD' && e.status === 'pagado').reduce((a, b) => a + b.amount, 0);
              const netUSD = usdCobrado - usdGastos;

              const arsCobrado = projIncomes.filter(i => i.currency === 'ARS' && i.status === 'cobrado').reduce((a, b) => a + b.amount, 0);
              const arsGastos = projExpenses.filter(e => e.currency === 'ARS' && e.status === 'pagado').reduce((a, b) => a + b.amount, 0);
              const netARS = arsCobrado - arsGastos;

              const phone = project.clientPhone || extractPhoneFromText(project.notes);

              const isEditingThisPrice = editingPriceProjectId === project.id;
              const isPaf = isPafProject(project);

              // --- 1. SPECIALIZED CARD: PAF CLIENT ARCHITECT ---
              if (isPaf) {
                const hoursDone = project.pafConsultingHoursDone || 0;
                const hoursTotal = project.pafConsultingHoursTotal || 26;
                const hoursPct = Math.min(100, Math.round((hoursDone / hoursTotal) * 100));
                const hoursRemaining = Math.max(0, Math.round((hoursTotal - hoursDone) * 10) / 10);
                const pacing = checkPafPacing(hoursDone, hoursTotal, project.pafStartDate || project.createdAt);
                const pafOverdueTasks = projTasks.filter(t => !t.completed && t.date && t.date < todayStr).length;

                const currentStage: PafStage = (project.pafStage as PafStage) || 'Kick-off / Diagnóstico';
                const stageMilestones = DEFAULT_PAF_STAGE_EXIT_MILESTONES[currentStage] || [];
                const savedMilestones = project.pafStageChecklist?.[currentStage] || [];

                return (
                  <div
                    key={project.id}
                    className={`bg-zinc-900/95 border rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/25 flex flex-col justify-between space-y-4 transition hover:border-amber-500/40 ${
                      isLead ? 'border-amber-500/25 bg-amber-950/5' : 'border-zinc-800'
                    }`}
                  >
                    {/* Header: Client Architect Info & Program Tier */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <select
                              value={project.projectType || 'paf_pro'}
                              onChange={e => {
                                const val = e.target.value as ProjectType;
                                onUpdateProject(project.id, { 
                                  projectType: val,
                                  pafConsultingHoursTotal: val === 'paf_pro' ? 26 : undefined
                                });
                                hapticFeedback.selection();
                              }}
                              className="bg-amber-500/15 text-amber-300 text-[10px] font-bold border border-amber-500/30 rounded-lg px-2 py-0.5 focus:outline-none cursor-pointer"
                              title="Cambiar modalidad de servicio (PAF Pro, PAF Base o Web)"
                            >
                              <option value="paf_pro" className="bg-zinc-900 text-amber-300">⭐ Método PAF Pro (12 Sem)</option>
                              <option value="paf_base" className="bg-zinc-900 text-orange-300">PAF Base (Inicial)</option>
                              <option value="web" className="bg-zinc-900 text-cyan-300">🌐 Proyecto Web (50/50)</option>
                            </select>
                            {project.archived && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                                Archivado
                              </span>
                            )}
                            {/* Indicador chico de puntualidad (Requisito 5) */}
                            {(() => {
                              const habits = calculateClientPaymentHabits(project, incomes);
                              if (habits.tag === 'Puntual') {
                                return (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1" title={`${habits.onTimePercentage}% a tiempo (${habits.totalPaidCycles} pagos)`}>
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                    <span>Puntual</span>
                                  </span>
                                );
                              }
                              if (habits.tag === 'Se atrasa seguido') {
                                return (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1" title={`Atraso promedio ~${habits.avgDelayDays} días`}>
                                    <Clock className="w-2.5 h-2.5 text-amber-400" />
                                    <span>Demora ~{habits.avgDelayDays}d</span>
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>

                          <h3 className="text-base font-bold text-zinc-100 tracking-tight truncate" title={project.clientName}>
                            {project.clientName}
                          </h3>
                        </div>

                        {/* Program Status Selector */}
                        <select
                          value={project.status}
                          onChange={e => onUpdateProject(project.id, { status: e.target.value })}
                          className="text-xs font-semibold px-2 py-1 rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200 focus:outline-none focus:border-amber-500 cursor-pointer shrink-0"
                        >
                          {DEFAULT_PROJECT_STATUSES.map(st => (
                            <option key={st} value={st} className="bg-zinc-900 text-zinc-200">
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* PAF 3-Month Cycle Timeline Badge */}
                      <ProjectTimelineBadge project={project} onUpdateProject={onUpdateProject} />

                      {/* Inactive Client Warning Alert (+15 / +30 days) */}
                      {(() => {
                        const contactInfo = getDaysSinceLastContact(project);
                        if (contactInfo.isInactive30 && !project.archived) {
                          return (
                            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center justify-between gap-2 shadow-xs">
                              <div className="flex items-center gap-1.5 text-xs font-bold min-w-0">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                <span className="truncate">+{contactInfo.days} días sin contacto</span>
                              </div>
                              {phone && (
                                <a
                                  href={formatWhatsAppUrl(phone, `Hola ${project.clientName}, ¿cómo estás? Te escribo para consultar el avance del plan.`)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold shrink-0 transition"
                                >
                                  Reconectar
                                </a>
                              )}
                            </div>
                          );
                        }
                        if (contactInfo.isInactive15 && !project.archived) {
                          return (
                            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-2 shadow-xs">
                              <div className="flex items-center gap-1.5 text-xs font-semibold min-w-0">
                                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="truncate">+{contactInfo.days} días sin contacto</span>
                              </div>
                              {phone && (
                                <a
                                  href={formatWhatsAppUrl(phone, `Hola ${project.clientName}, ¿cómo estás?`)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-bold shrink-0 transition"
                                >
                                  Mensaje
                                </a>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* 2. PROMINENT HOUR METER & PACING ALERT */}
                      <div className="p-3 rounded-xl bg-zinc-950/90 border border-zinc-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>Horas de Consultoría 1:1</span>
                          </span>
                          <div className="flex items-center gap-2">
                            {/* Indicador compacto de tareas PAF (Paso 7) */}
                            {pendingTasks > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                <CheckSquare className="w-2.5 h-2.5 text-[#E8590C]" />
                                <span>{pendingTasks} pend.</span>
                                {pafOverdueTasks > 0 && (
                                  <span className="text-rose-400 font-bold ml-0.5 animate-pulse">
                                    ({pafOverdueTasks} venc.)
                                  </span>
                                )}
                              </span>
                            ) : projTasks.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                <Check className="w-2.5 h-2.5" />
                                <span>Al día</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-500">Sin tareas</span>
                            )}
                            <span className="text-[11px] font-bold text-zinc-400">
                              {hoursRemaining} hs libres
                            </span>
                          </div>
                        </div>

                        <div className="flex items-baseline justify-between">
                          <div className="flex items-baseline gap-1.5 font-mono">
                            <span className="text-2xl font-black text-amber-400">
                              {hoursDone}
                            </span>
                            <span className="text-xs text-zinc-500 font-semibold">
                              / {hoursTotal} hs
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleIncrementPafHours(project, 1)}
                              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-200 text-[10px] font-bold transition border border-zinc-700/60 active:scale-95"
                              title="Sumar 1 hora de consultoría"
                            >
                              +1h
                            </button>
                            <button
                              type="button"
                              onClick={() => handleIncrementPafHours(project, 1.5)}
                              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-200 text-[10px] font-bold transition border border-zinc-700/60 active:scale-95"
                              title="Sumar 1.5 horas de consultoría"
                            >
                              +1.5h
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDrawer(project.id)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 hover:text-black text-amber-300 border border-amber-500/40 text-[10px] font-bold transition flex items-center gap-1 active:scale-95"
                              title="Abrir HUD de llamada en vivo con cronómetro"
                            >
                              <PhoneCall className="w-3 h-3" />
                              <span>HUD</span>
                            </button>
                          </div>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-[#E8590C] rounded-full transition-all duration-300"
                            style={{ width: `${hoursPct}%` }}
                          />
                        </div>

                        {/* Pacing Alert if consuming hours too quickly */}
                        {pacing.isFast && (
                          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-start gap-1.5 leading-snug">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span>
                              <strong>Ritmo Acelerado:</strong> Consumió el {pacing.percentHours}% en la semana {pacing.elapsedWeeks} de 12. Riesgo de agotar sesiones antes de tiempo.
                            </span>
                          </div>
                        )}

                        {/* ProjectHealthBadge en tarjeta PAF (Paso 6) */}
                        <div className="pt-1.5 border-t border-zinc-800/60">
                          <ProjectHealthBadge
                            tasks={projTasks}
                            deliveryDate={project.deliveryDate}
                            showBar={true}
                            compact={true}
                            className="!p-2 !bg-zinc-900/60 !border-zinc-800"
                          />
                        </div>
                      </div>

                      {/* 3. ETAPA PEDAGÓGICA & HITOS DE SALIDA */}
                      <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                            <Target className="w-3 h-3 text-[#E8590C]" />
                            <span>Etapa Pedagógica</span>
                          </span>
                          <select
                            value={project.pafStage || 'Kick-off / Diagnóstico'}
                            onChange={e => onUpdateProject(project.id, { pafStage: e.target.value as PafStage })}
                            className="text-[11px] font-bold text-amber-300 bg-zinc-900 px-2 py-0.5 rounded-lg border border-zinc-700 focus:outline-none focus:border-amber-500 cursor-pointer max-w-[180px] truncate"
                          >
                            {PAF_STAGES.map(st => (
                              <option key={st} value={st} className="bg-zinc-900 text-zinc-200">
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Exit Checklist Milestones */}
                        <div className="space-y-1 pt-1">
                          <div className="text-[10px] font-semibold text-zinc-500">Entregables para avanzar de etapa:</div>
                          {stageMilestones.map(m => {
                            const isChecked = savedMilestones.find(i => i.id === m.id)?.done ?? false;
                            return (
                              <div
                                key={m.id}
                                onClick={() => handleToggleStageMilestone(project, m.id, m.text)}
                                className={`flex items-start gap-2 p-1.5 rounded-lg text-[11px] cursor-pointer transition select-none ${
                                  isChecked ? 'bg-emerald-500/10 text-emerald-300' : 'hover:bg-zinc-900 text-zinc-300'
                                }`}
                              >
                                <div className={`w-3.5 h-3.5 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                                  isChecked ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-zinc-600 bg-zinc-900'
                                }`}>
                                  {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                                <span className={`leading-tight ${isChecked ? 'line-through text-zinc-400' : ''}`}>
                                  {m.text}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 4. COBROS Y PAGOS REALES */}
                      <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                        <ProjectPaymentProgressBar
                          project={project}
                          incomes={incomes}
                          usdRate={usdRate}
                          privacyMode={privacyMode}
                          compact={true}
                          onOpenRegisterPayment={() => {
                            setSelectedProjectForPayment(project);
                            setShowRegisterPaymentModal(true);
                          }}
                        />
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProjectForPayment(project);
                              setShowRegisterPaymentModal(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1 transition active:scale-95 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ Registrar pago</span>
                          </button>
                          {onNavigateToProject && (
                            <button
                              type="button"
                              onClick={() => onNavigateToProject(project.id)}
                              className="text-[11px] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                            >
                              Ver ficha PAF →
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Notes & Agreement */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                          <span className="flex items-center gap-1">
                            <Edit3 className="w-3 h-3 text-amber-400" />
                            <span>Bitácora de Sesión:</span>
                          </span>
                          {savedNotesIndicator[project.id] && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 animate-pulse">
                              <Check className="w-3 h-3" />
                              Guardado
                            </span>
                          )}
                        </div>
                        <textarea
                          rows={2}
                          defaultValue={project.notes}
                          onBlur={e => handleNotesChange(project.id, e.target.value)}
                          placeholder="Anotar compromisos pedagógicos, links de entrega o dudas..."
                          className="w-full text-xs text-zinc-200 bg-zinc-950/80 border border-zinc-800 rounded-xl p-2.5 focus:outline-none focus:border-amber-500/60 transition leading-relaxed resize-none placeholder:text-zinc-600"
                        />
                      </div>
                    </div>

                    {/* 5. Direct Operative Actions Footer */}
                    <div className="pt-2 border-t border-zinc-800 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleOpenDrawer(project.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 hover:text-black text-amber-300 border border-amber-500/40 text-xs font-bold transition shadow-sm active:scale-95"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>HUD Llamada</span>
                        </button>

                        <button
                          onClick={() => {
                            hapticFeedback.medium();
                            if (onNavigateToProject) {
                              onNavigateToProject(project.id);
                            } else {
                              setSelected360ProjectId(project.id);
                            }
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition shadow-sm active:scale-95"
                        >
                          <PieChart className="w-3.5 h-3.5 text-amber-400" />
                          <span>Ficha 360°</span>
                        </button>
                      </div>

                      {/* WhatsApp with Smart PAF Template */}
                      {phone && (
                        <a
                          href={formatWhatsAppUrl(
                            phone, 
                            generatePafWhatsAppMessage({
                              clientName: project.clientName,
                              hoursUsed: hoursDone,
                              totalHours: hoursTotal,
                              stage: currentStage,
                              type: 'horas_restantes',
                            })
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => hapticFeedback.light()}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition active:scale-95"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Enviar Balance por WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              }

              // --- 2. STANDARD CARD: DESARROLLO WEB CLIENT ---
              return (
                <div
                  key={project.id}
                  className={`bg-zinc-900/90 border rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20 flex flex-col justify-between space-y-3.5 transition hover:border-zinc-700/80 ${
                    isLead ? 'border-amber-500/25 bg-amber-950/5' : 'border-zinc-800/80'
                  }`}
                >
                  {/* Card Header */}
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="space-y-1 min-w-0">
                        {/* Type Pill */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isExtraIncomeProject(project) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/40">
                              <Handshake className="w-2.5 h-2.5 text-violet-400" />
                              <span>Ingreso Extra</span>
                            </span>
                          ) : isLead ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Posible Proyecto</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              <Briefcase className="w-2.5 h-2.5" />
                              <span>Proyecto Activo</span>
                            </span>
                          )}

                          {project.archived && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                              Archivado
                            </span>
                          )}
                          {/* Indicador chico de puntualidad (Requisito 5) */}
                          {(() => {
                            const habits = calculateClientPaymentHabits(project, incomes);
                            if (habits.tag === 'Puntual') {
                              return (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1" title={`${habits.onTimePercentage}% a tiempo`}>
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>Puntual</span>
                                </span>
                              );
                            }
                            if (habits.tag === 'Se atrasa seguido') {
                              return (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1" title={`Atraso promedio ~${habits.avgDelayDays} días`}>
                                  <Clock className="w-2.5 h-2.5 text-amber-400" />
                                  <span>Demora ~{habits.avgDelayDays}d</span>
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-bold text-zinc-100 tracking-tight truncate" title={project.clientName}>
                          {project.clientName}
                        </h3>
                      </div>

                      {/* Status Dropdown */}
                      <select
                        value={project.status}
                        onChange={e => onUpdateProject(project.id, { status: e.target.value })}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer shrink-0 ${getStatusBadge(
                          project.status
                        )} bg-zinc-950`}
                      >
                        {DEFAULT_PROJECT_STATUSES.map(st => (
                          <option key={st} value={st} className="bg-zinc-900 text-zinc-200">
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Timeline & Month Counter Badge */}
                    <ProjectTimelineBadge project={project} onUpdateProject={onUpdateProject} />

                    {/* Inactive Client Warning Alert (+15 / +30 days) */}
                    {(() => {
                      const contactInfo = getDaysSinceLastContact(project);
                      if (contactInfo.isInactive30 && !project.archived) {
                        return (
                          <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center justify-between gap-2 shadow-xs">
                            <div className="flex items-center gap-1.5 text-xs font-bold min-w-0">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span className="truncate">+{contactInfo.days} días sin contacto</span>
                            </div>
                            {phone && (
                              <a
                                href={formatWhatsAppUrl(phone, `Hola ${project.clientName}, ¿cómo estás? Te escribo para consultar el avance del proyecto.`)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold shrink-0 transition"
                              >
                                Reconectar
                              </a>
                            )}
                          </div>
                        );
                      }
                      if (contactInfo.isInactive15 && !project.archived) {
                        return (
                          <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-2 shadow-xs">
                            <div className="flex items-center gap-1.5 text-xs font-semibold min-w-0">
                              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="truncate">+{contactInfo.days} días sin contacto</span>
                            </div>
                            {phone && (
                              <a
                                href={formatWhatsAppUrl(phone, `Hola ${project.clientName}, ¿cómo estás?`)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-bold shrink-0 transition"
                              >
                                Mensaje
                              </a>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Valor de Precio / Cotización Highlight Strip */}
                    <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-emerald-400" />
                          <span>Valor de Precio / Presupuesto</span>
                        </div>

                        {isEditingThisPrice ? (
                          <div className="mt-1 flex items-center gap-1.5">
                            <select
                              value={inlineCurrencyDraft}
                              onChange={e => setInlineCurrencyDraft(e.target.value as 'USD' | 'ARS')}
                              className="bg-zinc-900 text-xs font-bold text-zinc-200 px-1.5 py-0.5 rounded border border-zinc-700"
                            >
                              <option value="USD">USD</option>
                              <option value="ARS">ARS</option>
                            </select>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={inlinePriceDraft}
                              onChange={e => setInlinePriceDraft(e.target.value === '' ? '' : Number(e.target.value))}
                              placeholder="Monto"
                              className="w-24 bg-zinc-900 text-xs text-zinc-100 px-2 py-0.5 rounded border border-zinc-700 focus:outline-none focus:border-[#E8590C]"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveInlinePrice(project.id)}
                              className="p-1 rounded bg-[#E8590C] text-white hover:bg-[#cf4d07] transition"
                              title="Guardar"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingPriceProjectId(null)}
                              className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                              title="Cancelar"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono font-bold text-sm text-zinc-100">
                              {project.estimatedPrice && project.estimatedPrice > 0 ? (
                                formatPrice(project.estimatedPrice, project.estimatedCurrency)
                              ) : (
                                <span className="text-zinc-500 font-normal italic text-xs">Sin cotizar</span>
                              )}
                            </span>
                            <button
                              onClick={() => {
                                setInlinePriceDraft(project.estimatedPrice ?? '');
                                setInlineCurrencyDraft(project.estimatedCurrency || 'USD');
                                setEditingPriceProjectId(project.id);
                              }}
                              className="p-1 text-zinc-400 hover:text-[#E8590C] rounded transition"
                              title="Editar valor de precio"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Botón rápido "Pasar a En Curso / Ganado" para posibles proyectos */}
                      {isLead && (
                        <button
                          onClick={() => handleQuickConvertToActive(project)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition shadow-xs flex items-center gap-1 shrink-0 active:scale-95"
                          title="Convertir propuesta a proyecto activo en curso"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Activar</span>
                        </button>
                      )}
                    </div>

                    {/* Barra de Cobro & Pagos Reales */}
                    <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2">
                      <ProjectPaymentProgressBar
                        project={project}
                        incomes={incomes}
                        usdRate={usdRate}
                        privacyMode={privacyMode}
                        compact={true}
                        onOpenRegisterPayment={() => {
                          setSelectedProjectForPayment(project);
                          setShowRegisterPaymentModal(true);
                        }}
                      />
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProjectForPayment(project);
                            setShowRegisterPaymentModal(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1 transition active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Registrar pago</span>
                        </button>
                        {onNavigateToProject && (
                          <button
                            type="button"
                            onClick={() => onNavigateToProject(project.id)}
                            className="text-[11px] text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                          >
                            Ver detalle →
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Contact Direct Strip */}
                    {phone && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <a
                          href={formatWhatsAppUrl(phone, `Hola ${project.clientName}, te contacto sobre el proyecto.`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => hapticFeedback.light()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold transition active:scale-95"
                          title={`Enviar WhatsApp a ${project.clientName}`}
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                        <a
                          href={formatTelUrl(phone)}
                          onClick={() => hapticFeedback.light()}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold transition active:scale-95"
                          title={`Llamar a ${project.clientName}`}
                        >
                          <Phone className="w-3 h-3" />
                          <span>Llamar</span>
                        </a>
                      </div>
                    )}

                    {/* Progress Summary: Tasks, Meetings & Real Rentability */}
                    <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-2 text-[11px]">
                      {/* ProjectHealthBadge visible (Paso 6) */}
                      <ProjectHealthBadge
                        tasks={projTasks}
                        deliveryDate={project.deliveryDate}
                        showBar={true}
                        compact={true}
                        className="!p-2 !bg-zinc-900/60 !border-zinc-800"
                      />
                      <div className="flex items-center justify-between text-zinc-400 text-[10px] px-0.5">
                        <span className="flex items-center gap-1">
                          <CheckSquare className="w-3 h-3 text-[#E8590C]" />
                          {pendingTasks > 0 ? (
                            <span><strong className="text-amber-400">{pendingTasks} pend.</strong> ({projTasks.length - pendingTasks}/{projTasks.length})</span>
                          ) : projTasks.length > 0 ? (
                            <span className="text-emerald-400 font-semibold">Al día ({projTasks.length}/{projTasks.length})</span>
                          ) : (
                            <span>Sin tareas</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-400" />
                          <span>{projMeetings.length} reuniones</span>
                        </span>
                      </div>

                      {/* Financial Net Margin */}
                      <div className="pt-1.5 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500 font-medium">Rentabilidad Neta:</span>
                        <div className="flex items-center gap-2 font-mono font-bold">
                          {privacyMode ? (
                            <span className="text-zinc-400">$ ••••••</span>
                          ) : (
                            <>
                              {usdCobrado > 0 || usdGastos > 0 ? (
                                <span className={netUSD >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  US$ {netUSD.toLocaleString('es-AR')}
                                </span>
                              ) : null}
                              {arsCobrado > 0 || arsGastos > 0 ? (
                                <span className={netARS >= 0 ? 'text-sky-400' : 'text-red-400'}>
                                  $ {netARS.toLocaleString('es-AR')}
                                </span>
                              ) : null}
                              {usdCobrado === 0 && usdGastos === 0 && arsCobrado === 0 && arsGastos === 0 && (
                                <span className="text-zinc-500 font-normal">Sin cobros</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Freeform Notes Field with Auto-save */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Edit3 className="w-3 h-3 text-[#E8590C]" />
                          <span>Notas & Seguimiento:</span>
                        </span>
                        {savedNotesIndicator[project.id] && (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 animate-pulse">
                            <Check className="w-3 h-3" />
                            Guardado
                          </span>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        defaultValue={project.notes}
                        onBlur={e => handleNotesChange(project.id, e.target.value)}
                        placeholder="Anotar acuerdos, entregables pendientes o dudas del cliente..."
                        className="w-full text-xs text-zinc-200 bg-zinc-950/80 border border-zinc-800 rounded-xl p-2.5 focus:outline-none focus:border-[#E8590C]/60 transition leading-relaxed resize-none placeholder:text-zinc-600"
                      />
                    </div>
                  </div>

                  {/* Card Bottom: Ficha 360 CTA & Secondary Actions */}
                  <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                    <button
                      onClick={() => {
                        hapticFeedback.medium();
                        if (onNavigateToProject) {
                          onNavigateToProject(project.id);
                        } else {
                          setSelected360ProjectId(project.id);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-zinc-800/80 hover:bg-[#E8590C] hover:text-white border border-zinc-700/60 text-xs font-bold text-zinc-200 transition shadow-sm active:scale-[0.99] group"
                    >
                      <PieChart className="w-3.5 h-3.5 text-[#E8590C] group-hover:text-white transition" />
                      <span>Abrir Ficha 360° Completa</span>
                    </button>

                    <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
                      <span className="text-[11px]">
                        {isLead ? 'Propuesta comercial' : project.archived ? 'Archivado' : 'En producción'}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            hapticFeedback.light();
                            onToggleArchive(project.id);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 transition text-[11px] active:scale-95"
                          title={project.archived ? 'Desarchivar' : 'Archivar'}
                        >
                          {project.archived ? (
                            <>
                              <ArchiveRestore className="w-3 h-3 text-sky-400" />
                              <span>Desarchivar</span>
                            </>
                          ) : (
                            <>
                              <Archive className="w-3 h-3 text-zinc-400" />
                              <span>Archivar</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            hapticFeedback.warning();
                            setProjectToDelete(project);
                          }}
                          className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition active:scale-95"
                          title="Eliminar proyecto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Empty State */
        <div className="py-14 px-4 text-center flex flex-col items-center justify-center bg-zinc-900/60 border border-zinc-800/80 rounded-2xl shadow-md shadow-black/15">
          <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3 shadow-inner">
            <FolderKanban className="w-6 h-6 stroke-[1.75]" />
          </div>
          <h4 className="text-sm font-bold text-zinc-200">
            {tab === 'activos' 
              ? 'No tienes proyectos activos en este momento' 
              : tab === 'posibles' 
              ? 'No tienes posibles proyectos o cotizaciones abiertas' 
              : 'No hay proyectos archivados'}
          </h4>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
            {tab === 'activos'
              ? 'Crea un nuevo proyecto en ejecución o convierte una propuesta desde la pestaña "Posibles Proyectos".'
              : tab === 'posibles'
              ? 'Agrega cotizaciones con su valor estimado en USD/ARS para seguir las oportunidades de venta.'
              : 'Los proyectos que archives al finalizar una entrega se conservarán en este historial.'}
          </p>
          <button
            onClick={() => handleOpenAddModal(tab === 'posibles')}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E8590C] hover:bg-[#cf4d07] text-white text-xs font-bold transition shadow-md shadow-[#E8590C]/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{tab === 'posibles' ? 'Crear Posible Proyecto' : 'Crear Proyecto'}</span>
          </button>
        </div>
      )}

      {/* 5. Modal: Nuevo Proyecto / Posible Proyecto */}
      {showAddModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md sm:max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 sm:px-5 sm:py-3.5 shrink-0 bg-zinc-900">
              <h3 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-[#E8590C]" />
                <span>
                  {serviceMode === 'paf'
                    ? (newIsLead ? 'Nuevo Lead / Entrevista PAF' : 'Registrar Cliente Arquitecto (PAF)')
                    : (newIsLead ? 'Nuevo Posible Proyecto / Cotización' : 'Nuevo Proyecto Activo')}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm font-bold p-1 rounded-lg hover:bg-zinc-800 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-3.5 sm:p-4 overflow-y-auto space-y-3 custom-scrollbar flex-1">
              {/* Type Switcher */}
              {/* Classification */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1 uppercase tracking-wider">
                  {serviceMode === 'paf' ? 'Estado del Cliente Arquitecto' : 'Clasificación del Registro'}
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.selection();
                      setNewIsLead(false);
                      if (newStatus === 'Posible proyecto' || newStatus === 'Propuesta enviada' || newStatus === 'En negociación') {
                        setNewStatus('En curso');
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      !newIsLead
                        ? serviceMode === 'paf' ? 'bg-[#E8590C] text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <span>{serviceMode === 'paf' ? '🏛️ Cliente Arquitecto Activo' : '🚀 Proyecto Activo'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.selection();
                      setNewIsLead(true);
                      if (newStatus === 'En curso') {
                        setNewStatus('Posible proyecto');
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      newIsLead
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <span>{serviceMode === 'paf' ? '💬 Lead / Entrevista' : '💡 Posible Proyecto'}</span>
                  </button>
                </div>
              </div>

              {/* Client Name */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1 uppercase tracking-wider">
                  {serviceMode === 'paf' ? 'Nombre del Arquitecto / Estudio *' : 'Nombre del Cliente o Proyecto *'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={serviceMode === 'paf' ? 'ej. Arq. Martín Cane / Cane Arquitectura' : 'ej. Estudio Cane Web Corporativa'}
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  className="w-full text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                />
              </div>

              {/* Service / Program Selector */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                  {serviceMode === 'paf' ? 'Modalidad del Programa PAF' : 'Tipo de Proyecto Web'}
                </label>
                {serviceMode === 'paf' ? (
                  <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950 border border-zinc-800 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.selection();
                        setNewProjectType('paf_pro');
                        if (!newEstimatedPrice) setNewEstimatedPrice(1800);
                      }}
                      className={`py-2 px-3 rounded-lg font-bold transition text-center ${
                        newProjectType === 'paf_pro'
                          ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="font-bold">PAF Pro (12 Sem)</div>
                      <div className="text-[10px] opacity-80">26hs 1:1 · Aceleración Total</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.selection();
                        setNewProjectType('paf_base');
                        if (!newEstimatedPrice) setNewEstimatedPrice(950);
                      }}
                      className={`py-2 px-3 rounded-lg font-bold transition text-center ${
                        newProjectType === 'paf_base'
                          ? 'bg-blue-500 text-white shadow-sm font-extrabold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="font-bold">PAF Base</div>
                      <div className="text-[10px] opacity-80">Contenido & Plantillas</div>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-zinc-950 border border-zinc-800 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.selection();
                        setNewProjectType('web');
                      }}
                      className={`py-1.5 px-2 rounded-lg font-bold transition text-center truncate ${
                        newProjectType === 'web'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Web Corporativa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.selection();
                        setNewProjectType('web');
                      }}
                      className={`py-1.5 px-2 rounded-lg font-bold transition text-center truncate ${
                        newProjectType === 'web'
                          ? 'text-zinc-400 hover:text-zinc-200'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Landing Page
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.selection();
                        setNewProjectType('web');
                      }}
                      className="py-1.5 px-2 rounded-lg font-bold transition text-center truncate text-zinc-400 hover:text-zinc-200"
                    >
                      E-Commerce
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.selection();
                        setNewProjectType('otro');
                      }}
                      className={`py-1.5 px-2 rounded-lg font-bold transition text-center truncate ${
                        newProjectType === 'otro'
                          ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Otro Proyecto
                    </button>
                  </div>
                )}
              </div>

              {/* Si es PAF, configuración de etapa y plan */}
              {(newProjectType === 'paf_pro' || newProjectType === 'paf_base') && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Configuración Método PAF</span>
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200">
                      {newProjectType === 'paf_pro' ? '26hs Consultoría 1:1' : 'Acceso Base'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1 uppercase">
                        Etapa Inicial
                      </label>
                      <select
                        value={newPafStage}
                        onChange={e => setNewPafStage(e.target.value as PafStage)}
                        className="w-full text-xs text-zinc-100 bg-zinc-950 border border-amber-500/30 rounded-lg p-2 focus:outline-none focus:border-amber-400"
                      >
                        {PAF_STAGES.map(s => (
                          <option key={s} value={s} className="bg-zinc-900">
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-1 uppercase">
                        Plan de Pagos
                      </label>
                      <select
                        value={newPafPlan}
                        onChange={e => setNewPafPlan(e.target.value as any)}
                        className="w-full text-xs text-zinc-100 bg-zinc-950 border border-amber-500/30 rounded-lg p-2 focus:outline-none focus:border-amber-400"
                      >
                        <option value="3_pagos">3 cuotas mensuales</option>
                        <option value="2_pagos">2 cuotas</option>
                        <option value="1_pago">1 pago total anticipado</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Valor de Precio / Presupuesto Estimado */}
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/90 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5 uppercase">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Valor de Precio / Presupuesto {newIsLead ? '(Estimado)' : ''}</span>
                  </label>
                  <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setNewEstimatedCurrency('USD')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                        newEstimatedCurrency === 'USD'
                          ? 'bg-[#E8590C] text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      USD $
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewEstimatedCurrency('ARS')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                        newEstimatedCurrency === 'ARS'
                          ? 'bg-[#E8590C] text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      ARS $
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
                    {newEstimatedCurrency === 'USD' ? 'US$' : '$'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="ej. 1500 (monto cotizado)"
                    value={newEstimatedPrice}
                    onChange={e => setNewEstimatedPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-[#E8590C]"
                  />
                </div>
              </div>

              {/* Cronograma: Fecha de Arranque / Confirmación y Plazos */}
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/90 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5 uppercase">
                    <Calendar className="w-3.5 h-3.5 text-[#E8590C]" />
                    <span>Cronograma de Arranque & Duración</span>
                  </label>
                  {(newProjectType === 'paf_pro' || newProjectType === 'paf_base') && (
                    <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      Ciclo PAF: 3 meses
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-1 uppercase tracking-wider">
                      Fecha en que arrancaría / confirmó:
                    </label>
                    <input
                      type="date"
                      value={newStartDate}
                      onChange={e => {
                        const val = e.target.value;
                        setNewStartDate(val);
                        if ((newProjectType === 'paf_pro' || newProjectType === 'paf_base') && val) {
                          setNewDeliveryDate(addMonths(val, 3));
                        }
                      }}
                      className="w-full text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#E8590C]"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1 leading-tight">
                      ej. Si confirmó en Octubre o arranca el mes próximo, empieza a contar meses desde ahí.
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-1 uppercase tracking-wider">
                      {(newProjectType === 'paf_pro' || newProjectType === 'paf_base') 
                        ? 'Fin PAF (calculado a 3 meses):' 
                        : 'Fecha Límite de Entrega (Web):'}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={newDeliveryDate}
                        onChange={e => setNewDeliveryDate(e.target.value)}
                        className="w-full text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#E8590C]"
                      />
                      {(newProjectType === 'paf_pro' || newProjectType === 'paf_base') && (
                        <button
                          type="button"
                          onClick={() => {
                            if (newStartDate) setNewDeliveryDate(addMonths(newStartDate, 3));
                          }}
                          className="px-2 py-2 rounded-xl text-[10px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 shrink-0 transition"
                          title="Restablecer a 3 meses exactos"
                        >
                          +3m
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-tight">
                      {(newProjectType === 'paf_pro' || newProjectType === 'paf_base')
                        ? 'Establece automáticamente el ciclo intensivo de 3 meses (12 semanas).'
                        : 'Fecha pactada para finalizar y entregar la web.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status & Phone in Responsive Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1 uppercase tracking-wider">
                    Estado Inicial
                  </label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                    className="w-full text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#E8590C]"
                  >
                    {DEFAULT_PROJECT_STATUSES.map(st => (
                      <option key={st} value={st} className="bg-zinc-900">
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1 uppercase tracking-wider">
                    WhatsApp / Teléfono (opcional)
                  </label>
                  <input
                    type="tel"
                    placeholder="ej. +54 9 11 2345-6789"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    className="w-full text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#E8590C]"
                  />
                </div>
              </div>

              {/* Initial Notes */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1 uppercase tracking-wider">
                  Notas / Acuerdos Iniciales (opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder={serviceMode === 'paf' ? "ej. Objetivo principal del arquitecto, enlace a portfolio..." : "ej. Falta que envíen el logo en SVG y fotos de alta calidad..."}
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  className="w-full text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 focus:outline-none focus:border-[#E8590C] resize-none"
                />
              </div>

              <div className="pt-2.5 border-t border-zinc-800/90 flex items-center justify-end gap-2 bg-zinc-900 sticky bottom-0 z-10 pb-1">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E8590C] hover:bg-[#cf4d07] text-white transition shadow-md shadow-[#E8590C]/20 active:scale-95 flex items-center gap-1.5"
                >
                  <span>Guardar {newIsLead ? 'Lead' : (serviceMode === 'paf' ? 'Cliente Arquitecto' : 'Proyecto')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>
    )}

      {/* Info Popover / Modal for Projects */}
      {showInfoModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#E8590C]" />
                <h3 className="text-sm font-bold text-zinc-100">
                  Control & Pipeline de Proyectos
                </h3>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-zinc-300 space-y-2.5 leading-relaxed">
              <p>
                <b>Posibles Proyectos:</b> Registrá propuestas comerciales y cotizaciones con su valor estimado en USD o ARS. Cuando el cliente aprueba la propuesta, hacé clic en <b>«Activar»</b> para convertirlo en un proyecto en curso.
              </p>
              <p>
                <b>Proyectos Activos:</b> Seguimiento integral con notas automáticas, tareas vinculadas, reuniones de agenda y rentabilidad neta real.
              </p>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 transition cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      </ModalPortal>
    )}

      {/* Ficha 360 Modal */}
      {selected360Project && (
        <ProjectFicha360Modal
          isOpen={true}
          onClose={() => setSelected360ProjectId(null)}
          project={selected360Project}
          tasks={tasks}
          meetings={meetings}
          incomes={incomes}
          expenses={expenses}
          onUpdateProject={onUpdateProject}
          onToggleArchive={onToggleArchive}
          onDeleteProject={onDeleteProject}
          onAddTask={onAddTask}
          onToggleTask={onToggleTask}
          onDeleteTask={onDeleteTask}
          onToggleSubtask={onToggleSubtask}
          onAddSubtask={onAddSubtask}
          onDeleteSubtask={onDeleteSubtask}
          onAddMeeting={onAddMeeting}
          onToggleMeeting={onToggleMeeting}
          onDeleteMeeting={onDeleteMeeting}
          onAddIncome={onAddIncome}
          onToggleIncomeStatus={onToggleIncomeStatus}
          onDeleteIncome={onDeleteIncome}
          onAddExpense={onAddExpense}
          onToggleExpenseStatus={onToggleExpenseStatus}
          onDeleteExpense={onDeleteExpense}
          timeLogs={timeLogs}
          onAddTimeLog={onAddTimeLog}
          onDeleteTimeLog={onDeleteTimeLog}
          privacyMode={privacyMode}
        />
      )}

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 t-modal-enter">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">¿Eliminar registro?</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Se eliminará permanentemente <span className="font-bold text-zinc-200">«{projectToDelete.clientName}»</span>. Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => setProjectToDelete(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    hapticFeedback.warning();
                    onDeleteProject(projectToDelete.id);
                    setProjectToDelete(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition shadow-lg shadow-red-600/25 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Definitivamente</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* New PAF Architecture Studio Client Modal */}
      <NewPafClientModal
        isOpen={showNewPafModal}
        onClose={() => setShowNewPafModal(false)}
        onAddProject={onAddProject}
        defaultProjectType="paf_pro"
      />

      {/* PAF Pricing Configuration Modal */}
      <PafPricingConfigModal
        isOpen={showPafPricingModal}
        onClose={() => setShowPafPricingModal(false)}
      />

      {/* Internal InCallDrawer if not handled by root layout */}
      {!onOpenInCallDrawer && (
        <InCallDrawer
          isOpen={internalInCallDrawerOpen}
          onClose={() => setInternalInCallDrawerOpen(false)}
          projects={projects}
          initialProjectId={internalInCallDrawerProjectId}
          onUpdateProject={onUpdateProject}
        />
      )}

      {/* Quick Register Payment Modal */}
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
          onSavePayment={handleSavePaymentForProject}
          onDeletePayment={(paymentId) => {
            if (onDeletePayment && selectedProjectForPayment) {
              onDeletePayment(selectedProjectForPayment.id, paymentId);
            }
          }}
        />
      )}

      {/* Suggest Retainer Modal */}
      {selectedProjectForRetainer && (
        <SuggestRetainerModal
          isOpen={showSuggestRetainerModal}
          onClose={() => {
            setShowSuggestRetainerModal(false);
            setSelectedProjectForRetainer(null);
          }}
          project={selectedProjectForRetainer}
          onSaveRecurring={handleSaveRetainerPlan}
        />
      )}

      {/* Modal de Abono Recurrente / Retainer Limpio */}
      {showRegisterFixedContractModal && (
        <RegisterRecurringIncomeModal
          isOpen={showRegisterFixedContractModal}
          onClose={() => setShowRegisterFixedContractModal(false)}
          projects={projects}
          onSaveRecurringPlan={(plan, targetProjectId) => {
            if (targetProjectId) {
              const target = projects.find(p => p.id === targetProjectId);
              if (target) {
                const existing = target.recurringPlans || [];
                onUpdateProject(targetProjectId, { recurringPlans: [...existing, plan] });
              }
            } else {
              saveStandaloneRetainer(plan);
            }
            setShowRegisterFixedContractModal(false);
          }}
        />
      )}
    </div>
  );
};
