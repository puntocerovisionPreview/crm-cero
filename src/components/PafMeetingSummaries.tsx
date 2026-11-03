import React, { useState } from 'react';
import { NotebookPen, Trash2 } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { newItemId } from '../panels/model';
import type { PafMeetingSummary } from '../portal/model';
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
}> = ({ project, meetings, onUpdateProject, showForm = true, onDone }) => {
  const items = [...(project.pafResumenes || [])].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const today = getTodayString();
  // Por defecto, la última reunión del estudio que ya pasó
  const lastMeeting = meetings.filter((m) => m.projectId === project.id && m.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
  const [f, setF] = useState({ fecha: lastMeeting?.date || today, acuerdos: '', proximosPasos: '', publicado: true });
  const [error, setError] = useState('');

  const save = (next: PafMeetingSummary[]) => {
    setError('');
    onUpdateProject(project.id, { pafResumenes: next });
    republishIfPublished({ ...project, pafResumenes: next }, meetings).catch((e: Error) => setError(e.message));
  };

  const add = () => {
    if (!f.acuerdos.trim() && !f.proximosPasos.trim()) return;
    save([...(project.pafResumenes || []), { id: newItemId(), fecha: f.fecha, acuerdos: f.acuerdos.trim(), proximosPasos: f.proximosPasos.trim(), publicado: f.publicado }]);
    setF({ ...f, acuerdos: '', proximosPasos: '' });
    onDone?.();
  };

  return (
    <section className="space-y-2 pt-3 border-t border-zinc-800">
      <div>
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-zinc-100"><NotebookPen className="w-3.5 h-3.5 text-zinc-400" />Lo que acordamos</h3>
        <p className="text-[11px] text-zinc-500">Acuerdos y próximos pasos que ve el cliente. Tus notas privadas no se publican.</p>
      </div>

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

      {showForm && <div className="space-y-1.5">
        <input className={`${input} w-40`} type="date" aria-label="Fecha de la reunión" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        <textarea className={input} rows={2} value={f.acuerdos} placeholder="Acuerdos (ej. el foco es vivienda unifamiliar en zona norte)" onChange={(e) => setF({ ...f, acuerdos: e.target.value })} />
        <textarea className={input} rows={2} value={f.proximosPasos} placeholder="Próximos pasos (ej. vos: subir fotos · nosotros: borrador del mensaje)" onChange={(e) => setF({ ...f, proximosPasos: e.target.value })} />
        <div className="flex items-center gap-3">
          <button type="button" onClick={add} className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 text-[11px] font-bold">Guardar resumen</button>
          <label className="flex items-center gap-1 text-[11px] text-zinc-400"><input type="checkbox" checked={f.publicado} onChange={(e) => setF({ ...f, publicado: e.target.checked })} />Que lo vea el estudio</label>
        </div>

      </div>}
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
    </section>
  );
};