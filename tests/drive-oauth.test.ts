import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryFirestore } from './helpers/memoryFirestore';
import { DRIVE_OWNER, DRIVE_SCOPE, registerDriveOAuth } from '../server/driveOAuth';
import { decryptDriveSecret } from '../server/driveCrypto';

const google = vi.hoisted(() => ({ email: 'puntocerovision@gmail.com', scope: 'https://www.googleapis.com/auth/drive.file', verified: true, revoke: vi.fn() }));
vi.mock('google-auth-library', () => ({ OAuth2Client: class {
  async generateCodeVerifierAsync() { return { codeVerifier: 'verifier-secret', codeChallenge: 'challenge' }; }
  generateAuthUrl(options: any) { return `https://accounts.google.com/auth?state=${options.state}`; }
  async getToken(options: any) { if (options.codeVerifier !== 'verifier-secret') throw new Error('PKCE'); return { tokens: { id_token: 'identity', refresh_token: 'refresh-private', scope: google.scope } }; }
  async verifyIdToken() { return { getPayload: () => ({ email: google.email, email_verified: google.verified }) }; }
  revokeToken = google.revoke;
} }));

function harness() {
  const { db, records } = memoryFirestore();
  const routes = new Map<string, any[]>();
  const app: any = { get: (path: string, ...handlers: any[]) => routes.set(`GET ${path}`, handlers), post: (path: string, ...handlers: any[]) => routes.set(`POST ${path}`, handlers) };
  const owner = (req: any, res: any, next: any) => req.owner ? next() : res.status(401).json({ error: 'Sin sesión' });
  registerDriveOAuth(app, owner, () => db);
  const call = async (method: string, path: string, req: any = {}) => {
    const res: any = { statusCode: 200, cookies: {}, body: null, location: null, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; }, send(body: any) { this.body = body; return this; }, cookie(name: string, value: any) { this.cookies[name] = value; }, clearCookie() {}, setHeader() {}, redirect(url: string) { this.location = url; } };
    const list = routes.get(`${method} ${path}`)!;
    const request = { headers: {}, query: {}, ...req };
    if (list.length === 2 && !request.owner) { owner(request, res, () => {}); return res; }
    await list.at(-1)(request, res);
    return res;
  };
  return { call, records };
}

describe('OAuth Drive', () => {
  beforeEach(() => {
    vi.stubEnv('APP_URL', 'https://crm.example.com');
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'client');
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'private');
    vi.stubEnv('GOOGLE_OAUTH_ENCRYPTION_KEY', Buffer.alloc(32, 3).toString('base64'));
    google.email = DRIVE_OWNER; google.scope = DRIVE_SCOPE; google.verified = true;
    google.revoke.mockResolvedValue({});
  });
  afterEach(() => vi.unstubAllEnvs());
  it('exige sesión en estado, inicio y desconexión', async () => {
    const h = harness();
    for (const [method, path] of [['GET','status'],['POST','connect'],['POST','disconnect']]) expect((await h.call(method, `/api/drive/${path}`)).statusCode).toBe(401);
    expect(h.records.size).toBe(0);
  });
  it('rechaza callback sin cookie y con estado vencido', async () => {
    const h = harness(); const start = await h.call('POST', '/api/drive/connect', { owner: true });
    const state = start.cookies.cero_drive_state;
    expect((await h.call('GET', '/api/drive/callback', { query: { state, code: 'code' } })).statusCode).toBe(400);
    const key = [...h.records.keys()][0]; h.records.get(key).expires = 0;
    expect((await h.call('GET', '/api/drive/callback', { query: { state, code: 'code' }, headers: { cookie: `cero_drive_state=${state}` } })).statusCode).toBe(400);
  });
  it('valida cuenta, cifra refresh token y consume state una sola vez', async () => {
    const h = harness(); const start = await h.call('POST', '/api/drive/connect', { owner: true });
    const state = start.cookies.cero_drive_state;
    const req = { query: { state, code: 'code' }, headers: { cookie: `cero_drive_state=${state}` } };
    expect((await h.call('GET', '/api/drive/callback', req)).location).toContain('drive=conectado');
    const encrypted = h.records.get('settings/integrations_private').drive.refresh;
    expect(encrypted).not.toContain('refresh-private'); expect(decryptDriveSecret(encrypted)).toBe('refresh-private');
    expect((await h.call('GET', '/api/drive/callback', req)).statusCode).toBe(400);
    const status = await h.call('GET', '/api/drive/status', { owner: true });
    expect(status.body.connected).toBe(true); expect(JSON.stringify(status.body)).not.toContain(encrypted);
  });
  it.each(['otra@gmail.com', 'scope'])('rechaza cuenta o permisos incorrectos (%s)', async value => {
    const h = harness(); const start = await h.call('POST', '/api/drive/connect', { owner: true });
    const state = start.cookies.cero_drive_state;
    if (value === 'scope') google.scope = 'openid'; else google.email = value;
    const response = await h.call('GET', '/api/drive/callback', { query: { state, code: 'code' }, headers: { cookie: `cero_drive_state=${state}` } });
    expect(response.statusCode).toBe(400); expect(h.records.has('settings/integrations_private')).toBe(false);
  });
  it('revoca antes de desconectar y conserva la credencial si falla la revocación', async () => {
    const h = harness(); const start = await h.call('POST', '/api/drive/connect', { owner: true });
    const state = start.cookies.cero_drive_state;
    await h.call('GET', '/api/drive/callback', { query: { state, code: 'code' }, headers: { cookie: `cero_drive_state=${state}` } });
    google.revoke.mockRejectedValueOnce(new Error('offline'));
    expect((await h.call('POST', '/api/drive/disconnect', { owner: true })).statusCode).toBe(503);
    expect(h.records.get('settings/integrations_private').drive.refresh).toBeTruthy();
    expect((await h.call('POST', '/api/drive/disconnect', { owner: true })).statusCode).toBe(200);
    expect(h.records.get('settings/integrations_private').drive.refresh).toBeNull();
  });
});
