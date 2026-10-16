import React, { useState } from 'react';
import { AgendaTask, AgendaMeeting } from '../types';
import { 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Users, 
  ChevronDown, 
  ChevronUp, 
  Plus,
  ArrowRight,
  Flame
} from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { fireTaskCelebration } from '../utils/confetti';

interface Props {
  todayStr: string;
  todayTasks: AgendaTask[];
  todayMeetings: AgendaMeeting[];
  onToggleTask: (id: string) => void;
  onToggleMeeting: (id: string) => void;
  onOpenQuickAdd: (type: 'tarea' | 'reunion', date?: string) => void;
  onOpenFocus?: () => void;
}

export const TodayFocusBanner: React.FC<Props> = ({
  todayStr,
  todayTasks,
  todayMeetings,
  onToggleTask,
  onToggleMeeting,
  onOpenQuickAdd,
  onOpenFocus,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // Parse today's date elements
  const [yearStr, monthStr, dayStr] = (todayStr || '').split('-');
  const dateObj = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
  const dayNumber = dateObj.getDate() || new Date().getDate();
  const weekDayName = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
  const monthName = dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  // Time-based greeting
  const currentHour = new Date().getHours();
  let greeting = 'Buen día';
  if (currentHour >= 13 && currentHour < 20) {
    greeting = 'Buenas tardes';
  } else if (currentHour >= 20 || currentHour < 6) {
    greeting = 'Buenas noches';
  }

  const pendingTasks = todayTasks.filter(t => !t.completed);
  const pendingMeetings = todayMeetings.filter(m => !m.completed);
  const completedTasks = todayTasks.filter(t => t.completed);
  const completedMeetings = todayMeetings.filter(m => m.completed);

  const totalItems = todayTasks.length + todayMeetings.length;
  const completedCount = completedTasks.length + completedMeetings.length;

  // Next upcoming meeting today
  const nextMeeting = pendingMeetings[0];
  // Top priority pending task
  const topPendingTasks = pendingTasks.slice(0, 3);

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const pendingTotal = pendingTasks.length + pendingMeetings.length;
  const summary =
    totalItems === 0
      ? 'Día libre: no hay nada agendado.'
      : pendingTotal === 0
      ? 'Terminaste todo lo de hoy.'
      : `Te ${pendingTotal === 1 ? 'queda' : 'quedan'} ${plural(pendingTasks.length, 'tarea', 'tareas')}${
          pendingMeetings.length ? ` y ${plural(pendingMeetings.length, 'reunión', 'reuniones')}` : ''
        }.`;

  // Escala de avance tipo plano: un tramo por cada tarea o reunión del día (máx. 12)
  const segments = Math.min(totalItems, 12);
  const filledSegments = totalItems > 12 ? Math.round((completedCount / totalItems) * 12) : completedCount;

  return (
    <div className="relative w-full mb-4 rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
      {/* Cuadrícula de plano: la firma visual de .Cero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(100deg, black 0%, transparent 70%)',
          WebkitMaskImage: 'linear-gradient(100deg, black 0%, transparent 70%)',
        }}
      />

      <div className="relative p-4 sm:p-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <div>
            <h1
              className="font-heading text-[2.3rem] sm:text-6xl leading-[0.95] font-extrabold text-[var(--text-primary)] capitalize"
              style={{ fontVariationSettings: '"wdth" 125', letterSpacing: '-0.03em' }}
            >
              {weekDayName} {dayNumber}
            </h1>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
              {monthName.charAt(0).toUpperCase() + monthName.slice(1)}. {greeting}. {summary}
            </p>
          </div>

          {segments > 0 && (
            <div className="flex items-center gap-3" aria-label={`${completedCount} de ${totalItems} hechas`}>
              <div className="flex gap-1">
                {Array.from({ length: segments }, (_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-5 sm:w-6 rounded-[2px] transition-colors duration-300 ${
                      i < filledSegments ? 'bg-[var(--accent)]' : 'bg-[var(--bg-surface-muted)]'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-[var(--text-secondary)] tabular-nums">
                {completedCount} de {totalItems} hechas
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenFocus && (
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                onOpenFocus();
              }}
              className="px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] text-sm font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Abrir Modo Foco (pantalla completa)"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Modo foco</span>
            </button>
          )}

          <button
            onClick={() => {
              hapticFeedback.light();
              onOpenQuickAdd('tarea', todayStr);
            }}
            className="px-3 py-2 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-strong)] text-sm font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir tarea</span>
          </button>

          <button
            onClick={() => {
              hapticFeedback.selection();
              setCollapsed(prev => !prev);
            }}
            className="p-2 rounded-[var(--radius-control)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
            title={collapsed ? 'Mostrar tareas' : 'Ocultar tareas'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsible Action Items */}
      {!collapsed && (topPendingTasks.length > 0 || nextMeeting) && (
        <div className="relative px-4 sm:px-6 pb-4 pt-3 border-t border-[var(--border-subtle)] space-y-1">
          {nextMeeting && (
            <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-[var(--radius-control)] bg-amber-500/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <Users className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-sm text-[var(--text-primary)] truncate font-medium">
                  Reunión: {nextMeeting.title}
                </span>
                {nextMeeting.time && (
                  <span className="text-xs text-[var(--text-secondary)] tabular-nums shrink-0">
                    {nextMeeting.time} hs
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  hapticFeedback.light();
                  playTaskDone();
                  fireTaskCelebration(0.5, 0.3);
                  onToggleMeeting(nextMeeting.id);
                }}
                className="px-2.5 py-1 text-xs font-semibold rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] transition shrink-0 active:scale-95"
              >
                Marcar hecha
              </button>
            </div>
          )}

          {topPendingTasks.map((task, idx) => (
            <button
              key={task.id}
              onClick={() => {
                hapticFeedback.medium();
                playTaskDone();
                fireTaskCelebration(0.5, 0.4);
                onToggleTask(task.id);
              }}
              className="w-full flex items-center gap-3 py-2 px-3 rounded-[var(--radius-control)] hover:bg-[var(--bg-surface-muted)] transition group text-left cursor-pointer"
              title="Marcar como hecha"
            >
              <span className="w-[18px] h-[18px] rounded-[5px] border-2 border-[var(--text-tertiary)] group-hover:border-[var(--accent)] flex items-center justify-center shrink-0 transition">
                <CheckCircle2 className="w-3 h-3 text-[var(--accent)] opacity-0 group-hover:opacity-100 transition" />
              </span>
              <span className="text-sm truncate font-medium text-[var(--text-primary)] flex-1">
                {task.title}
              </span>
              {idx === 0 && (
                <span className="text-xs font-semibold text-[var(--accent)] shrink-0">Lo primero</span>
              )}
              {task.time && (
                <span className="text-xs text-[var(--text-tertiary)] tabular-nums shrink-0">{task.time}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
