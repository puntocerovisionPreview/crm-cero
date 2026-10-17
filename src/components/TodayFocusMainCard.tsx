import React, { useState } from 'react';
import { AgendaTask, AgendaMeeting } from '../types';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  Flame,
  FastForward,
  Play
} from 'lucide-react';

interface Props {
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  onToggleTask: (id: string) => void;
  onToggleMeeting: (id: string) => void;
  onOpenFocus: () => void;
  onMoveOverdueToToday?: () => void;
}

export const TodayFocusMainCard: React.FC<Props> = ({
  tasks,
  meetings,
  onToggleTask,
  onToggleMeeting,
  onOpenFocus,
  onMoveOverdueToToday,
}) => {
  const todayStr = getTodayString();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ui_hoy_foco_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    hapticFeedback.light();
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('ui_hoy_foco_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const todayTasks = tasks.filter(t => t.date === todayStr);
  const todayPendingTasks = todayTasks.filter(t => !t.completed);
  const todayCompletedTasks = todayTasks.filter(t => t.completed);
  const todayMeetings = meetings.filter(m => m.date === todayStr);
  const todayPendingMeetings = todayMeetings.filter(m => !m.completed);

  const overdueTasks = tasks.filter(t => t.date < todayStr && !t.completed);

  const totalTodayItems = todayTasks.length + todayMeetings.length;
  const completedTodayCount = todayCompletedTasks.length + (todayMeetings.length - todayPendingMeetings.length);
  const progressPercent = totalTodayItems > 0 ? Math.round((completedTodayCount / totalTodayItems) * 100) : 100;

  // #1 Priority Task of Today (first active task with priority 'alta', or first active task)
  const mainTask = todayPendingTasks.find(t => t.priority === 'alta') || todayPendingTasks[0] || null;

  // Time-based greeting
  const currentHour = new Date().getHours();
  let greeting = '¡Buen día!';
  if (currentHour >= 13 && currentHour < 20) {
    greeting = '¡Buenas tardes!';
  } else if (currentHour >= 20 || currentHour < 6) {
    greeting = '¡Buenas noches!';
  }

  return (
    <div className="card-swiss overflow-hidden transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-200">
      {/* Header bar */}
      <div 
        onClick={toggleCollapsed}
        className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer select-none gap-3 hover:bg-[var(--bg-surface-muted)] transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4 stroke-[2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)] font-heading">
                Lo más importante hoy
              </span>
              <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                {completedTodayCount}/{totalTodayItems} ({progressPercent}%)
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] truncate">
              {greeting} {todayPendingTasks.length} {todayPendingTasks.length === 1 ? 'tarea pendiente' : 'tareas pendientes'}
              {todayPendingMeetings.length > 0 ? ` · ${todayPendingMeetings.length} reunión(es)` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              hapticFeedback.light();
              onOpenFocus();
            }}
            className="min-h-[44px] sm:min-h-[32px] px-2.5 py-1 rounded-[var(--radius-control)] border border-emerald-600/30 text-emerald-500 hover:bg-emerald-600/10 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Abrir Modo Foco (1 toque)"
          >
            <Play className="w-3 h-3 fill-current" />
            <span className="hidden sm:inline">Modo Foco</span>
          </button>

          <button
            type="button"
            aria-label={isCollapsed ? 'Expandir' : 'Colapsar'}
            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Progress Bar Line */}
      <div className="w-full bg-[var(--bg-surface-muted)] h-1 overflow-hidden">
        <div 
          className="bg-emerald-500 h-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main content */}
      {!isCollapsed && (
        <div className="p-3.5 sm:p-4 space-y-3 bg-[var(--bg-app)]/30 border-t border-[var(--border-subtle)]">
          {/* Main Focus Task if exists */}
          {mainTask ? (
            <div className="p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.medium();
                    onToggleTask(mainTask.id);
                  }}
                  className="mt-0.5 text-[var(--text-tertiary)] hover:text-emerald-500 transition min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer shrink-0"
                  title="Marcar como completada"
                >
                  <Circle className="w-4 h-4 stroke-[1.5]" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
                    <Flame className="w-3 h-3 text-[var(--accent)]" />
                    <span>Foco Principal</span>
                    {mainTask.priority === 'alta' && (
                      <span className="text-rose-500 font-semibold">· Prioridad Alta</span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[var(--text-primary)] mt-0.5 break-words">
                    {mainTask.title}
                  </p>
                  {mainTask.projectName && (
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Cliente: {mainTask.projectName}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  onOpenFocus();
                }}
                className="min-h-[44px] sm:min-h-[32px] px-2.5 py-1.5 rounded-[var(--radius-control)] btn-solid-primary text-xs font-semibold shrink-0 flex items-center gap-1 cursor-pointer active:scale-95"
                title="Comenzar foco en esta tarea"
              >
                <span>Foco</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-[var(--radius-control)] border border-emerald-500/20 bg-emerald-500/5 text-center text-xs text-emerald-500 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>¡Todo listo por hoy! No tenés tareas pendientes.</span>
            </div>
          )}

          {/* Overdue alert and quick action */}
          {overdueTasks.length > 0 && onMoveOverdueToToday && (
            <div className="flex items-center justify-between p-2.5 rounded-[var(--radius-control)] border border-rose-500/20 bg-rose-500/5 text-xs text-[var(--text-secondary)] gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span className="truncate">
                  Tenés <strong>{overdueTasks.length}</strong> {overdueTasks.length === 1 ? 'tarea atrasada' : 'tareas atrasadas'} de días anteriores.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.medium();
                  onMoveOverdueToToday();
                }}
                className="min-h-[44px] sm:min-h-[28px] px-2.5 py-1 rounded-[var(--radius-control)] border border-rose-500/30 hover:bg-rose-500/10 text-rose-500 text-[11px] font-semibold shrink-0 cursor-pointer active:scale-95 flex items-center gap-1"
              >
                <FastForward className="w-3 h-3" />
                <span>Pasar a hoy</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
