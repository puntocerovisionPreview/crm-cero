import { collection, doc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { deepSanitize } from './sanitize';

/**
 * BITÁCORA DEL DÍA (cierre del día)
 * Una línea por día con cómo te fue, más los números del día. Colección: journal/{YYYY-MM-DD}
 */

export interface JournalEntry {
  date: string;
  text: string;
  tareasHechas?: number;
  movidasAManana?: number;
  updatedAt?: string;
}

export function subscribeJournal(onChanged: (entries: Record<string, JournalEntry>) => void, maxDays = 60) {
  return onSnapshot(
    query(collection(db, 'journal'), orderBy('date', 'desc'), limit(maxDays)),
    (snap) => {
      const out: Record<string, JournalEntry> = {};
      snap.forEach((d) => (out[d.id] = { ...(d.data() as JournalEntry), date: (d.data() as JournalEntry).date || d.id }));
      onChanged(out);
    },
    (err) => console.warn('subscribeJournal error:', err)
  );
}

export async function saveJournalEntry(entry: JournalEntry): Promise<void> {
  await setDoc(doc(db, 'journal', entry.date), deepSanitize({ ...entry, updatedAt: new Date().toISOString() }), { merge: true });
}
