import { describe, expect, it } from 'vitest';
import { addMonthsKeepDay, buildNewClientProject, splitAmount, validateNewClient, type NewClientForm } from '../src/utils/newClient';
import { portalFromProject } from '../src/portal/model';

const base: NewClientForm = {
  tipo: 'paf', plan: 'paf_pro', estudio: ' Estudio Uno ', contacto: 'Ana', email: 'Ana@Estudio.com', whatsapp: '11 2345 6789',
  monto: 1200, moneda: 'USD', modo: 'cuotas', primerCobro: '2026-11-10', cuotas: 3, nota: 'Cliente referido',
};
const NOW = new Date('2026-11-03T12:00:00');

describe('alta en una pantalla: precio libre', () => {
  it('cuotas: reparte justo y una por mes', () => {
    expect(splitAmount(1000, 3)).toEqual([333.33, 333.33, 333.34]);
    expect(addMonthsKeepDay('2026-01-31', 1)).toBe('2026-02-28');
    const p = buildNewClientProject(base, NOW);
    expect(p.installments?.map((i) => [i.dueDate, i.amount])).toEqual([['2026-11-10', 400], ['2026-12-10', 400], ['2027-01-10', 400]]);
    expect(p.montoAcordado).toBe(1200);
    expect(p.estimatedCurrency).toBe('USD');
    expect(p.clientEmail).toBe('ana@estudio.com');
    expect(p.projectType).toBe('paf_pro');
  });

  it('pago único: una sola fecha', () => {
    const p = buildNewClientProject({ ...base, modo: 'unico' }, NOW);
    expect(p.installments).toHaveLength(1);
    expect(p.billingAgreement?.type).toBe('unico');
  });

  it('caso pedido: mensual de 400, moneda elegida, sin fecha de fin', () => {
    const p = buildNewClientProject({ ...base, tipo: 'web', monto: 400, moneda: 'ARS', modo: 'mensual', meses: undefined }, NOW);
    expect(p.recurringPlans).toEqual([expect.objectContaining({ amount: 400, currency: 'ARS', frequency: 'mensual', startDate: '2026-11-10', nextDueDate: '2026-11-10', active: true })]);
    expect(p.installments).toBeUndefined();
    expect(p.billingAgreement).toMatchObject({ type: 'retainer', monthlyAmount: 400, currency: 'ARS' });
    expect(p.billingAgreement?.endDate).toBeUndefined();
    expect(p.montoAcordado).toBeUndefined();
  });

  it('mensual con duración: un cobro por mes y total = meses x monto', () => {
    const p = buildNewClientProject({ ...base, monto: 400, modo: 'mensual', meses: 6 }, NOW);
    expect(p.installments).toHaveLength(6);
    expect(p.montoAcordado).toBe(2400);
    expect(p.recurringPlans).toBeUndefined();
  });

  it('valida lo mínimo: estudio, correo para PAF y fechas', () => {
    expect(validateNewClient({ ...base, estudio: '', email: '' })).toHaveLength(2);
    expect(validateNewClient({ ...base, tipo: 'web', email: '' })).toEqual([]);
    expect(validateNewClient({ ...base, modo: 'cuotas', cuotas: 1 })[0]).toContain('cuotas');
  });

  it('los montos y la nota interna nunca llegan al portal del cliente', () => {
    const p = { ...buildNewClientProject({ ...base, monto: 400, modo: 'mensual' }, NOW), id: 'p1', pafClienteId: 'PAF-002', pafPortal: { emails: ['ana@estudio.com'], hito: 1, resumen: '', enlaces: {} } };
    const r = portalFromProject(p as any, []);
    if (!('doc' in r)) throw new Error(r.errors.join());
    const json = JSON.stringify(r.doc).toLowerCase();
    for (const k of ['400', 'retainer', 'recurring', 'installments', 'amount', 'cliente referido']) expect(json).not.toContain(k);
  });
});
