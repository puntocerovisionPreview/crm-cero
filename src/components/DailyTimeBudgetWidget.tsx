import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Video,
  Scissors,
  FileText,
  Laptop, 
  MessageSquare, 
  Target, 
  Coffee, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Minus, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  Sliders,
  Check,
  RotateCcw,
  PauseCircle,
  Play,
  CalendarDays,
  Grid,
  ListOrdered,
  Bell,
  Film,
  Briefcase,
  Layers,
  HelpCircle,
  X,
  MoreHorizontal
} from 'lucide-react';
import { 
  DailyAllocation, 
  DailyAllocationBucketId, 
  DailyAllocationMode,
  DailyBucketAllocation,
  ActiveTimeboxSession 
} from '../types';
import { 
  subscribeDailyBudget, 
  saveDailyBudgetToFirestore, 
  createDefaultDailyBudget,
  DEFAULT_DAILY_BUCKETS
} from '../utils/firestoreService';
import { hapticFeedback } from '../utils/haptics';
import { playTimeboxAlarm, playTaskDone } from '../utils/sound';

interface Props {
  dateStr: string; // 'YYYY-MM-DD'
  isToday?: boolean;
  className?: string;
  defaultCollapsed?: boolean;
}

// Configuración visual por bolsa de intención
const BUCKET_CONFIG: Record<
  DailyAllocationBucketId, 
  {
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    badgeBg: string;
    badgeText: string;
    progressBarColor: string;
    borderActive: string;
    cardBorder: string;
  }
> = {
  grabacion: {
    icon: Video,
    accentColor: '#EF4444',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-400',
    progressBarColor: 'bg-rose-500',
    borderActive: 'border-rose-500/60 ring-1 ring-rose-500/30',
    cardBorder: 'border-rose-500/30',
  },
  edicion: {
    icon: Scissors,
    accentColor: '#EC4899',
    badgeBg: 'bg-pink-500/15',
    badgeText: 'text-pink-400',
    progressBarColor: 'bg-pink-500',
    borderActive: 'border-pink-500/60 ring-1 ring-pink-500/30',
    cardBorder: 'border-pink-500/30',
  },
  guion: {
    icon: FileText,
    accentColor: '#06B6D4',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-400',
    progressBarColor: 'bg-cyan-500',
    borderActive: 'border-cyan-500/60 ring-1 ring-cyan-500/30',
    cardBorder: 'border-cyan-500/30',
  },
  foco: {
    icon: Laptop,
    accentColor: '#3B82F6',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-400',
    progressBarColor: 'bg-blue-500',
    borderActive: 'border-blue-500/60 ring-1 ring-blue-500/30',
    cardBorder: 'border-blue-500/30',
  },
  gestion: {
    icon: MessageSquare,
    accentColor: '#10B981',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-400',
    progressBarColor: 'bg-emerald-500',
    borderActive: 'border-emerald-500/60 ring-1 ring-emerald-500/30',
    cardBorder: 'border-emerald-500/30',
  },
  estrategia: {
    icon: Target,
    accentColor: '#8B5CF6',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-400',
    progressBarColor: 'bg-purple-500',
    borderActive: 'border-purple-500/60 ring-1 ring-purple-500/30',
    cardBorder: 'border-purple-500/30',
  },
  buffer: {
    icon: Coffee,
    accentColor: '#F59E0B',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-400',
    progressBarColor: 'bg-amber-500',
    borderActive: 'border-amber-500/60 ring-1 ring-amber-500/30',
    cardBorder: 'border-amber-500/30',
  },
};

const PRESET_BUCKETS: Record<'creador' | 'estudio' | 'todos', DailyAllocationBucketId[]> = {
  creador: ['guion', 'grabacion', 'edicion', 'buffer'],
  estudio: ['foco', 'gestion', 'estrategia', 'buffer'],
  todos: ['guion', 'grabacion', 'edicion', 'foco', 'gestion', 'estrategia', 'buffer'],
};

function formatMinutes(min: number): string {
  if (min <= 0) return '0h';
  const hours = Math.floor(min / 60);
  const remainingMin = min % 60;
  if (remainingMin === 0) return `${hours}h`;
  if (hours === 0) return `${remainingMin}m`;
  return `${hours}h ${remainingMin}m`;
}

function formatSecondsClock(totalSec: number): string {
  if (totalSec <= 0) return '00:00';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getCurrentTimeHHMM(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0');
  return `${hh}:${mm}`;
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hStr, mStr] = timeStr.split(':');
  let totalMin = (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0) + minutes;
  totalMin = (totalMin % (24 * 60) + 24 * 60) % (24 * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isSlotNow(startHHMM: string, endHHMM: string, isTodayDate: boolean): boolean {
  if (!isTodayDate) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  if (endMin < startMin) {
    return currentMinutes >= startMin || currentMinutes < endMin;
  }
  return currentMinutes >= startMin && currentMinutes < endMin;
}

export const DailyTimeBudgetWidget: React.FC<Props> = ({
  dateStr,
  isToday = true,
  className = '',
  defaultCollapsed = false,
}) => {
  const [budget, setBudget] = useState<DailyAllocation>(() => createDefaultDailyBudget(dateStr));
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showPhilosophyHelp, setShowPhilosophyHelp] = useState(false);
  const [nowSec, setNowSec] = useState<number>(() => Date.now());

  const alarmFiredRef = useRef<boolean>(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reloj de segundo continuo para el temporizador de sesión activa
  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Suscripción en tiempo real a Firestore para la fecha
  useEffect(() => {
    const unsub = subscribeDailyBudget(dateStr, (remoteBudget) => {
      setBudget(remoteBudget);
    });
    return () => {
      unsub();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [dateStr]);

  // Guardado optimista y remoto con debounce
  const updateAndPersistBudget = (updater: (prev: DailyAllocation) => DailyAllocation) => {
    setBudget((prev) => {
      const next = updater(prev);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveDailyBudgetToFirestore(next).catch((err) => {
          console.error('Error saving daily budget:', err);
        });
      }, 400);
      return next;
    });
  };

  // Cálculo de tiempo restante en la sesión activa
  const activeSession = budget.activeSession;
  const isSessionRunning = Boolean(activeSession && activeSession.isRunning);
  
  const remainingSecondsInSession = useMemo(() => {
    if (!activeSession) return 0;
    return Math.floor((activeSession.targetEndTimestamp - nowSec) / 1000);
  }, [activeSession, nowSec]);

  const isSessionTimeUp = Boolean(activeSession && remainingSecondsInSession <= 0);

  // Disparo de alarma cuando se cumple el tiempo
  useEffect(() => {
    if (isSessionRunning && isSessionTimeUp && !activeSession?.isAlarmDismissed && !alarmFiredRef.current) {
      alarmFiredRef.current = true;
      playTimeboxAlarm();
      hapticFeedback.heavy();
    }
  }, [isSessionRunning, isSessionTimeUp, activeSession?.isAlarmDismissed]);

  useEffect(() => {
    if (activeSession?.targetEndTimestamp && remainingSecondsInSession > 5) {
      alarmFiredRef.current = false;
    }
  }, [activeSession?.targetEndTimestamp, remainingSecondsInSession]);

  // Cálculos de balance general
  const isPaused = Boolean(budget.isPaused);
  const targetHours = budget.targetHours || 0;
  const targetMinutes = targetHours * 60;
  const currentMode: DailyAllocationMode = budget.mode || 'libre';
  const activePreset = budget.activePreset || 'creador';

  const visibleBucketKeys = PRESET_BUCKETS[activePreset] || PRESET_BUCKETS.creador;

  const totalAllocatedMinutes = useMemo(() => {
    return visibleBucketKeys.reduce((sum, key) => {
      return sum + (budget.buckets[key]?.allocatedMinutes || 0);
    }, 0);
  }, [budget.buckets, visibleBucketKeys]);

  const totalCompletedMinutes = useMemo(() => {
    return visibleBucketKeys.reduce((sum, key) => {
      const b = budget.buckets[key];
      if (!b) return sum;
      if (b.completed) return sum + (b.allocatedMinutes || 0);
      return sum + (b.completedMinutes || 0);
    }, 0);
  }, [budget.buckets, visibleBucketKeys]);

  const cronoStartTime = budget.startTime || getCurrentTimeHHMM();

  // Generar secuencia horaria para el modo cronograma
  const cronoSchedule = useMemo(() => {
    if (totalAllocatedMinutes <= 0) return [];
    let curTime = cronoStartTime;
    const schedule: Array<{
      key: DailyAllocationBucketId;
      bucket: DailyBucketAllocation;
      startTime: string;
      endTime: string;
      isCurrent: boolean;
    }> = [];

    visibleBucketKeys.forEach((key) => {
      const b = budget.buckets[key];
      if (!b) return;
      const mins = b.allocatedMinutes || 0;
      if (mins > 0) {
        const nextTime = addMinutesToTime(curTime, mins);
        schedule.push({
          key,
          bucket: b,
          startTime: curTime,
          endTime: nextTime,
          isCurrent: isSlotNow(curTime, nextTime, isToday),
        });
        curTime = nextTime;
      }
    });

    return schedule;
  }, [budget.buckets, cronoStartTime, totalAllocatedMinutes, isToday, visibleBucketKeys]);

  const handleSetTargetHours = (hours: number) => {
    hapticFeedback.selection();
    updateAndPersistBudget((prev) => ({
      ...prev,
      targetHours: Math.max(0, Math.min(16, hours)),
      isPaused: false,
    }));
  };

  const handleToggleMode = (newMode: DailyAllocationMode) => {
    hapticFeedback.selection();
    setShowOptionsMenu(false);
    updateAndPersistBudget((prev) => ({
      ...prev,
      mode: newMode,
      startTime: prev.startTime || getCurrentTimeHHMM(),
    }));
  };

  const handleSelectPreset = (preset: 'creador' | 'estudio' | 'todos') => {
    hapticFeedback.selection();
    updateAndPersistBudget((prev) => ({
      ...prev,
      activePreset: preset,
    }));
  };

  const handleChangeStartTime = (newTime: string) => {
    updateAndPersistBudget((prev) => ({
      ...prev,
      startTime: newTime,
    }));
  };

  const handleTogglePauseDay = () => {
    hapticFeedback.medium();
    setShowOptionsMenu(false);
    updateAndPersistBudget((prev) => ({
      ...prev,
      isPaused: !prev.isPaused,
    }));
  };

  // -------------------------------------------------------------
  // CONTROL DE SESIÓN ACTIVA (TIMEBOXING)
  // -------------------------------------------------------------
  const handleStartSession = (bucketId: DailyAllocationBucketId, initialMins = 45) => {
    hapticFeedback.medium();
    const bucket = budget.buckets[bucketId] || DEFAULT_DAILY_BUCKETS[bucketId];
    const label = bucket.label;
    const now = Date.now();
    const end = now + initialMins * 60 * 1000;

    alarmFiredRef.current = false;

    updateAndPersistBudget((prev) => ({
      ...prev,
      isPaused: false,
      activeSession: {
        bucketId,
        label,
        initialMinutes: initialMins,
        extendedMinutes: 0,
        targetEndTimestamp: end,
        isRunning: true,
        isAlarmDismissed: false,
        startedAt: new Date().toISOString(),
      },
    }));
  };

  const handleExtendSession = (extraMins: number) => {
    hapticFeedback.medium();
    alarmFiredRef.current = false;

    updateAndPersistBudget((prev) => {
      if (!prev.activeSession) return prev;
      const currentEnd = Math.max(Date.now(), prev.activeSession.targetEndTimestamp);
      const newEnd = currentEnd + extraMins * 60 * 1000;
      const newExtended = (prev.activeSession.extendedMinutes || 0) + extraMins;

      const bucketId = prev.activeSession.bucketId;
      const currentBucket = prev.buckets[bucketId] || DEFAULT_DAILY_BUCKETS[bucketId];
      const updatedAllocated = (currentBucket.allocatedMinutes || 0) + extraMins;

      return {
        ...prev,
        activeSession: {
          ...prev.activeSession,
          extendedMinutes: newExtended,
          targetEndTimestamp: newEnd,
          isRunning: true,
          isAlarmDismissed: false,
        },
        buckets: {
          ...prev.buckets,
          [bucketId]: {
            ...currentBucket,
            allocatedMinutes: updatedAllocated,
          },
        },
      };
    });
  };

  const handleCompleteActiveSession = (nextBucketId?: DailyAllocationBucketId) => {
    hapticFeedback.heavy();
    playTaskDone();

    updateAndPersistBudget((prev) => {
      if (!prev.activeSession) return prev;
      const bucketId = prev.activeSession.bucketId;
      const currentBucket = prev.buckets[bucketId] || DEFAULT_DAILY_BUCKETS[bucketId];
      const totalSessionMins = prev.activeSession.initialMinutes + (prev.activeSession.extendedMinutes || 0);

      const updatedBuckets = {
        ...prev.buckets,
        [bucketId]: {
          ...currentBucket,
          completed: true,
          completedMinutes: Math.max(currentBucket.completedMinutes || 0, totalSessionMins),
          allocatedMinutes: Math.max(currentBucket.allocatedMinutes || 0, totalSessionMins),
        },
      };

      let nextSession: ActiveTimeboxSession | null = null;
      if (nextBucketId) {
        const nextBucket = updatedBuckets[nextBucketId] || DEFAULT_DAILY_BUCKETS[nextBucketId];
        const initialNextMins = nextBucket.allocatedMinutes || 45;
        nextSession = {
          bucketId: nextBucketId,
          label: nextBucket.label,
          initialMinutes: initialNextMins,
          extendedMinutes: 0,
          targetEndTimestamp: Date.now() + initialNextMins * 60 * 1000,
          isRunning: true,
          isAlarmDismissed: false,
          startedAt: new Date().toISOString(),
        };
      }

      return {
        ...prev,
        activeSession: nextSession,
        buckets: updatedBuckets,
      };
    });
  };

  const handleCancelActiveSession = () => {
    hapticFeedback.light();
    updateAndPersistBudget((prev) => ({
      ...prev,
      activeSession: null,
    }));
  };

  const handleDismissAlarmBanner = () => {
    hapticFeedback.light();
    updateAndPersistBudget((prev) => ({
      ...prev,
      activeSession: prev.activeSession ? {
        ...prev.activeSession,
        isAlarmDismissed: true,
      } : null,
    }));
  };

  const handleAdjustMinutes = (bucketId: DailyAllocationBucketId, deltaMinutes: number) => {
    hapticFeedback.light();
    updateAndPersistBudget((prev) => {
      const current = prev.buckets[bucketId] || DEFAULT_DAILY_BUCKETS[bucketId];
      const newMinutes = Math.max(0, (current.allocatedMinutes || 0) + deltaMinutes);
      return {
        ...prev,
        isPaused: false,
        buckets: {
          ...prev.buckets,
          [bucketId]: {
            ...current,
            allocatedMinutes: newMinutes,
          },
        },
      };
    });
  };

  const handleToggleCompleted = (bucketId: DailyAllocationBucketId) => {
    hapticFeedback.medium();
    updateAndPersistBudget((prev) => {
      const current = prev.buckets[bucketId] || DEFAULT_DAILY_BUCKETS[bucketId];
      const nextCompleted = !current.completed;
      return {
        ...prev,
        buckets: {
          ...prev.buckets,
          [bucketId]: {
            ...current,
            completed: nextCompleted,
            completedMinutes: nextCompleted ? current.allocatedMinutes : 0,
          },
        },
      };
    });
  };

  const handleResetDay = () => {
    hapticFeedback.medium();
    setShowOptionsMenu(false);
    const def = createDefaultDailyBudget(dateStr, budget.targetHours || 6);
    updateAndPersistBudget(() => def);
  };

  // ESTADO PAUSADO
  if (isPaused) {
    return (
      <div className={`rounded-2xl bg-zinc-900 border border-zinc-800 p-4 flex items-center justify-between gap-3 text-zinc-400 w-full max-w-full min-w-0 overflow-hidden ${className}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
            <PauseCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-200 truncate">
              Jornada pausada para hoy
            </p>
            <p className="text-xs text-zinc-500 truncate">
              Sin metas fijas ni reloj.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTogglePauseDay}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 shadow-sm"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Activar</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] overflow-hidden w-full max-w-full min-w-0 ${className}`}>
      {/* ============================================================ */}
      {/* 1. CABECERA LIMPIA Y ERGONÓMICA (Pensada 100% para móvil)    */}
      {/* ============================================================ */}
      <div className="p-3.5 sm:p-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          {/* Título & Badge Hoy */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-400 shrink-0">
              <Film className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-100 truncate">
                  Bloques de Jornada
                </h3>
                {isToday && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    HOY
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 truncate">
                {activeSession ? `En curso: ${activeSession.label}` : 'Timeboxing elástico para video y tareas'}
              </p>
            </div>
          </div>

          {/* Acciones principales de cabecera: Menú de opciones + Colapso */}
          <div className="flex items-center gap-1 shrink-0 relative">
            <button
              type="button"
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl transition flex items-center justify-center cursor-pointer ${
                showOptionsMenu ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
              title="Más opciones de jornada"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setIsCollapsed(!isCollapsed);
              }}
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition flex items-center justify-center cursor-pointer"
              title={isCollapsed ? 'Desplegar bloques' : 'Colapsar bloques'}
            >
              {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>

            {/* MENÚ DESPLEGABLE CONTEXTUAL DE OPCIONES */}
            {showOptionsMenu && (
              <div className="absolute right-0 top-12 z-50 w-56 p-1.5 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => handleToggleMode(currentMode === 'libre' ? 'cronograma' : 'libre')}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition flex items-center gap-2.5 text-left"
                >
                  {currentMode === 'libre' ? <ListOrdered className="w-4 h-4 text-blue-400" /> : <Grid className="w-4 h-4 text-blue-400" />}
                  <span>Cambiar a {currentMode === 'libre' ? 'Cronograma' : 'Modo Libre'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPhilosophyHelp(!showPhilosophyHelp);
                    setShowOptionsMenu(false);
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition flex items-center gap-2.5 text-left"
                >
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                  <span>¿Cómo funciona el timeboxing?</span>
                </button>

                <button
                  type="button"
                  onClick={handleTogglePauseDay}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition flex items-center gap-2.5 text-left"
                >
                  <PauseCircle className="w-4 h-4 text-zinc-400" />
                  <span>Pausar jornada por hoy</span>
                </button>

                <div className="border-t border-zinc-800/80 my-1" />

                <button
                  type="button"
                  onClick={handleResetDay}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition flex items-center gap-2.5 text-left"
                >
                  <RotateCcw className="w-4 h-4 text-rose-400" />
                  <span>Restablecer sugeridos</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* EXPLICACIÓN CONCEPTUAL SI SE SOLICITA */}
        {showPhilosophyHelp && (
          <div className="mt-3 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 space-y-2 relative">
            <button
              type="button"
              onClick={() => setShowPhilosophyHelp(false)}
              className="absolute top-2.5 right-2.5 text-zinc-500 hover:text-zinc-300 p-1"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="font-bold text-zinc-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-rose-400" />
              ¿Por qué bloques elásticos en lugar de adivinar horas?
            </p>
            <p className="text-zinc-400 leading-relaxed">
              En grabación y edición nunca se sabe cuánto va a durar una toma. 
              En lugar de frustrarte adivinando:
            </p>
            <p className="text-zinc-300">
              1. Dale a <strong>"▶ Iniciar"</strong> con 45m de arranque.<br/>
              2. Trabajas sin mirar el reloj.<br/>
              3. Al sonar la campana, con 1 toque decides si <strong>extiendes +30m</strong> o si terminas y pasas a la siguiente etapa.
            </p>
          </div>
        )}

        {/* SELECTOR DE ENFOQUE (TABS GRANDES Y CÓMODAS EN MÓVIL) */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => handleSelectPreset('creador')}
            className={`min-h-[40px] py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 ${
              activePreset === 'creador'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Film className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Video</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectPreset('estudio')}
            className={`min-h-[40px] py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 ${
              activePreset === 'estudio'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Estudio</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectPreset('todos')}
            className={`min-h-[40px] py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 ${
              activePreset === 'todos'
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Todos</span>
          </button>
        </div>

        {/* SELECTOR DE CAPACIDAD (CHIPS LIMPIOS Y ESPACIOSOS) */}
        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            Capacidad:
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSetTargetHours(0)}
              className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 ${
                targetHours === 0
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'bg-zinc-950 text-zinc-500 border border-zinc-800/80 hover:text-zinc-300'
              }`}
            >
              Libre
            </button>
            {[4, 6, 8].map((h) => {
              const active = targetHours === h;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => handleSetTargetHours(h)}
                  className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                      : 'bg-zinc-950 text-zinc-400 border border-zinc-800/80 hover:text-zinc-200'
                  }`}
                >
                  {h}h
                </button>
              );
            })}
          </div>
        </div>

        {/* BARRA DE PROGRESO MULTI-COLOR DE LAS BOLSAS */}
        {totalAllocatedMinutes > 0 && (
          <div className="mt-3 pt-2.5 border-t border-zinc-800/50 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>
                Planificado: <strong className="text-zinc-200">{formatMinutes(totalAllocatedMinutes)}</strong>
                {targetHours > 0 && (
                  <> de <strong className="text-zinc-200">{targetHours}h</strong></>
                )}
              </span>
              <span>
                Cumplido: <strong className="text-emerald-400">{formatMinutes(totalCompletedMinutes)}</strong>
              </span>
            </div>

            <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800">
              {visibleBucketKeys.map((key) => {
                const b = budget.buckets[key];
                const minutes = b?.allocatedMinutes || 0;
                if (minutes <= 0) return null;
                const denominator = targetMinutes > 0 ? Math.max(targetMinutes, totalAllocatedMinutes) : totalAllocatedMinutes;
                const pct = (minutes / denominator) * 100;
                const cfg = BUCKET_CONFIG[key];

                return (
                  <div
                    key={key}
                    style={{ width: `${pct}%` }}
                    className={`${cfg.progressBarColor} h-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300`}
                    title={`${b.label}: ${formatMinutes(minutes)}`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. PANEL HERO: SESIÓN ACTIVA / AVISO DE FIN (Timebox)         */}
      {/* ============================================================ */}
      {activeSession && (
        <div 
          className={`p-3.5 sm:p-4 border-b transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] ${
            isSessionTimeUp
              ? 'bg-amber-500/15 border-amber-500/40 ring-1 ring-amber-500/30'
              : 'bg-zinc-950 border-zinc-800'
          }`}
        >
          {isSessionTimeUp ? (
            /* CASO TIEMPO CUMPLIDO: BOTONES GRANDES Y CLAROS */
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 animate-bounce">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-amber-300">
                      ¡Tiempo cumplido en {activeSession.label}!
                    </h4>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      ¿Terminaste o necesitas seguir con este bloque?
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDismissAlarmBanner}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Botones táctiles de extensión o finalización */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleExtendSession(15)}
                    className="min-h-[44px] px-2 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-amber-300 text-xs font-bold border border-amber-500/30 transition flex items-center justify-center"
                  >
                    +15 min
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExtendSession(30)}
                    className="min-h-[44px] px-2 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-amber-300 text-xs font-bold border border-amber-500/30 transition flex items-center justify-center"
                  >
                    +30 min
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExtendSession(60)}
                    className="min-h-[44px] px-2 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-amber-300 text-xs font-bold border border-amber-500/30 transition flex items-center justify-center"
                  >
                    +1 hora
                  </button>
                </div>

                {activeSession.bucketId === 'grabacion' && (
                  <button
                    type="button"
                    onClick={() => handleCompleteActiveSession('edicion')}
                    className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 active:scale-98 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Scissors className="w-4 h-4" />
                    <span>✓ Terminé tomas · Pasar a Edición</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleCompleteActiveSession()}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>✓ Terminado · Guardar tiempo</span>
                </button>
              </div>
            </div>
          ) : (
            /* CASO TEMPORIZADOR EN CURSO */
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 rounded-xl ${BUCKET_CONFIG[activeSession.bucketId]?.badgeBg || 'bg-blue-500/15'} flex items-center justify-center ${BUCKET_CONFIG[activeSession.bucketId]?.badgeText || 'text-blue-400'} shrink-0`}>
                  {React.createElement(BUCKET_CONFIG[activeSession.bucketId]?.icon || Clock, { className: 'w-4 h-4' })}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-zinc-100 truncate">
                      {activeSession.label}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 animate-pulse">
                      ACTIVO
                    </span>
                  </div>
                  <div className="font-mono text-base font-black text-rose-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-rose-400 animate-spin" style={{ animationDuration: '8s' }} />
                    <span>{formatSecondsClock(remainingSecondsInSession)}</span>
                  </div>
                </div>
              </div>

              {/* Botones de acción directa en la barra */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleExtendSession(15)}
                  className="min-h-[44px] px-2.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 text-xs font-bold transition"
                  title="Sumar 15m"
                >
                  +15m
                </button>

                <button
                  type="button"
                  onClick={() => handleCompleteActiveSession()}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Listo</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelActiveSession}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-500 hover:text-zinc-300 rounded-xl"
                  title="Cancelar temporizador"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. LISTA DE BLOQUES (Tarjetas limpias, táctiles y espaciosas) */}
      {/* ============================================================ */}
      {!isCollapsed && (
        <div className="p-3 sm:p-4 space-y-2.5">
          {/* MODO CRONOGRAMA */}
          {currentMode === 'cronograma' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-xs font-medium text-zinc-300">Hora arranque:</span>
                  <input
                    type="time"
                    value={cronoStartTime}
                    onChange={(e) => handleChangeStartTime(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleChangeStartTime(getCurrentTimeHHMM())}
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold ml-1 cursor-pointer"
                  >
                    Ahora
                  </button>
                </div>
              </div>

              {cronoSchedule.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-xs">
                  Aún no hay tiempo asignado. Suma horas en los bloques para calcular franjas.
                </div>
              ) : (
                <div className="space-y-2">
                  {cronoSchedule.map(({ key, bucket, startTime, endTime, isCurrent }) => {
                    const cfg = BUCKET_CONFIG[key];
                    const Icon = cfg.icon;
                    const isDone = bucket.completed;
                    const isSessionThis = activeSession?.bucketId === key;

                    return (
                      <div
                        key={key}
                        className={`p-3 rounded-2xl border transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] ${
                          isSessionThis
                            ? `bg-zinc-900 ${cfg.borderActive} shadow-md`
                            : isCurrent
                            ? `bg-zinc-900 border-blue-500/50 ring-1 ring-blue-500/30`
                            : isDone
                            ? 'bg-zinc-900/60 border-emerald-500/20 opacity-80'
                            : 'bg-zinc-950 border-zinc-800/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-xl ${cfg.badgeBg} flex items-center justify-center ${cfg.badgeText} shrink-0`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-zinc-200">
                                  {startTime} — {endTime}
                                </span>
                                <span className="text-xs font-semibold text-zinc-300 truncate">
                                  {bucket.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!isSessionThis && (
                              <button
                                type="button"
                                onClick={() => handleStartSession(key, bucket.allocatedMinutes || 45)}
                                className="min-h-[44px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 text-rose-400 fill-current" />
                                <span>Iniciar</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleToggleCompleted(key)}
                              className={`min-h-[44px] min-w-[44px] p-2 rounded-xl flex items-center justify-center transition cursor-pointer active:scale-95 ${
                                isDone ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* MODO LIBRE: FILAS LIMPIAS, DESATURADAS Y SIN SOBRECARGA EN REPOSO */
            <div className="space-y-2">
              {visibleBucketKeys.map((key) => {
                const b = budget.buckets[key] || DEFAULT_DAILY_BUCKETS[key];
                const cfg = BUCKET_CONFIG[key];
                const Icon = cfg.icon;
                const isDone = b.completed;
                const isSessionThis = activeSession?.bucketId === key;

                return (
                  <div
                    key={key}
                    className={`group p-3 rounded-xl border transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] ${
                      isSessionThis
                        ? 'bg-zinc-900 border-[var(--accent)]/60 shadow-md'
                        : isDone 
                        ? 'bg-zinc-950/60 border-zinc-800/60 opacity-60' 
                        : b.allocatedMinutes > 0
                        ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                        : 'bg-zinc-950/40 border-zinc-800/50 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Info izquierda */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-lg ${cfg.badgeBg} flex items-center justify-center ${cfg.badgeText} shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-semibold text-zinc-100 truncate">
                              {b.label}
                            </h4>
                            <span className="text-[10px] font-mono font-medium text-zinc-400 bg-zinc-800/80 px-1.5 py-0.2 rounded border border-zinc-700/50">
                              {formatMinutes(b.allocatedMinutes)}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {b.description}
                          </p>
                        </div>
                      </div>

                      {/* Controles a la derecha (agrupados limpiamente, sin saturar) */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Stepper +/- compacto: sutil en reposo, claro al interactuar */}
                        <div className="opacity-70 group-hover:opacity-100 flex items-center bg-zinc-900 rounded-lg border border-zinc-800 p-0.5 transition">
                          <button
                            type="button"
                            onClick={() => handleAdjustMinutes(key, -30)}
                            disabled={b.allocatedMinutes <= 0}
                            className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-zinc-200 disabled:opacity-20 active:scale-90"
                            title="Restar 30m"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-[11px] font-mono text-zinc-300 w-8 text-center">
                            {b.allocatedMinutes > 0 ? `${b.allocatedMinutes}m` : '0m'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAdjustMinutes(key, 30)}
                            className="w-7 h-7 flex items-center justify-center text-zinc-300 hover:text-white active:scale-90"
                            title="Sumar 30m"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Iniciar bloque */}
                        <button
                          type="button"
                          onClick={() => handleStartSession(key, b.allocatedMinutes > 0 ? b.allocatedMinutes : 45)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                            isSessionThis
                              ? 'bg-[var(--accent)] text-white shadow-sm'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80'
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current text-zinc-300" />
                          <span className="hidden sm:inline">{isSessionThis ? 'En curso' : 'Iniciar'}</span>
                        </button>

                        {/* Check completado */}
                        <button
                          type="button"
                          onClick={() => handleToggleCompleted(key)}
                          className={`p-1.5 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-95 ${
                            isDone
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                          }`}
                          title={isDone ? 'Marcar pendiente' : 'Marcar cumplido'}
                        >
                          {isDone ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Circle className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
