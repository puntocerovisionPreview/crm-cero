import React, { useState } from 'react';
import { Check, Undo2 } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { hitoInfoDe, hitosCompletados, hitosDe, type PafHitoConfirmado, type Recorrido } from '../portal/model';
import { republishIfPublished } from '../portal/store';
import { conHistorial } from '../portal/historial';
import type { Etapa } from '../portal/presencia';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';

/** Confirma un hito de una etapa (reemplaza si ya estaba) */
export function confirmarHito(actuales: PafHitoConfirmado[], hito: number, evidencia: string, etapa: Etapa = 'presencia'): PafHitoConfirmado[] {
  const mismo = (h: PafHitoConfirmado) => h.hito === hito && (h.etapa || 'presencia') === etapa;
  return [...actuales.filter((h) => !mismo(h)), { ...(etapa !== 'presencia' ? { etapa } : {}), hito, fecha: getTodayString(), evidencia: evidencia.trim().slice(0, 300) }];
}

const input = 'w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';

/**
 * AVANCE POR HITOS: el progreso del cliente se cuenta por los hitos que confirmás, con una línea
 * de evidencia (privada), nunca por las semanas que pasaron. "Estamos acá" marca el hito actual.
 */
export const PafHitosCard: React.FC<{
  project: Project;
  meetings: AgendaMeeting[];
  hito: number;
  mostrarAvance: boolean;
  onSetHito: (n: number) => void;
  onToggleAvance: (v: boolean) => void;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  recorrido?: Recorrido;
  /** Etapa del método en la que está (los hitos son los de esa etapa) */
  etapa?: Etapa;
}> = ({ project, meetings, hito, mostrarAvance, onSetHito, onToggleAvance, onUpdateProject, recorrido, etapa = 'presencia' }) => {
  const PRESENCIA_HITOS = hitosDe(recorrido, etapa);
  const PRESENCIA_HITO_INFO = hitoInfoDe(recorrido, etapa);
  const todos = project.pafHitos || [];
  const confirmados = todos.filter((h) => (h.etapa || 'presencia') === etapa);
  const hechos = hitosCompletados(todos, etapa);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [evidencia, setEvidencia] = useState('');
  const [error, setError] = useState('');

  const save = (next: PafHitoConfirmado[], nota: string) => {
    setError('');
    const updates = { pafHitos: next, ...conHistorial(project, nota) };
    onUpdateProject(project.id, updates);
    republishIfPublished({ ...project, ...updates }, meetings).catch((e: Error) => setError(e.message));
  };
  const confirmar = (n: number) => {
    if (!evidencia.trim()) return;
    hapticFeedback.success();
    save(confirmarHito(todos, n, evidencia, etapa), `Hito confirmado: ${PRESENCIA_HITOS[n - 1]} — ${evidencia.trim()}`);
    // Si era el hito actual, pasa al siguiente
    if (hito <= n && n < PRESENCIA_HITOS.length) onSetHito(n + 1);
    setAbierto(null); setEvidencia('');
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <h3 className="text-xs font-bold text-zinc-100">Avance · {hechos.length} de {PRESENCIA_HITOS.length} hitos completados</h3>
          <p className="text-[11px] text-zinc-500">Se cuenta por los hitos que confirmás, no por la fecha. La evidencia queda solo para vos.</p>
        </div>
        <label className="shrink-0 inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
          <input type="checkbox" checked={mostrarAvance} onChange={(e) => onToggleAvance(e.target.checked)} />Que lo vea
        </label>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${PRESENCIA_HITOS.length}, minmax(0, 1fr))` }} aria-hidden>
        {PRESENCIA_HITOS.map((t, i) => <span key={t} className={`h-1.5 rounded-full ${hechos.includes(i + 1) ? 'bg-emerald-500' : i + 1 === hito ? 'bg-zinc-400' : 'bg-zinc-800'}`} />)}
      </div>
      <ol className="space-y-1.5">
        {PRESENCIA_HITOS.map((titulo, i) => {
          const n = i + 1;
          const conf = confirmados.find((h) => h.hito === n);
          const actual = n === hito && !conf;
          return (
            <li key={titulo} className={`rounded-lg border p-2.5 ${actual ? 'border-zinc-500 bg-white/[0.03]' : 'border-zinc-800'}`}>
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex w-5 h-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${conf ? 'bg-emerald-500 text-zinc-950' : actual ? 'border-2 border-zinc-300 text-zinc-100' : 'border border-zinc-700 text-zinc-500'}`}>
                  {conf ? <Check className="w-3 h-3" /> : n}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${conf || actual ? 'text-zinc-100' : 'text-zinc-400'}`}>{titulo}{actual && <span className="ml-2 text-[10px] font-normal text-sky-300">Estamos acá</span>}</p>
                  {conf
                    ? <p className="text-[10px] text-emerald-400">Confirmado el {conf.fecha.split('-').reverse().slice(0, 2).join('/')} · <span className="text-zinc-400">{conf.evidencia}</span></p>
                    : <p className="text-[10px] text-zinc-500">Se completa cuando: {PRESENCIA_HITO_INFO[i].seCompleta}</p>}
                  {abierto === n && (
                    <div className="mt-2 space-y-1.5">
                      <input autoFocus className={input} value={evidencia} maxLength={300} placeholder="Evidencia (ej. Kit revisado y foco aprobado en la reunión del 12/11)" onChange={(e) => setEvidencia(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmar(n)} />
                      <div className="flex gap-2">
                        <button type="button" disabled={!evidencia.trim()} onClick={() => confirmar(n)} className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-300 disabled:opacity-50">Confirmar hito</button>
                        <button type="button" onClick={() => { setAbierto(null); setEvidencia(''); }} className="text-[11px] text-zinc-400">Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
                {abierto !== n && (
                  <div className="flex shrink-0 flex-col items-end gap-1 text-[10px] font-bold">
                    {conf
                      ? <button type="button" onClick={() => window.confirm(`¿Desmarcar "${titulo}"?`) && save(todos.filter((h) => !(h.hito === n && (h.etapa || 'presencia') === etapa)), `Hito desmarcado: ${titulo}`)} className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-200"><Undo2 className="w-3 h-3" />Desmarcar</button>
                      : <button type="button" onClick={() => { setAbierto(n); setEvidencia(''); }} className="rounded-md bg-zinc-800 px-2 py-1 text-zinc-200 hover:bg-zinc-700">Confirmar</button>}
                    {!conf && !actual && <button type="button" onClick={() => onSetHito(n)} className="font-normal text-zinc-500 hover:text-zinc-200">Estamos acá</button>}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
    </section>
  );
};
