import type express from 'express';
import { createHash } from 'crypto';
import { gzipSync } from 'zlib';
import { getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import type { Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { todayLocal } from '../src/utils/dates';

/**
 * LA APP SE CUIDA SOLA
 * - Respaldo semanal automático de toda la base en Firebase Storage (backups/), se guardan 8.
 *   Corre solo dentro de la tarea "frequent" cuando pasaron 7 días: no hay que agregar nada al reloj.
 * - Registro de cada tarea automática (cuándo corrió y si falló).
 * - Registro de errores de la app y de las integraciones, con aviso (una vez por día por error).
 * - /api/health/status: todo en verde o rojo para la pantalla "Estado de la app".
 */

const HEALTH_DOC = 'system_health';
const BACKUP_PREFIX = 'backups/';
const KEEP_BACKUPS = 8;
const BACKUP_EVERY_DAYS = 7;

type Notify = (title: string, body: string) => Promise<void>;

const healthRef = (db: Firestore) => db.collection('settings').doc(HEALTH_DOC);

export async function recordJobRun(db: Firestore, job: string, ok: boolean, detail?: string): Promise<void> {
  await healthRef(db)
    .set({ jobs: { [job]: { lastRunAt: new Date().toISOString(), ok, detail: (detail || '').slice(0, 300) } } }, { merge: true })
    .catch(() => undefined);
}

/**
 * Guarda un error (agrupado por mensaje y día) y avisa la primera vez del día.
 * source: 'app' (pantallas), 'servidor', o el nombre de la integración.
 */
export async function recordError(
  db: Firestore,
  e: { source: string; message: string; stack?: string; path?: string },
  notify?: Notify
): Promise<void> {
  const message = String(e.message || 'Error').slice(0, 400);
  const day = todayLocal();
  const id = `${day}_${createHash('sha1').update(`${e.source}|${message}`).digest('hex').slice(0, 16)}`;
  const ref = db.collection('app_errors').doc(id);
  try {
    const snap = await ref.get();
    const now = new Date().toISOString();
    if (snap.exists) {
      await ref.set({ count: ((snap.data() as any)?.count || 1) + 1, lastAt: now, path: e.path || null }, { merge: true });
      return;
    }
    await ref.set({ id, day, source: e.source, message, stack: (e.stack || '').slice(0, 2000), path: e.path || null, count: 1, firstAt: now, lastAt: now, seen: false });
    if (notify) await notify(`Algo falló en la app (${e.source})`, message.slice(0, 140)).catch(() => undefined);
  } catch (err) {
    console.warn('[salud] No se pudo guardar el error:', (err as Error).message);
  }
}

function bucket() {
  const name = (firebaseConfig as any).storageBucket as string | undefined;
  if (!name || !getApps()[0]) return null;
  return getStorage(getApps()[0]).bucket(name);
}

function plain(v: any): any {
  if (v === null || v === undefined) return v;
  if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
}

/** Copia completa de la base (todas las colecciones, con subcolecciones de primer nivel). */
export async function runBackup(db: Firestore): Promise<{ path: string; docs: number; bytes: number }> {
  const b = bucket();
  if (!b) throw new Error('No hay bucket de Storage configurado');
  const out: Record<string, Record<string, any>> = {};
  let docs = 0;
  for (const col of await db.listCollections()) {
    const snap = await col.get();
    out[col.id] = {};
    for (const d of snap.docs) {
      out[col.id][d.id] = plain(d.data());
      docs++;
    }
  }
  const body = gzipSync(Buffer.from(JSON.stringify({ createdAt: new Date().toISOString(), database: firebaseConfig.firestoreDatabaseId, collections: out })));
  const path = `${BACKUP_PREFIX}crm-${todayLocal()}.json.gz`;
  await b.file(path).save(body, { contentType: 'application/gzip', resumable: false });

  // Se guardan los últimos 8
  const [files] = await b.getFiles({ prefix: BACKUP_PREFIX });
  const old = files.map((f) => f.name).filter((n) => n.endsWith('.json.gz')).sort().slice(0, -KEEP_BACKUPS);
  await Promise.all(old.map((n) => b.file(n).delete().catch(() => undefined)));

  await healthRef(db).set({ backup: { lastAt: new Date().toISOString(), path, docs, bytes: body.length, ok: true, error: null } }, { merge: true });
  return { path, docs, bytes: body.length };
}

export async function runBackupIfDue(db: Firestore, notify?: Notify): Promise<string> {
  const h = ((await healthRef(db).get()).data() as any) || {};
  const last = h.backup?.lastAt ? Date.parse(h.backup.lastAt) : 0;
  if (Date.now() - last < BACKUP_EVERY_DAYS * 24 * 3600 * 1000 && h.backup?.ok) return 'al día';
  // si falló hace menos de un día, no reintenta en cada vuelta
  if (h.backup?.ok === false && h.backup?.failedAt && Date.now() - Date.parse(h.backup.failedAt) < 24 * 3600 * 1000) return 'esperando reintento';
  try {
    const r = await runBackup(db);
    return `respaldo hecho (${r.docs} registros)`;
  } catch (err) {
    const message = (err as Error).message;
    await healthRef(db).set({ backup: { ok: false, failedAt: new Date().toISOString(), error: message.slice(0, 300) } }, { merge: true });
    await recordError(db, { source: 'respaldo', message: `No se pudo hacer el respaldo semanal: ${message}` }, notify);
    return `falló: ${message}`;
  }
}

export interface IntegrationFlags {
  [key: string]: { configured: boolean; label: string; hint?: string };
}

export function registerHealthRoutes(
  app: express.Express,
  requireOwner: express.RequestHandler,
  getDb: () => Firestore | null,
  integrations: () => Promise<IntegrationFlags>,
  notify: Notify
) {
  // Errores de las pantallas (los manda el navegador con tu sesión)
  app.post('/api/health/error', requireOwner, async (req, res) => {
    const db = getDb();
    if (!db) return res.json({ ok: false });
    const b = req.body || {};
    await recordError(db, { source: 'app', message: String(b.message || ''), stack: String(b.stack || ''), path: String(b.path || '') }, notify);
    res.json({ ok: true });
  });

  app.get('/api/health/status', requireOwner, async (_req, res) => {
    const db = getDb();
    if (!db) return res.json({ dbAccess: false, integrations: await integrations(), jobs: {}, backup: null, errors: [] });
    const h = ((await healthRef(db).get()).data() as any) || {};
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const errs = await db.collection('app_errors').where('day', '>=', since).get();
    const errors = errs.docs
      .map((d) => d.data())
      .sort((a: any, b: any) => String(b.lastAt).localeCompare(String(a.lastAt)))
      .slice(0, 20);
    res.json({ dbAccess: true, integrations: await integrations(), jobs: h.jobs || {}, backup: h.backup || null, errors });
  });

  app.post('/api/health/errors/seen', requireOwner, async (_req, res) => {
    const db = getDb();
    if (!db) return res.json({ ok: false });
    const snap = await db.collection('app_errors').where('seen', '==', false).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.set(d.ref, { seen: true }, { merge: true }));
    await batch.commit();
    res.json({ ok: true, count: snap.size });
  });

  app.post('/api/health/backup', requireOwner, async (_req, res) => {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'El servidor no tiene acceso a la base.' });
    try {
      res.json({ ok: true, ...(await runBackup(db)) });
    } catch (err) {
      const message = (err as Error).message;
      await healthRef(db).set({ backup: { ok: false, failedAt: new Date().toISOString(), error: message.slice(0, 300) } }, { merge: true });
      res.status(500).json({ error: `No se pudo hacer el respaldo: ${message}` });
    }
  });

  // Link temporal (10 min) para descargar el último respaldo
  app.get('/api/health/backup/latest', requireOwner, async (_req, res) => {
    const b = bucket();
    if (!b) return res.status(404).json({ error: 'Sin respaldos todavía' });
    try {
      const [files] = await b.getFiles({ prefix: BACKUP_PREFIX });
      const last = files.map((f) => f.name).filter((n) => n.endsWith('.json.gz')).sort().pop();
      if (!last) return res.status(404).json({ error: 'Sin respaldos todavía' });
      const [url] = await b.file(last).getSignedUrl({ action: 'read', expires: Date.now() + 10 * 60 * 1000 });
      res.json({ url, name: last.replace(BACKUP_PREFIX, '') });
    } catch (err) {
      res.status(500).json({ error: `No se pudo generar el link: ${(err as Error).message}` });
    }
  });
}
