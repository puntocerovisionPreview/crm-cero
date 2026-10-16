import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  Trash2, 
  Bot, 
  User, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Target, 
  Briefcase, 
  RotateCcw, 
  Mic, 
  MicOff, 
  ChevronDown,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Cpu
} from 'lucide-react';
import { 
  AgendaTask, 
  AgendaMeeting, 
  Project, 
  IncomeRecord, 
  ExpenseRecord, 
  WeeklyGoal,
  ChatMessage,
  ChatActionExecution,
  GeminiModelId,
  GeminiRolePreset,
  SecondBrainNote,
  PersonalAccount,
  PersonalCategory,
  PersonalTransaction,
  PersonalRecurring
} from '../types';
import { getTodayString, getMonthKey, getWeekMonday } from '../utils/storage';
import { currentWeekdayLocal } from '../utils/dates';
import { hapticFeedback } from '../utils/haptics';
import { playItemCreated, playTaskDone } from '../utils/sound';
import { getAuthHeaders } from '../utils/authAccess';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects: Project[];
  incomes: IncomeRecord[];
  expenses: ExpenseRecord[];
  weeklyGoals?: WeeklyGoal[];
  notes?: SecondBrainNote[];
  onAddTask: (task: Omit<AgendaTask, 'id' | 'createdAt'>) => void;
  onToggleTask?: (id: string) => void;
  onDeleteTask?: (id: string) => void;
  onAddMeeting: (meeting: Omit<AgendaMeeting, 'id' | 'createdAt'>) => void;
  onToggleMeeting?: (id: string) => void;
  onMoveTaskDate?: (id: string, newDate: string) => void;
  onMoveMeetingDate?: (id: string, newDate: string) => void;
  onAddIncome: (income: Omit<IncomeRecord, 'id' | 'createdAt'>) => void;
  onAddExpense: (expense: Omit<ExpenseRecord, 'id' | 'createdAt'>) => void;
  onAddWeeklyGoal?: (title: string, category?: 'ventas' | 'produccion' | 'organizacion' | 'general', weekStart?: string) => void;
  onAddProject?: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onAddNote?: (note: Omit<SecondBrainNote, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onNavigate?: (path: string) => void;
  personalAccounts?: PersonalAccount[];
  personalCategories?: PersonalCategory[];
  personalTransactions?: PersonalTransaction[];
  personalRecurrings?: PersonalRecurring[];
  onAddPersonalTransaction?: (transaction: Omit<PersonalTransaction, 'id' | 'createdAt'>) => void;
  onAddPersonalRecurring?: (recurring: Omit<PersonalRecurring, 'id' | 'createdAt'>) => void;
  theme?: 'dark' | 'light';
  privacyMode?: boolean;
}

const STORAGE_KEY = 'cero_gemini_chat_messages_v2';
const MODEL_STORAGE_KEY = 'cero_gemini_selected_model';
const ROLE_STORAGE_KEY = 'cero_gemini_selected_role';

const INITIAL_MESSAGE: ChatMessage = {
  id: 'msg_welcome',
  role: 'assistant',
  content: `¡Hola! Soy tu **Copiloto Inteligente de .Cero CRM & Agenda** con Gemini.

Tengo control operativo directo sobre tu app para realizar cosas por vos:
• **Crear o marcar tareas** (ej: *"anotame para mañana a las 11:00 llamar a Estudio Norte"*).
• **Agendar reuniones y llamadas** (ej: *"agendá reunión con Martín el jueves a las 16hs"*).
• **Mover o reprogramar fechas** (ej: *"mové la reunión de hoy al viernes"*).
• **Registrar cobros y gastos** (ej: *"anotá cobro de $180,000 cuota 1"*).
• **Definir objetivos semanales** y crear proyectos.
• **Consultar tu día a día** (pendientes, cobros por vencer o estado de tu semana).

¿En qué te ayudo ahora?`,
  timestamp: new Date().toISOString(),
  modelUsed: 'gemini-3.1-flash-lite',
};

const SUGGESTIONS = [
  '📅 ¿Qué tengo pendiente para hoy?',
  '💰 ¿Cuánto dinero tengo pendiente de cobro?',
  '📝 Anotame para mañana a las 10:00 enviar presupuesto',
  '⚡ Agendá reunión con Martín el jueves a las 16:30',
  '🎯 Proponeme 3 objetivos para esta semana',
];

export const GeminiCopilotDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  tasks,
  meetings,
  projects,
  incomes,
  expenses,
  weeklyGoals,
  notes = [],
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onAddMeeting,
  onMoveTaskDate,
  onMoveMeetingDate,
  onAddIncome,
  onAddExpense,
  onAddWeeklyGoal,
  onAddProject,
  onAddNote,
  onNavigate,
  personalAccounts = [],
  personalCategories = [],
  personalTransactions = [],
  personalRecurrings = [],
  onAddPersonalTransaction,
  onAddPersonalRecurring,
  theme,
  privacyMode = false,
}) => {
  // Model selection state
  const [selectedModel, setSelectedModel] = useState<GeminiModelId>(() => {
    try {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY) as GeminiModelId;
      if (saved === 'gemini-3.8-flash') {
        // Migración automática: 3.8 Flash suele tener picos 503 de alta demanda
        localStorage.setItem(MODEL_STORAGE_KEY, 'gemini-3.1-flash-lite');
        return 'gemini-3.1-flash-lite';
      }
      if (
        saved === 'gemini-2.5-flash' ||
        saved === 'gemini-3.1-flash-lite' ||
        saved === 'gemini-3.7-flash' ||
        saved === 'gemini-3.1-pro-preview'
      ) {
        return saved;
      }
    } catch {}
    return 'gemini-3.1-flash-lite';
  });

  // Role preset state
  const [selectedRole, setSelectedRole] = useState<GeminiRolePreset>(() => {
    try {
      const saved = localStorage.getItem(ROLE_STORAGE_KEY) as GeminiRolePreset;
      if (saved === 'operativo' || saved === 'paf' || saved === 'proyectos' || saved === 'finanzas') {
        return saved;
      }
    } catch {}
    return 'operativo';
  });

  // Conversation history
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [INITIAL_MESSAGE];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll to bottom on messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Save conversation in local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Save selected model and role
  useEffect(() => {
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
      localStorage.setItem(ROLE_STORAGE_KEY, selectedRole);
    } catch {}
  }, [selectedModel, selectedRole]);

  // Auto focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 250);
    }
  }, [isOpen]);

  // Speech Recognition setup (Voice Dictation)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'es-AR';

        recognition.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          setInputPrompt(prev => (prev ? `${prev} ${text}` : text));
          setIsRecording(false);
        };

        recognition.onerror = () => {
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Tu navegador no soporta reconocimiento de voz nativo.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        hapticFeedback.medium();
      } catch (err) {
        console.error('Error al iniciar micrófono:', err);
        setIsRecording(false);
      }
    }
  };

  // Clear conversation history
  const handleClearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    hapticFeedback.medium();
  };

  // Real App Action Execution Engine
  const executeFunctionCalls = (functionCalls: Array<{ name: string; args: Record<string, any> }>): ChatActionExecution[] => {
    const executed: ChatActionExecution[] = [];
    const today = getTodayString();

    for (const fc of functionCalls) {
      const { name, args } = fc;
      try {
        if (name === 'crear_tarea') {
          const title = String(args.title || 'Nueva tarea').trim();
          const date = String(args.date || today).trim();
          const priority = args.priority === 'alta' || args.priority === 'media' || args.priority === 'baja' ? args.priority : undefined;
          const time = args.time ? String(args.time).trim() : undefined;
          const notes = args.notes ? String(args.notes).trim() : undefined;
          const clientName = args.clientName ? String(args.clientName).trim() : undefined;

          onAddTask({
            title,
            date,
            time,
            priority,
            category: (args.category as any) || 'general',
            completed: false,
            projectName: clientName,
          });

          executed.push({
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name,
            args,
            description: `Tarea creada: "${title}" para el ${date}${time ? ` a las ${time}hs` : ''}`,
            status: 'executed',
            timestamp: new Date().toISOString(),
          });
        } else if (name === 'completar_tarea') {
          const titleSearch = String(args.titleSearch || '').toLowerCase().trim();
          const completed = args.completed !== false;
          const target = tasks.find(t => t.title.toLowerCase().includes(titleSearch));

          if (target) {
            if (onToggleTask) onToggleTask(target.id);
            executed.push({
              id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              name,
              args,
              description: `Tarea "${target.title}" marcada como ${completed ? 'completada ✓' : 'pendiente'}`,
              status: 'executed',
              timestamp: new Date().toISOString(),
            });
          } else {
            executed.push({
              id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              name,
              args,
              description: `No encontré una tarea con "${args.titleSearch}" para marcar.`,
              status: 'failed',
              timestamp: new Date().toISOString(),
            });
          }
        } else if (name === 'eliminar_tarea') {
          const titleSearch = String(args.titleSearch || '').toLowerCase().trim();
          const target = tasks.find(t => t.title.toLowerCase().includes(titleSearch));

          if (target) {
            if (onDeleteTask) onDeleteTask(target.id);
            executed.push({
              id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              name,
              args,
              description: `Tarea "${target.title}" eliminada de la agenda`,
              status: 'executed',
              timestamp: new Date().toISOString(),
            });
          } else {
            executed.push({
              id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              name,
              args,
              description: `No encontré una tarea con "${args.titleSearch}" para eliminar.`,
              status: 'failed',
              timestamp: new Date().toISOString(),
            });
          }
        } else if (name === 'agendar_reunion') {
          const title = String(args.title || 'Reunión').trim();
          const clientName = args.clientName ? String(args.clientName).trim() : title;
          const date = String(args.date || today).trim();
          const time = args.time ? String(args.time).trim() : undefined;
          const notes = args.notes ? String(args.notes).trim() : undefined;
          const clientPhone = args.clientPhone ? String(args.clientPhone).trim() : undefined;

          onAddMeeting({
            title: clientName,
            date,
            time,
            notes: notes || title,
            clientPhone,
            completed: false,
          });

          executed.push({
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name,
            args,
            description: `Reunión agendada: "${clientName}" para el ${date}${time ? ` a las ${time}hs` : ''}`,
            status: 'executed',
            timestamp: new Date().toISOString(),
          });
        } else if (name === 'mover_fecha') {
          const titleSearch = String(args.titleSearch || '').toLowerCase().trim();
          const newDate = String(args.newDate || today).trim();
          const itemType = args.itemType || 'tarea';

          if (itemType === 'reunion') {
            const meeting = meetings.find(m => m.title.toLowerCase().includes(titleSearch));
            if (meeting) {
              if (onMoveMeetingDate) onMoveMeetingDate(meeting.id, newDate);
              executed.push({
                id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                name,
                args,
                description: `Reunión con "${meeting.title}" movida al ${newDate}`,
                status: 'executed',
                timestamp: new Date().toISOString(),
              });
            }
          } else {
            const task = tasks.find(t => t.title.toLowerCase().includes(titleSearch));
            if (task) {
              if (onMoveTaskDate) onMoveTaskDate(task.id, newDate);
              executed.push({
                id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                name,
                args,
                description: `Tarea "${task.title}" reprogramada al ${newDate}`,
                status: 'executed',
                timestamp: new Date().toISOString(),
              });
            }
          }
        } else if (name === 'registrar_ingreso') {
          const amount = Number(args.amount || 0);
          const title = String(args.concept || args.title || 'Cobro registrado por Gemini').trim();
          const date = String(args.date || today).trim();
          const status = args.status === 'pendiente' ? 'pendiente' : 'cobrado';
          const clientName = args.clientName ? String(args.clientName).trim() : undefined;
          const currency = (args.currency === 'USD' ? 'USD' : 'ARS');

          onAddIncome({
            title,
            amount,
            date,
            month: getMonthKey(date),
            status,
            currency,
            projectName: clientName,
          });

          executed.push({
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name,
            args,
            description: `Ingreso de ${currency} $${amount.toLocaleString('es-AR')} (${status}) registrado: "${title}"`,
            status: 'executed',
            timestamp: new Date().toISOString(),
          });
        } else if (name === 'registrar_gasto') {
          const amount = Number(args.amount || 0);
          const category = String(args.category || 'Software & Herramientas').trim();
          const title = String(args.note || args.title || 'Gasto registrado por Gemini').trim();
          const date = String(args.date || today).trim();
          const currency = (args.currency === 'USD' ? 'USD' : 'ARS');

          onAddExpense({
            title,
            category,
            amount,
            notes: title,
            date,
            month: getMonthKey(date),
            currency,
            status: 'pagado',
          });

          executed.push({
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name,
            args,
            description: `Gasto de ${currency} $${amount.toLocaleString('es-AR')} (${category}) registrado: "${title}"`,
            status: 'executed',
            timestamp: new Date().toISOString(),
          });
        } else if (name === 'crear_objetivo_semanal') {
          const title = String(args.title || 'Objetivo').trim();
          const category = (args.category as any) || 'general';

          if (onAddWeeklyGoal) {
            onAddWeeklyGoal(title, category, today);
          }

          executed.push({
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name,
            args,
            description: `Objetivo semanal agregado: "${title}" (${category})`,
            status: 'executed',
            timestamp: new Date().toISOString(),
          });
        } else if (name === 'crear_proyecto') {
          const clientName = String(args.clientName || args.name || 'Estudio de Arquitectura').trim();
          const ownerName = args.ownerName ? String(args.ownerName).trim() : undefined;
          const projectType = (args.projectType as any) || 'paf_pro';
          const estimatedPrice = Number(args.totalAmount || args.estimatedPrice || 0);

          if (onAddProject) {
            onAddProject({
              clientName,
              ownerName,
              projectType,
              status: 'Posible proyecto',
              notes: `Registrado por Copiloto Gemini el ${today}`,
              estimatedPrice: estimatedPrice || undefined,
              estimatedCurrency: 'ARS',
              archived: false,
            });
          }

          executed.push({
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name,
            args,
            description: `Proyecto / Cliente creado: "${clientName}"`,
            status: 'executed',
            timestamp: new Date().toISOString(),
          });
        } else if (name === 'crear_nota_enlazada') {
          const title = String(args.title || 'Nota').trim();
          let content = String(args.content || '').trim();
          const linkedEntities = Array.isArray(args.linkedEntities) ? args.linkedEntities : [];
          const tags = Array.isArray(args.tags) ? args.tags : [];
          const folder = args.folder ? String(args.folder).trim() : undefined;

          // Append linkedEntities as [[Entity]] if not already inside content
          linkedEntities.forEach((ent: string) => {
            const tag = `[[${ent}]]`;
            if (!content.includes(tag)) {
              content += `\n- ${tag}`;
            }
          });

          if (onAddNote) {
            onAddNote({
              title,
              content,
              date: today,
              tags,
              folder,
              pinned: false,
              linkedEntityTitles: linkedEntities,
            });
          }

          executed.push({
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name,
            args,
            description: `Nota creada: "${title}" ${linkedEntities.length > 0 ? `(conectada con ${linkedEntities.map(e => `[[${e}]]`).join(', ')})` : ''}`,
            status: 'executed',
            timestamp: new Date().toISOString(),
          });
        } else if (name === 'buscar_relaciones') {
          const q = String(args.query || '').toLowerCase().trim();
          const matchedNotes = notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
          const matchedProjects = projects.filter(p => p.clientName.toLowerCase().includes(q) || (p.notes && p.notes.toLowerCase().includes(q)));
          const matchedTasks = tasks.filter(t => t.title.toLowerCase().includes(q));

          const total = matchedNotes.length + matchedProjects.length + matchedTasks.length;
          executed.push({
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name,
            args,
            description: `Red de Conocimiento: ${total} elementos conectados a "${args.query}" (${matchedNotes.length} notas, ${matchedProjects.length} proyectos, ${matchedTasks.length} tareas)`,
            status: 'executed',
            timestamp: new Date().toISOString(),
          });
        } else if (name === 'registrar_movimiento_personal') {
          const type = (args.type as any) || 'gasto';
          const amount = Number(args.amount || 0);
          const currency = (args.currency === 'USD' ? 'USD' : 'ARS');
          const date = String(args.date || today).trim();
          const note = String(args.note || '').trim();

          // Resolve Account
          const targetAccName = String(args.account || '').toLowerCase();
          const matchedAcc = personalAccounts.find(a => 
            a.name.toLowerCase().includes(targetAccName) || 
            ((targetAccName.includes('mp') || targetAccName.includes('mercado pago')) && a.name.toLowerCase().includes('mercado pago')) ||
            (targetAccName.includes('efectivo') && a.name.toLowerCase().includes('efectivo')) ||
            ((targetAccName.includes('dolar') || targetAccName.includes('dólar')) && a.currency === 'USD')
          ) || personalAccounts[0];

          // Resolve Category
          const targetCatName = String(args.category || '').toLowerCase();
          const matchedCat = personalCategories.find(c => 
            c.name.toLowerCase().includes(targetCatName) || c.type === type
          ) || personalCategories[0];

          if (onAddPersonalTransaction) {
            onAddPersonalTransaction({
              type,
              amount,
              currency,
              date,
              accountId: matchedAcc?.id || 'acc_default',
              categoryId: matchedCat?.id || 'cat_default',
              note: note || undefined,
              status: 'confirmado',
            });
          }

          executed.push({
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name,
            args,
            description: `Movimiento personal (${type.toUpperCase()}): ${currency === 'USD' ? 'US$' : '$'} ${amount.toLocaleString('es-AR')} en ${matchedAcc?.name || 'Cuenta'} - ${note || matchedCat?.name || 'General'}`,
            status: 'executed',
            timestamp: new Date().toISOString(),
          });
        } else if (name === 'consultar_gasto_periodo') {
          const period = String(args.period || 'este mes').toLowerCase();
          const currMonth = today.slice(0, 7);
          const monthExpenses = personalTransactions.filter(t => t.date.startsWith(currMonth) && t.type === 'gasto' && t.status === 'confirmado');
          const sumARS = monthExpenses.filter(t => t.currency === 'ARS').reduce((acc, t) => acc + t.amount, 0);
          const sumUSD = monthExpenses.filter(t => t.currency === 'USD').reduce((acc, t) => acc + t.amount, 0);

          executed.push({
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name,
            args,
            description: `Gastos personales (${period}): $ ${sumARS.toLocaleString('es-AR')} ARS${sumUSD > 0 ? ` y US$ ${sumUSD.toLocaleString('es-AR')}` : ''} (${monthExpenses.length} movimientos)`,
            status: 'executed',
            timestamp: new Date().toISOString(),
          });
        } else if (name === 'crear_recurrente') {
          const title = String(args.title || 'Suscripción').trim();
          const amount = Number(args.amount || 0);
          const currency = (args.currency === 'USD' ? 'USD' : 'ARS');
          const frequency = (args.frequency as any) || 'mensual';
          const type = (args.type as any) || 'gasto';

          const matchedAcc = personalAccounts[0];
          const matchedCat = personalCategories.find(c => c.type === 'gasto') || personalCategories[0];

          if (onAddPersonalRecurring) {
            onAddPersonalRecurring({
              title,
              amount,
              currency,
              frequency,
              type,
              accountId: matchedAcc?.id || 'acc_default',
              categoryId: matchedCat?.id || 'cat_default',
              nextDate: today,
              active: true,
            });
          }

          executed.push({
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name,
            args,
            description: `Recurrente creado: "${title}" (${currency === 'USD' ? 'US$' : '$'} ${amount} ${frequency})`,
            status: 'executed',
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.error(`Error ejecutando acción ${name}:`, err);
        executed.push({
          id: `act_${Date.now()}_err`,
          name,
          args,
          description: `Error al procesar ${name}: ${err?.message}`,
          status: 'failed',
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (executed.length > 0) {
      playItemCreated();
      hapticFeedback.success();
    }

    return executed;
  };

  // Send message to Gemini API
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputPrompt).trim();
    if (!query || isLoading) return;

    setInputPrompt('');
    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setIsLoading(true);
    hapticFeedback.light();

    try {
      const today = getTodayString();
      const todayPendingTasks = tasks.filter(t => t.date === today && !t.completed);
      const todayMeetings = meetings.filter(m => m.date === today && !m.completed);
      const pendingIncomes = incomes.filter(i => i.status === 'pendiente');
      const pendingIncomeSum = pendingIncomes.reduce((acc, i) => acc + (i.amount || 0), 0);

      // Context payload for Gemini reasoning and accurate answers
      const contextPayload = {
        today,
        weekday: currentWeekdayLocal(),
        totalTasksCount: tasks.length,
        todayPendingTasksCount: todayPendingTasks.length,
        todayPendingTasks: todayPendingTasks.slice(0, 10).map(t => ({
          id: t.id,
          title: t.title,
          time: t.time || null,
          priority: t.priority || 'media',
          project: t.projectName || null,
        })),
        todayMeetingsCount: todayMeetings.length,
        todayMeetings: todayMeetings.map(m => ({
          id: m.id,
          title: m.title,
          time: m.time || null,
          notes: m.notes || null,
        })),
        upcomingMeetingsNext7Days: meetings.filter(m => m.date > today).slice(0, 5).map(m => ({
          title: m.title,
          date: m.date,
          time: m.time,
        })),
        recentProjects: projects.filter(p => !p.archived).slice(0, 8).map(p => ({
          id: p.id,
          client: p.clientName,
          status: p.status,
          type: p.projectType,
        })),
        pendingIncomesTotal: pendingIncomeSum,
        pendingIncomesCount: pendingIncomes.length,
        pendingIncomesList: pendingIncomes.slice(0, 5).map(i => ({
          title: i.title,
          amount: i.amount,
          currency: i.currency,
          date: i.date,
          project: i.projectName,
        })),
        weeklyGoals: (weeklyGoals || []).filter(g => !g.completed).map(g => ({
          title: g.title,
          category: g.category,
        })),
        recentNotes: notes.slice(0, 8).map(n => ({
          title: n.title,
          date: n.date,
          tags: n.tags,
          folder: n.folder,
        })),
        personalFinanceSummary: {
          accounts: personalAccounts.map(a => `${a.name} (${a.currency})`),
          categories: personalCategories.map(c => `${c.name} (${c.type})`),
          recentTransactions: personalTransactions.slice(0, 8).map(t => ({
            date: t.date,
            type: t.type,
            amount: t.amount,
            currency: t.currency,
            note: t.note,
          })),
        },
      };

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({
          messages: newHistory.map(m => ({
            role: m.role,
            text: m.content,
          })),
          model: selectedModel,
          rolePreset: selectedRole,
          context: contextPayload,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error en la respuesta de Gemini');
      }

      const data = await res.json();
      const replyText = data.reply || '';
      const rawFunctionCalls = data.functionCalls || [];

      // Execute actions directly in the CRM live state
      let executedActions: ChatActionExecution[] = [];
      if (rawFunctionCalls.length > 0) {
        executedActions = executeFunctionCalls(rawFunctionCalls);
      }

      const assistantMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        role: 'assistant',
        content: replyText || (executedActions.length > 0 ? 'He ejecutado las acciones solicitadas en la app:' : 'Entendido.'),
        timestamp: new Date().toISOString(),
        modelUsed: data.model || selectedModel,
        actionsExecuted: executedActions.length > 0 ? executedActions : undefined,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Error al enviar mensaje a Gemini:', err);
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ No pude procesar tu solicitud: ${err.message || 'Error de conexión'}. Podés probar nuevamente o seleccionar "3.1 Lite" o "2.5 Flash" en la configuración superior del copiloto.`,
        timestamp: new Date().toISOString(),
        modelUsed: selectedModel,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Render markdown text (bold, bullet points, numbered lists, line breaks)
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Bullet points
      const isBullet = line.trim().startsWith('•') || line.trim().startsWith('- ') || line.trim().startsWith('* ');
      const cleanLine = isBullet ? line.replace(/^[\s•\-\*]+/, '') : line;

      // Bold formatting
      const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);

      const content = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-bold text-zinc-100 dark:text-white">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <div key={idx} className="flex items-start gap-2 my-1 text-xs sm:text-sm">
            <span className="text-[var(--accent)] font-bold text-xs mt-0.5">•</span>
            <div className="flex-1 leading-relaxed text-zinc-300 dark:text-zinc-200">{content}</div>
          </div>
        );
      }

      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="text-xs sm:text-sm leading-relaxed text-zinc-300 dark:text-zinc-200">
          {content}
        </p>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full max-w-full sm:max-w-[460px] md:max-w-[500px] h-full flex flex-col bg-zinc-950 border-l border-zinc-800 shadow-2xl text-zinc-100 animate-in slide-in-from-right duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[var(--accent)] to-amber-500 flex items-center justify-center text-white shadow-sm shadow-[var(--accent)]/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                  Copiloto Gemini
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30">
                  Acción Activa
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {selectedRole === 'operativo' ? 'Copiloto Operativo Integral' : 
                 selectedRole === 'paf' ? 'Asesor PAF & Ventas' :
                 selectedRole === 'proyectos' ? 'Director de Proyectos' : 'Analista de Finanzas'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSettings(prev => !prev)}
              className={`p-2 rounded-xl text-xs transition cursor-pointer border ${
                showSettings 
                  ? 'bg-zinc-800 text-zinc-100 border-zinc-700' 
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
              }`}
              title="Ajustes de Modelo y Rol"
            >
              <Cpu className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleClearChat}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 border border-zinc-800 transition cursor-pointer"
              title="Reiniciar chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition cursor-pointer"
              title="Cerrar (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Settings Panel (Model & Role selector) */}
        {showSettings && (
          <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 space-y-3 shrink-0 animate-in slide-in-from-top-2 duration-150 text-xs">
            {/* Model Selector */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-[var(--accent)]" />
                Modelo Gemini
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
                  className={`px-1.5 py-1.5 rounded-lg font-medium text-center transition cursor-pointer border ${
                    selectedModel === 'gemini-3.1-flash-lite'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                      : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 border-zinc-800'
                  }`}
                >
                  <div className="font-bold text-[11px]">3.1 Lite</div>
                  <div className="text-[9px] opacity-80">Recomendado</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini-2.5-flash')}
                  className={`px-1.5 py-1.5 rounded-lg font-medium text-center transition cursor-pointer border ${
                    selectedModel === 'gemini-2.5-flash'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                      : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 border-zinc-800'
                  }`}
                >
                  <div className="font-bold text-[11px]">2.5 Flash</div>
                  <div className="text-[9px] opacity-80">Alta vel.</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini-3.7-flash')}
                  className={`px-1.5 py-1.5 rounded-lg font-medium text-center transition cursor-pointer border ${
                    selectedModel === 'gemini-3.7-flash'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                      : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 border-zinc-800'
                  }`}
                >
                  <div className="font-bold text-[11px]">3.7 Flash</div>
                  <div className="text-[9px] opacity-80">Equilibrado</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini-3.8-flash')}
                  className={`px-1.5 py-1.5 rounded-lg font-medium text-center transition cursor-pointer border ${
                    selectedModel === 'gemini-3.8-flash'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                      : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 border-zinc-800'
                  }`}
                >
                  <div className="font-bold text-[11px]">3.8 Flash</div>
                  <div className="text-[9px] opacity-80">Preview</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
                  className={`px-1.5 py-1.5 rounded-lg font-medium text-center transition cursor-pointer border ${
                    selectedModel === 'gemini-3.1-pro-preview'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                      : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 border-zinc-800'
                  }`}
                >
                  <div className="font-bold text-[11px]">3.1 Pro</div>
                  <div className="text-[9px] opacity-80">Raciocinio</div>
                </button>
              </div>
            </div>

            {/* Role Preset Selector */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-[var(--accent)]" />
                Rol y Especialidad del Asistente
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedRole('operativo')}
                  className={`px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer border ${
                    selectedRole === 'operativo'
                      ? 'bg-zinc-800 text-white border-[var(--accent)]'
                      : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                  }`}
                >
                  <div className="font-bold text-[11px] text-zinc-200">🎯 Operativo Integral</div>
                  <div className="text-[10px] text-zinc-400">Agenda, tareas y cobros</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole('paf')}
                  className={`px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer border ${
                    selectedRole === 'paf'
                      ? 'bg-zinc-800 text-white border-[var(--accent)]'
                      : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                  }`}
                >
                  <div className="font-bold text-[11px] text-zinc-200">💼 Asesor PAF & Ventas</div>
                  <div className="text-[10px] text-zinc-400">Objeciones y honorarios</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole('proyectos')}
                  className={`px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer border ${
                    selectedRole === 'proyectos'
                      ? 'bg-zinc-800 text-white border-[var(--accent)]'
                      : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                  }`}
                >
                  <div className="font-bold text-[11px] text-zinc-200">📊 Proyectos & Plazos</div>
                  <div className="text-[10px] text-zinc-400">Hitos y entregas</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole('finanzas')}
                  className={`px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer border ${
                    selectedRole === 'finanzas'
                      ? 'bg-zinc-800 text-white border-[var(--accent)]'
                      : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border-zinc-800'
                  }`}
                >
                  <div className="font-bold text-[11px] text-zinc-200">💰 Finanzas & Caja</div>
                  <div className="text-[10px] text-zinc-400">Cashflow y cobranzas</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div 
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                    isUser 
                      ? 'bg-zinc-800 text-zinc-200 border border-zinc-700' 
                      : 'bg-gradient-to-tr from-[var(--accent)] to-amber-500 text-white shadow-xs'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                </div>

                {/* Message Bubble */}
                <div 
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm space-y-2.5 shadow-sm ${
                    isUser
                      ? 'bg-[var(--accent)] text-white rounded-tr-none'
                      : 'bg-zinc-900 border border-zinc-800/90 text-zinc-200 rounded-tl-none'
                  }`}
                >
                  {/* Content text */}
                  <div className="space-y-1">
                    {renderFormattedText(msg.content)}
                  </div>

                  {/* Executed Action Cards in the CRM */}
                  {msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                    <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Acción ejecutada en la app
                      </div>
                      {msg.actionsExecuted.map((act) => (
                        <div
                          key={act.id}
                          className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 transition ${
                            act.status === 'executed'
                              ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                              : 'bg-red-950/30 border-red-800/50 text-red-200'
                          }`}
                        >
                          <div className="mt-0.5">
                            {act.name === 'crear_tarea' || act.name === 'completar_tarea' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : act.name === 'agendar_reunion' ? (
                              <Calendar className="w-3.5 h-3.5 text-amber-400" />
                            ) : act.name === 'registrar_ingreso' || act.name === 'registrar_gasto' ? (
                              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                            ) : act.name === 'crear_objetivo_semanal' ? (
                              <Target className="w-3.5 h-3.5 text-sky-400" />
                            ) : (
                              <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[11px] leading-tight text-zinc-100">
                              {act.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Metadata footer */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 opacity-75">
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.modelUsed && !isUser && (
                      <span className="font-mono text-[9px] bg-zinc-950/60 px-1.5 py-0.2 rounded border border-zinc-800">
                        {msg.modelUsed}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading bubble */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[var(--accent)] to-amber-500 text-white flex items-center justify-center shrink-0 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-none p-3.5 text-xs text-zinc-300 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-300 animate-bounce [animation-delay:0.4s]" />
                </div>
                <span className="text-zinc-400 text-xs">Pensando y verificando acciones...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 border-t border-zinc-800/60 bg-zinc-900/40 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
          {SUGGESTIONS.map((sug, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSendMessage(sug)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[11px] font-medium whitespace-nowrap shrink-0 border border-zinc-800/80 transition cursor-pointer disabled:opacity-50"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Input Textarea & Action Bar */}
        <div className="p-3.5 border-t border-zinc-800 bg-zinc-900/90 shrink-0 space-y-2">
          <div className="relative flex items-end gap-2 bg-zinc-950 rounded-2xl border border-zinc-800 focus-within:border-[var(--accent)] p-2 transition">
            <textarea
              ref={textareaRef}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Pedile a Gemini que anote una tarea, agende una reunión o te asesore..."
              rows={1}
              className="flex-1 bg-transparent text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 resize-none max-h-32 focus:outline-none py-1.5 px-1 leading-relaxed custom-scrollbar"
            />

            <div className="flex items-center gap-1 shrink-0 pb-0.5">
              {/* Mic Dictation Button */}
              <button
                type="button"
                onClick={toggleRecording}
                className={`p-2 rounded-xl transition cursor-pointer ${
                  isRecording 
                    ? 'bg-red-600 text-white animate-pulse' 
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
                title={isRecording ? 'Detener dictado' : 'Dictar por voz'}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputPrompt.trim()}
                className="p-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] disabled:opacity-40 disabled:hover:bg-[var(--accent)] text-white transition cursor-pointer shadow-xs"
                title="Enviar (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1">
            <span>Shift+Enter para salto de línea · Enter para enviar</span>
            <span className="flex items-center gap-1 text-[var(--accent)]">
              <Sparkles className="w-3 h-3" />
              Gemini AI con ejecución directa
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
