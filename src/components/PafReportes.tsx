import React, { useState } from 'react';
import { Copy, FileText, Trash2 } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { newItemId } from '../panels/model';
import { nextMeeting, type PafReporte } from '../portal/model';
import { republishIfPublished } from '../portal/store';
import { getTodayString } from '../utils/storage';

const input = 'w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';
const ddmm = (d: string) => d.split('-').reverse().slice(0, 2).join('/');
const minus = (d: string, days: number) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() - days); return x.toLocaleDateString('en-CA'); };

/** Borrador del reporte con lo que pasó en la semana (tareas, entregas, reuniones). Los números los cargás vos. */
export function draftReporte(project: Project, meetings: AgendaMeeting[], hasta = getTodayString()): Omit<PafReporte, 'id' | 'publicado' | 'creadoEn'> {
  const desde = minus(hasta, 6);
  const enRango = (iso?: string) => !!iso && iso.slice(0, 10) >= desde && iso.slice(0, 10) <= hasta;
  const tareas = project.pafTareas || [];
  const entregas = (project.pafEntregas || []).filter((e) => e.publicada && enRango(e.fecha));
  const reunionesSemana = meetings.filter((m) => m.projectId === project.id && m.completed && enRango(m.date));
  const hicimos = [
    ...entregas.map((e) => `Te compartimos ${e.titulo}${e.version ? ` (${e.version})` : ''}`),
    ...reunionesSemana.map((m) => `Reunión del ${ddmm(m.date)}: ${m.title.split(' · ')[0]}`),
  ];
  const aprobaste = [
    ...tareas.filter((t) => t.estado === 'aprobada' && enRango(t.aprobacion?.fecha)).map((t) => t.titulo),
    ...(project.pafEntregas || []).filter((e) => e.estado === 'aprobada' && enRango(e.fecha)).map((e) => e.titulo),
  ];
  const falta = tareas.filter((t) => t.estado === 'habilitada' && (t.responsable || 'estudio') === 'estudio').map((t) => `${t.titulo}${t.fecha ? ` — para el ${ddmm(t.fecha)}` : ''}`);
  const prox = nextMeeting(meetings, project.id, hasta);
  const viene = [
    ...(prox ? [`Reunión del ${ddmm(prox.fecha)}${prox.hora ? ` a las ${prox.hora}` : ''}${prox.objetivo ? `: ${prox.objetivo}` : ''}`] : []),
    ...(project.pafEntregas || []).filter((e) => !e.publicada).slice(0, 2).map((e) => `Preparamos ${e.titulo}`),
  ];
  const lista = (xs: string[]) => xs.map((x) => `- ${x}`).join('\n');
  return { desde, hasta, hicimos: lista(hicimos), aprobaste: lista(aprobaste), falta: lista(falta), viene: lista(viene), numeros: '' };
}

/** Texto para el mail, con el formato del reporte del viernes */
export function reporteTexto(r: Omit<PafReporte, 'id' | 'publicado' | 'creadoEn'>, estudio: string, nombre: string): string {
  const parte = (t: string, v: string) => (v.trim() ? `${t}\n${v.trim()}\n` : '');
  return [
    `Asunto: ${estudio} · Periodo ${ddmm(r.desde)} a ${ddmm(r.hasta)} · Resumen`,
    '',
    `Hola ${nombre}, te dejo el resumen de la semana.`,
    '',
    parte('1. LO QUE HICIMOS ESTA SEMANA', r.hicimos),
    parte('2. LO QUE APROBASTE', r.aprobaste),
    parte('3. LO QUE FALTA DE TU LADO', r.falta),
    parte('4. LO QUE VIENE LA SEMANA QUE VIENE', r.viene),
    parte('5. NÚMEROS', r.numeros),
    '¡Buen fin de semana!',
  ].filter((x) => x !== '').join('\n');
}

/**
 * REPORTE DEL VIERNES: se arma con lo que cargaste en la semana. Lo revisás, sumás los números
 * (nunca se inventan) y lo copiás para el mail. Si lo publicás, lo ve también en su portal.
 */
export const PafReportes: React.FC<{ project: Project; meetings: AgendaMeeting[]; onUpdateProject: (id: string, updates: Partial<Project>) => void; open: boolean; onOpen: (v: boolean) => void }> = ({ project, meetings, onUpdateProject, open, onOpen }) => {
  const [f, setF] = useState(() => draftReporte(project, meetings));
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const items = [...(project.pafReportes || [])].sort((a, b) => b.hasta.localeCompare(a.hasta));
  const nombre = project.ownerName || project.clientName;

  const save = (next: PafReporte[]) => {
    setError('');
    onUpdateProject(project.id, { pafReportes: next });
    republishIfPublished({ ...project, pafReportes: next }, meetings).catch((e: Error) => setError(e.message));
  };
  const guardar = (publicado: boolean) => {
    save([...(project.pafReportes || []), { ...f, id: newItemId(), publicado, creadoEn: new Date().toISOString() }]);
    onOpen(false);
  };
  const copiar = async (texto: string) => { try { await navigator.clipboard.writeText(texto); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sin portapapeles */ } };
  const campo = (k: keyof typeof f, label: string, rows = 3, ph = '') => (
    <label className="block text-[11px] text-zinc-400">{label}
      <textarea className={input} rows={rows} value={f[k]} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );

  return (
    <div className="space-y-2.5">
      {open && (
        <div className="space-y-2 rounded-lg border border-zinc-700 p-2.5">
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            Del <input type="date" className={`${input} w-36`} value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
            al <input type="date" className={`${input} w-36`} value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
            <button type="button" onClick={() => setF(draftReporte(project, meetings, f.hasta))} className="ml-auto text-[11px] font-bold text-zinc-300 hover:text-zinc-100">Volver a armar</button>
          </div>
          {campo('hicimos', '1. Lo que hicimos esta semana')}
          {campo('aprobaste', '2. Lo que aprobaste', 2)}
          {campo('falta', '3. Lo que falta de tu lado', 2)}
          {campo('viene', '4. Lo que viene', 2)}
          {campo('numeros', '5. Números (solo los reales, con su fuente)', 2, 'Ej: publicaciones de la semana: 3 · visitas al perfil: 412 (Instagram, 7 días)')}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => copiar(reporteTexto(f, project.clientName, nombre))} className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-200 hover:bg-zinc-700"><Copy className="w-3 h-3" />{copied ? 'Copiado' : 'Copiar para el mail'}</button>
            <button type="button" onClick={() => guardar(false)} className="rounded-lg bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-200 hover:bg-zinc-700">Guardar</button>
            <button type="button" onClick={() => guardar(true)} className="btn-solid-primary px-2.5 py-1 text-[11px]">Guardar y publicar</button>
            <button type="button" onClick={() => onOpen(false)} className="ml-auto text-[11px] text-zinc-400">Cancelar</button>
          </div>
          <p className="text-[10px] text-zinc-500">Publicar lo muestra en su portal solo si “Reportes” está prendido en Ajustes → Qué ve tu cliente.</p>
        </div>
      )}
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.slice(0, 4).map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-[11px] text-zinc-300">
              <FileText className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
              <span className="flex-1 min-w-0 truncate">Del {ddmm(r.desde)} al {ddmm(r.hasta)}</span>
              <button type="button" onClick={() => copiar(reporteTexto(r, project.clientName, nombre))} className="text-zinc-400 hover:text-zinc-100" title="Copiar para el mail"><Copy className="w-3.5 h-3.5" /></button>
              <label className="flex items-center gap-1 text-[10px] text-zinc-400"><input type="checkbox" checked={r.publicado} onChange={(e) => save((project.pafReportes || []).map((x) => (x.id === r.id ? { ...x, publicado: e.target.checked } : x)))} />Publicado</label>
              <button type="button" aria-label="Borrar reporte" onClick={() => window.confirm('¿Borrar este reporte?') && save((project.pafReportes || []).filter((x) => x.id !== r.id))} className="text-zinc-500 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      ) : !open && <p className="text-[11px] text-zinc-500">Todavía no armaste ninguno.</p>}
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
    </div>
  );
};
