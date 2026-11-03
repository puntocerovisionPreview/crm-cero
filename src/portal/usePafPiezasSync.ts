import { useEffect, useRef, useState } from 'react';
import type { Project } from '../types';
import type { ClientPanel } from '../panels/model';
import { subscribePanels } from '../panels/store';
import { portalPieces } from './model';
import { publishPortalExtras } from './store';

/**
 * Mientras el CRM está abierto: copia las piezas de contenido del panel de cada estudio
 * a su portal publicado (lo que cargás en Paneles aparece en "Contenido" del portal).
 * Solo escribe cuando algo cambió.
 */
export function usePafPiezasSync(enabled: boolean, projects: Project[]) {
  const [panels, setPanels] = useState<ClientPanel[]>([]);
  const sent = useRef(new Map<string, string>());

  useEffect(() => (enabled ? subscribePanels(setPanels) : undefined), [enabled]);

  useEffect(() => {
    panels.forEach((panel) => {
      const project = panel.projectId ? projects.find((p) => p.id === panel.projectId) : undefined;
      const clienteId = project?.pafClienteId;
      if (!clienteId || !project?.pafPortal?.publishedAt) return;
      const piezas = portalPieces(panel.pieces);
      const json = JSON.stringify(piezas);
      if (sent.current.get(clienteId) === json) return;
      sent.current.set(clienteId, json);
      publishPortalExtras(clienteId, { piezas }).catch(() => sent.current.delete(clienteId));
    });
  }, [panels, projects]);
}
