import React, { useState, useEffect } from 'react';
import { ModalPortal } from './ModalPortal';
import { taskBelongsToProject } from '../utils/taskProject';
import { 
  Project, 
  AgendaTask, 
  AgendaMeeting, 
  IncomeRecord, 
  ExpenseRecord, 
  DEFAULT_PROJECT_STATUSES,
  SubTask,
  DEFAULT_EXPENSE_CATEGORIES,
  TimeLog,
  ProjectKeyLink,
  PafMilestone,
  ProjectType,
  PAF_STAGES,
  PafStage,
  PafConsultingSession
} from '../types';
import { 
  X, 
  FolderKanban, 
  CheckSquare, 
  Calendar, 
  DollarSign, 
  TrendingDown, 
  TrendingUp, 
  MessageCircle, 
  Phone, 
  Plus, 
  Clock, 
  CheckCircle2, 
  Circle, 
  ListTodo, 
  Trash2, 
  Edit3, 
  Save, 
  Check, 
  Archive, 
  ArchiveRestore,
  PieChart,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Link2,
  Award,
  Sparkles,
  Target,
  Compass,
  Zap,
  ExternalLink,
  Building2,
  Instagram,
  MapPin,
  User,
  Globe,
  RotateCcw
} from 'lucide-react';
import { formatWhatsAppUrl, formatTelUrl, extractPhoneFromText } from '../utils/contact';
import { hapticFeedback } from '../utils/haptics';
import { getTodayString, getMonthKey, addDays } from '../utils/storage';
import { toSafeDateString } from '../utils/dates';
import { playTaskDone } from '../utils/sound';
import { PaymentPlanManager } from './PaymentPlanManager';
import { 
  PAF_PRO_MILESTONES, 
  PAF_BASE_MILESTONES, 
  PAF_PRO_PRICING, 
  PAF_BASE_PRICING, 
  PAF_LEAD_SCORING_INFO 
} from '../utils/pafTemplates';
import { ProjectKeyLinks } from './ProjectKeyLinks';
import { TimeTrackerSection } from './TimeTrackerSection';
import { ProjectTimelineBadge } from './ProjectTimelineBadge';
import { addMonths } from '../utils/projectTimeline';
import { formatProjectPrice, resolveProjectCurrency } from '../utils/paymentPlans';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  incomes: IncomeRecord[];
  expenses: ExpenseRecord[];
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onToggleArchive: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onAddTask: (task: Omit<AgendaTask, 'id' | 'createdAt'>) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onAddSubtask?: (taskId: string, title: string) => void;
  onDeleteSubtask?: (taskId: string, subtaskId: string) => void;
  onAddMeeting: (meeting: Omit<AgendaMeeting, 'id' | 'createdAt'>) => void;
  onToggleMeeting: (meetingId: string) => void;
  onDeleteMeeting: (meetingId: string) => void;
  onAddIncome: (income: Omit<IncomeRecord, 'id' | 'createdAt'>) => void;
  onToggleIncomeStatus: (id: string) => void;
  onDeleteIncome: (id: string) => void;
  onAddExpense: (expense: Omit<ExpenseRecord, 'id' | 'createdAt'>) => void;
  onToggleExpenseStatus: (id: string) => void;
  onDeleteExpense: (id: string) => void;
  timeLogs?: TimeLog[];
  onAddTimeLog?: (log: Omit<TimeLog, 'id' | 'createdAt'>) => void;
  onDeleteTimeLog?: (id: string) => void;
  privacyMode?: boolean;
}

export const ProjectFicha360Modal: React.FC<Props> = ({
  isOpen,
  onClose,
  project,
  tasks,
  meetings,
  incomes,
  expenses,
  onUpdateProject,
  onToggleArchive,
  onDeleteProject,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  onAddMeeting,
  onToggleMeeting,
  onDeleteMeeting,
  onAddIncome,
  onToggleIncomeStatus,
  onDeleteIncome,
  onAddExpense,
  onToggleExpenseStatus,
  onDeleteExpense,
  timeLogs = [],
  onAddTimeLog,
  onDeleteTimeLog,
  privacyMode = false,
}) => {
  if (!isOpen) return null;

  const isPaf = project.projectType === 'paf_pro' || project.projectType === 'paf_base';

  const [activeSubTab, setActiveSubTab] = useState<'resumen' | 'paf' | 'horas' | 'enlaces' | 'tareas' | 'reuniones' | 'finanzas' | 'notas' | 'web_cobros'>(
    isPaf ? 'paf' : 'web_cobros'
  );
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);

  // Quick Inline Creation States
  const [showNewTaskInput, setShowNewTaskInput] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(getTodayString());

  const [showNewMeetingInput, setShowNewMeetingInput] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState(`Reunión con ${project.clientName}`);
  const [newMeetingDate, setNewMeetingDate] = useState(getTodayString());
  const [newMeetingTime, setNewMeetingTime] = useState('');
  const [newMeetingNotes, setNewMeetingNotes] = useState('');

  const [showNewIncomeInput, setShowNewIncomeInput] = useState(false);
  const [newIncomeConcept, setNewIncomeConcept] = useState('');
  const [newIncomeAmount, setNewIncomeAmount] = useState<number | ''>('');
  const [newIncomeCurrency, setNewIncomeCurrency] = useState<'USD' | 'ARS'>('USD');
  const [newIncomeStatus, setNewIncomeStatus] = useState<'cobrado' | 'pendiente'>('cobrado');

  const [showNewExpenseInput, setShowNewExpenseInput] = useState(false);
  const [newExpenseConcept, setNewExpenseConcept] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [newExpenseAmount, setNewExpenseAmount] = useState<number | ''>('');
  const [newExpenseCurrency, setNewExpenseCurrency] = useState<'USD' | 'ARS'>('USD');
  const [newExpenseStatus, setNewExpenseStatus] = useState<'pagado' | 'pendiente'>('pagado');

  // Inline subtask input for expanded tasks
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [inlineSubtaskText, setInlineSubtaskText] = useState('');

  // Project Notes Editing
  const [notesDraft, setNotesDraft] = useState(project.notes);
  const [notesSaved, setNotesSaved] = useState(false);

  // Estimated Price / Presupuesto Editing
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState<number | ''>(project.estimatedPrice ?? '');
  const [currencyDraft, setCurrencyDraft] = useState<'USD' | 'ARS'>(project.estimatedCurrency || 'USD');

  // Studio Architecture & Social Media Info Editing
  const [isEditingStudioInfo, setIsEditingStudioInfo] = useState(false);
  const [ownerNameDraft, setOwnerNameDraft] = useState(project.ownerName || '');
  const [instagramDraft, setInstagramDraft] = useState(project.instagramUrl || '');
  const [googleMapsDraft, setGoogleMapsDraft] = useState(project.googleMapsUrl || '');

  // Sincronizar borradores cuando el proyecto cambia en tiempo real desde Firestore u otro dispositivo
  useEffect(() => {
    setNotesDraft(project.notes || '');
    if (!isEditingPrice) {
      setPriceDraft(project.estimatedPrice ?? '');
      setCurrencyDraft(project.estimatedCurrency || 'USD');
    }
    if (!isEditingStudioInfo) {
      setOwnerNameDraft(project.ownerName || '');
      setInstagramDraft(project.instagramUrl || '');
      setGoogleMapsDraft(project.googleMapsUrl || '');
    }
  }, [
    project.id,
    project.notes,
    project.estimatedPrice,
    project.estimatedCurrency,
    project.ownerName,
    project.instagramUrl,
    project.googleMapsUrl,
    isEditingPrice,
    isEditingStudioInfo,
  ]);

  const handleSaveStudioInfo = () => {
    onUpdateProject(project.id, {
      ownerName: ownerNameDraft.trim() || undefined,
      instagramUrl: instagramDraft.trim() || undefined,
      googleMapsUrl: googleMapsDraft.trim() || undefined,
    });
    setIsEditingStudioInfo(false);
    hapticFeedback.success();
  };

  // Consulting Sessions 1:1 Logging State
  const [showNewConsultingSession, setShowNewConsultingSession] = useState(false);
  const [consultingDate, setConsultingDate] = useState(getTodayString());
  const [consultingHours, setConsultingHours] = useState<number>(1.5);
  const [consultingTopic, setConsultingTopic] = useState('');
  const [consultingNotes, setConsultingNotes] = useState('');

  const handleAddConsultingSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultingTopic.trim()) return;

    const currentSessions = project.consultingSessions || [];
    const newSession: PafConsultingSession = {
      id: `cs_${Date.now()}`,
      date: consultingDate || getTodayString(),
      hours: Number(consultingHours) || 1,
      durationHours: Number(consultingHours) || 1,
      topic: consultingTopic.trim(),
      topics: consultingTopic.trim(),
      notes: consultingNotes.trim() || undefined,
      completed: true,
      createdAt: getTodayString(),
    };
    const updatedSessions = [newSession, ...currentSessions];
    const totalHours = updatedSessions.reduce((acc, s) => acc + (s.hours || s.durationHours || 0), 0);

    onUpdateProject(project.id, {
      consultingSessions: updatedSessions,
      pafConsultingHoursDone: Math.round(totalHours * 10) / 10,
    });

    setConsultingTopic('');
    setConsultingNotes('');
    setConsultingHours(1.5);
    setShowNewConsultingSession(false);
    hapticFeedback.success();
  };

  const handleDeleteConsultingSession = (sessionId: string) => {
    const currentSessions = project.consultingSessions || [];
    const updatedSessions = currentSessions.filter(s => s.id !== sessionId);
    const totalHours = updatedSessions.reduce((acc, s) => acc + (s.hours || s.durationHours || 0), 0);

    onUpdateProject(project.id, {
      consultingSessions: updatedSessions,
      pafConsultingHoursDone: Math.round(totalHours * 10) / 10,
    });
    hapticFeedback.light();
  };

  const handleSavePrice = () => {
    onUpdateProject(project.id, {
      estimatedPrice: priceDraft === '' ? undefined : Number(priceDraft),
      estimatedCurrency: currencyDraft,
    });
    setIsEditingPrice(false);
    hapticFeedback.success();
  };

  const handleConvertToActive = () => {
    onUpdateProject(project.id, {
      isLead: false,
      status: 'En curso',
    });
    hapticFeedback.success();
  };

  // Filter items linked to this project
  const projectTasks = tasks.filter(t => taskBelongsToProject(t, project));
  const projectMeetings = meetings.filter(m => m.projectId === project.id || (!m.projectId && m.title.toLowerCase().includes(project.clientName.toLowerCase())));
  const projectIncomes = incomes.filter(i => i.projectId === project.id || (!i.projectId && i.title.toLowerCase().includes(project.clientName.toLowerCase())));
  const projectExpenses = expenses.filter(e => e.projectId === project.id || (!e.projectId && e.title.toLowerCase().includes(project.clientName.toLowerCase())));

  // Financial Metrics
  const incomeUSDTotal = projectIncomes.filter(i => i.currency === 'USD').reduce((acc, i) => acc + i.amount, 0);
  const incomeUSDCobrado = projectIncomes.filter(i => i.currency === 'USD' && i.status === 'cobrado').reduce((acc, i) => acc + i.amount, 0);
  const incomeUSDPendiente = projectIncomes.filter(i => i.currency === 'USD' && i.status === 'pendiente').reduce((acc, i) => acc + i.amount, 0);

  const incomeARSTotal = projectIncomes.filter(i => i.currency === 'ARS').reduce((acc, i) => acc + i.amount, 0);
  const incomeARSCobrado = projectIncomes.filter(i => i.currency === 'ARS' && i.status === 'cobrado').reduce((acc, i) => acc + i.amount, 0);
  const incomeARSPendiente = projectIncomes.filter(i => i.currency === 'ARS' && i.status === 'pendiente').reduce((acc, i) => acc + i.amount, 0);

  const expenseUSDTotal = projectExpenses.filter(e => e.currency === 'USD').reduce((acc, e) => acc + e.amount, 0);
  const expenseUSDPagado = projectExpenses.filter(e => e.currency === 'USD' && e.status === 'pagado').reduce((acc, e) => acc + e.amount, 0);

  const expenseARSTotal = projectExpenses.filter(e => e.currency === 'ARS').reduce((acc, e) => acc + e.amount, 0);
  const expenseARSPagado = projectExpenses.filter(e => e.currency === 'ARS' && e.status === 'pagado').reduce((acc, e) => acc + e.amount, 0);

  // Rentabilidad neta (Cobrado - Pagado)
  const netUSD = incomeUSDCobrado - expenseUSDPagado;
  const netARS = incomeARSCobrado - expenseARSPagado;

  const phone = project.clientPhone || extractPhoneFromText(project.notes);

  const formatMoney = (amount: number, currency: 'USD' | 'ARS') => {
    if (privacyMode) return '$ ••••••';
    const effectiveCurr = resolveProjectCurrency(currency, amount);
    const prefix = amount < 0 ? '-' : '';
    return `${prefix}${formatProjectPrice(Math.abs(amount), effectiveCurr)}`;
  };

  const handleSaveNotes = () => {
    onUpdateProject(project.id, { notes: notesDraft });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask({
      title: newTaskTitle.trim(),
      date: newTaskDate,
      completed: false,
      projectId: project.id,
      projectName: project.clientName,
    });
    setNewTaskTitle('');
    setShowNewTaskInput(false);
  };

  const handleCreateMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeetingTitle.trim()) return;
    onAddMeeting({
      title: newMeetingTitle.trim(),
      date: newMeetingDate,
      time: newMeetingTime || undefined,
      notes: newMeetingNotes || undefined,
      completed: false,
      clientPhone: phone,
      projectId: project.id,
      projectName: project.clientName,
    });
    setNewMeetingTitle(`Reunión con ${project.clientName}`);
    setNewMeetingTime('');
    setNewMeetingNotes('');
    setShowNewMeetingInput(false);
  };

  const handleCreateIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncomeConcept.trim() || !newIncomeAmount || Number(newIncomeAmount) <= 0) return;
    const today = getTodayString();
    onAddIncome({
      title: `${project.clientName} - ${newIncomeConcept.trim()}`,
      amount: Number(newIncomeAmount),
      currency: newIncomeCurrency,
      date: today,
      month: getMonthKey(today),
      status: newIncomeStatus,
      projectId: project.id,
      projectName: project.clientName,
    });
    setNewIncomeConcept('');
    setNewIncomeAmount('');
    setShowNewIncomeInput(false);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseConcept.trim() || !newExpenseAmount || Number(newExpenseAmount) <= 0) return;
    const today = getTodayString();
    onAddExpense({
      title: newExpenseConcept.trim(),
      category: newExpenseCategory,
      amount: Number(newExpenseAmount),
      currency: newExpenseCurrency,
      date: today,
      month: getMonthKey(today),
      status: newExpenseStatus,
      projectId: project.id,
      projectName: project.clientName,
    });
    setNewExpenseConcept('');
    setNewExpenseAmount('');
    setShowNewExpenseInput(false);
  };

  const handleAddInlineSubtask = (taskId: string) => {
    if (!inlineSubtaskText.trim() || !onAddSubtask) return;
    onAddSubtask(taskId, inlineSubtaskText.trim());
    setInlineSubtaskText('');
  };

  // PAF & KeyLinks Handlers
  const handleLoadPafMilestones = (type: 'paf_pro' | 'paf_base') => {
    const templates = type === 'paf_pro' ? PAF_PRO_MILESTONES : PAF_BASE_MILESTONES;
    const newMilestones: PafMilestone[] = templates.map((m, idx) => ({
      id: `paf_m${m.month}_${idx}`,
      month: m.month,
      pillar: m.pillar,
      title: m.title,
      week: m.week,
      description: m.description,
      completed: false,
    }));
    onUpdateProject(project.id, { 
      pafMilestones: newMilestones, 
      projectType: type,
      pafConsultingHoursTotal: type === 'paf_pro' ? 26 : undefined,
    });
    hapticFeedback.success();
    playTaskDone();
  };

  const handleTogglePafMilestone = (milestoneId: string) => {
    const current = project.pafMilestones || [];
    const updated = current.map(m => m.id === milestoneId ? { ...m, completed: !m.completed } : m);
    onUpdateProject(project.id, { pafMilestones: updated });
    hapticFeedback.light();
    playTaskDone();
  };

  const handleGeneratePafInstallments = (planId: '1_pago' | '2_pagos' | '3_pagos', tier: 'paf_pro' | 'paf_base') => {
    const pricingList = tier === 'paf_pro' ? PAF_PRO_PRICING : PAF_BASE_PRICING;
    const plan = pricingList.find(p => p.id === planId);
    if (!plan) return;

    const today = getTodayString();
    onUpdateProject(project.id, {
      estimatedPrice: plan.totalAmount,
      estimatedCurrency: 'ARS',
      pafPlan: planId,
    });

    // Create installment income records
    for (let i = 0; i < plan.installments; i++) {
      const dueDate = addDays(today, i * 30);
      onAddIncome({
        title: `${project.clientName} - Cuota ${i + 1}/${plan.installments} (${plan.name})`,
        amount: plan.installmentAmount,
        currency: 'ARS',
        date: dueDate,
        month: getMonthKey(dueDate),
        status: i === 0 ? 'cobrado' : 'pendiente',
        projectId: project.id,
        projectName: project.clientName,
      });
    }

    hapticFeedback.success();
    playTaskDone();
  };

  const handleUpdateProjectConsultingHours = (hours: number) => {
    onUpdateProject(project.id, { pafConsultingHoursDone: hours });
  };

  const handleUpdateKeyLinks = (links: ProjectKeyLink[]) => {
    onUpdateProject(project.id, { keyLinks: links });
  };

  // Web 50/50 Payment Handlers (Simple, Direct)
  const webTotalPrice = project.estimatedPrice || 0;
  const webCurrency = project.estimatedCurrency || 'USD';
  const webHalfPrice1 = Math.round(webTotalPrice / 2);
  const webHalfPrice2 = webTotalPrice - webHalfPrice1;

  // Find or derive the 2 installments for web
  const webInst1 = project.installments?.find(i => i.number === 1) || {
    id: `${project.id}-inst-1`,
    number: 1,
    amount: webHalfPrice1,
    dueDate: project.startDate || getTodayString(),
    paid: false,
    currency: webCurrency,
    note: '50% Anticipo Inicial'
  };

  const webInst2 = project.installments?.find(i => i.number === 2) || {
    id: `${project.id}-inst-2`,
    number: 2,
    amount: webHalfPrice2,
    dueDate: project.deliveryDate || '',
    paid: false,
    currency: webCurrency,
    note: '50% Saldo al Finalizar'
  };

  const handleToggleWebPayment = (stage: 1 | 2) => {
    const isStage1 = stage === 1;
    const targetInst = isStage1 ? webInst1 : webInst2;
    const newPaidStatus = !targetInst.paid;
    const today = getTodayString();

    const updatedInstallments = [
      {
        id: `${project.id}-inst-1`,
        number: 1,
        amount: webHalfPrice1,
        dueDate: project.startDate || today,
        paid: isStage1 ? newPaidStatus : webInst1.paid,
        paidAt: isStage1 ? (newPaidStatus ? today : undefined) : webInst1.paidAt,
        currency: webCurrency,
        note: '50% Anticipo Inicial'
      },
      {
        id: `${project.id}-inst-2`,
        number: 2,
        amount: webHalfPrice2,
        dueDate: project.deliveryDate || '',
        paid: !isStage1 ? newPaidStatus : webInst2.paid,
        paidAt: !isStage1 ? (newPaidStatus ? today : undefined) : webInst2.paidAt,
        currency: webCurrency,
        note: '50% Saldo al Finalizar'
      }
    ];

    onUpdateProject(project.id, { installments: updatedInstallments });

    // Sync corresponding IncomeRecord if it exists, or create if marked paid
    const stageKeyword = isStage1 ? 'anticipo' : 'saldo';
    const existingIncome = projectIncomes.find(i => 
      i.title.toLowerCase().includes(stageKeyword) || i.title.toLowerCase().includes(`instancia ${stage}`)
    );

    if (existingIncome) {
      if ((existingIncome.status === 'cobrado') !== newPaidStatus) {
        onToggleIncomeStatus(existingIncome.id);
      }
    } else if (newPaidStatus) {
      onAddIncome({
        title: `${project.clientName} - Web 50% ${isStage1 ? 'Anticipo' : 'Saldo Final'}`,
        amount: isStage1 ? webHalfPrice1 : webHalfPrice2,
        currency: webCurrency,
        date: today,
        month: getMonthKey(today),
        status: 'cobrado',
        projectId: project.id,
        projectName: project.clientName,
      });
    }

    hapticFeedback.success();
    playTaskDone();
  };

  const handleSetWebPricePreset = (price: number, currency: 'USD' | 'ARS' = 'USD') => {
    const half1 = Math.round(price / 2);
    const half2 = price - half1;
    const updatedInstallments = [
      {
        ...webInst1,
        amount: half1,
        currency,
      },
      {
        ...webInst2,
        amount: half2,
        currency,
      }
    ];
    onUpdateProject(project.id, {
      estimatedPrice: price,
      estimatedCurrency: currency,
      installments: updatedInstallments,
    });
    hapticFeedback.selection();
  };

  // Safe active tab resolution for Web mode
  const effectiveTab = !isPaf && (activeSubTab === 'paf' || activeSubTab === 'horas' || activeSubTab === 'enlaces' || activeSubTab === 'reuniones' || activeSubTab === 'resumen' || activeSubTab === 'finanzas')
    ? 'web_cobros'
    : activeSubTab;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-4xl lg:max-w-5xl w-full my-auto shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950/60 flex items-start justify-between gap-3 shrink-0">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 uppercase tracking-wider">
                <FolderKanban className="w-3 h-3" />
                Ficha 360° de Proyecto
              </span>

              {/* Status Selector */}
              <select
                value={project.status}
                onChange={e => onUpdateProject(project.id, { status: e.target.value })}
                className="text-xs font-semibold px-2 py-0.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-[var(--accent)]"
              >
                {DEFAULT_PROJECT_STATUSES.map(st => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              {/* Project Type Selector (PAF Pro, PAF Base, etc.) */}
              <select
                value={project.projectType || 'otro'}
                onChange={e => onUpdateProject(project.id, { projectType: e.target.value as ProjectType })}
                className="text-xs font-semibold px-2 py-0.5 rounded-lg border border-amber-500/40 bg-zinc-900 text-amber-300 focus:outline-none focus:border-amber-400"
              >
                <option value="paf_pro">⭐ Método PAF Pro (12s)</option>
                <option value="paf_base">PAF Base (Adquisición)</option>
                <option value="web">Web / Landing Page</option>
                <option value="otro">Otro Proyecto</option>
              </select>

              {/* Lead Scoring (A / B / C) */}
              <select
                value={project.leadScore || ''}
                onChange={e => onUpdateProject(project.id, { leadScore: (e.target.value as any) || undefined })}
                className="text-xs font-semibold px-2 py-0.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 focus:outline-none focus:border-[var(--accent)]"
                title="Lead Scoring para arquitectos (A = Terreno + Plazo + Presupuesto)"
              >
                <option value="">Scoring Lead…</option>
                <option value="A">⭐ Lead A (Calificado)</option>
                <option value="B">🟡 Lead B (Potencial)</option>
                <option value="C">⚪ Lead C (Curioso)</option>
              </select>

              {/* Lead vs Active Badge */}
              {project.isLead ? (
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    💡 Posible Proyecto
                  </span>
                  <button
                    type="button"
                    onClick={handleConvertToActive}
                    className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition flex items-center gap-1 shadow-xs"
                    title="Convertir a Proyecto Activo (Ganado)"
                  >
                    <span>✨ Ganado / Activar</span>
                  </button>
                </div>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  🚀 Proyecto Activo
                </span>
              )}

              {project.archived && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Archivado
                </span>
              )}

              {/* Compact Timeline Tracking Pill (Exclusivo Método PAF) */}
              {isPaf && (
                <ProjectTimelineBadge project={project} onUpdateProject={onUpdateProject} compact={true} />
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight truncate">
              {project.clientName}
            </h2>

            {/* Price / Quote Summary Strip */}
            <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
              {isEditingPrice ? (
                <div className="flex flex-col gap-2 bg-zinc-900 p-2 rounded-2xl border border-zinc-700 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <select
                      value={currencyDraft}
                      onChange={e => setCurrencyDraft(e.target.value as 'USD' | 'ARS')}
                      className="bg-zinc-950 text-xs font-bold text-zinc-200 px-2 py-1.5 rounded-lg border border-zinc-800"
                    >
                      <option value="USD">USD $</option>
                      <option value="ARS">ARS $</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={priceDraft}
                      onChange={e => setPriceDraft(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Monto presupuestado"
                      className="w-36 bg-zinc-950 text-xs text-zinc-100 px-2.5 py-1.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-[var(--accent)]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSavePrice}
                      className="p-1.5 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] transition"
                      title="Guardar precio"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPrice(false)}
                      className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Plan Price Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500 font-semibold">Presets de Planes:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrencyDraft('USD');
                        setPriceDraft(1100);
                      }}
                      className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-[10px] font-bold transition"
                    >
                      ⭐ PAF Pro ($1,100 USD)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrencyDraft('USD');
                        setPriceDraft(450);
                      }}
                      className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 text-[10px] font-bold transition"
                    >
                      PAF Base ($450 USD)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrencyDraft('ARS');
                        setPriceDraft(1110000);
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-[10px] font-bold transition"
                    >
                      PAF Base ($1.110.000 ARS)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrencyDraft('USD');
                        setPriceDraft(350);
                      }}
                      className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-[10px] font-bold transition"
                    >
                      Web Landing ($350 USD)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrencyDraft('USD');
                        setPriceDraft(600);
                      }}
                      className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-[10px] font-bold transition"
                    >
                      Web Corp ($600 USD)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-zinc-950 border border-zinc-800/80">
                  <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Valor de Precio / Presupuesto:</span>
                  </span>
                  <span className="font-bold text-zinc-100 font-mono">
                    {project.estimatedPrice !== undefined && project.estimatedPrice !== null && project.estimatedPrice > 0 ? (
                      formatProjectPrice(project.estimatedPrice, project.estimatedCurrency)
                    ) : (
                      <span className="text-zinc-500 font-normal italic">Sin cotizar</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPriceDraft(project.estimatedPrice ?? '');
                      setCurrencyDraft(project.estimatedCurrency || 'USD');
                      setIsEditingPrice(true);
                    }}
                    className="p-1 text-zinc-400 hover:text-[var(--accent)] rounded transition"
                    title="Editar valor de precio y aplicar lógica de planes"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Fecha de Arranque / Confirmación */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-950 border border-zinc-800/80">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] text-zinc-400 font-semibold">Arranque:</span>
                <input
                  type="date"
                  value={project.startDate || project.pafStartDate || ''}
                  onChange={e => {
                    const val = e.target.value || undefined;
                    const updates: Partial<Project> = { startDate: val };
                    if (isPaf) {
                      updates.pafStartDate = val;
                      if (val && !project.deliveryDate) {
                        updates.deliveryDate = addMonths(val, 3);
                      }
                    }
                    onUpdateProject(project.id, updates);
                  }}
                  className="bg-transparent text-xs text-zinc-100 font-mono focus:outline-none focus:text-[var(--accent)]"
                  title="Fecha en que arrancaría el proyecto o te confirmó el cliente (para contar meses transcurridos)"
                />
              </div>

              {/* Delivery Date / Plazo for Roadmap #4 & PAF 3-Month Cycle */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-950 border border-zinc-800/80">
                <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span className="text-[11px] text-zinc-400 font-semibold">{isPaf ? 'Fin (3m):' : 'Entrega / Plazo:'}</span>
                <input
                  type="date"
                  value={project.deliveryDate || ''}
                  onChange={e => onUpdateProject(project.id, { deliveryDate: e.target.value || undefined })}
                  className="bg-transparent text-xs text-zinc-100 font-mono focus:outline-none focus:text-[var(--accent)]"
                  title={isPaf ? "Fecha límite (calculada a 3 meses de aceleración PAF)" : "Fecha límite para el Roadmap de Entregas"}
                />
                {isPaf && (
                  <button
                    type="button"
                    onClick={() => {
                      const baseDate = project.startDate || project.pafStartDate || getTodayString();
                      onUpdateProject(project.id, { deliveryDate: addMonths(baseDate, 3) });
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 transition"
                    title="Calcular fecha final exacta a 3 meses desde la fecha de arranque"
                  >
                    +3 meses
                  </button>
                )}
              </div>
            </div>

            {/* Client Direct Actions */}
            {phone ? (
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-xs text-zinc-400 font-mono">{phone}</span>
                <a
                  href={formatWhatsAppUrl(phone, `Hola ${project.clientName}, te escribo respecto al proyecto.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={formatTelUrl(phone)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Llamar</span>
                </a>
              </div>
            ) : (
              <div className="text-xs text-zinc-500">
                Sin teléfono de contacto registrado
              </div>
            )}
            {/* Architectural Studio & Digital Presence Strip */}
            {isPaf && (
              <div className="pt-2 border-t border-zinc-800/80">
                {isEditingStudioInfo ? (
                  <div className="p-2.5 bg-zinc-950 rounded-2xl border border-zinc-700 space-y-2">
                    <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      Datos del Estudio de Arquitectura
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">Arquitecto Titular</label>
                        <input
                          type="text"
                          placeholder="Ej: Arq. Matías Rosso"
                          value={ownerNameDraft}
                          onChange={e => setOwnerNameDraft(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-zinc-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">Instagram Oficial</label>
                        <input
                          type="text"
                          placeholder="Ej: @estudio.arquitectura"
                          value={instagramDraft}
                          onChange={e => setInstagramDraft(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-zinc-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">Google Business Profile / Maps</label>
                        <input
                          type="text"
                          placeholder="URL de Google Maps o Perfil"
                          value={googleMapsDraft}
                          onChange={e => setGoogleMapsDraft(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-zinc-200"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingStudioInfo(false)}
                        className="px-2.5 py-1 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveStudioInfo}
                        className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition"
                      >
                        Guardar Estudio
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Estudio:</span>
                    </span>

                    {project.ownerName ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 font-medium">
                        <User className="w-3 h-3 text-zinc-400" />
                        {project.ownerName}
                      </span>
                    ) : (
                      <span className="text-zinc-500 italic text-[11px]">Sin titular asignado</span>
                    )}

                    {project.instagramUrl && (
                      <a
                        href={project.instagramUrl.startsWith('http') ? project.instagramUrl : `https://instagram.com/${project.instagramUrl.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/20 font-medium transition"
                      >
                        <Instagram className="w-3 h-3" />
                        <span>{project.instagramUrl.startsWith('@') ? project.instagramUrl : `@${project.instagramUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')}`}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    )}

                    {project.googleMapsUrl && (
                      <a
                        href={project.googleMapsUrl.startsWith('http') ? project.googleMapsUrl : `https://maps.google.com/?q=${encodeURIComponent(project.googleMapsUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 font-medium transition"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>Google Business</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setOwnerNameDraft(project.ownerName || '');
                        setInstagramDraft(project.instagramUrl || '');
                        setGoogleMapsDraft(project.googleMapsUrl || '');
                        setIsEditingStudioInfo(true);
                      }}
                      className="p-1 text-zinc-500 hover:text-amber-400 transition ml-1"
                      title="Editar datos del estudio, titular y presencia digital"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onToggleArchive(project.id)}
              className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition"
              title={project.archived ? 'Desarchivar proyecto' : 'Archivar proyecto'}
            >
              {project.archived ? <ArchiveRestore className="w-4 h-4 text-sky-400" /> : <Archive className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation - Strictly Sectorized by Service */}
        <div className="px-3 sm:px-4 py-2 border-b border-zinc-800 bg-zinc-950/80 shrink-0">
          {isPaf ? (
            /* PAF SPECIFIC TABS */
            <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
              <div className="flex items-center gap-1.5 min-w-max md:grid md:grid-cols-5 md:min-w-0 md:w-full">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('paf')}
                  className={`px-3 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    activeSubTab === 'paf'
                      ? 'bg-[var(--accent)] !text-white shadow-xs font-extrabold'
                      : 'text-amber-400 hover:text-amber-300 hover:bg-zinc-800/60 bg-zinc-900/50'
                  }`}
                  title="Programa PAF y Metas de Aceleración"
                >
                  <Award className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Programa PAF {project.pafMilestones && project.pafMilestones.length > 0 ? `(${project.pafMilestones.filter(m => m.completed).length}/${project.pafMilestones.length})` : ''}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('tareas')}
                  className={`px-3 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    activeSubTab === 'tareas'
                      ? 'bg-[var(--accent)] !text-white shadow-xs font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 bg-zinc-900/50'
                  }`}
                  title="Tareas del Cliente"
                >
                  <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                  <span>Tareas ({projectTasks.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('reuniones')}
                  className={`px-3 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    activeSubTab === 'reuniones'
                      ? 'bg-[var(--accent)] !text-white shadow-xs font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 bg-zinc-900/50'
                  }`}
                  title="Sesiones 1:1 de Consultoría"
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>Sesiones 1:1 ({projectMeetings.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('finanzas')}
                  className={`px-3 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    activeSubTab === 'finanzas'
                      ? 'bg-[var(--accent)] !text-white shadow-xs font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 bg-zinc-900/50'
                  }`}
                  title="Cronograma de Cuotas y Pagos"
                >
                  <DollarSign className="w-3.5 h-3.5 shrink-0" />
                  <span>Cuotas & Pagos</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('notas')}
                  className={`px-3 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs shrink-0 md:shrink whitespace-nowrap cursor-pointer ${
                    activeSubTab === 'notas'
                      ? 'bg-[var(--accent)] !text-white shadow-xs font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 bg-zinc-900/50'
                  }`}
                  title="Bitácora del Cliente Arquitecto"
                >
                  <Edit3 className="w-3.5 h-3.5 shrink-0" />
                  <span>Bitácora del Cliente</span>
                </button>
              </div>
            </div>
          ) : (
            /* DESARROLLO WEB SPECIFIC TABS (Clean, Simple, 3 tabs only) */
            <div className="grid grid-cols-3 gap-1.5 w-full">
              <button
                type="button"
                onClick={() => setActiveSubTab('web_cobros')}
                className={`px-3 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs ${
                  effectiveTab === 'web_cobros'
                    ? 'bg-blue-600 !text-white shadow-xs font-extrabold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 bg-zinc-900/50'
                }`}
                title="Precio del sitio y cobro en dos instancias 50/50"
              >
                <DollarSign className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span className="truncate">Precio & Cobro 50/50</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('tareas')}
                className={`px-3 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs ${
                  effectiveTab === 'tareas'
                    ? 'bg-blue-600 !text-white shadow-xs font-extrabold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 bg-zinc-900/50'
                }`}
                title="Tareas del sitio web"
              >
                <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Tareas ({projectTasks.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('notas')}
                className={`px-3 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs ${
                  effectiveTab === 'notas'
                    ? 'bg-blue-600 !text-white shadow-xs font-extrabold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 bg-zinc-900/50'
                }`}
                title="Notas del cliente y enlace web"
              >
                <Edit3 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Notas & Enlace</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB EXCLUSIVA DESARROLLO WEB: PRECIO SIMPLE Y 2 INSTANCIAS DE COBRO (50% / 50%) */}
          {!isPaf && effectiveTab === 'web_cobros' && (
            <div className="space-y-4">
              {/* Card 1: Resumen de Precio y Estado del Sitio */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Desarrollo Web Simplificado
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-zinc-100 mt-1">
                      Precio Total del Sitio & Modalidad 50/50
                    </h3>
                  </div>

                  {/* Estado global de cobro badge */}
                  <div>
                    {webInst1.paid && webInst2.paid ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        100% Cobrado (Saldado)
                      </span>
                    ) : webInst1.paid ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        <Clock className="w-3.5 h-3.5" />
                        50% Cobrado (Anticipo)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <AlertCircle className="w-3.5 h-3.5" />
                        0% Cobrado (Pendiente Anticipo)
                      </span>
                    )}
                  </div>
                </div>

                {/* Price configuration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 block">
                      Precio Total Acordado:
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={project.estimatedCurrency || 'USD'}
                        onChange={e => onUpdateProject(project.id, { estimatedCurrency: e.target.value as 'USD' | 'ARS' })}
                        className="bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-2 text-xs font-bold text-zinc-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="USD">USD</option>
                        <option value="ARS">ARS</option>
                      </select>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold">
                          {project.estimatedCurrency === 'ARS' ? '$' : 'US$'}
                        </span>
                        <input
                          type="number"
                          value={project.estimatedPrice || ''}
                          onChange={e => {
                            const val = Number(e.target.value) || 0;
                            const h1 = Math.round(val / 2);
                            const h2 = val - h1;
                            const newInst = [
                              { ...webInst1, amount: h1 },
                              { ...webInst2, amount: h2 }
                            ];
                            onUpdateProject(project.id, {
                              estimatedPrice: val,
                              installments: newInst
                            });
                          }}
                          placeholder="Ej: 600"
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-10 pr-3 py-2 text-sm font-bold text-zinc-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] text-zinc-500 font-semibold">Valores sugeridos:</span>
                      <button
                        type="button"
                        onClick={() => handleSetWebPricePreset(350, 'USD')}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700"
                      >
                        $350 Landing
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetWebPricePreset(600, 'USD')}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700"
                      >
                        $600 Corp
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetWebPricePreset(900, 'USD')}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700"
                      >
                        $900 Tienda
                      </button>
                    </div>
                  </div>

                  {/* Fecha de Entrega & Estado del Proyecto */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 block">
                      Fecha Comprometida de Entrega:
                    </label>
                    <input
                      type="date"
                      value={project.deliveryDate || ''}
                      onChange={e => onUpdateProject(project.id, { deliveryDate: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-blue-500"
                    />

                    <div className="flex items-center justify-between text-xs pt-1 text-zinc-400">
                      <span>Cobrado hasta hoy:</span>
                      <span className="font-bold text-zinc-200">
                        {webInst1.paid && webInst2.paid ? '100% Cobrado' : webInst1.paid ? '50% Cobrado' : '0% Cobrado'}
                      </span>
                    </div>
                    <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className={`h-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300 ${
                          webInst1.paid && webInst2.paid
                            ? 'bg-emerald-500'
                            : webInst1.paid
                            ? 'bg-blue-500'
                            : 'bg-zinc-700'
                        }`}
                        style={{
                          width: webInst1.paid && webInst2.paid ? '100%' : webInst1.paid ? '50%' : '0%'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Las Dos Instancias de Cobro (50% y 50%) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Instancia 1: Anticipo 50% */}
                <div className={`p-4 sm:p-5 rounded-3xl border transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] space-y-3 ${
                  webInst1.paid 
                    ? 'bg-emerald-950/15 border-emerald-800/40' 
                    : 'bg-zinc-950 border-amber-900/40 hover:border-amber-700/60'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-extrabold tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-black">
                        1
                      </span>
                      Instancia 1 · 50% Anticipo
                    </span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                      webInst1.paid
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {webInst1.paid ? 'Cobrado' : 'Pendiente'}
                    </span>
                  </div>

                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono">
                      {formatMoney(webHalfPrice1, webCurrency)}
                    </div>
                    <span className="text-[11px] text-zinc-400 block mt-0.5">
                      {webInst1.paid 
                        ? `Cobrado el ${webInst1.paidAt || 'recientemente'}` 
                        : 'Requerido para comenzar el diseño y desarrollo'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleWebPayment(1)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 active:scale-98 shadow-sm cursor-pointer ${
                      webInst1.paid
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                    }`}
                  >
                    {webInst1.paid ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Desmarcar (Volver a Pendiente)</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Marcar Anticipo como COBRADO</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Instancia 2: Saldo Final 50% */}
                <div className={`p-4 sm:p-5 rounded-3xl border transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] space-y-3 ${
                  webInst2.paid 
                    ? 'bg-emerald-950/15 border-emerald-800/40' 
                    : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-extrabold tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-black">
                        2
                      </span>
                      Instancia 2 · 50% Saldo Final
                    </span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                      webInst2.paid
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {webInst2.paid ? 'Cobrado' : 'Pendiente'}
                    </span>
                  </div>

                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono">
                      {formatMoney(webHalfPrice2, webCurrency)}
                    </div>
                    <span className="text-[11px] text-zinc-400 block mt-0.5">
                      {webInst2.paid 
                        ? `Cobrado el ${webInst2.paidAt || 'recientemente'}` 
                        : 'A cobrar contra entrega y lanzamiento del sitio web'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleWebPayment(2)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 active:scale-98 shadow-sm cursor-pointer ${
                      webInst2.paid
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                    }`}
                  >
                    {webInst2.paid ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Desmarcar (Volver a Pendiente)</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Marcar Saldo Final como COBRADO</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: RESUMEN & RENTABILIDAD (Exclusivo PAF) */}
          {isPaf && activeSubTab === 'resumen' && (
            <div className="space-y-4">
              {/* Financial Profitability Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* USD Summary */}
                <div className="bg-zinc-950 border border-zinc-800/90 rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" />
                      Rentabilidad en USD
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${netUSD >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {netUSD >= 0 ? 'Margen Positivo' : 'Déficit'}
                    </span>
                  </div>

                  <div className="text-2xl font-black text-zinc-100">
                    {formatMoney(netUSD, 'USD')}
                    <span className="text-xs font-normal text-zinc-400 block mt-0.5">
                      Rentabilidad Neta (Cobrado - Gastos)
                    </span>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block font-medium">Cobrado</span>
                      <span className="font-semibold text-emerald-400">{formatMoney(incomeUSDCobrado, 'USD')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block font-medium">Gastos pagados</span>
                      <span className="font-semibold text-rose-400">{formatMoney(expenseUSDPagado, 'USD')}</span>
                    </div>
                  </div>

                  {incomeUSDPendiente > 0 && (
                    <div className="text-[11px] text-amber-400/90 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                      Pendiente de cobro: <b>{formatMoney(incomeUSDPendiente, 'USD')}</b>
                    </div>
                  )}
                </div>

                {/* ARS Summary */}
                <div className="bg-zinc-950 border border-zinc-800/90 rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" />
                      Rentabilidad en ARS
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${netARS >= 0 ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {netARS >= 0 ? 'Margen Positivo' : 'Déficit'}
                    </span>
                  </div>

                  <div className="text-2xl font-black text-zinc-100">
                    {formatMoney(netARS, 'ARS')}
                    <span className="text-xs font-normal text-zinc-400 block mt-0.5">
                      Rentabilidad Neta (Cobrado - Gastos)
                    </span>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block font-medium">Cobrado</span>
                      <span className="font-semibold text-emerald-400">{formatMoney(incomeARSCobrado, 'ARS')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block font-medium">Gastos pagados</span>
                      <span className="font-semibold text-rose-400">{formatMoney(expenseARSPagado, 'ARS')}</span>
                    </div>
                  </div>

                  {incomeARSPendiente > 0 && (
                    <div className="text-[11px] text-amber-400/90 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                      Pendiente de cobro: <b>{formatMoney(incomeARSPendiente, 'ARS')}</b>
                    </div>
                  )}
                </div>
              </div>

              {/* Tasks Quick Peek */}
              <div className="bg-zinc-950 border border-zinc-800/90 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-zinc-300 flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-[var(--accent)]" />
                    Pendientes clave ({projectTasks.filter(t => !t.completed).length} pendientes)
                  </h4>
                  <button
                    onClick={() => setActiveSubTab('tareas')}
                    className="text-xs text-[var(--accent)] hover:underline font-semibold"
                  >
                    Ver todas
                  </button>
                </div>

                {projectTasks.length > 0 ? (
                  <div className="space-y-2">
                    {projectTasks.slice(0, 3).map(task => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80 text-xs"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <button
                            onClick={() => onToggleTask(task.id)}
                            className="text-zinc-500 hover:text-[var(--accent)] transition"
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-[var(--accent)]" />
                            ) : (
                              <Circle className="w-4 h-4 text-zinc-500" />
                            )}
                          </button>
                          <span className={`truncate ${task.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                            {task.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 shrink-0 ml-2">{task.date}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 text-center py-3">
                    No hay tareas vinculadas a este proyecto aún.
                  </div>
                )}
              </div>

              {/* Meetings Quick Peek */}
              <div className="bg-zinc-950 border border-zinc-800/90 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-zinc-300 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    Reuniones Agendadas ({projectMeetings.length})
                  </h4>
                  <button
                    onClick={() => setActiveSubTab('reuniones')}
                    className="text-xs text-amber-400 hover:underline font-semibold"
                  >
                    Ver todas
                  </button>
                </div>

                {projectMeetings.length > 0 ? (
                  <div className="space-y-2">
                    {projectMeetings.slice(0, 2).map(meeting => (
                      <div
                        key={meeting.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80 text-xs"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <button
                            onClick={() => onToggleMeeting(meeting.id)}
                            className="text-zinc-500 hover:text-amber-400 transition"
                          >
                            {meeting.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Circle className="w-4 h-4 text-zinc-500" />
                            )}
                          </button>
                          <span className={`truncate ${meeting.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                            {meeting.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-400/90 shrink-0 ml-2 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{meeting.date} {meeting.time || ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 text-center py-3">
                    Sin reuniones agendadas para este proyecto.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TAREAS Y SUBTAREAS VINCULADAS */}
          {activeSubTab === 'tareas' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-zinc-400">
                  Tareas del proyecto ({projectTasks.length})
                </span>
                <button
                  onClick={() => setShowNewTaskInput(prev => !prev)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[var(--accent)] text-white text-xs font-bold transition hover:bg-[var(--accent-strong)]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva Tarea</span>
                </button>
              </div>

              {/* Inline Add Task Form */}
              {showNewTaskInput && (
                <form onSubmit={handleCreateTask} className="p-3 bg-zinc-950 border border-[var(--accent)]/40 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="text-xs font-bold text-zinc-200">
                    Agregar tarea vinculada a {project.clientName}
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Título de la tarea…"
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    className="w-full text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 focus:outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="date"
                      required
                      value={newTaskDate}
                      onChange={e => setNewTaskDate(e.target.value)}
                      className="text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowNewTaskInput(false)}
                        className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-white text-xs font-bold"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Tasks List */}
              {projectTasks.length > 0 ? (
                <div className="space-y-2">
                  {projectTasks.map(task => {
                    const subtasks = task.subtasks || [];
                    const completedSub = subtasks.filter(s => s.completed).length;
                    const isExpanded = expandedTaskId === task.id;

                    return (
                      <div
                        key={task.id}
                        className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <button
                              onClick={() => onToggleTask(task.id)}
                              className="mt-0.5 text-zinc-500 hover:text-[var(--accent)] transition"
                            >
                              {task.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-[var(--accent)]" />
                              ) : (
                                <Circle className="w-4 h-4 text-zinc-500" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <span className={`text-xs font-medium block leading-snug ${task.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                                {task.title}
                              </span>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                                <span>{task.date}</span>
                                {task.time && <span>{task.time} hs</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Toggle Subtasks button */}
                            <button
                              type="button"
                              onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                                subtasks.length > 0
                                  ? 'bg-zinc-900 border-zinc-700 text-zinc-300'
                                  : 'bg-transparent border-dashed border-zinc-800 text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              <ListTodo className="w-3 h-3 text-[var(--accent)]" />
                              <span>{completedSub}/{subtasks.length} Subtareas</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            <button
                              onClick={() => onDeleteTask(task.id)}
                              className="p-1 text-zinc-600 hover:text-red-400 transition rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Expandable Subtasks Checklist */}
                        {isExpanded && (
                          <div className="pt-2 border-t border-zinc-800/80 space-y-2 pl-6">
                            {/* Progress bar */}
                            {subtasks.length > 0 && (
                              <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300"
                                  style={{
                                    width: `${Math.round((completedSub / subtasks.length) * 100)}%`,
                                  }}
                                />
                              </div>
                            )}

                            {/* Subtask Items */}
                            {subtasks.map(sub => (
                              <div
                                key={sub.id}
                                className="flex items-center justify-between gap-2 text-xs py-1"
                              >
                                <button
                                  type="button"
                                  onClick={() => onToggleSubtask && onToggleSubtask(task.id, sub.id)}
                                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                                >
                                  {sub.completed ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  ) : (
                                    <Circle className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                                  )}
                                  <span className={`text-[11px] truncate ${sub.completed ? 'line-through text-zinc-500' : 'text-zinc-300'}`}>
                                    {sub.title}
                                  </span>
                                </button>

                                {onDeleteSubtask && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteSubtask(task.id, sub.id)}
                                    className="text-zinc-600 hover:text-red-400 p-0.5"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}

                            {/* Inline Add Subtask Input */}
                            <div className="flex items-center gap-1.5 pt-1">
                              <input
                                type="text"
                                placeholder="Escribir subtarea…"
                                value={inlineSubtaskText}
                                onChange={e => setInlineSubtaskText(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddInlineSubtask(task.id);
                                  }
                                }}
                                className="flex-1 text-[11px] text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-[var(--accent)]"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddInlineSubtask(task.id)}
                                disabled={!inlineSubtaskText.trim()}
                                className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-200 text-[11px] font-bold hover:bg-[var(--accent)] hover:text-white disabled:opacity-40 transition"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500 text-xs bg-zinc-950/60 rounded-2xl border border-zinc-800">
                  No hay tareas vinculadas a este proyecto.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REUNIONES VINCULADAS (Exclusivo PAF) */}
          {isPaf && activeSubTab === 'reuniones' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-zinc-400">
                  Reuniones agendadas ({projectMeetings.length})
                </span>
                <button
                  onClick={() => setShowNewMeetingInput(prev => !prev)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agendar Reunión</span>
                </button>
              </div>

              {/* Add Meeting Inline Form */}
              {showNewMeetingInput && (
                <form onSubmit={handleCreateMeeting} className="p-3 bg-zinc-950 border border-amber-500/40 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="text-xs font-bold text-zinc-200">
                    Nueva reunión para {project.clientName}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Título o motivo de la reunión…"
                    value={newMeetingTitle}
                    onChange={e => setNewMeetingTitle(e.target.value)}
                    className="w-full text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 focus:outline-none focus:border-amber-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      required
                      value={newMeetingDate}
                      onChange={e => setNewMeetingDate(e.target.value)}
                      className="text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2"
                    />
                    <input
                      type="time"
                      placeholder="Hora"
                      value={newMeetingTime}
                      onChange={e => setNewMeetingTime(e.target.value)}
                      className="text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2"
                    />
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Temas o notas para la reunión (opcional)…"
                    value={newMeetingNotes}
                    onChange={e => setNewMeetingNotes(e.target.value)}
                    className="w-full text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewMeetingInput(false)}
                      className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              )}

              {/* Meetings List */}
              {projectMeetings.length > 0 ? (
                <div className="space-y-2">
                  {projectMeetings.map(m => (
                    <div
                      key={m.id}
                      className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <button
                            onClick={() => onToggleMeeting(m.id)}
                            className="mt-0.5 text-zinc-500 hover:text-amber-400 transition"
                          >
                            {m.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Circle className="w-4 h-4 text-zinc-500" />
                            )}
                          </button>
                          <div>
                            <span className={`text-xs font-semibold block leading-snug ${m.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                              {m.title}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-amber-400/90 font-mono">
                              <Calendar className="w-3 h-3" />
                              <span>{m.date}</span>
                              {m.time && <span>• {m.time} hs</span>}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => onDeleteMeeting(m.id)}
                          className="p-1 text-zinc-600 hover:text-red-400 transition rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {m.notes && (
                        <p className="text-[11px] text-zinc-400 bg-zinc-900/80 p-2 rounded-xl leading-relaxed">
                          {m.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500 text-xs bg-zinc-950/60 rounded-2xl border border-zinc-800">
                  Sin reuniones registradas para este proyecto.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FINANZAS - CUOTAS & GASTOS (Exclusivo PAF) */}
          {isPaf && activeSubTab === 'finanzas' && (
            <div className="space-y-4">
              {/* Payment Plan Manager (Installments, Auto-calculation & WhatsApp Reminders) */}
              <PaymentPlanManager
                project={project}
                incomes={incomes}
                onUpdateProject={onUpdateProject}
                onAddIncome={onAddIncome}
                onToggleIncomeStatus={onToggleIncomeStatus}
                onDeleteIncome={onDeleteIncome}
                privacyMode={privacyMode}
              />

              {/* Actions Header */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-zinc-800">
                <span className="text-xs font-bold uppercase text-zinc-400">
                  Otros Movimientos / Caja Directa
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowNewIncomeInput(prev => !prev);
                      setShowNewExpenseInput(false);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/30 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Cobro Manual</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowNewExpenseInput(prev => !prev);
                      setShowNewIncomeInput(false);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold hover:bg-rose-500/30 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Gasto Directo</span>
                  </button>
                </div>
              </div>

              {/* Add Income Inline Form */}
              {showNewIncomeInput && (
                <form onSubmit={handleCreateIncome} className="p-3 bg-zinc-950 border border-emerald-500/40 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    Registrar Cobro / Ingreso para {project.clientName}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Concepto (ej: 50% Anticipo anteproyecto)…"
                    value={newIncomeConcept}
                    onChange={e => setNewIncomeConcept(e.target.value)}
                    className="w-full text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      required
                      placeholder="Monto"
                      value={newIncomeAmount}
                      onChange={e => setNewIncomeAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2 font-mono"
                    />
                    <select
                      value={newIncomeCurrency}
                      onChange={e => setNewIncomeCurrency(e.target.value as 'USD' | 'ARS')}
                      className="text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2"
                    >
                      <option value="USD">USD</option>
                      <option value="ARS">ARS</option>
                    </select>
                    <select
                      value={newIncomeStatus}
                      onChange={e => setNewIncomeStatus(e.target.value as 'cobrado' | 'pendiente')}
                      className="text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2"
                    >
                      <option value="cobrado">Cobrado</option>
                      <option value="pendiente">Pendiente</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewIncomeInput(false)}
                      className="px-3 py-1.5 text-xs text-zinc-400"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-bold"
                    >
                      Guardar Cobro
                    </button>
                  </div>
                </form>
              )}

              {/* Add Expense Inline Form */}
              {showNewExpenseInput && (
                <form onSubmit={handleCreateExpense} className="p-3 bg-zinc-950 border border-rose-500/40 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="text-xs font-bold text-rose-400 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    Registrar Gasto Directo para {project.clientName}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Concepto (ej: Pago de renders 3D fachada)…"
                    value={newExpenseConcept}
                    onChange={e => setNewExpenseConcept(e.target.value)}
                    className="w-full text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 focus:outline-none focus:border-rose-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newExpenseCategory}
                      onChange={e => setNewExpenseCategory(e.target.value)}
                      className="text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2"
                    >
                      {DEFAULT_EXPENSE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      required
                      placeholder="Monto"
                      value={newExpenseAmount}
                      onChange={e => setNewExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2 font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newExpenseCurrency}
                      onChange={e => setNewExpenseCurrency(e.target.value as 'USD' | 'ARS')}
                      className="text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2"
                    >
                      <option value="USD">USD</option>
                      <option value="ARS">ARS</option>
                    </select>
                    <select
                      value={newExpenseStatus}
                      onChange={e => setNewExpenseStatus(e.target.value as 'pagado' | 'pendiente')}
                      className="text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl p-2"
                    >
                      <option value="pagado">Pagado</option>
                      <option value="pendiente">Pendiente</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewExpenseInput(false)}
                      className="px-3 py-1.5 text-xs text-zinc-400"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-bold"
                    >
                      Guardar Gasto
                    </button>
                  </div>
                </form>
              )}

              {/* Two columns: Incomes and Expenses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Incomes column */}
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    Cobros Registrados ({projectIncomes.length})
                  </h5>

                  {projectIncomes.length > 0 ? (
                    projectIncomes.map(inc => (
                      <div
                        key={inc.id}
                        className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-zinc-200 block truncate max-w-[170px]">
                            {inc.title}
                          </span>
                          <span className="text-[10px] text-zinc-500">{inc.date}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onToggleIncomeStatus(inc.id)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition ${
                              inc.status === 'cobrado'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {inc.status}
                          </button>
                          <span className="font-bold text-zinc-100 font-mono">
                            {formatMoney(inc.amount, inc.currency)}
                          </span>
                          <button
                            onClick={() => onDeleteIncome(inc.id)}
                            className="p-1 text-zinc-600 hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-zinc-500 text-center py-4 bg-zinc-950/40 rounded-xl border border-zinc-800">
                      Sin cobros aún
                    </div>
                  )}
                </div>

                {/* Expenses column */}
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-rose-400 uppercase tracking-wide flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    Gastos Directos ({projectExpenses.length})
                  </h5>

                  {projectExpenses.length > 0 ? (
                    projectExpenses.map(exp => (
                      <div
                        key={exp.id}
                        className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-zinc-200 block truncate max-w-[170px]">
                            {exp.title}
                          </span>
                          <span className="text-[10px] text-zinc-500">{exp.category} • {exp.date}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onToggleExpenseStatus(exp.id)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition ${
                              exp.status === 'pagado'
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}
                          >
                            {exp.status}
                          </button>
                          <span className="font-bold text-rose-400 font-mono">
                            {formatMoney(exp.amount, exp.currency)}
                          </span>
                          <button
                            onClick={() => onDeleteExpense(exp.id)}
                            className="p-1 text-zinc-600 hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-zinc-500 text-center py-4 bg-zinc-950/40 rounded-xl border border-zinc-800">
                      Sin gastos aún
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: NOTAS Y BITACORA */}
          {activeSubTab === 'notas' && (
            <div className="space-y-3">
              {/* Si es Desarrollo Web: Enlace rápido del sitio o Figma / Demo */}
              {!isPaf && (
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      Enlace del Sitio Web / Figma / Demo
                    </span>
                    {(project.websiteUrl || project.keyLinks?.[0]?.url) && (
                      <a
                        href={(project.websiteUrl || project.keyLinks?.[0]?.url)?.startsWith('http') ? (project.websiteUrl || project.keyLinks?.[0]?.url) : `https://${project.websiteUrl || project.keyLinks?.[0]?.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 transition"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Abrir Sitio</span>
                      </a>
                    )}
                  </div>
                  <input
                    type="url"
                    value={project.websiteUrl || project.keyLinks?.[0]?.url || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const existing = project.keyLinks || [];
                      const updated = existing.length > 0
                        ? [{ ...existing[0], url: val }, ...existing.slice(1)]
                        : [{ id: `${project.id}-link-web`, title: 'Sitio Web', url: val, category: 'web' as const }];
                      onUpdateProject(project.id, { websiteUrl: val, keyLinks: updated });
                    }}
                    placeholder="https://misitio.com o https://figma.com/..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-zinc-400 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-[var(--accent)]" />
                  {isPaf ? 'Notas & Bitácora del Cliente Arquitecto' : 'Notas & Especificaciones del Sitio'}
                </span>
                {notesSaved && (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                    <Check className="w-3.5 h-3.5" />
                    Guardado con éxito
                  </span>
                )}
              </div>

              <textarea
                rows={8}
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                placeholder={isPaf
                  ? "Escribe aquí acuerdos, especificaciones, bitácora de obra o anotaciones importantes de este cliente…"
                  : "Escribe aquí requerimientos del sitio web, credenciales de hosting/dominio, feedback de diseño o notas del cliente…"}
                className="w-full text-xs sm:text-sm text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 focus:outline-none focus:border-[var(--accent)] transition leading-relaxed resize-none"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-bold hover:bg-[var(--accent-strong)] transition shadow-md shadow-[var(--accent)]/20 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Notas</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: METODO PAF (12 SEMANAS & PRECIOS) */}
          {activeSubTab === 'paf' && (
            <div className="space-y-4">
              {/* Acceleration Timeline & 3-Month Cycle Banner */}
              <ProjectTimelineBadge project={project} onUpdateProject={onUpdateProject} />

              {/* Program Overview Banner */}
              <div className="p-4 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-zinc-100 text-sm flex items-center gap-2">
                        {project.projectType === 'paf_base' ? 'Plan Base PAF (Adquisición)' : 'Programa PAF Pro (3 Meses / 12 Semanas)'}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {project.projectType === 'paf_base' ? 'Plan Base' : 'Acceso Pro'}
                        </span>
                      </h4>
                      <p className="text-xs text-zinc-400">
                        Sistema de captación digital, landing comercial, Meta Ads y escalabilidad para arquitectos.
                      </p>
                    </div>
                  </div>

                  {/* Consulting hours tracker badge if PAF Pro */}
                  {project.projectType !== 'paf_base' && (
                    <div className="text-right shrink-0 bg-zinc-900 px-3 py-2 rounded-2xl border border-zinc-800 flex items-center gap-3">
                      <div>
                        <div className="text-[10px] text-zinc-400 font-semibold">Mentoría 1:1 PAF</div>
                        <div className="text-base font-black text-amber-400 font-mono">
                          {project.pafConsultingHoursDone || 0} / 26 hs
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const current = project.pafConsultingHoursDone || 0;
                            if (current < 26) {
                              hapticFeedback.selection();
                              onUpdateProject(project.id, { pafConsultingHoursDone: current + 1 });
                            }
                          }}
                          className="w-5 h-5 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 flex items-center justify-center font-bold text-xs"
                          title="Sumar 1 hora de mentoría"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const current = project.pafConsultingHoursDone || 0;
                            if (current > 0) {
                              hapticFeedback.selection();
                              onUpdateProject(project.id, { pafConsultingHoursDone: current - 1 });
                            }
                          }}
                          className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 flex items-center justify-center font-bold text-xs"
                          title="Restar 1 hora"
                        >
                          -
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* PAF Stage Selector Buttons */}
                <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Etapa Actual del Programa:</span>
                    </span>
                    <span className="font-bold text-amber-400 font-mono">
                      {project.pafStage || 'Kick-off / Onboarding'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
                    {PAF_STAGES.map((st, idx) => {
                      const isCurrent = (project.pafStage || 'Kick-off / Onboarding') === st;
                      const stageLabels = ['Kick-off', 'Mes 1: Web', 'Mes 2: Ads', 'Mes 3: Ventas', 'Graduado'];
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            hapticFeedback.selection();
                            onUpdateProject(project.id, { pafStage: st });
                          }}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition text-center border ${
                            isCurrent
                              ? 'bg-amber-500 text-black border-amber-400 shadow-sm'
                              : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                          }`}
                        >
                          <div className="text-[9px] opacity-75 font-mono">Etapa {idx + 1}</div>
                          <div className="truncate">{stageLabels[idx]}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Progress Bar of Milestones */}
                {project.pafMilestones && project.pafMilestones.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400 font-medium">Progreso del Programa:</span>
                      <span className="font-bold text-amber-400 font-mono">
                        {project.pafMilestones.filter(m => m.completed).length} de {project.pafMilestones.length} hitos completados ({Math.round((project.pafMilestones.filter(m => m.completed).length / project.pafMilestones.length) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                      <div 
                        className="bg-amber-400 h-full rounded-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300"
                        style={{ width: `${(project.pafMilestones.filter(m => m.completed).length / project.pafMilestones.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Consulting Sessions 1:1 Logger (PAF Pro) */}
                {project.projectType !== 'paf_base' && (
                  <div className="pt-3 border-t border-zinc-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Consultoría Estratégica 1:1 ({project.consultingSessions?.length || 0} sesiones)
                        </span>
                        <p className="text-[11px] text-zinc-400">
                          {project.pafConsultingHoursDone || 0} de 26 hs computadas • {Math.max(0, 26 - (project.pafConsultingHoursDone || 0))} hs disponibles
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowNewConsultingSession(prev => !prev)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Registrar Sesión</span>
                      </button>
                    </div>

                    {/* New Session Form */}
                    {showNewConsultingSession && (
                      <form onSubmit={handleAddConsultingSession} className="p-3 bg-zinc-900 border border-amber-500/40 rounded-2xl space-y-2.5 animate-in fade-in text-xs">
                        <div className="font-bold text-zinc-200">
                          Nueva sesión 1:1 con {project.clientName}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">Fecha</label>
                            <input
                              type="date"
                              required
                              value={consultingDate}
                              onChange={e => setConsultingDate(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-zinc-200"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">Duración (hs)</label>
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              max="8"
                              required
                              value={consultingHours}
                              onChange={e => setConsultingHours(Number(e.target.value))}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-zinc-200 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">Eje / Temática</label>
                            <input
                              type="text"
                              required
                              placeholder="Ej: Auditoría de Oferta y Web"
                              value={consultingTopic}
                              onChange={e => setConsultingTopic(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-zinc-200"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">Acuerdos / Notas de la sesión</label>
                          <textarea
                            rows={2}
                            placeholder="Alineaciones, correcciones de VSL, acuerdos de pauta…"
                            value={consultingNotes}
                            onChange={e => setConsultingNotes(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-zinc-200 resize-none"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowNewConsultingSession(false)}
                            className="px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl"
                          >
                            Guardar Sesión
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Sessions List */}
                    {project.consultingSessions && project.consultingSessions.length > 0 ? (
                      <div className="space-y-1.5">
                        {project.consultingSessions.map(session => (
                          <div
                            key={session.id}
                            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start justify-between gap-2 text-xs"
                          >
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-zinc-200">{session.topic || session.topics || 'Sesión 1:1'}</span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                                  {session.hours || session.durationHours || 1} hs
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">{session.date}</span>
                              </div>
                              {session.notes && (
                                <p className="text-[11px] text-zinc-400 italic">"{session.notes}"</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteConsultingSession(session.id)}
                              className="text-zinc-600 hover:text-rose-400 p-1"
                              title="Eliminar sesión"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-zinc-500 italic bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800 text-center">
                        No hay sesiones registradas aún. El programa Pro cuenta con 26 horas de consultoría 1:1.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Automatic Installment Generator & Payment Plan */}
              <PaymentPlanManager
                project={project}
                incomes={incomes}
                onUpdateProject={onUpdateProject}
                onAddIncome={onAddIncome}
                onToggleIncomeStatus={onToggleIncomeStatus}
                onDeleteIncome={onDeleteIncome}
                privacyMode={privacyMode}
              />

              {/* Milestones Checklist / Action List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-[var(--accent)]" />
                    <span>Hitos de las 12 Semanas / 3 Meses</span>
                  </h5>

                  <div className="flex items-center gap-2">
                    {(!project.pafMilestones || project.pafMilestones.length === 0) ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleLoadPafMilestones('paf_pro')}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition active:scale-95 flex items-center gap-1 shadow-sm"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Cargar PAF Pro (12 Sem)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadPafMilestones('paf_base')}
                          className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
                        >
                          Cargar Base
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleLoadPafMilestones(project.projectType === 'paf_base' ? 'paf_base' : 'paf_pro')}
                        className="text-[11px] text-zinc-500 hover:text-amber-400 transition"
                      >
                        Reiniciar hitos
                      </button>
                    )}
                  </div>
                </div>

                {(!project.pafMilestones || project.pafMilestones.length === 0) ? (
                  <div className="p-6 rounded-3xl bg-zinc-950/60 border border-dashed border-zinc-800 text-center space-y-3">
                    <Award className="w-8 h-8 text-amber-400 mx-auto opacity-70" />
                    <div className="text-xs text-zinc-300 font-semibold">
                      Aún no has cargado los hitos del Método PAF en este proyecto.
                    </div>
                    <p className="text-xs text-zinc-500 max-w-md mx-auto">
                      Presiona "Cargar PAF Pro" para volcar automáticamente el cronograma de 12 semanas (Mes 1: Infraestructura, Mes 2: Adquisición, Mes 3: Conversión y Cierre).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[1, 2, 3].map(monthNum => {
                      const monthMilestones = (project.pafMilestones || []).filter(m => m.month === monthNum);
                      if (monthMilestones.length === 0) return null;

                      const monthTitles: Record<number, string> = {
                        1: 'Mes 1: Fundaciones, Oferta & Infraestructura',
                        2: 'Mes 2: Adquisición Digital, Meta Ads & VSL',
                        3: 'Mes 3: Conversión, Cierre & Escalabilidad',
                      };

                      return (
                        <div key={monthNum} className="p-4 rounded-3xl bg-zinc-950 border border-zinc-800/90 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-zinc-800/70 pb-2">
                            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Compass className="w-3.5 h-3.5" />
                              {monthTitles[monthNum]}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              {monthMilestones.filter(m => m.completed).length}/{monthMilestones.length} completados
                            </span>
                          </div>

                          <div className="space-y-2">
                            {monthMilestones.map(m => (
                              <div
                                key={m.id}
                                onClick={() => handleTogglePafMilestone(m.id)}
                                className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                                  m.completed 
                                    ? 'bg-emerald-950/10 border-emerald-800/40 text-zinc-400' 
                                    : 'bg-zinc-900/50 hover:bg-zinc-900 border-zinc-800/80 text-zinc-200'
                                }`}
                              >
                                <div className="mt-0.5 shrink-0">
                                  {m.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-zinc-600 hover:text-amber-400" />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                      {m.week ? `Semana ${m.week}` : m.pillar}
                                    </span>
                                    <span className={`text-xs font-bold ${m.completed ? 'line-through text-zinc-400' : 'text-zinc-100'}`}>
                                      {m.title}
                                    </span>
                                  </div>
                                  {m.description && (
                                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                                      {m.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: RELOJ DE DEDICACION Y HORAS (Exclusivo PAF) */}
          {isPaf && activeSubTab === 'horas' && (
            <TimeTrackerSection
              project={project}
              timeLogs={timeLogs}
              onAddTimeLog={(log) => onAddTimeLog && onAddTimeLog(log)}
              onDeleteTimeLog={(id) => onDeleteTimeLog && onDeleteTimeLog(id)}
              onUpdateProjectConsultingHours={handleUpdateProjectConsultingHours}
              incomeCobrado={incomeARSCobrado + incomeUSDCobrado}
              incomeCurrency={incomeARSCobrado > 0 ? 'ARS' : 'USD'}
              privacyMode={privacyMode}
            />
          )}

          {/* TAB 8: ENLACES CLAVE (Exclusivo PAF) */}
          {isPaf && activeSubTab === 'enlaces' && (
            <ProjectKeyLinks
              links={project.keyLinks || []}
              onUpdateLinks={handleUpdateKeyLinks}
              clientName={project.clientName}
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between text-xs text-zinc-500">
          <span>Actualizado: {toSafeDateString(project.updatedAt || project.createdAt) || 'Hoy'}</span>
          
          {confirmDeleteProject ? (
            <div className="flex items-center gap-2 animate-in fade-in duration-100">
              <span className="text-xs text-red-400 font-semibold">¿Eliminar este proyecto?</span>
              <button
                onClick={() => setConfirmDeleteProject(false)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  hapticFeedback.medium();
                  onDeleteProject(project.id);
                  onClose();
                }}
                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition flex items-center gap-1 shadow-sm active:scale-95"
              >
                <Trash2 className="w-3 h-3" />
                <span>Sí, eliminar</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                hapticFeedback.warning();
                setConfirmDeleteProject(true);
              }}
              className="text-red-500 hover:text-red-400 flex items-center gap-1 transition active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar Proyecto</span>
            </button>
          )}
        </div>
      </div>
    </div>
  </ModalPortal>
);
};
