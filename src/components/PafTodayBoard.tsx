import React from 'react';
import { BellRing, ChevronRight } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { PRESENCIA_HITOS, pafTodayRows } from '../portal/model';
import { isActivePafStudent } from '../panels/paf';

/**
 * Inicio: "PAF hoy". Una fila por estudio activo con lo que importa para el día:
 * tareas para revisar, próxima reunión, etapa y días sin novedades.
 * Lo urgente (para revisar) queda arriba; después, el estudio más quieto.
 */
export const PafTodayBoard: React.FC<{ projects: Project[]; meetings: AgendaMeeting[]; onOpen: (path: string) => void }> = ({ projects, meetings, onOpen }) => {
  const today = new Date().toLocaleDateString('en-CA');
  const rows = pafTodayRows(projects.filter(isActivePafStudent), meetings, today);
  if (!rows.length) return null;
  const review = rows.reduce((n, r) => n + r.paraRevisar, 0);

  return (
    <section className="card-swiss p-5" aria-label="PAF hoy">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">PAF hoy</h2>
        <p className="text-[13px] text-[var(--text-secondary)]">
          {review ? <span className="inline-flex items-center gap-1"><BellRing className="w-3.5 h-3.5 text-amber-500" />{review} para revisar</span> : `${rows.length} ${rows.length === 1 ? 'estudio' : 'estudios'} en curso`}
        </p>
      </div>
      <ul className="mt-3 divide-y divide-[var(--border-divider)]">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onOpen(`/clientes/${r.id}`)} className="w-full flex items-center gap-3 py-3 text-left cursor-pointer group">
              <span className="flex-1 min-w-0">
                <span className="block truncate text-[14px] font-medium text-[var(--text-primary)]">{r.estudio}</span>
                <span className="block truncate text-[12px] text-[var(--text-tertiary)]">
                  {r.etapa ? `Etapa ${r.etapa} · ${PRESENCIA_HITOS[r.etapa - 1]}` : 'Sin portal'}
                  {' · '}
                  {r.proximaReunion ? `Reunión ${r.proximaReunion.fecha.slice(8, 10)}/${r.proximaReunion.fecha.slice(5, 7)}${r.proximaReunion.hora ? ` ${r.proximaReunion.hora}` : ''}` : 'Sin reunión agendada'}
                </span>
              </span>
              <span className="shrink-0 text-right">
                {r.paraRevisar > 0 && <span className="block rounded-full bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] px-2 py-0.5 text-[11px] font-semibold tabular-nums">{r.paraRevisar} para revisar</span>}
                <span className={`block text-[12px] tabular-nums ${r.diasSinNovedades !== null && r.diasSinNovedades >= 7 ? 'text-amber-500' : 'text-[var(--text-tertiary)]'}`}>
                  {r.diasSinNovedades === null ? 'Sin novedades' : r.diasSinNovedades === 0 ? 'Novedades hoy' : `${r.diasSinNovedades} d sin novedades`}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
