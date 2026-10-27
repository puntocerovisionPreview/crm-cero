import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ batches: [] as any[], reject: false }));
vi.mock('../src/firebase', () => ({ db: {} }));
vi.mock('../src/utils/firestoreService', () => ({ deepSanitize: (v: unknown) => JSON.parse(JSON.stringify(v)) }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, coll: string, id: string) => coll + '/' + id,
  collection: vi.fn(), onSnapshot: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn(),
  arrayUnion: (v: unknown) => ({ union: v }), arrayRemove: (v: unknown) => ({ remove: v }),
  writeBatch: () => { const b = { set: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => { if (mocks.reject) throw new Error('Sin conexión'); }) }; mocks.batches.push(b); return b; },
}));
import { recordProspectAction, recordWithUndo } from '../src/prospecting/store';
import { DEFAULT_PROSPECTING_SETTINGS, computeMonthMetrics } from '../src/prospecting/core';
const prospect = { id: 'p1', name: 'Juan', studio: 'Estudio Uno', stage: 'respondio', followUps: 0, createdAt: '2026-10-24', convStep: 'pregunta' } as any;
beforeEach(() => { mocks.batches.length = 0; mocks.reject = false; });
describe('guardado diario y deshacer', () => {
  it('guarda el mensaje de guion y la bitácora con la misma hora, sin inflar métricas', async () => {
    await recordProspectAction(prospect, 'conv_question_sent', '2026-10-24', DEFAULT_PROSPECTING_SETTINGS);
    const calls = mocks.batches[0].set.mock.calls;
    const project = calls.find((c: any[]) => c[0] === 'prospects/p1')[1];
    const ev = calls.find((c: any[]) => c[0].startsWith('prospect_events/'))[1];
    expect(ev.type).toBe('conversation_sent'); expect(ev.prospectName).toBe('Estudio Uno');
    expect(ev.createdAt).toBe(project.log.union.at);
    expect(computeMonthMetrics([ev], '2026-10').reduce((n, w) => n + w.conversacionesOut, 0)).toBe(0);
  });
  it('deshacer quita tanto el evento nuevo como la línea del historial', async () => {
    const undo = await recordWithUndo(prospect, 'i_replied', '2026-10-24', DEFAULT_PROSPECTING_SETTINGS);
    const saved = mocks.batches[0].set.mock.calls;
    const eventPath = saved.find((c: any[]) => c[0].startsWith('prospect_events/'))[0];
    await undo();
    expect(mocks.batches[1].delete).toHaveBeenCalledWith(eventPath);
    expect(mocks.batches[1].set.mock.calls[0][1].log.remove.action).toBe('i_replied');
    expect(mocks.batches[1].set.mock.calls[0][1].convStep).toBeUndefined();
  });
  it('no confirma una acción cuando falla la escritura', async () => {
    mocks.reject = true;
    await expect(recordProspectAction(prospect, 'i_replied', '2026-10-24', DEFAULT_PROSPECTING_SETTINGS)).rejects.toThrow('Sin conexión');
  });
});
