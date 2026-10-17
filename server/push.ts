import type express from 'express';
import { createHash } from 'crypto';
import webpush from 'web-push';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * NOTIFICACIONES PUSH NATIVAS (sin apps extra)
 *
 * - Claves VAPID: se generan solas la primera vez y se guardan en settings/push
 *   (o se pueden fijar con VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
 * - Cada dispositivo que activás queda en push_subscriptions/{id}.
 * - Si un dispositivo deja de existir (desinstalaste la app), se borra solo.
 * En iPhone, el navegador solo permite push con la app agregada a la pantalla de inicio.
 */

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // pantalla que abre al tocarla
  tag?: string; // misma etiqueta = reemplaza a la anterior en vez de apilar
}

let vapidReady: { publicKey: string } | null = null;

async function ensureVapid(db: Firestore): Promise<{ publicKey: string }> {
  if (vapidReady) return vapidReady;
  let publicKey = process.env.VAPID_PUBLIC_KEY || '';
  let privateKey = process.env.VAPID_PRIVATE_KEY || '';
  if (!publicKey || !privateKey) {
    const ref = db.collection('settings').doc('push');
    const snap = await ref.get();
    const stored = snap.exists ? (snap.data() as any) : null;
    if (stored?.publicKey && stored?.privateKey) {
      publicKey = stored.publicKey;
      privateKey = stored.privateKey;
    } else {
      const keys = webpush.generateVAPIDKeys();
      publicKey = keys.publicKey;
      privateKey = keys.privateKey;
      await ref.set({ publicKey, privateKey, createdAt: new Date().toISOString() }, { merge: true });
    }
  }
  webpush.setVapidDetails('mailto:puntocerovision@gmail.com', publicKey, privateKey);
  vapidReady = { publicKey };
  return vapidReady;
}

const subId = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex').slice(0, 40);

export async function countPushDevices(db: Firestore): Promise<number> {
  const snap = await db.collection('push_subscriptions').get();
  return snap.size;
}

/** Manda a todos los dispositivos activados. Devuelve cuántos la recibieron. */
export async function sendPushToAll(db: Firestore, payload: PushPayload): Promise<number> {
  await ensureVapid(db);
  const snap = await db.collection('push_subscriptions').get();
  let delivered = 0;
  await Promise.all(
    snap.docs.map(async (doc) => {
      const { subscription } = doc.data() as any;
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 * 6, urgency: 'high' });
        delivered++;
      } catch (err: any) {
        // 404/410: el dispositivo ya no existe (app desinstalada o permiso quitado)
        if (err?.statusCode === 404 || err?.statusCode === 410) await doc.ref.delete();
        else console.warn('[push] no se pudo enviar a', doc.id, err?.statusCode || err?.message);
      }
    })
  );
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
  const withDb = (res: express.Response): Firestore | null => {
    const db = getDb();
    if (!db) res.status(503).json({ error: 'El servidor no tiene acceso a la base de datos' });
    return db;
  };

  app.get('/api/push/public-key', requireOwner, async (_req, res) => {
    const db = withDb(res);
    if (!db) return;
    try {
      res.json({ publicKey: (await ensureVapid(db)).publicKey, devices: await countPushDevices(db) });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/push/subscribe', requireOwner, async (req, res) => {
    const db = withDb(res);
    if (!db) return;
    const subscription = req.body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh) return res.status(400).json({ error: 'Suscripción inválida' });
    await db.collection('push_subscriptions').doc(subId(subscription.endpoint)).set({
      subscription,
      label: String(req.body?.label || 'Dispositivo').slice(0, 60),
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  });

  app.post('/api/push/unsubscribe', requireOwner, async (req, res) => {
    const db = withDb(res);
    if (!db) return;
    const endpoint = String(req.body?.endpoint || '');
    if (endpoint) await db.collection('push_subscriptions').doc(subId(endpoint)).delete();
    res.json({ ok: true });
  });

  app.post('/api/push/test', requireOwner, async (_req, res) => {
    const db = withDb(res);
    if (!db) return;
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
