import { addDays, parseLocalDate, formatLocalISO } from './dates';
import type { TaskRecurrence, TaskRecurrencePreset } from '../types';

/**
 * TAREAS QUE SE REPITEN
 * Al terminar una tarea que se repite, se crea sola la próxima (como en Todoist).
 * No necesita el reloj automático: pasa en el momento en que la tildás.
 */

export const RECURRENCE_OPTIONS: { value: TaskRecurrencePreset; label: string; short: string }[] = [
  { value: 'diaria', label: 'Todos los días', short: 'Diaria' },
  { value: 'habiles', label: 'Días hábiles (lunes a viernes)', short: 'Días hábiles' },
  { value: 'semanal', label: 'Cada semana', short: 'Semanal' },
  { value: 'quincenal', label: 'Cada 2 semanas', short: 'Quincenal' },
  { value: 'mensual', label: 'Cada mes (mismo día)', short: 'Mensual' },
];

export function makeRecurrence(preset: TaskRecurrencePreset | '' | undefined, fromDate: string): TaskRecurrence | null {
  if (!preset) return null;
  return preset === 'mensual' ? { preset, monthDay: parseLocalDate(fromDate).getDate() } : { preset };
}

export function describeRecurrence(rec?: TaskRecurrence | null): string {
  if (!rec) return '';
  return RECURRENCE_OPTIONS.find((o) => o.value === rec.preset)?.short || '';
}

function nextMonthly(date: string, monthDay: number): string {
  const d = parseLocalDate(date);
  const year = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
  const month = (d.getMonth() + 1) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  // El día 31 cae en el último día de los meses más cortos, sin correrse para siempre
  return formatLocalISO(new Date(year, month, Math.min(monthDay, lastDay)));
}

function step(rec: TaskRecurrence, date: string): string {
  switch (rec.preset) {
    case 'diaria':
      return addDays(date, 1);
    case 'habiles': {
      let next = addDays(date, 1);
      while ([0, 6].includes(parseLocalDate(next).getDay())) next = addDays(next, 1);
      return next;
    }
    case 'semanal':
      return addDays(date, 7);
    case 'quincenal':
      return addDays(date, 14);
    case 'mensual':
      return nextMonthly(date, rec.monthDay || parseLocalDate(date).getDate());
    default:
      return addDays(date, 1);
  }
}

/**
 * Próxima fecha después de `date`. Si la tarea estaba atrasada, salta hasta hoy o después
 * (no se crea una tarea ya vencida).
 */
export function nextOccurrence(rec: TaskRecurrence, date: string, today: string): string {
  let next = step(rec, date);
  let guard = 0;
  while (next < today && guard++ < 400) next = step(rec, next);
  return next;
}
