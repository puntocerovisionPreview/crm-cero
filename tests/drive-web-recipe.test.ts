import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryFirestore } from './helpers/memoryFirestore';
import { isPrivateIntegrationDocument, isWebProject, materialFolder, normalizeClientEmail, publicFolders, welcomeMessage, WEB_FOLDERS } from '../src/automation/webRecipe';
import { encryptDriveSecret, decryptDriveSecret } from '../server/driveCrypto';
import { enrollWebProject, ensureWebFollowup, executeWebRecipe, withProjectLease } from '../server/webAutomation';
import { ensureFolder, shareFolder, deliverFile } from '../server/driveFiles';
import { driveRequest, DrivePending } from '../server/driveOAuth';
vi.mock('../server/health', () => ({ recordError: vi.fn(), recordJobRun: vi.fn() }));
vi.mock('../server/driveOAuth', () => ({ appOrigin: () => 'https://crm.example.com', driveRequest: vi.fn(), DrivePending: class extends Error {} }));

const project = { id: 'p1', clientName: 'Estudio', serviceType: 'web', clientEmail: 'cliente@example.com' };
const request = vi.mocked(driveRequest);

describe('receta Web', () => {
  beforeEach(() => { vi.resetAllMocks(); process.env.GOOGLE_OAUTH_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64'); });
  it('valida el correo y respeta el servicio explícito', () => {
    expect(normalizeClientEmail(' Cliente@Example.com ')).toBe('cliente@example.com');
    expect(() => normalizeClientEmail('no-es-correo')).toThrow();
    expect(isWebProject({ serviceType: 'otro', projectType: 'web' })).toBe(false);
    expect(materialFolder('Fotos de obras')).toBe('proyectos');
    expect(materialFolder('Datos del dominio')).toBeUndefined();
  });
  it('cifra credenciales autenticadas y excluye secretos de respaldos', () => {
    const value = encryptDriveSecret('refresh-secreto');
    expect(value).not.toContain('refresh-secreto');
    expect(decryptDriveSecret(value)).toBe('refresh-secreto');
    process.env.GOOGLE_OAUTH_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString('base64');
    expect(() => decryptDriveSecret(value)).toThrow();
    expect(isPrivateIntegrationDocument('settings', 'integrations_private')).toBe(true);
    expect(isPrivateIntegrationDocument('settings', 'drive_oauth_abc')).toBe(true);
    expect(isPrivateIntegrationDocument('settings', 'automation')).toBe(false);
  });
  it('sin Drive crea panel y agenda, conserva pendientes y no duplica al reintentar', async () => {
    const { db, records } = memoryFirestore({ 'projects/p1': project });
    request.mockRejectedValue(new DrivePending('Conectá Drive'));
    await enrollWebProject(db, 'p1');
    const first = await executeWebRecipe(db, 'p1');
    const second = await executeWebRecipe(db, 'p1');
    expect(first.pending).toBe(true);
    expect(second.steps.drive_carpetas?.status).toBe('pendiente');
    expect(second.steps.tareas_plantilla?.status).toBe('ok');
    expect([...records.keys()].filter(k => k.startsWith('tasks/'))).toHaveLength(3);
    expect([...records.keys()].filter(k => k.startsWith('meetings/'))).toHaveLength(1);
    expect([...records.keys()].filter(k => k.startsWith('client_panels/'))).toHaveLength(1);
    expect(first.panelToken).toBe(second.panelToken);
    expect(records.get('meetings/auto_web_p1_arranque').proposed).toBe(true);
    expect(second.welcome).toContain('pendientes');
  });
  it('respeta un panel existente y las tareas editadas por el dueño', async () => {
    const { db, records } = memoryFirestore({ 'projects/p1': project,
      'client_panels/manual': { id: 'manual', projectId: 'p1', clientName: 'Estudio', token: 'a'.repeat(36), active: false, goals: [{ id: 'g1', text: 'Conservar' }], tasks: [], pieces: [], weekStart: '2026-10-19', createdAt: '2026-10-20' },
      'tasks/auto_web_p1_llamada': { title: 'Modificada', completed: true },
    });
    request.mockRejectedValue(new DrivePending('Drive pendiente'));
    await enrollWebProject(db, 'p1'); await executeWebRecipe(db, 'p1');
    expect(records.get('client_panels/manual').active).toBe(false);
    expect(records.get('client_panels/manual').goals[0].text).toBe('Conservar');
    expect(records.get('tasks/auto_web_p1_llamada')).toEqual({ title: 'Modificada', completed: true });
    expect([...records.keys()].some(k => k.startsWith('student_portals/'))).toBe(false);
  });
  it('serializa ejecuciones concurrentes del mismo proyecto', async () => {
    const { db } = memoryFirestore({ 'projects/p1': project }); await enrollWebProject(db, 'p1');
    await withProjectLease(db, 'p1', async () => { await expect(withProjectLease(db, 'p1', async () => {})).rejects.toThrow('en curso'); });
    await expect(withProjectLease(db, 'p1', async () => 'ok')).resolves.toBe('ok');
  });
  it('recupera carpeta creada aunque se haya perdido la respuesta', async () => {
    const { db } = memoryFirestore(); let created = false;
    request.mockImplementation(async (_db, path, method) => {
      if (path.startsWith('files/generateIds')) return { ids: ['folder_123456789'] };
      if (method === 'POST') { created = true; throw new Error('respuesta perdida'); }
      if (created) return { id: 'folder_123456789', mimeType: 'application/vnd.google-apps.folder' };
      throw Object.assign(new Error('404'), { status: 404 });
    });
    await expect(ensureFolder(db, 'folder', 'Identidad')).rejects.toThrow('perdida');
    expect(await ensureFolder(db, 'folder', 'Identidad')).toBe('folder_123456789');
    expect(request.mock.calls.filter(c => c[2] === 'POST')).toHaveLength(1);
  });
  it('no repite invitaciones y actualiza el rol cuando corresponde', async () => {
    request.mockResolvedValue({ permissions: [{ id: 'perm', emailAddress: project.clientEmail, role: 'writer' }] });
    const f: any = { id: 'folder', role: 'writer' };
    await shareFolder({} as any, f, project.clientEmail, 'writer');
    expect(request).toHaveBeenCalledTimes(1);
    await shareFolder({} as any, f, project.clientEmail, 'reader');
    expect(request.mock.calls.at(-1)?.[2]).toBe('PATCH');
  });
  it('solo publica carpetas compartidas y no expone datos internos', () => {
    const folders: any[] = [{ key: 'identidad', name: 'Identidad', role: 'writer', url: 'https://drive.google.com/x', status: 'compartida', id: 'private', sharedWith: project.clientEmail }, { key: 'textos', status: 'creada' }];
    expect(publicFolders(folders)).toEqual([{ key: 'identidad', name: 'Identidad', role: 'writer', url: 'https://drive.google.com/x' }]);
    expect(welcomeMessage('Ana', 'https://panel', folders)).not.toContain('private');
  });
  it('crea seguimiento una vez con fechas relativas a Publicada', async () => {
    const { db, records } = memoryFirestore({ 'automation_runs/web_p1': { projectId: 'p1', clientName: 'Estudio', panelId: 'web_p1', publishedAt: '2026-10-25', steps: {} }, 'client_panels/web_p1': { web: { stage: 'publicada' } } });
    await ensureWebFollowup(db, 'p1'); await ensureWebFollowup(db, 'p1');
    expect(records.get('tasks/auto_web_p1_seguimiento_30').date).toBe('2026-11-24');
    expect(records.get('tasks/auto_web_p1_seguimiento_90').date).toBe('2027-01-23');
    expect([...records.keys()].filter(k => k.startsWith('tasks/'))).toHaveLength(2);
  });
  it('recupera una copia cuya respuesta se perdió sin copiar otra vez', async () => {
    const { db } = memoryFirestore(); let copied = false;
    request.mockImplementation(async (_db, path, method) => {
      if (path.includes('/copy')) { copied = true; throw new Error('respuesta perdida'); }
      if (path.startsWith('files?q')) return { files: copied ? [{ id: 'copy' }] : [] };
      return { id: 'source', name: 'Entrega.pdf', mimeType: 'application/pdf', parents: ['old'] };
    });
    await expect(deliverFile(db, 'p1', 'source', 'dest', 'copy')).rejects.toThrow('perdida');
    await deliverFile(db, 'p1', 'source', 'dest', 'copy');
    await deliverFile(db, 'p1', 'source', 'dest', 'copy');
    expect(request.mock.calls.filter(c => c[1].includes('/copy'))).toHaveLength(1);
  });
  it('completa carpetas, permisos y links en un segundo intento', async () => {
    const { db, records } = memoryFirestore({ 'projects/p1': project });
    const files = new Set<string>(); let id = 0;
    request.mockRejectedValue(new DrivePending('Drive pendiente'));
    await enrollWebProject(db, 'p1'); await executeWebRecipe(db, 'p1');
    request.mockImplementation(async (_db, path, method, body: any) => {
      if (path.startsWith('files/generateIds')) return { ids: [`folder_${++id}_long_id`] };
      if (path.includes('/permissions')) return method === 'POST' ? { id: 'perm' } : { permissions: [] };
      if (method === 'POST') { files.add(body.id); return { id: body.id }; }
      if (files.has(path.split('/')[1].split('?')[0])) return { mimeType: 'application/vnd.google-apps.folder' };
      throw Object.assign(new Error('404'), { status: 404 });
    });
    const run = await executeWebRecipe(db, 'p1');
    expect(run.pending).toBe(false);
    expect(run.folders).toHaveLength(WEB_FOLDERS.length);
    const snapshot = records.get(`student_portals/panel_${run.panelToken}`);
    expect(snapshot.driveFolders).toHaveLength(4);
    expect(snapshot.web.materials[0].driveFolderUrl).toContain('https://drive.google.com/');
    expect(snapshot.driveFolders.at(-1).role).toBe('reader');
  });
});
