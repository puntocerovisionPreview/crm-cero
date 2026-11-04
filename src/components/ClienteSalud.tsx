import React from 'react';
import { Activity, AlertTriangle, Eye } from 'lucide-react';
import type { NivelSalud, SaludCliente } from '../portal/salud';

export const SALUD_DOT: Record<NivelSalud, string> = { riesgo: 'bg-rose-500', atencion: 'bg-amber-500', ok: 'bg-emerald-500' };
export const SALUD_LABEL: Record<NivelSalud, string> = { riesgo: 'Necesita atención ya', atencion: 'Para mirar', ok: 'Todo en orden' };

/**
 * Cómo está el cliente, en la ficha: los motivos concretos (y si entra a su portal).
 * Si está todo en orden, una sola línea.
 */
export const ClienteSaludCard: React.FC<{ salud: SaludCliente; visita: string | null }> = ({ salud, visita }) => {
  if (salud.nivel === 'ok') {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${SALUD_DOT.ok}`} aria-hidden />Todo en orden con este cliente</span>
        {visita && <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{visita}</span>}
      </p>
    );
  }
  const riesgo = salud.nivel === 'riesgo';
  return (
    <section className={`rounded-2xl border p-4 ${riesgo ? 'border-rose-500/40 bg-rose-500/[0.05]' : 'border-amber-400/30 bg-amber-400/[0.04]'}`} aria-label="Cómo está el cliente">
      <div className="flex items-start gap-3">
        {riesgo ? <AlertTriangle className="mt-0.5 w-4 h-4 shrink-0 text-rose-300" /> : <Activity className="mt-0.5 w-4 h-4 shrink-0 text-amber-300" />}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-zinc-500">{SALUD_LABEL[salud.nivel]}</p>
          <ul className="mt-1 space-y-1">
            {salud.motivos.map((m) => (
              <li key={m.texto} className="flex items-start gap-2 text-xs text-zinc-200">
                <span className={`mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full ${SALUD_DOT[m.nivel]}`} aria-hidden />{m.texto}
              </li>
            ))}
          </ul>
          {visita && <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-zinc-500"><Eye className="w-3 h-3" />{visita}</p>}
        </div>
      </div>
    </section>
  );
};
