import { useCallback, useEffect, useState } from 'react';
import { ProspectingSettings } from '../types';
import { PoolDoc, loadPool, maybeRunWeeklyBatch } from './poolStore';

/** Estado de la reserva (se lee al abrir y después de cada cambio, no en vivo). */
export function usePool() {
  const [docs, setDocs] = useState<PoolDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDocs(await loadPool());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const available = (docs || []).filter((d) => d.status === 'disponible');
  return { docs, available, availableCount: available.length, takenCount: (docs?.length || 0) - available.length, refresh, error };
}

/** Tanda semanal automática: corre una vez por semana al abrir la app, con la configuración ya cargada. */
export function useWeeklyAutoBatch(
  settings: ProspectingSettings,
  settingsLoaded: boolean,
  today: string,
  opts: { boosts?: Record<string, number>; blockedPhones?: Set<string> },
  onDone?: (n: number) => void
) {
  useEffect(() => {
    if (!settingsLoaded) return;
    maybeRunWeeklyBatch(settings, today, opts)
      .then((n) => n > 0 && onDone?.(n))
      .catch((err) => console.warn('Tanda semanal automática:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded, settings.lastBatchWeek, settings.weeklyBatchSize, today]);
}
