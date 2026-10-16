import React, { useMemo } from 'react';
import { Send } from 'lucide-react';
import { useProspecting } from '../prospecting/useProspecting';
import { buildDailyQueue, pendingDayClose, ProspectAction } from '../prospecting/core';
import { recordProspectAction } from '../prospecting/store';
import { TodayPanel } from '../views/ProspectingView';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { Prospect } from '../types';

// Prospección dentro de Hoy: lo más urgente (3 acciones) y, a la tarde, el cierre del día.
// No aparece si no hay nada pendiente ni prospectos cargados.
export const ProspectingTodayCard: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { prospects, settings, today, hour, loadError } = useProspecting();
  const list = prospects || [];
  const queue = useMemo(() => buildDailyQueue(list, today, settings), [list, today, settings]);
  const toClose = useMemo(() => pendingDayClose(list, today), [list, today]);
  const isEvening = hour >= settings.closeHour;

  if (prospects === null && !loadError) return null;
  // Sin pendientes: una sola línea de acceso (en el celular es la entrada a Prospección)
  if (prospects === null || (queue.items.length === 0 && !(isEvening && toClose.length > 0))) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="mb-4 w-full flex items-center gap-2 px-4 py-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-left hover:bg-[var(--bg-surface-elevated)] transition"
      >
        <Send className="w-4 h-4 text-[var(--accent)] shrink-0" />
        <span className="flex-1 text-sm text-[var(--text-secondary)]">
          {list.length === 0 ? 'Prospección: cargá tu primera tanda de contactos' : 'Prospección: nada pendiente por hoy'}
        </span>
        <span className="text-sm font-semibold text-[var(--accent)]">Abrir</span>
      </button>
    );
  }

  const act = async (p: Prospect, action: ProspectAction, note?: string) => {
    hapticFeedback.medium();
    if (action !== 'no_reply' && action !== 'lost') playTaskDone();
    await recordProspectAction(p, action, today, settings, note).catch((err) => console.warn(err));
  };

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
        compact
      />
    </section>
  );
};
