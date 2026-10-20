import express from 'express';
import { randomUUID } from 'crypto';
import { getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import firebaseConfig from '../firebase-applet-config.json';

/**
 * CONTENIDO: subir slides, miniaturas y PDF a Storage.
 * Cada archivo llega crudo (no en JSON) y vuelve con una dirección pública con token,
 * la misma que da Firebase cuando subís desde la consola.
 */

const SAFE_PATH = /^contenido\/[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*){0,3}$/;
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);

export function isSafeContentPath(path: string): boolean {
  return SAFE_PATH.test(path) && !path.includes('..');
}

export function registerContentRoutes(app: express.Express, requireOwner: express.RequestHandler, ensureAdmin: () => unknown) {
  app.post('/api/content/upload', requireOwner, express.raw({ type: () => true, limit: '20mb' }), async (req, res) => {
    const path = String(req.query.path || '');
    const type = String(req.headers['content-type'] || '').split(';')[0].trim();
    if (!isSafeContentPath(path)) return res.status(400).json({ ok: false, error: 'Ruta inválida' });
    if (!TYPES.has(type)) return res.status(400).json({ ok: false, error: 'Tipo de archivo no permitido' });
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ ok: false, error: 'Archivo vacío' });

    ensureAdmin();
    const bucketName = (firebaseConfig as any).storageBucket as string | undefined;
    if (!bucketName || !getApps()[0]) return res.status(503).json({ ok: false, error: 'El servidor no tiene Storage configurado', code: 'NO_STORAGE' });
    try {
      const token = randomUUID();
      await getStorage(getApps()[0])
        .bucket(bucketName)
        .file(path)
        .save(body, {
          resumable: false,
          contentType: type,
          metadata: { cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: token } },
        });
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
      res.json({ ok: true, url });
    } catch (err) {
      console.warn('[contenido] No se pudo subir', path, (err as Error).message);
      res.status(500).json({ ok: false, error: 'No se pudo guardar el archivo' });
    }
  });
}
