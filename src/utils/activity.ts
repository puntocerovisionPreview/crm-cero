import { addDays, parseLocalDate, startOfWeekMonday } from './dates';
import type { AgendaMeeting, AgendaTask, ProspectEvent } from '../types';
import type { RoutineLog } from './dailyRoutineCore';

/**
 * CONSTANCIA (mapa estilo GitHub)
 * Cuenta por día lo que hiciste: tareas terminadas, reuniones hechas, contactos de prospección
 * y pasos de la rutina. Funciones puras para poder probarlas.
 */

export type ActivityKind = 'todo' | 'tareas' | 'prospeccion' | 'rutina';

export interface DayActivity {
  tareas: number;
  reuniones: number;
  prospeccion: number;
  rutina: number;
}

// Acciones tuyas en prospección (la respuesta del prospecto no cuenta como algo que hiciste vos)
const PROSPECT_ACTIONS = new Set(['first_contact', 'follow_up', 'proposal_sent', 'audit_sent', 'video_sent', 'call', 'won']);

const empty = (): DayActivity => ({ tareas: 0, reuniones: 0, prospeccion: 0, rutina: 0 });

export function buildActivity(input: {
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  prospectEvents?: ProspectEvent[];
  routineLogs?: Record<string, RoutineLog>;
}): Map<string, DayActivity> {
  const days = new Map<string, DayActivity>();
  const at = (date: string) => {
    if (!days.has(date)) days.set(date, empty());
    return days.get(date)!;
  };
  const valid = (d?: string | null) => Boolean(d && /^\d{4}-\d{2}-\d{2}/.test(d));

  input.tasks.forEach((t) => {
    if (!t.completed) return;
    // El día en que la terminaste; las tareas viejas (sin ese dato) cuentan en su día planificado
    const day = valid(t.completedAt) ? t.completedAt!.slice(0, 10) : t.date;
    if (valid(day)) at(day.slice(0, 10)).tareas++;
  });
  input.meetings.forEach((m) => {
    if (m.completed && valid(m.date)) at(m.date.slice(0, 10)).reuniones++;
  });
  (input.prospectEvents || []).forEach((e) => {
    if (PROSPECT_ACTIONS.has(e.type) && valid(e.date)) at(e.date.slice(0, 10)).prospeccion++;
  });
  Object.values(input.routineLogs || {}).forEach((log) => {
    const n = Object.keys(log.done || {}).length;
    if (n && valid(log.date)) at(log.date.slice(0, 10)).rutina += n;
  });
  return days;
}

export function countFor(day: DayActivity | undefined, kind: ActivityKind): number {
  if (!day) return 0;
  if (kind === 'tareas') return day.tareas + day.reuniones;
  if (kind === 'prospeccion') return day.prospeccion;
  if (kind === 'rutina') return day.rutina;
  return day.tareas + day.reuniones + day.prospeccion + day.rutina;
}

/** Racha actual (cuenta hasta hoy, o hasta ayer si hoy todavía no hiciste nada), mejor racha y días activos */
export function computeStats(days: Map<string, DayActivity>, kind: ActivityKind, today: string, rangeDays = 365) {
  const active = (d: string) => countFor(days.get(d), kind) > 0;

  let current = 0;
  let cursor = active(today) ? today : addDays(today, -1);
  while (active(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  let run = 0;
  let activeDays = 0;
  let total = 0;
  const start = addDays(today, -(rangeDays - 1));
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const n = countFor(days.get(d), kind);
    total += n;
    if (n > 0) {
      activeDays++;
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return { current, best: Math.max(best, current), activeDays, total };
}

/** Semanas (lunes a domingo) que cubren el último año, para dibujar la grilla */
export function buildWeeks(today: string, weeks = 53): string[][] {
  const lastMonday = startOfWeekMonday(today);
  const firstMonday = addDays(lastMonday, -7 * (weeks - 1));
  const out: string[][] = [];
  for (let w = 0; w < weeks; w++) {
    const monday = addDays(firstMonday, w * 7);
    out.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
  }
  return out;
}

/** Nivel de color 0-4 relativo al día más activo del período (como GitHub) */
export function levelFor(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as 1 | 2 | 3 | 4;
}

export const monthShort = (date: string) =>
  parseLocalDate(date).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
