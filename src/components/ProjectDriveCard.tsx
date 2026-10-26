import React, { useEffect, useState } from 'react';
import type { Project } from '../types';
import { WebRun, WEB_FOLDERS, isWebProject, validClientEmail } from '../automation/webRecipe';
import { driveApi, pickDriveFiles } from '../automation/driveApi';
import { formatWhatsAppUrl } from '../utils/contact';

export const ProjectDriveCard: React.FC<{ project: Project }> = ({ project }) => {
  const [run, setRun] = useState<WebRun | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [email, setEmail] = useState(project.clientEmail || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'copy' | 'move'>('copy');
  const [preview, setPreview] = useState<any>(null);
  const base = `/api/web-automation/${encodeURIComponent(project.id)}`;
  const web = isWebProject(project);
  const load = async () => { const data = await driveApi(base); setRun(data.run); setHistory(data.history || []); };
  useEffect(() => { setEmail(project.clientEmail || ''); }, [project.id, project.clientEmail]);
  useEffect(() => {
    setRun(null); setError(''); setPreview(null);
    if (!web) return;
    let active = true;
    const refresh = () => driveApi(base).then(d => { if (active) { setRun(d.run); setHistory(d.history || []); } }).catch(e => { if (active) setError(e.message); });
    void refresh();
    const interval = window.setInterval(refresh, 15000);
    return () => { active = false; window.clearInterval(interval); };
  }, [base, web]);
  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); await load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  if (!web) return null;
  const button = 'px-3 py-2 rounded-lg border border-zinc-700 text-sm disabled:opacity-40';
  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3 text-zinc-100">
    <h3 className="font-semibold">Carpetas de Drive</h3>
    <label className="block text-sm">Correo del cliente
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@gmail.com" className="mt-1 w-full bg-zinc-950 rounded-lg border border-zinc-700 p-2" />
    </label>
    <p className="text-xs text-zinc-400">Para compartir Drive. El cliente podrá subir, modificar y borrar archivos en Identidad, Proyectos y Textos. Entregables queda en lectura.</p>
    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={busy || !validClientEmail(email)} onClick={() => act(async () => { await driveApi(`${base}/email`, { email }); setNotice('Correo guardado.'); })}>Guardar correo</button>
      <button className={button} disabled={busy} onClick={() => act(async () => {
        if (email.trim()) await driveApi(`${base}/email`, { email });
        await driveApi(`${base}/run`, {});
      })}>{busy ? 'Preparando…' : run ? 'Reintentar preparación' : 'Preparar proyecto Web'}</button>
    </div>
    <ul className="space-y-2 text-sm">{WEB_FOLDERS.map(f => {
      const folder = run?.folders?.find(x => x.key === f.key);
      return <li key={f.key} className="flex justify-between gap-2">{folder ? <a href={folder.url} target="_blank" rel="noopener noreferrer" className="underline">{f.name}</a> : <span>{f.name}</span>}<span className="text-zinc-400">{folder?.status || 'pendiente'}</span></li>;
    })}</ul>
    {run && <details className="text-sm"><summary>Estado de la preparación</summary><ul className="space-y-1 mt-2">{Object.entries(run.steps).map(([key, s]) => <li key={key}>{key.replaceAll('_', ' ')}: {s.status === 'ok' ? 'Listo' : s.detail}</li>)}</ul></details>}
    {history.length > 0 && <details className="text-sm"><summary>Últimas ejecuciones</summary><ul className="space-y-2 mt-2">{history.map(h => <li key={h.id}>{new Date(h.createdAt).toLocaleString('es-AR')} · {h.status === 'ok' ? 'Completada' : h.status === 'en_curso' ? 'En curso' : 'Con pendientes'}</li>)}</ul></details>}
    {run?.welcome && <details className="text-sm"><summary>Mensaje de bienvenida</summary><p className="whitespace-pre-wrap my-2">{run.welcome}</p>
      {project.clientPhone && <a className={button} href={formatWhatsAppUrl(project.clientPhone, run.welcome)} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>}
      <button className={button} onClick={() => act(async () => { await navigator.clipboard.writeText(run.welcome!); setNotice('Mensaje copiado.'); })}>Copiar mensaje</button>
    </details>}
    {run?.publishedAt && <div className="border-t border-zinc-800 pt-3 space-y-2">
      <p className="text-sm">Web publicada · Preparar archivos finales</p>
      <select value={mode} onChange={e => { setMode(e.target.value as 'copy' | 'move'); setPreview(null); }} className="bg-zinc-950 p-2 rounded-lg"><option value="copy">Copiar a Entregables</option><option value="move">Mover a Entregables</option></select>
      <button className={button} disabled={busy} onClick={() => act(async () => { const fileIds = await pickDriveFiles(project.id); if (fileIds.length) setPreview(await driveApi(`${base}/delivery/preview`, { fileIds, mode })); })}>Elegir archivos finales</button>
      {preview && <div className="space-y-2"><p>{preview.mode === 'copy' ? 'Copiar' : 'Mover'} a {preview.destination}:</p><ul>{preview.files.map((f: any) => <li key={f.id}>{f.name}</li>)}</ul><button className={button} disabled={busy} onClick={() => act(async () => { await driveApi(`${base}/delivery/confirm`, { token: preview.token }); setPreview(null); setNotice('Archivos finales preparados.'); })}>Confirmar {preview.mode === 'copy' ? 'copia' : 'movimiento'}</button><button className={button} onClick={() => setPreview(null)}>Cancelar</button></div>}
    </div>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
  </section>;
};
