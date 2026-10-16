import React from 'react';
import { ArrowDownWideNarrow } from 'lucide-react';
import { TASK_SORT_LABELS, TaskSortMode } from '../utils/taskSort';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  value: TaskSortMode;
  onChange: (mode: TaskSortMode) => void;
  className?: string;
}

// Selector de orden de tareas: Manual (arrastrar), Prioridad (alta primero) u Hora
export const TaskSortControl: React.FC<Props> = ({ value, onChange, className = '' }) => (
  <div className={`flex items-center gap-1.5 ${className}`} role="group" aria-label="Ordenar tareas">
    <ArrowDownWideNarrow className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" aria-hidden />
    <div className="flex items-center bg-[var(--bg-app)] p-0.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)]">
      {(Object.keys(TASK_SORT_LABELS) as TaskSortMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            onChange(mode);
          }}
          aria-pressed={value === mode}
          title={
            mode === 'manual'
              ? 'Orden propio (arrastrando)'
              : mode === 'prioridad'
              ? 'Alta primero, después media y baja'
              : 'Por horario; sin hora al final'
          }
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
            value === mode
              ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {TASK_SORT_LABELS[mode]}
        </button>
      ))}
    </div>
  </div>
);
