import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  Clock, 
  Volume2, 
  VolumeX, 
  Check
} from 'lucide-react';
import { Project, AgendaTask, TimeLog } from '../types';
import { hapticFeedback } from '../utils/haptics';
import { playAllDone, playTaskDone } from '../utils/sound';
import { todayLocal } from '../utils/dates';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  tasks?: AgendaTask[];
  onLogTime?: (projectId: string, minutes: number, description: string) => void;
  onAddTimeLog?: (logData: Omit<TimeLog, 'id' | 'createdAt'>) => void;
}

type Mode = 'focus' | 'shortBreak' | 'longBreak';

const PRESETS: Record<Mode, { label: string; defaultMinutes: number }> = {
  focus: { label: 'Foco (25m)', defaultMinutes: 25 },
  shortBreak: { label: 'Pausa (5m)', defaultMinutes: 5 },
  longBreak: { label: 'Descanso (15m)', defaultMinutes: 15 },
};

export const PomodoroModal: React.FC<Props> = ({
  isOpen,
  onClose,
  projects,
  tasks = [],
  onLogTime,
  onAddTimeLog,
}) => {
  const [mode, setMode] = useState<Mode>('focus');
  const [customMinutes, setCustomMinutes] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [soundAlert, setSoundAlert] = useState(true);

  // Selected linked items
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [customSessionNotes, setCustomSessionNotes] = useState('');

  // Daily stats
  const [completedPomodorosToday, setCompletedPomodorosToday] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('cero_pomodoros_today');
      if (!saved) return 0;
      const parsed = JSON.parse(saved);
      const todayStr = todayLocal();
      return parsed.date === todayStr ? (parsed.count || 0) : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Update total duration when mode changes
  const switchMode = (newMode: Mode, minutes?: number) => {
    setMode(newMode);
    const m = minutes || PRESETS[newMode].defaultMinutes;
    setCustomMinutes(m);
    setTimeLeft(m * 60);
    setIsRunning(false);
    hapticFeedback.selection();
  };

  // Timer Tick
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const handleTimerComplete = () => {
    setIsRunning(false);
    if (soundAlert) {
      playAllDone();
    }
    hapticFeedback.heavy();

    if (mode === 'focus') {
      const newCount = completedPomodorosToday + 1;
      setCompletedPomodorosToday(newCount);
      try {
        const todayStr = todayLocal();
        localStorage.setItem('cero_pomodoros_today', JSON.stringify({ date: todayStr, count: newCount }));
      } catch {}

      // Log time automatically if a project or task was selected
      if (selectedProjectId || selectedTaskId || customSessionNotes) {
        const desc = customSessionNotes.trim() || `Sesión de foco Pomodoro (${customMinutes} min)`;
        if (onAddTimeLog) {
          onAddTimeLog({
            date: todayLocal(),
            minutes: customMinutes,
            projectId: selectedProjectId || undefined,
            taskId: selectedTaskId || undefined,
            description: desc,
          });
        } else if (onLogTime && selectedProjectId) {
          onLogTime(selectedProjectId, customMinutes, desc);
        }
      }
    }
  };

  const handleToggleTimer = () => {
    hapticFeedback.medium();
    setIsRunning(prev => !prev);
  };

  const handleResetTimer = () => {
    hapticFeedback.light();
    setIsRunning(false);
    setTimeLeft(customMinutes * 60);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="card-swiss w-full max-w-md overflow-hidden shadow-sm t-modal-enter">
        
        {/* Top Header */}
        <div className="p-4 border-b border-[var(--border-divider)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="label-swiss text-[11px]">Temporizador Pomodoro</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
              {completedPomodorosToday} hoy
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSoundAlert(!soundAlert)}
              className="p-1.5 rounded-[var(--radius-control)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition"
              title={soundAlert ? 'Silenciar' : 'Activar sonido'}
            >
              {soundAlert ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[var(--radius-control)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Presets Pills */}
        <div className="p-4 pb-0 flex items-center justify-center gap-2">
          {(['focus', 'shortBreak', 'longBreak'] as Mode[]).map(m => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`px-3 py-1 rounded-[var(--radius-pill)] text-xs font-medium transition cursor-pointer border ${
                  active
                    ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] border-[var(--solid-contrast-bg)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {PRESETS[m].label}
              </button>
            );
          })}
        </div>

        {/* Massive Centered Time Display (25:00) */}
        <div className="py-10 flex flex-col items-center justify-center">
          <span className="text-6xl sm:text-7xl font-extrabold font-heading tabular-nums text-[var(--text-primary)] tracking-tighter">
            {timeFormatted}
          </span>
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            {isRunning ? 'Sesión en curso...' : 'Listo para iniciar bloque de foco'}
          </p>
        </div>

        {/* Primary Action Button (Solid Black "Empezar" / "Pausar") + Reset */}
        <div className="px-6 pb-6 flex items-center justify-center gap-3">
          <button
            onClick={handleToggleTimer}
            className="btn-solid-primary px-8 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 transition"
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Empezar</span>
              </>
            )}
          </button>

          <button
            onClick={handleResetTimer}
            className="btn-outline-swiss p-2.5 text-xs transition cursor-pointer"
            title="Reiniciar"
          >
            <RotateCcw className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Optional Project & Task Link */}
        <div className="px-4 py-3 bg-[var(--bg-surface-muted)] border-t border-[var(--border-divider)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2 w-full">
            <span className="label-swiss text-[10px] shrink-0">Asignar a:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent text-[var(--text-primary)] text-xs border-0 outline-none flex-1 truncate"
            >
              <option value="">(Sin vincular a proyecto)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.clientName}
                </option>
              ))}
            </select>
          </div>
        </div>

      </div>
    </div>
  );
};
