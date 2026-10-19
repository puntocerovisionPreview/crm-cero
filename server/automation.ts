import type express from 'express';
import { timingSafeEqual } from 'crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  AutomationData,
  buildDailyBrief,
  buildReminderMessage,
  buildWeeklyPlan,
  buildProspectingClose,
  getDueReminders,
} from '../src/automation/messages';
import { mergeProspectingSettings } from '../src/prospecting/core';
import { addDays, todayLocal } from '../src/utils/dates';
import { runCalendarSync, isCalendarConfigured } from './calendarSync';
import { countPushDevices, htmlToPush, PushPayload, registerPushRoutes, sendPushToAll } from './push';
import { describeNewPayment, isMercadoPagoConfigured, registerMercadoPagoRoutes, syncRecentPayments } from './mercadopago';
import { registerDocumentRoutes } from './documents';
import { registerDocumensoRoutes } from './documenso';
import { recordError, recordJobRun, registerHealthRoutes, runBackupIfDue } from './health';
import { documentFollowups } from './contractsServer';
import { PeriodicData, buildDayCloseNudge, buildMonthClose, buildPafReport, buildProspectingWeek, buildTop3Section, buildWeeklyCollections } from '../src/automation/periodicMessages';

/**
 * MOTOR DE AUTOMATIZACIÓN
 *
 * Corre en el servidor aunque la app esté cerrada. Un reloj externo (cron-job.org o
 * Google Cloud Scheduler) llama a /api/cron/<tarea> con la clave CRON_SECRET.
 *
 * Variables de entorno (Secrets en AI Studio):
 * - FIREBASE_SERVICE_ACCOUNT (opcional en Cloud Run): JSON de una cuenta de servicio. Si no está
 *   y la app corre publicada en Cloud Run (mismo proyecto que Firestore), se usa la identidad
 *   propia del servidor: no hace falta generar ni pegar ninguna clave.
 * - TELEGRAM_BOT_TOKEN: token del bot creado con @BotFather
 * - CRON_SECRET: clave larga inventada por vos; el reloj la manda en cada llamada
 * - TELEGRAM_CHAT_ID (opcional): si no, se usa el chat conectado desde Ajustes
 * - GOOGLE_CALENDAR_ID (opcional): tu Gmail, para sincronizar el calendario
 */

let adminDb: Firestore | null = null;

// En Cloud Run existe K_SERVICE: el servidor tiene identidad de Google propia
export function isOnCloudRun(): boolean {
  return Boolean(process.env.K_SERVICE);
}

export function credentialMode(): 'clave' | 'cloud-run' | null {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return 'clave';
  if (isOnCloudRun()) return 'cloud-run';
  return null;
}

// La librería de servidor rechaza campos vacíos (undefined) y tiraba error al guardar
// auditorías con respuestas opcionales sin completar. Así se omiten, como en la app.
function prepareDb(db: Firestore): Firestore {
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

export function getAdminDb(): Firestore | null {
  if (adminDb) return adminDb;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  try {
    if (raw) {
      const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const creds = JSON.parse(text);
      const app = getApps()[0] || initializeApp({ credential: cert(creds), projectId: creds.project_id });
      adminDb = prepareDb(getFirestore(app, firebaseConfig.firestoreDatabaseId));
      return adminDb;
    }
    if (isOnCloudRun()) {
      // Sin clave: credenciales automáticas del servicio de Cloud Run
      const app = getApps()[0] || initializeApp({ projectId: firebaseConfig.projectId });
      adminDb = prepareDb(getFirestore(app, firebaseConfig.firestoreDatabaseId));
      return adminDb;
    }
    return null;
  } catch (err) {
    console.error('[automation] No se pudo conectar a Firestore como administrador:', (err as Error).message);
    return null;
  }
}

let cachedEmail: string | null | undefined;

/** Correo de la identidad del servidor (para compartir el Google Calendar con ella). */
export async function getServiceAccountEmail(): Promise<string | null> {
  if (cachedEmail !== undefined) return cachedEmail;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw) {
      const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      cachedEmail = JSON.parse(text).client_email || null;
    } else if (isOnCloudRun()) {
      const r = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email', {
        headers: { 'Metadata-Flavor': 'Google' },
      });
      cachedEmail = r.ok ? (await r.text()).trim() : null;
    } else cachedEmail = null;
  } catch {
    cachedEmail = null;
  }
  return cachedEmail ?? null;
}

/** Prueba real de lectura: confirma que el servidor tiene permiso sobre la base. */
export async function checkDbAccess(): Promise<string> {
  const db = getAdminDb();
  if (!db) return 'sin credenciales';
  try {
    await db.collection('settings').doc('automation').get();
    return 'ok';
  } catch (err) {
    return (err as Error).message.slice(0, 200);
  }
}

async function readCollection<T>(db: Firestore, name: string): Promise<T[]> {
  const snap = await db.collection(name).get();
  return snap.docs.map((d) => ({ ...(d.data() as any), id: d.id }) as T);
}

// Los Timestamps de Firestore se pasan a texto, como en la app
function plainDates<T extends Record<string, any>>(items: T[]): T[] {
  return items.map((it) => {
    const out: Record<string, any> = { ...it };
    for (const [k, v] of Object.entries(out)) {
      if (v && typeof v === 'object' && typeof (v as any).toDate === 'function') out[k] = (v as any).toDate().toISOString();
    }
    return out as T;
  });
}

export async function loadAutomationData(db: Firestore): Promise<PeriodicData> {
  const [tasks, meetings, projects, incomes, fixedExpenses, routine, prospects, prospectingDoc, expenses, prospectEvents] = await Promise.all([
    readCollection<any>(db, 'tasks'),
    readCollection<any>(db, 'meetings'),
    readCollection<any>(db, 'projects'),
    readCollection<any>(db, 'incomes'),
    readCollection<any>(db, 'studioFixedExpenses'),
    readCollection<any>(db, 'daily_routine'),
    readCollection<any>(db, 'prospects'),
    db.collection('settings').doc('prospecting').get(),
    readCollection<any>(db, 'expenses'),
    readCollection<any>(db, 'prospect_events'),
  ]);
  const savedSettings = (prospectingDoc.exists ? prospectingDoc.data() : {}) as any;
  return {
    tasks: plainDates(tasks),
    meetings: plainDates(meetings),
    projects: plainDates(projects),
    incomes: plainDates(incomes),
    fixedExpenses: plainDates(fixedExpenses),
    routine: plainDates(routine).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)),
    prospects: plainDates(prospects).map((p: any) => ({ followUps: 0, ...p })),
    prospectingSettings: mergeProspectingSettings(savedSettings),
    expenses: plainDates(expenses),
    prospectEvents: plainDates(prospectEvents),
  };
}

// ---------------- TELEGRAM ----------------

async function getTelegramChatId(db: Firestore | null): Promise<string | null> {
  if (process.env.TELEGRAM_CHAT_ID) return process.env.TELEGRAM_CHAT_ID;
  if (!db) return null;
  const snap = await db.collection('settings').doc('automation').get();
  return (snap.exists && (snap.data() as any)?.telegramChatId) || null;
}

export async function sendTelegram(text: string, chatId: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Falta TELEGRAM_BOT_TOKEN');
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!r.ok) throw new Error(`Telegram respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

// ---------------- TAREAS PROGRAMADAS ----------------

function nowMinutesLocal(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function nextMonday(today: string): string {
  const day = new Date(`${today}T12:00:00`).getDay();
  const add = day === 1 ? 0 : (8 - day) % 7 || 7;
  return addDays(today, add);
}

type JobResult = { job: string; sent?: number; detail?: any; skipped?: string };

async function runJob(job: string, options: { dryRun?: boolean } = {}): Promise<JobResult> {
  const db = getAdminDb();
  if (!db) return { job, skipped: 'El servidor no tiene acceso a la base de datos' };
  const today = todayLocal();

  if (job === 'mercadopago') {
    if (!isMercadoPagoConfigured()) return { job, skipped: 'Falta MP_ACCESS_TOKEN' };
    const created = await syncRecentPayments(db);
    if (options.dryRun) return { job, detail: created.map(describeNewPayment) };
    // Solo se avisa lo que te pagaron; lo que pagaste vos queda en la bandeja sin aviso
    const received = created.filter((p) => p.direction === 'recibido');
    for (const p of received) {
      const n = describeNewPayment(p);
      await notifyAll(db, n.title, n.body, '/dinero', `mp-${p.id}`);
    }
    return { job, sent: received.length };
  }

  if (job === 'calendar-sync') {
    if (!isCalendarConfigured()) return { job, skipped: 'Falta GOOGLE_CALENDAR_ID' };
    return { job, detail: await runCalendarSync(db, { dryRun: options.dryRun }) };
  }

  // Canales: notificación push en tus dispositivos y/o Telegram (lo que esté activado)
  const chatId = await getTelegramChatId(db);
  const pushDevices = await countPushDevices(db);
  if (!options.dryRun && !chatId && pushDevices === 0) {
    return { job, skipped: 'No hay dónde avisarte: activá las notificaciones en un dispositivo o conectá Telegram' };
  }
  const deliver = async (html: string, push: PushPayload) => {
    let sent = 0;
    if (chatId) {
      await sendTelegram(html, chatId);
      sent++;
    }
    if (pushDevices > 0) sent += await sendPushToAll(db, push);
    return sent;
  };
  const data = await loadAutomationData(db);

  if (job === 'daily-brief') {
    const top3 = buildTop3Section(data, today);
    const brief = buildDailyBrief(data, today);
    // "Tus 3 de hoy" va arriba de todo, después del saludo
    const text = top3 ? brief.replace(/^(.*\n)/, `$1\n${top3}\n`) : brief;
    if (options.dryRun) return { job, detail: text };
    return { job, sent: await deliver(text, htmlToPush(text, 'Tu día', '/agenda', 'resumen-diario')) };
  }

  if (job === 'weekly') {
    const prospectingWeekText = buildProspectingWeek(data, today);
    const text = [buildWeeklyPlan(data, nextMonday(today), today), prospectingWeekText].filter(Boolean).join('\n\n');
    if (options.dryRun) return { job, detail: text };
    return { job, sent: await deliver(text, htmlToPush(text, 'Tu semana', '/semana', 'plan-semanal')) };
  }

  if (job === 'weekly-collections') {
    const text = buildWeeklyCollections(data, today);
    if (options.dryRun) return { job, detail: text || 'No vence nada esta semana.' };
    if (!text) return { job, sent: 0 };
    return { job, sent: await deliver(text, htmlToPush(text, 'Cobranza de la semana', '/inicio', 'cobranza-semana')) };
  }

  if (job === 'paf-report') {
    const text = buildPafReport(data, today);
    if (options.dryRun) return { job, detail: text || 'No hay alumnos PAF activos.' };
    if (!text) return { job, sent: 0 };
    return { job, sent: await deliver(text, htmlToPush(text, 'Alumnos PAF', '/reportes?tab=paf', 'reporte-paf')) };
  }

  if (job === 'month-close') {
    const text = buildMonthClose(data, today);
    if (options.dryRun) return { job, detail: text };
    return { job, sent: await deliver(text, htmlToPush(text, 'Cierre de mes', '/reportes?tab=mes', 'cierre-mes')) };
  }

  if (job === 'day-close') {
    const text = buildDayCloseNudge(data, today);
    if (options.dryRun) return { job, detail: text };
    return { job, sent: await deliver(text, htmlToPush(text, 'Cerrá el día', '/inicio', 'cierre-dia')) };
  }

  if (job === 'prospecting-close') {
    const text = buildProspectingClose(data, today);
    if (options.dryRun) return { job, detail: text || 'Hoy no hay nadie para cerrar.' };
    if (!text) return { job, sent: 0 };
    return { job, sent: await deliver(text, htmlToPush(text, 'Cierre de prospección', '/prospeccion', 'cierre-prospeccion')) };
  }

  if (job === 'reminders') {
    const due = getDueReminders(data, today, nowMinutesLocal());
    if (options.dryRun) return { job, detail: due };
    let sent = 0;
    for (const r of due) {
      const html = buildReminderMessage(r);
      sent += await deliver(html, htmlToPush(html, 'Recordatorio', '/agenda', `aviso-${r.id}`));
      // Marca para no repetir; se limpia sola si se reprograma (ver firestoreService)
      await db.collection(r.kind === 'reunion' ? 'meetings' : 'tasks').doc(r.id).set({ telegramReminded: true }, { merge: true });
    }
    return { job, sent };
  }

  return { job, skipped: 'Tarea desconocida' };
}

/** Aviso corto por push y/o Telegram (lo que esté activado) */
async function notifyAll(db: Firestore, title: string, body: string, url: string, tag: string) {
  const chatId = await getTelegramChatId(db).catch(() => null);
  if (chatId) await sendTelegram(`<b>${title.replace(/</g, '&lt;')}</b>\n${body.replace(/</g, '&lt;')}`, chatId).catch(() => {});
  if ((await countPushDevices(db).catch(() => 0)) > 0) await sendPushToAll(db, { title, body, url, tag }).catch(() => 0);
}

// ---------------- RUTAS ----------------

function cronSecretOk(req: express.Request): boolean {
  const expected = process.env.CRON_SECRET || '';
  const given = String(req.headers['x-cron-secret'] || req.query.key || '');
  if (expected.length < 16 || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

const CRON_JOBS = ['daily-brief', 'reminders', 'weekly', 'calendar-sync', 'prospecting-close', 'mercadopago', 'weekly-collections', 'paf-report', 'month-close', 'day-close'];

export function registerAutomationRoutes(app: express.Express, requireOwner: express.RequestHandler) {
  // Notificaciones push nativas (activar en cada dispositivo, prueba)
  registerPushRoutes(app, requireOwner, getAdminDb);
  // Mercado Pago: webhook, "Buscar pagos" y estado
  registerMercadoPagoRoutes(app, requireOwner, getAdminDb, async (title, body) => {
    const db = getAdminDb();
    if (db) await notifyAll(db, title, body, '/dinero', 'mp');
  });
  // Presupuestos: el cliente acepta desde el link
  registerDocumentRoutes(app, getAdminDb, async (title, body) => {
    const db = getAdminDb();
    if (db) await notifyAll(db, title, body, '/documentos', 'doc');
  });
  // Presupuestos: firma digital con Documenso
  registerDocumensoRoutes(app, requireOwner, getAdminDb, async (title, body) => {
    const db = getAdminDb();
    if (db) await notifyAll(db, title, body, '/documentos', 'doc');
  });

  // Reloj externo: GET o POST /api/cron/<tarea>?key=CRON_SECRET
  // "frequent" junta lo que conviene correr cada 10-15 min (avisos + calendario)
  app.all('/api/cron/:job', async (req, res) => {
    if (!cronSecretOk(req)) return res.status(401).json({ error: 'Clave de cron inválida o no configurada' });
    const job = req.params.job;
    const jobs = job === 'frequent' ? ['reminders', 'calendar-sync', 'mercadopago'] : CRON_JOBS.includes(job) ? [job] : [];
    if (jobs.length === 0) return res.status(404).json({ error: 'Tarea desconocida' });
    const results: JobResult[] = [];
    const db = getAdminDb();
    const notify = async (title: string, body: string) => {
      if (db) await notifyAll(db, title, body, '/ajustes/estado', 'salud');
    };
    for (const j of jobs) {
      try {
        const r = await runJob(j);
        results.push(r);
        if (db) await recordJobRun(db, j, true, r.skipped || (typeof r.detail === 'string' ? r.detail : r.sent !== undefined ? `${r.sent} enviados` : ''));
      } catch (err) {
        console.error(`[automation] ${j} falló:`, err);
        results.push({ job: j, skipped: `Error: ${(err as Error).message}` });
        if (db) {
          await recordJobRun(db, j, false, (err as Error).message);
          await recordError(db, { source: j, message: (err as Error).message, stack: (err as Error).stack }, notify);
        }
      }
    }
    // Respaldo semanal: va solo con la tarea frecuente, cuando pasaron 7 días
    if (job === 'frequent' && db) {
      const detail = await runBackupIfDue(db, notify);
      results.push({ job: 'backup', detail });
      await recordJobRun(db, 'backup', !detail.startsWith('falló'), detail);
      // Presupuestos sin abrir, sin respuesta o por vencer (una vez por día)
      try {
        const docs = await documentFollowups(db, async (title, body) => {
          await notifyAll(db, title, body, '/documentos', 'doc');
        });
        results.push({ job: 'presupuestos', detail: docs });
        await recordJobRun(db, 'presupuestos', true, docs);
      } catch (err) {
        await recordJobRun(db, 'presupuestos', false, (err as Error).message);
      }
    }
    res.json({ ok: true, results });
  });

  // Estado de la app: integraciones, tareas, respaldo y errores (pantalla Ajustes → Estado)
  registerHealthRoutes(
    app,
    requireOwner,
    getAdminDb,
    async () => {
      const db = getAdminDb();
      const push = await countPushDevices(db).catch(() => 0);
      return {
        base: { configured: !!db && (await checkDbAccess()) === 'ok', label: 'Base de datos del servidor', hint: 'Sin esto no corren las automatizaciones.' },
        reloj: { configured: (process.env.CRON_SECRET || '').length >= 16, label: 'Reloj de automatizaciones (cron)', hint: 'CRON_SECRET + cron-job.org (ver guía).' },
        ia: { configured: !!process.env.GEMINI_API_KEY, label: 'Inteligencia artificial (Gemini)', hint: 'GEMINI_API_KEY en Secrets.' },
        push: { configured: push > 0, label: `Notificaciones en el celular${push ? ` (${push})` : ''}`, hint: 'Activá las notificaciones desde Ajustes en tu celular.' },
        mercadoPago: { configured: isMercadoPagoConfigured(), label: 'Mercado Pago', hint: 'MP_ACCESS_TOKEN en Secrets.' },
        documenso: { configured: !!process.env.DOCUMENSO_API_KEY, label: 'Firma digital (Documenso)', hint: 'DOCUMENSO_API_KEY en Secrets.' },
        calendly: { configured: !!process.env.CALENDLY_TOKEN, label: 'Calendly', hint: 'CALENDLY_TOKEN en Secrets.' },
        calendar: { configured: isCalendarConfigured(), label: 'Google Calendar', hint: 'GOOGLE_CALENDAR_ID en Secrets.' },
      };
    },
    async (title, body) => {
      const db = getAdminDb();
      if (db) await notifyAll(db, title, body, '/ajustes/estado', 'salud');
    }
  );

  // Estado de la configuración (solo vos)
  app.get('/api/automation/status', requireOwner, async (req, res) => {
    const db = getAdminDb();
    let telegramChat: string | null = null;
    let telegramChatName: string | null = null;
    try {
      telegramChat = await getTelegramChatId(db);
      if (db) {
        const s = await db.collection('settings').doc('automation').get();
        telegramChatName = (s.exists && (s.data() as any)?.telegramChatName) || null;
      }
    } catch {}
    const dbAccess = await checkDbAccess();
    res.json({
      serviceAccount: dbAccess === 'ok',
      credentialMode: credentialMode(),
      dbAccessError: dbAccess === 'ok' ? null : dbAccess,
      serviceAccountEmail: await getServiceAccountEmail(),
      telegramToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      telegramChat: Boolean(telegramChat),
      telegramChatName,
      cronSecret: (process.env.CRON_SECRET || '').length >= 16,
      cronSecretValue: process.env.CRON_SECRET || null,
      mercadoPago: isMercadoPagoConfigured(),
      pushDevices: await countPushDevices(db).catch(() => 0),
      calendar: isCalendarConfigured(),
      calendarId: process.env.GOOGLE_CALENDAR_ID || null,
    });
  });

  // Conectar Telegram: después de mandarle /start al bot, toma ese chat
  app.post('/api/automation/telegram/link', requireOwner, async (req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const db = getAdminDb();
    if (!token) return res.status(400).json({ error: 'Falta TELEGRAM_BOT_TOKEN en los Secrets' });
    if (!db) return res.status(400).json({ error: 'El servidor no tiene acceso a la base de datos' });
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=50`);
      const data: any = await r.json();
      const msgs = (data.result || [])
        .map((u: any) => u.message)
        .filter((m: any) => m && m.chat?.type === 'private');
      const last = msgs[msgs.length - 1];
      if (!last) return res.status(404).json({ error: 'No encontré mensajes. Abrí tu bot en Telegram, mandale /start y probá de nuevo.' });
      const chatName = [last.chat.first_name, last.chat.last_name].filter(Boolean).join(' ') || last.chat.username || 'Telegram';
      await db.collection('settings').doc('automation').set(
        { telegramChatId: String(last.chat.id), telegramChatName: chatName, linkedAt: new Date().toISOString() },
        { merge: true }
      );
      await sendTelegram('<b>Listo.</b> Desde ahora tu CRM .Cero te escribe por acá.', String(last.chat.id));
      res.json({ ok: true, chatName });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Vista previa (no manda nada) o envío de prueba
  app.post('/api/automation/run', requireOwner, async (req, res) => {
    const job = String(req.body?.job || '');
    if (!CRON_JOBS.includes(job)) return res.status(400).json({ error: 'Tarea desconocida' });
    try {
      res.json(await runJob(job, { dryRun: Boolean(req.body?.dryRun) }));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
