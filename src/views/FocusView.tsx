import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  AgendaTask, 
  AgendaMeeting, 
  Project, 
  SubTask, 
  SubtareaFoco, 
  TimeLog, 
  TaskPriority 
} from '../types';
import { todayLocal, toSafeDateString, addDays, parseLocalDate } from '../utils/dates';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { 
  playTaskDone, 
  playSubtaskToggle, 
  playTimerEnd, 
  playPostpone,
  playItemCreated 
} from '../utils/sound';
import { fireTaskCelebration } from '../utils/confetti';
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  ArrowLeft, 
  Clock, 
  SkipForward, 
  Sliders, 
  Sparkles,
  Timer,
  AlertTriangle,
  FastForward,
  Building2,
  Calendar,
  Flame,
  Check,
  Flag
} from 'lucide-react';

interface Props {
  tasks: AgendaTask[];
  meetings?: AgendaMeeting[];
  projects?: Project[];
  onAddTask: (task: Omit<AgendaTask, 'id' | 'createdAt'>) => void;
  onUpdateTask: (id: string, updates: Partial<AgendaTask>) => void;
  onToggleTask: (id: string) => void;
  onToggleMeeting?: (id: string) => void;
  onMoveTaskDate?: (id: string, targetDate: string) => void;
  onDeleteTask?: (id: string) => void;
  onAddTimeLog?: (log: Omit<TimeLog, 'id' | 'createdAt'>) => void;
  onExit: () => void;
}

const PREF_AUTO_FOCUS = 'cero_pref_default_view';
type FilterTab = 'todas' | 'hoy' | 'vencidas' | 'completadas';

export const FocusView: React.FC<Props> = ({
  tasks,
  meetings = [],
  projects = [],
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onToggleMeeting,
  onMoveTaskDate,
  onDeleteTask,
  onAddTimeLog,
  onExit,
}) => {
  // Resolve today safely: canonical app local date and Argentina ISO fallback
  const today = getTodayString();
  const todayAr = todayLocal();

  // Helper date matchers
  const isDateToday = (d?: string): boolean => {
    if (!d) return false;
    const safe = toSafeDateString(d);
    return safe === today || safe === todayAr;
  };

  const isDateOverdue = (d?: string): boolean => {
    if (!d) return false;
    const safe = toSafeDateString(d);
    return safe < today && safe < todayAr;
  };

  // Helper to resolve project / client name reliably
  const resolveProjectName = (task: AgendaTask): string | undefined => {
    if (task.projectName) return task.projectName;
    if (task.projectId && projects.length > 0) {
      const match = projects.find(p => p.id === task.projectId);
      if (match) return match.clientName;
    }
    return undefined;
  };

  // Categorize tasks of today vs overdue vs completed
  // Today's tasks: scheduled for today, or created today without explicit date
  const scheduledTodayTasks = useMemo(() => {
    return tasks.filter(t => isDateToday(t.date) || (!t.date && isDateToday(t.createdAt)));
  }, [tasks, today, todayAr]);

  const overduePendingTasks = useMemo(() => {
    return tasks.filter(t => !t.completed && isDateOverdue(t.date));
  }, [tasks, today, todayAr]);

  // Today meetings
  const todayMeetingsList = useMemo(() => {
    return meetings.filter(m => isDateToday(m.date));
  }, [meetings, today, todayAr]);

  // Active filter tab: ALWAYS default to 'hoy' so Modo Foco immediately focuses on today's tasks
  const [filterTab, setFilterTab] = useState<FilterTab>('hoy');

  // Keep track of user-selected filter if overdue tasks change
  useEffect(() => {
    if (filterTab === 'vencidas' && overduePendingTasks.length === 0) {
      setFilterTab('hoy');
    }
  }, [overduePendingTasks.length, filterTab]);

  // Settings: default open in focus mode
  const [autoOpenFocus, setAutoOpenFocus] = useState<boolean>(() => {
    return localStorage.getItem(PREF_AUTO_FOCUS) === 'foco';
  });

  const handleToggleAutoOpenFocus = () => {
    const next = !autoOpenFocus;
    setAutoOpenFocus(next);
    localStorage.setItem(PREF_AUTO_FOCUS, next ? 'foco' : 'agenda');
    hapticFeedback.light();
  };

  // Keyboard shortcut Esc to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  // Expanded task accordion IDs
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Active task running pomodoro
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Session completion notification banner
  const [sessionAlert, setSessionAlert] = useState<{
    taskTitle: string;
    minutes: number;
    taskId?: string;
  } | null>(null);

  // Pomodoro timer state (in seconds)
  const [workMinutes, setWorkMinutes] = useState<number>(25);
  const [breakMinutes, setBreakMinutes] = useState<number>(5);
  const [isBreak, setIsBreak] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [showTimerSettings, setShowTimerSettings] = useState<boolean>(false);

  // New task inline input & options
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('media');
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>('');
  const [showNewTaskOptions, setShowNewTaskOptions] = useState<boolean>(false);

  // New subtask inline input per task
  const [newSubtaskInputs, setNewSubtaskInputs] = useState<Record<string, string>>({});

  // Collapsed state for meetings accordion
  const [showMeetingsSection, setShowMeetingsSection] = useState<boolean>(true);

  // Unified list of tasks according to the active tab
  const displayedTasks = useMemo(() => {
    if (filterTab === 'vencidas') {
      return overduePendingTasks;
    }
    if (filterTab === 'completadas') {
      return scheduledTodayTasks.filter(t => t.completed);
    }
    if (filterTab === 'todas') {
      // Both today's tasks and overdue pending tasks together
      const combinedMap = new Map<string, AgendaTask>();
      scheduledTodayTasks.forEach(t => combinedMap.set(t.id, t));
      overduePendingTasks.forEach(t => combinedMap.set(t.id, t));
      return Array.from(combinedMap.values());
    }
    // Default: 'hoy'
    return scheduledTodayTasks;
  }, [filterTab, scheduledTodayTasks, overduePendingTasks]);

  // Intelligent sort for the displayed tasks
  const sortedTasks = useMemo(() => {
    const list = [...displayedTasks];

    return list.sort((a, b) => {
      // 1. Tarea activa en pomodoro SIEMPRE arriba
      if (a.id === activeTaskId) return -1;
      if (b.id === activeTaskId) return 1;

      // 2. Pendientes primero, completadas al final
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }

      // 3. Si estamos en 'todas', las tareas de HOY tienen prioridad sobre tareas atrasadas
      if (filterTab === 'todas') {
        const isTodayA = isDateToday(a.date) || (!a.date && isDateToday(a.createdAt)) ? 1 : 0;
        const isTodayB = isDateToday(b.date) || (!b.date && isDateToday(b.createdAt)) ? 1 : 0;
        if (isTodayA !== isTodayB) return isTodayB - isTodayA;
      }

      // 4. Prioridad: alta > media > baja
      const priorityWeight = (p?: string) => {
        if (p === 'alta') return 3;
        if (p === 'media') return 2;
        if (p === 'baja') return 1;
        return 0;
      };
      const prioDiff = priorityWeight(b.priority) - priorityWeight(a.priority);
      if (prioDiff !== 0) return prioDiff;

      // 5. Tareas en progreso (kanbanStatus === 'inprogress')
      const inProgA = a.kanbanStatus === 'inprogress' ? 1 : 0;
      const inProgB = b.kanbanStatus === 'inprogress' ? 1 : 0;
      if (inProgA !== inProgB) return inProgB - inProgA;

      // 6. Hora especificada (ej. '09:00' antes de '14:00')
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;

      // 7. Order index o createdAt
      if (typeof a.orderIndex === 'number' && typeof b.orderIndex === 'number') {
        return a.orderIndex - b.orderIndex;
      }
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [displayedTasks, activeTaskId, filterTab, today, todayAr]);

  // Set default expanded task once tasks are available
  useEffect(() => {
    if (!expandedTaskId && sortedTasks.length > 0) {
      const firstActive = sortedTasks.find(t => !t.completed);
      if (firstActive) {
        setExpandedTaskId(firstActive.id);
      }
    }
  }, [sortedTasks, expandedTaskId]);

  // Active task object
  const activeTask = useMemo(() => {
    return tasks.find(t => t.id === activeTaskId) || null;
  }, [tasks, activeTaskId]);

  // Unify subtareas getter/setter
  const getSubtareas = (task: AgendaTask): SubtareaFoco[] => {
    if (task.subtareas && Array.isArray(task.subtareas) && task.subtareas.length > 0) {
      return task.subtareas;
    }
    if (task.subtasks && Array.isArray(task.subtasks) && task.subtasks.length > 0) {
      return task.subtasks.map(s => ({ id: s.id, titulo: s.title, hecha: s.completed }));
    }
    return [];
  };

  const updateSubtareas = (task: AgendaTask, newSubtareas: SubtareaFoco[]) => {
    const legacySubtasks: SubTask[] = newSubtareas.map(s => ({
      id: s.id,
      title: s.titulo,
      completed: s.hecha,
    }));
    const allDone = newSubtareas.length > 0 && newSubtareas.every(s => s.hecha);
    onUpdateTask(task.id, {
      subtareas: newSubtareas,
      subtasks: legacySubtasks,
      ...(allDone && !task.completed ? { completed: true } : {}),
    });
  };

  // Timer Tick Interval
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            playTimerEnd();
            hapticFeedback.heavy();

            if (activeTaskId && !isBreak) {
              const currentTask = tasks.find(t => t.id === activeTaskId);
              if (currentTask) {
                const addedMin = workMinutes;
                const currentReal = currentTask.tiempoRealMin || 0;
                onUpdateTask(currentTask.id, { tiempoRealMin: currentReal + addedMin });

                setSessionAlert({
                  taskTitle: currentTask.title,
                  minutes: addedMin,
                  taskId: currentTask.id,
                });

                if (onAddTimeLog) {
                  onAddTimeLog({
                    taskId: currentTask.id,
                    projectName: currentTask.projectName,
                    description: `Bloque de foco completado (${currentTask.title})`,
                    durationMinutes: addedMin,
                    date: today,
                  });
                }
              }
            }

            // Switch to break or work
            if (!isBreak) {
              setIsBreak(true);
              return breakMinutes * 60;
            } else {
              setIsBreak(false);
              return workMinutes * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, secondsLeft, activeTaskId, isBreak, workMinutes, breakMinutes, tasks, onUpdateTask, onAddTimeLog, today]);

  // Handle Play/Start on a task
  const handleStartTask = (task: AgendaTask) => {
    hapticFeedback.medium();
    if (activeTaskId === task.id) {
      setIsTimerRunning(prev => !prev);
    } else {
      setActiveTaskId(task.id);
      setExpandedTaskId(task.id);
      setIsBreak(false);
      const initialMin = task.estimadoMin || (task.pomodorosEstimados ? task.pomodorosEstimados * 25 : workMinutes);
      const chosenMin = initialMin > 0 ? initialMin : 25;
      setWorkMinutes(chosenMin);
      setSecondsLeft(chosenMin * 60);
      setIsTimerRunning(true);
    }
  };

  // Handle Finish Session manually
  const handleFinishSession = () => {
    if (!activeTaskId) return;
    hapticFeedback.selection();
    setIsTimerRunning(false);

    const elapsedSeconds = (isBreak ? breakMinutes * 60 : workMinutes * 60) - secondsLeft;
    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

    if (!isBreak && elapsedMinutes > 0 && activeTask) {
      const currentReal = activeTask.tiempoRealMin || 0;
      onUpdateTask(activeTask.id, { tiempoRealMin: currentReal + elapsedMinutes });
      if (onAddTimeLog) {
        onAddTimeLog({
          taskId: activeTask.id,
          projectName: activeTask.projectName,
          description: `Sesión de foco manual (${activeTask.title})`,
          durationMinutes: elapsedMinutes,
          date: today,
        });
      }
    }
    setActiveTaskId(null);
  };

  // Handle Next Task
  const handleNextTask = () => {
    handleFinishSession();
    const incomplete = sortedTasks.filter(t => !t.completed && t.id !== activeTaskId);
    if (incomplete.length > 0) {
      handleStartTask(incomplete[0]);
    }
  };

  // Subtask Toggle
  const handleToggleSubtarea = (task: AgendaTask, subId: string) => {
    const list = getSubtareas(task);
    const updated = list.map(s => s.id === subId ? { ...s, hecha: !s.hecha } : s);
    updateSubtareas(task, updated);
    playSubtaskToggle();
    hapticFeedback.light();
  };

  // Add Subtask inline
  const handleAddSubtarea = (task: AgendaTask) => {
    const val = (newSubtaskInputs[task.id] || '').trim();
    if (!val) return;
    const list = getSubtareas(task);
    const newSub: SubtareaFoco = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      titulo: val,
      hecha: false,
    };
    updateSubtareas(task, [...list, newSub]);
    setNewSubtaskInputs(prev => ({ ...prev, [task.id]: '' }));
    hapticFeedback.light();
  };

  // Delete Subtask
  const handleDeleteSubtarea = (task: AgendaTask, subId: string) => {
    const list = getSubtareas(task);
    updateSubtareas(task, list.filter(s => s.id !== subId));
    hapticFeedback.selection();
  };

  // Move Overdue Tasks to Today
  const handleMoveAllOverdueToToday = () => {
    hapticFeedback.medium();
    overduePendingTasks.forEach(task => {
      if (onMoveTaskDate) {
        onMoveTaskDate(task.id, today);
      } else {
        onUpdateTask(task.id, { date: today });
      }
    });
    setFilterTab('hoy');
  };

  // Postpone individual task to tomorrow
  const handlePostponeTaskToTomorrow = (task: AgendaTask) => {
    hapticFeedback.light();
    playPostpone();
    const tomorrow = addDays(today, 1);
    if (onMoveTaskDate) {
      onMoveTaskDate(task.id, tomorrow);
    } else {
      onUpdateTask(task.id, { date: tomorrow });
    }
  };

  // Move individual overdue task to today
  const handleBringTaskToToday = (task: AgendaTask) => {
    hapticFeedback.light();
    if (onMoveTaskDate) {
      onMoveTaskDate(task.id, today);
    } else {
      onUpdateTask(task.id, { date: today });
    }
  };

  // Add New Task for Today
  const handleCreateTaskToday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    hapticFeedback.medium();
    playItemCreated();

    const matchedProject = projects.find(p => p.id === newTaskProjectId);

    onAddTask({
      title: newTaskTitle.trim(),
      date: today,
      completed: false,
      priority: newTaskPriority,
      projectId: matchedProject?.id || undefined,
      projectName: matchedProject?.clientName || undefined,
      estimadoMin: 25,
      pomodorosEstimados: 1,
      tiempoRealMin: 0,
      subtareas: [],
    });

    setNewTaskTitle('');
    setShowNewTaskOptions(false);
  };

  // Progress Calculation
  const progressStats = useMemo(() => {
    let totalUnits = 0;
    let completedUnits = 0;
    let totalPlannedMin = 0;
    let totalRealMin = 0;

    const baseList = filterTab === 'todas' || filterTab === 'vencidas' ? displayedTasks : scheduledTodayTasks;

    baseList.forEach(t => {
      const subs = getSubtareas(t);
      if (subs.length > 0) {
        totalUnits += subs.length;
        completedUnits += subs.filter(s => s.hecha).length;
      } else {
        totalUnits += 1;
        if (t.completed) completedUnits += 1;
      }

      totalPlannedMin += Number(t.estimadoMin || (t.pomodorosEstimados ? t.pomodorosEstimados * 25 : 25));
      totalRealMin += Number(t.tiempoRealMin || 0);
    });

    const percent = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : (baseList.length === 0 ? 100 : 0);
    const plannedHours = (totalPlannedMin / 60).toFixed(1).replace('.0', '');
    const realH = Math.floor(totalRealMin / 60);
    const realM = totalRealMin % 60;
    const realFormatted = realH > 0 ? `${realH}h ${realM > 0 ? `${realM}m` : ''}` : `${realM}m`;

    return {
      totalUnits,
      completedUnits,
      percent,
      totalPlannedMin,
      totalRealMin,
      plannedHours,
      realFormatted,
    };
  }, [displayedTasks, scheduledTodayTasks, filterTab]);

  // Formatted date string in Spanish
  const formattedToday = useMemo(() => {
    try {
      const [year, month, day] = today.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    } catch {
      return today;
    }
  }, [today]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const todayPendingCount = scheduledTodayTasks.filter(t => !t.completed).length;
  const overdueCount = overduePendingTasks.length;
  const allPendingCount = todayPendingCount + overdueCount;
  const completedTodayCount = scheduledTodayTasks.filter(t => t.completed).length;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] font-sans antialiased selection:bg-[var(--text-primary)] selection:text-[var(--bg-app)] pb-24">
      {/* 1. Header con Navegación y Progreso */}
      <header className="max-w-2xl mx-auto px-4 pt-6 pb-4 sm:pt-8 sm:pb-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExit}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
              title="Salir del Modo Foco (Esc)"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500/20" />
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-primary)] font-bold">
                Modo Foco
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Auto-open toggle preference */}
            <button
              type="button"
              onClick={handleToggleAutoOpenFocus}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition cursor-pointer flex items-center gap-1.5 ${
                autoOpenFocus
                  ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] border-transparent font-medium'
                  : 'bg-[var(--bg-surface-muted)] text-[var(--text-tertiary)] border-[var(--border-subtle)] hover:text-[var(--text-secondary)]'
              }`}
              title="Abrir siempre directo en Modo Foco al iniciar la app"
            >
              <span>Inicio Foco</span>
              <span className={`w-1.5 h-1.5 rounded-full ${autoOpenFocus ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
            </button>

            <button
              type="button"
              onClick={() => setShowTimerSettings(prev => !prev)}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] cursor-pointer"
              title="Configurar bloques pomodoro"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Date & Global Progress */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight capitalize font-heading text-[var(--text-primary)]">
              {formattedToday}
            </h1>
            <span className="text-xs font-mono text-[var(--text-secondary)] font-semibold">
              {progressStats.percent}%
            </span>
          </div>

          {/* Global Progress Bar */}
          <div className="w-full h-1.5 bg-[var(--bg-surface-muted)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
            <div
              className="h-full bg-[var(--solid-contrast-bg)] rounded-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300 ease-out"
              style={{ width: `${progressStats.percent}%` }}
            />
          </div>

          {/* Subtext info */}
          <p className="text-xs text-[var(--text-secondary)] font-mono flex items-center justify-between">
            <span>
              {progressStats.completedUnits} de {progressStats.totalUnits} hechas
            </span>
            <span>
              {progressStats.realFormatted} de {progressStats.plannedHours}h planificadas
            </span>
          </p>
        </div>

        {/* Inline Pomodoro Settings Drawer */}
        {showTimerSettings && (
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3 text-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between font-semibold text-[var(--text-primary)]">
              <span>Configuración de Bloques Pomodoro</span>
              <button
                type="button"
                onClick={() => setShowTimerSettings(false)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Trabajo (min):</label>
                <input
                  type="number"
                  min="5"
                  max="90"
                  value={workMinutes}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setWorkMinutes(val);
                    if (!isTimerRunning && !isBreak) setSecondsLeft(val * 60);
                  }}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Descanso (min):</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={breakMinutes}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setBreakMinutes(val);
                    if (!isTimerRunning && isBreak) setSecondsLeft(val * 60);
                  }}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* 2. Banner de Tareas Vencidas Pendientes (Acción Inmediata) */}
      {overdueCount > 0 && filterTab !== 'vencidas' && (
        <div className="max-w-2xl mx-auto px-4 mb-4">
          <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Tenés <strong>{overdueCount} {overdueCount === 1 ? 'tarea atrasada' : 'tareas atrasadas'}</strong> de días anteriores.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleMoveAllOverdueToToday}
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400 transition cursor-pointer active:scale-95 text-[11px]"
              >
                Traer todas a hoy
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('vencidas')}
                className="px-2 py-1 rounded-lg border border-amber-500/30 text-amber-300 hover:text-white transition cursor-pointer text-[11px]"
              >
                Ver vencidas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Hero Timer Activo si hay tarea en Pomodoro */}
      {activeTask && (
        <div className="max-w-2xl mx-auto px-4 mb-6">
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-lg space-y-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isBreak ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-ping'}`} />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                {isBreak ? 'Descanso Reconstituyente' : 'Bloque de Foco Activo'}
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold font-heading text-[var(--text-primary)] line-clamp-1">
              {activeTask.title}
            </h2>

            {/* Huge Clock */}
            <div className="font-mono text-5xl sm:text-6xl font-bold tracking-tight text-[var(--text-primary)] py-2">
              {formatTime(secondsLeft)}
            </div>

            {/* Timer Actions */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsTimerRunning(prev => !prev)}
                className="btn-solid-primary py-2.5 px-6 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
              >
                {isTimerRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isTimerRunning ? 'Pausar' : 'Reanudar'}</span>
              </button>

              <button
                type="button"
                onClick={handleFinishSession}
                className="btn-swiss-secondary py-2.5 px-4 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                title="Completar sesión y registrar tiempo"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Terminar Sesión</span>
              </button>

              <button
                type="button"
                onClick={handleNextTask}
                className="btn-swiss-secondary py-2.5 px-3 text-xs font-semibold rounded-xl cursor-pointer"
                title="Pasar a la siguiente tarea"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Notificación al terminar bloque de foco */}
      {sessionAlert && (
        <div className="max-w-2xl mx-auto px-4 mb-5 animate-blur-enter">
          <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-200 space-y-2.5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>¡Tiempo de Foco Cumplido! ({sessionAlert.minutes} min)</span>
              </div>
              <button
                type="button"
                onClick={() => setSessionAlert(null)}
                className="text-emerald-400 hover:text-white text-xs font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-emerald-100/90 font-mono">
              Completaste el bloque de foco para: <strong className="text-white">{sessionAlert.taskTitle}</strong>.
            </p>
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setSessionAlert(null);
                  setIsBreak(true);
                  setSecondsLeft(breakMinutes * 60);
                  setIsTimerRunning(true);
                }}
                className="py-1.5 px-3 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition cursor-pointer"
              >
                ☕ Tomar descanso ({breakMinutes}m)
              </button>
              {sessionAlert.taskId && (
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.success();
                    onToggleTask(sessionAlert.taskId!);
                    setSessionAlert(null);
                  }}
                  className="py-1.5 px-3 rounded-xl bg-emerald-900/80 border border-emerald-500/50 text-white text-xs font-medium hover:bg-emerald-800 transition cursor-pointer"
                >
                  ✅ Marcar tarea como hecha
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setSessionAlert(null);
                  handleNextTask();
                }}
                className="py-1.5 px-3 rounded-xl bg-emerald-900/80 border border-emerald-500/50 text-white text-xs font-medium hover:bg-emerald-800 transition cursor-pointer"
              >
                ▶ Siguiente tarea
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Citas y Reuniones de Hoy (si existen) */}
      {todayMeetingsList.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 mb-4">
          <div className="p-3 sm:p-3.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
            <div 
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setShowMeetingsSection(prev => !prev)}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span>Reuniones y Citas de Hoy ({todayMeetingsList.filter(m => !m.completed).length} pendientes)</span>
              </div>
              <button 
                type="button" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMeetingsSection(prev => !prev);
                }}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition cursor-pointer p-1"
                aria-label="Alternar reuniones"
              >
                {showMeetingsSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showMeetingsSection && (
              <div className="space-y-1.5 pt-1">
                {todayMeetingsList.map(meeting => (
                  <div
                    key={meeting.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {onToggleMeeting && (
                        <button
                          type="button"
                          onClick={() => {
                            hapticFeedback.light();
                            playTaskDone();
                            onToggleMeeting(meeting.id);
                          }}
                          className="text-[var(--text-tertiary)] hover:text-emerald-500 cursor-pointer"
                        >
                          {meeting.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      <span className={`truncate font-medium ${meeting.completed ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
                        {meeting.title}
                      </span>
                      {meeting.projectName && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                          {meeting.projectName}
                        </span>
                      )}
                    </div>
                    {meeting.time && (
                      <span className="text-[10px] font-mono text-[var(--text-secondary)] shrink-0">
                        {meeting.time} hs
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Tabs de Filtro de Tareas */}
      <div className="max-w-2xl mx-auto px-4 mb-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-xs overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              setFilterTab('hoy');
            }}
            className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterTab === 'hoy'
                ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-semibold shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>Hoy</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/20 text-current font-bold">
              {todayPendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              setFilterTab('todas');
            }}
            className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterTab === 'todas'
                ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-semibold shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>Todas las pendientes</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/20 text-current font-bold">
              {allPendingCount}
            </span>
          </button>

          {overdueCount > 0 && (
            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                setFilterTab('vencidas');
              }}
              className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer shrink-0 flex items-center gap-1.5 ${
                filterTab === 'vencidas'
                  ? 'bg-amber-500 text-black font-bold shadow-xs'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              <span>Vencidas</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/20 text-current font-bold">
                {overdueCount}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              setFilterTab('completadas');
            }}
            className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer shrink-0 flex items-center gap-1.5 ${
              filterTab === 'completadas'
                ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-semibold shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>Hechas</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/20 text-current font-bold">
              {completedTodayCount}
            </span>
          </button>
        </div>
      </div>

      {/* 7. Lista de Tareas */}
      <main className="max-w-2xl mx-auto px-4 space-y-3">
        {sortedTasks.length === 0 ? (
          <div className="text-center py-16 space-y-3 card-swiss p-8 animate-blur-enter">
            <CheckCircle2 className="w-10 h-10 mx-auto text-[var(--text-tertiary)] stroke-[1.2]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {filterTab === 'vencidas' 
                ? '¡No tenés tareas atrasadas!' 
                : filterTab === 'completadas'
                ? 'Todavía no completaste tareas hoy'
                : filterTab === 'todas'
                ? '¡Todas las tareas al día!'
                : '¡Todo listo para hoy!'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              {filterTab === 'vencidas'
                ? 'Todas tus tareas pendientes están al día.'
                : filterTab === 'completadas'
                ? 'Comenzá a marcar tareas hechas hoy para verlas registradas aquí.'
                : 'No tienes tareas pendientes para hoy. Agregá una abajo para comenzar tu foco.'}
            </p>
          </div>
        ) : (
          sortedTasks.map((task, idx) => {
            const isExpanded = expandedTaskId === task.id;
            const isActive = activeTaskId === task.id;
            const isDimmed = activeTaskId !== null && !isActive;
            const subtareas = getSubtareas(task);
            const totalSubs = subtareas.length;
            const doneSubs = subtareas.filter(s => s.hecha).length;
            const subPercent = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : (task.completed ? 100 : 0);
            const estMin = task.estimadoMin || (task.pomodorosEstimados ? task.pomodorosEstimados * 25 : 25);
            const realMin = task.tiempoRealMin || 0;
            const isOverdue = isDateOverdue(task.date) && !task.completed;

            const staggerClass = idx === 0 ? 'stagger-1' : idx === 1 ? 'stagger-2' : idx === 2 ? 'stagger-3' : idx === 3 ? 'stagger-4' : 'stagger-5';

            return (
              <div
                key={task.id}
                className={`rounded-2xl border transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300 animate-blur-enter ${staggerClass} ${
                  isActive
                    ? 'bg-[var(--bg-surface)] border-[var(--text-primary)] ring-1 ring-[var(--text-primary)] shadow-md'
                    : isOverdue
                    ? 'bg-[var(--bg-surface)] border-amber-500/40 hover:border-amber-500/60'
                    : task.completed
                    ? 'bg-[var(--bg-surface-muted)]/40 border-[var(--border-subtle)] opacity-60'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                } ${isDimmed ? 'opacity-35 hover:opacity-75' : 'opacity-100'}`}
              >
                {/* Collapsed Header / Row */}
                <div 
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                  onClick={() => {
                    setExpandedTaskId(isExpanded ? null : task.id);
                  }}
                >
                  {/* Checkbox and Title */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticFeedback.light();
                        onToggleTask(task.id);
                        if (!task.completed) {
                          playTaskDone();
                          fireTaskCelebration(0.5, 0.4);
                        }
                      }}
                      className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition shrink-0 cursor-pointer"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/10" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isOverdue && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Atrasada
                          </span>
                        )}
                        {task.priority === 'alta' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-0.5">
                            <Flag className="w-2.5 h-2.5" />
                            Alta
                          </span>
                        )}
                        {task.kanbanStatus === 'inprogress' && !task.completed && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            En progreso
                          </span>
                        )}
                        <h3 className={`text-sm font-semibold leading-snug truncate ${
                          task.completed ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'
                        }`}>
                          {task.title}
                        </h3>
                      </div>

                      {/* Meta chips: subtasks count, project, real vs est */}
                      <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-secondary)] mt-1 flex-wrap">
                        {resolveProjectName(task) && (
                          <span className="px-1.5 py-0.2 rounded bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] flex items-center gap-1">
                            <Building2 className="w-2.5 h-2.5" />
                            <span>{resolveProjectName(task)}</span>
                          </span>
                        )}

                        {task.time && (
                          <span className="px-1.5 py-0.2 rounded bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                            {task.time} hs
                          </span>
                        )}

                        {totalSubs > 0 && (
                          <span>{doneSubs}/{totalSubs} subtareas</span>
                        )}

                        <span>
                          {realMin > 0 ? `${realMin}m real · ` : ''}{estMin}m est.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right side: Mini progress bar + Play button */}
                  <div className="flex items-center gap-2 shrink-0">
                    {totalSubs > 0 && (
                      <div className="w-12 h-1.5 bg-[var(--bg-app)] rounded-full overflow-hidden border border-[var(--border-subtle)] hidden sm:block">
                        <div
                          className="h-full bg-[var(--solid-contrast-bg)] rounded-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300"
                          style={{ width: `${subPercent}%` }}
                        />
                      </div>
                    )}

                    {!task.completed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartTask(task);
                        }}
                        className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          isActive
                            ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-sm'
                            : 'bg-[var(--bg-surface-muted)] hover:bg-[var(--solid-contrast-bg)] hover:text-[var(--solid-contrast-text)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                        }`}
                        title={isActive ? 'Pausar foco' : 'Iniciar foco en esta tarea'}
                      >
                        {isActive && isTimerRunning ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span className="hidden sm:inline">{isActive ? (isTimerRunning ? 'Pausa' : 'Seguir') : 'Iniciar'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Accordion Body */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-[var(--border-subtle)] space-y-3.5 animate-in fade-in duration-100">
                    {/* Time Estimation Chips & Quick Actions */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-mono">
                        <span className="flex items-center gap-1">
                          <Timer className="w-3.5 h-3.5" />
                          <span>Tiempo estimado:</span>
                        </span>
                        <span>
                          Acumulado real: <strong className="text-[var(--text-primary)]">{realMin} min</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[15, 25, 45, 60].map(mins => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => {
                              hapticFeedback.light();
                              onUpdateTask(task.id, { estimadoMin: mins, pomodorosEstimados: Math.ceil(mins / 25) });
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
                              estMin === mins
                                ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-bold'
                                : 'bg-[var(--bg-app)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                            }`}
                          >
                            {mins} min
                          </button>
                        ))}

                        {/* Pomodoro quick count */}
                        {[1, 2, 3, 4].map(pomos => (
                          <button
                            key={`pom_${pomos}`}
                            type="button"
                            onClick={() => {
                              hapticFeedback.light();
                              onUpdateTask(task.id, { pomodorosEstimados: pomos, estimadoMin: pomos * 25 });
                            }}
                            className={`px-2 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                              task.pomodorosEstimados === pomos
                                ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-bold'
                                : 'bg-[var(--bg-app)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                            }`}
                            title={`${pomos} pomodoro(s) de 25 min`}
                          >
                            {pomos} 🍅
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Date Rescheduling & Priority Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)] flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isOverdue && (
                          <button
                            type="button"
                            onClick={() => handleBringTaskToToday(task)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium hover:bg-amber-500/30 transition cursor-pointer flex items-center gap-1"
                          >
                            <Calendar className="w-3 h-3" />
                            <span>Mover a Hoy</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePostponeTaskToTomorrow(task)}
                          className="px-2.5 py-1 rounded-lg bg-[var(--bg-app)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] text-xs font-medium transition cursor-pointer flex items-center gap-1"
                          title="Postergar a mañana"
                        >
                          <FastForward className="w-3 h-3" />
                          <span>Pasar a mañana</span>
                        </button>

                        {/* Priority Selector */}
                        <div className="flex items-center gap-1 ml-1">
                          {(['alta', 'media', 'baja'] as TaskPriority[]).map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                hapticFeedback.light();
                                onUpdateTask(task.id, { priority: task.priority === p ? undefined : p });
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize transition cursor-pointer ${
                                task.priority === p
                                  ? p === 'alta' ? 'bg-rose-500 text-white font-bold' : p === 'media' ? 'bg-amber-500 text-black font-bold' : 'bg-blue-500 text-white font-bold'
                                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {onDeleteTask && (
                        <button
                          type="button"
                          onClick={() => {
                            hapticFeedback.selection();
                            onDeleteTask(task.id);
                          }}
                          className="p-1 text-[var(--text-tertiary)] hover:text-red-500 transition cursor-pointer"
                          title="Eliminar tarea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Subtasks Checklist */}
                    <div className="space-y-1.5 pt-1 border-t border-[var(--border-subtle)]">
                      <div className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase font-semibold">
                        Subtareas ({doneSubs}/{totalSubs})
                      </div>

                      <div className="space-y-1">
                        {subtareas.map(sub => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] group text-xs"
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleSubtarea(task, sub.id)}
                              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                            >
                              {sub.hecha ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              ) : (
                                <Circle className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
                              )}
                              <span className={`truncate ${sub.hecha ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
                                {sub.titulo}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSubtarea(task, sub.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-tertiary)] hover:text-red-500 rounded transition cursor-pointer"
                              title="Eliminar subtarea"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Inline Add Subtask Input */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          value={newSubtaskInputs[task.id] || ''}
                          onChange={e => setNewSubtaskInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSubtarea(task);
                            }
                          }}
                          placeholder="+ Agregar subtarea (Enter)…"
                          className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--text-primary)] transition"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddSubtarea(task)}
                          className="p-1.5 rounded-xl bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
                          title="Agregar subtarea"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* 8. Inline Add New Task for Today at Bottom */}
        <form onSubmit={handleCreateTaskToday} className="pt-2 space-y-2">
          <div className="p-2 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs focus-within:border-[var(--text-primary)] transition space-y-2">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-[var(--text-tertiary)] ml-2 shrink-0" />
              <input
                type="text"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="Nueva tarea para hoy… (Presiona Enter)"
                className="w-full bg-transparent border-none text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none py-1"
              />
              <button
                type="button"
                onClick={() => setShowNewTaskOptions(prev => !prev)}
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer shrink-0 ${
                  showNewTaskOptions || newTaskPriority === 'alta' || newTaskProjectId
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
                title="Opciones de prioridad y cliente"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="btn-solid-primary py-1 px-3.5 text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-40 shrink-0"
              >
                Agregar
              </button>
            </div>

            {/* Expanded task options: priority & client selector */}
            {showNewTaskOptions && (
              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 text-xs flex-wrap px-1">
                {/* Priority Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[var(--text-tertiary)]">Prioridad:</span>
                  {(['alta', 'media', 'baja'] as TaskPriority[]).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewTaskPriority(p)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition cursor-pointer ${
                        newTaskPriority === p
                          ? p === 'alta' ? 'bg-rose-500 text-white' : p === 'media' ? 'bg-amber-500 text-black' : 'bg-blue-500 text-white'
                          : 'bg-[var(--bg-app)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {/* Project / Client selector */}
                {projects.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[var(--text-tertiary)]">Cliente:</span>
                    <select
                      value={newTaskProjectId}
                      onChange={e => setNewTaskProjectId(e.target.value)}
                      className="bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[11px] rounded-lg px-2 py-0.5 text-[var(--text-primary)] focus:outline-none cursor-pointer"
                    >
                      <option value="">Sin vincular</option>
                      {projects.filter(p => !p.archived).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.clientName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </form>
      </main>
    </div>
  );
};

export default FocusView;
