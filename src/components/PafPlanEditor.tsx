import React, { useState } from 'react';
import type { Project } from '../types';
import type { ClientPanel } from '../panels/model';
import { newItemId } from '../panels/model';
import { createPafPlan, PAF_MONTHS, PAF_WORK_LABELS, safeResourceUrl, type PafPlanItem, type PafWorkStatus } from '../panels/pafPlan';

const field = 'w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-2 text-sm text-[var(--text-primary)]';
const button = 'rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-40';

export function PafPlanEditor({ panel, project, save }: { panel: ClientPanel; project?: Project; save: (p: ClientPanel) => Promise<void> }) {
  const [draft, setDraft] = useState(() => panel.paf || createPafPlan(project));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const update = (id: string, patch: Partial<PafPlanItem>) => {
    setDraft((prev) => ({ ...prev, items: prev.items.map((i) => i.id === id ? { ...i, ...patch } : i) }));
    setMessage('');
  };
  const publish = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await save({ ...panel, paf: draft });
      setMessage(panel.active ? 'Plan guardado. Ya está disponible en el enlace del cliente.' : 'Plan guardado. Activá el panel para compartir estos cambios con el cliente.');
    } catch { setError('No pudimos guardar el plan. Tus cambios siguen acá; volvé a intentarlo.'); }
    finally { setBusy(false); }
  };
  const addResource = () => {
    const url = safeResourceUrl(resourceUrl.trim());
    if (!resourceTitle.trim() || !url) { setError('El recurso necesita un nombre y una dirección http o https válida.'); return; }
    setDraft((prev) => ({ ...prev, resources: [...prev.resources, { id: newItemId(), title: resourceTitle.trim(), url }] }));
    setResourceTitle(''); setResourceUrl(''); setError(''); setMessage('');
  };
  return <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-5">
    <div><h2 className="font-bold text-[var(--text-primary)]">Plan PAF · Los tres meses del cliente</h2>
      <p className="text-sm text-[var(--text-secondary)] mt-1">Lo que escribís acá se comparte en su panel. Los estados se actualizan manualmente; cambiar de semana no completa entregas.</p></div>
    <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
      <label className="block text-sm text-[var(--text-secondary)]">Objetivo del estudio
        <textarea className={field + ' mt-1'} rows={2} value={draft.goal} placeholder="Ej.: atraer proyectos de vivienda alineados con el estudio y ordenar su seguimiento." onChange={(e) => { setDraft({ ...draft, goal: e.target.value }); setMessage(''); }} />
      </label>
      {PAF_MONTHS.map((month) => <details key={month.month} open className="rounded-xl border border-[var(--border-subtle)] p-3">
        <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">Mes {month.month} · {month.title}</summary>
        <div className="space-y-3 mt-3">{draft.items.filter((i) => i.month === month.month).map((item) => <div key={item.id} className="space-y-2 border-b border-[var(--border-subtle)] pb-3">
          <label className="block"><span className="text-xs text-[var(--text-secondary)]">Actividad o entregable</span><input aria-label="Nombre del entregable" className={field} value={item.title} onChange={(e) => update(item.id, { title: e.target.value })} /></label>
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="text-xs text-[var(--text-secondary)]">Estado<select className={field} value={item.status} onChange={(e) => update(item.id, { status: e.target.value as PafWorkStatus })}>{Object.entries(PAF_WORK_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
            <label className="text-xs text-[var(--text-secondary)]">Pilar<select className={field} value={item.pillar} onChange={(e) => update(item.id, { pillar: e.target.value as PafPlanItem['pillar'] })}><option value="presencia">Presencia</option><option value="adquisicion">Adquisición</option><option value="conversion">Funnel</option><option value="general">General</option></select></label>
            <label className="text-xs text-[var(--text-secondary)]">Semana prevista<input className={field} type="number" min={1} max={12} value={item.week || ''} onChange={(e) => update(item.id, { week: e.target.value ? Math.max(1, Math.min(12, Number(e.target.value))) : undefined })} /></label>
          </div>
          <textarea aria-label="Detalle visible para el cliente" className={field} rows={2} placeholder="Qué vamos a hacer, qué se entregó o qué falta del cliente." value={item.detail || ''} onChange={(e) => update(item.id, { detail: e.target.value })} />
          <button type="button" className={button} onClick={() => { setDraft({ ...draft, items: draft.items.filter((i) => i.id !== item.id) }); setMessage(''); }}>Quitar actividad</button>
        </div>)}</div>
        <button type="button" className={button + ' mt-3'} onClick={() => { setDraft({ ...draft, items: [...draft.items, { id: newItemId(), title: 'Nueva actividad', month: month.month, pillar: month.month === 1 ? 'presencia' : month.month === 2 ? 'adquisicion' : 'conversion', status: 'pendiente' }] }); setMessage(''); }}>Agregar actividad al mes {month.month}</button>
      </details>)}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><input type="checkbox" checked={draft.cm.enabled} onChange={(e) => { setDraft({ ...draft, cm: { ...draft.cm, enabled: e.target.checked } }); setMessage(''); }} /> Incluir gestión de contenido y comunidad (CM)</label>
        {draft.cm.enabled && <label className="block text-sm text-[var(--text-secondary)]">Alcance acordado con este cliente<textarea rows={3} className={field + ' mt-1'} value={draft.cm.scope} onChange={(e) => { setDraft({ ...draft, cm: { ...draft.cm, scope: e.target.value } }); setMessage(''); }} placeholder="Redes, piezas por mes, quién graba, publicación, mensajes, horarios y revisiones." /></label>}
      </div>
      <div className="space-y-2"><h3 className="font-semibold text-[var(--text-primary)]">Recursos y entregables compartidos</h3>
        <p className="text-xs text-[var(--text-secondary)]">Agregá solo enlaces destinados al cliente: web, carpeta de trabajo, guías, videos o prompts.</p>
        {draft.resources.map((r) => <div key={r.id} className="flex items-center gap-2 text-sm text-[var(--text-primary)]"><span className="flex-1 break-all">{r.title}</span><button type="button" className={button} onClick={() => { setDraft({ ...draft, resources: draft.resources.filter((x) => x.id !== r.id) }); setMessage(''); }}>Quitar</button></div>)}
        <input className={field} aria-label="Nombre del recurso" placeholder="Nombre del recurso" value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} />
        <input className={field} aria-label="Enlace del recurso" type="url" placeholder="https://…" value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} />
        <button type="button" className={button} onClick={addResource}>Agregar recurso</button>
      </div>
    </fieldset>
    {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
    <button type="button" disabled={busy || draft.items.some((i) => !i.title.trim())} onClick={publish} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--on-accent)] disabled:opacity-40">{busy ? 'Guardando…' : 'Guardar y publicar plan PAF'}</button>
  </section>;
}
