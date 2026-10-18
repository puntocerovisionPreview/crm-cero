import express from 'express';
import crypto from 'crypto';
import { getAdminDb } from './automation';
import { applyAction, callMeetingFor, callMeetingId, normalizeInstagram, phoneKey } from '../src/prospecting/core';
import { todayLocal } from '../src/utils/dates';
import type { Prospect } from '../src/types';

/**
 * CONEXIÓN CON CALENDLY
 *
 * Cuando alguien reserva en tu Calendly, Calendly avisa a /api/calendly/webhook y la app:
 * 1) encuentra al prospecto (por su id en el link — utm_content —, email, teléfono o nombre);
 * 2) lo pasa a "Llamada" con día y hora;
 * 3) crea la reunión en tu Agenda (la misma que si la cargás a mano).
 * Si cancela, se borra la reunión y el prospecto vuelve a "Respondió" para que le escribas.
 *
 * Requisitos: plan de Calendly que incluya webhooks (Standard o superior) y la variable
 * CALENDLY_TOKEN (token personal de Calendly) en el servidor. Después, en la app:
 * Prospección → Mensajes → "Conectar Calendly" (crea la suscripción y su clave de firma).
 */

const API = 'https://api.calendly.com';
const SETTINGS_DOC = 'calendly';
const TZ = 'America/Argentina/Cordoba';

async function calendly(path: string, init: RequestInit = {}): Promise<any> {
  const token = process.env.CALENDLY_TOKEN;
  if (!token) throw new Error('Falta CALENDLY_TOKEN en el servidor');
  const r = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await r.text();
  const body = text ? JSON.parse(text) : null;
  if (!r.ok) {
    const err: any = new Error(`Calendly ${r.status}: ${body?.message || body?.title || text.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  return body;
}

function localDateTime(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}` };
}

/** Firma de Calendly: header "t=<timestamp>,v1=<hmac>" sobre "<t>.<cuerpo>". */
export function verifyCalendlySignature(header: string, rawBody: string, key: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  const parts = Object.fromEntries(
    String(header || '')
      .split(',')
      .map((kv) => kv.split('=').map((s) => s.trim()) as [string, string])
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1 || !key) return false;
  if (Math.abs(nowSec - Number(t)) > 5 * 60) return false;
  const expected = crypto.createHmac('sha256', key).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Busca al prospecto de la reserva. */
export function matchCalendlyInvitee(inv: any, prospects: Prospect[]): Prospect | undefined {
  const byId = inv?.tracking?.utm_content;
  if (byId) {
    const p = prospects.find((x) => x.id === byId);
    if (p) return p;
  }
  const email = String(inv?.email || '').trim().toLowerCase();
  if (email) {
    const p = prospects.find((x) => (x.email || '').trim().toLowerCase() === email);
    if (p) return p;
  }
  const answers: any[] = inv?.questions_and_answers || [];
  const phones = [inv?.text_reminder_number, ...answers.map((a) => a?.answer)].map((v) => phoneKey(String(v || ''))).filter((k) => k && k.length >= 7);
  for (const k of phones) {
    const p = prospects.find((x) => x.whatsapp && phoneKey(x.whatsapp) === k);
    if (p) return p;
  }
  const igs = answers.map((a) => normalizeInstagram(String(a?.answer || ''))).filter(Boolean);
  for (const ig of igs) {
    const p = prospects.find((x) => normalizeInstagram(x.instagram) === ig);
    if (p) return p;
  }
  const name = String(inv?.name || '').trim().toLowerCase();
  if (name.length >= 4) {
    const active = prospects.filter((x) => !['cliente', 'descartado'].includes(x.stage));
    const p = active.find((x) => [x.name, x.studio].some((n) => (n || '').trim().toLowerCase() === name));
    if (p) return p;
  }
  return undefined;
}

/** Guarda una reserva: reunión en la Agenda y, si es un prospecto, lo pasa a "Llamada". */
async function saveBooking(db: any, inv: any, ev: any, prospects: Prospect[], today: string, nowIso: string): Promise<boolean> {
  const { date, time } = localDateTime(ev.start_time);
  const minutes = ev.end_time ? Math.max(15, Math.round((Date.parse(ev.end_time) - Date.parse(ev.start_time)) / 60000)) : 30;
  const p = matchCalendlyInvitee(inv, prospects);
  const extra = [
    `Agendada por Calendly${ev.name ? ` (${ev.name})` : ''}.`,
    inv.email ? `Email: ${inv.email}` : '',
    ev.location?.join_url ? `Link: ${ev.location.join_url}` : '',
    ...(inv.questions_and_answers || []).map((qa: any) => `${qa.question}: ${qa.answer}`),
    inv.reschedule_url ? `Reprogramar: ${inv.reschedule_url}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const batch = db.batch();
  if (p) {
    const meeting = { ...callMeetingFor(p, date, time, minutes, today, { notes: extra }), calendlyEventUri: ev.uri || null };
    batch.set(db.collection('meetings').doc(meeting.id), { ...meeting, updatedAt: nowIso }, { merge: true });
    const { updates, event } = applyAction(p, 'call', today, undefined, `${date} ${time}`);
    const payload: Record<string, any> = { updatedAt: nowIso, calendlyEventUri: ev.uri || null, email: p.email || inv.email || null };
    Object.entries(updates).forEach(([k, v]) => (payload[k] = v === undefined ? null : v));
    batch.set(db.collection('prospects').doc(p.id), payload, { merge: true });
    if (event) {
      const evId = `pev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      batch.set(db.collection('prospect_events').doc(evId), { ...event, id: evId, createdAt: nowIso, note: 'Calendly' });
    }
  } else {
    // Alguien que no está en prospección: igual queda en tu agenda
    const uuid = String(ev.uri || '').split('/').pop() || Date.now().toString(36);
    const id = `calendly_${uuid}`.slice(0, 120);
    batch.set(
      db.collection('meetings').doc(id),
      {
        id,
        title: `Llamada: ${inv.name || 'Reserva de Calendly'}`,
        date,
        time,
        durationHours: Math.round((minutes / 60) * 100) / 100,
        completed: false,
        createdAt: today,
        reminderMinutesBefore: 15,
        reminderNotified: false,
        notes: extra,
        calendlyEventUri: ev.uri || null,
        updatedAt: nowIso,
      },
      { merge: true }
    );
  }
  await batch.commit();
  return !!p;
}

/**
 * Trae las reservas futuras que ya estaban agendadas (los avisos solo llegan para las nuevas).
 * No duplica: saltea las que ya están en la Agenda.
 */
export async function importUpcomingBookings(db: any): Promise<{ imported: number; matched: number; skipped: number }> {
  const me = (await calendly('/users/me')).resource;
  const events: any[] = [];
  let next: string | null = `/scheduled_events?user=${encodeURIComponent(me.uri)}&status=active&min_start_time=${encodeURIComponent(new Date().toISOString())}&count=100&sort=start_time:asc`;
  while (next && events.length < 300) {
    const page = await calendly(next);
    events.push(...(page?.collection || []));
    next = page?.pagination?.next_page || null;
  }
  const already = new Set<string>();
  (await db.collection('meetings').get()).docs.forEach((d: any) => d.data()?.calendlyEventUri && already.add(d.data().calendlyEventUri));
  const snap = await db.collection('prospects').get();
  const prospects = snap.docs.map((d: any) => ({ followUps: 0, ...(d.data() as Prospect), id: d.id }));
  const today = todayLocal();
  const nowIso = new Date().toISOString();
  let imported = 0;
  let matched = 0;
  let skipped = 0;
  for (const ev of events) {
    if (already.has(ev.uri)) {
      skipped++;
      continue;
    }
    const invitees = (await calendly(`${ev.uri}/invitees?status=active&count=10`))?.collection || [];
    if (await saveBooking(db, invitees[0] || {}, ev, prospects, today, nowIso)) matched++;
    imported++;
  }
  return { imported, matched, skipped };
}

/** Aviso de Calendly: va ANTES del lector JSON general (necesita el cuerpo crudo para la firma). */
export function registerCalendlyWebhook(app: express.Express) {
  // El aviso de Calendly: cuerpo crudo para poder verificar la firma (va antes del lector JSON)
  app.post('/api/calendly/webhook', express.text({ type: '*/*', limit: '256kb' }), async (req, res) => {
    const db = getAdminDb();
    if (!db) return res.status(503).json({ ok: false });
    try {
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      const cfg = (await db.collection('settings').doc(SETTINGS_DOC).get()).data() as any;
      const key = process.env.CALENDLY_WEBHOOK_SIGNING_KEY || cfg?.signingKey;
      if (!verifyCalendlySignature(String(req.headers['calendly-webhook-signature'] || ''), raw, key)) {
        return res.status(401).json({ ok: false });
      }
      const body = JSON.parse(raw);
      const inv = body?.payload || {};
      const ev = inv.scheduled_event || {};
      const today = todayLocal();
      const nowIso = new Date().toISOString();

      const snap = await db.collection('prospects').get();
      const prospects = snap.docs.map((d) => ({ followUps: 0, ...(d.data() as Prospect), id: d.id }));

      if (body.event === 'invitee.created') {
        if (!ev.start_time) return res.json({ ok: true, skipped: 'sin horario' });
        const matched = await saveBooking(db, inv, ev, prospects, today, nowIso);
        return res.json({ ok: true, matched });
      }

      if (body.event === 'invitee.canceled') {
        // Si reprograma, Calendly cancela y crea otra: la nueva reserva actualiza todo
        if (inv.rescheduled) return res.json({ ok: true, skipped: 'reprogramada' });
        const uri = ev.uri;
        const meetings = uri ? await db.collection('meetings').where('calendlyEventUri', '==', uri).get() : null;
        const batch = db.batch();
        meetings?.docs.forEach((d) => batch.delete(d.ref));
        const p = prospects.find((x) => uri && x.calendlyEventUri === uri) || matchCalendlyInvitee(inv, prospects);
        if (p && p.stage === 'llamada' && !p.proposalSentAt) {
          batch.set(
            db.collection('prospects').doc(p.id),
            {
              stage: 'respondio',
              convStep: null,
              callDate: null,
              callTime: null,
              calendlyEventUri: null,
              nextActionDate: today,
              notes: [p.notes, `Canceló la llamada por Calendly (${today})${inv.cancellation?.reason ? `: ${inv.cancellation.reason}` : ''}.`].filter(Boolean).join('\n'),
              updatedAt: nowIso,
            },
            { merge: true }
          );
          if (!meetings || meetings.empty) batch.delete(db.collection('meetings').doc(callMeetingId(p.id)));
        }
        await batch.commit();
        return res.json({ ok: true });
      }

      res.json({ ok: true, skipped: body.event });
    } catch (err) {
      console.error('[calendly] Error procesando el aviso:', (err as Error)?.message || err);
      res.status(500).json({ ok: false });
    }
  });

}

/** Estado y conexión (solo vos, con tu sesión). */
export function registerCalendlyRoutes(app: express.Express, requireOwner: express.RequestHandler) {
  app.post('/api/calendly/sync', requireOwner, async (_req, res) => {
    const db = getAdminDb();
    if (!db) return res.status(503).json({ error: 'El servidor no tiene acceso a la base.' });
    if (!process.env.CALENDLY_TOKEN) return res.status(400).json({ error: 'Falta CALENDLY_TOKEN en las variables del servidor (AI Studio → Secrets).' });
    try {
      res.json({ ok: true, ...(await importUpcomingBookings(db)) });
    } catch (err: any) {
      console.error('[calendly] Error trayendo reservas:', err?.message || err);
      res.status(500).json({ error: 'No se pudieron traer las reservas de Calendly.', details: String(err?.message || err).slice(0, 200) });
    }
  });

  app.get('/api/calendly/status', requireOwner, async (_req, res) => {
    const db = getAdminDb();
    const cfg = db ? ((await db.collection('settings').doc(SETTINGS_DOC).get()).data() as any) : null;
    const connected = !!(cfg?.webhookUri || cfg?.mode === 'sync' || cfg?.connectedAt);
    res.json({
      tokenConfigured: !!process.env.CALENDLY_TOKEN,
      connected,
      connectedAt: cfg?.connectedAt || null,
      schedulingUrl: cfg?.schedulingUrl || null,
      mode: cfg?.mode || (cfg?.webhookUri ? 'webhook' : 'sync'),
    });
  });

  // Crea (o recrea) la suscripción de avisos con una clave de firma nueva
  app.post('/api/calendly/connect', requireOwner, async (req, res) => {
    const db = getAdminDb();
    if (!db) return res.status(503).json({ error: 'El servidor no tiene acceso a la base.' });
    if (!process.env.CALENDLY_TOKEN) return res.status(400).json({ error: 'Falta CALENDLY_TOKEN en las variables del servidor (AI Studio → Secrets).' });
    try {
      const me = (await calendly('/users/me')).resource;
      const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
      const url = `${proto}://${req.get('host')}/api/calendly/webhook`;

      let webhookUri: string | null = null;
      let signingKey: string | null = null;
      let mode: 'webhook' | 'sync' = 'webhook';

      // Si no es localhost, intentamos registrar el webhook (disponible en planes Standard/Pro)
      if (!/localhost|127\.0\.0\.1/.test(url)) {
        try {
          const existing = await calendly(`/webhook_subscriptions?organization=${encodeURIComponent(me.current_organization)}&user=${encodeURIComponent(me.uri)}&scope=user&count=100`).catch(() => null);
          for (const s of existing?.collection || []) {
            if (s.callback_url === url) await calendly(s.uri, { method: 'DELETE' }).catch(() => undefined);
          }
          signingKey = crypto.randomBytes(32).toString('hex');
          const created = await calendly('/webhook_subscriptions', {
            method: 'POST',
            body: JSON.stringify({ url, events: ['invitee.created', 'invitee.canceled'], organization: me.current_organization, user: me.uri, scope: 'user', signing_key: signingKey }),
          });
          webhookUri = created.resource?.uri || null;
        } catch (subErr: any) {
          if (subErr?.status === 403 || String(subErr?.message || '').includes('Standard')) {
            mode = 'sync';
            console.info('[calendly] Plan sin soporte de webhooks (Standard requerido). Conectado en modo sincronización periódica.');
          } else {
            throw subErr;
          }
        }
      } else {
        mode = 'sync';
      }

      await db.collection('settings').doc(SETTINGS_DOC).set(
        { webhookUri, callbackUrl: webhookUri ? url : null, signingKey, schedulingUrl: me.scheduling_url || null, connectedAt: new Date().toISOString(), mode },
        { merge: true }
      );
      const sync = await importUpcomingBookings(db).catch((err) => {
        console.warn('[calendly] No se pudieron traer las reservas existentes:', err?.message || err);
        return null;
      });
      res.json({ ok: true, schedulingUrl: me.scheduling_url || null, sync, mode });
    } catch (err: any) {
      const msg = String(err?.message || err);
      console.error('[calendly] No se pudo conectar:', msg);
      res.status(500).json({ error: `No se pudo conectar con Calendly.`, details: msg.slice(0, 200) });
    }
  });
}
