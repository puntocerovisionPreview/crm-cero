import { describe, expect, it } from 'vitest';
import { recordatorioCobros, recordatorioPagos, recordatorioTareas } from '../src/automation/recordatorios';

const today = '2026-11-04';
const t = (x: object) => ({ id: Math.random().toString(36), title: 'T', date: today, completed: false, createdAt: '', ...x }) as any;
const f = (x: object) => ({ id: Math.random().toString(36), name: 'Hosting', category: 'hosting', amount: 10, currency: 'USD', billingCycle: 'mensual', active: true, createdAt: '', ...x }) as any;

describe('recordatorios de tareas durante el día', () => {
  it('a las 11, 14:30 y 17:30, con las importantes primero', () => {
    const tasks = [t({ title: 'Mandar presupuesto' }), t({ title: 'Llamar a Ana', priority: 'alta' }), t({ title: 'Hecha', completed: true })];
    expect(recordatorioTareas(tasks, today, 10 * 60)).toBeNull(); // antes de las 11, nada
    const r = recordatorioTareas(tasks, today, 11 * 60 + 5)!;
    expect(r.key).toBe(`tareas_${today}_11:00`);
    expect(r.title).toBe('te quedan 2 tareas de hoy');
    expect(r.body.split('\n')[0]).toBe('• 🔴 Llamar a Ana');
    expect(recordatorioTareas(tasks, today, 15 * 60)!.key).toBe(`tareas_${today}_14:30`);
    expect(recordatorioTareas(tasks, today, 18 * 60)!.title).toBe('Antes de cerrar el día: te quedan 2 tareas de hoy');
  });
  it('si no queda nada, no avisa', () => {
    expect(recordatorioTareas([t({ completed: true })], today, 11 * 60)).toBeNull();
  });
  it('avisa las atrasadas aunque hoy no haya nada', () => {
    expect(recordatorioTareas([t({ date: '2026-11-01' })], today, 11 * 60)!.title).toBe('Tenés 1 tarea atrasada');
  });
});

describe('recordatorios de pagos', () => {
  const pagos = [
    f({ name: 'Dominio', nextDueDate: '2026-11-02' }),
    f({ name: 'Claude', nextDueDate: today, autoRenew: true }),
    f({ name: 'Figma', nextDueDate: '2026-11-05' }),
    f({ name: 'Pausado', nextDueDate: '2026-11-01', active: false }),
  ];
  it('a la mañana: vencidos, de hoy y próximos', () => {
    const r = recordatorioPagos(pagos, today, 9 * 60)!;
    expect(r.key).toBe(`pagos_${today}_manana`);
    expect(r.title).toBe('💳 2 pagos vencidos o de hoy');
    expect(r.body).toContain('Dominio: US$ 10 · venció el 02/11');
    expect(r.body).toContain('Claude: US$ 10 (se debita solo: registralo igual)');
    expect(r.body).toContain('Figma: US$ 10 · mañana');
    expect(r.body).not.toContain('Pausado');
  });
  it('a la tarde: solo lo que sigue sin registrar', () => {
    const r = recordatorioPagos(pagos, today, 17 * 60)!;
    expect(r.key).toBe(`pagos_${today}_tarde`);
    expect(r.title.startsWith('💳 ¿Ya pagaste?')).toBe(true);
    expect(r.body).not.toContain('Figma');
  });
  it('registrado (vence el mes que viene) ya no avisa', () => {
    expect(recordatorioPagos([f({ nextDueDate: '2026-12-04' })], today, 9 * 60)).toBeNull();
    expect(recordatorioPagos(pagos, today, 14 * 60)).toBeNull(); // fuera de horario
  });
});

describe('recordatorio de cobros', () => {
  it('a las 10, con lo que vence hoy o está atrasado', () => {
    const data: any = { tasks: [], meetings: [], incomes: [], fixedExpenses: [], routine: [], projects: [{ id: 'p', clientName: 'Estudio Río', archived: false, montoAcordado: 100, estimatedCurrency: 'USD', installments: [{ id: 'c1', number: 1, totalInstallments: 1, amount: 100, currency: 'USD', dueDate: '2026-11-01', paid: false }] }] };
    const r = recordatorioCobros(data, today, 10 * 60 + 5)!;
    expect(r.key).toBe(`cobros_${today}`);
    expect(r.title).toBe('💰 Cobro de Estudio Río atrasado');
    expect(r.body).toContain('atrasado desde el 01/11');
    expect(recordatorioCobros(data, today, 9 * 60)).toBeNull();
  });
});
