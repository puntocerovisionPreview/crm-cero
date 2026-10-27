import React, { useEffect, useState } from 'react';
import { ChevronRight, LayoutPanelTop, Loader2 } from 'lucide-react';
import { Project } from '../types';
import { ClientPanel, panelSummary } from '../panels/model';
import { ensurePafPanel, subscribePanelOfProject } from '../panels/store';
import { navigateTo } from '../utils/router';
import { hapticFeedback } from '../utils/haptics';

/**
 * En la ficha del alumno PAF: su panel (objetivos de la semana, tareas y contenido para aprobar).
 * Usa el mismo link que el portal del alumno, así ve todo junto.
 */
export const PafPanelButton: React.FC<{ project: Project; onUpdateProject: (id: string, updates: Partial<Project>) => void }> = ({ project, onUpdateProject }) => {
  const [panel, setPanel] = useState<ClientPanel | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => subscribePanelOfProject(project.id, setPanel), [project.id]);

  const open = async () => {
    hapticFeedback.light();
    setBusy(true);
    setError('');
    try {
      const p = await ensurePafPanel(project, panel || undefined, (token) => onUpdateProject(project.id, { studentPortalToken: token }));
      navigateTo(`/paneles?panel=${encodeURIComponent(p.id)}`);
    } catch {
      setError('No pudimos abrir el panel. Revisá la conexión y reintentá.');
    } finally {
      setBusy(false);
    }
  };

  if (panel === undefined) return null;
  const s = panel ? panelSummary(panel) : null;
  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="w-full flex items-center gap-2 py-2 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition active:scale-95 text-left"
      title="Objetivos de la semana, tareas y contenido para aprobar, en el mismo link del alumno"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LayoutPanelTop className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
      <span className="flex-1 min-w-0">
        <span className="block">{panel ? 'Panel del alumno' : 'Crear panel del alumno'}</span>
        <span className="block text-[10px] font-medium text-zinc-400 truncate">
          {s
            ? `Objetivos ${s.goalsDone}/${s.goals} · ${s.tasksOpen} tareas · ${s.toApprove} para aprobar${s.changes ? ` · ${s.changes} con cambios` : ''}`
            : 'Plan de tres meses, tareas, contenido y sesiones'}
        </span>
        {error && <span role="alert" className="block text-[10px] font-medium text-rose-300 whitespace-normal mt-1">{error}</span>}
      </span>
      <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
    </button>
  );
};
