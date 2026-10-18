import type express from 'express';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import webpush from 'web-push';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * NOTIFICACIONES PUSH NATIVAS (sin apps extra)
 *
 * - Claves VAPID: se generan solas la primera vez y se guardan en settings/push
 *   (o se pueden fijar con VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
 * - Cada dispositivo que activás queda en push_subscriptions/{id}.
 * - Si Firestore no tiene permisos o no está disponible, se usa un almacén local seguro (.data/push_store.json)
 *   como respaldo automático para que las notificaciones nunca fallen.
 */

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // pantalla que abre al tocarla
  tag?: string; // misma etiqueta = reemplaza a la anterior en vez de apilar
}

const DATA_DIR = path.join(process.cwd(), '.data');
const PUSH_FILE = path.join(DATA_DIR, 'push_store.json');

interface LocalPushStore {
  vapid?: { publicKey: string; privateKey: string };
  subscriptions: Record<string, { subscription: any; label: string; createdAt: string }>;
}

function readLocalPushStore(): LocalPushStore {
  try {
    if (fs.existsSync(PUSH_FILE)) {
      return JSON.parse(fs.readFileSync(PUSH_FILE, 'utf8'));
    }
  } catch {}
  return { subscriptions: {} };
}

function writeLocalPushStore(store: LocalPushStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PUSH_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.warn('[push] Error guardando almacén local:', e);
  }
}

let vapidReady: { publicKey: string } | null = null;

async function ensureVapid(db?: Firestore | null): Promise<{ publicKey: string }> {
  if (vapidReady) return vapidReady;
  let publicKey = process.env.VAPID_PUBLIC_KEY || '';
  let privateKey = process.env.VAPID_PRIVATE_KEY || '';

  if (!publicKey || !privateKey) {
    let storedFromDb: any = null;
    if (db) {
      try {
        const snap = await db.collection('settings').doc('push').get();
        if (snap.exists) storedFromDb = snap.data();
      } catch (err) {
        console.warn('[push] Firestore settings/push no accesible, usando almacén local:', (err as Error).message);
      }
    }

    if (storedFromDb?.publicKey && storedFromDb?.privateKey) {
      publicKey = storedFromDb.publicKey;
      privateKey = storedFromDb.privateKey;
    } else {
      const local = readLocalPushStore();
      if (local.vapid?.publicKey && local.vapid?.privateKey) {
        publicKey = local.vapid.publicKey;
        privateKey = local.vapid.privateKey;
      } else {
        const keys = webpush.generateVAPIDKeys();
        publicKey = keys.publicKey;
        privateKey = keys.privateKey;
        local.vapid = { publicKey, privateKey };
        writeLocalPushStore(local);
        if (db) {
          db.collection('settings').doc('push').set({ publicKey, privateKey, createdAt: new Date().toISOString() }, { merge: true }).catch(() => {});
        }
      }
    }
  }

  webpush.setVapidDetails('mailto:puntocerovision@gmail.com', publicKey, privateKey);
  vapidReady = { publicKey };
  return vapidReady;
}

const subId = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex').slice(0, 40);

export async function countPushDevices(db?: Firestore | null): Promise<number> {
  let count = 0;
  if (db) {
    try {
      const snap = await db.collection('push_subscriptions').get();
      count = snap.size;
    } catch {}
  }
  const local = readLocalPushStore();
  const localCount = Object.keys(local.subscriptions || {}).length;
  return Math.max(count, localCount);
}

/** Manda a todos los dispositivos activados. Devuelve cuántos la recibieron. */
export async function sendPushToAll(db: Firestore | null, payload: PushPayload): Promise<number> {
  await ensureVapid(db);
  const targets = new Map<string, { sub: any; docRef?: any }>();

  // 1. Intentar leer de Firestore
  if (db) {
    try {
      const snap = await db.collection('push_subscriptions').get();
      snap.docs.forEach((doc) => {
        const sub = (doc.data() as any)?.subscription;
        if (sub?.endpoint) targets.set(sub.endpoint, { sub, docRef: doc.ref });
      });
    } catch (err) {
      console.warn('[push] Error leyendo push de Firestore, usando almacén local:', (err as Error).message);
    }
  }

  // 2. Complementar con almacén local
  const local = readLocalPushStore();
  Object.values(local.subscriptions || {}).forEach((item) => {
    if (item.subscription?.endpoint && !targets.has(item.subscription.endpoint)) {
      targets.set(item.subscription.endpoint, { sub: item.subscription });
    }
  });

  let delivered = 0;
  const toDeleteLocal: string[] = [];

  await Promise.all(
    Array.from(targets.values()).map(async ({ sub, docRef }) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 60 * 60 * 6, urgency: 'high' });
        delivered++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          if (docRef) await docRef.delete().catch(() => {});
          toDeleteLocal.push(sub.endpoint);
        } else {
          console.warn('[push] Error enviando a', sub.endpoint?.slice(0, 30), err?.statusCode || err?.message);
        }
      }
    })
  );

  if (toDeleteLocal.length > 0) {
    toDeleteLocal.forEach((ep) => {
      delete local.subscriptions[subId(ep)];
    });
    writeLocalPushStore(local);
  }

  return delivered;
}

/** Texto de Telegram (HTML) → notificación corta: primera línea título, el resto cuerpo */
export function htmlToPush(html: string, fallbackTitle: string, url?: string, tag?: string): PushPayload {
  const plain = html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  const lines = plain.split('\n').map((l) => l.trim()).filter(Boolean);
  const title = (lines[0] || fallbackTitle).slice(0, 80);
  const body = lines.slice(1).join('\n');
  return { title, body: body.length > 220 ? `${body.slice(0, 217)}…` : body, url, tag };
}

export function registerPushRoutes(app: express.Express, requireOwner: express.RequestHandler, getDb: () => Firestore | null) {
  app.get('/api/push/public-key', requireOwner, async (_req, res) => {
    const db = getDb();
    try {
      res.json({ publicKey: (await ensureVapid(db)).publicKey, devices: await countPushDevices(db) });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/push/subscribe', requireOwner, async (req, res) => {
    const db = getDb();
    const subscription = req.body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh) return res.status(400).json({ error: 'Suscripción inválida' });
    const id = subId(subscription.endpoint);
    const label = String(req.body?.label || 'Dispositivo').slice(0, 60);
    const createdAt = new Date().toISOString();

    // Guardar en local siempre
    const local = readLocalPushStore();
    local.subscriptions[id] = { subscription, label, createdAt };
    writeLocalPushStore(local);

    // Intentar en Firestore si está disponible
    if (db) {
      db.collection('push_subscriptions').doc(id).set({ subscription, label, createdAt }).catch(() => {});
    }

    res.json({ ok: true });
  });

  app.post('/api/push/unsubscribe', requireOwner, async (req, res) => {
    const db = getDb();
    const endpoint = String(req.body?.endpoint || '');
    if (endpoint) {
      const id = subId(endpoint);
      const local = readLocalPushStore();
      delete local.subscriptions[id];
      writeLocalPushStore(local);
      if (db) {
        db.collection('push_subscriptions').doc(id).delete().catch(() => {});
      }
    }
    res.json({ ok: true });
  });

  app.post('/api/push/test', requireOwner, async (_req, res) => {
    const db = getDb();
    try {
      const delivered = await sendPushToAll(db, {
        title: 'Notificaciones activadas',
        body: 'Así te va a avisar .Cero CRM: resumen del día, reuniones y cobros.',
        url: '/agenda',
        tag: 'prueba',
      });
      res.json({ ok: true, delivered });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
