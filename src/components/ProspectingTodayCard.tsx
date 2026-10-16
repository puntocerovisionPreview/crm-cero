import React, { useMemo } from 'react';
import { Send } from 'lucide-react';
import { useProspecting } from '../prospecting/useProspecting';
import { usePool, useWeeklyAutoBatch } from '../prospecting/usePool';
import { takeFromPool } from '../prospecting/poolStore';
import { buildDailyQueue, pendingDayClose, ProspectAction } from '../prospecting/core';
import { recordProspectAction } from '../prospecting/store';
import { TodayPanel } from '../views/ProspectingView';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { Prospect } from '../types';

// Prospección dentro de Hoy: lo más urgente (3 acciones) y, a la tarde, el cierre del día.
// No aparece si no hay nada pendiente ni prospectos cargados.
export const ProspectingTodayCard: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { prospects, settings, settingsLoaded, today, hour, loadError } = useProspecting();
  const pool = usePool();
  useWeeklyAutoBatch(settings, settingsLoaded, today, () => pool.refresh());
  const list = prospects || [];
  const queue = useMemo(() => buildDailyQueue(list, today, settings), [list, today, settings]);
  const toClose = useMemo(() => pendingDayClose(list, today), [list, today]);
  const isEvening = hour >= settings.closeHour;

  const act = async (p: Prospect, action: ProspectAction, note?: string) => {
    hapticFeedback.medium();
    if (action !== 'no_reply' && action !== 'lost') playTaskDone();
    await recordProspectAction(p, action, today, settings, note).catch((err) => console.warn(err));
  };

  const addMore = async (n: number) => {
    hapticFeedback.medium();
    await takeFromPool(n, settings, today, { perDay: n }).catch(() => 0);
    pool.refresh();
  };

  if (prospects === null && !loadError) return null;
  // Sin pendientes: una sola línea de acceso (en el celular es la entrada a Prospección),
  // con "sumar más" si quedan contactos en la reserva
  if (prospects === null || (queue.items.length === 0 && !(isEvening && toClose.length > 0))) {
    const canAdd = prospects !== null && pool.availableCount > 0;
    return (
      <div className="mb-4 w-full flex items-center gap-2 px-4 py-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <Send className="w-4 h-4 text-[var(--accent)] shrink-0" />
        <button type="button" onClick={onOpen} className="flex-1 text-left text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          {list.length === 0 && !canAdd
            ? 'Prospección: cargá tu primera tanda de contactos'
            : canAdd
            ? `Prospección al día. ¿Sumar más hoy? Quedan ${pool.availableCount.toLocaleString('es-AR')} en la reserva`
            : 'Prospección: nada pendiente por hoy'}
        </button>
        {canAdd ? (
          <>
            <button type="button" onClick={() => addMore(2)} className="px-2.5 py-1 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold">
              +2
            </button>
            <button type="button" onClick={() => addMore(5)} className="px-2.5 py-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-semibold">
              +5
            </button>
          </>
        ) : (
          <button type="button" onClick={onOpen} className="text-sm font-semibold text-[var(--accent)]">
            Abrir
          </button>
        )}
      </div>
    );
  }

  const shown = queue.items.slice(0, 3);
  const rest = queue.items.length - shown.length + queue.overflow;

  return (
    <section className="mb-4 space-y-3" aria-label="Prospección de hoy">
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
      <TodayPanel
        queue={shown}
        overflow={0}
        toClose={isEvening ? toClose : []}
        showClose={isEvening}
        isEvening={isEvening}
        settings={settings}
        onAct={act}
        poolAvailable={pool.availableCount}
        onAddMore={addMore}
        compact
      />
    </section>
  );
};
