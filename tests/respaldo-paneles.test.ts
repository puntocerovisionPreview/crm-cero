import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ writes: [] as any[], getDocs: vi.fn(async (name: string) => ({ forEach: (cb: any) => cb({ id: 'documento', data: () => ({ source: name }) }) })) }));
vi.mock('../src/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  doc: (_db: unknown, name: string, id: string) => `${name}/${id}`,
  getDocs: mocks.getDocs,
  writeBatch: () => ({ set: (...args: any[]) => mocks.writes.push(args), commit: async () => undefined }),
}));
import { exportCompleteCrmBackup, importCompleteCrmBackup } from '../src/utils/firestoreService';

describe('respaldo del trabajo compartido con clientes', () => {
  it('exporta contenido, archivos y paneles, y permite restaurarlos con sus IDs', async () => {
    const backup = await exportCompleteCrmBackup();
    for (const name of ['content_pieces', 'content_assets', 'client_panels'] as const) {
      expect(backup.collections?.[name]?.documento.source).toBe(name);
    }
    await importCompleteCrmBackup(backup);
    for (const name of ['content_pieces', 'content_assets', 'client_panels']) {
      expect(mocks.writes).toContainEqual([`${name}/documento`, { source: name }, { merge: true }]);
    }
  });
});
