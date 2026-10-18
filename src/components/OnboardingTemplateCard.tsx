import React, { useState } from 'react';
import { ListChecks, X } from 'lucide-react';
import { AgendaTask, Project } from '../types';
import { ONBOARDING_TEMPLATES, TemplateKey, buildOnboardingTasks, templateFor } from '../utils/onboardingTemplates';
import { getTodayString } from '../utils/storage';
import { addDays } from '../utils/dates';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  project: Project;
  onAddTask: (task: Omit<AgendaTask, 'id' | 'createdAt'>) => void;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
}

// Cliente nuevo sin tareas: ofrece crear las tareas de arranque con sus fechas
export const OnboardingTemplateCard: React.FC<Props> = ({ project, onAddTask, onUpdateProject }) => {
  const [key, setKey] = useState<TemplateKey>(templateFor(project));
  const [open, setOpen] = useState(false);
  const template = ONBOARDING_TEMPLATES[key];

  // Solo para clientes nuevos (último mes): a los de antes no se les ofrece
  const created = String(project.createdAt || '').slice(0, 10);
  if (!created || created < addDays(getTodayString(), -30)) return null;

  const apply = () => {
    hapticFeedback.success();
    buildOnboardingTasks(project, key, getTodayString()).forEach(onAddTask);
    onUpdateProject(project.id, { onboardingApplied: true });
  };

  return (
    <section className="card-swiss p-4 space-y-3" aria-labelledby="arranque-title">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-[10px] bg-[#FF9500] text-white flex items-center justify-center shrink-0" aria-hidden>
          <ListChecks className="w-[18px] h-[18px]" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 id="arranque-title" className="text-[16px] font-semibold text-[var(--text-primary)]">Arrancá con las tareas listas</h3>
          <p className="text-[13px] text-[var(--text-secondary)]">
            {template.steps.length} tareas de {template.label.toLowerCase()} con sus fechas, desde hoy.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onUpdateProject(project.id, { onboardingApplied: true })}
          aria-label="No usar plantilla"
          title="No usar plantilla"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-muted)] cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Plantilla" className="flex p-[3px] rounded-[10px] bg-[var(--bg-surface-muted)]/70">
          {(Object.keys(ONBOARDING_TEMPLATES) as TemplateKey[]).map(k => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={key === k}
              onClick={() => setKey(k)}
              className={`px-3 h-7 rounded-[8px] text-[13px] cursor-pointer ${
                key === k ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-[var(--text-secondary)] font-medium'
              }`}
            >
              {ONBOARDING_TEMPLATES[k].label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setOpen(v => !v)} className="text-[13px] text-[var(--accent)] font-medium cursor-pointer">
          {open ? 'Ocultar' : 'Ver las tareas'}
        </button>
        <button type="button" onClick={apply} className="ml-auto h-9 px-4 rounded-full bg-[var(--accent)] text-white text-[14px] font-semibold cursor-pointer t-press">
          Crear tareas
        </button>
      </div>

      {open && (
        <ol className="rounded-[12px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)]">
          {template.steps.map(s => (
            <li key={s.title} className="px-3 py-2 flex items-center gap-3 text-[14px]">
              <span className="w-14 shrink-0 text-[12px] text-[var(--text-tertiary)] tabular-nums">{s.day === 0 ? 'Hoy' : `Día ${s.day}`}</span>
              <span className="text-[var(--text-primary)]">{s.title}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
