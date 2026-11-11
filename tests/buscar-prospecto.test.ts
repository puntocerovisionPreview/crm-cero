import { describe, expect, it } from 'vitest';
import { findProspects, matchScore, recentlyContacted } from '../src/prospecting/find';

const P = (over: any) => ({ id: over.id || over.name, name: 'x', stage: 'contactado', createdAt: '2026-10-12', followUps: 0, ...over }) as any;

const LIST = [
  P({ name: 'María Gómez', studio: 'Estudio Sur', whatsapp: '+54 9 11 5555-1234', city: 'Córdoba', lastContactAt: '2026-11-05' }),
  P({ name: 'Juan Pérez', studio: 'Arq. Norte', instagram: '@arq.norte', lastContactAt: '2026-11-08' }),
  P({ name: 'Sureña Paisajes', stage: 'nuevo' }),
  P({ name: 'Lucía', studio: 'Taller Ele', whatsapp: '3515559876', awaitingMe: true, lastContactAt: '2026-11-01' }),
];

describe('buscar a quien te contestó', () => {
  it('encuentra por nombre o estudio, sin acentos ni mayúsculas', () => {
    expect(findProspects(LIST, 'maria')[0].name).toBe('María Gómez');
    expect(findProspects(LIST, 'CORDOBA')[0].name).toBe('María Gómez');
    expect(findProspects(LIST, 'norte')[0].name).toBe('Juan Pérez');
  });

  it('encuentra por los números del teléfono, con cualquier formato', () => {
    expect(findProspects(LIST, '5555 1234')[0].name).toBe('María Gómez');
    expect(findProspects(LIST, '9876')[0].name).toBe('Lucía');
    // menos de 4 números no alcanza para buscar por teléfono
    expect(findProspects(LIST, '55')).toHaveLength(0);
  });

  it('encuentra por @ de Instagram', () => {
    expect(findProspects(LIST, '@arq.norte')[0].name).toBe('Juan Pérez');
  });

  it('primero el que empieza con lo que escribiste y ya tiene conversación', () => {
    const r = findProspects(LIST, 'sur').map((p) => p.name);
    expect(r).toEqual(['Sureña Paisajes', 'María Gómez']);
    expect(matchScore(LIST[0], '')).toBe(0);
    expect(findProspects(LIST, 'zzz')).toHaveLength(0);
  });

  it('sin buscar: los últimos a los que les escribiste y no contestaron', () => {
    expect(recentlyContacted(LIST).map((p) => p.name)).toEqual(['Juan Pérez', 'María Gómez']);
  });
});
