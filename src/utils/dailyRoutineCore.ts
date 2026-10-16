import { addDays, parseLocalDate } from './dates';

// Lógica pura de la rutina diaria (sin Firebase): la usan la app y el servidor.

export interface RoutineItem {
  id: string;
  title: string;
  order: number;
  // Días de la semana en que aplica (0 = domingo ... 6 = sábado). Vacío o ausente = todos.
  weekdays?: number[];
  createdAt: string;
}

export interface RoutineLog {
  date: string;
  done: Record<string, string>;
}

export const WEEKDAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function appliesOn(item: RoutineItem, dateStr: string): boolean {
  if (!item.weekdays || item.weekdays.length === 0 || item.weekdays.length === 7) return true;
  return item.weekdays.includes(parseLocalDate(dateStr).getDay());
}

export function isDayComplete(items: RoutineItem[], log: RoutineLog | undefined, dateStr: string): boolean {
  const due = items.filter((i) => appliesOn(i, dateStr));
  return due.length > 0 && due.every((i) => Boolean(log?.done?.[i.id]));
}

/**
 * Días seguidos con la rutina completa. Hoy cuenta si ya está completa; si todavía
 * no, la racha se mide hasta ayer (no se corta antes de que termine el día).
 * Los días sin hábitos programados no cortan la racha.
 */
export function computeStreak(items: RoutineItem[], logs: Record<string, RoutineLog>, today: string): number {
  if (items.length === 0) return 0;
  let streak = 0;
  let day = isDayComplete(items, logs[today], today) ? today : addDays(today, -1);
  for (let i = 0; i < 60; i++) {
    const due = items.filter((it) => appliesOn(it, day) && (it.createdAt || '').slice(0, 10) <= day);
    if (due.length > 0) {
      if (!due.every((it) => Boolean(logs[day]?.done?.[it.id]))) break;
      streak++;
    }
    day = addDays(day, -1);
  }
  return streak;
}
