import { AgendaTask, TaskPriority } from '../types';

export type TaskSortMode = 'manual' | 'prioridad' | 'hora';

export const TASK_SORT_LABELS: Record<TaskSortMode, string> = {
  manual: 'Manual',
  prioridad: 'Prioridad',
  hora: 'Hora',
};

const PRIORITY_RANK: Record<TaskPriority, number> = { alta: 0, media: 1, baja: 2 };
const STORAGE_KEY = 'cero_task_sort_mode';

function priorityRank(t: AgendaTask): number {
  return t.priority ? PRIORITY_RANK[t.priority] : PRIORITY_RANK.media;
}

// Sin hora va al final del día
function timeKey(t: AgendaTask): string {
  return t.time && t.time.includes(':') ? t.time : '99:99';
}

function manualCompare(a: AgendaTask, b: AgendaTask): number {
  const hasA = typeof a.orderIndex === 'number';
  const hasB = typeof b.orderIndex === 'number';
  if (hasA && hasB) return (a.orderIndex as number) - (b.orderIndex as number);
  if (hasA) return -1;
  if (hasB) return 1;
  return (b.createdAt || '').localeCompare(a.createdAt || '');
}

/**
 * Ordena las tareas para todas las vistas de la agenda.
 * Siempre: pendientes antes que completadas, y agrupadas por fecha
 * (las vistas muestran un día por columna o lista). Dentro de cada día, según el modo.
 */
export function sortTasks(tasks: AgendaTask[], mode: TaskSortMode): AgendaTask[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
    if (mode === 'prioridad') {
      const p = priorityRank(a) - priorityRank(b);
      if (p !== 0) return p;
      const t = timeKey(a).localeCompare(timeKey(b));
      if (t !== 0) return t;
    } else if (mode === 'hora') {
      const t = timeKey(a).localeCompare(timeKey(b));
      if (t !== 0) return t;
      const p = priorityRank(a) - priorityRank(b);
      if (p !== 0) return p;
    }
    return manualCompare(a, b);
  });
}

export function getStoredTaskSortMode(): TaskSortMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'prioridad' || v === 'hora' || v === 'manual') return v;
  } catch {}
  return 'manual';
}

export function storeTaskSortMode(mode: TaskSortMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
}
