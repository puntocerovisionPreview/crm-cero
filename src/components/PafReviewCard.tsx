import React from 'react';
import { BellRing, ChevronRight } from 'lucide-react';
import { Project } from '../types';
import { pafToReview } from '../portal/model';

/**
 * Inicio: estudios PAF que tocaron "Terminé" y esperan tu aprobación.
 * Solo aparece si hay algo para revisar.
 */
export const PafReviewCard: React.FC<{ projects: Project[]; onOpen: (path: string) => void }> = ({ projects, onOpen }) => {
  const items = pafToReview(projects);
  if (!items.length) return null;
  const total = items.reduce((n, x) => n + x.count, 0);
  return (
    <section className="card-swiss p-5" aria-label="PAF para revisar">
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] flex items-center justify-center"><BellRing className="w-4 h-4 text-amber-500" /></span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">PAF para revisar</h2>
          <p className="text-[13px] text-[var(--text-secondary)]">{total === 1 ? 'Un estudio avisó que terminó una tarea' : `${total} tareas terminadas esperan tu aprobación`}</p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-[var(--border-divider)]">
        {items.map(({ project, count }) => (
          <li key={project.id}>
            <button type="button" onClick={() => onOpen(`/clientes/${project.id}`)} className="w-full flex items-center gap-3 py-2.5 text-left cursor-pointer group">
              <span className="flex-1 min-w-0 truncate text-[14px] text-[var(--text-primary)]">{project.clientName}</span>
              <span className="shrink-0 rounded-full bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] px-2 py-0.5 text-[11px] font-semibold tabular-nums">{count}</span>
              <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
