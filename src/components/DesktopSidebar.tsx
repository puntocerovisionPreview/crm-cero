import React, { useState } from 'react';
import { 
  Calendar, 
  CalendarDays,
  Target,
  Users, 
  DollarSign, 
  Brain, 
  Settings, 
  Sparkles, 
  ChevronLeft, 
  Plus, 
  Search, 
  Lock, 
  Volume2, 
  VolumeX,
  Clock,
  Compass,
  Server,
  Globe,
  Sun,
  Moon
} from 'lucide-react';
import { Project, SyncStatus, AgendaTask, AgendaMeeting, IncomeRecord, ExpenseRecord } from '../types';
import { hapticFeedback } from '../utils/haptics';
import { BrandLogo } from './BrandLogo';
import { getUiPreferences } from '../utils/uiPreferences';
import { Send } from 'lucide-react';

interface Props {
  currentPath: string;
  onNavigate: (path: string) => void;
  projects?: Project[];
  tasks?: AgendaTask[];
  meetings?: AgendaMeeting[];
  incomes?: IncomeRecord[];
  expenses?: ExpenseRecord[];
  onOpenQuickAdd?: (type?: any) => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcuts?: () => void;
  onOpenPomodoro?: () => void;
  onOpenPafGuide?: () => void;
  privacyMode?: boolean;
  syncStatus?: SyncStatus;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onLockSession?: () => void;
  onOpenGeminiChat?: () => void;
  pomodoroState?: {
    isRunning: boolean;
    timeLeft: number;
    mode: 'focus' | 'shortBreak' | 'longBreak';
    onTogglePlay?: () => void;
    onOpenModal?: () => void;
  };
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const DesktopSidebar: React.FC<Props> = ({
  currentPath,
  onNavigate,
  projects = [],
  onOpenQuickAdd = () => {},
  onOpenCommandPalette = () => {},
  syncStatus = 'synced',
  soundEnabled = true,
  onToggleSound = () => {},
  onLockSession = () => {},
  onOpenGeminiChat,
  pomodoroState,
  theme,
  onToggleTheme,
}) => {
  // Collapsed state stored in localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cero_sidebar_collapsed');
      return saved === null ? false : saved === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    hapticFeedback.light();
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('cero_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const prefs = getUiPreferences();

  const isHoy = currentPath === '/' || currentPath === '/hoy' || currentPath === '/agenda';
  const isSemana = currentPath.startsWith('/semana') || currentPath.startsWith('/misiones');
  const isCalendario = currentPath === '/calendario' || currentPath === '/calendar';
  const isClientes = currentPath.startsWith('/clientes') || currentPath.startsWith('/proyectos');
  const isHorizonte = currentPath === '/horizonte' || currentPath === '/horizon' || currentPath === '/horozon';
  const isDinero = currentPath.startsWith('/dinero') || currentPath.startsWith('/finanzas') || currentPath.startsWith('/mis-finanzas');
  const isGastosFijos = currentPath === '/gastos-fijos' || currentPath === '/vencimientos' || currentPath === '/suscripciones' || currentPath === '/dominios';
  const isCerebro = currentPath.startsWith('/cerebro') || currentPath.startsWith('/notas') || currentPath.startsWith('/grafo') || currentPath.startsWith('/segundo-cerebro');
  const isAjustes = currentPath.startsWith('/ajustes') || currentPath === '/ayuda';
  const isProspeccion = currentPath.startsWith('/prospeccion');

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const activeClientsCount = projects.filter(p => p.status !== 'completado' && p.status !== 'cancelado' && p.status !== 'pausado').length;

  return (
    <aside 
      className={`hidden md:flex flex-col h-full bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] text-[var(--text-primary)] transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-200 select-none z-30 shrink-0 ${
        isCollapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* 1. Header with Logo & Collapse button */}
      <div className="h-14 px-3 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
        <div 
          onClick={() => onNavigate('/hoy')}
          className="flex items-center gap-2.5 cursor-pointer overflow-hidden"
          title="Ir a Hoy"
        >
          <BrandLogo size="xs" />
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
          title={isCollapsed ? 'Expandir barra (⌘B)' : 'Contraer barra (⌘B)'}
        >
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* 2. Quick Actions: Search & Add */}
      <div className="p-2 space-y-1.5 border-b border-[var(--border-subtle)]">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="w-10 h-10 rounded-lg hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition cursor-pointer"
              title="Buscar (⌘K)"
            >
              <Search className="w-4 h-4 stroke-[1.5]" />
            </button>
            <button
              type="button"
              onClick={() => onOpenQuickAdd('tarea')}
              className="w-10 h-10 rounded-lg btn-solid-primary flex items-center justify-center transition cursor-pointer active:scale-95 shadow-xs"
              title="Nueva tarea o registro"
            >
              <Plus className="w-4 h-4 stroke-[2]" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--bg-app)] hover:bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 stroke-[1.5]" />
                <span>Buscador</span>
              </div>
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-muted)] text-[10px] text-[var(--text-tertiary)] font-mono">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => onOpenQuickAdd('tarea')}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg btn-solid-primary text-xs font-semibold transition active:scale-95 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2]" />
              <span>Añadir rápido</span>
            </button>
          </>
        )}
      </div>

      {/* 3. Navigation Links (5 Sectors + Ajustes) */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 no-scrollbar">
        {/* Sector 1: Hoy */}
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            onNavigate('/hoy');
          }}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-medium transition cursor-pointer ${
            isHoy
              ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-[inset_3px_0_0_var(--accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
          }`}
          title="Hoy (Agenda, Foco y Metas)"
        >
          <div className="flex items-center gap-2.5 truncate">
            <Calendar className="w-4 h-4 shrink-0 stroke-[1.75]" />
            {!isCollapsed && <span className="truncate">Hoy</span>}
          </div>
          {!isCollapsed && (
            <kbd className="px-1.5 py-0.2 rounded bg-[var(--bg-surface-muted)] text-[10px] font-mono text-[var(--text-tertiary)]">
              1
            </kbd>
          )}
        </button>

        {/* Semana (Misiones de la semana) */}
        {isCollapsed ? (
          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              onNavigate('/semana');
            }}
            className={`w-full flex items-center justify-center p-2 rounded-lg text-[13px] font-medium transition cursor-pointer ${
              isSemana
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-[inset_3px_0_0_var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-surface-muted)]'
            }`}
            title="Misiones de la Semana (/semana)"
          >
            <Target className="w-4 h-4 shrink-0 text-[var(--accent)] stroke-[1.75]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              onNavigate('/semana');
            }}
            className={`w-full flex items-center justify-between pl-8 pr-2.5 py-1.5 rounded-lg text-[13px] font-medium transition cursor-pointer group ${
              isSemana
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-[inset_3px_0_0_var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-surface-muted)]'
            }`}
            title="Misiones de la Semana: Carriles, avance, capacidad y ritmo (/semana)"
          >
            <div className="flex items-center gap-2 truncate">
              <Target className="w-3.5 h-3.5 shrink-0 text-[var(--accent)] group-hover:scale-110 transition-transform" />
              <span className="truncate">Semana</span>
            </div>
          </button>
        )}

        {/* Calendario 360° (Vista Mensual) */}
        {isCollapsed ? (
          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              onNavigate('/calendario');
            }}
            className={`w-full flex items-center justify-center p-2 rounded-lg text-[13px] font-medium transition cursor-pointer ${
              isCalendario
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-[inset_3px_0_0_var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-amber-500 dark:hover:text-amber-300 hover:bg-[var(--bg-surface-muted)]'
            }`}
            title="Calendario 360° (Vista Mensual y Entregas) (C)"
          >
            <CalendarDays className="w-4 h-4 shrink-0 text-amber-500 dark:text-amber-400 stroke-[1.75]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              onNavigate('/calendario');
            }}
            className={`w-full flex items-center justify-between pl-8 pr-2.5 py-1.5 rounded-lg text-[13px] font-medium transition cursor-pointer group ${
              isCalendario
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-[inset_3px_0_0_var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-amber-600 dark:hover:text-amber-300 hover:bg-[var(--bg-surface-muted)]'
            }`}
            title="Calendario 360°: Vista global del mes, entregas, reuniones y cobros (C)"
          >
            <div className="flex items-center gap-2 truncate">
              <CalendarDays className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform" />
              <span className="truncate">Calendario</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="hidden group-hover:inline-block px-1 py-0.2 rounded bg-[var(--bg-surface-muted)] text-[9px] font-mono text-[var(--text-tertiary)]">
                C
              </kbd>
            </div>
          </button>
        )}

        {/* Sector 2: Clientes */}
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            onNavigate('/clientes');
          }}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-medium transition cursor-pointer ${
            isClientes
              ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-[inset_3px_0_0_var(--accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
          }`}
          title="Clientes (PAF, Web, Pipeline)"
        >
          <div className="flex items-center gap-2.5 truncate">
            <Users className="w-4 h-4 shrink-0 stroke-[1.75]" />
            {!isCollapsed && <span className="truncate">Clientes</span>}
          </div>
          {!isCollapsed && activeClientsCount > 0 && (
            <span className="text-[10.5px] font-mono text-[var(--text-tertiary)]">
              {activeClientsCount}
            </span>
          )}
        </button>

        {/* Horizonte (Largo Plazo, Gantt y Capacidad) */}
        {isCollapsed ? (
          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              onNavigate('/horizonte');
            }}
            className={`w-full flex items-center justify-center p-2 rounded-lg text-[13px] font-medium transition cursor-pointer ${
              isHorizonte
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-[inset_3px_0_0_var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-sky-600 dark:hover:text-sky-300 hover:bg-[var(--bg-surface-muted)]'
            }`}
            title="Horizonte: Planificación de largo plazo y cronograma Gantt (H)"
          >
            <Compass className="w-4 h-4 shrink-0 text-sky-500 dark:text-sky-400 stroke-[1.75]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              onNavigate('/horizonte');
            }}
            className={`w-full flex items-center justify-between pl-8 pr-2.5 py-1.5 rounded-lg text-[13px] font-medium transition cursor-pointer group ${
              isHorizonte
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-[inset_3px_0_0_var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-sky-600 dark:hover:text-sky-300 hover:bg-[var(--bg-surface-muted)]'
            }`}
            title="Horizonte: Planificación de largo plazo, Gantt y balance de frentes (H)"
          >
            <div className="flex items-center gap-2 truncate">
              <Compass className="w-3.5 h-3.5 shrink-0 text-sky-500 dark:text-sky-400 group-hover:rotate-45 transition-transform" />
              <span className="truncate">Horizonte</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="hidden group-hover:inline-block px-1 py-0.2 rounded bg-[var(--bg-surface-muted)] text-[9px] font-mono text-[var(--text-tertiary)]">
                H
              </kbd>
            </div>
          </button>
        )}

        {/* Prospección en frío */}
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            onNavigate('/prospeccion');
          }}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-medium transition cursor-pointer ${
            isProspeccion
              ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-[inset_3px_0_0_var(--accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
          }`}
          title="Prospección: contactos en frío, seguimientos y auditorías"
        >
          <div className="flex items-center gap-2.5 truncate">
            <Send className="w-4 h-4 shrink-0 stroke-[1.75]" />
            {!isCollapsed && <span className="truncate">Prospección</span>}
          </div>
        </button>

        {/* Sector 3: Dinero */}
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            onNavigate('/dinero');
          }}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-medium transition cursor-pointer ${
            isDinero
              ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-[inset_3px_0_0_var(--accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
          }`}
          title="Dinero (Estudio & Personal)"
        >
          <div className="flex items-center gap-2.5 truncate">
            <DollarSign className="w-4 h-4 shrink-0 stroke-[1.75]" />
            {!isCollapsed && <span className="truncate">Dinero</span>}
          </div>
          {!isCollapsed && (
            <kbd className="px-1.5 py-0.2 rounded bg-[var(--bg-surface-muted)] text-[10px] font-mono text-[var(--text-tertiary)]">
              3
            </kbd>
          )}
        </button>

        {/* Gastos Fijos & Vencimientos (Dominios, Hosting e IAs) */}
        {isCollapsed ? (
          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              onNavigate('/gastos-fijos');
            }}
            className={`w-full flex items-center justify-center p-2 rounded-lg text-[13px] font-medium transition cursor-pointer ${
              isGastosFijos
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-[inset_3px_0_0_var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-[var(--bg-surface-muted)]'
            }`}
            title="Gastos Fijos: Dominios, Hosting, IAs y Vencimientos"
          >
            <Server className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400 stroke-[1.75]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              onNavigate('/gastos-fijos');
            }}
            className={`w-full flex items-center justify-between pl-8 pr-2.5 py-1.5 rounded-lg text-[13px] font-medium transition cursor-pointer group ${
              isGastosFijos
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-[inset_3px_0_0_var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-[var(--bg-surface-muted)]'
            }`}
            title="Control de gastos fijos: Hosting, Dominios de clientes e IAs mensuales"
          >
            <div className="flex items-center gap-2 truncate">
              <Server className="w-3.5 h-3.5 shrink-0 text-emerald-500 dark:text-emerald-400 group-hover:rotate-12 transition-transform" />
              <span className="truncate">Gastos Fijos</span>
            </div>
            <div className="flex items-center gap-1">
            </div>
          </button>
        )}

        {/* Sector 4: Cerebro */}
        {!prefs.hideCerebro && (
          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              onNavigate('/cerebro');
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-medium transition cursor-pointer ${
              isCerebro
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-[inset_3px_0_0_var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
            }`}
            title="Segundo Cerebro (Notas & Grafo)"
          >
            <div className="flex items-center gap-2.5 truncate">
              <Brain className="w-4 h-4 shrink-0 stroke-[1.75]" />
              {!isCollapsed && <span className="truncate">Cerebro</span>}
            </div>
            {!isCollapsed && (
              <kbd className="px-1.5 py-0.2 rounded bg-[var(--bg-surface-muted)] text-[10px] font-mono text-[var(--text-tertiary)]">
                4
              </kbd>
            )}
          </button>
        )}

        {/* Sector 5: Ajustes */}
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            onNavigate('/ajustes');
          }}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-medium transition cursor-pointer ${
            isAjustes
              ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-[inset_3px_0_0_var(--accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
          }`}
          title="Ajustes y configuración"
        >
          <div className="flex items-center gap-2.5 truncate">
            <Settings className="w-4 h-4 shrink-0 stroke-[1.75]" />
            {!isCollapsed && <span className="truncate">Ajustes</span>}
          </div>
        </button>

        {/* Separator */}
        <div className="pt-2 border-t border-[var(--border-subtle)] my-1" />

        {/* Direct Modo Foco button */}
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            onNavigate('/foco');
          }}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-medium transition cursor-pointer text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20"
          title="Modo Foco (F)"
        >
          <div className="flex items-center gap-2.5 truncate">
            <Sparkles className="w-4 h-4 shrink-0 stroke-[2] animate-pulse" />
            {!isCollapsed && <span className="truncate font-semibold">Modo Foco</span>}
          </div>
          {!isCollapsed && (
            <kbd className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-300">
              F
            </kbd>
          )}
        </button>

        {/* Pomodoro Timer Badge if active */}
        {pomodoroState && (pomodoroState.isRunning || pomodoroState.timeLeft < 25 * 60) && (
          <button
            type="button"
            onClick={() => onNavigate('/foco')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
              pomodoroState.isRunning
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
            }`}
            title="Temporizador activo"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              {!isCollapsed && <span>{formatTime(pomodoroState.timeLeft)}</span>}
            </div>
            {!isCollapsed && (
              <span className="text-[10px]">{pomodoroState.isRunning ? 'En curso' : 'Pausado'}</span>
            )}
          </button>
        )}
      </div>

      {/* 4. Footer: Copilot, Lock, Audio & Sync */}
      <div className="p-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-1">
        {onOpenGeminiChat && (
          <button
            type="button"
            onClick={onOpenGeminiChat}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[var(--accent)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
            title="Copiloto IA"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span className="font-medium">Copiloto IA</span>}
          </button>
        )}

        <div className="flex items-center justify-between pt-1">
          {/* Lock Session */}
          <button
            type="button"
            onClick={onLockSession}
            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
            title="Cerrar sesión"
          >
            <Lock className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={onToggleSound}
            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
            title={soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 stroke-[1.5]" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 stroke-[1.5]" />
            )}
          </button>

          {/* Theme Toggle (Claro / Oscuro) */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 stroke-[1.5] text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 stroke-[1.5] text-sky-500" />
              )}
            </button>
          )}

          {/* Sync status indicator */}
          <div 
            className="flex items-center gap-1.5 px-1.5 py-0.5"
            title={syncStatus === 'synced' ? 'Sincronizado' : 'Sincronizando…'}
          >
            <span className={`w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-[#16A34A]' : 'bg-[#D97706] animate-pulse'}`} />
          </div>
        </div>
      </div>
    </aside>
  );
};
