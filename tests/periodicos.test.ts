import { describe, expect, it } from 'vitest';
import { collectionMessage, monthClose, pafReport, pickTop3, prospectingWeek, weekBounds, weekSummary, weeklyCollections } from '../src/utils/periodic';

const hoy = '2026-10-18'; // domingo
const task = (id: string, over: any = {}) => ({ id, title: id, date: hoy, completed: false, createdAt: '', ...over }) as any;

describe('Tus 3 del día', () => {
  it('elige por prioridad y atraso, solo hasta hoy', () => {
    const top = pickTop3(
      [
        task('baja', { priority: 'baja' }),
        task('alta', { priority: 'alta' }),
        task('atrasada', { priority: 'media', date: '2026-10-10' }),
        task('manana', { priority: 'alta', date: '2026-10-19' }),
        task('hecha', { priority: 'alta', completed: true }),
        task('media', { priority: 'media' }),
      ],
      hoy
    );
    expect(top.map((t) => t.id)).toEqual(['atrasada', 'alta', 'media']);
  });
});

describe('Cobranza de la semana', () => {
  const project = {
    id: 'p1', clientName: 'Remodelante', ownerName: 'Martín Gómez', clientPhone: '351 555 1234', status: 'En curso', archived: false, notes: '', createdAt: '2026-08-01', updatedAt: '',
    estimatedPrice: 1110000, estimatedCurrency: 'ARS',
    installments: [
      { id: 'c1', number: 1, amount: 370000, dueDate: '2026-10-01', paid: true, paidAt: '2026-10-01' },
      { id: 'c2', number: 2, amount: 370000, dueDate: '2026-10-22', paid: false },
      { id: 'c3', number: 3, amount: 370000, dueDate: '2026-12-01', paid: false },
    ],
    payments: [{ id: 'p', projectId: 'p1', amount: 370000, currency: 'ARS', date: '2026-10-01', method: 'transferencia' }],
  } as any;

  it('trae lo que vence en los próximos 7 días y no lo lejano', () => {
    const items = weeklyCollections([project], [], hoy);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ dueDate: '2026-10-22', amount: 370000, currency: 'ARS', daysLate: 0 });
  });

  it('arma el mensaje con los datos de cobro', () => {
    const [item] = weeklyCollections([project], [], hoy);
    const msg = collectionMessage(item, { aliasArs: 'punto.cero.mp', accountHolder: 'Juan' });
    expect(msg).toContain('¡Hola Martín!');
    expect(msg).toContain('vence');
    expect(msg).toContain('$ 370.000');
    expect(msg).toContain('Alias: punto.cero.mp');
  });
});

describe('Semana', () => {
  it('lunes a domingo', () => {
    expect(weekBounds(hoy)).toEqual({ start: '2026-10-12', end: '2026-10-18' });
    expect(weekBounds(hoy, -1)).toEqual({ start: '2026-10-05', end: '2026-10-11' });
  });

  it('cuenta lo hecho en la semana y lista lo atrasado', () => {
    const s = weekSummary(
      {
        tasks: [task('a', { completed: true, completedAt: '2026-10-14' }), task('b', { completed: true, completedAt: '2026-10-02' }), task('c', { date: '2026-10-15' })],
        meetings: [{ id: 'm', title: 'x', date: '2026-10-13', completed: true, createdAt: '' } as any],
        projects: [],
        incomes: [],
        events: [{ id: 'e', prospectId: 'p', type: 'first_contact', date: '2026-10-16', createdAt: '' } as any],
      },
      hoy
    );
    expect(s).toMatchObject({ tareasHechas: 1, reunionesHechas: 1, contactos: 1 });
    expect(s.atrasadas.map((t) => t.id)).toEqual(['c']);
  });

  it('números de prospección por semana', () => {
    const ev = (type: string, date: string) => ({ id: type + date, prospectId: 'p', type, date, createdAt: '' }) as any;
    const w = prospectingWeek([ev('first_contact', '2026-10-13'), ev('first_contact', '2026-10-14'), ev('reply', '2026-10-15'), ev('first_contact', '2026-10-06')], hoy);
    expect(w).toMatchObject({ contactos: 2, respuestas: 1 });
    expect(prospectingWeek([ev('first_contact', '2026-10-06')], hoy, -1).contactos).toBe(1);
  });
});

describe('Alumnos PAF', () => {
  it('avisa quién lleva 10 días o más sin sesión y sin próxima agendada', () => {
    const base = { status: 'En curso', archived: false, serviceType: 'paf', notes: '', createdAt: '', updatedAt: '' };
    const rows = pafReport(
      [
        { ...base, id: 'a', clientName: 'Ana', consultingSessions: [{ id: 's', date: '2026-10-01', durationHours: 1.5 }], pafMilestones: [{ id: 'h', completed: true }, { id: 'h2', completed: false }], pafConsultingHoursTotal: 26 },
        { ...base, id: 'b', clientName: 'Beto', consultingSessions: [{ id: 's', date: '2026-10-15', durationHours: 1 }] },
      ] as any,
      [],
      hoy
    );
    expect(rows[0]).toMatchObject({ alert: true, daysSinceSession: 17, hitos: { done: 1, total: 2 }, horas: { done: 1.5, total: 26 } });
    expect(rows[1].alert).toBe(false);
  });
});

describe('Cierre de mes', () => {
  it('cobrado, gastos, pagos sin facturar y renovaciones de los próximos 30 días', () => {
    const r = monthClose(
      {
        projects: [{ id: 'p', clientName: 'Cane', archived: false, payments: [{ id: 'x', amount: 500, currency: 'USD', date: '2026-10-05' }, { id: 'y', amount: 100, currency: 'USD', date: '2026-10-06', invoiced: true }] } as any],
        incomes: [],
        expenses: [{ id: 'e', title: 'Hosting', amount: 20000, currency: 'ARS', date: '2026-10-03', month: '2026-10', status: 'pagado', category: 'Otros', createdAt: '' } as any],
        fixedExpenses: [
          { id: 'f1', name: 'Dominio', amount: 15, currency: 'USD', billingCycle: 'anual', nextDueDate: '2026-11-01', active: true } as any,
          { id: 'f2', name: 'Lejano', amount: 15, currency: 'USD', billingCycle: 'anual', nextDueDate: '2027-03-01', active: true } as any,
        ],
      },
      hoy
    );
    expect(r.cobrado.USD).toBe(600);
    expect(r.gastos.ARS).toBe(20000);
    expect(r.sinFacturar).toHaveLength(1);
    expect(r.renovaciones.map((f) => f.id)).toEqual(['f1']);
  });
});
