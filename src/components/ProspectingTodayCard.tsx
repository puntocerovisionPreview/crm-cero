import React, { useMemo } from 'react';
import { ChevronRight, Phone } from 'lucide-react';
import { useProspecting } from '../prospecting/useProspecting';
import { usePool, useWeeklyAutoBatch } from '../prospecting/usePool';
import { pendingDayClose, pendingOutcomes } from '../prospecting/core';
import { usePoolTakeOptions, useRecycle } from '../prospecting/actions';
import { buildDayLog } from '../prospecting/dayLog';
import { DayRing, usePulse } from './ProspectingVisuals';

const TINT = '#34C759';

/**
 * Prospección dentro de Hoy: una sola fila con el resumen (anillo del día, cuántos para hoy,
 * quién te espera y la llamada de hoy) y un botón que lleva a Prospección, donde se trabaja.
 * Acá siguen corriendo las automatizaciones de siempre: la tanda semanal y la segunda chance.
 */
export const ProspectingTodayCard: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { prospects, events, settings, settingsLoaded, today, loadError } = useProspecting();
  const pool = usePool();
  const list = prospects || [];
  const takeOpts = usePoolTakeOptions(list, events);
  useWeeklyAutoBatch(settings, settingsLoaded, today, takeOpts, () => pool.refresh());
  useRecycle(prospects, today);
  const pulse = usePulse(list, events, today, settings);
  const toMark = useMemo(() => {
    const ids = new Set([...pendingDayClose(list, today), ...pendingOutcomes(list, today)].map((p) => p.id));
    return ids.size;
  }, [list, today]);

  if (prospects === null && !loadError) return null;
  if (prospects === null) {
    return (
      <button type="button" onClick={onOpen} className="card-swiss w-full p-4 text-left text-[14px] text-[var(--text-secondary)] cursor-pointer">
        Prospección: no se pudo cargar. Tocá para abrir.
      </button>
    );
  }
  if (list.length === 0 && pool.availableCount === 0) return null;

  const day = buildDayLog(list, events, today);
  const started = settings.dayStartedOn === today;
  const callToday = pulse.nextCall && pulse.nextCall.callDate === today ? pulse.nextCall : null;
  const parts = [
    day.sent.length + ' contactados hoy',
    day.replies.length + ' respondieron hoy',
    pulse.leftToday ? `${pulse.leftToday} para hoy` : 'Al día',
    pulse.mine ? `${pulse.mine} ${pulse.mine === 1 ? 'te espera' : 'te esperan'}` : '',
    toMark ? `${toMark} sin anotar` : '',
  ].filter(Boolean);

  return (
    <button type="button" onClick={onOpen} className="card-swiss w-full p-3.5 sm:p-4 flex items-center gap-3 text-left cursor-pointer hover:border-[var(--border-strong)] transition-colors">
      <DayRing done={pulse.doneToday} planned={pulse.planned} size={52} />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-[var(--text-primary)]">Prospección</span>
        <span className="block text-[13px] text-[var(--text-secondary)] truncate">{parts.join(' · ')}</span>
        {callToday && (
          <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium" style={{ color: '#0A84FF' }}>
            <Phone className="w-3 h-3" /> Llamada hoy{callToday.callTime ? ` ${callToday.callTime}` : ''} · {callToday.studio || callToday.name}
          </span>
        )}
      </span>
      <span className="h-9 px-3.5 rounded-full text-[13px] font-semibold text-white flex items-center gap-1 shrink-0" style={{ backgroundColor: TINT }}>
        {started || pulse.doneToday ? 'Seguir' : 'Empezar'} <ChevronRight className="w-4 h-4" />
      </span>
    </button>
  );
};
