import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Flame, Phone } from 'lucide-react';
import { Prospect, ProspectEvent, ProspectingSettings } from '../types';
import { FUNNEL_STEPS, FunnelStepId, buildDailyQueue, funnelStepOf, turnOf } from '../prospecting/core';
import { addDays, parseLocalDate } from '../utils/dates';
import { fireTaskCelebration } from '../utils/confetti';

/**
 * PROSPECCIÓN, A LA VISTA
 * - La ruta: el camino del primer mensaje a cliente, como una línea con estaciones.
 *   Cada estación dice cuántos llegaron y se enciende donde te toca a vos.
 * - El día: anillo de lo hecho contra lo planeado, racha y los últimos 7 días.
 * - La próxima llamada, con cuánto falta.
 */

import { collectProspectEvents, SENT_EVENT_TYPES } from '../prospecting/dayLog';

const TINT = '#34C759'; // color de Prospección en toda la app
const CALL = '#0A84FF';

// Lo que cuenta como "le escribiste" (de los eventos y del historial nuevo)

export interface Station {
  id: string;
  label: string;
  short: string;
  from: FunnelStepId; // primer paso que cuenta como "llegó"
  reached: number;
  mine: number; // te toca en esta estación
}

const STATIONS: { id: string; label: string; short: string; from: FunnelStepId; upto: FunnelStepId }[] = [
  { id: 'contactados', label: 'Les escribiste', short: 'Escritos', from: 'primer', upto: 'primer' },
  { id: 'respondieron', label: 'Respondieron', short: 'Respuesta', from: 'respondio', upto: 'respondio' },
  { id: 'conversacion', label: 'En conversación', short: 'Charla', from: 'pregunta', upto: 'speech' },
  { id: 'auditoria', label: 'Link de auditoría', short: 'Link', from: 'link', upto: 'link' },
  { id: 'video', label: 'Auditoría y video', short: 'Video', from: 'auditoria', upto: 'video' },
  { id: 'llamada', label: 'Llamada', short: 'Llamada', from: 'llamada', upto: 'propuesta' },
  { id: 'cliente', label: 'Cliente', short: 'Cliente', from: 'cliente', upto: 'cliente' },
];

const ORDER = FUNNEL_STEPS.map((s) => s.id) as string[];

export function usePulse(prospects: Prospect[], events: ProspectEvent[], today: string, settings: ProspectingSettings) {
  return useMemo(() => {
    const outByDay = new Map<string, number>();
    collectProspectEvents(prospects, events).forEach(e => { if (SENT_EVENT_TYPES.has(e.type)) outByDay.set(e.date, (outByDay.get(e.date) || 0) + 1); });
    const doneToday = outByDay.get(today) || 0;
    const queue = buildDailyQueue(prospects, today, settings).items;
    const leftToday = queue.filter((i) => i.kind !== 'llamada_hoy').length;

    // Racha: días de trabajo seguidos con al menos un mensaje (hoy cuenta si ya mandaste)
    const workDays = settings.workDays?.length ? settings.workDays : [1, 2, 3, 4, 5];
    let streak = 0;
    let day = doneToday > 0 ? today : addDays(today, -1);
    for (let guard = 0; guard < 120; guard++) {
      if (!workDays.includes(parseLocalDate(day).getDay())) {
        day = addDays(day, -1);
        continue;
      }
      if ((outByDay.get(day) || 0) > 0) {
        streak++;
        day = addDays(day, -1);
      } else break;
    }

    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6);
      return { date: d, count: outByDay.get(d) || 0, letter: ['D', 'L', 'M', 'M', 'J', 'V', 'S'][parseLocalDate(d).getDay()] };
    });

    const withStep = prospects.map((p) => ({ step: funnelStepOf(p), turn: turnOf(p, today, settings).turn })).filter((x) => x.step);
    const stations: Station[] = STATIONS.map((s) => {
      const fromI = ORDER.indexOf(s.from);
      const uptoI = ORDER.indexOf(s.upto);
      return {
        id: s.id,
        label: s.label,
        short: s.short,
        from: s.from,
        reached: withStep.filter((x) => ORDER.indexOf(x.step as string) >= fromI).length,
        mine: withStep.filter((x) => {
          const i = ORDER.indexOf(x.step as string);
          return i >= fromI && i <= uptoI && x.turn === 'mio';
        }).length,
      };
    });

    const calls = prospects
      .filter((p) => p.stage === 'llamada' && !p.proposalSentAt && p.callDate && p.callDate >= today)
      .sort((a, b) => `${a.callDate} ${a.callTime || '99'}`.localeCompare(`${b.callDate} ${b.callTime || '99'}`));
    const mine = prospects.filter((p) => turnOf(p, today, settings).turn === 'mio').length;
    const waiting = prospects.filter((p) => turnOf(p, today, settings).turn === 'suyo').length;
    return { doneToday, leftToday, planned: doneToday + leftToday, streak, week, stations, nextCall: calls[0] || null, mine, waiting };
  }, [prospects, events, today, settings]);
}

export type Pulse = ReturnType<typeof usePulse>;

/** Anillo del día: hechos contra planeados. */
export const DayRing: React.FC<{ done: number; planned: number; size?: number }> = ({ done, planned, size = 76 }) => {
  const pct = planned > 0 ? Math.min(1, done / planned) : done > 0 ? 1 : 0;
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const complete = planned > 0 && done >= planned;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Hoy: ${done} de ${planned} mensajes`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-surface-muted)" strokeWidth={7} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TINT}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-bold tabular-nums text-[var(--text-primary)]" style={{ fontSize: Math.round(size * 0.26) }}>
          {complete ? '✓' : done}
        </span>
        <span className="text-[var(--text-tertiary)] mt-0.5 tabular-nums" style={{ fontSize: Math.max(9, Math.round(size * 0.13)) }}>
          {complete ? 'listo' : `de ${planned}`}
        </span>
      </span>
    </div>
  );
};

/** Los últimos 7 días, hoy al final. */
export const WeekBars: React.FC<{ week: Pulse['week']; today: string }> = ({ week, today }) => {
  const max = Math.max(1, ...week.map((d) => d.count));
  return (
    <div className="flex items-end gap-1.5 h-[52px]" role="img" aria-label={`Mensajes de los últimos 7 días: ${week.map((d) => d.count).join(', ')}`}>
      {week.map((d) => (
        <div key={d.date} className="flex flex-col items-center gap-1 w-4">
          <div
            className="w-full rounded-[3px]"
            style={{
              height: `${Math.max(3, (d.count / max) * 34)}px`,
              backgroundColor: d.date === today ? TINT : d.count ? 'var(--text-tertiary)' : 'var(--bg-surface-muted)',
              opacity: d.date === today || d.count ? 1 : 0.8,
            }}
            title={`${d.count} el ${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`}
          />
          <span className={`text-[10px] ${d.date === today ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-tertiary)]'}`}>{d.letter}</span>
        </div>
      ))}
    </div>
  );
};

function callWhen(p: Prospect, today: string): string {
  const day = p.callDate === today ? 'Hoy' : p.callDate === addDays(today, 1) ? 'Mañana' : `${p.callDate!.slice(8, 10)}/${p.callDate!.slice(5, 7)}`;
  return `${day}${p.callTime ? ` ${p.callTime}` : ''}`;
}

function minutesUntil(p: Prospect): number | null {
  if (!p.callDate || !p.callTime) return null;
  const [h, m] = p.callTime.split(':').map(Number);
  const target = parseLocalDate(p.callDate);
  target.setHours(h, m, 0, 0);
  return Math.round((target.getTime() - Date.now()) / 60000);
}

export const NextCallChip: React.FC<{ prospect: Prospect; today: string; onClick?: () => void }> = ({ prospect: p, today, onClick }) => {
  const mins = minutesUntil(p);
  const soon = mins !== null && mins >= 0 && mins <= 120;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full sm:w-auto flex items-center gap-2.5 px-3 py-2 rounded-[12px] text-left cursor-pointer min-w-0 transition-colors"
      style={{ backgroundColor: `${CALL}14`, border: `1px solid ${CALL}33` }}
    >
      <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: CALL }} aria-hidden>
        <Phone className="w-3.5 h-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold" style={{ color: CALL }}>
          {callWhen(p, today)}
          {soon ? ` · en ${mins! < 60 ? `${mins} min` : `${Math.floor(mins! / 60)} h ${mins! % 60} min`}` : ''}
        </span>
        <span className="block text-[13px] text-[var(--text-primary)] truncate">{p.studio || p.name}</span>
      </span>
    </button>
  );
};

/**
 * La ruta: estaciones del primer mensaje a cliente. El tramo entre estaciones se afina
 * según cuántos siguen; la estación se enciende (verde) si ahí te toca a vos.
 */
export const RouteLine: React.FC<{ stations: Station[]; onStation?: (from: FunnelStepId) => void; compact?: boolean }> = ({ stations, onStation, compact }) => {
  const first = stations[0]?.reached || 0;
  return (
    <div className={`overflow-x-auto no-scrollbar ${compact ? '' : '-mx-1 px-1'}`}>
      <ol className="flex items-start min-w-max" aria-label="Recorrido de tus prospectos">
        {stations.map((s, i) => {
          const ratio = first ? s.reached / first : 0;
          const next = stations[i + 1];
          const nextRatio = next && first ? next.reached / first : 0;
          const lit = s.reached > 0;
          return (
            <li key={s.id} className="flex items-start">
              <button
                type="button"
                onClick={() => onStation?.(s.from)}
                disabled={!onStation}
                className={`flex flex-col items-center text-center ${compact ? 'w-[64px]' : 'w-[84px]'} group disabled:cursor-default cursor-pointer`}
                title={`${s.label}: ${s.reached}${s.mine ? ` · te toca con ${s.mine}` : ''}`}
              >
                <span className="relative flex items-center justify-center h-[30px]">
                  <span
                    className="rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{
                      width: compact ? 22 : 26,
                      height: compact ? 22 : 26,
                      backgroundColor: s.mine ? TINT : lit ? 'var(--text-primary)' : 'var(--bg-surface-muted)',
                      boxShadow: s.mine ? `0 0 0 4px ${TINT}33` : undefined,
                    }}
                  >
                    {s.mine > 0 && <span className="text-[11px] font-bold text-white tabular-nums">{s.mine}</span>}
                  </span>
                </span>
                <span className={`${compact ? 'text-[15px]' : 'text-[19px]'} font-bold tabular-nums leading-none mt-1.5 ${lit ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>{s.reached}</span>
                <span className={`${compact ? 'text-[10px] truncate max-w-full px-0.5' : 'text-[11px]'} leading-tight mt-1 ${lit ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'}`}>{compact ? s.short : s.label}</span>
                {!compact && i > 0 && first > 0 && <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums mt-0.5">{Math.round(ratio * 100)}%</span>}
              </button>
              {next && (
                <span className={`${compact ? 'w-4' : 'w-6'} h-[30px] flex items-center -mx-2.5`} aria-hidden>
                  <span
                    className="w-full rounded-full"
                    style={{
                      height: Math.max(2, Math.round(2 + nextRatio * 5)),
                      backgroundColor: next.reached ? 'var(--text-primary)' : 'var(--border-subtle)',
                      opacity: next.reached ? 0.35 + nextRatio * 0.65 : 1,
                    }}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

/** Panel de arriba de Prospección: el día, la semana y la próxima llamada. */
export const ProspectingPulsePanel: React.FC<{
  pulse: Pulse;
  today: string;
  weekDone: number;
  goal: number;
  onStation: (from: FunnelStepId) => void;
  onCall?: () => void;
}> = ({ pulse, today, weekDone, goal, onStation, onCall }) => {
  // Festejo una sola vez: cuando terminás la cola del día
  const celebrated = useRef(false);
  const complete = pulse.planned > 0 && pulse.doneToday >= pulse.planned;
  useEffect(() => {
    const key = `cero_pros_festejo_${today}`;
    let already = false;
    try {
      already = localStorage.getItem(key) === '1';
    } catch {
      /* sin almacenamiento */
    }
    if (complete && !already && !celebrated.current) {
      celebrated.current = true;
      fireTaskCelebration(0.5, 0.3);
      try {
        localStorage.setItem(key, '1');
      } catch {
        /* sin almacenamiento */
      }
    }
  }, [complete, today]);

  const goalPct = goal > 0 ? Math.min(100, Math.round((weekDone / goal) * 100)) : 0;
  // En el celular, la ruta y la semana se abren a pedido: así "Ahora" queda a la vista
  const [more, setMore] = useState(false);
  return (
    <section className="card-swiss p-3.5 sm:p-5 space-y-3 sm:space-y-4" aria-label="Tu prospección hoy">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none">
          <span className="sm:hidden">
            <DayRing done={pulse.doneToday} planned={pulse.planned} size={56} />
          </span>
          <span className="hidden sm:block">
            <DayRing done={pulse.doneToday} planned={pulse.planned} />
          </span>
          <div className="leading-tight min-w-0">
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">
              {complete ? 'Día completo' : pulse.leftToday ? `Te faltan ${pulse.leftToday}` : 'Sin pendientes'}
            </p>
            <p className="text-[12px] text-[var(--text-secondary)]">
              {pulse.mine ? `${pulse.mine} ${pulse.mine === 1 ? 'espera' : 'esperan'} tu respuesta` : 'Nadie esperando tu respuesta'}
            </p>
            <p className="text-[12px] text-[var(--text-tertiary)]">
              {pulse.waiting} esperando la suya
              {pulse.streak > 0 && (
                <span className="sm:hidden">
                  {' '}· <Flame className="inline w-3 h-3 -mt-0.5" style={{ color: '#FF9500' }} aria-hidden /> {pulse.streak} {pulse.streak === 1 ? 'día' : 'días'}
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          className="sm:hidden h-8 px-2.5 rounded-full text-[12px] font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center gap-1 shrink-0 cursor-pointer"
          aria-expanded={more}
        >
          {more ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Recorrido
        </button>

        <div className={`${more ? 'flex' : 'hidden'} sm:flex items-center gap-3`}>
          <WeekBars week={pulse.week} today={today} />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold text-[var(--text-primary)] flex items-center gap-1">
              {pulse.streak > 0 && <Flame className="w-4 h-4" style={{ color: '#FF9500' }} aria-hidden />}
              {pulse.streak} {pulse.streak === 1 ? 'día' : 'días'} seguidos
            </p>
            {goal > 0 && (
              <>
                <p className="text-[12px] text-[var(--text-secondary)] tabular-nums">
                  {weekDone} de {goal} en la semana
                </p>
                <span className="block w-28 h-1.5 mt-1 rounded-full bg-[var(--bg-surface-muted)] overflow-hidden">
                  <span className="block h-full rounded-full" style={{ width: `${goalPct}%`, backgroundColor: TINT }} />
                </span>
              </>
            )}
          </div>
        </div>

        {pulse.nextCall && (
          <div className="min-w-0 w-full sm:w-auto sm:ml-auto">
            <NextCallChip prospect={pulse.nextCall} today={today} onClick={onCall} />
          </div>
        )}
      </div>

      <div className={`${more ? 'block' : 'hidden'} sm:block pt-3 border-t border-[var(--border-subtle)]`}>
        <RouteLine stations={pulse.stations} onStation={onStation} />
      </div>
    </section>
  );
};
