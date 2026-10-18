import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { AgendaMeeting, AgendaTask, ProspectEvent } from '../types';
import { RoutineLog, subscribeRoutineLogs } from '../utils/dailyRoutine';
import { ActivityKind, buildActivity, buildWeeks, computeStats, countFor, levelFor, monthShort } from '../utils/activity';
import { parseLocalDate } from '../utils/dates';

interface Props {
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  prospectEvents: ProspectEvent[];
  today: string;
}

const KINDS: { key: ActivityKind; label: string }[] = [
  { key: 'todo', label: 'Todo' },
  { key: 'tareas', label: 'Tareas' },
  { key: 'prospeccion', label: 'Prospección' },
  { key: 'rutina', label: 'Rutina' },
];

// Verde del sistema de Apple en 4 intensidades (como el mapa de GitHub)
const LEVEL_BG = [
  'bg-[var(--bg-surface-muted)]',
  'bg-[#34C759]/30',
  'bg-[#34C759]/55',
  'bg-[#34C759]/80',
  'bg-[#34C759]',
];

const ROW_LABELS = ['L', '', 'Mi', '', 'V', '', ''];

const describe = (date: string, n: number, kind: ActivityKind) => {
  const day = parseLocalDate(date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  const what = kind === 'prospeccion' ? 'contactos' : kind === 'rutina' ? 'pasos de rutina' : kind === 'tareas' ? 'tareas y reuniones' : 'acciones';
  return `${day}: ${n === 0 ? 'sin actividad' : `${n} ${what}`}`;
};

// Constancia: un año de días en una grilla, con rachas (estilo GitHub)
export const ActivityHeatmap: React.FC<Props> = ({ tasks, meetings, prospectEvents, today }) => {
  const [kind, setKind] = useState<ActivityKind>('todo');
  const [routineLogs, setRoutineLogs] = useState<Record<string, RoutineLog>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => subscribeRoutineLogs(setRoutineLogs, 400), []);

  const days = useMemo(() => buildActivity({ tasks, meetings, prospectEvents, routineLogs }), [tasks, meetings, prospectEvents, routineLogs]);
  const weeks = useMemo(() => buildWeeks(today), [today]);
  const stats = useMemo(() => computeStats(days, kind, today), [days, kind, today]);
  const max = useMemo(() => Math.max(0, ...weeks.flat().filter(d => d <= today).map(d => countFor(days.get(d), kind))), [weeks, days, kind, today]);

  // En el celular arranca mostrando lo más reciente (a la derecha)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks]);

  return (
    <section className="card-swiss p-5 space-y-4" aria-labelledby="constancia-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="constancia-title" className="text-[20px] font-bold tracking-tight text-[var(--text-primary)]">Constancia</h2>
          <p className="text-[13px] text-[var(--text-secondary)]">Lo que hiciste cada día del último año.</p>
        </div>
        <div role="tablist" aria-label="Qué contar" className="flex p-[3px] rounded-[10px] bg-[var(--bg-surface-muted)]/70 overflow-x-auto no-scrollbar max-w-full">
          {KINDS.map(k => (
            <button
              key={k.key}
              type="button"
              role="tab"
              aria-selected={kind === k.key}
              onClick={() => setKind(k.key)}
              className={`px-3 h-7 rounded-[8px] text-[13px] whitespace-nowrap cursor-pointer transition-[background-color,color] ${
                kind === k.key
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
                  : 'text-[var(--text-secondary)] font-medium'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <Flame className={`w-6 h-6 ${stats.current > 0 ? 'text-[#FF9500]' : 'text-[var(--text-tertiary)]'}`} aria-hidden />
          <div>
            <dd className="text-[22px] font-bold tabular-nums leading-none text-[var(--text-primary)]">{stats.current}</dd>
            <dt className="text-[12px] text-[var(--text-secondary)]">{stats.current === 1 ? 'día de racha' : 'días de racha'}</dt>
          </div>
        </div>
        <div>
          <dd className="text-[22px] font-bold tabular-nums leading-none text-[var(--text-primary)]">{stats.best}</dd>
          <dt className="text-[12px] text-[var(--text-secondary)]">mejor racha</dt>
        </div>
        <div>
          <dd className="text-[22px] font-bold tabular-nums leading-none text-[var(--text-primary)]">{stats.activeDays}</dd>
          <dt className="text-[12px] text-[var(--text-secondary)]">días activos</dt>
        </div>
        <div>
          <dd className="text-[22px] font-bold tabular-nums leading-none text-[var(--text-primary)]">{stats.total}</dd>
          <dt className="text-[12px] text-[var(--text-secondary)]">en total</dt>
        </div>
      </dl>

      <div ref={scrollRef} className="overflow-x-auto no-scrollbar -mx-1 px-1">
        <div className="inline-flex flex-col gap-1 min-w-max">
          {/* Meses */}
          <div className="flex gap-[3px] pl-6 h-4">
            {weeks.map((w, i) => {
              const first = w[0];
              const showMonth = i === 0 || first.slice(5, 7) !== weeks[i - 1][0].slice(5, 7);
              return (
                <span key={first} className="w-[11px] text-[10px] text-[var(--text-tertiary)] overflow-visible whitespace-nowrap">
                  {showMonth ? monthShort(first) : ''}
                </span>
              );
            })}
          </div>
          <div className="flex gap-[3px]">
            {/* Días de la semana */}
            <div className="flex flex-col gap-[3px] w-5 mr-1">
              {ROW_LABELS.map((l, i) => (
                <span key={i} className="h-[11px] text-[10px] leading-[11px] text-[var(--text-tertiary)]">{l}</span>
              ))}
            </div>
            {weeks.map(week => (
              <div key={week[0]} className="flex flex-col gap-[3px]">
                {week.map(date => {
                  if (date > today) return <span key={date} className="w-[11px] h-[11px]" aria-hidden />;
                  const n = countFor(days.get(date), kind);
                  const label = describe(date, n, kind);
                  return (
                    <span
                      key={date}
                      title={label}
                      aria-label={label}
                      role="img"
                      className={`w-[11px] h-[11px] rounded-[3px] ${LEVEL_BG[levelFor(n, max)]} ${date === today ? 'ring-1 ring-[var(--text-primary)]/60' : ''}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5 text-[11px] text-[var(--text-tertiary)]" aria-hidden>
        <span>Menos</span>
        {LEVEL_BG.map((bg, i) => (
          <span key={i} className={`w-[11px] h-[11px] rounded-[3px] ${bg}`} />
        ))}
        <span>Más</span>
      </div>
    </section>
  );
};
