import React, { useState } from 'react';
import { Check, Circle, CircleAlert, Clock, ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import type { AgendaMeeting, Project } from '../types';
import { PREGUNTAS_ARRANQUE, semaforoAlta, type PasoAltaEstado } from '../portal/arranque';
import { republishIfPublished, retryArranque } from '../portal/store';

const ICONO: Record<PasoAltaEstado, React.ReactNode> = {
  hecho: <Check className="h-3.5 w-3.5 text-emerald-400" />,
  esperando: <Clock className="h-3.5 w-3.5 text-amber-300" />,
  error: <CircleAlert className="h-3.5 w-3.5 text-rose-300" />,
  pendiente: <Circle className="h-3.5 w-3.5 text-zinc-600" />,
};

/**
 * ALTA SIN TALLY (tu lado, en la ficha): el interruptor por cliente, el semáforo de cada paso,
 * "Reintentar" si algo falló y las respuestas del estudio (privadas: el portal no las muestra).
 */
export function PafAltaNueva({ project, meetings, onUpdateProject }: { project: Project; meetings: AgendaMeeting[]; onUpdateProject: (id: string, updates: Partial<Project>) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const on = !!project.pafAltaNueva;
  const a = project.pafArranque;

  const toggle = async () => {
    const next = { ...project, pafAltaNueva: !on };
    onUpdateProject(project.id, { pafAltaNueva: !on });
    // Si el portal ya está publicado, que aparezca (o desaparezca) "Completá tus datos"
    await republishIfPublished(next, meetings).catch(() => undefined);
  };
  const reintentar = async () => {
    setBusy(true); setMsg('');
    const err = await retryArranque(project.id);
    setBusy(false);
    setMsg(err || (a?.estado === 'listo' ? 'Listo: se sumó lo nuevo de la carpeta modelo (no se pisó ni borró nada).' : 'Listo: carpetas creadas y compartidas.'));
  };

  return (
    <div className="space-y-2.5">
      <label className="flex items-start gap-2 text-xs text-zinc-200">
        <input type="checkbox" className="mt-0.5" checked={on} onChange={toggle} />
        <span>
          <span className="font-bold">Alta nueva, sin Tally</span>
          <span className="block text-[11px] text-zinc-400">El estudio completa sus datos adentro del portal y se crean solas sus carpetas en tu Drive, copiando 00_MODELO_CLIENTE y 00_MODELO_INTERNO. Le mandás un solo link: el del portal.</span>
        </span>
      </label>

      {on && (
        <>
          <ol className="space-y-1 rounded-lg border border-zinc-800 p-2.5">
            {semaforoAlta(project).map((p) => (
              <li key={p.id} className="flex items-start gap-2 text-[11px]">
                <span className="mt-0.5">{ICONO[p.estado]}</span>
                <span className={p.estado === 'hecho' ? 'text-zinc-200' : 'text-zinc-400'}>{p.label}{p.detalle && <span className={`block ${p.estado === 'error' ? 'text-rose-300' : 'text-zinc-500'}`}>{p.detalle}</span>}</span>
              </li>
            ))}
          </ol>
          {!project.pafPortal?.publishedAt && <p className="text-[11px] text-amber-300">Publicá su portal y mandale el link: lo primero que va a ver es “Completá tus datos”.</p>}
          {a?.respuestas && (
            <button type="button" onClick={reintentar} disabled={busy}
              title={a.estado === 'listo' ? 'Copia a su carpeta lo que agregaste a la carpeta modelo. No pisa ni borra lo que ya tiene.' : undefined}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-200 disabled:opacity-50">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}{a.estado === 'listo' ? 'Traer lo nuevo de la carpeta modelo' : 'Reintentar crear las carpetas'}
            </button>
          )}
          {msg && <p role="status" className="text-[11px] text-zinc-300">{msg}</p>}
          {a?.carpetas?.carpetaCompartida && (
            <div className="flex flex-wrap gap-1.5">
              <a href={a.carpetas.carpetaCompartida} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-200">Su carpeta<ExternalLink className="h-3 w-3" /></a>
              {a.carpetas.carpetaInterna && <a href={a.carpetas.carpetaInterna} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-200">Carpeta interna<ExternalLink className="h-3 w-3" /></a>}
            </div>
          )}
          {a?.respuestas && (
            <details className="rounded-lg border border-zinc-800 p-2.5">
              <summary className="cursor-pointer text-[11px] font-bold text-zinc-200">Lo que respondió (solo lo ves vos)</summary>
              <dl className="mt-2 space-y-1.5">
                {PREGUNTAS_ARRANQUE.filter((p) => a.respuestas[p.id]).map((p) => (
                  <div key={p.id}>
                    <dt className="text-[10px] text-zinc-500">{p.label}</dt>
                    <dd className="whitespace-pre-line text-[11px] text-zinc-200">{Array.isArray(a.respuestas[p.id]) ? (a.respuestas[p.id] as string[]).join(', ') : String(a.respuestas[p.id])}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </>
      )}
    </div>
  );
}
