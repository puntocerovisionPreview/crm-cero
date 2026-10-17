import React, { useMemo, useState } from 'react';
import { Loader2, Send, Sun } from 'lucide-react';
import { useProspecting } from '../prospecting/useProspecting';
import { usePool, useWeeklyAutoBatch } from '../prospecting/usePool';
import { buildDailyQueue, pendingDayClose, pendingOutcomes, ProspectAction } from '../prospecting/core';
import { recordProspectAction } from '../prospecting/store';
import { friendlyError, markDayStarted, useAddMore, usePoolTakeOptions, useRecycle } from '../prospecting/actions';
import { TodayPanel } from '../views/ProspectingView';
import { BurstMode, DayStartFlow } from './ProspectingDayStart';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { Prospect } from '../types';

// Prospección dentro de Hoy: arranca con "Comenzar el día" (pendientes → contactos → ráfaga),
// después muestra lo más urgente (3 acciones) y, a la tarde, el cierre del día.
export const ProspectingTodayCard: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { prospects, events, settings, settingsLoaded, today, hour, loadError } = useProspecting();
  const pool = usePool();
  const list = prospects || [];
  const takeOpts = usePoolTakeOptions(list, events);
  useWeeklyAutoBatch(settings, settingsLoaded, today, takeOpts, () => pool.refresh());
  useRecycle(prospects, today);
  const more = useAddMore(settings, today, takeOpts, pool.refresh);
  const queue = useMemo(() => buildDailyQueue(list, today, settings), [list, today, settings]);
  const toClose = useMemo(() => pendingDayClose(list, today), [list, today]);
  const pending = useMemo(() => pendingOutcomes(list, today), [list, today]);
  const isEvening = hour >= settings.closeHour;
  const [flow, setFlow] = useState<'none' | 'start' | 'burst'>('none');
  const [startedHere, setStartedHere] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (p: Prospect, action: ProspectAction, note?: string) => {
    hapticFeedback.medium();
    if (!['no_reply', 'lost', 'do_not_contact', 'snooze'].includes(action)) playTaskDone();
    try {
      await recordProspectAction(p, action, today, settings, note);
      setError(null);
    } catch (err) {
      setError(`No se guardó: ${friendlyError(err)}`);
      throw err;
    }
  };
  const actSafe = (p: Prospect, a: ProspectAction, n?: string) => act(p, a, n).catch(() => undefined);

  const finishStart = () => {
    setStartedHere(today);
    setFlow('none');
    markDayStarted(today).catch((err) => console.warn('Inicio del día:', err));
  };

  const overlays = (
    <>
      {flow === 'start' && (
        <DayStartFlow
          pending={pending}
          queue={queue.items}
          overflow={queue.overflow}
          poolAvailable={pool.availableCount}
          addMore={more}
          onAct={act}
          onBurst={() => {
            finishStart();
            setFlow('burst');
          }}
          onFinish={finishStart}
        />
      )}
      {flow === 'burst' && (
        <BurstMode queue={queue.items} prospects={list} settings={settings} today={today} onAct={act} onClose={() => setFlow('none')} poolAvailable={pool.availableCount} addMore={more} />
      )}
    </>
  );

  if (prospects === null && !loadError) return null;

  const dayStarted = settings.dayStartedOn === today || startedHere === today;
  const hasWork = pending.length > 0 || queue.items.length > 0 || pool.availableCount > 0;

  // Primera vez en el día: un solo botón grande para arrancar
  if (prospects !== null && settingsLoaded && !dayStarted && hasWork) {
    const toWrite = queue.items.filter((i) => i.kind === 'primer' || i.kind === 'seguimiento').length;
    const urgent = queue.items.length - toWrite;
    return (
      <>
        {overlays}
        <button
          type="button"
          onClick={() => setFlow('start')}
          className="mb-4 w-full flex items-center gap-3 px-4 py-4 rounded-[var(--radius-card)] border border-[var(--accent)]/50 bg-[var(--bg-surface)] text-left hover:bg-[var(--bg-surface-muted)] transition"
        >
          <Sun className="w-5 h-5 text-[var(--accent)] shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-[var(--text-primary)]">Comenzar el día de prospección</span>
            <span className="block text-xs text-[var(--text-secondary)]">
              {[
                pending.length > 0 && `${pending.length} sin anotar`,
                urgent > 0 && `${urgent} urgentes`,
                toWrite > 0 && `${toWrite} para escribir`,
                toWrite === 0 && pool.availableCount > 0 && 'sumá contactos de la reserva',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <span className="px-3 py-1.5 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold shrink-0">Empezar</span>
        </button>
      </>
    );
  }

  // Sin pendientes: una sola línea de acceso, con "sumar más" si quedan contactos en la reserva
  if (prospects === null || (queue.items.length === 0 && !(isEvening && toClose.length > 0))) {
    const canAdd = prospects !== null && pool.availableCount > 0;
    return (
      <div className="mb-4 w-full px-4 py-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-1.5">
        {overlays}
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <button type="button" onClick={onOpen} className="flex-1 text-left text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            {loadError
              ? 'Prospección: no se pudo cargar. Tocá para reintentar.'
              : list.length === 0 && !canAdd
              ? 'Prospección: cargá tu primera tanda de contactos'
              : canAdd
              ? `Prospección al día. ¿Sumar más hoy? Quedan ${pool.availableCount.toLocaleString('es-AR')} en la reserva`
              : 'Prospección: nada pendiente por hoy'}
          </button>
          {canAdd ? (
            <>
              {[2, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={more.busy}
                  onClick={() => more.addMore(Math.min(n, pool.availableCount))}
                  className={`px-2.5 py-1 rounded-[var(--radius-control)] text-xs font-semibold min-w-[2.5rem] flex justify-center disabled:opacity-50 ${
                    n === 2 ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'border border-[var(--border-subtle)] text-[var(--text-primary)]'
                  }`}
                >
                  {more.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `+${n}`}
                </button>
              ))}
            </>
          ) : (
            <button type="button" onClick={onOpen} className="text-sm font-semibold text-[var(--accent)]">
              Abrir
            </button>
          )}
        </div>
        {more.message && <p className={`text-xs ${more.message.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{more.message.text}</p>}
      </div>
    );
  }

  const shown = queue.items.slice(0, 3);
  const rest = queue.items.length - shown.length + queue.overflow;

  return (
    <section className="mb-4 space-y-3" aria-label="Prospección de hoy">
      {overlays}
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-[var(--accent)]" />
        <h2 className="text-base font-semibold text-[var(--text-primary)] flex-1">
          Prospección de hoy
          <span className="ml-2 text-sm font-normal text-[var(--text-secondary)] tabular-nums">{queue.items.length} {queue.items.length === 1 ? 'acción' : 'acciones'}</span>
        </h2>
        <button type="button" onClick={onOpen} className="text-sm font-semibold text-[var(--accent)] hover:underline">
          {rest > 0 ? `Ver las ${queue.items.length}` : 'Abrir'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <TodayPanel
        queue={shown}
        overflow={0}
        toClose={isEvening ? toClose : []}
        showClose={isEvening}
        isEvening={isEvening}
        settings={settings}
        onAct={actSafe}
        poolAvailable={pool.availableCount}
        onAddMore={more.addMore}
        addMoreBusy={more.busy}
        addMoreMessage={more.message}
        onBurst={() => setFlow('burst')}
        onStartDay={pending.length > 0 ? () => setFlow('start') : undefined}
        pendingCount={pending.length}
        compact
      />
    </section>
  );
};
