import { describe, expect, it } from 'vitest';
import { docTitle, docTotal, nextNumber, publicCopy, receiptFromPayment, shareMessage } from '../src/utils/documents';
import { buildDayCloseNudge, buildMonthClose, buildTop3Section, buildWeeklyCollections } from '../src/automation/periodicMessages';

const hoy = '2026-10-19';

describe('Presupuestos y recibos', () => {
  const doc = {
    id: 'd1', token: 'abcdefghijkmnopqrs', kind: 'presupuesto', number: 7, clientName: 'Estudio Cane', contactName: 'Juan Cane', phone: '3515551234', email: 'juan@cane.com',
    items: [{ description: 'Sitio web', quantity: 1, unitPrice: 900 }, { description: 'Hosting anual', quantity: 1, unitPrice: 100 }],
    currency: 'USD', issueDate: hoy, studioName: 'Punto Cero', status: 'enviado', createdAt: '',
  } as any;

  it('total, número y título', () => {
    expect(docTotal(doc.items)).toBe(1000);
    expect(docTitle(doc)).toBe('Presupuesto N° 0007');
    expect(nextNumber([doc, { ...doc, kind: 'recibo', number: 3 }], 'presupuesto')).toBe(8);
    expect(nextNumber([], 'recibo')).toBe(1);
  });

  it('la copia pública no lleva teléfono, mail ni ids internos', () => {
    const pub = publicCopy(doc) as any;
    expect(pub.total).toBe(1000);
    expect(pub.phone).toBeUndefined();
    expect(pub.email).toBeUndefined();
    expect(pub.id).toBeUndefined();
  });

  it('recibo armado desde un pago', () => {
    const r = receiptFromPayment({ id: 'p1', clientName: 'Remodelante', ownerName: 'Martín', clientPhone: '351' } as any, { id: 'pay1', projectId: 'p1', amount: 370000, currency: 'ARS', date: hoy, method: 'transferencia' } as any, 4);
    expect(r).toMatchObject({ id: 'docr_pay1', kind: 'recibo', number: 4, currency: 'ARS', paymentDate: hoy, paymentId: 'pay1' });
    expect(docTotal(r.items)).toBe(370000);
    expect(r.token.length).toBeGreaterThanOrEqual(16);
  });

  it('mensaje para compartir', () => {
    expect(shareMessage(doc, 'https://x/doc/abc')).toContain('¡Hola Juan! Te paso el presupuesto: https://x/doc/abc');
  });
});

describe('Avisos periódicos', () => {
  const data = {
    tasks: [
      { id: 't1', title: 'Propuesta Cane', date: hoy, completed: false, priority: 'alta', createdAt: '' },
      { id: 't2', title: 'Hecha hoy', date: hoy, completed: true, completedAt: hoy, createdAt: '' },
    ],
    meetings: [],
    projects: [
      {
        id: 'p1', clientName: 'Remodelante', status: 'En curso', archived: false, notes: '', createdAt: '', updatedAt: '', estimatedPrice: 740000, estimatedCurrency: 'ARS',
        installments: [{ id: 'c1', number: 1, amount: 370000, dueDate: '2026-10-21', paid: false }, { id: 'c2', number: 2, amount: 370000, dueDate: '2026-12-21', paid: false }],
      },
      { id: 'p2', clientName: 'Cane', status: 'En curso', archived: false, notes: '', createdAt: '', updatedAt: '', payments: [{ id: 'x', amount: 200, currency: 'USD', date: '2026-09-10' }] },
    ],
    incomes: [],
    fixedExpenses: [],
    routine: [],
  } as any;

  it('tus 3 de hoy', () => {
    expect(buildTop3Section(data, hoy)).toContain('1. Propuesta Cane');
  });

  it('cobranza de la semana', () => {
    const t = buildWeeklyCollections(data, hoy)!;
    expect(t).toContain('Remodelante: $ 370.000');
    expect(t).toContain('vence 21/10');
  });

  it('cierre de mes habla del mes que terminó', () => {
    const t = buildMonthClose(data, '2026-10-01');
    expect(t).toContain('Cierre de septiembre 2026');
    expect(t).toContain('Falta facturar');
  });

  it('recordatorio de cerrar el día', () => {
    expect(buildDayCloseNudge(data, hoy)).toContain('Hoy terminaste 1 tarea y quedan 1 pendientes');
  });
});
