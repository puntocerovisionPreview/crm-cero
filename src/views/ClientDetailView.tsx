import React, { useState, useMemo } from 'react';
import { taskBelongsToProject } from '../utils/taskProject';
import { 
  Project, 
  AgendaTask, 
  AgendaMeeting, 
  IncomeRecord, 
  ExpenseRecord, 
  PAF_STAGES, 
  PafStage, 
  TimeLog,
  ProjectInstallment,
  ProjectVisualStatus
} from '../types';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Calendar, 
  DollarSign, 
  MessageCircle, 
  Phone, 
  Globe, 
  Instagram, 
  Plus, 
  Trash2, 
  Archive, 
  Edit3, 
  Save, 
  AlertTriangle, 
  ExternalLink, 
  TrendingUp, 
  FileText, 
  Award, 
  Sparkles, 
  Check, 
  MapPin, 
  Building2, 
  User, 
  RotateCcw,
  SlidersHorizontal,
  Wallet,
  CreditCard,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  Edit2,
  Compass
} from 'lucide-react';
import { deriveHorizonProject } from '../utils/horizon';
import { getProjectStatusConfig, VISUAL_STATUS_CONFIGS } from '../utils/projectStatus';
import { formatWhatsAppUrl, formatTelUrl } from '../utils/contact';
import { hapticFeedback } from '../utils/haptics';
import { getTodayString } from '../utils/storage';
import { playTaskDone } from '../utils/sound';
import { PaymentPlanManager } from '../components/PaymentPlanManager';
import { ProjectKeyLinks } from '../components/ProjectKeyLinks';
import { TimeTrackerSection } from '../components/TimeTrackerSection';
import { 
  formatProjectPrice, 
  resolveProjectCurrency, 
  calculateProjectBilling, 
  getProjectPayments, 
  buildSmartWhatsAppPaymentMessage,
  formatCurrencyAmount
} from '../utils/paymentPlans';
import { LinkedText } from '../components/LinkedText';
import { BacklinksPanel } from '../components/BacklinksPanel';
import { LocalGraphWidget } from '../components/LocalGraphWidget';
import { buildLinkCatalog, extractAllAppRelations } from '../lib/links';
import { 
  SecondBrainNote, 
  PersonalTransaction, 
  Payment, 
  StudioPaymentSettings, 
  PersonalAccount, 
  FlexiblePaymentCommitment, 
  RecurringIncomePlan,
  BillingAgreement,
  BillingInstallment
} from '../types';
import { ProjectPaymentProgressBar } from '../components/ProjectPaymentProgressBar';
import { RegisterPaymentModal } from '../components/RegisterPaymentModal';
import { SuggestRetainerModal } from '../components/SuggestRetainerModal';
import { StudioPaymentSettingsModal } from '../components/StudioPaymentSettingsModal';
import { ClientInstallmentTimeline } from '../components/ClientInstallmentTimeline';
import { ClientPaymentHabitsCard } from '../components/ClientPaymentHabitsCard';
import { CuotaDetailView } from './CuotaDetailView';
import { AgreementEditorView } from './AgreementEditorView';
import { resolveProjectAgreement } from '../utils/paymentPlans';
import { DEFAULT_USD_RATE } from '../utils/currency';

interface Props {
  project: Project;
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  incomes: IncomeRecord[];
  expenses: ExpenseRecord[];
  timeLogs?: TimeLog[];
  notes?: SecondBrainNote[];
  onNavigate?: (path: string) => void;
  onBack: () => void;
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
  onOpenQuickIncome?: () => void;
  onAddTimeLog?: (log: Omit<TimeLog, 'id' | 'createdAt'>) => void;
  onDeleteTimeLog?: (id: string) => void;
  personalTransactions?: PersonalTransaction[];
  personalAccounts?: PersonalAccount[];
  studioSettings?: StudioPaymentSettings;
  usdRate?: number;
  privacyMode?: boolean;
  onSavePayment?: (projectId: string, payment: Payment, options?: any) => void;
  onDeletePayment?: (projectId: string, paymentId: string) => void;
  onOpenStudioPaymentSettings?: () => void;
}

export const ClientDetailView: React.FC<Props> = ({
  project,
  tasks,
  meetings,
  incomes,
  expenses,
  timeLogs = [],
  personalTransactions = [],
  onBack,
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
  onOpenQuickIncome,
  onAddTimeLog,
  onDeleteTimeLog,
  notes = [],
  onNavigate,
  personalAccounts = [],
  studioSettings,
  usdRate = DEFAULT_USD_RATE,
  privacyMode = false,
  onSavePayment,
  onDeletePayment,
  onOpenStudioPaymentSettings,
}) => {
  const isPaf = project.serviceType === 'paf' || project.projectType === 'paf_pro' || project.projectType === 'paf_base';

  // Dynamic Billing Calculation from Real Payments
  const billing = calculateProjectBilling(project, incomes);
  const realPayments = getProjectPayments(project, incomes);

  // Cuota detail & Agreement editor sub-screens (Dedicated screens, zero popups)
  const [selectedCuotaId, setSelectedCuotaId] = useState<string | null>(null);
  const [isEditingAgreement, setIsEditingAgreement] = useState<boolean>(false);

  // Payment Modals State
  const [showRegisterPaymentModal, setShowRegisterPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showAcordarPagoModal, setShowAcordarPagoModal] = useState(false);
  const [showSuggestRetainer, setShowSuggestRetainer] = useState(false);
  const [showStudioSettings, setShowStudioSettings] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  // Quick commitment inputs
  const [commitmentTitle, setCommitmentTitle] = useState('');
  const [commitmentAmount, setCommitmentAmount] = useState<string>(
    billing.saldoPendiente > 0 ? String(billing.saldoPendiente) : ''
  );
  const [commitmentDate, setCommitmentDate] = useState<string>(getTodayString());

  // Link catalog & relations for [[Links]] and Backlinks
  const catalog = useMemo(() => {
    return buildLinkCatalog({
      notes,
      tasks,
      projects: [project],
      meetings,
      incomes,
    });
  }, [notes, tasks, project, meetings, incomes]);

  const relations = useMemo(() => {
    return extractAllAppRelations({
      notes,
      tasks,
      projects: [project],
      meetings,
      incomes,
      catalog,
    });
  }, [notes, tasks, project, meetings, incomes, catalog]);

  // 5 Unified Tabs per Stage 3 spec: Resumen · Cobros · Trabajo · Notas · Horas
  type ClientTab = 'resumen' | 'cobros' | 'trabajo' | 'notas' | 'horas';
  const [activeTab, setActiveTab] = useState<ClientTab>('resumen');

  // Collapsible sections inside Trabajo
  const [trabajoTareasOpen, setTrabajoTareasOpen] = useState(true);
  const [trabajoReunionesOpen, setTrabajoReunionesOpen] = useState(true);

  // Confirmation modals
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Editing notes
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(project.notes || '');

  // Quick Inline Task creation
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showNewTaskInput, setShowNewTaskInput] = useState(false);

  // Filter tasks & meetings for this project
  const clientTasks = tasks.filter(t => taskBelongsToProject(t, project));
  const clientMeetings = meetings.filter(
    m => m.projectId === project.id || (m.projectName && m.projectName.toLowerCase() === project.clientName.toLowerCase())
  );
  const clientIncomes = incomes.filter(
    i => i.projectId === project.id || (i.projectName && i.projectName.toLowerCase() === project.clientName.toLowerCase())
  );

  // Derived Horizon Project Data & Overrides
  const derivedHorizon = useMemo(() => deriveHorizonProject(project, usdRate), [project, usdRate]);

  // Status configuration
  const statusConfig = getProjectStatusConfig(project, clientTasks);
  const StatusIcon = statusConfig.icon;

  // Handle Save Notes
  const handleSaveNotes = () => {
    hapticFeedback.light();
    onUpdateProject(project.id, { notes: notesText });
    setEditingNotes(false);
  };

  // Quick Task Add
  const handleQuickAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    hapticFeedback.light();
    onAddTask({
      title: newTaskTitle.trim(),
      date: getTodayString(),
      completed: false,
      projectId: project.id,
      projectName: project.clientName,
    });
    setNewTaskTitle('');
    setShowNewTaskInput(false);
  };

  // Status override selector
  const handleSetStatusOverride = (statusId: ProjectVisualStatus) => {
    hapticFeedback.selection();
    onUpdateProject(project.id, { statusOverride: statusId });
    setShowStatusPicker(false);
    if ((statusId === 'completed' || project.status === 'Entregado') && (project.serviceType === 'web' || project.projectType === 'web')) {
      setShowSuggestRetainer(true);
    }
  };

  const handleClearStatusOverride = () => {
    hapticFeedback.selection();
    onUpdateProject(project.id, { statusOverride: undefined });
    setShowStatusPicker(false);
  };

  // Smart WhatsApp message sender
  const handleSendSmartWhatsApp = (commitment?: FlexiblePaymentCommitment) => {
    if (!project.clientPhone) {
      alert(`El cliente ${project.clientName} no tiene teléfono registrado.`);
      return;
    }
    hapticFeedback.medium();
    const message = buildSmartWhatsAppPaymentMessage({
      project,
      studioSettings,
      commitment,
      incomes,
    });
    const url = formatWhatsAppUrl(project.clientPhone, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Internal Payment Handlers
  const handleSavePaymentInternal = (
    payment: Payment,
    options?: {
      destinationAccountId?: string;
      followUpCommitment?: { amount: number; dueDate: string; title?: string };
    }
  ) => {
    if (onSavePayment) {
      onSavePayment(project.id, payment, options);
    } else {
      const currentPayments = project.payments || [];
      const isEditing = currentPayments.some(p => p.id === payment.id);
      const nextPayments = isEditing
        ? currentPayments.map(p => p.id === payment.id ? payment : p)
        : [payment, ...currentPayments];

      let nextCommitments = project.paymentCommitments || [];
      if (options?.followUpCommitment) {
        nextCommitments = [
          ...nextCommitments,
          {
            id: `cmt_${Date.now()}`,
            title: options.followUpCommitment.title || 'Saldo pendiente',
            amount: options.followUpCommitment.amount,
            dueDate: options.followUpCommitment.dueDate,
            currency: payment.currency,
            status: 'pendiente',
            projectId: project.id,
            clientName: project.clientName,
          }
        ];
      }

      onUpdateProject(project.id, {
        payments: nextPayments,
        paymentCommitments: nextCommitments.length > 0 ? nextCommitments : undefined,
      });

      onAddIncome({
        title: payment.note ? `${payment.note} (${project.clientName})` : `Pago de ${project.clientName}`,
        amount: payment.amount,
        currency: payment.currency,
        date: payment.date,
        month: payment.date.slice(0, 7),
        status: 'cobrado',
        projectId: project.id,
        projectName: project.clientName,
      });
    }
  };

  const handleDeletePaymentInternal = (paymentId: string) => {
    if (onDeletePayment) {
      onDeletePayment(project.id, paymentId);
    } else {
      const nextPayments = (project.payments || []).filter(p => p.id !== paymentId);
      onUpdateProject(project.id, { payments: nextPayments });
    }
  };

  // Commitment creation
  const handleSaveCommitment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitmentAmount || Number(commitmentAmount) <= 0) return;
    hapticFeedback.success();
    const newCommitment: FlexiblePaymentCommitment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: commitmentTitle.trim() || 'Próximo pago acordado',
      amount: Number(commitmentAmount),
      currency: billing.currency,
      dueDate: commitmentDate || getTodayString(),
      status: 'pendiente',
      projectId: project.id,
      clientName: project.clientName,
    };
    const updatedCommitments = [...(project.paymentCommitments || []), newCommitment];
    onUpdateProject(project.id, {
      paymentCommitments: updatedCommitments,
    });
    setShowAcordarPagoModal(false);
    setCommitmentTitle('');
  };

  // Retainer saving
  const handleSaveRecurringPlan = (plan: Omit<RecurringIncomePlan, 'id' | 'createdAt'>) => {
    const newPlan: RecurringIncomePlan = {
      ...plan,
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    const updatedPlans = [...(project.recurringPlans || []), newPlan];
    onUpdateProject(project.id, { recurringPlans: updatedPlans });
  };

  const renderPaymentsSection = () => (
    <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <h4 className="text-sm font-bold text-zinc-100">
            Pagos Reales Registrados ({realPayments.length})
          </h4>
        </div>
        <span className="text-xs font-mono font-bold text-emerald-400">
          Total cobrado: {privacyMode ? '$ ••••••' : formatCurrencyAmount(billing.totalCobrado, billing.currency, true)}
        </span>
      </div>

      {realPayments.length === 0 ? (
        <div className="p-8 text-center bg-zinc-950/50 rounded-xl border border-dashed border-zinc-800 space-y-2.5">
          <p className="text-xs text-zinc-400">
            Todavía no registraste ningún pago para este cliente.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingPayment(null);
              setShowRegisterPaymentModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar primer pago</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {realPayments.map((p) => {
            const usdEquiv = p.currency === 'ARS' && p.dolarRef && p.dolarRef > 0
              ? `≈ US$ ${Math.round(p.amount / p.dolarRef).toLocaleString('es-AR')}`
              : null;

            return (
              <div
                key={p.id}
                className="p-3 sm:p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between gap-3 hover:border-zinc-700 transition"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-zinc-100">
                      {privacyMode ? '$ ••••••' : formatCurrencyAmount(p.amount, p.currency, true)}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase">
                      {p.method}
                    </span>
                    {p.invoiced ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/30 font-medium">
                        Facturado
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">
                        Pendiente facturar
                      </span>
                    )}
                    {usdEquiv && (
                      <span className="text-[10.5px] font-mono text-zinc-400">
                        ({usdEquiv})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="font-mono text-[11px] text-zinc-500">{p.date}</span>
                    {p.note && (
                      <>
                        <span>•</span>
                        <span className="text-zinc-300 truncate">{p.note}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPayment(p);
                      setShowRegisterPaymentModal(true);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (deletingPaymentId === p.id) {
                        hapticFeedback.medium();
                        handleDeletePaymentInternal(p.id);
                        setDeletingPaymentId(null);
                      } else {
                        hapticFeedback.light();
                        setDeletingPaymentId(p.id);
                        setTimeout(() => setDeletingPaymentId(null), 4000);
                      }
                    }}
                    className={`p-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 active:scale-95 ${
                      deletingPaymentId === p.id
                        ? 'bg-red-600 text-white shadow-md shadow-red-600/30 animate-pulse'
                        : 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10'
                    }`}
                    title={deletingPaymentId === p.id ? 'Hacé clic de nuevo para confirmar eliminación' : 'Eliminar pago'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deletingPaymentId === p.id && <span className="text-[10px] font-bold">¿Borrar?</span>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (isEditingAgreement) {
    return (
      <AgreementEditorView
        project={project}
        incomes={incomes}
        privacyMode={privacyMode}
        onBack={() => setIsEditingAgreement(false)}
        onSaveAgreement={(updatedAgreement) => {
          onUpdateProject(project.id, {
            billingAgreement: updatedAgreement,
            montoAcordado: updatedAgreement.totalAmount,
            estimatedPrice: updatedAgreement.totalAmount,
            estimatedCurrency: updatedAgreement.currency,
            installments: updatedAgreement.installments.map(u => ({
              id: u.id,
              number: u.number,
              totalInstallments: u.totalInstallments,
              dueDate: u.dueDate,
              amount: u.expectedAmount,
              currency: u.currency,
              status: u.status === 'pagado_a_tiempo' || u.status === 'pagado_tarde' ? 'cobrado' : (u.status === 'vencido' ? 'atrasado' : 'pendiente'),
              paid: u.actualPaidAmount >= u.expectedAmount,
              paidAt: u.paidAt,
              note: u.title,
              incomeRecordId: u.incomeRecordId,
            })),
          });
          setIsEditingAgreement(false);
        }}
      />
    );
  }

  if (selectedCuotaId) {
    return (
      <CuotaDetailView
        project={project}
        cuotaId={selectedCuotaId}
        incomes={incomes}
        personalAccounts={personalAccounts}
        studioSettings={studioSettings}
        privacyMode={privacyMode}
        usdRate={usdRate}
        onBack={() => setSelectedCuotaId(null)}
        onOpenRegisterPayment={(cuota) => {
          setSelectedCuotaId(null);
          if (onNavigate) {
            onNavigate(`/clientes/${project.id}/cobro/nuevo`);
          } else {
            setEditingPayment(null);
            setShowRegisterPaymentModal(true);
          }
        }}
        onUpdateCuota={(updatedCuota) => {
          const agreement = resolveProjectAgreement(project, incomes);
          const updatedInstallments = agreement.installments.map(i => i.id === updatedCuota.id ? updatedCuota : i);
          const updatedAgreement: BillingAgreement = {
            ...agreement,
            installments: updatedInstallments,
          };
          onUpdateProject(project.id, {
            billingAgreement: updatedAgreement,
            installments: updatedInstallments.map(u => ({
              id: u.id,
              number: u.number,
              totalInstallments: u.totalInstallments,
              dueDate: u.dueDate,
              amount: u.expectedAmount,
              currency: u.currency,
              status: u.status === 'pagado_a_tiempo' || u.status === 'pagado_tarde' ? 'cobrado' : (u.status === 'vencido' ? 'atrasado' : 'pendiente'),
              paid: u.actualPaidAmount >= u.expectedAmount,
              paidAt: u.paidAt,
              note: u.title,
              incomeRecordId: u.incomeRecordId,
            })),
          });
        }}
        onDeletePayment={(paymentId) => {
          handleDeletePaymentInternal(paymentId);
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 text-zinc-100 overflow-y-auto animate-in slide-in-from-right-4 duration-150">
      {/* Top Mobile Bar / Desktop Breadcrumb Bar */}
      <div 
        style={{ paddingTop: 'max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.65rem))' }}
        className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 pb-3 flex items-center justify-between safe-area-top-header touch-manipulation"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              onBack();
            }}
            className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-semibold touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver a Clientes</span>
          </button>
          <div className="h-4 w-[1px] bg-zinc-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium hidden sm:inline">
              {isPaf ? 'Programa PAF' : 'Desarrollo Web'}
            </span>
            <span className="text-xs text-zinc-600 hidden sm:inline">/</span>
            <span className="text-xs font-bold text-zinc-200 truncate max-w-[200px] sm:max-w-xs">
              {project.clientName}
            </span>
          </div>
        </div>

        {/* State Badge button with quick override menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStatusPicker(prev => !prev)}
            className={`px-3 py-1 rounded-full text-xs flex items-center gap-1.5 transition cursor-pointer ${statusConfig.badgeClass}`}
            title="Cambiar estado de cliente"
          >
            <StatusIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="font-bold">{statusConfig.label}</span>
            <SlidersHorizontal className="w-3 h-3 opacity-60 ml-0.5" />
          </button>

          {showStatusPicker && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowStatusPicker(false)} 
              />
              <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Cambiar estado visual
                </div>
                {(Object.keys(VISUAL_STATUS_CONFIGS) as ProjectVisualStatus[]).map(statusKey => {
                  const cfg = VISUAL_STATUS_CONFIGS[statusKey];
                  const Icon = cfg.icon;
                  const isCurrent = project.statusOverride === statusKey || (!project.statusOverride && statusConfig.id === statusKey);
                  return (
                    <button
                      key={statusKey}
                      type="button"
                      onClick={() => handleSetStatusOverride(statusKey)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition text-left cursor-pointer ${
                        isCurrent ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-white'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotColor}`} />
                      <div className="flex flex-col truncate">
                        <span>{cfg.label}</span>
                        <span className="text-[10px] text-zinc-500 font-normal truncate">{cfg.description}</span>
                      </div>
                    </button>
                  );
                })}

                {project.statusOverride && (
                  <button
                    type="button"
                    onClick={handleClearStatusOverride}
                    className="w-full mt-1 pt-1.5 border-t border-zinc-800 text-[11px] text-zinc-400 hover:text-white flex items-center justify-center gap-1 py-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restablecer cálculo automático</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Container: 2-Column on Desktop (30% Left Sticky / 70% Right) */}
      <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:flex lg:gap-6 items-start">
        
        {/* ================= COLUMNA IZQUIERDA (30% Sticky en Desktop) ================= */}
        <aside className="w-full lg:w-[320px] lg:shrink-0 lg:sticky lg:top-20 space-y-4 mb-6 lg:mb-0">
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
            {/* 1. Header: Avatar & Client Name */}
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] text-lg font-black shrink-0">
                {project.clientName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-extrabold text-zinc-100 tracking-tight leading-snug truncate">
                  {project.clientName}
                </h2>
                {project.ownerName && (
                  <p className="text-xs text-zinc-400 font-medium truncate flex items-center gap-1 mt-0.5">
                    <User className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span>{project.ownerName}</span>
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-mono">
                    {isPaf ? 'Programa PAF' : 'Desarrollo Web'}
                  </span>
                  {project.isLead && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                      Lead / Prospecto
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Direct Quick Contacts (WhatsApp, Call, Web, Instagram) */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/60">
              {project.clientPhone ? (
                <>
                  <a
                    href={formatWhatsAppUrl(project.clientPhone, `Hola ${project.ownerName || project.clientName}, te escribo desde .Cero…`)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition active:scale-95"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                  <a
                    href={formatTelUrl(project.clientPhone)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Llamar</span>
                  </a>
                </>
              ) : (
                <div className="col-span-2 py-1 text-center text-xs text-zinc-500 italic">
                  Sin teléfono registrado
                </div>
              )}

              {project.websiteUrl && (
                <a
                  href={project.websiteUrl.startsWith('http') ? project.websiteUrl : `https://${project.websiteUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="col-span-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 text-xs transition"
                >
                  <Globe className="w-3 h-3 text-zinc-400" />
                  <span className="truncate">Sitio Web</span>
                </a>
              )}

              {project.instagramUrl && (
                <a
                  href={project.instagramUrl.startsWith('http') ? project.instagramUrl : `https://instagram.com/${project.instagramUrl.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="col-span-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 text-xs transition"
                >
                  <Instagram className="w-3 h-3 text-pink-400" />
                  <span className="truncate">Instagram</span>
                </a>
              )}
            </div>

            {/* 3. Fast Financial & Dates Summary */}
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Monto total acordado:</span>
                <span className="font-mono font-bold text-zinc-100">
                  {privacyMode
                    ? '$ ••••••'
                    : formatProjectPrice(project.estimatedPrice || 0, resolveProjectCurrency(project.estimatedCurrency, project.estimatedPrice))}
                </span>
              </div>

              {isPaf && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Consultoría 1:1 realizada:</span>
                  <span className="font-mono font-bold text-[var(--accent)]">
                    {project.pafConsultingHoursDone || 0} / {project.pafConsultingHoursTotal || 26} hs
                  </span>
                </div>
              )}

              {project.startDate && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Fecha de inicio:</span>
                  <span className="font-mono text-zinc-300">{project.startDate}</span>
                </div>
              )}

              {project.deliveryDate && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Entrega estimada:</span>
                  <span className="font-mono text-zinc-300">{project.deliveryDate}</span>
                </div>
              )}
            </div>

            {/* 4. Fixed Actions: Registrar pago & Archivar / Eliminar */}
            <div className="pt-2 border-t border-zinc-800/60 space-y-2">
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.medium();
                  setEditingPayment(null);
                  setShowRegisterPaymentModal(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Registrar pago</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendSmartWhatsApp()}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs font-semibold transition border border-zinc-700/60 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp de cobro</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmArchive(true)}
                  className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-800/70 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{project.archived ? 'Desarchivar' : 'Archivar'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="p-1.5 rounded-xl bg-zinc-800/70 hover:bg-red-500/15 text-zinc-500 hover:text-red-400 transition cursor-pointer"
                  title="Eliminar cliente"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Key Links Card */}
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 shadow-md">
            <ProjectKeyLinks
              links={project.keyLinks}
              onUpdateLinks={(links) => onUpdateProject(project.id, { keyLinks: links })}
              clientName={project.clientName}
            />
          </div>
        </aside>

        {/* ================= COLUMNA DERECHA (70% Scrollable) ================= */}
        <main className="flex-1 min-w-0 space-y-4">
          {/* Universal Timeline de Cuotas con Chips & Barra de Progreso */}
          <ClientInstallmentTimeline
            project={project}
            incomes={incomes}
            privacyMode={privacyMode}
            onSelectCuota={(id) => setSelectedCuotaId(id)}
            onOpenRegisterPayment={() => {
              if (onNavigate) {
                onNavigate(`/clientes/${project.id}/cobro/nuevo`);
              } else {
                setEditingPayment(null);
                setShowRegisterPaymentModal(true);
              }
            }}
            onOpenAgreementEditor={() => setIsEditingAgreement(true)}
          />

          {/* Horizontal Tabs: 5 Unified Tabs per Stage 3 spec: Resumen · Cobros · Trabajo · Notas · Horas */}
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-1.5 sticky top-16 z-10 backdrop-blur-md">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
              {[
                { id: 'resumen' as ClientTab, label: 'Resumen', icon: Sparkles },
                { id: 'cobros' as ClientTab, label: 'Cobros', icon: DollarSign },
                { id: 'trabajo' as ClientTab, label: `Trabajo (${clientTasks.length + clientMeetings.length})`, icon: CheckCircle2 },
                { id: 'notas' as ClientTab, label: 'Notas & Links', icon: FileText },
                { id: 'horas' as ClientTab, label: `Horas (${timeLogs.filter(t => t.projectId === project.id).length})`, icon: Clock },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      hapticFeedback.light();
                      setActiveTab(tab.id);
                    }}
                    className={`min-h-[44px] sm:min-h-[34px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB CONTENTS (FADE-IN NO RELOAD) */}
          <div className="space-y-4">
            {/* 1. RESUMEN: 5-Second Executive Dashboard */}
            {activeTab === 'resumen' && (
              <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 space-y-5 animate-in fade-in duration-150">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                      <span>Resumen Ejecutivo</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Estado actual, barra de cobros, próximo paso y semáforo de contacto.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('cobros')}
                    className="text-xs text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>Ver detalle de cobros</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 5-Second 3-Grid Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Metric 1: Estado del Proyecto */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Estado</span>
                    <div className="flex items-center gap-2">
                      <StatusIcon className="w-4 h-4 text-[var(--accent)]" />
                      <span className="text-xs font-bold text-zinc-100">{statusConfig.label}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 block truncate">{statusConfig.description}</span>
                  </div>

                  {/* Metric 2: Próximo Paso */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Próximo paso</span>
                    {clientTasks.find(t => !t.completed) ? (
                      <p className="text-xs font-bold text-zinc-100 truncate">
                        {clientTasks.find(t => !t.completed)?.title}
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-400 font-medium">Sin tareas pendientes</p>
                    )}
                    <span className="text-[10px] text-zinc-400 block">
                      {clientTasks.filter(t => !t.completed).length} tareas en cola
                    </span>
                  </div>

                  {/* Metric 3: Último Contacto / Semáforo */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Contacto</span>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-zinc-100">Al día</span>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      {project.clientPhone && (
                        <a
                          href={formatWhatsAppUrl(project.clientPhone, `Hola ${project.ownerName || project.clientName}, ¿cómo estás?`)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-emerald-400 font-semibold hover:underline flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                      {project.clientPhone && (
                        <a
                          href={formatTelUrl(project.clientPhone)}
                          className="text-[11px] text-zinc-300 font-semibold hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          <span>Llamar</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress bar inside Resumen */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-xs font-semibold text-zinc-300 block">Progreso financiero</span>
                  <ProjectPaymentProgressBar
                    project={project}
                    incomes={incomes}
                    usdRate={usdRate}
                    privacyMode={privacyMode}
                    onOpenRegisterPayment={() => {
                      setEditingPayment(null);
                      setShowRegisterPaymentModal(true);
                    }}
                  />
                </div>

                {/* Puntualidad y Hábitos de Pago */}
                <ClientPaymentHabitsCard
                  project={project}
                  incomes={incomes}
                  privacyMode={privacyMode}
                />

                {/* Sección Horizonte (Largo Plazo, Fechas, Frente & Capacidad) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
                        <Compass className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-zinc-100 font-heading">
                            Planificación en Horizonte
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                            {derivedHorizon.frente} · {derivedHorizon.estado}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Parámetros para la línea de tiempo de largo plazo, cálculo de ocupación y reparto de frentes.
                        </p>
                      </div>
                    </div>

                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => {
                          hapticFeedback.light();
                          onNavigate('/horizonte');
                        }}
                        className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                      >
                        <span>Ver en Horizonte</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Configuración de campos de Horizonte */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {/* 1. Fecha Inicio */}
                    <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                          Fecha Inicio
                        </label>
                        {project.horizonStart && (
                          <button
                            type="button"
                            onClick={() => onUpdateProject(project.id, { horizonStart: undefined })}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                            title="Volver a fecha derivada automáticamente"
                          >
                            Auto
                          </button>
                        )}
                      </div>
                      <input
                        type="date"
                        value={project.horizonStart || ''}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          onUpdateProject(project.id, { horizonStart: val || undefined });
                        }}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-sky-500 font-mono"
                      />
                      <span className="text-[10px] text-zinc-500 block truncate font-mono">
                        {project.horizonStart ? 'Manual (override)' : `Auto: ${derivedHorizon.inicio || 'Sin fechas'}`}
                      </span>
                    </div>

                    {/* 2. Fecha Fin */}
                    <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                          Fecha Fin
                        </label>
                        {project.horizonEnd && (
                          <button
                            type="button"
                            onClick={() => onUpdateProject(project.id, { horizonEnd: undefined })}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                            title="Volver a fecha derivada automáticamente"
                          >
                            Auto
                          </button>
                        )}
                      </div>
                      <input
                        type="date"
                        value={project.horizonEnd || ''}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          onUpdateProject(project.id, { horizonEnd: val || undefined });
                        }}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-sky-500 font-mono"
                      />
                      <span className="text-[10px] text-zinc-500 block truncate font-mono">
                        {project.horizonEnd ? 'Manual (override)' : `Auto: ${derivedHorizon.fin || 'Sin fechas'}`}
                      </span>
                    </div>

                    {/* 3. Frente (Override) */}
                    <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                          Frente de Trabajo
                        </label>
                        {project.frente && (
                          <button
                            type="button"
                            onClick={() => onUpdateProject(project.id, { frente: undefined })}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
                          >
                            Auto
                          </button>
                        )}
                      </div>
                      <select
                        value={project.frente || ''}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          onUpdateProject(project.id, { frente: val || undefined });
                        }}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-sky-500 font-medium cursor-pointer"
                      >
                        <option value="">Automático ({derivedHorizon.frente})</option>
                        <option value="PAF">Método PAF</option>
                        <option value="Webs">Proyectos Web</option>
                        <option value="Otros">Otros Servicios</option>
                      </select>
                      <span className="text-[10px] text-zinc-500 block truncate font-mono">
                        {project.frente ? 'Manual (override)' : `Auto por tipo: ${derivedHorizon.frente}`}
                      </span>
                    </div>

                    {/* 4. Cupos Simultáneos */}
                    <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                          Cupos Simultáneos
                        </label>
                        <span className="text-[10px] text-zinc-500 font-mono">Def: 1</span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={project.cupos ?? 1}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          onUpdateProject(project.id, { cupos: isNaN(val) || val < 1 ? 1 : val });
                        }}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-sky-500 font-mono font-bold"
                      />
                      <span className="text-[10px] text-zinc-500 block truncate">
                        Pesa como {derivedHorizon.cupos} {derivedHorizon.cupos === 1 ? 'lugar' : 'lugares'} en la ocupación mensual
                      </span>
                    </div>
                  </div>
                </div>

                {/* Project notes or quick description */}
                {project.notes && (
                  <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800 text-xs text-zinc-300">
                    <span className="font-semibold text-zinc-400 block mb-1">Notas / Objetivo:</span>
                    <p>{project.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* 2. COBROS: Unified Billing, Real Payments & Flexible Commitments */}
            {activeTab === 'cobros' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Puntualidad y Hábitos de Pago del Cliente */}
                <ClientPaymentHabitsCard
                  project={project}
                  incomes={incomes}
                  privacyMode={privacyMode}
                />

                {/* Actions & Quick Buttons */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.medium();
                        setEditingPayment(null);
                        setShowRegisterPaymentModal(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>Registrar pago</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.light();
                        setCommitmentAmount(billing.saldoPendiente > 0 ? String(billing.saldoPendiente) : '');
                        setShowAcordarPagoModal(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition border border-zinc-700/70 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>Acordar próximo pago</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSendSmartWhatsApp()}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp de cobro</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowStudioSettings(true)}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition cursor-pointer border border-zinc-700/60"
                      title="Configurar datos de cobro (CBU/Alias)"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 1. PAGOS REALES REGISTRADOS */}
                {renderPaymentsSection()}

                {/* 2. COMPROMISOS Y PRÓXIMOS PAGOS (OPCIONAL) */}
                <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-bold text-zinc-100">
                        Compromisos y Recordatorios de Pago ({billing.commitments.length})
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCommitmentAmount(billing.saldoPendiente > 0 ? String(billing.saldoPendiente) : '');
                        setShowAcordarPagoModal(true);
                      }}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Acordar pago</span>
                    </button>
                  </div>

                  {billing.commitments.length === 0 ? (
                    <div className="p-4 text-center bg-zinc-950/40 rounded-xl border border-zinc-800/60">
                      <p className="text-xs text-zinc-500">
                        Sin compromisos agendados. Podés pactar una fecha de cobro estimada cuando quieras.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {billing.commitments.map((c) => (
                        <div
                          key={c.id}
                          className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-zinc-100 block">{c.title}</span>
                            <span className="text-[11px] font-mono text-zinc-400">
                              Vence: {c.dueDate || 'Sin fecha'} · {formatCurrencyAmount(c.amount, billing.currency, true)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingPayment(null);
                              setShowRegisterPaymentModal(true);
                            }}
                            className="px-3 py-1.5 rounded-xl btn-solid-primary text-xs font-semibold cursor-pointer active:scale-95"
                          >
                            Registrar cobro
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. TRABAJO: 12 Semanas PAF o Entregables Web + Tareas & Reuniones vinculadas */}
            {activeTab === 'trabajo' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                {isPaf && (
                  <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold text-zinc-100 flex items-center gap-2">
                          <Award className="w-4 h-4 text-[var(--accent)]" />
                          <span>Las 5 Etapas del Método PAF</span>
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Diagnóstico, Oferta Irresistible, Contenido, Prospección y Cierre.
                        </p>
                      </div>

                      {/* Stage badge selector */}
                      <select
                        value={project.pafStage || 'Kick-Off'}
                        onChange={(e) => {
                          hapticFeedback.selection();
                          onUpdateProject(project.id, { pafStage: e.target.value as PafStage });
                        }}
                        className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-xl px-2.5 py-1.5 font-bold"
                      >
                        {PAF_STAGES.map(stg => (
                          <option key={stg} value={stg}>{stg}</option>
                        ))}
                      </select>
                    </div>

                    {/* Visual Stage Progress Stepper */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {PAF_STAGES.map((stg, index) => {
                        const currentIndex = (PAF_STAGES as readonly string[]).indexOf(project.pafStage || PAF_STAGES[0]);
                        const isDone = index < currentIndex;
                        const isCurrent = index === currentIndex;
                        return (
                          <button
                            key={stg}
                            type="button"
                            onClick={() => {
                              hapticFeedback.selection();
                              onUpdateProject(project.id, { pafStage: stg });
                            }}
                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                              isCurrent
                                ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-white shadow-xs'
                                : isDone
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-zinc-950/40 border-zinc-800/70 text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            <div className="text-[10px] font-mono uppercase tracking-wider mb-1">
                              Etapa {index + 1}
                            </div>
                            <div className="text-xs font-bold leading-tight truncate">
                              {stg}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Seccion Colapsable 1: Tareas del Cliente */}
                <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl overflow-hidden">
                  <div
                    onClick={() => setTrabajoTareasOpen(prev => !prev)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none hover:bg-zinc-800/40 transition"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[var(--accent)]" />
                      <h4 className="text-sm font-bold text-zinc-100">
                        Tareas Vinculadas ({clientTasks.length})
                      </h4>
                      <span className="text-[11px] font-mono text-zinc-400">
                        ({clientTasks.filter(t => t.completed).length} hechas)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowNewTaskInput(true);
                          setTrabajoTareasOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg btn-solid-primary text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Tarea</span>
                      </button>
                      {trabajoTareasOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                    </div>
                  </div>

                  {trabajoTareasOpen && (
                    <div className="p-4 border-t border-zinc-800/80 space-y-3">
                      {/* Inline new task form */}
                      {showNewTaskInput && (
                        <form onSubmit={handleQuickAddTask} className="flex gap-2 p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl">
                          <input
                            type="text"
                            placeholder="Nombre de la tarea…"
                            value={newTaskTitle}
                            onChange={e => setNewTaskTitle(e.target.value)}
                            className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[var(--accent)]"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded-lg btn-solid-primary text-xs font-bold"
                          >
                            Agregar
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowNewTaskInput(false)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs hover:text-white"
                          >
                            Cancelar
                          </button>
                        </form>
                      )}

                      {/* Task List */}
                      <div className="space-y-1.5">
                        {clientTasks.length === 0 ? (
                          <div className="p-4 text-center bg-zinc-950/40 rounded-xl border border-zinc-800/60 text-xs text-zinc-400">
                            Sin tareas pendientes
                          </div>
                        ) : (
                          clientTasks.map(t => (
                            <div
                              key={t.id}
                              className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition ${
                                t.completed ? 'bg-zinc-950/40 border-zinc-800/50 opacity-65' : 'bg-zinc-950/80 border-zinc-800/80 hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    hapticFeedback.medium();
                                    playTaskDone();
                                    onToggleTask(t.id);
                                  }}
                                  className="mt-0.5 text-zinc-400 hover:text-[var(--accent)] cursor-pointer"
                                >
                                  {t.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <Circle className="w-4 h-4" />
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs ${t.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                                    {t.title}
                                  </p>
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    {t.date}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  hapticFeedback.light();
                                  onDeleteTask(t.id);
                                }}
                                className="text-zinc-600 hover:text-red-400 p-1 rounded transition"
                                title="Eliminar tarea"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Seccion Colapsable 2: Sesiones / Reuniones */}
                <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl overflow-hidden">
                  <div
                    onClick={() => setTrabajoReunionesOpen(prev => !prev)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none hover:bg-zinc-800/40 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-bold text-zinc-100">
                        Sesiones & Reuniones ({clientMeetings.length})
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddMeeting({
                            title: `Reunión con ${project.clientName}`,
                            date: getTodayString(),
                            time: '11:00',
                            completed: false,
                            projectId: project.id,
                            projectName: project.clientName,
                          });
                          setTrabajoReunionesOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg btn-solid-primary text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Reunión</span>
                      </button>
                      {trabajoReunionesOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                    </div>
                  </div>

                  {trabajoReunionesOpen && (
                    <div className="p-4 border-t border-zinc-800/80 space-y-2">
                      {clientMeetings.length === 0 ? (
                        <div className="p-4 text-center bg-zinc-950/40 rounded-xl border border-zinc-800/60 text-xs text-zinc-400">
                          Sin reuniones programadas
                        </div>
                      ) : (
                        clientMeetings.map(m => (
                          <div
                            key={m.id}
                            className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                              m.completed ? 'bg-zinc-950/40 border-zinc-800/50 opacity-65' : 'bg-zinc-950/80 border-zinc-800/80'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() => {
                                  hapticFeedback.medium();
                                  onToggleMeeting(m.id);
                                }}
                                className="mt-0.5 text-zinc-400 hover:text-emerald-400 cursor-pointer"
                              >
                                {m.completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Circle className="w-4 h-4" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold ${m.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                                  {m.title}
                                </p>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  {m.date} {m.time ? `• ${m.time}` : ''}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                hapticFeedback.light();
                                onDeleteMeeting(m.id);
                              }}
                              className="text-zinc-600 hover:text-red-400 p-1 rounded transition"
                              title="Eliminar reunión"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. NOTAS & LINKS */}
            {activeTab === 'notas' && (
              <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[var(--accent)]" />
                      <span>Bitácora, Requerimientos & Notas</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Podés vincular notas con otras usando [[Nombre de Nota]].
                    </p>
                  </div>

                  {!editingNotes ? (
                    <button
                      type="button"
                      onClick={() => setEditingNotes(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar notas</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveNotes}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Guardar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNotesText(project.notes || '');
                          setEditingNotes(false);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {editingNotes ? (
                  <textarea
                    rows={8}
                    value={notesText}
                    onChange={e => setNotesText(e.target.value)}
                    placeholder="Escribí notas libres, requerimientos técnicos, links a Figma o Drive…"
                    className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-[var(--accent)] font-mono leading-relaxed resize-y"
                  />
                ) : (
                  <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 min-h-[140px] text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                    {project.notes ? (
                      <LinkedText text={project.notes} catalog={catalog} onNavigate={onNavigate} />
                    ) : (
                      <span className="text-zinc-600 italic">Sin notas registradas. Hacé clic en "Editar" para escribir. Puedes usar [[Nombre]] para conectar.</span>
                    )}
                  </div>
                )}

                {/* Backlinks & Mini-grafo local de este cliente */}
                <div className="pt-4 border-t border-zinc-800/80 space-y-4">
                  <BacklinksPanel
                    entityId={project.id}
                    relations={relations}
                    catalog={catalog}
                    onNavigate={onNavigate}
                  />

                  <LocalGraphWidget
                    entityId={project.id}
                    catalog={catalog}
                    relations={relations}
                    onNavigate={onNavigate}
                    privacyMode={privacyMode}
                  />
                </div>
              </div>
            )}

            {/* 5. HORAS & TIME TRACKING */}
            {activeTab === 'horas' && (
              <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 space-y-4 animate-in fade-in duration-150">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--accent)]" />
                    <span>Control de Horas & Dedicación ({project.clientName})</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Registro de tiempo trabajado, cálculo de tarifa horaria y rentabilidad real.
                  </p>
                </div>

                <TimeTrackerSection
                  project={project}
                  timeLogs={timeLogs}
                  onAddTimeLog={onAddTimeLog}
                  onDeleteTimeLog={onDeleteTimeLog}
                  incomeCobrado={incomes.filter(i => i.projectId === project.id && i.status === 'cobrado').reduce((acc, c) => acc + c.amount, 0)}
                  incomeCurrency={resolveProjectCurrency(project.estimatedCurrency, project.estimatedPrice)}
                  privacyMode={privacyMode}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Confirmation Modal: Delete Project */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-100">¿Eliminar {project.clientName}?</h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Esta acción no se puede deshacer. Se desvincularán sus tareas asociadas.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 text-xs text-zinc-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.heavy();
                  onDeleteProject(project.id);
                  onBack();
                }}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/25"
              >
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Archive Project */}
      {confirmArchive && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-100">
                  {project.archived ? '¿Desarchivar cliente?' : '¿Archivar cliente?'}
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {project.archived
                    ? 'El cliente volverá a aparecer en el listado activo de proyectos.'
                    : 'El cliente se moverá al archivo histórico y no aparecerá en el día a día.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setConfirmArchive(false)}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 text-xs text-zinc-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.medium();
                  onToggleArchive(project.id);
                  setConfirmArchive(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-xs font-bold"
              >
                {project.archived ? 'Desarchivar' : 'Confirmar archivo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Register / Edit Payment Modal */}
      <RegisterPaymentModal
        isOpen={showRegisterPaymentModal}
        onClose={() => {
          setShowRegisterPaymentModal(false);
          setEditingPayment(null);
        }}
        project={project}
        incomes={incomes}
        personalAccounts={personalAccounts}
        usdRate={usdRate}
        initialPayment={editingPayment}
        onSavePayment={handleSavePaymentInternal}
        onDeletePayment={handleDeletePaymentInternal}
      />

      {/* 2. Suggest Retainer Modal (Web projects) */}
      <SuggestRetainerModal
        isOpen={showSuggestRetainer}
        onClose={() => setShowSuggestRetainer(false)}
        project={project}
        onSaveRecurring={handleSaveRecurringPlan}
      />

      {/* 3. Studio Payment Settings Modal */}
      <StudioPaymentSettingsModal
        isOpen={showStudioSettings}
        onClose={() => setShowStudioSettings(false)}
        settings={studioSettings || {}}
        onSave={(newSettings) => {
          if (onOpenStudioPaymentSettings) {
            onOpenStudioPaymentSettings();
          }
        }}
      />

      {/* 4. Acordar Próximo Pago Modal */}
      {showAcordarPagoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                  Compromiso de Cobro
                </span>
                <h4 className="text-base font-bold text-zinc-100">
                  Acordar Próximo Pago
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAcordarPagoModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCommitment} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zinc-300">
                  Concepto / Hito acordado
                </label>
                <input
                  type="text"
                  placeholder="Ej. Anticipo 50%, Entrega Web, Cuota 2"
                  value={commitmentTitle}
                  onChange={(e) => setCommitmentTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-zinc-300">
                    Monto estimado ({billing.currency}) *
                  </label>
                  {billing.saldoPendiente > 0 && (
                    <button
                      type="button"
                      onClick={() => setCommitmentAmount(String(billing.saldoPendiente))}
                      className="text-[10.5px] font-mono text-amber-400 hover:underline cursor-pointer"
                    >
                      Saldo total ({formatCurrencyAmount(billing.saldoPendiente, billing.currency)})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={commitmentAmount}
                  onChange={(e) => setCommitmentAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-sm font-bold text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zinc-300">
                  Fecha límite pactada *
                </label>
                <input
                  type="date"
                  required
                  value={commitmentDate}
                  onChange={(e) => setCommitmentDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAcordarPagoModal(false)}
                  className="px-3 py-2 rounded-xl text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
                >
                  Guardar compromiso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
