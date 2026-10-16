import React, { useState, useRef, useEffect } from 'react';
import { ModalPortal } from './ModalPortal';
import { 
  AgendaTask, 
  AgendaMeeting, 
  Project, 
  IncomeRecord, 
  ExpenseRecord,
  DEFAULT_PROJECT_STATUSES,
  DEFAULT_EXPENSE_CATEGORIES,
  ProjectType,
  PafStage,
  PAF_STAGES,
  PafMilestone,
  DailyAllocationBucketId,
  TaskPriority,
  WeeklyMission
} from '../types';
import { TASK_CATEGORIES, TASK_PRIORITIES, inferTaskCategory } from '../utils/taskCategories';
import { PAF_PRO_MILESTONES, PAF_BASE_MILESTONES } from '../utils/pafTemplates';
import { getTodayString, getMonthKey } from '../utils/storage';
import { 
  CheckSquare, 
  Calendar, 
  FolderKanban, 
  DollarSign, 
  TrendingDown,
  Target,
  X, 
  Plus,
  Mic,
  MicOff,
  Sparkles,
  Phone,
  Bell,
  CalendarCheck,
  Info,
  Loader2,
  AlertCircle,
  Wallet
} from 'lucide-react';
import { navigateTo } from '../utils/router';
import { 
  createSpeechRecognizer, 
  isSpeechSupported, 
  isMediaRecorderSupported,
  createAudioRecorder,
  transcribeAudioWithAI,
  parseSpokenInput, 
  isIOSDevice, 
  isStandalonePWA 
} from '../utils/speech';
import { parseNaturalLanguageInput, ParsedNaturalLanguage } from '../utils/naturalLanguage';
import { hapticFeedback } from '../utils/haptics';
import { generateCalendarICS } from '../utils/calendarIcs';
import { requestNotificationPermission, getNotificationPermissionStatus } from '../utils/notifications';

export type QuickAddType = 'tarea' | 'reunion' | 'proyecto' | 'ingreso' | 'gasto' | 'objetivo';

export const sanitizeQuickAddType = (val: any): QuickAddType => {
  if (typeof val === 'string' && ['tarea', 'reunion', 'proyecto', 'ingreso', 'gasto', 'objetivo'].includes(val)) {
    return val as QuickAddType;
  }
  return 'tarea';
};

interface Props {
  isOpen: boolean;
  initialType?: QuickAddType;
  initialDate?: string;
  projects?: Project[];
  missions?: WeeklyMission[];
  onClose: () => void;
  onAddTask: (task: Omit<AgendaTask, 'id' | 'createdAt'>) => void;
  onAddMeeting: (meeting: Omit<AgendaMeeting, 'id' | 'createdAt'>) => void;
  onAddProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onAddIncome: (income: Omit<IncomeRecord, 'id' | 'createdAt'>) => void;
  onAddExpense?: (expense: Omit<ExpenseRecord, 'id' | 'createdAt'>) => void;
  onAddWeeklyGoal?: (title: string, category?: 'ventas' | 'produccion' | 'organizacion' | 'general') => void;
}

export const QuickAddModal: React.FC<Props> = ({
  isOpen,
  initialType = 'tarea',
  initialDate,
  projects = [],
  missions = [],
  onClose,
  onAddTask,
  onAddMeeting,
  onAddProject,
  onAddIncome,
  onAddExpense = () => {},
  onAddWeeklyGoal = () => {},
}) => {
  if (!isOpen) return null;

  const today = (typeof initialDate === 'string' && initialDate) || getTodayString();
  const [type, setType] = useState<QuickAddType>(() => sanitizeQuickAddType(initialType));
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [taskMissionId, setTaskMissionId] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [speechStatusText, setSpeechStatusText] = useState<string | null>(null);
  const recognizerRef = useRef<{ start: () => void; stop: () => void; isSupported: boolean } | null>(null);
  const audioRecorderRef = useRef<ReturnType<typeof createAudioRecorder> | null>(null);

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState<DailyAllocationBucketId | 'general'>('general');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('media');
  const [taskDate, setTaskDate] = useState(today);
  const [taskTime, setTaskTime] = useState('');
  const [taskReminderActive, setTaskReminderActive] = useState(false);
  const [taskReminderMinutes, setTaskReminderMinutes] = useState<number>(0);
  const [taskAddToAppleCalendar, setTaskAddToAppleCalendar] = useState(false);
  const [taskSubtasks, setTaskSubtasks] = useState<string[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');

  // Meeting form state
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(today);
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingDurationHours, setMeetingDurationHours] = useState<number>(1);
  const [meetingNotes, setMeetingNotes] = useState('');
  const [meetingPhone, setMeetingPhone] = useState('');
  const [meetingReminderActive, setMeetingReminderActive] = useState(false);
  const [meetingReminderMinutes, setMeetingReminderMinutes] = useState<number>(15);
  const [meetingAddToAppleCalendar, setMeetingAddToAppleCalendar] = useState(false);

  // Project form state
  const [projectName, setProjectName] = useState('');
  const [projectStatus, setProjectStatus] = useState<string>('En curso');
  const [projectNotes, setProjectNotes] = useState('');
  const [projectPhone, setProjectPhone] = useState('');
  const [projectIsLead, setProjectIsLead] = useState<boolean>(false);
  const [projectEstimatedPrice, setProjectEstimatedPrice] = useState<number | ''>('');
  const [projectEstimatedCurrency, setProjectEstimatedCurrency] = useState<'USD' | 'ARS'>('USD');
  const [projectType, setProjectType] = useState<ProjectType>('otro');
  const [projectPafStage, setProjectPafStage] = useState<PafStage>('Kick-off / Diagnóstico');

  // Income form state
  const [incomeTitle, setIncomeTitle] = useState('');
  const [incomeAmount, setIncomeAmount] = useState<number | ''>('');
  const [incomeCurrency, setIncomeCurrency] = useState<'USD' | 'ARS'>('USD');
  const [incomeDate, setIncomeDate] = useState(today);
  const [incomeStatus, setIncomeStatus] = useState<'cobrado' | 'pendiente'>('cobrado');

  // Expense form state
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseCurrency, setExpenseCurrency] = useState<'USD' | 'ARS'>('ARS');
  const [expenseCategory, setExpenseCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [expenseDate, setExpenseDate] = useState(today);
  const [expenseStatus, setExpenseStatus] = useState<'pagado' | 'pendiente'>('pagado');

  // Weekly Goal form state
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState<'ventas' | 'produccion' | 'organizacion' | 'general'>('general');

  // Smart Natural Language text input
  const [smartInputText, setSmartInputText] = useState('');
  const [parsedNLPreview, setParsedNLPreview] = useState<ParsedNaturalLanguage | null>(null);

  const handleSmartInputChange = (input: string) => {
    setValidationError(null);
    setSmartInputText(input);
    if (!input.trim()) {
      setParsedNLPreview(null);
      return;
    }

    const parsed = parseNaturalLanguageInput(input, today);
    setParsedNLPreview(parsed);

    // Auto switch type if detected
    if (parsed.type && parsed.type !== type) {
      setType(parsed.type);
    }

    // Match client with project if possible
    if (parsed.clientName) {
      const match = projects.find(
        p => p.clientName.toLowerCase().includes(parsed.clientName!.toLowerCase()) ||
             (p.ownerName && p.ownerName.toLowerCase().includes(parsed.clientName!.toLowerCase()))
      );
      if (match) {
        setSelectedProjectId(match.id);
      }
    }

    // Auto fill form fields according to type
    const targetType = parsed.type || type;
    if (targetType === 'reunion') {
      if (parsed.cleanTitle) setMeetingTitle(parsed.cleanTitle);
      if (parsed.date) setMeetingDate(parsed.date);
      if (parsed.time) setMeetingTime(parsed.time);
      if (parsed.clientPhone) setMeetingPhone(parsed.clientPhone);
    } else if (targetType === 'tarea') {
      if (parsed.cleanTitle) setTaskTitle(parsed.cleanTitle);
      if (parsed.date) setTaskDate(parsed.date);
      if (parsed.time) setTaskTime(parsed.time);
    } else if (targetType === 'ingreso') {
      if (parsed.cleanTitle) setIncomeTitle(parsed.cleanTitle);
      if (parsed.amount) setIncomeAmount(parsed.amount);
      if (parsed.currency) setIncomeCurrency(parsed.currency);
      if (parsed.date) setIncomeDate(parsed.date);
    } else if (targetType === 'gasto') {
      if (parsed.cleanTitle) setExpenseTitle(parsed.cleanTitle);
      if (parsed.amount) setExpenseAmount(parsed.amount);
      if (parsed.currency) setExpenseCurrency(parsed.currency);
      if (parsed.date) setExpenseDate(parsed.date);
    } else if (targetType === 'proyecto') {
      if (parsed.cleanTitle) setProjectName(parsed.cleanTitle);
      if (parsed.clientPhone) setProjectPhone(parsed.clientPhone);
    } else if (targetType === 'objetivo') {
      if (parsed.cleanTitle) setGoalTitle(parsed.cleanTitle);
    }
  };

  // Helper to apply parsed voice data
  const applyVoiceResult = (parsed: {
    cleanTitle: string;
    inferredType?: QuickAddType;
    inferredDate?: string;
    inferredTime?: string;
    inferredPhone?: string;
    inferredClient?: string;
    notes?: string;
    amount?: number;
    category?: string;
  }) => {
    const targetType = parsed.inferredType || type;
    if (targetType !== type) {
      setType(targetType);
    }

    if (targetType === 'reunion') {
      setMeetingTitle(parsed.cleanTitle);
      if (parsed.inferredDate) setMeetingDate(parsed.inferredDate);
      if (parsed.inferredTime) setMeetingTime(parsed.inferredTime);
      if (parsed.inferredPhone) setMeetingPhone(parsed.inferredPhone);
      if (parsed.notes) setMeetingNotes(parsed.notes);
    } else if (targetType === 'tarea') {
      setTaskTitle(parsed.cleanTitle);
      if (parsed.inferredDate) setTaskDate(parsed.inferredDate);
      if (parsed.inferredTime) setTaskTime(parsed.inferredTime);
    } else if (targetType === 'objetivo') {
      setGoalTitle(parsed.cleanTitle);
      if (parsed.category && ['ventas', 'produccion', 'organizacion', 'general'].includes(parsed.category)) {
        setGoalCategory(parsed.category as any);
      }
    } else if (targetType === 'proyecto') {
      setProjectName(parsed.cleanTitle);
      if (parsed.inferredPhone) setProjectPhone(parsed.inferredPhone);
      if (parsed.notes) setProjectNotes(parsed.notes);
    } else if (targetType === 'ingreso') {
      setIncomeTitle(parsed.cleanTitle);
      if (parsed.amount) setIncomeAmount(parsed.amount);
      if (parsed.inferredDate) setIncomeDate(parsed.inferredDate);
    } else if (targetType === 'gasto') {
      setExpenseTitle(parsed.cleanTitle);
      if (parsed.amount) setExpenseAmount(parsed.amount);
      if (parsed.inferredDate) setExpenseDate(parsed.inferredDate);
      if (parsed.category) setExpenseCategory(parsed.category);
    }
  };

  // Toggle voice dictation
  const toggleVoiceDictation = async () => {
    if (isListening) {
      if (audioRecorderRef.current) {
        audioRecorderRef.current.stop();
      }
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    // 1. Try MediaRecorder (universally works on iOS PWA standalone & Android PWA & desktop)
    if (isMediaRecorderSupported()) {
      hapticFeedback.medium();
      setIsListening(true);
      setSpeechStatusText('🎙️ Grabando audio... hablá y tocá el botón cuando termines');

      audioRecorderRef.current = createAudioRecorder(
        async (audioBlob) => {
          setIsListening(false);
          setIsProcessingAI(true);
          setSpeechStatusText('Procesando dictado con IA...');

          try {
            const aiData = await transcribeAudioWithAI(audioBlob, today);
            if (aiData) {
              applyVoiceResult({
                cleanTitle: aiData.title || aiData.transcript,
                inferredType: aiData.type,
                inferredDate: aiData.date || undefined,
                inferredTime: aiData.time || undefined,
                inferredPhone: aiData.clientPhone || undefined,
                inferredClient: aiData.clientName || undefined,
                notes: aiData.notes || undefined,
                amount: aiData.amount || undefined,
                category: aiData.category || undefined,
              });
              hapticFeedback.success();
              const typeLabel = aiData.type ? ` (${aiData.type.toUpperCase()})` : '';
              setSpeechStatusText(`¡Registrado${typeLabel}! "${aiData.transcript}"`);
              setTimeout(() => setSpeechStatusText(null), 3500);
            } else {
              setSpeechStatusText('No se pudo procesar el audio.');
              setTimeout(() => setSpeechStatusText(null), 3000);
            }
          } catch (e) {
            setSpeechStatusText('Error al analizar audio.');
            setTimeout(() => setSpeechStatusText(null), 3000);
          } finally {
            setIsProcessingAI(false);
          }
        },
        (err) => {
          setIsListening(false);
          setIsProcessingAI(false);
          setSpeechStatusText(err);
          setTimeout(() => setSpeechStatusText(null), 3500);
        }
      );

      const started = await audioRecorderRef.current.start();
      if (!started) {
        setIsListening(false);
      }
      return;
    }

    // 2. Fallback to browser SpeechRecognition if MediaRecorder isn't available
    if (isSpeechSupported()) {
      hapticFeedback.medium();
      setIsListening(true);
      setSpeechStatusText('Escuchando... habla ahora');

      recognizerRef.current = createSpeechRecognizer(
        (spokenText, isFinal) => {
          const parsed = parseSpokenInput(spokenText);
          applyVoiceResult(parsed);

          if (isFinal) {
            setIsListening(false);
            setSpeechStatusText('¡Dictado registrado!');
            hapticFeedback.success();
            setTimeout(() => setSpeechStatusText(null), 2500);
          }
        },
        (errMsg) => {
          setIsListening(false);
          setSpeechStatusText(errMsg);
          hapticFeedback.warning();
          setTimeout(() => setSpeechStatusText(null), 3000);
        },
        () => {
          setIsListening(false);
        }
      );

      recognizerRef.current.start();
      return;
    }

    // If neither is supported (e.g. strict iOS restrictions)
    setSpeechStatusText('Micrófono web no disponible. Tocá el campo y usá el 🎙️ del teclado');
    setTimeout(() => setSpeechStatusText(null), 4000);
  };

  useEffect(() => {
    return () => {
      if (audioRecorderRef.current) {
        audioRecorderRef.current.stop();
      }
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
    };
  }, []);

  // Sync initialType & initialDate when modal re-opens
  useEffect(() => {
    if (isOpen) {
      setType(sanitizeQuickAddType(initialType));
      setValidationError(null);
    }
  }, [initialType, isOpen]);

  useEffect(() => {
    if (initialDate) {
      setTaskDate(initialDate);
      setMeetingDate(initialDate);
      setIncomeDate(initialDate);
      setExpenseDate(initialDate);
    }
  }, [initialDate]);

  // Global Escape key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const activeType = sanitizeQuickAddType(type);
    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const pId = selectedProject ? selectedProject.id : undefined;
    const pName = selectedProject ? selectedProject.clientName : undefined;

    // Fallback if user typed only in smartInputText
    const smartText = smartInputText.trim();
    const fallbackTitle = parsedNLPreview?.cleanTitle || smartText;

    if (activeType === 'tarea') {
      const finalTitle = (taskTitle.trim() || fallbackTitle).trim();
      if (!finalTitle) {
        setValidationError('Por favor ingresá el título o descripción de la tarea');
        return;
      }

      hapticFeedback.success();
      const reminderMins = taskReminderActive ? taskReminderMinutes : undefined;

      // If category is general, check if auto-detection matches video/edicion/etc
      const finalCategory = taskCategory !== 'general' ? taskCategory : (inferTaskCategory(finalTitle) || 'general');

      onAddTask({
        title: finalTitle,
        date: taskDate || today,
        time: taskTime || parsedNLPreview?.time || undefined,
        completed: false,
        category: finalCategory,
        priority: taskPriority,
        projectId: pId,
        projectName: pName,
        missionId: taskMissionId || undefined,
        reminderMinutesBefore: reminderMins,
        reminderNotified: false,
        subtasks: taskSubtasks.length > 0
          ? taskSubtasks.map(title => ({
              id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              title,
              completed: false,
              createdAt: today,
            }))
          : undefined,
      });

      // If user requested to add to Apple Calendar / Reminders directly on iPhone
      if (taskAddToAppleCalendar) {
        generateCalendarICS({
          title: finalTitle,
          description: pName ? `Proyecto: ${pName}` : 'Tarea de .Cero CRM',
          date: taskDate || today,
          time: taskTime || parsedNLPreview?.time || undefined,
          alarmMinutesBefore: reminderMins !== undefined ? reminderMins : 15,
        });
      }

      setTaskSubtasks([]);
      setNewSubtaskInput('');
      setTaskReminderActive(false);
      setTaskAddToAppleCalendar(false);
    } else if (activeType === 'reunion') {
      const finalTitle = (meetingTitle.trim() || fallbackTitle).trim();
      if (!finalTitle) {
        setValidationError('Por favor ingresá el título de la reunión o cliente');
        return;
      }

      hapticFeedback.success();
      const reminderMins = meetingReminderActive ? meetingReminderMinutes : undefined;

      const selectedProj = projects.find(p => p.id === pId);
      const isTargetPaf = selectedProj && (
        selectedProj.projectType === 'paf_pro' ||
        selectedProj.projectType === 'paf_base' ||
        selectedProj.pafStage ||
        selectedProj.pafConsultingHoursTotal
      );

      onAddMeeting({
        title: finalTitle,
        date: meetingDate || today,
        time: meetingTime || parsedNLPreview?.time || undefined,
        durationHours: isTargetPaf ? meetingDurationHours : (meetingDurationHours !== 1 ? meetingDurationHours : undefined),
        notes: meetingNotes.trim() || undefined,
        completed: false,
        clientPhone: (meetingPhone.trim() || parsedNLPreview?.clientPhone) || undefined,
        projectId: pId,
        projectName: pName,
        reminderMinutesBefore: reminderMins,
        reminderNotified: false,
      });

      // If user requested to add to Apple Calendar / Reminders directly on iPhone
      if (meetingAddToAppleCalendar) {
        generateCalendarICS({
          title: `Reunión: ${finalTitle}`,
          description: [
            pName ? `Proyecto: ${pName}` : '',
            meetingPhone || parsedNLPreview?.clientPhone ? `Tel/WhatsApp: ${meetingPhone || parsedNLPreview?.clientPhone}` : '',
            meetingNotes ? `Notas: ${meetingNotes}` : '',
          ].filter(Boolean).join('\n'),
          date: meetingDate || today,
          time: meetingTime || parsedNLPreview?.time || undefined,
          alarmMinutesBefore: reminderMins !== undefined ? reminderMins : 15,
        });
      }

      setMeetingReminderActive(false);
      setMeetingAddToAppleCalendar(false);
    } else if (activeType === 'proyecto') {
      const finalName = (projectName.trim() || fallbackTitle).trim();
      if (!finalName) {
        setValidationError('Por favor ingresá el nombre del cliente o proyecto');
        return;
      }

      hapticFeedback.success();
      const isPaf = projectType === 'paf_pro' || projectType === 'paf_base';
      const milestones = isPaf 
        ? (projectType === 'paf_pro' ? PAF_PRO_MILESTONES : PAF_BASE_MILESTONES).map((m, idx) => ({
            id: `paf_${m.month}_${idx}`,
            month: m.month,
            pillar: m.pillar,
            title: m.title,
            week: m.week,
            description: m.description,
            completed: false,
          }))
        : undefined;

      onAddProject({
        clientName: finalName,
        status: projectStatus,
        notes: projectNotes.trim(),
        archived: false,
        clientPhone: (projectPhone.trim() || parsedNLPreview?.clientPhone) || undefined,
        isLead: projectIsLead,
        estimatedPrice: projectEstimatedPrice ? Number(projectEstimatedPrice) : undefined,
        estimatedCurrency: projectEstimatedCurrency,
        projectType: projectType,
        pafStage: isPaf ? projectPafStage : undefined,
        pafConsultingHoursTotal: projectType === 'paf_pro' ? 26 : undefined,
        pafConsultingHoursDone: isPaf ? 0 : undefined,
        pafMilestones: milestones,
      });
      setProjectIsLead(false);
      setProjectEstimatedPrice('');
      setProjectEstimatedCurrency('USD');
      setProjectType('otro');
      setProjectPafStage('Kick-off / Diagnóstico');
    } else if (activeType === 'ingreso') {
      const finalTitle = (incomeTitle.trim() || fallbackTitle).trim();
      const finalAmount = incomeAmount ? Number(incomeAmount) : (parsedNLPreview?.amount || 0);
      if (!finalTitle) {
        setValidationError('Por favor ingresá el concepto del cobro');
        return;
      }
      if (!finalAmount || finalAmount <= 0) {
        setValidationError('Por favor ingresá un monto válido mayor a 0');
        return;
      }

      hapticFeedback.success();
      onAddIncome({
        title: finalTitle,
        amount: finalAmount,
        currency: incomeCurrency || parsedNLPreview?.currency || 'USD',
        date: incomeDate || today,
        month: getMonthKey(incomeDate || today),
        status: incomeStatus,
        projectId: pId,
        projectName: pName,
      });
    } else if (activeType === 'gasto') {
      const finalTitle = (expenseTitle.trim() || fallbackTitle).trim();
      const finalAmount = expenseAmount ? Number(expenseAmount) : (parsedNLPreview?.amount || 0);
      if (!finalTitle) {
        setValidationError('Por favor ingresá el concepto del gasto');
        return;
      }
      if (!finalAmount || finalAmount <= 0) {
        setValidationError('Por favor ingresá un monto de gasto válido');
        return;
      }

      hapticFeedback.success();
      onAddExpense({
        title: finalTitle,
        amount: finalAmount,
        currency: expenseCurrency || parsedNLPreview?.currency || 'ARS',
        category: expenseCategory,
        date: expenseDate || today,
        month: getMonthKey(expenseDate || today),
        status: expenseStatus,
        projectId: pId,
        projectName: pName,
      });
    } else if (activeType === 'objetivo') {
      const finalGoal = (goalTitle.trim() || fallbackTitle).trim();
      if (!finalGoal) {
        setValidationError('Por favor ingresá el objetivo para la semana');
        return;
      }

      hapticFeedback.success();
      onAddWeeklyGoal(finalGoal, goalCategory);
      setGoalTitle('');
    }

    setSmartInputText('');
    setParsedNLPreview(null);
    onClose();
  };

  return (
    <ModalPortal>
      <div 
        className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            hapticFeedback.light();
            onClose();
          }
        }}
      >
        <div 
          className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden t-modal-enter my-auto cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Pinned Header - always visible regardless of scroll */}
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-900/95 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E8590C]" />
            <h3 className="text-base font-bold text-zinc-100">Carga Rápida</h3>
          </div>
        
          <div className="flex items-center gap-2">
            {/* Voice Dictation Button */}
            <button
              type="button"
              onClick={toggleVoiceDictation}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition border active:scale-95 cursor-pointer ${
                isListening
                  ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse'
                  : 'bg-zinc-800 hover:bg-[#E8590C] hover:text-white border-zinc-700 text-zinc-300'
              }`}
              title="Dictar por voz"
            >
              {isListening ? (
                <MicOff className="w-3.5 h-3.5" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-[#E8590C]" />
              )}
              <span>{isListening ? 'Detener' : 'Dictar'}</span>
            </button>

            {/* Reliable Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                hapticFeedback.light();
                onClose();
              }}
              className="p-2 text-zinc-400 hover:text-white transition rounded-xl hover:bg-zinc-800 border border-transparent hover:border-zinc-700 active:scale-95 min-w-[38px] min-h-[38px] flex items-center justify-center cursor-pointer"
              aria-label="Cerrar modal"
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar flex-1">

        {/* SMART NATURAL LANGUAGE INPUT BAR (Entrada Rápida Inteligente) */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-[#E8590C]/15 border border-[#E8590C]/30 text-[#E8590C]">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <label htmlFor="smart-input-field" className="text-xs font-bold text-zinc-200">
                Entrada Inteligente
              </label>
            </div>
            <span className="text-[10px] text-zinc-400 font-medium hidden sm:inline">
              Autocompleta tipo, fecha, hora, monto y cliente
            </span>
          </div>

          <div className="relative">
            <input
              id="smart-input-field"
              type="text"
              value={smartInputText}
              onChange={(e) => handleSmartInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ej: Reunión con Martín mañana a las 16hs cobrar 200 USD"
              className="w-full pl-3.5 pr-8 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#E8590C] focus:ring-1 focus:ring-[#E8590C] transition shadow-inner"
            />
            {smartInputText && (
              <button
                type="button"
                onClick={() => {
                  setSmartInputText('');
                  setParsedNLPreview(null);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                title="Limpiar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Parsed Entities Tag Chips */}
          {parsedNLPreview && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Detectado:</span>
              {parsedNLPreview.type && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8590C]/20 text-[#E8590C] border border-[#E8590C]/40">
                  {parsedNLPreview.type.toUpperCase()}
                </span>
              )}
              {parsedNLPreview.clientName && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  👤 {parsedNLPreview.clientName}
                </span>
              )}
              {parsedNLPreview.date && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  📅 {parsedNLPreview.date}
                </span>
              )}
              {parsedNLPreview.time && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ⏰ {parsedNLPreview.time} hs
                </span>
              )}
              {parsedNLPreview.amount && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  💰 {parsedNLPreview.amount} {parsedNLPreview.currency}
                </span>
              )}
              {parsedNLPreview.clientPhone && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  📞 {parsedNLPreview.clientPhone}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Voice Dictation Status Notification & iOS Guidance */}
        {(speechStatusText || isListening || isProcessingAI) && (
          <div
            className={`p-2.5 rounded-xl text-xs font-medium border transition ${
              isListening
                ? 'bg-red-500/10 border-red-500/30 text-red-300 flex items-center justify-between gap-2'
                : isProcessingAI
                ? 'bg-[#E8590C]/10 border-[#E8590C]/30 text-orange-200 flex items-center gap-2'
                : 'bg-zinc-950 border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="flex items-start gap-2">
              {isListening ? (
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0 mt-1" />
              ) : isProcessingAI ? (
                <Loader2 className="w-4 h-4 text-[#E8590C] animate-spin shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="leading-tight">
                <span className="font-semibold">{speechStatusText}</span>
                {!isListening && !isProcessingAI && isIOSDevice() && (
                  <p className="text-[11px] text-zinc-400 mt-1">
                    💡 <strong className="text-zinc-200">En iPhone PWA:</strong> también podés tocar cualquier campo y presionar el <strong className="text-white">micrófono (🎙️) en la barra de espacio del teclado de tu iPhone</strong> para dictar al instante.
                  </p>
                )}
              </div>
            </div>
            {isListening && (
              <span className="text-[10px] text-zinc-400 shrink-0 hidden sm:inline font-mono">
                Ej: "Reunión con Martín mañana a las 16 hs"
              </span>
            )}
          </div>
        )}

        {/* Personal Movement quick shortcut */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-400">
          <span>¿Movimiento para tus finanzas personales?</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              navigateTo('/mis-finanzas/nuevo');
            }}
            className="text-[#E8590C] hover:text-amber-400 font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Movimiento personal →</span>
          </button>
        </div>

        {/* Type Selector Tabs */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setType('tarea');
            }}
            className={`py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 ${
              type === 'tarea'
                ? 'bg-[#E8590C] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Tarea</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setType('reunion');
            }}
            className={`py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 ${
              type === 'reunion'
                ? 'bg-[#E8590C] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Reunión</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setType('objetivo');
            }}
            className={`py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 ${
              type === 'objetivo'
                ? 'bg-[#E8590C] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Objetivo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setType('proyecto');
            }}
            className={`py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 ${
              type === 'proyecto'
                ? 'bg-[#E8590C] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Proyecto</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setType('ingreso');
            }}
            className={`py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 ${
              type === 'ingreso'
                ? 'bg-[#E8590C] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Cobro</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setType('gasto');
            }}
            className={`py-1.5 rounded-lg font-bold transition flex items-center justify-center gap-1 ${
              type === 'gasto'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Gasto</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          {/* TAREA */}
          {type === 'tarea' && (
            <>
              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                  Título de la tarea *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Armar wireframe de la Home"
                  value={taskTitle}
                  onChange={e => {
                    const val = e.target.value;
                    setTaskTitle(val);
                    // If user hasn't explicitly picked a category yet, suggest one automatically
                    if (taskCategory === 'general') {
                      const inferred = inferTaskCategory(val);
                      if (inferred) setTaskCategory(inferred);
                    }
                  }}
                  className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                />
              </div>

              {/* Categoría / Bloque de Jornada */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1.5 uppercase flex items-center justify-between">
                  <span>Bloque / Categoría de la Jornada</span>
                  <span className="text-[10px] text-zinc-500 font-normal lowercase">organiza y da color</span>
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(Object.keys(TASK_CATEGORIES) as (DailyAllocationBucketId | 'general')[]).map(catId => {
                    const cfg = TASK_CATEGORIES[catId];
                    const IconComp = cfg.icon;
                    const isSelected = taskCategory === catId;
                    return (
                      <button
                        key={catId}
                        type="button"
                        onClick={() => {
                          hapticFeedback.selection();
                          setTaskCategory(catId);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                          isSelected
                            ? `${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder} ring-1 ring-offset-0 ring-current font-bold`
                            : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prioridad */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1.5 uppercase">
                  Prioridad
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['alta', 'media', 'baja'] as TaskPriority[]).map(p => {
                    const pCfg = TASK_PRIORITIES[p];
                    const isSelected = taskPriority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          hapticFeedback.selection();
                          setTaskPriority(p);
                        }}
                        className={`py-1.5 px-2 rounded-xl text-xs font-semibold border text-center transition active:scale-95 ${
                          isSelected
                            ? pCfg.badge + ' ring-1 ring-offset-0 ring-current font-bold'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                        }`}
                      >
                        {pCfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {projects.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Vincular a Proyecto (opcional)
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    className="w-full text-base sm:text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                  >
                    <option value="" className="bg-zinc-900">Sin vincular / General del Estudio</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id} className="bg-zinc-900">
                        📁 {p.clientName} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Vincular a Misión de la semana */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase flex items-center gap-1.5">
                  <Target className="w-3 h-3 text-[#E8590C]" />
                  <span>Vincular a Misión de la Semana (opcional)</span>
                </label>
                <select
                  value={taskMissionId}
                  onChange={e => setTaskMissionId(e.target.value)}
                  className="w-full text-base sm:text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                >
                  <option value="" className="bg-zinc-900">Suelto (Sin misión asignada)</option>
                  {(missions || []).map(m => (
                    <option key={m.id} value={m.id} className="bg-zinc-900">
                      🎯 [{m.frente}] {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Día
                  </label>
                  <input
                    type="date"
                    required
                    value={taskDate}
                    onChange={e => setTaskDate(e.target.value)}
                    className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Hora (opcional)
                  </label>
                  <input
                    type="time"
                    value={taskTime}
                    onChange={e => {
                      setTaskTime(e.target.value);
                      if (e.target.value && !taskReminderActive) {
                        setTaskReminderActive(true);
                      }
                    }}
                    className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                  />
                </div>
              </div>

              {/* Recordatorios y Notificaciones (iPhone / Web) */}
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className={`w-4 h-4 ${taskReminderActive ? 'text-[#E8590C]' : 'text-zinc-500'}`} />
                    <div>
                      <div className="text-xs font-bold text-zinc-200">Recordarme esta tarea</div>
                      <div className="text-[10px] text-zinc-400">Notificación al cumplirse el horario</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      hapticFeedback.light();
                      const next = !taskReminderActive;
                      setTaskReminderActive(next);
                      if (next) {
                        const perm = await requestNotificationPermission();
                        if (perm === 'denied') {
                          // Allow user to use Apple Calendar fallback directly
                          setTaskAddToAppleCalendar(true);
                        }
                      }
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                      taskReminderActive ? 'bg-[#E8590C]' : 'bg-zinc-800'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        taskReminderActive ? 'translate-x-4.5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {taskReminderActive && (
                  <div className="pt-2 border-t border-zinc-800/60 space-y-2 animate-in fade-in duration-150">
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                        ¿Cuándo avisarte?
                      </label>
                      <select
                        value={taskReminderMinutes}
                        onChange={e => setTaskReminderMinutes(Number(e.target.value))}
                        className="w-full text-xs text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-lg p-2 focus:outline-none focus:border-[#E8590C]"
                      >
                        <option value={0}>A la hora exacta</option>
                        <option value={5}>5 minutos antes</option>
                        <option value={15}>15 minutos antes</option>
                        <option value={30}>30 minutos antes</option>
                        <option value={60}>1 hora antes</option>
                        <option value={120}>2 horas antes</option>
                        <option value={1440}>1 día antes (24 hs)</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={taskAddToAppleCalendar}
                        onChange={e => {
                          hapticFeedback.selection();
                          setTaskAddToAppleCalendar(e.target.checked);
                        }}
                        className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-900 text-[#E8590C] focus:ring-0 focus:ring-offset-0"
                      />
                      <span className="text-[11px] text-zinc-300 font-medium flex items-center gap-1.5">
                        <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Sincronizar con Calendario/Recordatorios de iPhone</span>
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Subtareas opcionales */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 block uppercase">
                    Subtareas (opcional)
                  </label>
                  {taskSubtasks.length > 0 && (
                    <span className="text-[10px] text-zinc-500 font-medium">
                      {taskSubtasks.length} {taskSubtasks.length === 1 ? 'subtarea' : 'subtareas'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Escribir subtarea..."
                    value={newSubtaskInput}
                    onChange={e => setNewSubtaskInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newSubtaskInput.trim()) {
                          setTaskSubtasks(prev => [...prev, newSubtaskInput.trim()]);
                          setNewSubtaskInput('');
                        }
                      }
                    }}
                    className="flex-1 text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#E8590C]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newSubtaskInput.trim()) {
                        setTaskSubtasks(prev => [...prev, newSubtaskInput.trim()]);
                        setNewSubtaskInput('');
                      }
                    }}
                    disabled={!newSubtaskInput.trim()}
                    className="px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-[#E8590C] hover:text-white text-zinc-300 text-xs font-semibold transition disabled:opacity-40"
                    title="Agregar subtarea"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {taskSubtasks.length > 0 && (
                  <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                    {taskSubtasks.map((sub, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-300"
                      >
                        <span className="truncate flex-1 text-[11px]">{sub}</span>
                        <button
                          type="button"
                          onClick={() => setTaskSubtasks(prev => prev.filter((_, i) => i !== index))}
                          className="p-0.5 text-zinc-500 hover:text-red-400 transition ml-2"
                          title="Eliminar subtarea"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* REUNION */}
          {type === 'reunion' && (
            <>
              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                  Título / Cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Llamada con Arq. Mateo Cane"
                  value={meetingTitle}
                  onChange={e => setMeetingTitle(e.target.value)}
                  className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                />
              </div>

              {projects.length > 0 && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                      Vincular a Proyecto o Cliente *
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={e => setSelectedProjectId(e.target.value)}
                      className="w-full text-base sm:text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                    >
                      <option value="" className="bg-zinc-900">Sin vincular / General del Estudio</option>
                      <optgroup label="🏛️ Clientes Arquitectos (Método PAF)" className="bg-zinc-900 text-amber-300 font-semibold">
                        {projects.filter(p => p.projectType === 'paf_pro' || p.projectType === 'paf_base' || p.pafStage || p.pafConsultingHoursTotal).map(p => (
                          <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-100">
                            🏛️ {p.clientName} ({p.pafConsultingHoursDone ?? 0}/{p.pafConsultingHoursTotal ?? 26}hs • {p.pafStage || 'En curso'})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="🌐 Proyectos Desarrollo Web" className="bg-zinc-900 text-blue-300 font-semibold">
                        {projects.filter(p => p.projectType === 'web').map(p => (
                          <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-100">
                            🌐 {p.clientName} ({p.status})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="📁 Otros Proyectos" className="bg-zinc-900 text-zinc-400 font-semibold">
                        {projects.filter(p => p.projectType !== 'web' && p.projectType !== 'paf_pro' && p.projectType !== 'paf_base' && !p.pafStage && !p.pafConsultingHoursTotal).map(p => (
                          <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-100">
                            📁 {p.clientName} ({p.status})
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* PAF Automatic Sync Banner & Duration Picker */}
                  {(() => {
                    const selProj = projects.find(p => p.id === selectedProjectId);
                    const isPaf = selProj && (
                      selProj.projectType === 'paf_pro' ||
                      selProj.projectType === 'paf_base' ||
                      selProj.pafStage ||
                      selProj.pafConsultingHoursTotal
                    );
                    if (!isPaf) return null;

                    return (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px]">
                            <span>🏛️ Sesión 1:1 Método PAF</span>
                          </span>
                          <span className="text-[10px] text-amber-400/80 font-mono">
                            Auto-sync: +{meetingDurationHours}h al completar
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-300">Duración de la llamada:</span>
                          <div className="flex items-center gap-1.5">
                            {[1, 1.5, 2].map(dur => (
                              <button
                                key={dur}
                                type="button"
                                onClick={() => setMeetingDurationHours(dur)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
                                  meetingDurationHours === dur
                                    ? 'bg-amber-500 text-black border-amber-400'
                                    : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                                }`}
                              >
                                {dur} hs
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Día
                  </label>
                  <input
                    type="date"
                    required
                    value={meetingDate}
                    onChange={e => setMeetingDate(e.target.value)}
                    className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Hora (opcional)
                  </label>
                  <input
                    type="time"
                    value={meetingTime}
                    onChange={e => {
                      setMeetingTime(e.target.value);
                      if (e.target.value && !meetingReminderActive) {
                        setMeetingReminderActive(true);
                      }
                    }}
                    className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                  />
                </div>
              </div>

              {/* Recordatorios y Notificaciones para la Reunión (iPhone / Web) */}
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className={`w-4 h-4 ${meetingReminderActive ? 'text-amber-400' : 'text-zinc-500'}`} />
                    <div>
                      <div className="text-xs font-bold text-zinc-200">Recordarme esta reunión</div>
                      <div className="text-[10px] text-zinc-400">Aviso puntual o previo a la cita</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      hapticFeedback.light();
                      const next = !meetingReminderActive;
                      setMeetingReminderActive(next);
                      if (next) {
                        const perm = await requestNotificationPermission();
                        if (perm === 'denied') {
                          setMeetingAddToAppleCalendar(true);
                        }
                      }
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                      meetingReminderActive ? 'bg-amber-500' : 'bg-zinc-800'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        meetingReminderActive ? 'translate-x-4.5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {meetingReminderActive && (
                  <div className="pt-2 border-t border-zinc-800/60 space-y-2 animate-in fade-in duration-150">
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-400 block mb-1">
                        ¿Cuándo avisarte?
                      </label>
                      <select
                        value={meetingReminderMinutes}
                        onChange={e => setMeetingReminderMinutes(Number(e.target.value))}
                        className="w-full text-xs text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-lg p-2 focus:outline-none focus:border-[#E8590C]"
                      >
                        <option value={0}>A la hora exacta</option>
                        <option value={5}>5 minutos antes</option>
                        <option value={15}>15 minutos antes</option>
                        <option value={30}>30 minutos antes</option>
                        <option value={60}>1 hora antes</option>
                        <option value={120}>2 horas antes</option>
                        <option value={1440}>1 día antes (24 hs)</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={meetingAddToAppleCalendar}
                        onChange={e => {
                          hapticFeedback.selection();
                          setMeetingAddToAppleCalendar(e.target.checked);
                        }}
                        className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-900 text-[#E8590C] focus:ring-0 focus:ring-offset-0"
                      />
                      <span className="text-[11px] text-zinc-300 font-medium flex items-center gap-1.5">
                        <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Sincronizar con Calendario/Recordatorios de iPhone</span>
                      </span>
                    </label>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                  Teléfono / WhatsApp (opcional)
                </label>
                <input
                  type="tel"
                  placeholder="ej. +54 9 11 2345-6789"
                  value={meetingPhone}
                  onChange={e => setMeetingPhone(e.target.value)}
                  className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                  Notas de la reunión (libre)
                </label>
                <textarea
                  rows={2}
                  placeholder="De qué se habló o qué falta repasar..."
                  value={meetingNotes}
                  onChange={e => setMeetingNotes(e.target.value)}
                  className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C] resize-none"
                />
              </div>
            </>
          )}

          {/* PROYECTO */}
          {type === 'proyecto' && (
            <>
              {/* Selector de Tipo: Activo vs Posible Proyecto */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1.5 uppercase">
                  Tipo de Registro
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.selection();
                      setProjectIsLead(false);
                      if (projectStatus === 'Posible proyecto' || projectStatus === 'Propuesta enviada' || projectStatus === 'En negociación') {
                        setProjectStatus('En curso');
                      }
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      !projectIsLead
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <span>🚀 Proyecto Activo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.selection();
                      setProjectIsLead(true);
                      if (projectStatus === 'En curso') {
                        setProjectStatus('Posible proyecto');
                      }
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      projectIsLead
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <span>💡 Posible Proyecto</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                  Cliente o Proyecto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Estudio Cane Arquitectura"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                />
              </div>

              {/* Selector de Programa / Servicio */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                  Programa / Servicio
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-zinc-950 border border-zinc-800 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.selection();
                      setProjectType('paf_pro');
                      if (!projectEstimatedPrice) setProjectEstimatedPrice(1800);
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold transition text-center truncate ${
                      projectType === 'paf_pro'
                        ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    PAF Pro (12 sem)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.selection();
                      setProjectType('paf_base');
                      if (!projectEstimatedPrice) setProjectEstimatedPrice(950);
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold transition text-center truncate ${
                      projectType === 'paf_base'
                        ? 'bg-blue-500 text-white shadow-sm font-extrabold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    PAF Base
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.selection();
                      setProjectType('web');
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold transition text-center truncate ${
                      projectType === 'web'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Web / Landing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.selection();
                      setProjectType('otro');
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold transition text-center truncate ${
                      projectType === 'otro'
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Otro Proyecto
                  </button>
                </div>
              </div>

              {/* Si es PAF, selector de Etapa inicial */}
              {(projectType === 'paf_pro' || projectType === 'paf_base') && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                    <span>Etapa Inicial del Método PAF:</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200">
                      {projectType === 'paf_pro' ? '26hs Consultoría' : 'Acceso Base'}
                    </span>
                  </div>
                  <select
                    value={projectPafStage}
                    onChange={e => setProjectPafStage(e.target.value as PafStage)}
                    className="w-full text-xs text-zinc-100 bg-zinc-950 border border-amber-500/30 rounded-lg p-2 focus:outline-none focus:border-amber-400"
                  >
                    {PAF_STAGES.map(s => (
                      <option key={s} value={s} className="bg-zinc-900">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Valor de Precio / Presupuesto Cotizado */}
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5 uppercase">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Valor de Precio / Presupuesto {projectIsLead ? '(Estimado)' : ''}</span>
                  </label>
                  <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setProjectEstimatedCurrency('USD')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                        projectEstimatedCurrency === 'USD'
                          ? 'bg-[#E8590C] text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      USD $
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectEstimatedCurrency('ARS')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                        projectEstimatedCurrency === 'ARS'
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
                    {projectEstimatedCurrency === 'USD' ? 'US$' : '$'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="ej. 1500 (monto total presupuestado)"
                    value={projectEstimatedPrice}
                    onChange={e => setProjectEstimatedPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-[#E8590C]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                  Estado
                </label>
                <select
                  value={projectStatus}
                  onChange={e => setProjectStatus(e.target.value)}
                  className="w-full text-base sm:text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                >
                  {DEFAULT_PROJECT_STATUSES.map(st => (
                    <option key={st} value={st} className="bg-zinc-900">
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                  Teléfono / WhatsApp (opcional)
                </label>
                <input
                  type="tel"
                  placeholder="ej. +54 9 11 2345-6789"
                  value={projectPhone}
                  onChange={e => setProjectPhone(e.target.value)}
                  className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                  Notas / Pendientes del proyecto
                </label>
                <textarea
                  rows={2}
                  placeholder="ej. Falta que envíen el logo en SVG y fotos..."
                  value={projectNotes}
                  onChange={e => setProjectNotes(e.target.value)}
                  className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C] resize-none"
                />
              </div>
            </>
          )}

          {/* INGRESO */}
          {type === 'ingreso' && (
            <>
              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                  Proyecto o Concepto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Anticipo Web 50% / Honorarios"
                  value={incomeTitle}
                  onChange={e => setIncomeTitle(e.target.value)}
                  className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                />
              </div>

              {projects.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Vincular a Proyecto (opcional)
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    className="w-full text-base sm:text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                  >
                    <option value="" className="bg-zinc-900">Sin vincular / General del Estudio</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id} className="bg-zinc-900">
                        📁 {p.clientName} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Monto *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="1200"
                    value={incomeAmount}
                    onChange={e => setIncomeAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Moneda
                  </label>
                  <select
                    value={incomeCurrency}
                    onChange={e => setIncomeCurrency(e.target.value as 'USD' | 'ARS')}
                    className="w-full text-base sm:text-xs font-semibold text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                  >
                    <option value="ARS" className="bg-zinc-900">ARS ($ Pesos)</option>
                    <option value="USD" className="bg-zinc-900">USD ($ Dólares)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Fecha
                  </label>
                  <input
                    type="date"
                    required
                    value={incomeDate}
                    onChange={e => setIncomeDate(e.target.value)}
                    className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Estado
                  </label>
                  <select
                    value={incomeStatus}
                    onChange={e => setIncomeStatus(e.target.value as 'cobrado' | 'pendiente')}
                    className="w-full text-base sm:text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                  >
                    <option value="cobrado" className="bg-zinc-900">Cobrado</option>
                    <option value="pendiente" className="bg-zinc-900">Pendiente</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* GASTO */}
          {type === 'gasto' && (
            <>
              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                  Concepto / Proveedor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Hosting, Dominio, Render 3D, Freelancer..."
                  value={expenseTitle}
                  onChange={e => setExpenseTitle(e.target.value)}
                  className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-rose-500"
                />
              </div>

              {projects.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Asignar a Proyecto (para rentabilidad)
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    className="w-full text-base sm:text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-rose-500"
                  >
                    <option value="" className="bg-zinc-900">Gasto General / Estudio</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id} className="bg-zinc-900">
                        📁 {p.clientName} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Monto *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="25000"
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Moneda
                  </label>
                  <select
                    value={expenseCurrency}
                    onChange={e => setExpenseCurrency(e.target.value as 'USD' | 'ARS')}
                    className="w-full text-base sm:text-xs font-semibold text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-rose-500"
                  >
                    <option value="ARS" className="bg-zinc-900">ARS ($ Pesos)</option>
                    <option value="USD" className="bg-zinc-900">USD ($ Dólares)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                  Categoría
                </label>
                <select
                  value={expenseCategory}
                  onChange={e => setExpenseCategory(e.target.value)}
                  className="w-full text-base sm:text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-rose-500"
                >
                  {DEFAULT_EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Fecha
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                    Estado
                  </label>
                  <select
                    value={expenseStatus}
                    onChange={e => setExpenseStatus(e.target.value as 'pagado' | 'pendiente')}
                    className="w-full text-base sm:text-xs text-zinc-200 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-rose-500"
                  >
                    <option value="pagado" className="bg-zinc-900">Pagado</option>
                    <option value="pendiente" className="bg-zinc-900">Pendiente de pago</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* OBJETIVO SEMANAL */}
          {type === 'objetivo' && (
            <>
              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1 uppercase">
                  Objetivo de la Semana *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Cerrar propuesta con Estudio Cane..."
                  value={goalTitle}
                  onChange={e => setGoalTitle(e.target.value)}
                  className="w-full text-base sm:text-xs text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#E8590C]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1.5 uppercase">
                  Área de Enfoque
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'ventas', label: '🎯 Ventas / Pipeline' },
                    { id: 'produccion', label: '🚀 Producción / Entregas' },
                    { id: 'organizacion', label: '📑 Organización / Admin' },
                    { id: 'general', label: '⚡ General' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setGoalCategory(cat.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition ${
                        goalCategory === cat.id
                          ? 'bg-[#E8590C]/15 border-[#E8590C] text-[#E8590C] shadow-sm shadow-[#E8590C]/20'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-400">
                <span className="text-[#E8590C] font-semibold">💡 Tip:</span> Este objetivo se fijará para la semana en curso y aparecerá en el encabezado de tu Agenda para mantenerte enfocado.
              </div>
            </>
          )}

          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#E8590C] hover:bg-[#cf4d07] text-white transition shadow-md shadow-[#E8590C]/20 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Guardar</span>
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  </ModalPortal>
);
};
