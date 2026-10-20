import type { Firestore } from 'firebase-admin/firestore';
import { addDays, todayLocal } from '../src/utils/dates';
import { ContentPiece } from '../src/content/model';
import { contentEveningNotice, contentMorningNotice } from '../src/content/reminders';

/**
 * AVISOS DE CONTENIDO (corren dentro de la tarea frecuente, una vez por día cada uno)
 * - Desde las 8: "Hoy se publica…"
 * - Desde las 18: "Mañana toca…"
 */

const MORNING_HOUR = 8;
const EVENING_HOUR = 18;

function localHour(now: Date): number {
  return Number(new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Cordoba', hour: '2-digit', hour12: false }).format(now)) % 24;
}

export async function contentReminders(db: Firestore, notify: (title: string, body: string) => Promise<void>, now: Date = new Date()): Promise<string> {
  const hour = localHour(now);
  if (hour < MORNING_HOUR) return 'todavía no son las 8';
  const today = todayLocal();
  const ref = db.collection('settings').doc('system_health');
  const h = ((await ref.get()).data() as any) || {};
  const doMorning = h.contentMorningDay !== today;
  const doEvening = hour >= EVENING_HOUR && h.contentEveDay !== today;
  if (!doMorning && !doEvening) return 'ya avisado';

  // Solo las piezas de la última semana a mañana (no hace falta leer todo el calendario)
  const snap = await db
    .collection('content_pieces')
    .where('date', '>=', addDays(today, -7))
    .where('date', '<=', addDays(today, 1))
    .get();
  const pieces = snap.docs.map((d) => ({ slides: [], resources: [], ...(d.data() as ContentPiece), id: d.id }));
  const done: string[] = [];

  if (doMorning) {
    // Si el reloj recién corre a la tarde, igual sale el de la mañana (antes que el de mañana)
    const n = contentMorningNotice(pieces, today);
    if (n) await notify(n.title, n.body);
    await ref.set({ contentMorningDay: today }, { merge: true });
    done.push(n ? 'hoy: avisado' : 'hoy: nada');
  }
  if (doEvening) {
    const n = contentEveningNotice(pieces, today);
    if (n) await notify(n.title, n.body);
    await ref.set({ contentEveDay: today }, { merge: true });
    done.push(n ? 'mañana: avisado' : 'mañana: nada');
  }
  return done.join(' · ');
}
