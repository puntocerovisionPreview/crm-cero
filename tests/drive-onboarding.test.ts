import { describe, expect, it } from 'vitest';
import { memoryFirestore } from './helpers/memoryFirestore';
import { onboardAcceptedDocument } from '../server/contractsServer';

describe('presupuesto Web aceptado', () => {
  const document = { kind: 'presupuesto', status: 'aceptado', service: 'web', clientName: 'Estudio', email: 'cliente@example.com', number: 1, currency: 'USD', items: [{ description: 'Web', quantity: 1, unitPrice: 1000 }] };
  it('dos aceptaciones concurrentes crean un solo proyecto y encolan la receta', async () => {
    const { db, records } = memoryFirestore({ 'documents/d1': document });
    const ids = await Promise.all([onboardAcceptedDocument(db, db.collection('documents').doc('d1')), onboardAcceptedDocument(db, db.collection('documents').doc('d1'))]);
    expect(ids[0]).toBe(ids[1]);
    expect([...records.keys()].filter(k => k.startsWith('projects/'))).toHaveLength(1);
    expect(records.get(`projects/${ids[0]}`).webAutomationRequested).toBe(true);
    expect([...records.keys()].filter(k => k.startsWith('tasks/'))).toHaveLength(0);
  });
  it('no inicia una receta para un presupuesto todavía no aceptado', async () => {
    const { db, records } = memoryFirestore({ 'documents/d1': { ...document, status: 'enviado' } });
    expect(await onboardAcceptedDocument(db, db.collection('documents').doc('d1'))).toBeNull();
    expect(records.size).toBe(1);
  });
});
