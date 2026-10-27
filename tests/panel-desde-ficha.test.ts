import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ records: new Map<string, any>(), matches: [] as any[] }));
vi.mock('../src/firebase', () => ({ db: {} }));
vi.mock('../src/utils/firestoreService', () => ({ deepSanitize: (x: any) => JSON.parse(JSON.stringify(x)) }));
vi.mock('../src/content/assets', () => ({ deletePublicAssets: vi.fn(), putPublicAsset: vi.fn() }));
vi.mock('../src/content/store', () => ({ toJpeg: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), onSnapshot: vi.fn(), deleteDoc: vi.fn(), writeBatch: vi.fn(),
  doc: (_db: any, col: string, id: string) => ({ id, path: `${col}/${id}` }),
  getDocs: async () => ({ docs: state.matches }),
  runTransaction: async (_db: any, work: any) => work({
    get: async (ref: any) => ({ exists: () => state.records.has(ref.path), data: () => state.records.get(ref.path) }),
    set: (ref: any, value: any) => state.records.set(ref.path, value),
  }),
}));
import { ensureProjectPanel } from '../src/panels/store';
const project = { id: 'p1', clientName: 'Prueba', serviceType: 'web' } as any;
beforeEach(() => { state.records.clear(); state.matches = []; });
describe('panel accesible desde la ficha', () => {
  it('permite crear sin Drive y reabrir sin duplicar el panel ni su enlace', async () => {
    const first = await ensureProjectPanel(project);
    const second = await ensureProjectPanel(project);
    expect(second.token).toBe(first.token);
    expect(state.records.size).toBe(2);
    expect(first.web?.stage).toBe('brief');
    expect(state.records.get(`student_portals/panel_${first.token}`).clientName).toBe('Prueba');
  });
  it('reutiliza un panel manual sin reactivarlo ni reemplazar su contenido', async () => {
    const ref = { id: 'manual', path: 'client_panels/manual' };
    const original = { id: 'manual', projectId: 'p1', active: false, token: 'original', tasks: [{ id: 't1' }] };
    state.records.set(ref.path, original);
    state.matches = [{ ref }];
    expect(await ensureProjectPanel(project)).toEqual(original);
    expect(state.records.size).toBe(1);
  });
});
