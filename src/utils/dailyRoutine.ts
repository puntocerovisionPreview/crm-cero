import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  deleteField,
} from 'firebase/firestore';
import { db } from '../firebase';
import { deepSanitize } from './firestoreService';
import { addDays, parseLocalDate } from './dates';

/**
 * Rutina diaria: hábitos que se repiten (revisar mails, cobrar, publicar contenido...)
 * y se muestran primero en "Hoy". Cada día arranca sin tildar.
 *
 * - daily_routine/{id}: los hábitos que define el usuario
 * - daily_routine_log/{YYYY-MM-DD}: qué se tildó ese día ({ done: { [id]: ISO } })
 */

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

const ITEMS = 'daily_routine';
const LOGS = 'daily_routine_log';

export const WEEKDAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function appliesOn(item: RoutineItem, dateStr: string): boolean {
  if (!item.weekdays || item.weekdays.length === 0 || item.weekdays.length === 7) return true;
  return item.weekdays.includes(parseLocalDate(dateStr).getDay());
}

export function subscribeRoutineItems(onChanged: (items: RoutineItem[]) => void) {
  return onSnapshot(
    collection(db, ITEMS),
    (snap) => {
      const items = snap.docs.map((d) => ({ ...(d.data() as RoutineItem), id: d.id }));
      items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      onChanged(items);
    },
    (err) => console.warn('subscribeRoutineItems error:', err)
  );
}

// Últimos 60 días de registro: alcanza para la racha y el día de hoy
export function subscribeRoutineLogs(onChanged: (logs: Record<string, RoutineLog>) => void) {
  return onSnapshot(
    query(collection(db, LOGS), orderBy('date', 'desc'), limit(60)),
    (snap) => {
      const logs: Record<string, RoutineLog> = {};
      snap.forEach((d) => {
        const data = d.data() as RoutineLog;
        logs[d.id] = { date: data.date || d.id, done: data.done || {} };
      });
      onChanged(logs);
    },
    (err) => console.warn('subscribeRoutineLogs error:', err)
  );
}

export async function saveRoutineItem(item: RoutineItem): Promise<void> {
  await setDoc(doc(db, ITEMS, item.id), deepSanitize(item), { merge: true });
}

export async function deleteRoutineItem(id: string): Promise<void> {
  await deleteDoc(doc(db, ITEMS, id));
}

export async function setRoutineDone(dateStr: string, itemId: string, done: boolean): Promise<void> {
  await setDoc(
    doc(db, LOGS, dateStr),
    { date: dateStr, done: { [itemId]: done ? new Date().toISOString() : deleteField() } },
    { merge: true }
  );
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
