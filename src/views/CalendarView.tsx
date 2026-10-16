import React, { useState, useMemo } from 'react';
import { 
  AgendaTask, 
  AgendaMeeting, 
  Project, 
  IncomeRecord, 
  ProjectInstallment,
  StudioFixedExpense 
} from '../types';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  Circle, 
  DollarSign, 
  FolderKanban, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Check, 
  X, 
  Phone, 
  MessageCircle, 
  Flag, 
  Sparkles, 
  TrendingUp, 
  ArrowUpRight, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Layers, 
  List, 
  CalendarDays, 
  ExternalLink,
  Target,
  Trash2
} from 'lucide-react';
import { 
  getTodayString, 
  formatDayName, 
  formatShortDay, 
  addDays, 
  getMonthKey 
} from '../utils/storage';
import { toSafeDateString } from '../utils/dates';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { formatWhatsAppUrl, formatTelUrl } from '../utils/contact';
import { generateBatchCalendarICS, generateCalendarICS } from '../utils/calendarIcs';
import { resolveTaskProject } from '../utils/taskProject';
import { ModalPortal } from '../components/ModalPortal';

export type CalendarEventType = 'tarea' | 'reunion' | 'cobro' | 'entrega' | 'inicio' | 'seguimiento';

export interface UnifiedCalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  completed: boolean;
  amount?: number;
  currency?: 'USD' | 'ARS';
  projectId?: string;
  projectName?: string;
  phone?: string;
  notes?: string;
  rawItem?: any;
}

interface CalendarViewProps {
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects: Project[];
  incomes: IncomeRecord[];
  studioFixedExpenses?: StudioFixedExpense[];
  privacyMode?: boolean;
  onToggleTask: (id: string) => void;
  onToggleMeeting: (id: string) => void;
  onDeleteTask?: (id: string) => void;
  onDeleteMeeting?: (id: string) => void;
  onToggleIncomeStatus?: (incomeId: string) => void;
  onOpenProject360?: (project: Project) => void;
  onOpenQuickAdd: (type?: any, date?: string) => void;
  onNavigate?: (path: string) => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  meetings,
  projects,
  incomes,
  studioFixedExpenses = [],
  privacyMode = false,
  onToggleTask,
  onToggleMeeting,
  onDeleteTask,
  onDeleteMeeting,
  onToggleIncomeStatus = () => {},
  onOpenProject360,
  onOpenQuickAdd,
  onNavigate,
}) => {
  const todayStr = getTodayString();
  const [todayYear, todayMonth] = todayStr.split('-').map(Number);

  // Active month & year view
  const [currentYear, setCurrentYear] = useState<number>(todayYear);
  const [currentMonth, setCurrentMonth] = useState<number>(todayMonth); // 1-12

  // View modes: 'mes' | 'semana' | 'lista'
  const [viewMode, setViewMode] = useState<'mes' | 'semana' | 'lista'>('mes');

  // Selected date for day details drawer
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isDayDrawerOpen, setIsDayDrawerOpen] = useState<boolean>(false);

  // Filters
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendientes' | 'completados'>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Month navigation helpers
  const handlePrevMonth = () => {
    hapticFeedback.light();
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    hapticFeedback.light();
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleGoToday = () => {
    hapticFeedback.selection();
    setCurrentYear(todayYear);
    setCurrentMonth(todayMonth);
    setSelectedDate(todayStr);
  };

  // Compile Unified Calendar Events from all app sources
  const allEvents = useMemo<UnifiedCalendarEvent[]>(() => {
    const list: UnifiedCalendarEvent[] = [];

    // 1. Tareas (Tasks)
    tasks.forEach(t => {
      const matchedProj = resolveTaskProject(t, projects);
      list.push({
        id: `task_${t.id}`,
        type: 'tarea',
        title: t.title,
        date: t.date,
        time: t.time,
        completed: t.completed,
        projectId: matchedProj ? matchedProj.id : t.projectId,
        projectName: matchedProj ? matchedProj.clientName : t.projectName,
        rawItem: t,
      });
    });

    // 2. Reuniones (Meetings)
    meetings.forEach(m => {
      list.push({
        id: `meeting_${m.id}`,
        type: 'reunion',
        title: m.title,
        date: m.date,
        time: m.time,
        completed: m.completed,
        projectId: m.projectId,
        projectName: m.projectName,
        phone: m.clientPhone,
        notes: m.notes,
        rawItem: m,
      });
    });

    // 3. Cobros / Ingresos registrados
    incomes.forEach(inc => {
      list.push({
        id: `income_${inc.id}`,
        type: 'cobro',
        title: inc.title,
        date: inc.date,
        completed: inc.status === 'cobrado',
        amount: inc.amount,
        currency: inc.currency,
        projectId: inc.projectId,
        projectName: inc.projectName,
        rawItem: inc,
      });
    });

    // 4. Proyectos: Cuotas acordadas / Installments
    projects.forEach(p => {
      if (p.archived) return;

      // Project Installments (Cuotas fijas)
      if (p.installments && p.installments.length > 0) {
        p.installments.forEach(inst => {
          list.push({
            id: `installment_${p.id}_${inst.id}`,
            type: 'cobro',
            title: `Cuota ${inst.number}: ${p.clientName}${inst.note ? ` (${inst.note})` : ''}`,
            date: inst.dueDate,
            completed: !!inst.paid,
            amount: inst.amount,
            currency: inst.currency || p.estimatedCurrency || 'USD',
            projectId: p.id,
            projectName: p.clientName,
            phone: p.clientPhone,
            rawItem: inst,
          });
        });
      }

      // Proyectos por iniciar (Start Date)
      const startDate = p.startDate || p.pafStartDate;
      if (startDate) {
        list.push({
          id: `start_${p.id}`,
          type: 'inicio',
          title: `Inicio de aceleración: ${p.clientName}`,
          date: startDate,
          completed: p.status === 'Entregado',
          projectId: p.id,
          projectName: p.clientName,
          phone: p.clientPhone,
          notes: p.notes,
          rawItem: p,
        });
      }

      // Proyectos por finalizar / Entregas estimadas (Delivery Date)
      if (p.deliveryDate) {
        list.push({
          id: `delivery_${p.id}`,
          type: 'entrega',
          title: `Entrega / Fin de programa: ${p.clientName}`,
          date: p.deliveryDate,
          completed: p.status === 'Entregado',
          projectId: p.id,
          projectName: p.clientName,
          phone: p.clientPhone,
          notes: p.notes,
          rawItem: p,
        });
      }

      // Sesiones de consultoría PAF
      if (p.consultingSessions && p.consultingSessions.length > 0) {
        p.consultingSessions.forEach(sess => {
          if (sess.date) {
            list.push({
              id: `session_${p.id}_${sess.id}`,
              type: 'reunion',
              title: `Sesión 1:1: ${p.clientName}${sess.topic || sess.topics ? ` - ${sess.topic || sess.topics}` : ''}`,
              date: sess.date,
              time: sess.time,
              completed: !!sess.completed,
              projectId: p.id,
              projectName: p.clientName,
              phone: p.clientPhone,
              notes: sess.notes,
              rawItem: sess,
            });
          }
        });
      }

      // Seguimientos (Leads activos con notas o fechas)
      if (p.isLead && (p.updatedAt || p.createdAt)) {
        const leadDate = toSafeDateString(p.updatedAt || p.createdAt);
        if (leadDate) {
          list.push({
            id: `lead_followup_${p.id}`,
            type: 'seguimiento',
            title: `Seguimiento comercial: ${p.clientName}`,
            date: leadDate,
            completed: p.status === 'Entregado' || p.status === 'No concretado',
            projectId: p.id,
            projectName: p.clientName,
            phone: p.clientPhone,
            notes: p.notes,
            rawItem: p,
          });
        }
      }
    });

    // 5. Gastos Fijos, Dominios de clientes y Hosting (Vencimientos)
    studioFixedExpenses.filter(e => e.active && e.nextDueDate).forEach(fe => {
      const categoryTag = fe.category === 'dominios' ? '🌐 Dominio' : fe.category === 'hosting' ? '⚡ Hosting' : fe.category === 'ia' ? '🤖 IA' : '📦 Servicio';
      list.push({
        id: `fixed_expense_${fe.id}`,
        type: 'cobro',
        title: `${categoryTag}: ${fe.name}${fe.clientName ? ` (${fe.clientName})` : ''}`,
        date: fe.nextDueDate,
        completed: false,
        amount: fe.amount,
        currency: fe.currency,
        projectId: fe.projectId,
        projectName: fe.clientName,
        notes: fe.notes,
        rawItem: fe,
      });
    });

    return list;
  }, [tasks, meetings, projects, incomes, studioFixedExpenses]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return allEvents.filter(ev => {
      // Type filter
      if (selectedTypeFilter !== 'todos' && ev.type !== selectedTypeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'pendientes' && ev.completed) {
        return false;
      }
      if (statusFilter === 'completados' && !ev.completed) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesProject = ev.projectName?.toLowerCase().includes(q);
        const matchesNotes = ev.notes?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesProject && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [allEvents, selectedTypeFilter, statusFilter, searchQuery]);

  // Map events by Date (YYYY-MM-DD) for fast lookup
  const eventsByDate = useMemo(() => {
    const map = new Map<string, UnifiedCalendarEvent[]>();
    filteredEvents.forEach(ev => {
      const existing = map.get(ev.date) || [];
      existing.push(ev);
      map.set(ev.date, existing);
    });
    return map;
  }, [filteredEvents]);

  // Month stats / KPIs for top summary banner
  const monthStats = useMemo(() => {
    const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const monthEvents = allEvents.filter(ev => ev.date.startsWith(currentMonthKey));

    let cobrosUSDTotal = 0;
    let cobrosUSDCobrado = 0;
    let cobrosARSTotal = 0;
    let cobrosARSCobrado = 0;

    let tasksTotal = 0;
    let tasksDone = 0;
    let meetingsTotal = 0;
    let entregasTotal = 0;
    let iniciosTotal = 0;

    monthEvents.forEach(ev => {
      if (ev.type === 'cobro' && ev.amount) {
        if (ev.currency === 'USD') {
          cobrosUSDTotal += ev.amount;
          if (ev.completed) cobrosUSDCobrado += ev.amount;
        } else {
          cobrosARSTotal += ev.amount;
          if (ev.completed) cobrosARSCobrado += ev.amount;
        }
      } else if (ev.type === 'tarea') {
        tasksTotal += 1;
        if (ev.completed) tasksDone += 1;
      } else if (ev.type === 'reunion') {
        meetingsTotal += 1;
      } else if (ev.type === 'entrega') {
        entregasTotal += 1;
      } else if (ev.type === 'inicio') {
        iniciosTotal += 1;
      }
    });

    return {
      cobrosUSDTotal,
      cobrosUSDCobrado,
      cobrosARSTotal,
      cobrosARSCobrado,
      tasksTotal,
      tasksDone,
      meetingsTotal,
      entregasTotal,
      iniciosTotal,
      totalEvents: monthEvents.length,
    };
  }, [allEvents, currentYear, currentMonth]);

  // Generate calendar grid days for the selected month
  const calendarDays = useMemo(() => {
    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isWeekend: boolean;
    }> = [];

    // First day of current month
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    // Number of days in current month
    const totalDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    // Day of week for 1st of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
    let startDayOfWeek = firstDay.getDay(); // 0-6
    // Shift so Monday is 0 and Sunday is 6
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    // Days from previous month to fill the first row
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevMonthNum = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYearNum = currentMonth === 1 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(prevYearNum, prevMonthNum - 1, d);
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;

      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend,
      });
    }

    // Days of current month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(currentYear, currentMonth - 1, d);
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;

      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isWeekend,
      });
    }

    // Days from next month to complete standard 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonthNum = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYearNum = currentMonth === 12 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYearNum}-${String(nextMonthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(nextYearNum, nextMonthNum - 1, d);
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;

      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend,
      });
    }

    return days;
  }, [currentYear, currentMonth, todayStr]);

  // Events of currently selected day
  const selectedDayEvents = useMemo(() => {
    return eventsByDate.get(selectedDate) || [];
  }, [eventsByDate, selectedDate]);

  // Format currency helpers
  const formatMoney = (amount?: number, currency: 'USD' | 'ARS' = 'USD') => {
    if (amount === undefined || amount === null) return '';
    if (privacyMode) return '$ ••••••';
    if (currency === 'USD') return `$ ${amount.toLocaleString('es-AR')} USD`;
    return `$ ${amount.toLocaleString('es-AR')}`;
  };

  const formatDateHeading = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length < 3) return dateStr;
      const d = parseInt(parts[2], 10);
      const m = parseInt(parts[1], 10);
      const dayName = formatDayName(dateStr);
      const monthName = MONTH_NAMES[m - 1] || '';
      return `${dayName} ${d} de ${monthName}`;
    } catch {
      return dateStr;
    }
  };

  // Badge stylings by event type
  const getEventTypeConfig = (type: CalendarEventType) => {
    switch (type) {
      case 'tarea':
        return {
          label: 'Tarea',
          bg: 'bg-[#E8590C]/15 border-[#E8590C]/40 text-orange-300',
          badge: 'bg-[#E8590C]/20 border-[#E8590C]/40 text-[#E8590C]',
          dot: 'bg-[#E8590C]',
          icon: CheckCircle2,
        };
      case 'reunion':
        return {
          label: 'Reunión',
          bg: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
          badge: 'bg-sky-500/20 border-sky-500/40 text-sky-400',
          dot: 'bg-sky-400',
          icon: CalendarIcon,
        };
      case 'cobro':
        return {
          label: 'Cobro',
          bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
          badge: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
          dot: 'bg-emerald-400',
          icon: DollarSign,
        };
      case 'entrega':
        return {
          label: 'Entrega',
          bg: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
          badge: 'bg-rose-500/20 border-rose-500/40 text-rose-400',
          dot: 'bg-rose-400',
          icon: Flag,
        };
      case 'inicio':
        return {
          label: 'Inicio',
          bg: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
          badge: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
          dot: 'bg-amber-400',
          icon: Sparkles,
        };
      case 'seguimiento':
        return {
          label: 'Seguimiento',
          bg: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300',
          badge: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400',
          dot: 'bg-indigo-400',
          icon: Target,
        };
      default:
        return {
          label: 'Evento',
          bg: 'bg-zinc-800 border-zinc-700 text-zinc-300',
          badge: 'bg-zinc-800 border-zinc-700 text-zinc-300',
          dot: 'bg-zinc-400',
          icon: CalendarIcon,
        };
    }
  };

  const handleToggleComplete = (ev: UnifiedCalendarEvent) => {
    hapticFeedback.light();
    if (ev.type === 'tarea' && ev.rawItem?.id) {
      onToggleTask(ev.rawItem.id);
      playTaskDone();
    } else if (ev.type === 'reunion' && ev.rawItem?.id) {
      onToggleMeeting(ev.rawItem.id);
      playTaskDone();
    } else if (ev.type === 'cobro' && ev.rawItem?.id && onToggleIncomeStatus) {
      onToggleIncomeStatus(ev.rawItem.id);
    }
  };

  // Export Month to Apple/Google Calendar (.ics)
  const handleExportMonthICS = () => {
    hapticFeedback.medium();
    const monthName = MONTH_NAMES[currentMonth - 1];
    const exportable = filteredEvents.filter(ev => {
      const [y, m] = ev.date.split('-').map(Number);
      return y === currentYear && m === currentMonth;
    }).map(ev => ({
      title: `[${getEventTypeConfig(ev.type).label}] ${ev.title}`,
      description: [
        ev.projectName ? `Proyecto: ${ev.projectName}` : '',
        ev.amount ? `Monto: ${formatMoney(ev.amount, ev.currency)}` : '',
        ev.phone ? `Tel: ${ev.phone}` : '',
        ev.notes ? `Notas: ${ev.notes}` : '',
      ].filter(Boolean).join('\n'),
      date: ev.date,
      time: ev.time,
      alarmMinutesBefore: 15,
    }));

    if (exportable.length === 0) {
      alert('No hay eventos registrados en este mes para exportar.');
      return;
    }

    generateBatchCalendarICS(exportable, `Eventos_${monthName}_${currentYear}`);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-150 pb-20">
      
      {/* 1. Header & Control Bar */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 sm:p-5 shadow-xl backdrop-blur-xs space-y-3 max-w-full overflow-hidden">
        {/* Main Header Layout: Responsive Desktop vs Mobile */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-3">
          
          {/* Top Row on Mobile / Left on Desktop: Month Title, Fast Nav & Quick Add */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2 min-w-0">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#E8590C]/15 border border-[#E8590C]/30 flex items-center justify-center text-[#E8590C] shrink-0">
                <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex items-center gap-1.5">
                <h1 className="text-sm sm:text-lg md:text-xl font-extrabold text-white tracking-tight truncate capitalize">
                  {MONTH_NAMES[currentMonth - 1]} {currentYear}
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 shrink-0">
                  {monthStats.totalEvents}
                </span>
              </div>
            </div>

            {/* Navigation Buttons: Prev / Hoy / Next */}
            <div className="flex items-center gap-0.5 bg-zinc-950 p-0.5 sm:p-1 rounded-xl border border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 sm:p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleGoToday}
                className="px-1.5 sm:px-2 py-1 text-xs font-bold text-zinc-300 hover:text-[#E8590C] hover:bg-zinc-800 rounded-lg transition cursor-pointer"
                title="Ir al día de hoy"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 sm:p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Action Controls on Desktop / Second Row on Mobile */}
          <div className="flex items-center justify-between md:justify-end gap-1.5 sm:gap-2 w-full md:w-auto min-w-0">
            {/* View Switcher: Mes / Semana / Lista */}
            <div className="flex-1 md:flex-initial flex items-center bg-zinc-950 p-0.5 sm:p-1 rounded-xl border border-zinc-800 text-xs font-semibold min-w-0">
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setViewMode('mes');
                }}
                className={`flex-1 md:flex-initial px-2 sm:px-3 py-1.5 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                  viewMode === 'mes'
                    ? 'bg-[#E8590C] text-white shadow-sm font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Mes</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setViewMode('semana');
                }}
                className={`flex-1 md:flex-initial px-2 sm:px-3 py-1.5 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                  viewMode === 'semana'
                    ? 'bg-[#E8590C] text-white shadow-sm font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Semana</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setViewMode('lista');
                }}
                className={`flex-1 md:flex-initial px-2 sm:px-3 py-1.5 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${
                  viewMode === 'lista'
                    ? 'bg-[#E8590C] text-white shadow-sm font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <List className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Lista</span>
              </button>
            </div>

            {/* Export ICS */}
            <button
              type="button"
              onClick={handleExportMonthICS}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 border border-zinc-700 transition active:scale-95 cursor-pointer shrink-0"
              title="Exportar este mes (.ics)"
            >
              <Download className="w-3.5 h-3.5 text-[#E8590C]" />
              <span className="hidden sm:inline">Exportar</span>
              <span className="text-[10px] text-zinc-400 hidden sm:inline">.ics</span>
            </button>

            {/* + Carga Rápida */}
            <button
              type="button"
              onClick={() => onOpenQuickAdd('tarea', selectedDate)}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-[#E8590C] hover:bg-[#cf4d07] text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-[#E8590C]/20 transition active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nuevo</span>
            </button>
          </div>
        </div>

        {/* Filters & Search Sub-bar */}
        <div className="pt-2.5 border-t border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-2.5 max-w-full min-w-0">
          {/* Filter Chips by Event Type */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar text-xs font-semibold min-w-0 w-full max-w-full overscroll-x-contain touch-pan-x">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'cobro', label: '💰 Cobros' },
              { id: 'tarea', label: '📋 Tareas' },
              { id: 'reunion', label: '🤝 Reuniones' },
              { id: 'entrega', label: '🚀 Entregas' },
              { id: 'inicio', label: '⚡ Inicios' },
              { id: 'seguimiento', label: '🎯 Seguimiento' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  hapticFeedback.selection();
                  setSelectedTypeFilter(f.id);
                }}
                className={`px-2.5 py-1 rounded-xl shrink-0 transition whitespace-nowrap cursor-pointer ${
                  selectedTypeFilter === f.id
                    ? 'bg-zinc-100 text-zinc-950 font-bold shadow-xs'
                    : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search and Status Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto min-w-0 max-w-full">
            <div className="relative flex-1 min-w-0 md:w-52">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar evento o cliente..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#E8590C]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-[#E8590C] shrink-0"
            >
              <option value="todos">Todos</option>
              <option value="pendientes">Pendientes</option>
              <option value="completados">Completados</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Monthly Summary KPI Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 max-w-full">
        {/* Cobros USD & ARS */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-1 min-w-0">
            <span className="flex items-center gap-1.5 truncate">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">Cobros</span>
            </span>
          </div>
          <div className="space-y-0.5 min-w-0">
            {monthStats.cobrosUSDTotal > 0 && (
              <div className="text-sm sm:text-base font-black text-white truncate">
                {formatMoney(monthStats.cobrosUSDTotal, 'USD')}
              </div>
            )}
            {monthStats.cobrosARSTotal > 0 && (
              <div className="text-xs sm:text-sm font-bold text-zinc-300 truncate">
                {formatMoney(monthStats.cobrosARSTotal, 'ARS')}
              </div>
            )}
            {monthStats.cobrosUSDTotal === 0 && monthStats.cobrosARSTotal === 0 && (
              <div className="text-xs font-bold text-zinc-500 truncate">Sin cobros</div>
            )}
          </div>
        </div>

        {/* Tareas */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-1 min-w-0">
            <span className="flex items-center gap-1.5 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="truncate">Tareas</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-400 font-mono shrink-0">
              {monthStats.tasksDone}/{monthStats.tasksTotal}
            </span>
          </div>
          <div className="text-sm sm:text-base font-black text-white truncate">
            {monthStats.tasksTotal} {monthStats.tasksTotal === 1 ? 'tarea' : 'tareas'}
          </div>
        </div>

        {/* Reuniones */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-1 min-w-0">
            <span className="flex items-center gap-1.5 truncate">
              <CalendarIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">Reuniones</span>
            </span>
          </div>
          <div className="text-sm sm:text-base font-black text-white truncate">
            {monthStats.meetingsTotal} {monthStats.meetingsTotal === 1 ? 'cita' : 'citas'}
          </div>
        </div>

        {/* Entregas & Inicios */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col justify-between shadow-xs min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-1 min-w-0">
            <span className="flex items-center gap-1.5 truncate">
              <Flag className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">Hitos</span>
            </span>
          </div>
          <div className="text-sm sm:text-base font-black text-white truncate">
            {monthStats.entregasTotal + monthStats.iniciosTotal} {monthStats.entregasTotal + monthStats.iniciosTotal === 1 ? 'hito' : 'hitos'}
          </div>
        </div>
      </div>
      {/* 3. Main Calendar View Display */}
      {viewMode === 'mes' && (
        <div className="space-y-4">
          {/* MOBILE VIEW (< sm): Interactive Mini-Calendar + Day Agenda Card */}
          <div className="sm:hidden space-y-4">
            {/* Compact Month Matrix */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 shadow-md">
              {/* Day Headers (L M X J V S D) */}
              <div className="grid grid-cols-7 text-center pb-2 text-[11px] font-bold text-zinc-500 border-b border-zinc-800/80">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="uppercase">
                    {d.slice(0, 1)}
                  </div>
                ))}
              </div>

              {/* 7-Col Matrix */}
              <div className="grid grid-cols-7 gap-1 pt-2">
                {calendarDays.map((cell) => {
                  const dayEvents = eventsByDate.get(cell.dateStr) || [];
                  const isSelected = cell.dateStr === selectedDate;
                  const hasCobro = dayEvents.some(e => e.type === 'cobro');
                  const hasMeeting = dayEvents.some(e => e.type === 'reunion');
                  const hasTask = dayEvents.some(e => e.type === 'tarea');
                  const hasEntrega = dayEvents.some(e => e.type === 'entrega');

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => {
                        hapticFeedback.light();
                        setSelectedDate(cell.dateStr);
                      }}
                      className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition cursor-pointer relative min-h-[46px] ${
                        isSelected
                          ? 'bg-[#E8590C] text-white font-extrabold shadow-sm'
                          : cell.isToday
                          ? 'bg-[#E8590C]/15 text-[#E8590C] font-bold border border-[#E8590C]/40'
                          : !cell.isCurrentMonth
                          ? 'text-zinc-600 opacity-40'
                          : 'text-zinc-300 hover:bg-zinc-800/70'
                      }`}
                    >
                      <span className="text-xs">{cell.dayNumber}</span>
                      
                      {/* Dots row */}
                      <div className="flex items-center gap-0.5 mt-1 h-1.5">
                        {hasCobro && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-400'}`} />}
                        {hasMeeting && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-sky-400'}`} />}
                        {hasEntrega && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-400'}`} />}
                        {hasTask && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-orange-400'}`} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Agenda Box */}
            <div className="bg-zinc-900/95 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#E8590C]/15 border border-[#E8590C]/30 flex items-center justify-center text-[#E8590C] font-black text-sm">
                    {selectedDate.split('-')[2]}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100">
                      Agenda del día
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      {formatDateHeading(selectedDate)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenQuickAdd('tarea', selectedDate)}
                  className="px-2.5 py-1 rounded-xl bg-[#E8590C] hover:bg-[#cf4d07] text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir</span>
                </button>
              </div>

              {/* Day Events List */}
              {(() => {
                const dayEvents = eventsByDate.get(selectedDate) || [];
                if (dayEvents.length === 0) {
                  return (
                    <div className="py-6 text-center text-zinc-500 text-xs">
                      No hay eventos ni tareas agendadas para este día.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {dayEvents.map(ev => {
                      const cfg = getEventTypeConfig(ev.type);
                      const Icon = cfg.icon;

                      return (
                        <div
                          key={ev.id}
                          className={`p-3 rounded-xl border flex items-start justify-between gap-2.5 transition ${cfg.bg} ${
                            ev.completed ? 'opacity-60 bg-zinc-950/40' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleToggleComplete(ev)}
                              className="mt-0.5 text-zinc-400 hover:text-white transition shrink-0 cursor-pointer"
                              title={ev.completed ? 'Marcar pendiente' : 'Marcar completado'}
                            >
                              {ev.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-zinc-500" />
                              )}
                            </button>

                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${cfg.badge}`}>
                                  {cfg.label}
                                </span>
                                {ev.time && (
                                  <span className="text-[10px] font-mono text-zinc-400">
                                    {ev.time}
                                  </span>
                                )}
                              </div>
                              <h4 className={`text-xs font-bold text-zinc-100 ${ev.completed ? 'line-through text-zinc-400' : ''}`}>
                                {ev.title}
                              </h4>
                              {(ev.projectName || (ev as any).clientName) && (
                                <p className="text-[11px] text-zinc-400 truncate">
                                  {ev.projectName || (ev as any).clientName}
                                </p>
                              )}
                            </div>
                          </div>

                          {ev.amount !== undefined && (
                            <div className="text-right shrink-0">
                              <span className="text-xs font-black text-emerald-400 font-mono">
                                {formatMoney(ev.amount, ev.currency)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* DESKTOP VIEW (>= sm): Full 7-column interactive calendar */}
          <div className="hidden sm:block bg-zinc-900/80 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
            {/* Day Headers (Lunes a Domingo) */}
            <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-950/70 text-center py-2.5 text-xs font-bold text-zinc-400">
              {DAY_NAMES.map((d, idx) => (
                <div 
                  key={d} 
                  className={`tracking-wider uppercase text-[11px] ${
                    idx >= 5 ? 'text-zinc-500' : 'text-zinc-300'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* 7xN Calendar Grid Cells */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-zinc-800/60 bg-zinc-950/30">
              {calendarDays.map((cell) => {
                const dayEvents = eventsByDate.get(cell.dateStr) || [];
                const isSelected = cell.dateStr === selectedDate;
                const hasCobro = dayEvents.some(e => e.type === 'cobro');
                const hasMeeting = dayEvents.some(e => e.type === 'reunion');
                const hasTask = dayEvents.some(e => e.type === 'tarea');
                const hasEntrega = dayEvents.some(e => e.type === 'entrega');

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => {
                      hapticFeedback.light();
                      setSelectedDate(cell.dateStr);
                      setIsDayDrawerOpen(true);
                    }}
                    className={`min-h-[110px] sm:min-h-[125px] p-2 flex flex-col justify-between transition cursor-pointer group relative ${
                      !cell.isCurrentMonth
                        ? 'bg-zinc-950/60 text-zinc-600 opacity-40 hover:opacity-90'
                        : cell.isWeekend
                        ? 'bg-zinc-900/20'
                        : 'bg-zinc-900/40 hover:bg-zinc-800/40'
                    } ${
                      cell.isToday
                        ? 'ring-2 ring-inset ring-[#E8590C] bg-[#E8590C]/5'
                        : ''
                    } ${
                      isSelected
                        ? 'bg-zinc-800/90 shadow-inner'
                        : ''
                    }`}
                  >
                    {/* Day Header: Number + Quick Badges */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-extrabold w-6 h-6 rounded-full flex items-center justify-center ${
                          cell.isToday
                            ? 'bg-[#E8590C] text-white shadow-sm'
                            : cell.isCurrentMonth
                            ? 'text-zinc-300 group-hover:text-white'
                            : 'text-zinc-600'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {/* Mini event count dot indicator */}
                      {dayEvents.length > 0 && (
                        <div className="flex items-center gap-1">
                          {hasCobro && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Cobro pendiente" />}
                          {hasMeeting && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" title="Reunión agendada" />}
                          {hasEntrega && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" title="Entrega de proyecto" />}
                          {hasTask && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" title="Tareas" />}
                        </div>
                      )}
                    </div>

                    {/* Day Events Preview List (Max 3 badges, rest as "+N más") */}
                    <div className="space-y-1 flex-1 overflow-hidden">
                      {dayEvents.slice(0, 3).map((ev) => {
                        const cfg = getEventTypeConfig(ev.type);

                        return (
                          <div
                            key={ev.id}
                            className={`px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-medium truncate flex items-center gap-1 border transition ${cfg.bg} ${
                              ev.completed ? 'line-through opacity-50' : ''
                            }`}
                            title={`${cfg.label}: ${ev.title}${ev.amount ? ` - ${formatMoney(ev.amount, ev.currency)}` : ''}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                            <span className="truncate flex-1">
                              {ev.amount ? `${formatMoney(ev.amount, ev.currency)}` : ev.title}
                            </span>
                          </div>
                        );
                      })}

                      {dayEvents.length > 3 && (
                        <div className="text-[10px] font-bold text-zinc-500 pl-1">
                          +{dayEvents.length - 3} más...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. Weekly View Mode */}
      {viewMode === 'semana' && (
        <div className="space-y-4">
          {/* MOBILE WEEKLY: Horizontal Day Strip + Selected Day Agenda */}
          <div className="md:hidden space-y-4">
            {/* Horizontal 7-Day Selector */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2.5 shadow-md">
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }).map((_, idx) => {
                  const base = new Date(selectedDate);
                  const dayOfWeek = base.getDay() === 0 ? 6 : base.getDay() - 1;
                  const diff = idx - dayOfWeek;
                  const dateStr = addDays(selectedDate, diff);
                  const dayEvents = eventsByDate.get(dateStr) || [];
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => {
                        hapticFeedback.light();
                        setSelectedDate(dateStr);
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl transition cursor-pointer relative ${
                        isSelected
                          ? 'bg-[#E8590C] text-white font-extrabold shadow-sm'
                          : isToday
                          ? 'bg-[#E8590C]/15 text-[#E8590C] font-bold border border-[#E8590C]/40'
                          : 'text-zinc-300 hover:bg-zinc-800/70'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold text-zinc-400">
                        {DAY_NAMES[idx].slice(0, 1)}
                      </span>
                      <span className="text-sm font-bold mt-0.5">
                        {dateStr.split('-')[2]}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Agenda Box */}
            <div className="bg-zinc-900/95 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">
                    {formatDayName(selectedDate)}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {formatDateHeading(selectedDate)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenQuickAdd('tarea', selectedDate)}
                  className="px-2.5 py-1 rounded-xl bg-[#E8590C] hover:bg-[#cf4d07] text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir</span>
                </button>
              </div>

              {/* Day Events */}
              {(() => {
                const dayEvents = eventsByDate.get(selectedDate) || [];
                if (dayEvents.length === 0) {
                  return (
                    <div className="py-6 text-center text-zinc-500 text-xs">
                      Sin eventos agendados para este día.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {dayEvents.map(ev => {
                      const cfg = getEventTypeConfig(ev.type);

                      return (
                        <div
                          key={ev.id}
                          className={`p-3 rounded-xl border flex items-start justify-between gap-2.5 transition ${cfg.bg} ${
                            ev.completed ? 'opacity-60 bg-zinc-950/40' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleToggleComplete(ev)}
                              className="mt-0.5 text-zinc-400 hover:text-white transition shrink-0 cursor-pointer"
                              title={ev.completed ? 'Marcar pendiente' : 'Marcar completado'}
                            >
                              {ev.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-zinc-500" />
                              )}
                            </button>

                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${cfg.badge}`}>
                                  {cfg.label}
                                </span>
                                {ev.time && (
                                  <span className="text-[10px] font-mono text-zinc-400">
                                    {ev.time}
                                  </span>
                                )}
                              </div>
                              <h4 className={`text-xs font-bold text-zinc-100 ${ev.completed ? 'line-through text-zinc-400' : ''}`}>
                                {ev.title}
                              </h4>
                              {(ev.projectName || (ev as any).clientName) && (
                                <p className="text-[11px] text-zinc-400 truncate">
                                  {ev.projectName || (ev as any).clientName}
                                </p>
                              )}
                            </div>
                          </div>

                          {ev.amount !== undefined && (
                            <div className="text-right shrink-0">
                              <span className="text-xs font-black text-emerald-400 font-mono">
                                {formatMoney(ev.amount, ev.currency)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* DESKTOP WEEKLY: 7 Parallel Columns */}
          <div className="hidden md:grid md:grid-cols-7 gap-3">
            {/* Find days of selected date's week */}
            {Array.from({ length: 7 }).map((_, idx) => {
              const base = new Date(selectedDate);
              const dayOfWeek = base.getDay() === 0 ? 6 : base.getDay() - 1;
              const diff = idx - dayOfWeek;
              const dateStr = addDays(selectedDate, diff);
              const dayEvents = eventsByDate.get(dateStr) || [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`bg-zinc-900 border rounded-2xl p-3 flex flex-col justify-between transition cursor-pointer min-h-[300px] ${
                    isToday ? 'border-[#E8590C]/80 ring-1 ring-[#E8590C]' : 'border-zinc-800'
                  } ${isSelected ? 'bg-zinc-850' : ''}`}
                >
                  <div className="border-b border-zinc-800 pb-2 mb-2 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        {formatDayName(dateStr).split(',')[0]}
                      </div>
                      <div className="text-base font-extrabold text-white">
                        {dateStr.split('-')[2]} {MONTH_NAMES[Number(dateStr.split('-')[1]) - 1].slice(0, 3)}
                      </div>
                    </div>
                    {isToday && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E8590C] text-white">
                        Hoy
                      </span>
                    )}
                  </div>

                  {/* Events list */}
                  <div className="space-y-2 flex-1 overflow-y-auto max-h-[350px]">
                    {dayEvents.length === 0 ? (
                      <div className="text-xs text-zinc-600 text-center py-6 italic">
                        Sin eventos
                      </div>
                    ) : (
                      dayEvents.map(ev => {
                        const cfg = getEventTypeConfig(ev.type);
                        return (
                          <div
                            key={ev.id}
                            className={`p-2 rounded-xl border text-xs flex flex-col gap-1 transition ${cfg.bg} ${
                              ev.completed ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                              {ev.time && <span className="text-[10px] font-mono">{ev.time} hs</span>}
                            </div>
                            <div className={`font-semibold text-zinc-100 ${ev.completed ? 'line-through' : ''}`}>
                              {ev.title}
                            </div>
                            {ev.amount && (
                              <div className="font-mono font-bold text-emerald-300">
                                {formatMoney(ev.amount, ev.currency)}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Quick Add on this Day */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenQuickAdd('tarea', dateStr);
                    }}
                    className="w-full mt-2 py-1 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Chronological List View Mode */}
      {viewMode === 'lista' && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <List className="w-4 h-4 text-[#E8590C]" />
              Lista Cronológica de Eventos ({filteredEvents.length})
            </h3>
            <span className="text-xs text-zinc-400">
              Ordenado por fecha de ejecución
            </span>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-zinc-600 opacity-60" />
              <p className="text-sm font-semibold text-zinc-400">No se encontraron eventos con estos filtros</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedTypeFilter('todos');
                  setStatusFilter('todos');
                  setSearchQuery('');
                }}
                className="mt-3 text-xs text-[#E8590C] hover:underline font-bold"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(ev => {
                  const cfg = getEventTypeConfig(ev.type);
                  const isToday = ev.date === todayStr;

                  return (
                    <div
                      key={ev.id}
                      className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                        ev.completed
                          ? 'bg-zinc-950/40 border-zinc-800/60 opacity-60'
                          : isToday
                          ? 'bg-[#E8590C]/10 border-[#E8590C]/40'
                          : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Status / Toggle button */}
                        {ev.type === 'tarea' && (
                          <button
                            type="button"
                            onClick={() => onToggleTask(ev.rawItem.id)}
                            className="mt-0.5 p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 transition"
                          >
                            {ev.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-[#E8590C]" />
                            )}
                          </button>
                        )}
                        {ev.type === 'reunion' && (
                          <button
                            type="button"
                            onClick={() => onToggleMeeting(ev.rawItem.id)}
                            className="mt-0.5 p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 transition"
                          >
                            {ev.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-sky-400" />
                            )}
                          </button>
                        )}
                        {ev.type === 'cobro' && (
                          <div className="mt-0.5 p-1 rounded-lg text-emerald-400">
                            <DollarSign className="w-5 h-5" />
                          </div>
                        )}
                        {ev.type === 'entrega' && (
                          <div className="mt-0.5 p-1 rounded-lg text-rose-400">
                            <Flag className="w-5 h-5" />
                          </div>
                        )}
                        {ev.type === 'inicio' && (
                          <div className="mt-0.5 p-1 rounded-lg text-amber-400">
                            <Sparkles className="w-5 h-5" />
                          </div>
                        )}
                        {ev.type === 'seguimiento' && (
                          <div className="mt-0.5 p-1 rounded-lg text-indigo-400">
                            <Target className="w-5 h-5" />
                          </div>
                        )}

                        {/* Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg}`}>
                              {cfg.label}
                            </span>
                            <span className="text-xs font-semibold text-zinc-400">
                              {formatDayName(ev.date)}
                            </span>
                            {ev.time && (
                              <span className="text-xs font-mono font-bold text-zinc-300">
                                {ev.time} hs
                              </span>
                            )}
                            {isToday && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E8590C] text-white">
                                ¡Hoy!
                              </span>
                            )}
                          </div>

                          <h4 className={`text-sm font-bold text-zinc-100 truncate ${ev.completed ? 'line-through text-zinc-400' : ''}`}>
                            {ev.title}
                          </h4>

                          {ev.projectName && (
                            <div className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                              <FolderKanban className="w-3 h-3 text-zinc-500" />
                              <span>{ev.projectName}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right actions & Amount */}
                      <div className="flex items-center gap-2.5 justify-end shrink-0 pl-8 sm:pl-0">
                        {ev.amount && (
                          <div className="text-sm font-mono font-black text-emerald-400">
                            {formatMoney(ev.amount, ev.currency)}
                          </div>
                        )}

                        {/* Phone / WhatsApp */}
                        {ev.phone && (
                          <a
                            href={formatWhatsAppUrl(ev.phone, `Hola, me comunico sobre: ${ev.title}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition"
                            title="Enviar WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}

                        {/* Link to Project Ficha */}
                        {(() => {
                          const linkedProj = ev.projectId 
                            ? projects.find(proj => proj.id === ev.projectId)
                            : resolveTaskProject(ev.rawItem || (ev as any), projects);
                          if (!linkedProj || !onOpenProject360) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => onOpenProject360(linkedProj)}
                              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
                              title="Ver Ficha 360° del Cliente"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* 6. Day Detail Inspector Drawer / Modal */}
      {isDayDrawerOpen && (
        <ModalPortal>
          <div 
            className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto cursor-pointer animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                hapticFeedback.light();
                setIsDayDrawerOpen(false);
              }
            }}
          >
            <div 
              className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden t-modal-enter cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#E8590C]/15 border border-[#E8590C]/30 flex items-center justify-center text-[#E8590C]">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {formatDayName(selectedDate)}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'evento programado' : 'eventos programados'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDayDrawerOpen(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition active:scale-95"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Events Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-10 text-zinc-500">
                  <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-zinc-600 opacity-60" />
                  <p className="text-sm font-semibold text-zinc-300">Día libre de compromisos</p>
                  <p className="text-xs text-zinc-500 mt-0.5">No hay tareas, cobros ni reuniones agendadas para este día.</p>
                </div>
              ) : (
                selectedDayEvents.map(ev => {
                  const cfg = getEventTypeConfig(ev.type);

                  return (
                    <div
                      key={ev.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition ${
                        ev.completed
                          ? 'bg-zinc-950/40 border-zinc-800/60 opacity-60'
                          : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {ev.type === 'tarea' && (
                          <button
                            type="button"
                            onClick={() => onToggleTask(ev.rawItem.id)}
                            className="mt-0.5 p-0.5 rounded-lg hover:bg-zinc-800 text-zinc-400"
                          >
                            {ev.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-[#E8590C]" />
                            )}
                          </button>
                        )}
                        {ev.type === 'reunion' && (
                          <button
                            type="button"
                            onClick={() => onToggleMeeting(ev.rawItem.id)}
                            className="mt-0.5 p-0.5 rounded-lg hover:bg-zinc-800 text-zinc-400"
                          >
                            {ev.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-sky-400" />
                            )}
                          </button>
                        )}
                        {ev.type === 'cobro' && (
                          <div className="mt-0.5 text-emerald-400">
                            <DollarSign className="w-5 h-5" />
                          </div>
                        )}
                        {ev.type === 'entrega' && (
                          <div className="mt-0.5 text-rose-400">
                            <Flag className="w-5 h-5" />
                          </div>
                        )}
                        {ev.type === 'inicio' && (
                          <div className="mt-0.5 text-amber-400">
                            <Sparkles className="w-5 h-5" />
                          </div>
                        )}
                        {ev.type === 'seguimiento' && (
                          <div className="mt-0.5 text-indigo-400">
                            <Target className="w-5 h-5" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${cfg.bg}`}>
                              {cfg.label}
                            </span>
                            {ev.time && (
                              <span className="text-xs font-mono font-bold text-zinc-300">
                                {ev.time} hs
                              </span>
                            )}
                          </div>
                          <div className={`text-xs sm:text-sm font-bold text-zinc-100 truncate mt-0.5 ${ev.completed ? 'line-through text-zinc-400' : ''}`}>
                            {ev.title}
                          </div>
                          {ev.projectName && (
                            <div className="text-[11px] text-zinc-400 truncate">
                              {ev.projectName}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Amount / Quick Link */}
                      <div className="flex items-center gap-2 shrink-0">
                        {ev.amount && (
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {formatMoney(ev.amount, ev.currency)}
                          </span>
                        )}

                        {ev.phone && (
                          <a
                            href={formatWhatsAppUrl(ev.phone, `Hola, sobre: ${ev.title}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {(() => {
                          const linkedProj = ev.projectId 
                            ? projects.find(proj => proj.id === ev.projectId)
                            : resolveTaskProject(ev.rawItem || (ev as any), projects);
                          if (!linkedProj || !onOpenProject360) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setIsDayDrawerOpen(false);
                                onOpenProject360(linkedProj);
                              }}
                              className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white"
                              title="Abrir ficha de cliente"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          );
                        })()}

                        {/* Direct Delete Button for Task or Meeting */}
                        {ev.type === 'tarea' && onDeleteTask && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              hapticFeedback.warning();
                              onDeleteTask(ev.rawItem?.id || ev.id);
                            }}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                            title="Eliminar tarea"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {ev.type === 'reunion' && onDeleteMeeting && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              hapticFeedback.warning();
                              onDeleteMeeting(ev.rawItem?.id || ev.id);
                            }}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                            title="Eliminar reunión"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const evs = selectedDayEvents.map(e => ({
                    title: `[${getEventTypeConfig(e.type).label}] ${e.title}`,
                    date: e.date,
                    time: e.time,
                    description: e.projectName,
                  }));
                  if (evs.length > 0) {
                    generateBatchCalendarICS(evs, `Dia_${selectedDate}`);
                  }
                }}
                disabled={selectedDayEvents.length === 0}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 border border-zinc-800 transition disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Día</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDayDrawerOpen(false);
                  onOpenQuickAdd('tarea', selectedDate);
                }}
                className="px-4 py-2 rounded-xl bg-[#E8590C] hover:bg-[#cf4d07] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm shadow-[#E8590C]/20"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Agregar a este día</span>
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
    )}
    </div>
  );
};
