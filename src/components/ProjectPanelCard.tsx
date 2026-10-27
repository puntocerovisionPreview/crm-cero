import React, { useEffect, useState } from 'react';
import { LayoutPanelTop } from 'lucide-react';
import type { Project } from '../types';
import type { ClientPanel } from '../panels/model';
import { ensurePafPanel, ensureProjectPanel, panelLink, subscribePanelOfProject } from '../panels/store';
import { navigateTo } from '../utils/router';

export function ProjectPanelCard({ project, onUpdateProject }: {
  project: Project; onUpdateProject: (id: string, updates: Partial<Project>) => void;
}) {
  const [panel, setPanel] = useState<ClientPanel | null | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setPanel(undefined); setNotice(''); setError('');
    return subscribePanelOfProject(project.id, setPanel);
  }, [project.id]);
  const open = async () => {
    setBusy(true); setError('');
    try {
      const paf = project.serviceType === 'paf' || ['paf_base', 'paf_pro'].includes(project.projectType || '');
      const target = panel || (paf
        ? await ensurePafPanel(project, undefined, token => onUpdateProject(project.id, { studentPortalToken: token }))
        : await ensureProjectPanel(project));
      setPanel(target);
      navigateTo(`/paneles?panel=${encodeURIComponent(target.id)}`);
    } catch { setError('No pudimos abrir el panel. Revisá la conexión y reintentá.'); }
    finally { setBusy(false); }
  };
  const button = 'px-4 py-2 rounded-xl border border-zinc-700 text-sm font-semibold disabled:opacity-50';
  return <section aria-label="Panel del cliente" className="rounded-2xl border border-[var(--accent)]/40 bg-zinc-900 p-4 space-y-3">
    <h2 className="text-lg font-bold flex items-center gap-2"><LayoutPanelTop className="w-5 h-5 text-[var(--accent)]" />Panel del cliente</h2>
    <p className="text-sm text-zinc-400">El espacio de {project.clientName}: avances, materiales, tareas y contenido para revisar.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || panel === undefined} onClick={open} className={`${button} bg-[var(--accent)] text-[var(--on-accent)]`}>
        {busy ? 'Abriendo…' : panel === undefined ? 'Buscando panel…' : panel ? 'Administrar panel' : 'Crear panel del cliente'}
      </button>
      {panel?.active && <>
        <a className={button} href={panelLink(panel)} target="_blank" rel="noopener noreferrer">Ver como cliente</a>
        <button type="button" className={button} onClick={async () => {
          try { await navigator.clipboard.writeText(panelLink(panel)); setNotice('Enlace copiado.'); setError(''); }
          catch { setError('No se pudo copiar el enlace. Abrí “Ver como cliente” y copiá la dirección.'); }
        }}>Copiar enlace</button>
      </>}
    </div>
    {panel && !panel.active && <p className="text-sm text-amber-400">El panel está desactivado. Podés revisarlo y activarlo desde Administrar panel.</p>}
    {panel === null && <p className="text-xs text-zinc-400">Todavía no tiene panel. Podés crearlo ahora, aunque Drive no esté conectado.</p>}
    {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </section>;
}
