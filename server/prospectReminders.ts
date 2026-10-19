import type { Firestore } from 'firebase-admin/firestore';
import { addDays, todayLocal } from '../src/utils/dates';

/**
 * LA NOCHE ANTERIOR: "Mañana tenés estas llamadas".
 * Corre dentro de la tarea frecuente, una vez por día, desde las 20 hs.
 * Toma las reuniones de mañana de la Agenda (las de prospección, las de Calendly y el resto).
 */
export async function eveningCallsReminder(db: Firestore, notify: (title: string, body: string) => Promise<void>, now: Date = new Date()): Promise<string> {
  const hour = Number(new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Cordoba', hour: '2-digit', hour12: false }).format(now)) % 24;
  if (hour < 20) return 'todavía no son las 20';
  const today = todayLocal();
  const ref = db.collection('settings').doc('system_health');
  const h = ((await ref.get()).data() as any) || {};
  if (h.callsEveDay === today) return 'ya avisado hoy';
  const tomorrow = addDays(today, 1);
  const snap = await db.collection('meetings').where('date', '==', tomorrow).get();
  const meetings = snap.docs
    .map((d) => d.data() as any)
    .filter((m) => !m.completed)
    .sort((a, b) => String(a.time || '99').localeCompare(String(b.time || '99')));
  await ref.set({ callsEveDay: today }, { merge: true });
  if (!meetings.length) return 'mañana no hay reuniones';
  const lines = meetings.slice(0, 6).map((m) => `${m.time || 'sin hora'} · ${m.title}`);
  const calls = meetings.filter((m) => String(m.id || '').startsWith('call_') || String(m.id || '').startsWith('calendly_')).length;
  await notify(
    `📅 Mañana: ${meetings.length} ${meetings.length === 1 ? 'reunión' : 'reuniones'}${calls ? ` (${calls} de prospección)` : ''}`,
    lines.join('\n') + (meetings.some((m) => !m.time) ? '\nHay alguna sin hora: ponésela en la app.' : '')
  );
  return `${meetings.length} avisadas`;
}
