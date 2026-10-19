import { describe, expect, it } from 'vitest';
import { PAYMENT_PRESETS, agreementFromDoc, buildClauses, onboardingFromDoc, planAmounts, stepDueDate, stepWhen } from '../src/utils/contracts';

const doc = (over: any = {}) => ({
  id: 'doc_x',
  number: 7,
  clientName: 'Estudio Norte',
  contactName: 'Laura',
  currency: 'USD' as const,
  items: [{ description: 'Sitio web', quantity: 1, unitPrice: 1001 }],
  ...over,
});

describe('forma de pago', () => {
  it('los montos suman justo el total', () => {
    const steps = PAYMENT_PRESETS.find((p) => p.id === '3-cuotas')!.steps;
    const a = planAmounts(steps, 1001);
    expect(a.reduce((s, x) => s + x, 0)).toBe(1001);
    expect(planAmounts(PAYMENT_PRESETS[0].steps, 1001)).toEqual([501, 500]);
  });

  it('fechas: al firmar, contra entrega y a N días', () => {
    const [anticipo, entrega] = PAYMENT_PRESETS[0].steps;
    expect(stepDueDate(anticipo, '2026-10-18', 30)).toBe('2026-10-18');
    expect(stepDueDate(entrega, '2026-10-18', 30)).toBe('2026-11-17');
    expect(stepDueDate({ label: 'C2', percent: 50, due: 'dias', days: 30 }, '2026-10-18')).toBe('2026-11-17');
    expect(stepWhen(entrega)).toBe('contra entrega');
  });
});

describe('cláusulas', () => {
  it('web: plazo y rondas de ajustes; pesos: cláusula de ajuste', () => {
    const usd = buildClauses('web', { deliveryDays: 20, revisions: 2, currency: 'USD' });
    expect(usd.find((c) => c.title === 'Plazos y contenido')!.body).toContain('20 días hábiles');
    expect(usd.find((c) => c.title === 'Revisiones')!.body).toContain('2 rondas');
    expect(usd.some((c) => c.title.startsWith('Ajuste'))).toBe(false);
    expect(buildClauses('web', { deliveryDays: 20, revisions: 1, currency: 'ARS' }).some((c) => c.title.startsWith('Ajuste'))).toBe(true);
  });

  it('PAF: duración y cancelación', () => {
    const paf = buildClauses('paf', { deliveryDays: 90, revisions: 0, currency: 'USD' });
    expect(paf.find((c) => c.title === 'Duración y sesiones')!.body).toContain('90 días');
    expect(paf.some((c) => c.title === 'Cancelación')).toBe(true);
  });
});

describe('al aceptar', () => {
  it('plan de cobro con la forma de pago elegida', () => {
    const a = agreementFromDoc(doc({ deliveryDays: 30, paymentPlan: PAYMENT_PRESETS[0].steps }), '2026-10-18');
    expect(a.type).toBe('hitos');
    expect(a.totalAmount).toBe(1001);
    expect(a.installments.map((i) => [i.dueDate, i.expectedAmount, i.status])).toEqual([
      ['2026-10-18', 501, 'pendiente'],
      ['2026-11-17', 500, 'futuro'],
    ]);
  });

  it('proyecto nuevo de web con tareas de arranque', () => {
    const { project, tasks } = onboardingFromDoc(doc({ service: 'web', phone: '+54 9 351', email: 'l@n.com' }), '2026-10-18', '2026-10-18T12:00:00Z');
    expect(project).toMatchObject({ clientName: 'Estudio Norte', status: 'En curso', projectType: 'web', clientEmail: 'l@n.com', montoAcordado: 1001, startDate: '2026-10-18' });
    expect(project.billingAgreement?.installments).toHaveLength(2);
    expect(tasks.map((t) => t.title)).toEqual(expect.arrayContaining([expect.stringContaining('Pedir contenido')]));
  });

  it('PAF: proyecto PAF y primera sesión', () => {
    const { project, tasks } = onboardingFromDoc(doc({ service: 'paf', paymentPlan: PAYMENT_PRESETS[2].steps }), '2026-10-18', '');
    expect(project.projectType).toBe('paf_pro');
    expect(project.billingAgreement?.installments).toHaveLength(3);
    expect(tasks[0].title).toContain('primera sesión');
  });
});
