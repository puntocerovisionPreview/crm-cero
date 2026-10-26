import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryFirestore } from './helpers/memoryFirestore';
import { registerWebAutomationRoutes } from '../server/webAutomationRoutes';
import { driveRequest } from '../server/driveOAuth';
import { deliverFile } from '../server/driveFiles';
import { recordError } from '../server/health';
vi.mock('../server/health', () => ({ recordError: vi.fn(), recordJobRun: vi.fn() }));
vi.mock('../server/driveOAuth', () => ({ driveRequest: vi.fn(), driveClient: vi.fn(), DrivePending: class extends Error {} }));
vi.mock('../server/driveFiles', () => ({ deliverFile: vi.fn(), ensureFolder: vi.fn(), shareFolder: vi.fn() }));

function fixture() {
  const { db, records } = memoryFirestore({
    'projects/p1': { serviceType: 'web' },
    'automation_runs/web_p1': { projectId: 'p1', panelId: 'panel1', folders: [{ key: 'entregables', id: 'destination_1234', status: 'compartida', name: 'Entregables' }] },
    'client_panels/panel1': { web: { stage: 'publicada' } },
  });
  const routes: Record<string, any> = {};
  const app: any = { use: vi.fn(), get: (path: string, handler: any) => { routes[path] = handler; }, post: (path: string, handler: any) => { routes[path] = handler; } };
  registerWebAutomationRoutes(app, (_req, _res, next) => next(), () => db, async () => {});
  const call = async (suffix: string, body: any) => {
    const res: any = { statusCode: 200, body: null, status(code: number) { this.statusCode = code; return this; }, json(data: any) { this.body = data; return this; } };
    await routes[`/api/web-automation/:id/${suffix}`]({ params: { id: 'p1' }, body }, res);
    return res;
  };
  return { records, call };
}
describe('entrega con confirmación', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(driveRequest).mockResolvedValue({ id: 'file_123456789', name: 'Final.pdf', mimeType: 'application/pdf' }); });
  it('previsualizar no copia ni mueve; confirmar dos veces ejecuta una vez', async () => {
    const h = fixture();
    const preview = await h.call('delivery/preview', { fileIds: ['file_123456789'], mode: 'copy' });
    expect(preview.statusCode).toBe(200); expect(deliverFile).not.toHaveBeenCalled();
    expect(preview.body.files[0].name).toBe('Final.pdf');
    await h.call('delivery/confirm', { token: preview.body.token });
    await h.call('delivery/confirm', { token: preview.body.token });
    expect(deliverFile).toHaveBeenCalledTimes(1);
  });
  it('rechaza una confirmación vencida o con cambio de etapa', async () => {
    const h = fixture();
    const preview = await h.call('delivery/preview', { fileIds: ['file_123456789'], mode: 'move' });
    h.records.get('client_panels/panel1').web.stage = 'revision';
    expect((await h.call('delivery/confirm', { token: preview.body.token })).statusCode).toBe(400);
    expect(deliverFile).not.toHaveBeenCalled();
    h.records.get('client_panels/panel1').web.stage = 'publicada';
    for (const [key, value] of h.records) if (key.startsWith('automation_delivery/')) value.expires = 0;
    expect((await h.call('delivery/confirm', { token: preview.body.token })).statusCode).toBe(400);
  });
  it('registra el error de entrega y permite reintentar la confirmación', async () => {
    const h = fixture();
    const preview = await h.call('delivery/preview', { fileIds: ['file_123456789'], mode: 'copy' });
    vi.mocked(deliverFile).mockRejectedValueOnce(new Error('Drive no disponible'));
    expect((await h.call('delivery/confirm', { token: preview.body.token })).statusCode).toBe(400);
    expect(recordError).toHaveBeenCalled();
    expect([...h.records.values()].some(v => v.recipe === 'entrega_web' && v.status === 'error')).toBe(true);
    expect((await h.call('delivery/confirm', { token: preview.body.token })).statusCode).toBe(200);
    expect([...h.records.values()].some(v => v.recipe === 'entrega_web' && v.status === 'ok')).toBe(true);
  });
  it('rechaza parámetros inválidos y cambios de destinatario después de compartir', async () => {
    const h = fixture();
    expect((await h.call('delivery/preview', { fileIds: null, mode: 'copy' })).statusCode).toBe(400);
    expect((await h.call('delivery/preview', { fileIds: ['../../secret'], mode: 'move' })).statusCode).toBe(400);
    h.records.get('automation_runs/web_p1').folders[0].sharedWith = 'anterior@example.com';
    expect((await h.call('email', { email: 'nuevo@example.com' })).statusCode).toBe(400);
    expect(h.records.get('projects/p1').clientEmail).toBeUndefined();
  });
});
