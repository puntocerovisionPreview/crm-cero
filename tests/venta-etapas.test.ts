import { describe, expect, it } from 'vitest';
import { VENTA_ETAPAS, embudoDelMes, etapaDeLead, etapaDeProspecto } from '../src/utils/ventaEtapas';
import { prospectToProject } from '../src/prospecting/convert';

const pr = (id: string, over: any = {}) => ({ id, name: id, stage: 'contactado', createdAt: '2026-09-01', followUps: 0, ...over }) as any;
const todos = (n: number) => Object.fromEntries(VENTA_ETAPAS.find(e => e.n === n)!.checks.map(c => [c.id, true]));

describe('Paso a paso de venta', () => {
  it('son 9 etapas con su checklist', () => {
    expect(VENTA_ETAPAS.map(e => e.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(VENTA_ETAPAS.every(e => e.checks.length > 0)).toBe(true);
  });

  it('antes de la auditoría no hay etapa todavía', () => {
    expect(etapaDeProspecto(pr('a', { stage: 'respondio' })).n).toBe(0);
  });

  it('con la auditoría arranca en la 1 y avanza al tildar todo', () => {
    expect(etapaDeProspecto(pr('a', { stage: 'auditoria_completada' })).n).toBe(1);
    expect(etapaDeProspecto(pr('a', { stage: 'auditoria_completada', ventaChecks: todos(1) })).n).toBe(2);
  });

  it('la etapa del embudo pone el piso: llamada = preparar reunión, propuesta = etapa 7', () => {
    expect(etapaDeProspecto(pr('a', { stage: 'llamada' })).n).toBe(4);
    expect(etapaDeProspecto(pr('a', { stage: 'llamada', proposalSentAt: '2026-11-10' })).n).toBe(7);
    expect(etapaDeLead({ id: 'x', isLead: true } as any).n).toBe(7);
  });

  it('cuenta lo tildado de la etapa actual', () => {
    const e = etapaDeProspecto(pr('a', { stage: 'auditoria_completada', ventaChecks: { e1_score: true } }));
    expect(e).toMatchObject({ n: 1, hechos: 1, total: 3 });
  });
});

describe('Embudo del mes', () => {
  const month = '2026-11';
  const prospects = [pr('w', { interes: 'web' }), pr('p', { interes: 'paf' }), pr('s')];
  const ev = (prospectId: string, type: string, date = '2026-11-05') => ({ id: `${prospectId}${type}${date}`, prospectId, type, date, createdAt: date }) as any;

  it('separa en Web, PAF y sin definir, solo del mes', () => {
    const events = [
      ev('w', 'first_contact'), ev('p', 'first_contact'), ev('s', 'first_contact'), ev('p', 'first_contact', '2026-10-30'),
      ev('p', 'audit_completed'), ev('p', 'call'), ev('p', 'call_rescheduled'), ev('w', 'proposal_sent'),
    ];
    const e = embudoDelMes(events, prospects, [], month);
    expect(e.web).toMatchObject({ conversaciones: 1, propuestas: 1, auditorias: 0 });
    expect(e.paf).toMatchObject({ conversaciones: 1, auditorias: 1, reuniones: 1 });
    expect(e.sin.conversaciones).toBe(1);
  });

  it('cierres: clientes ganados o cargados en el mes, sin contar los posibles', () => {
    const projects = [
      { id: '1', projectType: 'web', createdAt: '2026-11-02T10:00:00Z' },
      { id: '2', serviceType: 'paf', createdAt: '2026-08-01', wonAt: '2026-11-12' },
      { id: '3', projectType: 'web', createdAt: '2026-11-03', isLead: true },
      { id: '4', projectType: 'web', createdAt: '2026-10-03' },
    ] as any[];
    const e = embudoDelMes([], [], projects, month);
    expect(e.web.cierres).toBe(1);
    expect(e.paf.cierres).toBe(1);
  });

  it('al ganar, el cliente nuevo queda como Web o PAF según lo elegido', () => {
    expect(prospectToProject(pr('w', { interes: 'web' }), '2026-11-17')).toMatchObject({ projectType: 'web', serviceType: 'web', wonAt: '2026-11-17' });
    expect(prospectToProject(pr('p'), '2026-11-17')).toMatchObject({ projectType: 'paf_pro', serviceType: 'paf' });
  });
});
