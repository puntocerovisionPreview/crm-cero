import React from 'react';
import { 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  Search, 
  Clock, 
  Sparkles,
  Settings,
  Server,
  Sun,
  Moon
} from 'lucide-react';
import { SyncStatus } from '../types';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  title?: string;
  subtitle?: string;
  breadcrumbs?: { label: string; path?: string }[];
  showBackButton?: boolean;
  onBack?: () => void;
  onNavigate?: (path: string) => void;
  syncStatus: SyncStatus;
  privacyMode: boolean;
  onTogglePrivacy: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onLockSession?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenGeminiChat?: () => void;
  onExportJSON?: () => void;
  onExportCSV?: () => void;
  onImportJSON?: (file: File) => void;
  onResetDatabase?: () => void;
  onOpenRepairTaskLinks?: () => void;
  onOpenIosWidgets?: () => void;
  onOpenPomodoro?: () => void;
  onForceSync?: () => void;
  onOpenPafPricing?: () => void;
  onOpenStudioPaymentSettings?: () => void;
  theme?: string;
  onToggleTheme?: () => void;
  pomodoroState?: {
    isRunning: boolean;
    timeLeft: number;
    mode: 'focus' | 'shortBreak' | 'longBreak';
    onTogglePlay?: () => void;
    onOpenModal?: () => void;
  };
  onOpenSettings?: () => void;
}

export const AppTopBar: React.FC<Props> = ({
  title,
  subtitle,
  breadcrumbs = [],
  showBackButton = false,
  onBack,
  onNavigate,
  syncStatus,
  privacyMode,
  onTogglePrivacy,
  onOpenCommandPalette,
  onOpenGeminiChat,
  pomodoroState,
  onOpenSettings,
  theme,
  onToggleTheme,
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSettingsClick = () => {
    hapticFeedback.light();
    if (onOpenSettings) {
      onOpenSettings();
    } else if (onNavigate) {
      onNavigate('/ajustes');
    }
  };

  const handlePomodoroClick = () => {
    hapticFeedback.light();
    if (onNavigate) {
      onNavigate('/foco');
    } else if (pomodoroState?.onOpenModal) {
      pomodoroState.onOpenModal();
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[var(--bg-app)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] text-[var(--text-primary)] transition-colors select-none safe-area-top-header">
      <div className="h-14 px-3 sm:px-5 flex items-center justify-between gap-3 max-w-full">
        {/* Left: Navigation, Breadcrumbs & Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          {showBackButton && onBack && (
            <button
              onClick={() => {
                hapticFeedback.light();
                onBack();
              }}
              className="min-w-[42px] min-h-[42px] sm:min-w-[32px] sm:min-h-[32px] p-2.5 sm:p-1.5 flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer shrink-0 active:scale-90"
              title="Volver"
              aria-label="Volver"
            >
              <ArrowLeft className="w-4 h-4 stroke-[1.5]" />
            </button>
          )}

          {breadcrumbs.length > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] truncate">
              {breadcrumbs.map((b, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-[var(--text-tertiary)]">/</span>}
                  <span 
                    onClick={() => b.path && onNavigate && onNavigate(b.path)}
                    className={idx === breadcrumbs.length - 1 ? 'font-semibold text-[var(--text-primary)] truncate' : 'truncate hover:underline cursor-pointer'}
                  >
                    {b.label}
                  </span>
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-[var(--text-primary)] font-heading truncate">
                {title || 'Punto Cero'}
              </h1>
              {subtitle && (
                <p className="text-[10px] text-[var(--text-secondary)] truncate leading-none mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: Pomodoro mini-indicator, Search, Privacy, Sync, Copilot, Settings */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Pomodoro Timer Mini-indicator if active */}
          {pomodoroState && (pomodoroState.isRunning || pomodoroState.timeLeft < 25 * 60) && (
            <button
              onClick={handlePomodoroClick}
              className={`px-2 py-1 rounded-[var(--radius-control)] border text-xs font-mono font-medium flex items-center gap-1 transition cursor-pointer ${
                pomodoroState.isRunning 
                  ? 'border-[#16A34A] text-[#16A34A] bg-[#16A34A]/10 animate-pulse' 
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
              title="Ir a Modo Foco"
            >
              <Clock className="w-3 h-3 stroke-[1.5]" />
              <span>{formatTime(pomodoroState.timeLeft)}</span>
            </button>
          )}

          {/* Quick Search on desktop */}
          {onOpenCommandPalette && (
            <button
              onClick={() => {
                hapticFeedback.light();
                onOpenCommandPalette();
              }}
              className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-xs text-[var(--text-secondary)] transition cursor-pointer"
              title="Buscar (⌘K)"
            >
              <Search className="w-3.5 h-3.5 stroke-[1.5]" />
              <span className="text-[11px] font-mono">⌘K</span>
            </button>
          )}

          {/* Theme Toggle (Claro / Oscuro) */}
          {onToggleTheme && (
            <button
              onClick={() => {
                hapticFeedback.light();
                onToggleTheme();
              }}
              className="min-w-[42px] min-h-[42px] sm:min-w-[32px] sm:min-h-[32px] p-2.5 sm:p-1.5 flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer t-press"
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 stroke-[1.5] text-amber-400 transition-transform duration-300 hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 stroke-[1.5] text-sky-500 transition-transform duration-300 hover:-rotate-12" />
              )}
            </button>
          )}

          {/* Privacy Toggle */}
          <button
            onClick={() => {
              hapticFeedback.light();
              onTogglePrivacy();
            }}
            className="min-w-[42px] min-h-[42px] sm:min-w-[32px] sm:min-h-[32px] p-2.5 sm:p-1.5 flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer t-press"
            title={privacyMode ? 'Mostrar montos' : 'Modo privacidad ($ ••••••)'}
            aria-label="Modo privacidad"
          >
            {privacyMode ? <EyeOff className="w-4 h-4 stroke-[1.5]" /> : <Eye className="w-4 h-4 stroke-[1.5]" />}
          </button>

          {/* Sync Dot (Discreet Color Dot, no text) */}
          <div 
            className="flex items-center justify-center w-7 h-7"
            title={syncStatus === 'synced' ? 'Sincronizado' : 'Sincronizando con la nube...'}
          >
            <span className={`w-2 h-2 rounded-full t-badge-pop ${syncStatus === 'synced' ? 'bg-[#16A34A]' : 'bg-[#D97706] animate-pulse'}`} />
          </div>

          {/* Copilot Assistant Button */}
          {onOpenGeminiChat && (
            <button
              onClick={() => {
                hapticFeedback.light();
                onOpenGeminiChat();
              }}
              className="min-w-[42px] min-h-[42px] sm:min-w-[32px] sm:min-h-[32px] p-2.5 sm:p-1.5 flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--accent)] transition cursor-pointer active:scale-90"
              title="Copiloto IA"
              aria-label="Copiloto IA"
            >
              <Sparkles className="w-4 h-4 stroke-[1.75]" />
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={handleSettingsClick}
            className="min-w-[42px] min-h-[42px] sm:min-w-[32px] sm:min-h-[32px] p-2.5 sm:p-1.5 flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer active:scale-90"
            title="Ajustes y configuración"
            aria-label="Ajustes"
          >
            <Settings className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>
      </div>
    </header>
  );
};
