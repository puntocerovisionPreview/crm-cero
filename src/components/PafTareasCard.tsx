import React, { useEffect, useState } from 'react';
import { BellRing, Check, ListChecks, Package, Trash2 } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { newItemId } from '../panels/model';
import {
  APPROVAL_CHANNELS, PAF_TASK_STATE_LABEL, applyAvisos, approveTask, safeHttpsUrl,
  type PafDelivery, type PafTask, type PafTaskState,
} from '../portal/model';
import { republishIfPublished, subscribeAvisos } from '../portal/store';
import { hapticFeedback } from '../utils/haptics';

const input = 'w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';
const STATE_STYLE: Record<PafTaskState, string> = {
  borrador: 'bg-zinc-800 text-zinc-400',
  habilitada: 'bg-sky-500/15 text-sky-300',
  enviada: 'bg-amber-400/15 text-amber-300',
  aprobada: 'bg-emerald-500/15 text-emerald-300',
};

/**
 * En la ficha PAF: tareas del estudio y entregas.
 * - El estudio ve una tarea solo cuando la habilitás.
 * - Su "Terminé" llega como aviso y la pasa a "Avisó que terminó"; no la aprueba.
 * - La aprobación la confirmás vos, con fecha y canal.
 * Si el portal está publicado, cada cambio se refleja ahí.
 */
export const PafTareasCard: React.FC<{
  project: Project;
  meetings: AgendaMeeting[];
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
}> = ({ project, meetings, onUpdateProject }) => {
  const tasks = project.pafTareas || [];
  const deliveries = project.pafEntregas || [];
  const [newTask, setNewTask] = useState({ titulo: '', detalle: '', fecha: '' });
  const [newDelivery, setNewDelivery] = useState({ titulo: '', enlace: '', fecha: '' });
  const [approving, setApproving] = useState<{ id: string; canal: string } | null>(null);
  const [error, setError] = useState('');

  const save = (updates: Pick<Project, 'pafTareas'> | Pick<Project, 'pafEntregas'>) => {
    onUpdateProject(project.id, updates);
    republishIfPublished({ ...project, ...updates }, meetings).catch(() => setError('Se guardó en la ficha, pero no se pudo actualizar el portal. Reintentá.'));
  };
  const saveTasks = (pafTareas: PafTask[]) => save({ pafTareas });
  const saveDeliveries = (pafEntregas: PafDelivery[]) => save({ pafEntregas });

  // Avisos de "terminé" del estudio
  const clienteId = project.pafClienteId;
  useEffect(() => {
    if (!clienteId) return;
    return subscribeAvisos(clienteId, (avisos) => {
      const next = applyAvisos(project.pafTareas || [], avisos);
      if (next) saveTasks(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, project.pafTareas]);

  const setState = (id: string, estado: PafTaskState) => {
    const now = new Date().toISOString();
    saveTasks(tasks.map((t) => (t.id === id ? { ...t, estado, ...(estado === 'habilitada' ? { habilitadaEn: now, avisoEn: undefined, aprobacion: undefined } : {}) } : t)));
  };

  const addTask = () => {
    if (!newTask.titulo.trim()) return;
    hapticFeedback.light();
    saveTasks([...tasks, { id: newItemId(), titulo: newTask.titulo.trim(), estado: 'borrador', ...(newTask.detalle.trim() ? { detalle: newTask.detalle.trim() } : {}), ...(newTask.fecha ? { fecha: newTask.fecha } : {}) }]);
    setNewTask({ titulo: '', detalle: '', fecha: '' });
  };

  const addDelivery = () => {
    if (!newDelivery.titulo.trim()) return;
    const enlace = newDelivery.enlace.trim() ? safeHttpsUrl(newDelivery.enlace) : null;
    if (newDelivery.enlace.trim() && !enlace) { setError('El enlace tiene que empezar con https://'); return; }
    setError('');
    saveDeliveries([...deliveries, { id: newItemId(), titulo: newDelivery.titulo.trim(), publicada: false, ...(enlace ? { enlace } : {}), ...(newDelivery.fecha ? { fecha: newDelivery.fecha } : {}) }]);
    setNewDelivery({ titulo: '', enlace: '', fecha: '' });
  };

  const waiting = tasks.filter((t) => t.estado === 'enviada').length;

  return (
    <div className="space-y-3 pt-3 border-t border-zinc-800">
      <div className="flex items-center gap-2">
        <ListChecks className="w-3.5 h-3.5 text-sky-400" />
        <h3 className="text-xs font-bold text-zinc-100 flex-1">Tareas del estudio</h3>
        {waiting > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300"><BellRing className="w-3 h-3" />{waiting} para revisar</span>}
      </div>
      {!clienteId && <p className="text-[11px] text-zinc-500">Los avisos de "terminé" llegan cuando el estudio tenga ID y portal publicado.</p>}

      <ul className="space-y-1.5">
        {tasks.map((t) => (
          <li key={t.id} className="rounded-lg border border-zinc-800 p-2 space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="flex-1 min-w-0 text-xs text-zinc-100">
                <span className="font-semibold">{t.titulo}</span>{t.fecha && <span className="text-zinc-500"> · {t.fecha}</span>}
                {t.detalle && <span className="block text-[11px] text-zinc-400">{t.detalle}</span>}
                {t.aprobacion && <span className="block text-[10px] text-emerald-400">Aprobada el {t.aprobacion.fecha.slice(0, 10)} por {t.aprobacion.canal}</span>}
                {t.estado === 'enviada' && t.avisoEn && <span className="block text-[10px] text-amber-300">Avisó que terminó el {t.avisoEn.slice(0, 10)}</span>}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATE_STYLE[t.estado]}`}>{PAF_TASK_STATE_LABEL[t.estado]}</span>
            </div>
            {approving?.id === t.id ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <select aria-label="Canal de la aprobación" className={`${input} w-auto`} value={approving.canal} onChange={(e) => setApproving({ id: t.id, canal: e.target.value })}>
                  {APPROVAL_CHANNELS.map((c) => <option key={c}>{c}</option>)}
                </select>
                <button type="button" onClick={() => { saveTasks(tasks.map((x) => (x.id === t.id ? approveTask(x, approving.canal) : x))); setApproving(null); }} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 text-zinc-950 px-2 py-1 text-[11px] font-bold"><Check className="w-3 h-3" />Confirmar aprobación</button>
                <button type="button" onClick={() => setApproving(null)} className="text-[11px] text-zinc-400">Cancelar</button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                {t.estado === 'borrador' && <button type="button" onClick={() => setState(t.id, 'habilitada')} className="rounded-lg bg-sky-500/15 text-sky-300 px-2 py-1">Habilitar</button>}
                {t.estado === 'habilitada' && <button type="button" onClick={() => setState(t.id, 'borrador')} className="rounded-lg bg-zinc-800 text-zinc-300 px-2 py-1">Ocultar</button>}
                {(t.estado === 'habilitada' || t.estado === 'enviada') && <button type="button" onClick={() => setApproving({ id: t.id, canal: t.estado === 'enviada' ? 'Portal' : 'WhatsApp' })} className="rounded-lg bg-emerald-500/15 text-emerald-300 px-2 py-1">Aprobar</button>}
                {(t.estado === 'enviada' || t.estado === 'aprobada') && <button type="button" onClick={() => setState(t.id, 'habilitada')} className="rounded-lg bg-zinc-800 text-zinc-300 px-2 py-1">Volver a habilitar</button>}
                <button type="button" aria-label={`Borrar ${t.titulo}`} onClick={() => window.confirm(`¿Borrar la tarea "${t.titulo}"?`) && saveTasks(tasks.filter((x) => x.id !== t.id))} className="ml-auto text-zinc-500 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="space-y-1.5">
        <input className={input} value={newTask.titulo} placeholder="Nueva tarea para el estudio" onChange={(e) => setNewTask({ ...newTask, titulo: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
        <div className="flex gap-1.5">
          <input className={input} value={newTask.detalle} placeholder="Detalle (opcional)" onChange={(e) => setNewTask({ ...newTask, detalle: e.target.value })} />
          <input className={`${input} w-36`} type="date" aria-label="Fecha" value={newTask.fecha} onChange={(e) => setNewTask({ ...newTask, fecha: e.target.value })} />
        </div>
        <button type="button" onClick={addTask} className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 text-[11px] font-bold">Agregar (sin habilitar)</button>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Package className="w-3.5 h-3.5 text-violet-400" />
        <h3 className="text-xs font-bold text-zinc-100">Entregas</h3>
      </div>
      <ul className="space-y-1.5">
        {deliveries.map((d) => (
          <li key={d.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 p-2 text-xs">
            <span className="flex-1 min-w-0 truncate">{d.enlace ? <a href={d.enlace} target="_blank" rel="noopener noreferrer" className="underline">{d.titulo}</a> : d.titulo}{d.fecha && <span className="text-zinc-500"> · {d.fecha}</span>}</span>
            <label className="flex items-center gap-1 text-[10px] text-zinc-400"><input type="checkbox" checked={d.publicada} onChange={(e) => saveDeliveries(deliveries.map((x) => (x.id === d.id ? { ...x, publicada: e.target.checked } : x)))} />La ve el estudio</label>
            <button type="button" aria-label={`Borrar ${d.titulo}`} onClick={() => window.confirm(`¿Borrar la entrega "${d.titulo}"?`) && saveDeliveries(deliveries.filter((x) => x.id !== d.id))} className="text-zinc-500 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
          </li>
        ))}
      </ul>
      <div className="space-y-1.5">
        <input className={input} value={newDelivery.titulo} placeholder="Nueva entrega (ej. Guía de mensaje)" onChange={(e) => setNewDelivery({ ...newDelivery, titulo: e.target.value })} />
        <div className="flex gap-1.5">
          <input className={input} value={newDelivery.enlace} placeholder="Enlace de Drive (https://)" onChange={(e) => setNewDelivery({ ...newDelivery, enlace: e.target.value })} />
          <input className={`${input} w-36`} type="date" aria-label="Fecha de la entrega" value={newDelivery.fecha} onChange={(e) => setNewDelivery({ ...newDelivery, fecha: e.target.value })} />
        </div>
        <button type="button" onClick={addDelivery} className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 text-[11px] font-bold">Agregar entrega</button>
      </div>
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
    </div>
  );
};
