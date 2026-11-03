import React, { useState } from 'react';
import { Copy, MessageCircle, NotebookPen, Trash2 } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { newItemId } from '../panels/model';
import { nextMeeting, whatsappDigits, type PafMeetingSummary, type PafTask } from '../portal/model';
import { hoyAcordamos, tareasDeSuLado } from '../portal/mensajes';
import { republishIfPublished } from '../portal/store';
import { getTodayString } from '../utils/storage';

const input = 'w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';

/**
 * Resumen de reunión: acuerdos y próximos pasos. Lo ve el estudio en su portal si está
 * marcado. Las notas privadas de la reunión siguen en la agenda y nunca se publican.
 */
export const PafMeetingSummaries: React.FC<{
  project: Project;
  meetings: AgendaMeeting[];
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  /** Mostrar el formulario para anotar (si no, solo la lista) */
  showForm?: boolean;
  onDone?: () => void;
  /** Sin título propio (cuando va dentro de una sección que ya lo tiene) */
  bare?: boolean;
}> = ({ project, meetings, onUpdateProject, showForm = true, onDone, bare }) => {
  const items = [...(project.pafResumenes || [])].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const today = getTodayString();
  // Por defecto, la última reunión del estudio que ya pasó
  const lastMeeting = meetings.filter((m) => m.projectId === project.id && m.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
  const [f, setF] = useState({ fecha: lastMeeting?.date || today, acuerdos: '', deTuLado: '', deNuestroLado: '', publicado: true, crearTareas: true });
  const [error, setError] = useState('');
  // El mensaje "Hoy acordamos" que queda listo después de guardar
  const [mensaje, setMensaje] = useState('');
  const [copied, setCopied] = useState(false);
  const nombre = project.ownerName || project.clientName;
  const phone = whatsappDigits(project.clientPhone || '');

  const save = (next: PafMeetingSummary[], extra: Partial<Project> = {}) => {
    setError('');
    onUpdateProject(project.id, { pafResumenes: next, ...extra });
    republishIfPublished({ ...project, pafResumenes: next, ...extra }, meetings).catch((e: Error) => setError(e.message));
  };

  const add = () => {
    if (!f.acuerdos.trim() && !f.deTuLado.trim() && !f.deNuestroLado.trim()) return;
    const lista = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => `- ${l.replace(/^[-•]\s*/, '')}`).join('\n');
    const proximosPasos = [f.deTuLado.trim() && `De tu lado:\n${lista(f.deTuLado)}`, f.deNuestroLado.trim() && `De nuestro lado:\n${lista(f.deNuestroLado)}`].filter(Boolean).join('\n');
    // Lo de su lado queda como tareas ocultas: las revisás y las habilitás
    const nuevas: PafTask[] = f.crearTareas ? tareasDeSuLado(f.deTuLado).map((t) => ({ id: newItemId(), titulo: t.titulo, ...(t.fecha ? { fecha: t.fecha } : {}), estado: 'borrador' })) : [];
    save([...(project.pafResumenes || []), { id: newItemId(), fecha: f.fecha, acuerdos: f.acuerdos.trim(), proximosPasos, publicado: f.publicado }],
      nuevas.length ? { pafTareas: [...(project.pafTareas || []), ...nuevas] } : {});
    setMensaje(hoyAcordamos({ nombre, decisiones: f.acuerdos, deTuLado: f.deTuLado, deNuestroLado: f.deNuestroLado, proxima: nextMeeting(meetings, project.id, today) }));
    setF({ ...f, acuerdos: '', deTuLado: '', deNuestroLado: '' });
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(mensaje); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sin portapapeles */ } };

  return (
    <section className={bare ? 'space-y-2' : 'space-y-2 pt-3 border-t border-zinc-800'}>
      {!bare && <div>
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-zinc-100"><NotebookPen className="w-3.5 h-3.5 text-zinc-400" />Lo que acordamos</h3>
        <p className="text-[11px] text-zinc-500">Acuerdos y próximos pasos que ve el cliente. Tus notas privadas no se publican.</p>
      </div>}

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((s) => (
            <li key={s.id} className="rounded-lg border border-zinc-800 p-2 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex-1 font-semibold text-zinc-100">{s.fecha}</span>
                <label className="flex items-center gap-1 text-[10px] text-zinc-400"><input type="checkbox" checked={s.publicado} onChange={(e) => save((project.pafResumenes || []).map((x) => (x.id === s.id ? { ...x, publicado: e.target.checked } : x)))} />La ve el estudio</label>
                <button type="button" aria-label={`Borrar resumen del ${s.fecha}`} onClick={() => window.confirm('¿Borrar este resumen?') && save((project.pafResumenes || []).filter((x) => x.id !== s.id))} className="text-zinc-500 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              {s.acuerdos && <p className="text-zinc-300 whitespace-pre-line"><span className="text-zinc-500">Acuerdos: </span>{s.acuerdos}</p>}
              {s.proximosPasos && <p className="text-zinc-300 whitespace-pre-line"><span className="text-zinc-500">Próximos pasos: </span>{s.proximosPasos}</p>}
            </li>
          ))}
        </ul>
      )}

      {mensaje && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] p-2.5 space-y-2">
          <p className="text-[11px] font-semibold text-zinc-100">Mensaje "Hoy acordamos", listo para mandar</p>
          <textarea className={input} rows={7} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={copiar} className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-200 hover:bg-zinc-700"><Copy className="w-3 h-3" />{copied ? 'Copiado' : 'Copiar'}</button>
            {phone.length >= 10 && <a href={`https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300"><MessageCircle className="w-3 h-3" />Abrir WhatsApp</a>}
            <button type="button" onClick={() => { setMensaje(''); onDone?.(); }} className="ml-auto text-[11px] text-zinc-400">Listo</button>
          </div>
          <p className="text-[10px] text-zinc-500">Lo mandás vos. Lo de su lado quedó en Tareas, oculto: revisalo y habilitalo.</p>
        </div>
      )}

      {showForm && !mensaje && <div className="space-y-1.5">
        <input className={`${input} w-40`} type="date" aria-label="Fecha de la reunión" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        <textarea className={input} rows={2} value={f.acuerdos} placeholder="Qué decidimos (una por línea). Ej: el foco es vivienda unifamiliar en zona norte" onChange={(e) => setF({ ...f, acuerdos: e.target.value })} />
        <textarea className={input} rows={2} value={f.deTuLado} placeholder="De su lado (una por línea, con fecha si hay). Ej: Subir fotos de la obra Belgrano — 12/11" onChange={(e) => setF({ ...f, deTuLado: e.target.value })} />
        <textarea className={input} rows={2} value={f.deNuestroLado} placeholder="De nuestro lado (una por línea). Ej: Borrador del mensaje para el martes" onChange={(e) => setF({ ...f, deNuestroLado: e.target.value })} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={add} className="btn-solid-primary px-2.5 py-1 text-[11px]">Guardar y armar mensaje</button>
          <label className="flex items-center gap-1 text-[11px] text-zinc-400"><input type="checkbox" checked={f.publicado} onChange={(e) => setF({ ...f, publicado: e.target.checked })} />Que lo vea el estudio</label>
          <label className="flex items-center gap-1 text-[11px] text-zinc-400"><input type="checkbox" checked={f.crearTareas} onChange={(e) => setF({ ...f, crearTareas: e.target.checked })} />Lo de su lado, como tareas</label>
        </div>
      </div>}
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
    </section>
  );
};