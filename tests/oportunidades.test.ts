import { describe, expect, it } from 'vitest';
import { buildPipeline, openTotals, prospectColumn } from '../src/utils/pipeline';

const pr = (id: string, over: any = {}) => ({ id, name: id, stage: 'contactado', createdAt: '2026-09-01', followUps: 0, ...over }) as any;
const hoy = '2026-10-18';

describe('Tablero de oportunidades', () => {
  it('ubica cada prospecto según su etapa', () => {
    expect(prospectColumn(pr('a', { stage: 'respondio' }), '2026-10')).toBe('conversacion');
    expect(prospectColumn(pr('b', { stage: 'llamada' }), '2026-10')).toBe('llamada');
    expect(prospectColumn(pr('c', { stage: 'llamada', proposalSentAt: '2026-10-10' }), '2026-10')).toBe('propuesta');
    expect(prospectColumn(pr('d', { stage: 'contactado' }), '2026-10')).toBeNull();
  });

  it('ganados y perdidos solo del mes actual', () => {
    expect(prospectColumn(pr('e', { stage: 'cliente', updatedAt: '2026-10-05T10:00:00Z' }), '2026-10')).toBe('ganado');
    expect(prospectColumn(pr('f', { stage: 'cliente', updatedAt: '2026-09-05T10:00:00Z' }), '2026-10')).toBeNull();
    expect(prospectColumn(pr('g', { stage: 'descartado', updatedAt: '2026-10-02', doNotContact: true }), '2026-10')).toBeNull();
  });

  it('los "posibles" de Clientes entran como propuesta con su valor', () => {
    const items = buildPipeline([], [{ id: 'x', clientName: 'Estudio X', isLead: true, archived: false, estimatedPrice: 900, estimatedCurrency: 'USD' } as any], hoy);
    expect(items[0]).toMatchObject({ kind: 'lead', column: 'propuesta', value: 900, currency: 'USD' });
  });

  it('suma lo que está en juego por moneda', () => {
    const items = buildPipeline(
      [pr('a', { stage: 'respondio', dealValue: 500, dealCurrency: 'USD' }), pr('b', { stage: 'llamada', dealValue: 300000, dealCurrency: 'ARS' }), pr('c', { stage: 'llamada' })],
      [],
      hoy
    );
    expect(openTotals(items)).toEqual({ count: 3, USD: 500, ARS: 300000, sinValor: 1 });
  });
});
