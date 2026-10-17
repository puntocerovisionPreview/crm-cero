import React, { useState } from 'react';
import { AgendaTask, AgendaMeeting, IncomeRecord } from '../types';
import { 
  Sparkles, 
  Calendar, 
  Clock, 
  DollarSign, 
  CheckSquare, 
  AlertCircle, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp,
  FastForward,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';
import { getTodayString, addDays, formatDayName } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  incomes: IncomeRecord[];
  onMoveOverdueToToday?: () => void;
  onMoveTodayPendingToTomorrow?: () => void;
  onOpenQuickAdd?: (type: 'tarea' | 'reunion' | 'ingreso', date?: string) => void;
  onNavigateToCalendar?: () => void;
}

export const MorningBriefingCard: React.FC<Props> = ({
  tasks,
  meetings,
  incomes,
  onMoveOverdueToToday,
  onMoveTodayPendingToTomorrow,
  onOpenQuickAdd,
  onNavigateToCalendar,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const todayStr = getTodayString();
  const tomorrowStr = addDays(todayStr, 1);

  // Time-based greeting
  const currentHour = new Date().getHours();
  let greeting = '¡Buen día!';
  if (currentHour >= 13 && currentHour < 20) {
    greeting = '¡Buenas tardes!';
  } else if (currentHour >= 20 || currentHour < 6) {
    greeting = '¡Buenas noches!';
  }

  // Today metrics
  const todayTasks = tasks.filter(t => t.date === todayStr);
  const todayPendingTasks = todayTasks.filter(t => !t.completed);
  const todayCompletedTasks = todayTasks.filter(t => t.completed);

  // Overdue tasks (tasks with date < todayStr and not completed)
  const overdueTasks = tasks.filter(t => t.date < todayStr && !t.completed);

  // Today meetings
  const todayMeetings = meetings.filter(m => m.date === todayStr);
  const nextMeeting = todayMeetings
    .filter(m => !m.completed && m.time)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))[0];

  // Today/Overdue incomes pending
  const todayPendingIncomes = incomes.filter(
    i => i.date === todayStr && i.status === 'pendiente'
  );
  const overduePendingIncomes = incomes.filter(
    i => i.date < todayStr && i.status === 'pendiente'
  );

  const totalPendingUSD = [...todayPendingIncomes, ...overduePendingIncomes]
    .filter(i => i.currency === 'USD')
    .reduce((sum, i) => sum + i.amount, 0);

  const totalPendingARS = [...todayPendingIncomes, ...overduePendingIncomes]
    .filter(i => i.currency === 'ARS')
    .reduce((sum, i) => sum + i.amount, 0);

  const hasPendingItems = todayPendingTasks.length > 0 || todayMeetings.some(m => !m.completed) || todayPendingIncomes.length > 0 || overdueTasks.length > 0;

  return (
    <div className="w-full mb-4 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 shadow-lg overflow-hidden transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset]">
      {/* Header Banner */}
      <div className="px-4 py-3 bg-zinc-950/60 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                {greeting} Briefing del Día
              </h2>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full capitalize">
                {formatDayName(todayStr)}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Tu panorama operativo y financiero en 3 segundos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onMoveTodayPendingToTomorrow && todayPendingTasks.length > 0 && (
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                onMoveTodayPendingToTomorrow();
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-medium border border-zinc-700 transition flex items-center gap-1 cursor-pointer"
              title="Pasar todas las tareas no completadas de hoy a mañana"
            >
              <FastForward className="w-3 h-3 text-orange-400" />
              <span className="hidden md:inline">Pasar pendientes a mañana</span>
              <span className="md:hidden">A mañana</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title={isCollapsed ? 'Expandir briefing' : 'Minimizar briefing'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      {!isCollapsed && (
        <div className="p-4 space-y-3">
          {/* 3 Metric Rows (Stacked Vertically to avoid clipping in narrow rail) */}
          <div className="flex flex-col gap-2">
            {/* 1. Tareas de Hoy */}
            <div className="p-2.5 px-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  todayPendingTasks.length === 0 && todayTasks.length > 0
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-[var(--accent)]/15 text-[var(--accent)]'
                }`}>
                  {todayPendingTasks.length === 0 && todayTasks.length > 0 ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <CheckSquare className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider truncate">
                    Tareas de Hoy
                  </span>
                  <span className="text-xs font-semibold text-zinc-200 block truncate">
                    {todayPendingTasks.length === 0 && todayTasks.length > 0
                      ? '¡Todo listo!'
                      : `${todayPendingTasks.length} pendiente${todayPendingTasks.length === 1 ? '' : 's'}`}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                {todayTasks.length > 0 ? (
                  <span className="text-xs font-mono font-bold text-zinc-300 bg-zinc-900 border border-zinc-700/60 px-2 py-0.5 rounded-lg">
                    {todayCompletedTasks.length}/{todayTasks.length}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-zinc-500">
                    0 tareas
                  </span>
                )}
              </div>
            </div>

            {/* 2. Reuniones de Hoy */}
            <div className="p-2.5 px-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider truncate">
                    Reuniones
                  </span>
                  <span className="text-xs font-semibold text-zinc-200 block truncate">
                    {todayMeetings.length === 0 
                      ? 'Sin reuniones' 
                      : `${todayMeetings.length} programada${todayMeetings.length === 1 ? '' : 's'}`}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                {nextMeeting ? (
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                    {nextMeeting.time} hs
                  </span>
                ) : (
                  <span className="text-xs font-medium text-zinc-500">
                    Libre
                  </span>
                )}
              </div>
            </div>

            {/* 3. Cobros / Cashflow */}
            <div className="p-2.5 px-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider truncate">
                    Cobros por Vencer / Hoy
                  </span>
                  <div className="text-xs font-bold text-zinc-100 truncate">
                    {totalPendingUSD > 0 || totalPendingARS > 0 ? (
                      <span className="text-emerald-400">
                        {totalPendingUSD > 0 && `$${totalPendingUSD.toLocaleString()} USD`}
                        {totalPendingUSD > 0 && totalPendingARS > 0 && ' + '}
                        {totalPendingARS > 0 && `$${totalPendingARS.toLocaleString()} ARS`}
                      </span>
                    ) : (
                      <span className="text-zinc-400 font-medium">Al día</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                {(todayPendingIncomes.length + overduePendingIncomes.length) > 0 ? (
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                    {todayPendingIncomes.length + overduePendingIncomes.length} pend.
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                    ✓ Al día
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Overdue Tasks Alert Bar (if any exist) */}
          {overdueTasks.length > 0 && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between flex-wrap gap-2 animate-fade-in">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Tenés <strong>{overdueTasks.length} tarea{overdueTasks.length > 1 ? 's' : ''} atrasada{overdueTasks.length > 1 ? 's' : ''}</strong> de días anteriores.
                </span>
              </div>

              {onMoveOverdueToToday && (
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.medium();
                    onMoveOverdueToToday();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-[11px] transition shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Mover todas a Hoy
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
