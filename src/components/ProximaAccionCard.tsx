import React, { useState } from 'react';
import { AlertOctagon, ArrowRight, Pencil } from 'lucide-react';
import { Project, ProximaAccion } from '../types';

const field = 'rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';
export const RESPONSABLE_ACCION: Record<ProximaAccion['responsable'], string> = { yo: 'Vos', cliente: 'El cliente', cm: 'La CM' };

/** En qué está el cliente para la lista: lo uso para filtrar y ordenar */
export type EstadoCliente = 'bloqueado' | 'mi_accion' | 'esperando' | 'sin_accion';
export function estadoCliente(p: Pick<Project, 'proximaAccion' | 'pafTareas'>, today: string): EstadoCliente {
  const a = p.proximaAccion;
  const revisar = (p.pafTareas || []).some((t) => t.estado === 'enviada');
  if (a?.bloqueado) return 'bloqueado';
  if (revisar || a?.responsable === 'yo' || (a?.fecha && a.fecha < today && a.responsable !== 'cliente')) return 'mi_accion';
  if (a && (a.responsable === 'cliente' || a.responsable === 'cm')) return 'esperando';
  return 'sin_accion';
}

/**
 * PRÓXIMA ACCIÓN: una sola por cliente, con quién la hace, para cuándo y qué necesita.
 * Es lo primero que ves en la ficha y lo que ordena la lista de clientes.
 */
export const ProximaAccionCard: React.FC<{ project: Project; onUpdateProject: (id: string, updates: Partial<Project>) => void }> = ({ project, onUpdateProject }) => {
  const a = project.proximaAccion;
  const [editing, setEditing] = useState(!a);
  const [f, setF] = useState<Omit<ProximaAccion, 'actualizada'>>(() => ({ texto: a?.texto || '', responsable: a?.responsable || 'yo', fecha: a?.fecha || '', necesita: a?.necesita || '', bloqueado: !!a?.bloqueado }));
  const today = new Date().toLocaleDateString('en-CA');
  const vencida = !!a?.fecha && a.fecha < today;

  const save = () => {
    if (!f.texto.trim()) return;
    onUpdateProject(project.id, { proximaAccion: { texto: f.texto.trim(), responsable: f.responsable, ...(f.fecha ? { fecha: f.fecha } : {}), ...(f.necesita?.trim() ? { necesita: f.necesita.trim() } : {}), ...(f.bloqueado ? { bloqueado: true } : {}), actualizada: new Date().toISOString() } });
    setEditing(false);
  };

  if (editing) {
    return (
      <section className="rounded-2xl border border-zinc-700 bg-zinc-900/90 p-4 space-y-2">
        <h2 className="text-xs font-bold text-zinc-100">Próxima acción</h2>
        <input autoFocus className={`${field} w-full`} value={f.texto} placeholder="Qué sigue (ej. Revisar el Excel y preparar la devolución)" onChange={(e) => setF({ ...f, texto: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} />
        <div className="flex flex-wrap gap-1.5">
          <select className={field} value={f.responsable} aria-label="Quién la hace" onChange={(e) => setF({ ...f, responsable: e.target.value as ProximaAccion['responsable'] })}>
            {(Object.keys(RESPONSABLE_ACCION) as ProximaAccion['responsable'][]).map((r) => <option key={r} value={r}>{RESPONSABLE_ACCION[r]}</option>)}
          </select>
          <input type="date" className={`${field} w-36`} value={f.fecha || ''} aria-label="Para cuándo" onChange={(e) => setF({ ...f, fecha: e.target.value })} />
          <input className={`${field} flex-1 min-w-[10rem]`} value={f.necesita || ''} placeholder="Qué necesita para avanzar (opcional)" onChange={(e) => setF({ ...f, necesita: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={!f.texto.trim()} className="btn-solid-primary px-3 py-1.5 text-xs disabled:opacity-50">Guardar</button>
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400"><input type="checkbox" checked={!!f.bloqueado} onChange={(e) => setF({ ...f, bloqueado: e.target.checked })} />Está bloqueado</label>
          {a && <button type="button" onClick={() => setEditing(false)} className="ml-auto text-[11px] text-zinc-400">Cancelar</button>}
        </div>
      </section>
    );
  }

  return (
    <section className={`rounded-2xl border p-4 ${a?.bloqueado ? 'border-rose-500/40 bg-rose-500/[0.05]' : vencida ? 'border-amber-400/40 bg-amber-400/[0.05]' : 'border-zinc-800 bg-zinc-900/90'}`}>
      <div className="flex items-start gap-3">
        {a?.bloqueado ? <AlertOctagon className="mt-0.5 w-4 h-4 shrink-0 text-rose-300" /> : <ArrowRight className="mt-0.5 w-4 h-4 shrink-0 text-zinc-400" />}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-zinc-500">Próxima acción{a?.bloqueado ? ' · bloqueado' : ''}</p>
          <p className="text-sm font-semibold text-zinc-100">{a?.texto}</p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            {RESPONSABLE_ACCION[a!.responsable]}{a?.fecha && <> · {vencida ? <span className="text-amber-300">venció el {a.fecha.split('-').reverse().slice(0, 2).join('/')}</span> : `para el ${a.fecha.split('-').reverse().slice(0, 2).join('/')}`}</>}
            {a?.necesita && <> · necesita: {a.necesita}</>}
          </p>
        </div>
        <button type="button" onClick={() => { setF({ texto: a?.texto || '', responsable: a?.responsable || 'yo', fecha: a?.fecha || '', necesita: a?.necesita || '', bloqueado: !!a?.bloqueado }); setEditing(true); }} aria-label="Cambiar la próxima acción" className="text-zinc-500 hover:text-zinc-200"><Pencil className="w-4 h-4" /></button>
      </div>
    </section>
  );
};
