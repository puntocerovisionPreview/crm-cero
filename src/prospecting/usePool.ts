import { useCallback, useEffect, useState } from 'react';
import { ProspectingSettings } from '../types';
import { PoolDoc, contarPool, loadPoolDisponibles, maybeRunWeeklyBatch } from './poolStore';

/**
 * Estado de la reserva (se lee al abrir y después de cada cambio, no en vivo).
 * Por defecto solo CUENTA (unas pocas lecturas); con `completo` trae los disponibles (pestaña Reserva).
 */
export function usePool(completo = false) {
  const [docs, setDocs] = useState<PoolDoc[] | null>(null);
  const [conteo, setConteo] = useState<{ disponibles: number; tomados: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (forzar = true) => {
    try {
      if (completo) setDocs(await loadPoolDisponibles());
      setConteo(await contarPool(forzar));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [completo]);

  useEffect(() => {
    refresh(false);
  }, [refresh]);

  const available = (docs || []).filter((d) => d.status === 'disponible');
  return {
    docs: completo ? docs : conteo ? [] : null,
    available,
    availableCount: conteo?.disponibles ?? available.length,
    takenCount: conteo?.tomados ?? 0,
    refresh: () => refresh(true),
    error,
  };
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
