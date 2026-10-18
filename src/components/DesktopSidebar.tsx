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
import { Send, Home } from 'lucide-react';
import { HOME_PATH, SECTORS, sectorForPath } from '../utils/sectors';

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
  const sector = sectorForPath(currentPath);
  const isInicio = currentPath === HOME_PATH;
  const visibleSectors = SECTORS.filter(sec => !(sec.key === 'cerebro' && prefs.hideCerebro));

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
          onClick={() => onNavigate(HOME_PATH)}
          className="flex items-center gap-2.5 cursor-pointer overflow-hidden"
          title="Ir a Inicio"
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

      {/* 3. Navegación por sector: en la Home, la lista de sectores; dentro de un sector, solo sus pantallas */}
      <nav aria-label={sector ? `Sector ${sector.label}` : 'Sectores del estudio'} className="flex-1 overflow-y-auto px-2 py-2 space-y-1 no-scrollbar">
        {sector ? (
          <>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                onNavigate(HOME_PATH);
              }}
              className={`w-full flex items-center gap-1 ${isCollapsed ? 'justify-center' : 'px-1.5'} h-8 rounded-[10px] text-[14px] text-[var(--accent)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer`}
              title="Volver a Inicio (elegir sector)"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" strokeWidth={2.25} />
              {!isCollapsed && <span>Inicio</span>}
            </button>

            <div className={`flex items-center gap-2 ${isCollapsed ? 'justify-center py-1.5' : 'px-2.5 pt-2 pb-1.5'}`}>
              <span className="w-6 h-6 rounded-[7px] flex items-center justify-center text-white shrink-0" style={{ backgroundColor: sector.tint }} aria-hidden>
                <sector.icon className="w-3.5 h-3.5" strokeWidth={2.25} />
              </span>
              {!isCollapsed && <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate">{sector.label}</span>}
            </div>

            {sector.items.map(item => {
              const on = item.match(currentPath);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    onNavigate(item.path);
                  }}
                  aria-current={on ? 'page' : undefined}
                  className={`w-full flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : 'px-2.5'} py-2 rounded-[10px] text-[13.5px] font-medium transition cursor-pointer ${
                    on
                      ? 'bg-[var(--accent)]/12 text-[var(--accent)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <item.icon className="w-4 h-4 shrink-0 stroke-[1.75]" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                onNavigate(HOME_PATH);
              }}
              aria-current={isInicio ? 'page' : undefined}
              className={`w-full flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : 'px-2.5'} py-2 rounded-[10px] text-[13.5px] font-medium transition cursor-pointer ${
                isInicio
                  ? 'bg-[var(--accent)]/12 text-[var(--accent)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
              }`}
              title="Inicio"
            >
              <Home className="w-4 h-4 shrink-0 stroke-[1.75]" />
              {!isCollapsed && <span className="truncate">Inicio</span>}
            </button>

            {!isCollapsed && <p className="px-2.5 pt-3 pb-1 text-[12px] font-medium text-[var(--text-tertiary)]">Sectores</p>}
            {visibleSectors.map(sec => (
              <button
                key={sec.key}
                type="button"
                onClick={() => {
                  hapticFeedback.selection();
                  onNavigate(sec.items[0].path);
                }}
                className={`w-full flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : 'px-2'} py-1.5 rounded-[10px] text-[13.5px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer`}
                title={sec.description}
              >
                <span className="w-6 h-6 rounded-[7px] flex items-center justify-center text-white shrink-0" style={{ backgroundColor: sec.tint }} aria-hidden>
                  <sec.icon className="w-3.5 h-3.5" strokeWidth={2.25} />
                </span>
                {!isCollapsed && <span className="truncate">{sec.label}</span>}
              </button>
            ))}
          </>
        )}

        <div className="pt-2 border-t border-[var(--border-subtle)] my-1" />

        {/* Sector 5: Ajustes */}
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            onNavigate('/ajustes');
          }}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-[10px] text-[13.5px] font-medium transition cursor-pointer ${
            isAjustes
              ? 'bg-[var(--accent)]/12 text-[var(--accent)] font-semibold'
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
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-[10px] text-[13.5px] font-medium transition cursor-pointer text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20"
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
      </nav>

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
