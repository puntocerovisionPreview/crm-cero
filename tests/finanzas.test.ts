import { describe, expect, it } from 'vitest';
import { getCollectedEntries, sumByCurrency, monthMatcher } from '../src/utils/ledger';
import { reconcileCommitments, calculateProjectBilling } from '../src/utils/paymentPlans';
import { calculateMonthlyCashProjection } from '../src/utils/monthlyCashProjection';
import { findDataIssues } from '../src/utils/dataReview';

const project = (over: any = {}) =>
  ({
    id: 'p1',
    clientName: 'Multiservicios',
    status: 'En curso',
    notes: '',
    archived: false,
    createdAt: '2026-08-01',
    updatedAt: '2026-08-01',
    estimatedPrice: 650,
    estimatedCurrency: 'USD',
    projectType: 'web',
    ...over,
  }) as any;

describe('libro único de cobros', () => {
  it('no cuenta dos veces un pago que ya tiene su ingreso', () => {
    const incomes = [{ id: 'inc1', status: 'cobrado', amount: 325, currency: 'USD', date: '2026-10-03', month: '2026-10', paymentId: 'pay1', projectId: 'p1' }] as any;
    const projects = [project({ payments: [{ id: 'pay1', amount: 325, currency: 'USD', date: '2026-10-03', incomeRecordId: 'inc1' }] })];
    const total = sumByCurrency(getCollectedEntries(incomes, projects, monthMatcher('2026-10')));
    expect(total).toEqual({ ARS: 0, USD: 325 });
  });

  it('suma pagos viejos sin ingreso y también los de proyectos archivados', () => {
    const projects = [project({ archived: true, payments: [{ id: 'pay9', amount: 100, currency: 'ARS', date: '2026-09-10' }] })];
    const total = sumByCurrency(getCollectedEntries([], projects, monthMatcher('2026-09')));
    expect(total.ARS).toBe(100);
  });
});

describe('compromisos de pago', () => {
  const cmt = (createdIso: string, due: string, amount: number) =>
    ({ id: `cmt_${Date.parse(createdIso)}_x`, title: 'Saldo', dueDate: due, amount, status: 'pendiente' }) as any;

  it('si el proyecto está saldado, todos quedan cobrados', () => {
    const out = reconcileCommitments([cmt('2026-09-30T12:00:00', '2026-10-03', 162)], [], 0);
    expect(out[0].status).toBe('cobrado');
  });

  it('un pago anterior al compromiso no lo salda; uno posterior sí', () => {
    const payments = [
      { id: 'a', amount: 500, date: '2026-09-20' },
      { id: 'b', amount: 60, date: '2026-10-02' },
    ] as any;
    const out = reconcileCommitments([cmt('2026-10-01T12:00:00', '2026-10-05', 100)], payments, 40);
    expect(out[0].status).toBe('parcial');
    expect(out[0].amountPaid).toBe(60);
  });

  it('el caso Multiservicios: saldo cubierto, sin deuda', () => {
    const p = project({
      payments: [
        { id: 'p1', amount: 163, currency: 'USD', date: '2026-09-30' },
        { id: 'p2', amount: 325, currency: 'USD', date: '2026-10-03' },
        { id: 'p3', amount: 162, currency: 'USD', date: '2026-10-13' },
      ],
      paymentCommitments: [cmt('2026-09-30T12:00:00', '2026-10-03', 162)],
    });
    const b = calculateProjectBilling(p, []);
    expect(b.saldoPendiente).toBe(0);
    expect(b.isOverdue).toBe(false);
    expect(b.commitments.every((c) => c.status === 'cobrado')).toBe(true);
  });
});

describe('proyección mensual', () => {
  const fixed = [
    { id: 'f1', name: 'Monotributo', amount: 70000, currency: 'ARS', billingCycle: 'mensual', nextDueDate: '2026-10-20', active: true },
    { id: 'f2', name: 'Dominio', amount: 15, currency: 'USD', billingCycle: 'anual', nextDueDate: '2027-03-01', active: true },
  ] as any;

  it('descuenta los gastos fijos del mes que no están registrados', () => {
    const r = calculateMonthlyCashProjection({ monthKey: '2026-10', incomes: [], projects: [], expenses: [], fixedExpenses: fixed, usdRate: 1500 });
    expect(r.gastosFijosARS).toBe(70000);
    expect(r.gastosFijosUSD).toBe(0); // el dominio anual no vence este mes
    expect(r.netoARS).toBe(-70000);
  });

  it('no cuenta dos veces un gasto fijo ya registrado como gasto', () => {
    const expenses = [{ id: 'e1', title: 'Renovación: Monotributo (mensual)', amount: 70000, currency: 'ARS', date: '2026-10-20', month: '2026-10', status: 'pagado', fixedExpenseId: 'f1' }] as any;
    const r = calculateMonthlyCashProjection({ monthKey: '2026-10', incomes: [], projects: [], expenses, fixedExpenses: fixed, usdRate: 1500 });
    expect(r.gastosARS).toBe(70000);
    expect(r.gastosFijosARS).toBe(0);
  });
});

describe('revisión de datos', () => {
  it('detecta cobro de más y pagos repetidos', () => {
    const p = project({
      payments: [
        { id: 'x1', amount: 650, currency: 'USD', date: '2026-10-13' },
        { id: 'x2', amount: 650, currency: 'USD', date: '2026-10-14' },
      ],
    });
    const kinds = findDataIssues([p], []).map((i) => i.kind).sort();
    expect(kinds).toEqual(['cobrado_de_mas', 'pago_duplicado']);
  });
});

import { suggestProjectForPayment, describeNewPayment } from '../server/mercadopago';

describe('Mercado Pago: a qué cliente corresponde un pago', () => {
  const remodelante = { id: 'r', clientName: 'Remodelante', ownerName: 'Martín Gómez', estimatedPrice: 1110000, estimatedCurrency: 'ARS', status: 'En curso', archived: false, createdAt: '2026-10-01', updatedAt: '2026-10-01', notes: '', installments: [
    { id: 'c1', number: 1, amount: 370000, dueDate: '2026-10-01', paid: true, paidAt: '2026-10-01' },
    { id: 'c2', number: 2, amount: 370000, dueDate: '2026-11-01', paid: false },
    { id: 'c3', number: 3, amount: 370000, dueDate: '2026-12-01', paid: false },
  ], payments: [{ id: 'p1', amount: 370000, currency: 'ARS', date: '2026-10-01' }] } as any;
  const claudio = { ...remodelante, id: 'c', clientName: 'Claudio', ownerName: '', estimatedPrice: 465000, installments: [], payments: [{ id: 'q', amount: 232500, currency: 'ARS', date: '2026-09-28' }] } as any;

  it('monto igual a una cuota pendiente + nombre del pagador = sugerencia fuerte', () => {
    const s = suggestProjectForPayment({ amount: 370000, currency: 'ARS', payerName: 'Martin Gomez' }, [remodelante, claudio], []);
    expect(s?.projectId).toBe('r');
    expect(s?.score).toBe(100);
  });

  it('solo el monto (el saldo pendiente de Claudio) alcanza para sugerir', () => {
    const s = suggestProjectForPayment({ amount: 232500, currency: 'ARS', payerName: 'Otra Persona' }, [remodelante, claudio], []);
    expect(s?.projectId).toBe('c');
  });

  it('sin coincidencias no inventa un cliente', () => {
    expect(suggestProjectForPayment({ amount: 1234, currency: 'ARS', payerName: 'Nadie' }, [remodelante, claudio], [])).toBeNull();
  });

  it('el aviso pregunta por el cliente sugerido', () => {
    const n = describeNewPayment({ amount: 370000, currency: 'ARS', payerName: 'Martin Gomez', suggestion: { projectId: 'r', clientName: 'Remodelante', reason: 'el monto coincide', score: 100 } });
    expect(n.title).toBe('Te entró un pago de $ 370.000');
    expect(n.body).toContain('¿Es de Remodelante?');
  });
});

import { paymentDirection } from '../server/mercadopago';

describe('Mercado Pago: recibido o enviado', () => {
  const me = { id: '111', email: 'yo@mail.com' };

  it('si el cobrador soy yo, es un cobro recibido', () => {
    expect(paymentDirection({ collector_id: 111, payer: { id: 999, email: 'cliente@mail.com' } }, me)).toBe('recibido');
  });

  it('si el pagador soy yo, es un pago que hice', () => {
    expect(paymentDirection({ collector_id: 555, payer: { id: 111 } }, me)).toBe('enviado');
    expect(paymentDirection({ payer: { email: 'YO@mail.com' } }, me)).toBe('enviado');
  });

  it('cobrador de otra cuenta = enviado aunque falte el pagador', () => {
    expect(paymentDirection({ collector_id: 555 }, me)).toBe('enviado');
  });

  it('el aviso de un pago propio no dice "te entró"', () => {
    const n = describeNewPayment({ amount: 15000, currency: 'ARS', direction: 'enviado', description: 'Hosting' });
    expect(n.title).toBe('Pagaste $ 15.000');
  });
});

import { compareMpNewestFirst } from '../src/utils/firestoreService';

describe('Mercado Pago: orden de la bandeja', () => {
  const p = (id: string, dateCreated: string, dateTime?: string) => ({ id, mpPaymentId: id, dateCreated, dateTime } as any);
  it('el más reciente primero, aunque sean del mismo día', () => {
    const list = [p('1', '2026-10-17', '2026-10-17T09:00:00-03:00'), p('2', '2026-10-17', '2026-10-17T18:30:00-03:00'), p('3', '2026-10-16', '2026-10-16T22:00:00-03:00')];
    expect(list.sort(compareMpNewestFirst).map((x) => x.id)).toEqual(['2', '1', '3']);
  });
  it('sin hora guardada, desempata por número de pago', () => {
    const list = [p('100', '2026-10-17'), p('300', '2026-10-17'), p('200', '2026-10-17')];
    expect(list.sort(compareMpNewestFirst).map((x) => x.id)).toEqual(['300', '200', '100']);
  });
});
