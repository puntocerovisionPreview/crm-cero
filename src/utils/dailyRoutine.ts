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
import { deepSanitize } from './sanitize';

/**
 * Rutina diaria: hábitos que se repiten (revisar mails, cobrar, publicar contenido...)
 * y se muestran primero en "Hoy". Cada día arranca sin tildar.
 *
 * - daily_routine/{id}: los hábitos que define el usuario
 * - daily_routine_log/{YYYY-MM-DD}: qué se tildó ese día ({ done: { [id]: ISO } })
 */

export * from './dailyRoutineCore';
import { RoutineItem, RoutineLog } from './dailyRoutineCore';

const ITEMS = 'daily_routine';
const LOGS = 'daily_routine_log';

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

