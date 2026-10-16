import { JWT } from 'google-auth-library';
import type { Firestore } from 'firebase-admin/firestore';
import { addDays, formatLocalISO, todayLocal } from '../src/utils/dates';

/**
 * SINCRONIZACIÓN CON GOOGLE CALENDAR (en los dos sentidos)
 *
 * Usa la misma cuenta de servicio que el motor. Requisito: compartir tu calendario
 * (GOOGLE_CALENDAR_ID = tu Gmail) con el correo de la cuenta de servicio, con permiso
 * "Hacer cambios en los eventos".
 *
 * - CRM → Google: cada reunión crea o actualiza su evento (queda marcado con ceroMeetingId).
 *   Si borrás la reunión en el CRM, se borra su evento.
 * - Google → CRM: eventos con hora creados en Google (incluidas reservas de turnos) entran
 *   como reuniones; si movés en Google una reunión del CRM, se actualiza en el CRM.
 *   Nunca se borran reuniones del CRM desde Google (más seguro).
 * - Ventana: desde ayer hasta 60 días adelante. Los eventos de día completo se ignoran.
 */

const TZ = 'America/Argentina/Cordoba';
const API = 'https://www.googleapis.com/calendar/v3';

export function isCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CALENDAR_ID && process.env.FIREBASE_SERVICE_ACCOUNT);
}

function getCredentials(): { client_email: string; private_key: string } {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(text);
}

let jwt: JWT | null = null;
async function authHeaders(): Promise<Record<string, string>> {
  if (!jwt) {
    const c = getCredentials();
    jwt = new JWT({ email: c.client_email, key: c.private_key, scopes: ['https://www.googleapis.com/auth/calendar.events'] });
  }
  const { token } = await jwt.getAccessToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function gcal(path: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`${API}${path}`, { ...init, headers: { ...(await authHeaders()), ...(init.headers || {}) } });
  if (r.status === 204) return null;
  const body = await r.text();
  if (!r.ok) throw new Error(`Google Calendar ${r.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null;
}

interface MeetingDoc {
  id: string;
  title: string;
  date: string;
  time?: string;
  durationHours?: number;
  notes?: string;
  projectName?: string;
  completed?: boolean;
  googleEventId?: string;
  googleSyncHash?: string;
}

export function meetingHash(m: { title: string; date: string; time?: string; durationHours?: number }): string {
  return [m.title || '', m.date || '', m.time || '', m.durationHours || 1].join('|');
}

function addMinutesToTime(date: string, time: string, minutes: number): { date: string; time: string } {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setMinutes(h * 60 + m + minutes);
  return { date: formatLocalISO(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
}

export function meetingToEvent(m: MeetingDoc): any {
  const description = [m.projectName ? `Cliente: ${m.projectName}` : '', m.notes || '', 'Creado desde .Cero CRM']
    .filter(Boolean)
    .join('\n\n');
  const base = {
    summary: m.title,
    description,
    extendedProperties: { private: { ceroMeetingId: m.id } },
  };
  if (!m.time) {
    return { ...base, start: { date: m.date }, end: { date: addDays(m.date, 1) } };
  }
  const end = addMinutesToTime(m.date, m.time, Math.round((m.durationHours || 1) * 60));
  return {
    ...base,
    start: { dateTime: `${m.date}T${m.time}:00`, timeZone: TZ },
    end: { dateTime: `${end.date}T${end.time}:00`, timeZone: TZ },
  };
}

// Evento de Google → fecha/hora local (el servidor corre con zona horaria de Argentina)
export function eventToLocal(ev: any): { date: string; time: string; durationHours: number } | null {
  if (!ev?.start?.dateTime) return null; // día completo: se ignora
  const start = new Date(ev.start.dateTime);
  const end = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(start.getTime() + 3600000);
  return {
    date: formatLocalISO(start),
    time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    durationHours: Math.max(0.25, Math.round(((end.getTime() - start.getTime()) / 3600000) * 4) / 4),
  };
}

export async function runCalendarSync(db: Firestore, opts: { dryRun?: boolean } = {}) {
  const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || '');
  const today = todayLocal();
  const from = addDays(today, -1);
  const to = addDays(today, 60);
  const stats = { createdInGoogle: 0, updatedInGoogle: 0, deletedInGoogle: 0, createdInCrm: 0, updatedInCrm: 0 };

  const meetingsSnap = await db.collection('meetings').get();
  const meetings = new Map<string, MeetingDoc>();
  meetingsSnap.forEach((d) => meetings.set(d.id, { ...(d.data() as any), id: d.id }));
  const byEventId = new Map<string, MeetingDoc>();
  meetings.forEach((m) => m.googleEventId && byEventId.set(m.googleEventId, m));

  // 1) Google → CRM
  const events: any[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({
      timeMin: new Date(`${from}T00:00:00`).toISOString(),
      timeMax: new Date(`${to}T23:59:59`).toISOString(),
      singleEvents: 'true',
      showDeleted: 'true',
      maxResults: '250',
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await gcal(`/calendars/${calendarId}/events?${q}`);
    events.push(...(page?.items || []));
    pageToken = page?.nextPageToken;
  } while (pageToken);

  const seenCeroIds = new Set<string>();
  for (const ev of events) {
    const ceroId = ev.extendedProperties?.private?.ceroMeetingId;
    if (ceroId) seenCeroIds.add(ceroId);
    if (ev.status === 'cancelled') continue;
    const local = eventToLocal(ev);
    if (!local) continue;
    const linked = (ceroId && meetings.get(ceroId)) || byEventId.get(ev.id);

    if (linked) {
      const remote = { title: ev.summary || linked.title, ...local };
      const remoteHash = meetingHash(remote);
      // Cambió en Google y no es el reflejo de nuestro propio último envío
      if (remoteHash !== linked.googleSyncHash && meetingHash(linked) === linked.googleSyncHash) {
        stats.updatedInCrm++;
        if (!opts.dryRun) {
          await db.collection('meetings').doc(linked.id).set(
            { title: remote.title, date: remote.date, time: remote.time, durationHours: remote.durationHours, googleSyncHash: remoteHash, reminderNotified: false, telegramReminded: false },
            { merge: true }
          );
        }
        linked.title = remote.title;
        linked.date = remote.date;
        linked.time = remote.time;
        linked.durationHours = remote.durationHours;
        linked.googleSyncHash = remoteHash;
      }
    } else if (!ceroId) {
      // Evento nuevo creado en Google (por ejemplo, un turno reservado)
      const id = `gcal_${ev.id}`.slice(0, 120);
      const meeting = {
        id,
        title: ev.summary || 'Reunión',
        date: local.date,
        time: local.time,
        durationHours: local.durationHours,
        notes: ev.description || '',
        completed: false,
        createdAt: today,
        googleEventId: ev.id,
        googleSyncHash: meetingHash({ title: ev.summary || 'Reunión', ...local }),
        reminderMinutesBefore: 15,
      };
      stats.createdInCrm++;
      if (!opts.dryRun) await db.collection('meetings').doc(id).set(meeting, { merge: true });
      meetings.set(id, meeting);
      byEventId.set(ev.id, meeting);
    }
  }

  // 2) CRM → Google
  for (const m of meetings.values()) {
    if (!m.date || m.date < from || m.date > to) continue;
    const hash = meetingHash(m);
    if (!m.googleEventId) {
      if (m.completed) continue;
      stats.createdInGoogle++;
      if (!opts.dryRun) {
        const created = await gcal(`/calendars/${calendarId}/events`, { method: 'POST', body: JSON.stringify(meetingToEvent(m)) });
        await db.collection('meetings').doc(m.id).set({ googleEventId: created.id, googleSyncHash: hash }, { merge: true });
      }
    } else if (hash !== m.googleSyncHash) {
      stats.updatedInGoogle++;
      if (!opts.dryRun) {
        await gcal(`/calendars/${calendarId}/events/${encodeURIComponent(m.googleEventId)}`, {
          method: 'PATCH',
          body: JSON.stringify(meetingToEvent(m)),
        });
        await db.collection('meetings').doc(m.id).set({ googleSyncHash: hash }, { merge: true });
      }
    }
  }

  // 3) Reuniones borradas en el CRM → borrar su evento (solo eventos creados por el CRM)
  for (const ev of events) {
    const ceroId = ev.extendedProperties?.private?.ceroMeetingId;
    if (!ceroId || ev.status === 'cancelled' || meetings.has(ceroId)) continue;
    stats.deletedInGoogle++;
    if (!opts.dryRun) await gcal(`/calendars/${calendarId}/events/${encodeURIComponent(ev.id)}`, { method: 'DELETE' });
  }

  return stats;
}
