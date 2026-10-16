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
  let greeting = '¡Buen día!';
  if (currentHour >= 13 && currentHour < 20) {
    greeting = '¡Buenas tardes!';
  } else if (currentHour >= 20 || currentHour < 6) {
    greeting = '¡Buenas noches!';
  }

  const pendingTasks = todayTasks.filter(t => !t.completed);
  const pendingMeetings = todayMeetings.filter(m => !m.completed);
  const completedTasks = todayTasks.filter(t => t.completed);
  const completedMeetings = todayMeetings.filter(m => m.completed);

  const totalItems = todayTasks.length + todayMeetings.length;
  const completedCount = completedTasks.length + completedMeetings.length;
  const progressPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 100;

  // Next upcoming meeting today
  const nextMeeting = pendingMeetings[0];
  // Top priority pending task
  const topPendingTasks = pendingTasks.slice(0, 3);
  const priorityOne = pendingTasks[0];

  return (
    <div className="w-full mb-4 rounded-[var(--radius-card)] bg-[#0A0A0A] text-[#FAFAFA] border border-[#262626] overflow-hidden transition-all shadow-sm">
      {/* Swiss Hero Block */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Giant Day Number + Fine Vertical Line + Day/Month */}
        <div className="flex items-center gap-3.5 sm:gap-4 shrink-0">
          <span className="font-heading font-extrabold text-4xl sm:text-5xl tracking-tighter tabular-nums leading-none text-white">
            {String(dayNumber).padStart(2, '0')}
          </span>
          <div className="h-10 sm:h-12 w-[1px] bg-white/20 shrink-0" />
          <div className="flex flex-col justify-center">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white capitalize leading-tight">
              {weekDayName}
            </span>
            <span className="text-[11px] sm:text-xs text-white/50 capitalize font-medium">
              {monthName}
            </span>
          </div>
        </div>

        {/* Right: Greeting + Short phrase + Priority #1 */}
        <div className="flex-1 md:px-4 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-semibold tracking-tight text-white">
              {greeting}
            </h2>
            <span className="text-xs text-white/60">
              {totalItems === 0
                ? 'Jornada libre y despejada.'
                : pendingTasks.length === 0 && pendingMeetings.length === 0
                ? 'Objetivos de hoy cumplidos.'
                : `${pendingTasks.length} pendientes y ${pendingMeetings.length} citas.`}
            </span>
          </div>

          {/* Priority #1 Quick Glance */}
          {priorityOne ? (
            <div className="mt-1 flex items-center gap-2 text-xs text-white/80 truncate">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white shrink-0">
                Foco N°1
              </span>
              <span className="truncate font-medium">{priorityOne.title}</span>
              {priorityOne.time && (
                <span className="text-[10px] font-mono text-white/50 shrink-0">
                  {priorityOne.time}
                </span>
              )}
            </div>
          ) : nextMeeting ? (
            <div className="mt-1 flex items-center gap-2 text-xs text-white/80 truncate">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#D97706]/20 text-[#F59E0B] shrink-0">
                Próxima cita
              </span>
              <span className="truncate font-medium">{nextMeeting.title}</span>
              <span className="text-[10px] font-mono text-white/50 shrink-0">
                {nextMeeting.time} hs
              </span>
            </div>
          ) : null}
        </div>

        {/* Controls & Progress Ring */}
        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t border-white/10 md:border-t-0">
          <div className="flex items-center gap-2.5">
            {/* Minimal Circular Progress Ring */}
            <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  className="stroke-white/15 fill-none"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  className="stroke-[#16A34A] fill-none transition-all duration-300"
                  strokeWidth="3"
                  strokeDasharray="94.2"
                  strokeDashoffset={94.2 - (94.2 * progressPercent) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-[9px] font-mono font-bold text-white">
                {progressPercent}%
              </span>
            </div>

            <div className="text-left">
              <div className="text-[11px] font-mono text-white/80 font-medium">
                {completedCount}/{totalItems} listos
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenFocus && (
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  onOpenFocus();
                }}
                className="px-2.5 py-1.5 rounded-[var(--radius-control)] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 text-xs font-semibold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                title="Abrir Modo Foco (Pantalla completa)"
              >
                <Flame className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Modo Foco</span>
              </button>
            )}

            <button
              onClick={() => {
                hapticFeedback.light();
                onOpenQuickAdd('tarea', todayStr);
              }}
              className="px-2.5 py-1.5 rounded-[var(--radius-control)] bg-white text-black hover:bg-zinc-200 text-xs font-semibold flex items-center gap-1 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir</span>
            </button>

            <button
              onClick={() => {
                hapticFeedback.selection();
                setCollapsed(prev => !prev);
              }}
              className="p-1.5 rounded-[var(--radius-control)] text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title={collapsed ? 'Desplegar detalles' : 'Plegar detalles'}
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Action Items */}
      {!collapsed && (topPendingTasks.length > 0 || nextMeeting) && (
        <div className="px-4 pb-3.5 pt-2 border-t border-white/10 bg-black/40 space-y-2">
          {/* Next upcoming meeting */}
          {nextMeeting && (
            <div className="flex items-center justify-between gap-2 p-2 rounded-[var(--radius-control)] bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-[#D97706] shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B]">
                  Reunión
                </span>
                <span className="text-xs text-white truncate font-medium">
                  {nextMeeting.title}
                </span>
                {nextMeeting.time && (
                  <span className="text-[10px] font-mono text-white/50 shrink-0">
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
                className="px-2 py-0.5 text-[11px] font-medium rounded bg-white/10 hover:bg-white/20 text-white transition shrink-0 active:scale-95"
              >
                Concluir
              </button>
            </div>
          )}

          {/* Pending Priority Tasks with Swiss rounded-square checkbox */}
          {topPendingTasks.map(task => (
            <div
              key={task.id}
              className="flex items-center justify-between gap-2 p-2 rounded-[var(--radius-control)] bg-white/5 border border-white/5 hover:border-white/20 transition group"
            >
              <button
                onClick={() => {
                  hapticFeedback.medium();
                  playTaskDone();
                  fireTaskCelebration(0.5, 0.4);
                  onToggleTask(task.id);
                }}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
              >
                {/* Rounded square checkbox: black/white border, solid on check */}
                <div className="w-4 h-4 rounded-[4px] border border-white/40 flex items-center justify-center shrink-0 group-hover:border-white transition">
                  {task.completed && <div className="w-2.5 h-2.5 rounded-[2px] bg-white" />}
                </div>
                <span className={`text-xs truncate font-medium ${task.completed ? 'line-through text-white/40' : 'text-white'}`}>
                  {task.title}
                </span>
              </button>
              {task.time && (
                <span className="text-[10px] font-mono text-white/50 shrink-0 bg-white/5 px-1.5 py-0.5 rounded">
                  {task.time}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
