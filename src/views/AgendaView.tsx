import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AgendaTask, AgendaMeeting, WeeklyGoal, WeeklyMission, IncomeRecord, Project, Payment, StudioPaymentSettings, PersonalAccount } from '../types';
import { FRENTE_CONFIG, calculateMissionProgress } from '../utils/missions';
import {
  Calendar,
  CalendarDays,
  Clock,
  CheckCircle2,
  Circle,
  ArrowRight,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  CheckSquare,
  ListTodo,
  Info,
  X,
  MessageCircle,
  Phone,
  FolderKanban,
  Bell,
  CalendarCheck,
  LayoutGrid,
  Columns,
  List,
  Filter,
  Sparkles,
  Target,
  Mic,
  FastForward,
  MoveRight,
  GripVertical,
  ArrowUpDown
} from 'lucide-react';
import { getTaskCategoryConfig, TASK_PRIORITIES } from '../utils/taskCategories';
import {
  getTodayString,
  addDays,
  formatDayName,
  formatShortDay,
  getWeekMonday
} from '../utils/storage';
import { TodayFocusBanner } from '../components/TodayFocusBanner';
import { DailyRoutineCard } from '../components/DailyRoutineCard';
import { ProspectingTodayCard } from '../components/ProspectingTodayCard';
import { WeeklyGoalsWidget } from '../components/WeeklyGoalsWidget';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { MorningBriefingCard } from '../components/MorningBriefingCard';
import { PostMeetingCheckoutModal } from '../components/PostMeetingCheckoutModal';
import { TodayCollectionsBanner } from '../components/TodayCollectionsBanner';
import { AgendaBillingWidget } from '../components/AgendaBillingWidget';
import { RegisterPaymentModal } from '../components/RegisterPaymentModal';
import { DailyTimeBudgetWidget } from '../components/DailyTimeBudgetWidget';
import { WeeklyCloseModal } from '../components/WeeklyCloseModal';
import { KanbanBoard } from '../components/KanbanBoard';
import { EisenhowerMatrix } from '../components/EisenhowerMatrix';
import { payInstallmentTransaction } from '../utils/firestoreService';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { fireTaskCelebration, fireGrandCelebration } from '../utils/confetti';
import { formatWhatsAppUrl, formatTelUrl, extractPhoneFromText } from '../utils/contact';
import { generateCalendarICS } from '../utils/calendarIcs';
import { resolveTaskProject } from '../utils/taskProject';
import { ModalPortal } from '../components/ModalPortal';
import { TaskSortControl } from '../components/TaskSortControl';
import { TaskSortMode, getStoredTaskSortMode, sortTasks, storeTaskSortMode } from '../utils/taskSort';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects?: Project[];
  incomes?: IncomeRecord[];
  weeklyGoals?: WeeklyGoal[];
  weeklyMissions?: WeeklyMission[];
  privacyMode?: boolean;
  onAddTask?: (task: Omit<AgendaTask, 'id'>) => void;
  onToggleTask: (taskId: string) => void;
  onToggleMeeting: (meetingId: string) => void;
  onMoveTaskDate: (taskId: string, targetDate: string) => void;
  onMoveMeetingDate: (meetingId: string, targetDate: string) => void;
  onDeleteTask: (taskId: string) => void;
  onDeleteMeeting: (meetingId: string) => void;
  onDeleteProject?: (id: string) => void;
  onUpdateProject?: (id: string, updates: Partial<Project>) => void;
  onAddIncome?: (income: Omit<IncomeRecord, 'id'>) => void;
  onUpdateTask?: (taskId: string, updates: Partial<AgendaTask>) => void;
  onReorderTasks?: (date: string, reorderedTasks: AgendaTask[]) => void;
  onUpdateMeeting?: (meetingId: string, updates: Partial<AgendaMeeting>) => void;
  onOpenQuickAdd: (type: 'tarea' | 'reunion' | 'ingreso' | 'gasto' | 'objetivo' | 'proyecto', defaultDate?: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onAddSubtask?: (taskId: string, title: string) => void;
  onDeleteSubtask?: (taskId: string, subtaskId: string) => void;
  onAddWeeklyGoal?: (title: string, category?: 'ventas' | 'produccion' | 'organizacion' | 'general', weekStart?: string) => void;
  onToggleWeeklyGoal?: (id: string) => void;
  onUpdateWeeklyGoal?: (id: string, updates: Partial<WeeklyGoal>) => void;
  onDeleteWeeklyGoal?: (id: string) => void;
  onOpenItemDetail?: (id: string, type: 'tarea' | 'reunion') => void;
  onNavigateToCalendar?: () => void;
  onNavigate?: (path: string) => void;
  studioSettings?: StudioPaymentSettings;
  personalAccounts?: PersonalAccount[];
  usdRate?: number;
  onSavePayment?: (projectId: string, payment: Payment, options?: any) => void;
  onDeletePayment?: (projectId: string, paymentId: string) => void;
}

// Utility to reorder tasks in an array by dragging
function reorderTasksList(
  list: AgendaTask[],
  draggedId: string,
  targetId: string,
  position: 'before' | 'after'
): AgendaTask[] {
  const dragged = list.find(t => t.id === draggedId);
  if (!dragged || draggedId === targetId) return list;
  const withoutDragged = list.filter(t => t.id !== draggedId);
  const targetIdx = withoutDragged.findIndex(t => t.id === targetId);
  if (targetIdx === -1) return list;
  const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
  const next = [...withoutDragged];
  next.splice(insertIdx, 0, dragged);
  return next;
}

export const AgendaView: React.FC<Props> = ({
  tasks: rawTasks,
  meetings,
  projects = [],
  incomes = [],
  weeklyGoals = [],
  weeklyMissions = [],
  privacyMode = false,
  onAddTask,
  onToggleTask,
  onToggleMeeting,
  onMoveTaskDate,
  onMoveMeetingDate,
  onDeleteTask,
  onDeleteMeeting,
  onDeleteProject,
  onUpdateProject,
  onAddIncome,
  onUpdateTask,
  onReorderTasks: onReorderTasksProp,
  onUpdateMeeting,
  onOpenQuickAdd,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  onAddWeeklyGoal,
  onToggleWeeklyGoal,
  onUpdateWeeklyGoal,
  onDeleteWeeklyGoal,
  onOpenItemDetail,
  onNavigateToCalendar,
  onNavigate,
  studioSettings,
  personalAccounts = [],
  usdRate,
  onSavePayment,
  onDeletePayment,
}) => {
  // Quick Register Payment Modal State for Agenda Billing Widget
  const [selectedProjectForPayment, setSelectedProjectForPayment] = useState<Project | null>(null);
  const [showRegisterPaymentModal, setShowRegisterPaymentModal] = useState(false);

  const handleSavePaymentForAgenda = (payment: Payment, options?: any) => {
    if (!selectedProjectForPayment) return;
    if (onSavePayment) {
      onSavePayment(selectedProjectForPayment.id, payment, options);
    } else {
      const cur = selectedProjectForPayment.payments || [];
      onUpdateProject?.(selectedProjectForPayment.id, { payments: [payment, ...cur] });
    }
    setShowRegisterPaymentModal(false);
    setSelectedProjectForPayment(null);
  };
  // Orden de tareas elegido (se recuerda en este dispositivo). Se aplica una sola vez
  // acá, así todas las vistas (día, semana, listas, Kanban, encabezado de Hoy) lo respetan.
  const [taskSortMode, setTaskSortModeState] = useState<TaskSortMode>(() => getStoredTaskSortMode());
  const setTaskSortMode = (mode: TaskSortMode) => {
    setTaskSortModeState(mode);
    storeTaskSortMode(mode);
  };
  const tasks = useMemo(() => sortTasks(rawTasks, taskSortMode), [rawTasks, taskSortMode]);

  // ---- Arrastrar y soltar (dnd-kit): mouse, táctil (mantener apretado) y teclado ----
  // Mouse: arrastra al moverse 6 px (un clic sigue abriendo la tarea).
  // Celular: hay que mantener apretado 220 ms; así no compite con el scroll ni con el deslizamiento.
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const [activeDrag, setActiveDrag] = useState<{ type: 'tarea' | 'reunion'; title: string; keyboard: boolean } | null>(null);

  // La agenda tiene montadas a la vez la vista de celular y la de computadora (una oculta por CSS).
  // Solo la visible acepta arrastres; si no, la oculta (tamaño cero) "tapaba" las zonas reales.
  const [dndScope, setDndScope] = useState<'mobile' | 'desktop'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches ? 'desktop' : 'mobile'
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setDndScope(mq.matches ? 'desktop' : 'mobile');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Se suelta donde está el puntero o el dedo (una tarea si hay, si no el día).
  // Si quedó entre columnas, el lugar más cercano.
  const agendaCollision: CollisionDetection = (args) => {
    const under = pointerWithin(args);
    if (under.length > 0) {
      const task = under.find(c => (c.data?.droppableContainer?.data?.current as any)?.type === 'tarea');
      return task ? [task] : under;
    }
    return closestCorners(args);
  };

  const handleDndStart = (event: DragStartEvent) => {
    const data = event.active.data.current as any;
    // Con teclado se mueve la tarjeta real (sin "fantasma"): así la posición que se calcula es exacta
    if (data) setActiveDrag({ type: data.type, title: data.title, keyboard: event.activatorEvent instanceof KeyboardEvent });
    hapticFeedback.selection();
  };

  const handleDndEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const a = active.data.current as any;
    const o = over.data.current as any;
    if (!a || !o?.date) return;
    const targetDate: string = o.date;

    if (a.type === 'reunion') {
      if (a.date !== targetDate) {
        onMoveMeetingDate(a.id, targetDate);
        hapticFeedback.medium();
      }
      return;
    }

    if (a.date !== targetDate) {
      onMoveTaskDate(a.id, targetDate);
      hapticFeedback.medium();
      return;
    }

    // Mismo día: reordenar
    const dayTasks = tasks.filter(t => t.date === targetDate);
    const from = dayTasks.findIndex(t => t.id === a.id);
    const to = o.type === 'tarea' ? dayTasks.findIndex(t => t.id === o.id) : dayTasks.length - 1;
    if (from < 0 || to < 0 || from === to) return;
    onReorderTasks?.(targetDate, arrayMove(dayTasks, from, to));
    hapticFeedback.medium();
  };

  // Lo que anuncia un lector de pantalla al mover con teclado
  const dndAccessibility = {
    screenReaderInstructions: {
      draggable: 'Para mover, presioná espacio o Enter. Usá las flechas para cambiar de lugar y espacio otra vez para soltar. Escape cancela.',
    },
    announcements: {
      onDragStart: ({ active }: any) => `Tomaste ${active.data.current?.title || 'el elemento'}.`,
      onDragOver: ({ over }: any) => (over ? `Sobre ${over.data.current?.label || 'otra posición'}.` : 'Fuera de la agenda.'),
      onDragEnd: ({ over }: any) => (over ? `Soltado en ${over.data.current?.label || 'la nueva posición'}.` : 'Movimiento cancelado.'),
      onDragCancel: () => 'Movimiento cancelado.',
    },
  };
  // Arrastrar para reordenar implica orden propio: pasa a "Manual" para que se vea el cambio
  const onReorderTasks = onReorderTasksProp
    ? (date: string, reordered: AgendaTask[]) => {
        if (taskSortMode !== 'manual') setTaskSortMode('manual');
        onReorderTasksProp(date, reordered);
      }
    : undefined;

  const [startDateStr, setStartDateStr] = useState<string>(getTodayString());
  const [activeMobileDayIndex, setActiveMobileDayIndex] = useState<number>(0);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [desktopViewMode, setDesktopViewMode] = useState<'dia' | 'semana' | 'enfoque' | 'lista' | 'kanban' | 'eisenhower'>('dia');
  const [desktopFilter, setDesktopFilter] = useState<'todos' | 'pendientes' | 'reuniones' | 'tareas'>('todos');
  const [agendaTab, setAgendaTab] = useState<'dia' | 'calendario' | 'objetivos'>('calendario');
  const [mobileTab, setMobileTab] = useState<'dia' | 'semana' | 'kanban' | 'eisenhower' | 'objetivos'>('dia');
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<{
    type: 'tarea' | 'reunion';
    data: AgendaTask | AgendaMeeting;
  } | null>(null);
  const [checkoutMeeting, setCheckoutMeeting] = useState<AgendaMeeting | null>(null);
  const [showWeeklyCloseModal, setShowWeeklyCloseModal] = useState(false);

  // Drag-and-drop state for List View
  const [listDraggedTaskId, setListDraggedTaskId] = useState<string | null>(null);
  const [listDragOverTaskId, setListDragOverTaskId] = useState<string | null>(null);
  const [listDropPosition, setListDropPosition] = useState<'before' | 'after' | null>(null);

  const handleMarkInstallmentPaid = async (projectId: string, installmentId: string) => {
    try {
      const proj = projects.find(p => p.id === projectId);
      const cleanInstId = installmentId || `inst_${Date.now()}`;
      const today = getTodayString();

      // Optimistic update for instant UI feedback (eliminates freezing)
      if (proj && onUpdateProject) {
        const updatedInstallments = (proj.installments || []).map(i => {
          if (i.id === cleanInstId || (!i.id && cleanInstId.includes(String(i.number)))) {
            return { ...i, id: cleanInstId, paid: true, paidAt: today };
          }
          return i;
        });
        onUpdateProject(projectId, { installments: updatedInstallments });
      }

      await payInstallmentTransaction(projectId, cleanInstId, undefined, proj);
    } catch (err) {
      console.error('Error al registrar cobro de cuota:', err);
    }
  };

  const desktopGridRef = useRef<HTMLDivElement>(null);

  const scrollDesktopGrid = (direction: 'left' | 'right') => {
    if (desktopGridRef.current) {
      desktopGridRef.current.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
    }
  };

  const today = getTodayString();
  const isViewingToday = startDateStr === today;
  const currentWeekMonday = getWeekMonday(startDateStr);

  // Auto-scroll 7-day carousel so today's column is brought into view
  React.useEffect(() => {
    if (desktopViewMode === 'semana' && desktopGridRef.current) {
      const todayElement = desktopGridRef.current.querySelector(`#agenda-desktop-col-${today}`) as HTMLElement | null;
      if (todayElement) {
        todayElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [desktopViewMode, startDateStr, today]);

  // Wrapped toggle meeting handler that opens checkout modal if completing a meeting
  const handleToggleMeetingWithCheckout = (meetingId: string) => {
    const meet = meetings.find(m => m.id === meetingId);
    if (meet && !meet.completed) {
      setCheckoutMeeting(meet);
    }
    onToggleMeeting(meetingId);
  };

  // Quick Rescheduling Actions for Morning Briefing and Day Columns
  const handleMoveOverdueToToday = () => {
    const overdue = tasks.filter(t => t.date < today && !t.completed);
    overdue.forEach(t => onMoveTaskDate(t.id, today));
    hapticFeedback.success();
  };

  const handleMoveTodayPendingToTomorrow = (fromDate: string = today) => {
    const targetTomorrow = addDays(fromDate, 1);
    const pendingTasks = tasks.filter(t => t.date === fromDate && !t.completed);
    pendingTasks.forEach(t => onMoveTaskDate(t.id, targetTomorrow));
    hapticFeedback.success();
  };

  // Keep selectedItemForDetail in sync with latest state
  const activeDetailItem = React.useMemo(() => {
    if (!selectedItemForDetail) return null;
    if (selectedItemForDetail.type === 'tarea') {
      const found = tasks.find(t => t.id === selectedItemForDetail.data.id);
      return found ? { type: 'tarea' as const, data: found } : null;
    } else {
      const found = meetings.find(m => m.id === selectedItemForDetail.data.id);
      return found ? { type: 'reunion' as const, data: found } : null;
    }
  }, [selectedItemForDetail, tasks, meetings]);

  // Weekly Goals for current week
  const weekGoals = (weeklyGoals || []).filter(g => g.weekStart === currentWeekMonday);
  const completedGoalsCount = weekGoals.filter(g => g.completed).length;

  // Generate 7 days starting from startDateStr
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDateStr, i));

  // 3-day focus days (Ayer, Hoy, Mañana if today, or 3 consecutive days)
  const focusDays = isViewingToday
    ? [addDays(today, -1), today, addDays(today, 1)]
    : [startDateStr, addDays(startDateStr, 1), addDays(startDateStr, 2)];

  // Weekly Stats
  const weekTasks = tasks.filter(t => weekDays.includes(t.date));
  const weekMeetings = meetings.filter(m => weekDays.includes(m.date));
  const totalWeekItems = weekTasks.length + weekMeetings.length;
  const completedWeekItems = weekTasks.filter(t => t.completed).length + weekMeetings.filter(m => m.completed).length;
  const weekCompletionRate = totalWeekItems > 0 ? Math.round((completedWeekItems / totalWeekItems) * 100) : 100;

  const handlePrevWeek = () => {
    setStartDateStr(prev => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setStartDateStr(prev => addDays(prev, 7));
  };

  const handleGoToday = () => {
    setStartDateStr(today);
    setActiveMobileDayIndex(0);
  };

  const activeMobileDateStr = weekDays[activeMobileDayIndex] || today;

  // Filtro por Misión de la semana (desde la tira de píldoras)
  const [filterMissionId, setFilterMissionId] = useState<string | null>(null);

  // Misiones activas de la semana en curso
  const currentWeekMissions = React.useMemo(() => {
    const list = weeklyMissions && weeklyMissions.length > 0
      ? weeklyMissions
      : ((weeklyGoals || []) as unknown as WeeklyMission[]);
    return list.filter(m => m.weekStart === currentWeekMonday && m.estado !== 'descartada');
  }, [weeklyMissions, weeklyGoals, currentWeekMonday]);

  // Filter helper for items
  const filterDayItems = (dayTasks: AgendaTask[], dayMeetings: AgendaMeeting[]) => {
    let fTasks = dayTasks;
    let fMeetings = dayMeetings;

    // Filtro por Misión si está activa una píldora
    if (filterMissionId) {
      fTasks = fTasks.filter(t => t.missionId === filterMissionId);
      fMeetings = fMeetings.filter(m => m.missionId === filterMissionId);
    }

    if (desktopFilter === 'pendientes') {
      fTasks = fTasks.filter(t => !t.completed);
      fMeetings = fMeetings.filter(m => !m.completed);
    } else if (desktopFilter === 'reuniones') {
      fTasks = [];
    } else if (desktopFilter === 'tareas') {
      fMeetings = [];
    }
    return { fTasks, fMeetings };
  };

  return (
    <DndContext
      sensors={dndSensors}
      collisionDetection={agendaCollision}
      onDragStart={handleDndStart}
      onDragEnd={handleDndEnd}
      onDragCancel={() => setActiveDrag(null)}
      accessibility={dndAccessibility}
      // Desplazamiento automático suave y solo muy cerca del borde: antes "se pasaba" de columna
      autoScroll={{ threshold: { x: 0.06, y: 0.12 }, acceleration: 4 }}
    >
    <div className="space-y-4 pb-24">
      {/* MOBILE SEGMENTED BAR & QUICK ACTIONS (Visible only on Mobile) */}
      <div className="lg:hidden space-y-3">
        {/* Mobile Segmented Switcher */}
        <div className="flex items-center gap-1 overflow-x-auto bg-zinc-900/95 p-1 rounded-2xl border border-zinc-800 shadow-md no-scrollbar">
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setMobileTab('dia');
            }}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
              mobileTab === 'dia'
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mi Día</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setMobileTab('semana');
            }}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
              mobileTab === 'semana'
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>7 Días</span>
          </button>


          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setMobileTab('objetivos');
            }}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
              mobileTab === 'objetivos'
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Objetivos</span>
            {weekGoals.length > 0 && (
              <span className="text-[9px] px-1 py-0.2 rounded-full bg-black/30 text-white font-mono">
                {completedGoalsCount}/{weekGoals.length}
              </span>
            )}
          </button>

          {/* Vistas secundarias: menos botones, mismo acceso */}
          <label className="sr-only" htmlFor="mobile-more-views">Más vistas</label>
          <select
            id="mobile-more-views"
            value={mobileTab === 'kanban' || mobileTab === 'eisenhower' ? mobileTab : ''}
            onChange={(e) => {
              if (!e.target.value) return;
              hapticFeedback.light();
              setMobileTab(e.target.value as 'kanban' | 'eisenhower');
            }}
            className={`py-2 px-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer border-0 focus:outline-none ${
              mobileTab === 'kanban' || mobileTab === 'eisenhower'
                ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                : 'bg-transparent text-zinc-400'
            }`}
          >
            <option value="">Más…</option>
            <option value="kanban">Kanban</option>
            <option value="eisenhower">Eisenhower</option>
          </select>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              if (onNavigateToCalendar) onNavigateToCalendar();
              else onNavigate?.('/calendario');
            }}
            className="py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer text-zinc-400 hover:text-zinc-200"
            title="Abrir el calendario del mes"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Mes</span>
          </button>
        </div>

        {/* Quick Add Action Bar on Mobile */}
        <div className={`flex items-center justify-between gap-2 p-2.5 bg-zinc-900/90 border border-zinc-800 rounded-2xl ${mobileTab === 'dia' ? 'hidden' : ''}`}>
          <div className="min-w-0">
            <span className="text-xs font-bold text-zinc-200 block truncate">
              {mobileTab === 'dia'
                ? `Hoy, ${formatDayName(today)}`
                : mobileTab === 'semana'
                ? `Semana del ${formatShortDay(weekDays[0])}`
                : 'Objetivos de la Semana'}
            </span>
            <span className="text-[10px] text-zinc-400 block truncate">
              {mobileTab === 'dia'
                ? `${tasks.filter(t => t.date === today && !t.completed).length} tareas pendientes hoy`
                : mobileTab === 'semana'
                ? `${totalWeekItems - completedWeekItems} pendientes en la semana`
                : `${weekGoals.length - completedGoalsCount} metas por cumplir`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                hapticFeedback.medium();
                setShowWeeklyCloseModal(true);
              }}
              className="px-2 py-1.5 rounded-xl bg-[#8B7CF6]/15 border border-[#8B7CF6]/30 text-[#8B7CF6] text-xs font-bold transition active:scale-95 flex items-center gap-1 cursor-pointer"
              title="Cierre Semanal"
            >
              <Target className="w-3 h-3 text-[#8B7CF6]" />
              <span className="hidden sm:inline">Cierre</span>
            </button>

            <button
              onClick={() => {
                hapticFeedback.medium();
                onOpenQuickAdd('reunion', mobileTab === 'dia' ? today : activeMobileDateStr);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-[#34C38F]/15 border border-[#34C38F]/30 text-[#34C38F] text-xs font-bold transition active:scale-95 flex items-center gap-1 cursor-pointer"
            >
              <Calendar className="w-3 h-3 text-[#34C38F]" />
              <span>Reunión</span>
            </button>

            <button
              onClick={() => {
                hapticFeedback.medium();
                onOpenQuickAdd('tarea', mobileTab === 'dia' ? today : activeMobileDateStr);
              }}
              className="px-3 py-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-xs font-bold transition active:scale-95 shadow-sm shadow-[var(--accent)]/20 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tarea</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MOBILE CONTENT ROUTING (Segmented & Clutter-Free)         */}
      {/* ======================================================== */}
      <div className="lg:hidden space-y-4">
        {mobileTab !== 'objetivos' && (
          <TaskSortControl value={taskSortMode} onChange={setTaskSortMode} className="justify-end" />
        )}

        {/* MOBILE MODE 1: MI DÍA (Focused, High-Spacing, Clean) */}
        {mobileTab === 'dia' && (
          <div className="space-y-3.5">
            {/* Lo primero en el celular: la rutina diaria y qué hay que hacer hoy */}
            <DailyRoutineCard />
                <ProspectingTodayCard onOpen={() => onNavigate?.('/prospeccion')} />
            <TodayFocusBanner
              todayStr={today}
              todayTasks={tasks.filter(t => t.date === today)}
              todayMeetings={meetings.filter(m => m.date === today)}
              onToggleTask={onToggleTask}
              onToggleMeeting={handleToggleMeetingWithCheckout}
              onOpenQuickAdd={onOpenQuickAdd}
              onOpenFocus={() => onNavigate && onNavigate('/foco')}
            />

            {/* Widget de Cobranzas & Saldos Activos */}
            <AgendaBillingWidget
              projects={projects}
              incomes={incomes}
              studioSettings={studioSettings}
              privacyMode={privacyMode}
              onNavigate={onNavigate}
              onOpenRegisterPayment={(p) => {
                setSelectedProjectForPayment(p);
                setShowRegisterPaymentModal(true);
              }}
            />

            {/* Distribución de Jornada (Time Budget Flexible): plegada en el celular */}
            <DailyTimeBudgetWidget
              dateStr={today}
              isToday={true}
              defaultCollapsed={true}
            />

            {/* Compact Daily Briefing Banner */}
            {(() => {
              const todayTasks = tasks.filter(t => t.date === today);
              const todayMeetings = meetings.filter(m => m.date === today);
              const overdueTasks = tasks.filter(t => t.date < today && !t.completed);
              const pendingToday = todayTasks.filter(t => !t.completed).length;

              return (
                <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-zinc-100">Foco de la Jornada</h3>
                        <p className="text-[10px] text-zinc-400">
                          {todayMeetings.length} {todayMeetings.length === 1 ? 'reunión' : 'reuniones'} · {pendingToday} {pendingToday === 1 ? 'tarea pendiente' : 'tareas pendientes'}
                        </p>
                      </div>
                    </div>

                    {pendingToday > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMoveTodayPendingToTomorrow(today)}
                        className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-amber-500 hover:text-black text-amber-300 text-[10px] font-bold border border-zinc-700 transition flex items-center gap-1 shrink-0"
                        title="Postergar pendientes a mañana"
                      >
                        <FastForward className="w-3 h-3" />
                        <span>Pasar a mañana</span>
                      </button>
                    )}
                  </div>

                  {/* Overdue alert pill if any */}
                  {overdueTasks.length > 0 && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                      <span className="font-semibold text-[11px]">
                        ⚠️ {overdueTasks.length} {overdueTasks.length === 1 ? 'tarea vencida' : 'tareas vencidas'} de días anteriores
                      </span>
                      <button
                        onClick={handleMoveOverdueToToday}
                        className="text-[10px] font-bold underline hover:text-rose-200"
                      >
                        Traer a hoy
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Today's Full Day Column in Mobile Mode */}
            <DayColumn
              dndScope="mobile"
              dndEnabled={dndScope === "mobile"}
              dateStr={today}
              isToday={true}
              tasks={tasks.filter(t => t.date === today)}
              meetings={meetings.filter(m => m.date === today)}
              projects={projects}
              missions={currentWeekMissions}
              pendingCount={
                tasks.filter(t => t.date === today && !t.completed).length +
                meetings.filter(m => m.date === today && !m.completed).length
              }
              onToggleTask={onToggleTask}
              onToggleMeeting={handleToggleMeetingWithCheckout}
              onMoveTaskDate={onMoveTaskDate}
              onMoveMeetingDate={onMoveMeetingDate}
              onDeleteTask={onDeleteTask}
              onDeleteMeeting={onDeleteMeeting}
              onOpenQuickAdd={onOpenQuickAdd}
              onToggleSubtask={onToggleSubtask}
              onAddSubtask={onAddSubtask}
              onDeleteSubtask={onDeleteSubtask}
              onReorderTasks={onReorderTasks}
              onSelectItem={(item) => {
                if (onOpenItemDetail) {
                  onOpenItemDetail(item.data.id, item.type);
                } else {
                  setSelectedItemForDetail(item);
                }
              }}
              onMovePendingToTomorrow={() => handleMoveTodayPendingToTomorrow(today)}
            />
          </div>
        )}

        {/* MOBILE MODE 2: 7 DÍAS (Horizontal Pills + Day Column) */}
        {mobileTab === 'semana' && (
          <div className="space-y-3">
            {/* Week Stepper & Range Header */}
            <div className="flex items-center justify-between p-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xs">
              <button
                onClick={handlePrevWeek}
                className="p-1.5 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-zinc-200">
                {formatShortDay(weekDays[0])} — {formatShortDay(weekDays[6])}
              </span>
              <button
                onClick={handleNextWeek}
                className="p-1.5 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Horizontal Day Pills */}
            <div className="overflow-x-auto pb-1 flex items-center gap-2 no-scrollbar">
              {weekDays.map((dateStr, idx) => {
                const isSelected = idx === activeMobileDayIndex;
                const isToday = dateStr === today;
                const dayTasks = tasks.filter(t => t.date === dateStr);
                const dayMeetings = meetings.filter(m => m.date === dateStr);
                const totalItems = dayTasks.length + dayMeetings.length;
                const pendingItems = dayTasks.filter(t => !t.completed).length + dayMeetings.filter(m => !m.completed).length;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => {
                      hapticFeedback.selection();
                      setActiveMobileDayIndex(idx);
                    }}
                    className={`flex flex-col items-center justify-center min-w-[76px] py-2 px-2.5 rounded-xl border text-center transition shadow-sm active:scale-95 ${
                      isSelected
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white font-bold shadow-md shadow-[var(--accent)]/30'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${
                      isSelected ? 'text-white/90' : isToday ? 'text-[var(--accent)]' : 'text-zinc-400'
                    }`}>
                      {isToday ? 'HOY' : formatDayName(dateStr).slice(0, 3)}
                    </span>
                    <span className={`text-sm font-extrabold my-0.5 ${isSelected ? 'text-white' : 'text-zinc-100'}`}>
                      {dateStr.split('-')[2]}
                    </span>
                    {totalItems > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-medium ${
                        isSelected
                          ? 'bg-black/30 text-white'
                          : pendingItems > 0 ? 'bg-zinc-800 text-zinc-300' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {pendingItems > 0 ? `${pendingItems} pend.` : '✓ al día'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Day View */}
            <DayColumn
              dndScope="mobile"
              dndEnabled={dndScope === "mobile"}
              dateStr={activeMobileDateStr}
              isToday={activeMobileDateStr === today}
              tasks={tasks.filter(t => t.date === activeMobileDateStr)}
              meetings={meetings.filter(m => m.date === activeMobileDateStr)}
              projects={projects}
              missions={currentWeekMissions}
              pendingCount={
                tasks.filter(t => t.date === activeMobileDateStr && !t.completed).length +
                meetings.filter(m => m.date === activeMobileDateStr && !m.completed).length
              }
              onToggleTask={onToggleTask}
              onToggleMeeting={handleToggleMeetingWithCheckout}
              onMoveTaskDate={onMoveTaskDate}
              onMoveMeetingDate={onMoveMeetingDate}
              onDeleteTask={onDeleteTask}
              onDeleteMeeting={onDeleteMeeting}
              onOpenQuickAdd={onOpenQuickAdd}
              onToggleSubtask={onToggleSubtask}
              onAddSubtask={onAddSubtask}
              onDeleteSubtask={onDeleteSubtask}
              onReorderTasks={onReorderTasks}
              onSelectItem={(item) => {
                if (onOpenItemDetail) {
                  onOpenItemDetail(item.data.id, item.type);
                } else {
                  setSelectedItemForDetail(item);
                }
              }}
              onMovePendingToTomorrow={() => handleMoveTodayPendingToTomorrow(activeMobileDateStr)}
            />
          </div>
        )}

        {/* MOBILE MODE 3: KANBAN */}
        {mobileTab === 'kanban' && (
          <div className="pt-1">
            <KanbanBoard
              tasks={tasks}
              today={today}
              onToggleTask={onToggleTask}
              onMoveTaskDate={onMoveTaskDate}
              onDeleteTask={onDeleteTask}
              onOpenQuickAdd={onOpenQuickAdd}
              onUpdateTask={onUpdateTask}
            />
          </div>
        )}

        {/* MOBILE MODE 4: EISENHOWER */}
        {mobileTab === 'eisenhower' && (
          <div className="pt-1">
            <EisenhowerMatrix
              tasks={tasks}
              meetings={meetings}
              today={today}
              onToggleTask={onToggleTask}
              onDeleteTask={onDeleteTask}
              onOpenQuickAdd={onOpenQuickAdd}
            />
          </div>
        )}

        {/* MOBILE MODE 5: OBJETIVOS */}
        {mobileTab === 'objetivos' && (
          <WeeklyGoalsWidget
            weekStart={currentWeekMonday}
            goals={weeklyGoals || []}
            defaultCollapsed={false}
            onAddGoal={(title, category) => {
              onAddWeeklyGoal?.(title, category, currentWeekMonday);
            }}
            onToggleGoal={(id) => {
              onToggleWeeklyGoal?.(id);
            }}
            onUpdateGoal={(id, updates) => {
              onUpdateWeeklyGoal?.(id, updates);
            }}
            onDeleteGoal={(id) => {
              onDeleteWeeklyGoal?.(id);
            }}
          />
        )}
      </div>

      {/* ======================================================== */}
      {/* DESKTOP CONTENT ROUTING (Full Layout with Views & Grids) */}
      {/* ======================================================== */}
      <div className="hidden lg:block space-y-4">
        {/* TAB 1: OBJETIVOS SEMANALES DEDICATED WORKSPACE */}
        {agendaTab === 'objetivos' && (
          <WeeklyGoalsWidget
            weekStart={currentWeekMonday}
            goals={weeklyGoals || []}
            defaultCollapsed={false}
            onAddGoal={(title, category) => {
              onAddWeeklyGoal?.(title, category, currentWeekMonday);
            }}
            onToggleGoal={(id) => {
              onToggleWeeklyGoal?.(id);
            }}
            onUpdateGoal={(id, updates) => {
              onUpdateWeeklyGoal?.(id, updates);
            }}
            onDeleteGoal={(id) => {
              onDeleteWeeklyGoal?.(id);
            }}
          />
        )}

        {/* TAB 2: CALENDAR & DAYS AGENDA (PANTALLA COMPLETA) */}
        {agendaTab === 'calendario' && (
          <div className="w-full space-y-4">
            {/* Desktop View Switcher & Filter Toolbar (Swiss Minimalist Spec) */}
            <div className="card-swiss p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-none">
              {/* Left: View Tabs with Underline on Active */}
              <div className="flex items-center gap-4 border-b md:border-b-0 border-[var(--border-divider)] pb-2 md:pb-0 overflow-x-auto no-scrollbar shrink-0">
                {[
                  { id: 'dia', label: 'Día' },
                  { id: 'semana', label: 'Semana' },
                ].map(tab => {
                  const isActive = desktopViewMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDesktopViewMode(tab.id as any)}
                      className={`pb-1.5 text-xs sm:text-sm transition cursor-pointer relative shrink-0 ${
                        isActive
                          ? 'text-[var(--text-primary)] font-bold'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {isActive && (
                        <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--solid-contrast-bg)]" />
                      )}
                    </button>
                  );
                })}

                {/* Direct 1-Click Jump to Calendario 360° */}
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    if (onNavigateToCalendar) onNavigateToCalendar();
                    else onNavigate?.('/calendario');
                  }}
                  className="pb-1.5 text-xs sm:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  title="Abrir el calendario del mes con entregas"
                >
                  <span>Mes</span>
                </button>

                {/* Vistas secundarias en un menú: menos ruido, mismo acceso */}
                <label className="sr-only" htmlFor="desktop-more-views">Más vistas</label>
                <select
                  id="desktop-more-views"
                  value={['enfoque', 'lista', 'kanban', 'eisenhower'].includes(desktopViewMode) ? desktopViewMode : ''}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    hapticFeedback.selection();
                    setDesktopViewMode(e.target.value as any);
                  }}
                  className={`pb-1.5 text-xs sm:text-sm bg-transparent border-0 cursor-pointer focus:outline-none shrink-0 ${
                    ['enfoque', 'lista', 'kanban', 'eisenhower'].includes(desktopViewMode)
                      ? 'text-[var(--text-primary)] font-bold'
                      : 'text-[var(--text-secondary)] font-medium'
                  }`}
                >
                  <option value="">Más vistas</option>
                  <option value="enfoque">3 días</option>
                  <option value="lista">Listas</option>
                  <option value="kanban">Kanban</option>
                  <option value="eisenhower">Eisenhower (urgente / importante)</option>
                </select>
              </div>

              {/* Center / Right: Filter Badges + Quick Add + Week Progress */}
              <div className="flex items-center gap-3 flex-wrap justify-between md:justify-end">
                <TaskSortControl value={taskSortMode} onChange={setTaskSortMode} />

                {/* Filter Pills */}
                <div className="flex items-center bg-[var(--bg-app)] p-0.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)]">
                  {(['todos', 'pendientes', 'reuniones', 'tareas'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setDesktopFilter(f)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition cursor-pointer ${
                        desktopFilter === f
                          ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {f === 'todos' ? 'Todos' : f}
                    </button>
                  ))}
                </div>

                {/* Week Progress */}
                <div className="hidden xl:flex items-center gap-2.5 text-right" title="Tareas y reuniones de la semana completadas">
                  <div>
                    <span className="text-[11px] text-[var(--text-secondary)] mr-1">Semana:</span>
                    <span className="text-[11px] font-bold text-[var(--text-primary)] tabular-nums">
                      {completedWeekItems} de {totalWeekItems}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] ml-1 tabular-nums">
                      ({weekCompletionRate}%)
                    </span>
                  </div>
                  <div className="w-16 h-1.5 bg-[var(--bg-surface-muted)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
                    <div
                      className="h-full bg-[#16A34A] rounded-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300"
                      style={{ width: `${weekCompletionRate}%` }}
                    />
                  </div>
                </div>

                {/* + Nueva Tarea Black Button */}
                <button
                  type="button"
                  onClick={() => onOpenQuickAdd('tarea', today)}
                  className="btn-swiss-primary flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2]" />
                  <span>Nueva Tarea</span>
                </button>
              </div>
            </div>

            {/* TIRA COMPACTA: Misiones Activas de la Semana */}
            {currentWeekMissions.length > 0 && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span className="font-bold text-[var(--text-primary)]">
                      Misiones de la Semana
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      ({currentWeekMissions.length} activas · clic para filtrar tareas)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {filterMissionId && (
                      <button
                        type="button"
                        onClick={() => setFilterMissionId(null)}
                        className="text-[11px] text-[var(--accent)] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Ver todas las tareas</span>
                      </button>
                    )}

                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('/semana')}
                        className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition cursor-pointer flex items-center gap-1"
                      >
                        <span>Ir a /semana</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                  {currentWeekMissions.map(m => {
                    const isFiltered = filterMissionId === m.id;
                    const cfg = FRENTE_CONFIG[m.frente || 'Otros'];
                    const prog = calculateMissionProgress(m, tasks, meetings, currentWeekMonday);

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          hapticFeedback.selection();
                          setFilterMissionId(prev => prev === m.id ? null : m.id);
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition cursor-pointer shrink-0 ${
                          isFiltered
                            ? 'bg-[var(--accent)]/15 border-[var(--accent)] ring-2 ring-[var(--accent)]/30 text-white font-bold'
                            : 'bg-[var(--bg-app)] border-[var(--border-subtle)] hover:border-[var(--text-tertiary)] text-[var(--text-primary)]'
                        }`}
                        title={`Clic para filtrar tareas de: ${m.title}`}
                      >
                        <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-bold uppercase ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                          {m.frente}
                        </span>
                        <span className="truncate max-w-[150px] font-medium">
                          {m.title}
                        </span>
                        <div className="flex items-center gap-1.5 pl-1.5 border-l border-[var(--border-subtle)]">
                          <div className="w-10 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300"
                              style={{ width: `${prog.avancePct}%`, backgroundColor: cfg.hex }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                            {prog.avancePct}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW 0: DÍA (Foco del Día + Widgets Bento) */}
            {desktopViewMode === 'dia' && (
              <div className="space-y-4">
                <DailyRoutineCard />
                <ProspectingTodayCard onOpen={() => onNavigate?.('/prospeccion')} />
                <TodayFocusBanner
                  todayStr={today}
                  todayTasks={tasks.filter(t => t.date === today)}
                  todayMeetings={meetings.filter(m => m.date === today)}
                  onToggleTask={onToggleTask}
                  onToggleMeeting={handleToggleMeetingWithCheckout}
                  onOpenQuickAdd={onOpenQuickAdd}
                  onOpenFocus={() => onNavigate && onNavigate('/foco')}
                />

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start w-full">
                  <div className="space-y-4 min-w-0">
                    {/* Widget de Cobranzas & Saldos Activos */}
                    <AgendaBillingWidget
                      projects={projects}
                      incomes={incomes}
                      studioSettings={studioSettings}
                      privacyMode={privacyMode}
                      onNavigate={onNavigate}
                      onOpenRegisterPayment={(p) => {
                        setSelectedProjectForPayment(p);
                        setShowRegisterPaymentModal(true);
                      }}
                    />
                    <DailyTimeBudgetWidget
                      dateStr={today}
                      isToday={true}
                    />
                  </div>

                  <div className="space-y-4 min-w-0">
                    <WeeklyGoalsWidget
                      weekStart={currentWeekMonday}
                      goals={weeklyGoals || []}
                      onAddGoal={(title, category) => onAddWeeklyGoal?.(title, category, currentWeekMonday)}
                      onToggleGoal={(id) => onToggleWeeklyGoal?.(id)}
                      onUpdateGoal={(id, updates) => onUpdateWeeklyGoal?.(id, updates)}
                      onDeleteGoal={(id) => onDeleteWeeklyGoal?.(id)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* VIEW KANBAN: Tablero Ágil (Por hacer · En curso · Hecho) */}
            {desktopViewMode === 'kanban' && (
              <KanbanBoard
                tasks={tasks}
                today={today}
                onToggleTask={onToggleTask}
                onMoveTaskDate={onMoveTaskDate}
                onDeleteTask={onDeleteTask}
                onOpenQuickAdd={onOpenQuickAdd}
                onUpdateTask={onUpdateTask}
              />
            )}

            {/* VIEW EISENHOWER: Matriz de 4 Cuadrantes */}
            {desktopViewMode === 'eisenhower' && (
              <EisenhowerMatrix
                tasks={tasks}
                meetings={meetings}
                today={today}
                onToggleTask={onToggleTask}
                onDeleteTask={onDeleteTask}
                onOpenQuickAdd={onOpenQuickAdd}
              />
            )}

            {/* MODE 1: 7-Columns View (Columnas amplias de 300px con scroll horizontal suave y selector de día) */}
            {desktopViewMode === 'semana' && (
              <div className="w-full min-w-0 max-w-full space-y-3">
                {/* Desktop scroll navigation bar with Day Quick Pickers */}
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl text-xs text-zinc-300 shadow-sm flex-wrap gap-2.5">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-[var(--accent)]" />
                    <span className="font-bold text-zinc-200">Semana Completa (7 Días)</span>
                    <span className="text-[11px] text-zinc-400 hidden lg:inline">
                      · Columnas anchas y legibles
                    </span>
                  </div>

                  {/* Quick Jump to specific day of the week */}
                  <div className="flex items-center gap-1 overflow-x-auto max-w-full py-0.5">
                    {weekDays.map(dateStr => {
                      const isToday = dateStr === today;
                      const dayLetter = formatDayName(dateStr).slice(0, 3);
                      const dayNum = dateStr.slice(8, 10);
                      const dayPending = tasks.filter(t => t.date === dateStr && !t.completed).length + meetings.filter(m => m.date === dateStr && !m.completed).length;

                      return (
                        <button
                          key={dateStr}
                          type="button"
                          onClick={() => {
                            const el = desktopGridRef.current?.querySelector(`#agenda-desktop-col-${dateStr}`) as HTMLElement | null;
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                              hapticFeedback.light();
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                            isToday
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                              : 'bg-zinc-950/70 hover:bg-zinc-800/80 text-zinc-300 border-zinc-800/80'
                          }`}
                          title={`Ir a ${formatDayName(dateStr)} ${dayNum}`}
                        >
                          <span className="uppercase font-bold">{dayLetter}</span>
                          <span className="font-bold">{dayNum}</span>
                          {dayPending > 0 && (
                            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                              isToday ? 'bg-black/30 text-white' : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {dayPending}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Navigation buttons: Prev / Next / Ir a Hoy */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const el = desktopGridRef.current?.querySelector(`#agenda-desktop-col-${today}`) as HTMLElement | null;
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                          hapticFeedback.light();
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-zinc-700/60"
                      title="Desplazarse a la columna de Hoy"
                    >
                      <span>Ir a Hoy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollDesktopGrid('left')}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition active:scale-95 flex items-center gap-1 cursor-pointer border border-zinc-700/60"
                      title="Días anteriores"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Anterior</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollDesktopGrid('right')}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition active:scale-95 flex items-center gap-1 cursor-pointer border border-zinc-700/60"
                      title="Días siguientes"
                    >
                      <span>Siguiente</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Horizontal Scrollable Carousel Container with 300px Spacious Columns */}
                <div
                  ref={desktopGridRef}
                  className="w-full min-w-0 max-w-full flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x scroll-smooth overscroll-x-contain"
                >
                  {weekDays.map(dateStr => {
                    const isToday = dateStr === today;
                    const rawTasks = tasks.filter(t => t.date === dateStr);
                    const rawMeetings = meetings.filter(m => m.date === dateStr);
                    const { fTasks, fMeetings } = filterDayItems(rawTasks, rawMeetings);
                    const pendingCount = rawTasks.filter(t => !t.completed).length + rawMeetings.filter(m => !m.completed).length;

                    return (
                      <div
                        key={dateStr}
                        id={`agenda-desktop-col-${dateStr}`}
                        className="w-[305px] min-w-[305px] max-w-[330px] shrink-0 snap-start"
                      >
                        <DayColumn
                          dndScope="desktop"
                          dndEnabled={dndScope === "desktop"}
                          dateStr={dateStr}
                          isToday={isToday}
                          tasks={fTasks}
                          meetings={fMeetings}
                          projects={projects}
                          missions={currentWeekMissions}
                          pendingCount={pendingCount}
                          onToggleTask={onToggleTask}
                          onToggleMeeting={handleToggleMeetingWithCheckout}
                          onMoveTaskDate={onMoveTaskDate}
                          onMoveMeetingDate={onMoveMeetingDate}
                          onDeleteTask={onDeleteTask}
                          onDeleteMeeting={onDeleteMeeting}
                          onOpenQuickAdd={onOpenQuickAdd}
                          onToggleSubtask={onToggleSubtask}
                          onAddSubtask={onAddSubtask}
                          onDeleteSubtask={onDeleteSubtask}
                          onReorderTasks={onReorderTasks}
                          onSelectItem={(item) => {
                            if (onOpenItemDetail) {
                              onOpenItemDetail(item.data.id, item.type);
                            } else {
                              setSelectedItemForDetail(item);
                            }
                          }}
                          onMovePendingToTomorrow={() => handleMoveTodayPendingToTomorrow(dateStr)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

        {/* MODE 2: 3-Day Focus Grid (Spacious, Luxury Desktop Columns) */}
        {desktopViewMode === 'enfoque' && (
          <div className="grid grid-cols-3 gap-5">
            {focusDays.map(dateStr => {
              const isToday = dateStr === today;
              const rawTasks = tasks.filter(t => t.date === dateStr);
              const rawMeetings = meetings.filter(m => m.date === dateStr);
              const { fTasks, fMeetings } = filterDayItems(rawTasks, rawMeetings);
              const pendingCount = rawTasks.filter(t => !t.completed).length + rawMeetings.filter(m => !m.completed).length;

              return (
                <DayColumn
                  dndScope="desktop"
                  dndEnabled={dndScope === "desktop"}
                  key={dateStr}
                  dateStr={dateStr}
                  isToday={isToday}
                  tasks={fTasks}
                  meetings={fMeetings}
                  projects={projects}
                  missions={currentWeekMissions}
                  pendingCount={pendingCount}
                  onToggleTask={onToggleTask}
                  onToggleMeeting={handleToggleMeetingWithCheckout}
                  onMoveTaskDate={onMoveTaskDate}
                  onMoveMeetingDate={onMoveMeetingDate}
                  onDeleteTask={onDeleteTask}
                  onDeleteMeeting={onDeleteMeeting}
                  onOpenQuickAdd={onOpenQuickAdd}
                  onToggleSubtask={onToggleSubtask}
                  onAddSubtask={onAddSubtask}
                  onDeleteSubtask={onDeleteSubtask}
                  onReorderTasks={onReorderTasks}
                  onSelectItem={(item) => {
                    if (onOpenItemDetail) {
                      onOpenItemDetail(item.data.id, item.type);
                    } else {
                      setSelectedItemForDetail(item);
                    }
                  }}
                  onMovePendingToTomorrow={() => handleMoveTodayPendingToTomorrow(dateStr)}
                />
              );
            })}
          </div>
        )}

        {/* MODE 3: Linear Agenda List View */}
        {desktopViewMode === 'lista' && (
          <div className="space-y-4">
            {weekDays.map(dateStr => {
              const isToday = dateStr === today;
              const rawTasks = tasks.filter(t => t.date === dateStr);
              const rawMeetings = meetings.filter(m => m.date === dateStr);
              const { fTasks, fMeetings } = filterDayItems(rawTasks, rawMeetings);
              const dayTotal = fTasks.length + fMeetings.length;

              return (
                <div
                  key={dateStr}
                  className={`p-4 rounded-2xl border ${
                    isToday
                      ? 'bg-zinc-900 border-[var(--accent)]/50 shadow-lg shadow-[var(--accent)]/5'
                      : 'bg-zinc-900/80 border-zinc-800'
                  } space-y-3 transition`}
                >
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-sm font-bold uppercase tracking-wider ${
                        isToday ? 'text-[var(--accent)]' : 'text-zinc-200'
                      }`}>
                        {isToday ? 'Hoy' : formatDayName(dateStr)}
                      </span>
                      <span className="text-xs text-zinc-400 font-medium">
                        {formatShortDay(dateStr)}
                      </span>
                      {isToday && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
                          Fecha actual
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenQuickAdd('tarea', dateStr)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-[var(--accent)] hover:text-white text-zinc-300 text-xs font-semibold transition flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Tarea</span>
                      </button>
                      <button
                        onClick={() => onOpenQuickAdd('reunion', dateStr)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-amber-500 hover:text-white text-zinc-300 text-xs font-semibold transition flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Reunión</span>
                      </button>
                    </div>
                  </div>

                  {dayTotal === 0 ? (
                    <div className="py-4 text-center text-xs text-zinc-500">
                      Sin compromisos programados para este día.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Meetings */}
                      {fMeetings.map(meet => (
                        <div
                          key={meet.id}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('button') || target.closest('a')) return;
                            if (onOpenItemDetail) {
                              onOpenItemDetail(meet.id, 'reunion');
                            } else {
                              setSelectedItemForDetail({ type: 'reunion', data: meet });
                            }
                          }}
                          className={`p-3 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition ${
                            meet.completed
                              ? 'bg-zinc-950/40 border-zinc-800/40 opacity-60'
                              : 'bg-zinc-950 border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-900/60'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                hapticFeedback.selection();
                                if (!meet.completed) {
                                  playTaskDone();
                                  fireTaskCelebration(0.5, 0.4);
                                }
                                onToggleMeeting(meet.id);
                              }}
                              className="mt-0.5 text-amber-400 shrink-0"
                            >
                              {meet.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4" />}
                            </button>
                            <div className="min-w-0">
                              <div className={`text-xs font-semibold ${meet.completed ? 'line-through text-zinc-400' : 'text-zinc-100'}`}>
                                {meet.title}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-amber-400 mt-1">
                                {meet.time && <span>{meet.time} hs</span>}
                                {meet.projectName && <span className="text-zinc-400">· {meet.projectName}</span>}
                              </div>
                            </div>
                          </div>

                          {meet.clientPhone && (
                            <a
                              href={formatWhatsAppUrl(meet.clientPhone, `Hola! Te contacto por nuestra reunión.`)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition shrink-0"
                              title="Abrir WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      ))}

                      {/* Tasks */}
                      {fTasks.map((t) => {
                        const catCfg = getTaskCategoryConfig(t);
                        const CatIcon = catCfg.icon;
                        const isDragging = listDraggedTaskId === t.id;
                        const isDragOver = listDragOverTaskId === t.id;

                        return (
                          <div
                            key={t.id}
                            data-list-task-id={t.id}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (listDraggedTaskId === t.id) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              const isTop = (e.clientY - rect.top) < (rect.height / 2);
                              const pos = isTop ? 'before' : 'after';
                              if (listDragOverTaskId !== t.id || listDropPosition !== pos) {
                                setListDragOverTaskId(t.id);
                                setListDropPosition(pos);
                              }
                            }}
                            onDragLeave={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                if (listDragOverTaskId === t.id) {
                                  setListDragOverTaskId(null);
                                  setListDropPosition(null);
                                }
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              let sourceId = listDraggedTaskId;
                              try {
                                const raw = e.dataTransfer.getData('text/plain');
                                if (raw) {
                                  const item = JSON.parse(raw);
                                  if (item.type === 'tarea') sourceId = item.id;
                                }
                              } catch {}

                              if (sourceId && sourceId !== t.id) {
                                const pos = listDropPosition || 'before';
                                const reordered = reorderTasksList(fTasks, sourceId, t.id, pos);
                                onReorderTasks?.(dateStr, reordered);
                                hapticFeedback.medium();
                              }
                              setListDraggedTaskId(null);
                              setListDragOverTaskId(null);
                              setListDropPosition(null);
                            }}
                            className="relative"
                          >
                            {/* Visual Drop line */}
                            {isDragOver && listDropPosition === 'before' && (
                              <div className="absolute -top-1 left-2 right-2 h-1 bg-[var(--accent)] rounded-full shadow-[0_0_8px_#E8590C] z-30 pointer-events-none animate-pulse" />
                            )}
                            {isDragOver && listDropPosition === 'after' && (
                              <div className="absolute -bottom-1 left-2 right-2 h-1 bg-[var(--accent)] rounded-full shadow-[0_0_8px_#E8590C] z-30 pointer-events-none animate-pulse" />
                            )}

                            <div
                              draggable={true}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', JSON.stringify({ id: t.id, type: 'tarea', sourceDate: dateStr }));
                                e.dataTransfer.effectAllowed = 'move';
                                setListDraggedTaskId(t.id);
                              }}
                              onDragEnd={() => {
                                setListDraggedTaskId(null);
                                setListDragOverTaskId(null);
                                setListDropPosition(null);
                              }}
                              onClick={(e) => {
                                const target = e.target as HTMLElement;
                                if (target.closest('button') || target.closest('a') || target.closest('.no-swipe')) return;
                                if (onOpenItemDetail) {
                                  onOpenItemDetail(t.id, 'tarea');
                                } else {
                                  setSelectedItemForDetail({ type: 'tarea', data: t });
                                }
                              }}
                              className={`p-3 rounded-xl border flex items-start justify-between gap-3 cursor-grab active:cursor-grabbing transition ${
                                isDragging
                                  ? 'opacity-40 scale-[0.98] border-dashed border-[var(--accent)]/60 bg-[var(--accent)]/5'
                                  : t.completed
                                  ? 'bg-zinc-950/40 border-zinc-800/40 opacity-60'
                                  : `${catCfg.cardBg} ${catCfg.cardBorder} ${catCfg.cardBorderHover}`
                              }`}
                            >
                              <div className="flex items-start gap-2 min-w-0">
                                {/* Grip handle for dragging */}
                                <div
                                  className="no-swipe touch-none select-none p-1 -ml-1 text-zinc-600 hover:text-zinc-300 active:text-[var(--accent)] cursor-grab active:cursor-grabbing rounded hover:bg-zinc-800/80 transition flex items-center justify-center shrink-0"
                                  title="Arrastrar para reordenar"
                                  onTouchStart={(e) => {
                                    e.stopPropagation();
                                    setListDraggedTaskId(t.id);
                                    hapticFeedback.selection();
                                  }}
                                  onTouchMove={(e) => {
                                    e.stopPropagation();
                                    const touch = e.touches[0];
                                    if (!touch) return;
                                    const el = document.elementFromPoint(touch.clientX, touch.clientY);
                                    const card = el?.closest('[data-list-task-id]') as HTMLElement | null;
                                    if (card) {
                                      const targetId = card.getAttribute('data-list-task-id');
                                      if (targetId && targetId !== t.id) {
                                        const rect = card.getBoundingClientRect();
                                        const isTop = touch.clientY < (rect.top + rect.height / 2);
                                        setListDragOverTaskId(targetId);
                                        setListDropPosition(isTop ? 'before' : 'after');
                                      }
                                    }
                                  }}
                                  onTouchEnd={(e) => {
                                    e.stopPropagation();
                                    if (listDragOverTaskId && listDropPosition && listDragOverTaskId !== t.id) {
                                      const reordered = reorderTasksList(fTasks, t.id, listDragOverTaskId, listDropPosition);
                                      onReorderTasks?.(dateStr, reordered);
                                      hapticFeedback.medium();
                                    }
                                    setListDraggedTaskId(null);
                                    setListDragOverTaskId(null);
                                    setListDropPosition(null);
                                  }}
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    hapticFeedback.selection();
                                    if (!t.completed) {
                                      playTaskDone();
                                      fireTaskCelebration(0.5, 0.4);
                                    }
                                    onToggleTask(t.id);
                                  }}
                                  className="mt-0.5 text-[var(--accent)] shrink-0"
                                >
                                  {t.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4" />}
                                </button>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                    <span
                                      className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${catCfg.badgeBg} ${catCfg.badgeText} ${catCfg.badgeBorder}`}
                                      title={`Categoría: ${catCfg.label}`}
                                    >
                                      <CatIcon className="w-2.5 h-2.5" />
                                      <span>{catCfg.label}</span>
                                    </span>

                                    {t.priority && t.priority !== 'media' && (
                                      <span
                                        className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${TASK_PRIORITIES[t.priority].badge}`}
                                        title={`Prioridad: ${TASK_PRIORITIES[t.priority].label}`}
                                      >
                                        {TASK_PRIORITIES[t.priority].label}
                                      </span>
                                    )}
                                  </div>

                                  <div className={`text-xs font-semibold ${t.completed ? 'line-through text-zinc-400' : 'text-zinc-100'}`}>
                                    {t.title}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
                                    {t.time && <span className="text-[var(--accent)]">{t.time} hs</span>}
                                    {t.projectName && <span>· {t.projectName}</span>}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMoveTaskDate(t.id, addDays(dateStr, 1));
                                  }}
                                  className="p-1.5 text-zinc-500 hover:text-amber-400 hover:bg-zinc-800 rounded-lg transition"
                                  title="Postergar a mañana"
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteTask(t.id);
                                  }}
                                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition"
                                  title="Eliminar tarea"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
          </div>
        )}

        {/* TAB 3: MI DÍA (PANTALLA COMPLETA DEDICADA) */}
        {agendaTab === 'dia' && (
          <div className="w-full space-y-4">
            {/* RESUMEN MATUTINO / BRIEFING DEL DÍA */}
            <MorningBriefingCard
              tasks={tasks}
              meetings={meetings}
              incomes={incomes}
              onMoveOverdueToToday={handleMoveOverdueToToday}
              onMoveTodayPendingToTomorrow={() => handleMoveTodayPendingToTomorrow(today)}
              onOpenQuickAdd={onOpenQuickAdd}
              onNavigateToCalendar={() => {
                hapticFeedback.light();
                setAgendaTab('calendario');
              }}
            />

            {/* GRILLA BALANCEADA DE PANTALLA COMPLETA: 2 COLUMNAS AMPLIAS (50% / 50%) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start w-full">
              {/* Columna Izquierda: Cobros de Hoy + Bloques de Jornada */}
              <div className="space-y-4 min-w-0">
                {/* Widget de Cobranzas & Saldos Activos */}
                <AgendaBillingWidget
                  projects={projects}
                  incomes={incomes}
                  studioSettings={studioSettings}
                  privacyMode={privacyMode}
                  onNavigate={onNavigate}
                  onOpenRegisterPayment={(p) => {
                    setSelectedProjectForPayment(p);
                    setShowRegisterPaymentModal(true);
                  }}
                />

                <DailyTimeBudgetWidget
                  dateStr={today}
                  isToday={true}
                  defaultCollapsed={false}
                />
              </div>

              {/* Columna Derecha: Enfoque y Prioridades de Hoy + Accesos */}
              <div className="space-y-4 min-w-0">
                <DailyRoutineCard />
                <ProspectingTodayCard onOpen={() => onNavigate?.('/prospeccion')} />
                <TodayFocusBanner
                  todayStr={today}
                  todayTasks={tasks.filter(t => t.date === today)}
                  todayMeetings={meetings.filter(m => m.date === today)}
                  onToggleTask={(id) => {
                    hapticFeedback.medium();
                    onToggleTask(id);
                  }}
                  onToggleMeeting={(id) => {
                    hapticFeedback.medium();
                    handleToggleMeetingWithCheckout(id);
                  }}
                  onOpenQuickAdd={onOpenQuickAdd}
                  onOpenFocus={() => onNavigate && onNavigate('/foco')}
                />

                {/* Banner de acceso a la semana completa */}
                <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center font-bold">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-100">Planificar la Semana</h4>
                      <p className="text-[11px] text-zinc-400">Ver los 7 días completos, reuniones agendadas y distribución semanal</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      hapticFeedback.light();
                      setAgendaTab('calendario');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-[var(--accent)] text-zinc-200 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Ver Semana</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Detail Modal for Tasks & Meetings */}
      <ItemDetailModal
        isOpen={!!activeDetailItem}
        onClose={() => setSelectedItemForDetail(null)}
        item={activeDetailItem}
        projects={projects}
        missions={currentWeekMissions}
        onToggleTask={onToggleTask}
        onToggleMeeting={handleToggleMeetingWithCheckout}
        onMoveTaskDate={onMoveTaskDate}
        onMoveMeetingDate={onMoveMeetingDate}
        onDeleteTask={onDeleteTask}
        onDeleteMeeting={onDeleteMeeting}
        onUpdateTask={onUpdateTask}
        onUpdateMeeting={onUpdateMeeting}
        onToggleSubtask={onToggleSubtask}
        onAddSubtask={onAddSubtask}
        onDeleteSubtask={onDeleteSubtask}
      />

      {/* CHECK-OUT POST-REUNIÓN (Fast-action follow up prompt after completing meeting) */}
      <PostMeetingCheckoutModal
        isOpen={!!checkoutMeeting}
        meeting={checkoutMeeting}
        onClose={() => setCheckoutMeeting(null)}
        onScheduleNextMeeting={(_m) => {
          setCheckoutMeeting(null);
          onOpenQuickAdd('reunion', addDays(today, 7));
        }}
        onCreateDerivedTask={(m, nextActionText, nextActionDate) => {
          setCheckoutMeeting(null);
          const taskDate = nextActionDate || addDays(today, 1);
          const taskTitle = nextActionText || `Seguimiento: ${m.title}`;
          if (onAddTask) {
            onAddTask({
              title: taskTitle,
              date: taskDate,
              completed: false,
              createdAt: today,
              projectId: m.projectId,
              projectName: m.projectName,
            });
            hapticFeedback.success();
          } else {
            onOpenQuickAdd('tarea', taskDate);
          }
        }}
        onCreateDerivedIncome={(_m) => {
          setCheckoutMeeting(null);
          onOpenQuickAdd('ingreso', today);
        }}
      />

      {/* CIERRE SEMANAL ESTRATÉGICO & METRICS */}
      {showWeeklyCloseModal && (
        <WeeklyCloseModal
          isOpen={showWeeklyCloseModal}
          onClose={() => setShowWeeklyCloseModal(false)}
          tasks={tasks}
          meetings={meetings}
          incomes={incomes}
          projects={projects}
          onAddWeeklyGoal={(title, category) => {
            onAddWeeklyGoal?.(title, category);
          }}
        />
      )}

      {/* Quick Register Payment Modal from Agenda Widget */}
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
          onSavePayment={handleSavePaymentForAgenda}
          onDeletePayment={(paymentId) => {
            if (onDeletePayment && selectedProjectForPayment) {
              onDeletePayment(selectedProjectForPayment.id, paymentId);
            }
          }}
        />
      )}

      {/* Info Popover / Modal for Agenda */}
      {showInfoModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#4C8DFF]" />
                  <h3 className="text-sm font-bold text-zinc-100">
                    Agenda Semanal
                  </h3>
                </div>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-zinc-300 space-y-2.5 leading-relaxed">
                <p>
                  <strong>Gestos en el celular:</strong> Deslizá cualquier tarea hacia la <span className="text-emerald-400 font-semibold">derecha</span> para marcarla como hecha, o hacia la <span className="text-amber-400 font-semibold">izquierda</span> para postergarla a mañana.
                </p>
                <p className="text-zinc-400">
                  Podés navegar entre semanas con las flechas o tocar "Hoy" para volver inmediatamente a la fecha actual.
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
    </div>
      {/* Lo que se ve bajo el dedo o el puntero mientras se arrastra */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
        {activeDrag && !activeDrag.keyboard ? (
          <div className="px-3 py-2.5 rounded-xl border border-[var(--accent)] bg-[var(--bg-surface-elevated)] text-sm font-semibold text-[var(--text-primary)] shadow-2xl shadow-black/40 max-w-[280px] truncate rotate-[1deg]">
            {activeDrag.type === 'reunion' ? 'Reunión: ' : ''}
            {activeDrag.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

// Envoltura arrastrable para reuniones (solo se mueven de día, no se reordenan)
const DraggableMeeting: React.FC<{
  meeting: AgendaMeeting;
  dateLabel: string;
  dndScope: string;
  disabled?: boolean;
  children: (drag: { setNodeRef: (el: HTMLElement | null) => void; handleProps: any; cardProps: any; isDragging: boolean }) => React.ReactNode;
}> = ({ meeting, dateLabel, dndScope, disabled, children }) => {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `${dndScope}|meet|${meeting.id}`,
    disabled,
    data: { type: 'reunion', id: meeting.id, date: meeting.date, title: meeting.title, label: dateLabel },
  });
  return (
    <>
      {children({
        setNodeRef,
        isDragging,
        handleProps: { ...attributes, onKeyDown: listeners?.onKeyDown },
        cardProps: { onMouseDown: listeners?.onMouseDown, onTouchStart: listeners?.onTouchStart },
      })}
    </>
  );
};

// Subcomponent: Column for a single day
interface DayColumnProps {
  dndScope: 'mobile' | 'desktop';
  dndEnabled: boolean;
  dateStr: string;
  isToday: boolean;
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects?: Project[];
  pendingCount: number;
  onToggleTask: (taskId: string) => void;
  onToggleMeeting: (meetingId: string) => void;
  onMoveTaskDate: (taskId: string, targetDate: string) => void;
  onMoveMeetingDate: (meetingId: string, targetDate: string) => void;
  onDeleteTask: (taskId: string) => void;
  onDeleteMeeting: (meetingId: string) => void;
  onOpenQuickAdd: (type: 'tarea' | 'reunion', defaultDate?: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onAddSubtask?: (taskId: string, title: string) => void;
  onDeleteSubtask?: (taskId: string, subtaskId: string) => void;
  onSelectItem?: (item: { type: 'tarea' | 'reunion'; data: AgendaTask | AgendaMeeting }) => void;
  onMovePendingToTomorrow?: () => void;
  onReorderTasks?: (date: string, reorderedTasks: AgendaTask[]) => void;
  missions?: WeeklyMission[];
}

const DayColumn: React.FC<DayColumnProps> = ({
  dndScope,
  dndEnabled,
  dateStr,
  isToday,
  tasks,
  meetings,
  projects = [],
  missions = [],
  pendingCount,
  onToggleTask,
  onToggleMeeting,
  onMoveTaskDate,
  onMoveMeetingDate,
  onDeleteTask,
  onDeleteMeeting,
  onOpenQuickAdd,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  onSelectItem,
  onMovePendingToTomorrow,
  onReorderTasks,
}) => {
  const tomorrowLabel = '';
  void tomorrowLabel;

  const tomorrowStr = addDays(dateStr, 1);
  const dayName = formatDayName(dateStr);
  const shortDate = formatShortDay(dateStr);

  // Toda la columna recibe tareas y reuniones soltadas (también en otro día)
  const { setNodeRef: setDropRef, isOver: isDragOver } = useDroppable({
    id: `${dndScope}|day|${dateStr}`,
    disabled: !dndEnabled,
    data: { type: 'dia', date: dateStr, label: `${dayName} ${shortDate}` },
  });

  return (
    <div
      ref={setDropRef}
      className={`flex flex-col bg-zinc-900/90 rounded-2xl border transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-200 ${
        isDragOver
          ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/50 scale-[1.01]'
          : isToday
          ? 'border-[var(--accent)]/60 shadow-lg shadow-[var(--accent)]/5 ring-1 ring-[var(--accent)]/30'
          : 'border-zinc-800'
      } overflow-hidden min-h-[420px]`}
    >
      {/* Day Header - Clean & Responsive */}
      <div className={`p-3 border-b ${
        isToday ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30' : 'bg-zinc-950/60 border-zinc-800/80'
      } flex items-center justify-between gap-2`}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wider ${
              isToday ? 'text-[var(--accent)]' : 'text-zinc-200'
            }`}>
              {isToday ? 'Hoy' : dayName}
            </span>
            {isToday && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            )}
            {pendingCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300">
                {pendingCount}
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-400 font-medium truncate">
            {shortDate}
          </div>
        </div>

        {/* Quick Actions & Quick Add icon buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {pendingCount > 0 && onMovePendingToTomorrow && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMovePendingToTomorrow();
              }}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-amber-500 hover:text-black border border-zinc-700 text-zinc-300 transition active:scale-90"
              title="Pasar pendientes de este día a mañana"
            >
              <FastForward className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onOpenQuickAdd('reunion', dateStr)}
            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500 hover:text-black border border-amber-500/25 text-amber-300 transition active:scale-90"
            title={`Agendar reunión para el ${shortDate}`}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
          </button>
          <button
            onClick={() => onOpenQuickAdd('tarea', dateStr)}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-[var(--accent)] hover:text-white text-zinc-200 border border-zinc-700/60 transition active:scale-90"
            title={`Agregar tarea para el ${shortDate}`}
          >
            <Plus className="w-3.5 h-3.5 text-[var(--accent)]" />
          </button>
        </div>
      </div>

      {/* Items Container */}
      <div className="flex-1 p-2.5 space-y-2 overflow-y-auto max-h-[620px]">
        {/* Meetings Section */}
        {meetings.length > 0 ? (
          <div className="space-y-1.5 mb-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 flex items-center justify-between px-1">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-400" />
                <span>Reuniones ({meetings.length})</span>
              </div>
              <button
                onClick={() => onOpenQuickAdd('reunion', dateStr)}
                className="text-[10px] text-amber-400/80 hover:text-amber-300 hover:underline font-medium"
              >
                + Agendar
              </button>
            </div>

            {meetings.map(meet => (
              <DraggableMeeting key={meet.id} meeting={meet} dateLabel={`${dayName} ${shortDate}`} dndScope={dndScope} disabled={!dndEnabled}>
              {({ setNodeRef: setMeetRef, cardProps, handleProps, isDragging: meetDragging }) => (
              <div
                ref={setMeetRef}
                {...cardProps}
                {...handleProps}
                aria-label={`Reunión ${meet.title}. Mantené apretado para moverla de día.`}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('button') || target.closest('a')) return;
                  onSelectItem?.({ type: 'reunion', data: meet });
                }}
                className={`p-2.5 rounded-xl border transition cursor-grab active:cursor-grabbing select-none ${meetDragging ? 'opacity-40' : ''} ${
                  meet.completed
                    ? 'bg-zinc-950/40 border-zinc-800/60 opacity-60'
                    : 'bg-zinc-950 border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-900/50'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticFeedback.selection();
                        if (!meet.completed) {
                          playTaskDone();
                          fireTaskCelebration(0.5, 0.4);
                        }
                        onToggleMeeting(meet.id);
                      }}
                      className="mt-0.5 text-zinc-500 hover:text-emerald-400 transition shrink-0 t-press cursor-pointer"
                      title={meet.completed ? 'Marcar como pendiente' : 'Marcar como realizada'}
                    >
                      {meet.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 t-success-pop" />
                      ) : (
                        <Circle className="w-4 h-4 text-amber-400" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-semibold leading-snug ${
                        meet.completed ? 'line-through text-zinc-400' : 'text-zinc-100'
                      }`}>
                        {meet.title}
                      </div>

                      {meet.time && (
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <div className="flex items-center gap-1 text-[10px] text-amber-400">
                            <Clock className="w-3 h-3" />
                            <span>{meet.time} hs</span>
                          </div>

                          {meet.reminderMinutesBefore !== undefined && (
                            <div className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded-md" title="Recordatorio programado">
                              <Bell className="w-2.5 h-2.5 text-amber-400" />
                              <span>
                                {meet.reminderMinutesBefore === 0
                                  ? 'Aviso puntual'
                                  : `${meet.reminderMinutesBefore}m antes`}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {meet.projectName && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md max-w-[200px] truncate">
                            <FolderKanban className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{meet.projectName}</span>
                          </span>
                        </div>
                      )}

                      {meet.notes && (
                        <p className="text-[11px] text-zinc-400 mt-1 leading-tight bg-zinc-900/90 p-1.5 rounded-lg border border-zinc-800/60">
                          {meet.notes}
                        </p>
                      )}

                      {/* Direct Phone / WhatsApp action */}
                      {(() => {
                        const phone = meet.clientPhone || extractPhoneFromText(meet.notes || '');
                        if (!phone) return null;
                        return (
                          <div className="flex items-center gap-1.5 mt-2">
                            <a
                              href={formatWhatsAppUrl(phone, `Hola ${meet.title}, te contacto por nuestra reunión.`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.stopPropagation();
                                hapticFeedback.light();
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold transition active:scale-95"
                              title="Escribir por WhatsApp"
                            >
                              <MessageCircle className="w-2.5 h-2.5" />
                              <span>WhatsApp</span>
                            </a>
                            <a
                              href={formatTelUrl(phone)}
                              onClick={(e) => {
                                e.stopPropagation();
                                hapticFeedback.light();
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold transition active:scale-95"
                              title="Llamar directamente"
                            >
                              <Phone className="w-2.5 h-2.5" />
                              <span>Llamar</span>
                            </a>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Move, Calendar Sync & Delete */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticFeedback.light();
                        generateCalendarICS({
                          title: `Reunión: ${meet.title}`,
                          description: [
                            meet.projectName ? `Proyecto: ${meet.projectName}` : '',
                            meet.clientPhone ? `Tel/WhatsApp: ${meet.clientPhone}` : '',
                            meet.notes ? `Notas: ${meet.notes}` : '',
                          ].filter(Boolean).join('\n') || 'Reunión .Cero CRM',
                          date: meet.date,
                          time: meet.time,
                          alarmMinutesBefore: meet.reminderMinutesBefore !== undefined ? meet.reminderMinutesBefore : 15,
                        });
                      }}
                      className="p-1 rounded text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition text-[10px]"
                      title="Añadir a Calendario / Recordatorios de iPhone"
                    >
                      <CalendarCheck className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveMeetingDate(meet.id, tomorrowStr);
                      }}
                      className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition text-[10px]"
                      title="Mover a mañana"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteMeeting(meet.id);
                      }}
                      className="p-1 rounded text-zinc-600 hover:text-red-400 transition"
                      title="Eliminar reunión"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
              )}
              </DraggableMeeting>
            ))}
          </div>
        ) : (
          <div className="mb-2.5">
            <button
              onClick={() => onOpenQuickAdd('reunion', dateStr)}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-zinc-800/80 hover:border-amber-500/40 text-zinc-400 hover:text-amber-300 text-[11px] flex items-center justify-between group transition active:scale-98"
            >
              <span className="flex items-center gap-1.5 group-hover:text-amber-300">
                <Calendar className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400" />
                <span>Sin reuniones agendadas</span>
              </span>
              <span className="text-[10px] font-semibold text-amber-400/80 group-hover:text-amber-300">
                + Agendar
              </span>
            </button>
          </div>
        )}

        {/* Tasks Section with Touch Swipe Gestures & Drag Reorder */}
        {tasks.length > 0 ? (
          <div className="space-y-1.5">
            {meetings.length > 0 && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center justify-between px-1 pt-1">
                <div className="flex items-center gap-1">
                  <CheckSquare className="w-3 h-3" />
                  <span>Tareas ({tasks.length})</span>
                </div>
                {tasks.length > 1 && onReorderTasks && (
                  <span className="text-[9px] text-zinc-500 font-medium flex items-center gap-1">
                    <GripVertical className="w-3 h-3 text-zinc-500" />
                    <span>Mantené apretado para mover</span>
                  </span>
                )}
              </div>
            )}

            <SortableContext items={tasks.map(t => `${dndScope}|${t.id}`)} strategy={verticalListSortingStrategy} disabled={!dndEnabled}>
            {tasks.map((task) => {
              return (
                <SwipeableTaskItem
                  key={task.id}
                  task={task}
                  projects={projects}
                  missions={missions}
                  tomorrowStr={tomorrowStr}
                  dateLabel={`${dayName} ${shortDate}`}
                  dndScope={dndScope}
                  onToggleTask={onToggleTask}
                  onMoveTaskDate={onMoveTaskDate}
                  onDeleteTask={onDeleteTask}
                  onToggleSubtask={onToggleSubtask}
                  onAddSubtask={onAddSubtask}
                  onDeleteSubtask={onDeleteSubtask}
                  onSelectItem={onSelectItem}
                />
              );
            })}
            </SortableContext>
          </div>
        ) : (
          meetings.length === 0 && (
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
              <div className="w-11 h-11 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-2.5 shadow-inner">
                <Calendar className="w-5 h-5 stroke-[1.75]" />
              </div>
              <h4 className="text-sm font-bold text-zinc-200">
                Sin pendientes para este día
              </h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-[220px] leading-relaxed">
                No hay tareas ni reuniones agendadas.
              </p>
            </div>
          )
        )}
      </div>

      {/* Bottom quick actions */}
      <div className="p-2 border-t border-zinc-800/60 bg-zinc-950/40 flex items-center justify-between text-[11px]">
        <button
          onClick={() => onOpenQuickAdd('tarea', dateStr)}
          className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-medium transition py-1 px-2"
        >
          <Plus className="w-3 h-3" />
          <span>Tarea</span>
        </button>

        <button
          onClick={() => onOpenQuickAdd('reunion', dateStr)}
          className="text-amber-400/90 hover:text-amber-300 flex items-center gap-1 font-medium transition py-1 px-2"
        >
          <Plus className="w-3 h-3" />
          <span>Reunión</span>
        </button>
      </div>
    </div>
  );
};

// Subcomponent: Swipeable Task Card with mobile touch gestures & nested subtasks
interface SwipeableTaskItemProps {
  task: AgendaTask;
  projects?: Project[];
  missions?: WeeklyMission[];
  tomorrowStr: string;
  dateLabel?: string;
  dndScope: string;
  onToggleTask: (id: string) => void;
  onMoveTaskDate: (id: string, targetDate: string) => void;
  onDeleteTask: (id: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onAddSubtask?: (taskId: string, title: string) => void;
  onDeleteSubtask?: (taskId: string, subtaskId: string) => void;
  onSelectItem?: (item: { type: 'tarea' | 'reunion'; data: AgendaTask | AgendaMeeting }) => void;
}

const SwipeableTaskItem: React.FC<SwipeableTaskItemProps> = ({
  task,
  projects = [],
  missions = [],
  tomorrowStr,
  dateLabel,
  dndScope,
  onToggleTask,
  onMoveTaskDate,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  onSelectItem,
}) => {
  const {
    setNodeRef: setSortRef,
    attributes: sortAttributes,
    listeners: sortListeners,
    transform: sortTransform,
    transition: sortTransition,
    isDragging,
  } = useSortable({
    id: `${dndScope}|${task.id}`,
    data: { type: 'tarea', id: task.id, date: task.date, title: task.title, label: dateLabel ? `${task.title}, ${dateLabel}` : task.title },
  });

  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  // Si este toque terminó siendo un arrastre, el deslizamiento (hecha / mañana) no debe dispararse
  const dragActivatedRef = useRef(false);
  useEffect(() => {
    if (isDragging) {
      dragActivatedRef.current = true;
      setOffsetX(0);
    }
  }, [isDragging]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);

  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const totalSubtasks = subtasks.length;
  const hasSubtasks = totalSubtasks > 0;
  const allSubtasksDone = hasSubtasks && completedSubtasks === totalSubtasks;

  const catCfg = getTaskCategoryConfig(task);
  const CatIcon = catCfg.icon;

  const handleTouchStart = (e: React.TouchEvent) => {
    // Guard against swiping when tapping inside buttons, inputs, or the subtasks section
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('.no-swipe')) {
      return;
    }

    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    dragActivatedRef.current = false;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || dragActivatedRef.current) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startXRef.current;
    const diffY = currentY - startYRef.current;

    // Detect horizontal swipe vs vertical scroll
    if (isHorizontalRef.current === null) {
      if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
        isHorizontalRef.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    if (isHorizontalRef.current) {
      // Dampen drag
      const maxDrag = 90;
      const clamped = Math.max(-maxDrag, Math.min(maxDrag, diffX));
      setOffsetX(clamped);
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    const threshold = 55;
    if (dragActivatedRef.current) {
      setOffsetX(0);
      isHorizontalRef.current = null;
      return;
    }

    if (offsetX > threshold) {
      // Swiped Right -> Toggle Done
      onToggleTask(task.id);
    } else if (offsetX < -threshold) {
      // Swiped Left -> Postpone to Tomorrow
      onMoveTaskDate(task.id, tomorrowStr);
    }

    setOffsetX(0);
    isHorizontalRef.current = null;
  };

  const handleCreateSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !onAddSubtask) return;
    onAddSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
    setShowAddForm(false);
    setIsExpanded(true);
  };

  // Determine feedback background style based on swipe direction
  const isSwipingRight = offsetX > 15;
  const isSwipingLeft = offsetX < -15;

  return (
    <div
      ref={setSortRef}
      data-task-id={task.id}
      style={{ transform: CSS.Translate.toString(sortTransform), transition: sortTransition }}
      className={`relative rounded-xl touch-pan-y ${isDragging ? 'z-20' : ''}`}
    >

      {/* Background layer revealed during swipe */}
      <div
        className={`absolute inset-0 flex items-center justify-between px-3 rounded-xl overflow-hidden transition-colors duration-150 ${
          isSwipingRight
            ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-600/40'
            : isSwipingLeft
            ? 'bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40'
            : 'bg-transparent'
        }`}
      >
        {/* Left icon: Done (Swipe right) */}
        <div className={`flex items-center gap-1 text-xs font-bold ${isSwipingRight ? 'opacity-100' : 'opacity-0'}`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{task.completed ? 'Pendiente' : 'Hecha'}</span>
        </div>

        {/* Right icon: Tomorrow (Swipe left) */}
        <div className={`flex items-center gap-1 text-xs font-bold ml-auto ${isSwipingLeft ? 'opacity-100' : 'opacity-0'}`}>
          <span>Mañana</span>
          <ArrowRight className="w-4 h-4 text-[var(--accent)]" />
        </div>
      </div>

      {/* Foreground Task Card */}
      <div
        onMouseDown={sortListeners?.onMouseDown as React.MouseEventHandler<HTMLDivElement> | undefined}
        onTouchStart={(e) => {
          // mantener apretado = arrastrar (dnd-kit); deslizar = hecha / mañana
          sortListeners?.onTouchStart?.(e);
          handleTouchStart(e);
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button') || target.closest('input') || target.closest('a') || target.closest('.no-swipe')) {
            return;
          }
          onSelectItem?.({ type: 'tarea', data: task });
        }}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className={`relative z-10 group p-2.5 rounded-xl border transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] cursor-grab active:cursor-grabbing select-none ${
          isDragging
            ? 'opacity-40 border-dashed border-[var(--accent)]/60 bg-[var(--accent)]/5'
            : task.completed
            ? 'bg-zinc-950/70 border-zinc-800/50 opacity-60'
            : `${catCfg.cardBg} ${catCfg.cardBorder} ${catCfg.cardBorderHover}`
        }`}
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            {/* Grip handle for reordering (Desktop drag + mobile touch) */}
            <div
              {...sortAttributes}
              onKeyDown={sortListeners?.onKeyDown as React.KeyboardEventHandler<HTMLDivElement> | undefined}
              aria-label={`Mover tarea: ${task.title}`}
              className="no-swipe select-none p-0.5 mt-0.5 text-zinc-600 hover:text-zinc-300 active:text-[var(--accent)] cursor-grab active:cursor-grabbing rounded hover:bg-zinc-800/80 transition flex items-center justify-center shrink-0"
              title="Mover (mantené apretado o usá el teclado)"
            >
              <GripVertical className="w-3.5 h-3.5" aria-hidden />
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                hapticFeedback.selection();
                if (!task.completed) {
                  playTaskDone();
                  fireTaskCelebration(0.5, 0.4);
                }
                onToggleTask(task.id);
              }}
              className="mt-0.5 text-zinc-500 hover:text-[var(--accent)] transition shrink-0 t-press cursor-pointer"
              title={task.completed ? 'Marcar como pendiente' : 'Marcar como hecha'}
            >
              {task.completed ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--accent)] t-success-pop" />
              ) : (
                <Circle className="w-4 h-4 text-zinc-500 hover:text-zinc-300" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span
                  className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md border ${catCfg.badgeBg} ${catCfg.badgeText} ${catCfg.badgeBorder}`}
                  title={`Categoría: ${catCfg.label}`}
                >
                  <CatIcon className="w-2.5 h-2.5" />
                  <span>{catCfg.label}</span>
                </span>

                {task.priority && task.priority !== 'media' && (
                  <span
                    className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${TASK_PRIORITIES[task.priority].badge}`}
                    title={`Prioridad: ${TASK_PRIORITIES[task.priority].label}`}
                  >
                    {TASK_PRIORITIES[task.priority].label}
                  </span>
                )}
              </div>

              <div className={`text-xs leading-snug font-medium ${
                task.completed ? 'line-through text-zinc-500' : 'text-zinc-200'
              }`}>
                {task.title}
              </div>

              {task.time && (
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                    <Clock className="w-3 h-3" />
                    <span>{task.time} hs</span>
                  </div>

                  {task.reminderMinutesBefore !== undefined && (
                    <div className="inline-flex items-center gap-1 text-[9px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-1.5 py-0.2 rounded-md" title="Recordatorio programado">
                      <Bell className="w-2.5 h-2.5 text-[var(--accent)]" />
                      <span>
                        {task.reminderMinutesBefore === 0
                          ? 'Aviso puntual'
                          : `${task.reminderMinutesBefore}m antes`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {(() => {
                const displayProjectName = task.projectName || (projects.length > 0 ? resolveTaskProject(task, projects)?.clientName : undefined);
                if (!displayProjectName) return null;
                return (
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-1.5 py-0.5 rounded-md max-w-[200px] truncate">
                      <FolderKanban className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{displayProjectName}</span>
                    </span>
                  </div>
                );
              })()}

              {/* Misión Vinculada */}
              {(() => {
                if (task.missionId) {
                  const mLinked = (missions || []).find(m => m.id === task.missionId);
                  if (mLinked) {
                    const cfg = FRENTE_CONFIG[mLinked.frente || 'Otros'];
                    return (
                      <div className="mt-1">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.color} border ${cfg.border} max-w-[200px] truncate`}>
                          <Target className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{mLinked.title}</span>
                        </span>
                      </div>
                    );
                  }
                }
                return (
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1 text-[8.5px] font-medium text-zinc-500 bg-zinc-900/60 border border-zinc-800/80 px-1.5 py-0.2 rounded-md" title="Tarea sin misión asignada">
                      <span>Suelto</span>
                    </span>
                  </div>
                );
              })()}

              {/* Subtasks Summary & Triggers */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {hasSubtasks ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsExpanded(prev => !prev)}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition active:scale-95 ${
                        allSubtasksDone
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                      }`}
                      title={isExpanded ? 'Ocultar subtareas' : 'Ver subtareas'}
                    >
                      <ListTodo className="w-3 h-3 text-[var(--accent)]" />
                      <span>{completedSubtasks}/{totalSubtasks}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-zinc-500" />
                      )}
                    </button>

                    {/* Visual Progress Bar */}
                    <div className="w-14 bg-zinc-800/80 h-1.5 rounded-full overflow-hidden shrink-0">
                      <div
                        className={`h-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300 ${
                          allSubtasksDone ? 'bg-emerald-500' : 'bg-[var(--accent)]'
                        }`}
                        style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                      />
                    </div>
                  </>
                ) : (
                  !showAddForm && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(true);
                        setIsExpanded(true);
                      }}
                      className="text-[10px] text-zinc-500 hover:text-[var(--accent)] transition flex items-center gap-0.5 opacity-70 group-hover:opacity-100"
                      title="Agregar subtarea"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Subtarea</span>
                    </button>
                  )
                )}

                {hasSubtasks && !isExpanded && !showAddForm && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(true);
                      setIsExpanded(true);
                    }}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 transition flex items-center gap-0.5"
                    title="Agregar otra subtarea"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Fallback Action Buttons */}
          <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100">
            <button
              onClick={() => {
                hapticFeedback.light();
                const projName = task.projectName || (projects.length > 0 ? resolveTaskProject(task, projects)?.clientName : undefined);
                generateCalendarICS({
                  title: task.title,
                  description: projName ? `Proyecto: ${projName}` : 'Tarea .Cero CRM',
                  date: task.date,
                  time: task.time,
                  alarmMinutesBefore: task.reminderMinutesBefore !== undefined ? task.reminderMinutesBefore : 15,
                });
              }}
              className="p-1 rounded text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 transition"
              title="Añadir a Calendario / Recordatorios de iPhone"
            >
              <CalendarCheck className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                hapticFeedback.light();
                onMoveTaskDate(task.id, tomorrowStr);
              }}
              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
              title="Mover a mañana"
            >
              <ArrowRight className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                hapticFeedback.warning();
                onDeleteTask(task.id);
              }}
              className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
              title="Eliminar tarea"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Expanded Subtasks Panel */}
        {isExpanded && (
          <div className="no-swipe mt-2.5 pt-2 border-t border-zinc-800/80 space-y-1.5 pl-6 pr-1">
            {subtasks.map(sub => (
              <div
                key={sub.id}
                className="flex items-center justify-between gap-2 group/sub py-0.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    if (!sub.completed) {
                      playTaskDone();
                      if (completedSubtasks + 1 >= totalSubtasks) {
                        fireTaskCelebration(0.5, 0.4);
                      }
                    }
                    onToggleSubtask && onToggleSubtask(task.id, sub.id);
                  }}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition shrink-0 ${
                    sub.completed
                      ? 'bg-[var(--accent)] border-[var(--accent)] text-white t-success-pop'
                      : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
                  }`}>
                    {sub.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className={`text-[11px] leading-tight truncate ${
                    sub.completed ? 'line-through text-zinc-500' : 'text-zinc-300'
                  }`}>
                    {sub.title}
                  </span>
                </button>

                {onDeleteSubtask && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      hapticFeedback.light();
                      onDeleteSubtask(task.id, sub.id);
                    }}
                    className="p-1 text-zinc-500 hover:text-red-400 opacity-60 group-hover/sub:opacity-100 transition rounded cursor-pointer"
                    title="Eliminar subtarea"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Form to add another subtask */}
            {showAddForm ? (
              <form onSubmit={handleCreateSubtask} className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="Nueva subtarea…"
                  value={newSubtaskTitle}
                  onChange={e => setNewSubtaskTitle(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="submit"
                  disabled={!newSubtaskTitle.trim()}
                  className="px-2 py-1 rounded-lg bg-[var(--accent)] hover:bg-[#d04e0a] text-white text-[10px] font-bold transition disabled:opacity-40"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewSubtaskTitle('');
                  }}
                  className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 transition"
                  title="Cancelar"
                >
                  <X className="w-3 h-3" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="text-[11px] text-zinc-400 hover:text-[var(--accent)] flex items-center gap-1 pt-1 transition font-medium"
              >
                <Plus className="w-3 h-3" />
                <span>Agregar subtarea</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
