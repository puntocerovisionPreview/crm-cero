import type express from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { isWebProject, normalizeClientEmail, validDriveId } from '../src/automation/webRecipe';
import { AutomationNotify, enrollWebProject, ensureWebFollowup, executeWebRecipe, runRef, withProjectLease } from './webAutomation';
import { driveClient, driveRequest } from './driveOAuth';
import { deliverFile } from './driveFiles';
import { recordError } from './health';

export function registerWebAutomationRoutes(app: express.Express, owner: express.RequestHandler, getDb: () => Firestore | null, notify: AutomationNotify) {
  app.use('/api/web-automation', owner);
  const route = (fn: (req: express.Request, res: express.Response, db: Firestore) => Promise<unknown>): express.RequestHandler => async (req, res) => {
    try {
      const db = getDb();
      if (!db) return void res.status(503).json({ error: 'El servidor no tiene acceso a la base.' });
      if (req.params.id && !/^[\w-]{1,150}$/.test(req.params.id)) return void res.status(400).json({ error: 'Proyecto inválido.' });
      await fn(req, res, db);
    } catch (e: any) { res.status(400).json({ error: e.message || 'No se pudo completar la acción.' }); }
  };
  app.get('/api/web-automation/:id', route(async (req, res, db) => {
    const run = (await runRef(db, req.params.id).get()).data();
    const attempts = await db.collection('automation_runs').where('projectId', '==', req.params.id).get();
    const history = attempts.docs.map(d => ({ id: d.id, ...d.data() })).filter((d: any) => d.kind === 'execution').sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 20);
    res.json({ run: run || null, history });
  }));
  app.post('/api/web-automation/:id/run', route(async (req, res, db) => {
    const project = (await db.collection('projects').doc(req.params.id).get()).data();
    if (!project || !isWebProject(project)) throw new Error('Elegí un proyecto de Desarrollo web.');
    await enrollWebProject(db, req.params.id);
    res.json({ run: await executeWebRecipe(db, req.params.id, notify) });
  }));
  app.post('/api/web-automation/:id/email', route(async (req, res, db) => {
    const email = normalizeClientEmail(req.body.email);
    const run = (await runRef(db, req.params.id).get()).data();
    if (run?.folders?.some((f: any) => f.sharedWith && f.sharedWith !== email)) throw new Error('Las carpetas ya están compartidas con otro correo. Esta versión no permite cambiar el destinatario después de compartir; administrá los accesos desde Drive.');
    await db.collection('projects').doc(req.params.id).update({ clientEmail: email });
    if (run) await runRef(db, req.params.id).update({ pending: true, nextAttemptAt: 0 });
    res.json({ ok: true });
  }));
  app.post('/api/web-automation/:id/published', route(async (req, res, db) => {
    await ensureWebFollowup(db, req.params.id);
    res.json({ ok: true });
  }));
  // Picker permite otorgar acceso a archivos finales concretos sin pedir acceso a todo el Drive.
  app.get('/api/web-automation/:id/picker', route(async (_req, res, db) => {
    if (!process.env.GOOGLE_PICKER_API_KEY) throw new Error('Falta configurar Google Picker para elegir los archivos finales.');
    const client = await driveClient(db);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ token: (await client.getAccessToken()).token, apiKey: process.env.GOOGLE_PICKER_API_KEY, appId: process.env.GOOGLE_OAUTH_CLIENT_ID?.split('-')[0] });
  }));
  app.post('/api/web-automation/:id/delivery/preview', route(async (req, res, db) => {
    if (!Array.isArray(req.body.fileIds)) throw new Error('Elegí los archivos finales.');
    const ids = [...new Set(req.body.fileIds)] as string[];
    if (!ids.length || ids.length > 20 || !ids.every(validDriveId) || !['copy', 'move'].includes(req.body.mode)) throw new Error('Elegí entre 1 y 20 archivos y una acción válida.');
    const run = (await runRef(db, req.params.id).get()).data();
    const panel = run?.panelId ? (await db.collection('client_panels').doc(run.panelId).get()).data() : null;
    if (panel?.web?.stage !== 'publicada') throw new Error('La entrega se prepara cuando la etapa es Publicada.');
    const dest = run?.folders?.find((f: any) => f.key === 'entregables' && f.status === 'compartida');
    if (!dest) throw new Error('Primero creá y compartí Entregables.');
    const files = [];
    for (const id of ids) {
      const file = await driveRequest(db, `files/${id}?fields=id,name,mimeType,trashed`);
      if (file.trashed || file.mimeType === 'application/vnd.google-apps.folder') throw new Error('Elegí archivos finales, no carpetas.');
      files.push({ id: file.id, name: file.name });
    }
    const token = randomBytes(24).toString('hex');
    const ref = db.collection('automation_delivery').doc(createHash('sha256').update(token).digest('hex'));
    await ref.set({ projectId: req.params.id, destination: dest.id, files, mode: req.body.mode, expires: Date.now() + 10 * 60_000, done: false });
    res.json({ token, files, mode: req.body.mode, destination: dest.name });
  }));
  app.post('/api/web-automation/:id/delivery/confirm', route(async (req, res, db) => {
    if (typeof req.body.token !== 'string' || !/^[a-f0-9]{48}$/.test(req.body.token)) throw new Error('Confirmación inválida.');
    const ref = db.collection('automation_delivery').doc(createHash('sha256').update(req.body.token).digest('hex'));
    await withProjectLease(db, req.params.id, async heartbeat => {
      const preview = (await ref.get()).data();
      if (!preview || preview.projectId !== req.params.id || preview.expires < Date.now()) throw new Error('La confirmación venció. Volvé a elegir los archivos.');
      if (preview.done) return;
      const run = (await runRef(db, req.params.id).get()).data();
      const panel = run?.panelId ? (await db.collection('client_panels').doc(run.panelId).get()).data() : null;
      if (panel?.web?.stage !== 'publicada' || !run?.folders?.some((f: any) => f.key === 'entregables' && f.id === preview.destination && f.status === 'compartida')) throw new Error('La entrega cambió. Volvé a preparar la selección.');
      const attempt = db.collection('automation_runs').doc(`attempt_${randomUUID()}`);
      const actions: { fileId: string; status: string }[] = [];
      await attempt.set({ kind: 'execution', recipe: 'entrega_web', projectId: req.params.id, createdAt: new Date().toISOString(), status: 'en_curso', mode: preview.mode, actions });
      try {
        for (const file of preview.files) {
          await heartbeat();
          await deliverFile(db, req.params.id, file.id, preview.destination, preview.mode);
          actions.push({ fileId: file.id, status: 'ok' });
          await attempt.update({ actions });
        }
        await ref.update({ done: true, completedAt: new Date().toISOString() });
        await attempt.update({ status: 'ok', completedAt: new Date().toISOString() });
      } catch (e: any) {
        await attempt.update({ status: 'error', error: e.message, completedAt: new Date().toISOString() });
        await recordError(db, { source: 'drive', message: `No se pudo completar la entrega Web: ${e.message}` }, notify);
        throw e;
      }
    });
    res.json({ ok: true });
  }));
}
