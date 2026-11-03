import { useEffect, useState } from 'react';
import type { AgendaMeeting, Project } from '../types';
import { applyAvisos, type PafAviso } from './model';
import { republishIfPublished, subscribeAllAvisos } from './store';

/**
 * Mientras el CRM está abierto: toma los "Terminé" de todos los estudios y pasa esas tareas
 * a "Avisó que terminó" (sin abrir cada ficha). El portal publicado se actualiza solo.
 * Nunca aprueba: eso lo hace Juan.
 */
export function usePafAvisos(
  enabled: boolean,
  projects: Project[],
  meetings: AgendaMeeting[],
  onUpdateProject: (id: string, updates: Partial<Project>) => void
) {
  const [byCliente, setByCliente] = useState<Map<string, PafAviso[]>>(new Map());

  useEffect(() => (enabled ? subscribeAllAvisos(setByCliente) : undefined), [enabled]);

  useEffect(() => {
    if (!byCliente.size) return;
    projects.forEach((p) => {
      if (!p.pafClienteId || !p.pafTareas?.length) return;
      const next = applyAvisos(p.pafTareas, byCliente.get(p.pafClienteId) || []);
      if (!next) return;
      onUpdateProject(p.id, { pafTareas: next });
      republishIfPublished({ ...p, pafTareas: next }, meetings).catch(() => undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCliente, projects]);

  return byCliente;
}
