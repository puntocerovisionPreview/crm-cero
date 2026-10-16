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
  getDueReminders,
} from '../src/automation/messages';
import { addDays, todayLocal } from '../src/utils/dates';
import { runCalendarSync, isCalendarConfigured } from './calendarSync';

/**
 * MOTOR DE AUTOMATIZACIÓN
 *
 * Corre en el servidor aunque la app esté cerrada. Un reloj externo (cron-job.org o
 * Google Cloud Scheduler) llama a /api/cron/<tarea> con la clave CRON_SECRET.
 *
 * Variables de entorno (Secrets en AI Studio):
 * - FIREBASE_SERVICE_ACCOUNT: JSON de la cuenta de servicio (o el mismo JSON en base64)
 * - TELEGRAM_BOT_TOKEN: token del bot creado con @BotFather
 * - CRON_SECRET: clave larga inventada por vos; el reloj la manda en cada llamada
 * - TELEGRAM_CHAT_ID (opcional): si no, se usa el chat conectado desde Ajustes
 * - GOOGLE_CALENDAR_ID (opcional): tu Gmail, para sincronizar el calendario
 */

let adminDb: Firestore | null = null;

export function getAdminDb(): Firestore | null {
  if (adminDb) return adminDb;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const creds = JSON.parse(text);
    const app = getApps()[0] || initializeApp({ credential: cert(creds), projectId: creds.project_id });
    adminDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    return adminDb;
  } catch (err) {
    console.error('[automation] FIREBASE_SERVICE_ACCOUNT inválido:', (err as Error).message);
    return null;
  }
}

export function getServiceAccountEmail(): string | null {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) return null;
    const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(text).client_email || null;
  } catch {
    return null;
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

export async function loadAutomationData(db: Firestore): Promise<AutomationData> {
  const [tasks, meetings, projects, incomes, fixedExpenses, routine] = await Promise.all([
    readCollection<any>(db, 'tasks'),
    readCollection<any>(db, 'meetings'),
    readCollection<any>(db, 'projects'),
    readCollection<any>(db, 'incomes'),
    readCollection<any>(db, 'studioFixedExpenses'),
    readCollection<any>(db, 'daily_routine'),
  ]);
  return {
    tasks: plainDates(tasks),
    meetings: plainDates(meetings),
    projects: plainDates(projects),
    incomes: plainDates(incomes),
    fixedExpenses: plainDates(fixedExpenses),
    routine: plainDates(routine).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)),
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
  if (!db) return { job, skipped: 'Falta FIREBASE_SERVICE_ACCOUNT' };
  const today = todayLocal();

  if (job === 'calendar-sync') {
    if (!isCalendarConfigured()) return { job, skipped: 'Falta GOOGLE_CALENDAR_ID' };
    return { job, detail: await runCalendarSync(db, { dryRun: options.dryRun }) };
  }

  const chatId = await getTelegramChatId(db);
  if (!options.dryRun && !chatId) return { job, skipped: 'Telegram no está conectado' };
  const data = await loadAutomationData(db);

  if (job === 'daily-brief') {
    const text = buildDailyBrief(data, today);
    if (options.dryRun) return { job, detail: text };
    await sendTelegram(text, chatId!);
    return { job, sent: 1 };
  }

  if (job === 'weekly') {
    const text = buildWeeklyPlan(data, nextMonday(today), today);
    if (options.dryRun) return { job, detail: text };
    await sendTelegram(text, chatId!);
    return { job, sent: 1 };
  }

  if (job === 'reminders') {
    const due = getDueReminders(data, today, nowMinutesLocal());
    if (options.dryRun) return { job, detail: due };
    for (const r of due) {
      await sendTelegram(buildReminderMessage(r), chatId!);
      // Marca para no repetir; se limpia sola si se reprograma (ver firestoreService)
      await db.collection(r.kind === 'reunion' ? 'meetings' : 'tasks').doc(r.id).set({ telegramReminded: true }, { merge: true });
    }
    return { job, sent: due.length };
  }

  return { job, skipped: 'Tarea desconocida' };
}

// ---------------- RUTAS ----------------

function cronSecretOk(req: express.Request): boolean {
  const expected = process.env.CRON_SECRET || '';
  const given = String(req.headers['x-cron-secret'] || req.query.key || '');
  if (expected.length < 16 || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

const CRON_JOBS = ['daily-brief', 'reminders', 'weekly', 'calendar-sync'];

export function registerAutomationRoutes(app: express.Express, requireOwner: express.RequestHandler) {
  // Reloj externo: GET o POST /api/cron/<tarea>?key=CRON_SECRET
  // "frequent" junta lo que conviene correr cada 10-15 min (avisos + calendario)
  app.all('/api/cron/:job', async (req, res) => {
    if (!cronSecretOk(req)) return res.status(401).json({ error: 'Clave de cron inválida o no configurada' });
    const job = req.params.job;
    const jobs = job === 'frequent' ? ['reminders', 'calendar-sync'] : CRON_JOBS.includes(job) ? [job] : [];
    if (jobs.length === 0) return res.status(404).json({ error: 'Tarea desconocida' });
    const results: JobResult[] = [];
    for (const j of jobs) {
      try {
        results.push(await runJob(j));
      } catch (err) {
        console.error(`[automation] ${j} falló:`, err);
        results.push({ job: j, skipped: `Error: ${(err as Error).message}` });
      }
    }
    res.json({ ok: true, results });
  });

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
    res.json({
      serviceAccount: Boolean(db),
      serviceAccountEmail: getServiceAccountEmail(),
      telegramToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      telegramChat: Boolean(telegramChat),
      telegramChatName,
      cronSecret: (process.env.CRON_SECRET || '').length >= 16,
      calendar: isCalendarConfigured(),
      calendarId: process.env.GOOGLE_CALENDAR_ID || null,
    });
  });

  // Conectar Telegram: después de mandarle /start al bot, toma ese chat
  app.post('/api/automation/telegram/link', requireOwner, async (req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const db = getAdminDb();
    if (!token) return res.status(400).json({ error: 'Falta TELEGRAM_BOT_TOKEN en los Secrets' });
    if (!db) return res.status(400).json({ error: 'Falta FIREBASE_SERVICE_ACCOUNT en los Secrets' });
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
