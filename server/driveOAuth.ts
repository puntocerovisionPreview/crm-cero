import type express from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomBytes } from 'crypto';
import { decryptDriveSecret, encryptDriveSecret } from './driveCrypto';

export const DRIVE_OWNER = 'puntocerovision@gmail.com';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const integrationRef = (db: Firestore) => db.collection('settings').doc('integrations_private');
export class DrivePending extends Error {}
export function appOrigin(): string {
  const url = new URL(process.env.APP_URL || '');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('APP_URL debe ser la dirección HTTPS del CRM.');
  return url.origin;
}
export function driveConfigured(): boolean {
  try {
    appOrigin();
    return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && Buffer.from(process.env.GOOGLE_OAUTH_ENCRYPTION_KEY || '', 'base64').length === 32);
  } catch { return false; }
}
export function oauthClient(): OAuth2Client {
  if (!driveConfigured()) throw new DrivePending('Configurá la conexión con Google Drive en Ajustes.');
  return new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET, `${appOrigin()}/api/drive/callback`);
}
export async function driveClient(db: Firestore): Promise<OAuth2Client> {
  const data = (await integrationRef(db).get()).data()?.drive;
  if (!data?.refresh || data.email !== DRIVE_OWNER) throw new DrivePending('Conectá Google Drive desde Ajustes.');
  const client = oauthClient();
  client.setCredentials({ refresh_token: decryptDriveSecret(data.refresh) });
  return client;
}
export async function driveRequest<T = any>(db: Firestore, path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', data?: unknown): Promise<T> {
  try {
    const client = await driveClient(db);
    return (await client.request<T>({ url: `https://www.googleapis.com/drive/v3/${path}`, method, data, timeout: 20000 })).data;
  } catch (e: any) {
    if (e instanceof DrivePending) throw e;
    const status = Number(e.response?.status || e.code);
    if (status === 401 || e.response?.data?.error === 'invalid_grant') {
      await integrationRef(db).set({ drive: { error: 'La autorización venció. Volvé a conectar Google Drive.' } }, { merge: true });
      throw new DrivePending('La autorización venció. Volvé a conectar Google Drive.');
    }
    const error = new Error(`Drive no pudo completar la operación${status ? ` (${status})` : ''}. Revisá la conexión y los permisos.`);
    Object.assign(error, { status });
    throw error;
  }
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function registerDriveOAuth(app: express.Express, requireOwner: express.RequestHandler, getDb: () => Firestore | null) {
  app.get('/api/drive/status', requireOwner, async (_req, res) => {
    try {
      const db = getDb();
      const d = db ? (await integrationRef(db).get()).data()?.drive : null;
      res.json({ configured: driveConfigured(), connected: Boolean(d?.refresh), email: d?.email || null, error: d?.error || (!db ? 'El servidor no tiene acceso a la base.' : null) });
    } catch { res.status(503).json({ error: 'No se pudo consultar la conexión con Drive.' }); }
  });
  app.post('/api/drive/connect', requireOwner, async (_req, res) => {
    try {
      const db = getDb();
      if (!db) return res.status(503).json({ error: 'El servidor no tiene acceso a la base.' });
      const client = oauthClient();
      const state = randomBytes(32).toString('base64url');
      const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
      await db.collection('settings').doc(`drive_oauth_${hash(state)}`).set({ verifier: encryptDriveSecret(codeVerifier), expires: Date.now() + 10 * 60_000 });
      res.cookie('cero_drive_state', state, { httpOnly: true, secure: appOrigin().startsWith('https:'), sameSite: 'lax', path: '/api/drive/callback', maxAge: 10 * 60_000 });
      res.json({ url: client.generateAuthUrl({ scope: [DRIVE_SCOPE, 'openid', 'email'], access_type: 'offline', prompt: 'consent', login_hint: DRIVE_OWNER, state, code_challenge: codeChallenge, code_challenge_method: 'S256' as any }) });
    } catch { res.status(503).json({ error: 'Falta configurar la conexión de Drive. Revisá los Secrets y APP_URL.' }); }
  });
  app.get('/api/drive/callback', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('cero_drive_state='))?.slice('cero_drive_state='.length);
      if (!state || !/^[\w-]{43}$/.test(state) || cookie !== state) return res.status(400).send('La conexión venció o no es válida. Volvé a iniciarla desde Ajustes.');
      const db = getDb();
      if (!db) throw new Error('db');
      const ref = db.collection('settings').doc(`drive_oauth_${hash(state)}`);
      const verifier = await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const data = snap.data();
        if (!data || data.expires < Date.now()) throw new Error('state');
        tx.delete(ref);
        return decryptDriveSecret(data.verifier);
      });
      res.clearCookie('cero_drive_state', { path: '/api/drive/callback' });
      if (req.query.error) return res.redirect(`${appOrigin()}/ajustes/automatizaciones?drive=cancelado`);
      if (typeof req.query.code !== 'string') throw new Error('code');
      const client = oauthClient();
      const { tokens } = await client.getToken({ code: req.query.code, codeVerifier: verifier });
      if (!tokens.id_token || !tokens.refresh_token || !tokens.scope?.split(' ').includes(DRIVE_SCOPE)) throw new Error('consent');
      const identity = (await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_OAUTH_CLIENT_ID })).getPayload();
      if (!identity?.email_verified || identity.email?.toLowerCase() !== DRIVE_OWNER) return res.status(400).send(`Conectá la cuenta ${DRIVE_OWNER}. Volvé a Ajustes e intentá de nuevo.`);
      await integrationRef(db).set({ drive: { refresh: encryptDriveSecret(tokens.refresh_token), email: DRIVE_OWNER, connectedAt: new Date().toISOString(), error: null } }, { merge: true });
      res.redirect(`${appOrigin()}/ajustes/automatizaciones?drive=conectado`);
    } catch { res.status(400).send('No se pudo conectar Google Drive. Volvé a Ajustes e intentá de nuevo.'); }
  });
  app.post('/api/drive/disconnect', requireOwner, async (_req, res) => {
    try {
      const db = getDb();
      if (!db) return res.status(503).json({ error: 'El servidor no tiene acceso a la base.' });
      const d = (await integrationRef(db).get()).data()?.drive;
      if (d?.refresh) await oauthClient().revokeToken(decryptDriveSecret(d.refresh));
      await integrationRef(db).set({ drive: { refresh: null, email: null, error: null } }, { merge: true });
      res.json({ ok: true });
    } catch { res.status(503).json({ error: 'No se pudo revocar el acceso. Volvé a intentar.' }); }
  });
}
