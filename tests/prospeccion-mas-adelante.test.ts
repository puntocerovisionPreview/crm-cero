import { describe, expect, it } from 'vitest';
import { applyAction, buildDailyQueue, masAdelante, pendingOutcomes, renderTemplate, templateFor, turnOf, DEFAULT_PROSPECTING_SETTINGS } from '../src/prospecting/core';
import { nextMove } from '../src/prospecting/board';
import type { Prospect } from '../src/types';

const base = (x: Partial<Prospect> = {}): Prospect => ({
  id: 'p1', name: 'David', studio: 'Adrede', stage: 'respondio', createdAt: '2026-10-01', followUps: 2,
  lastContactAt: '2026-11-10', nextActionDate: '2026-11-12', convStep: 'esperando_respuesta', ...x,
});
const hoy = '2026-11-12';
const conAccion = (p: Prospect, a: Parameters<typeof applyAction>[1], note?: string, today = hoy) => ({ ...p, ...applyAction(p, a, today, DEFAULT_PROSPECTING_SETTINGS, note).updates });

describe('prospectos que empiezan más adelante', () => {
  it('guarda la fecha y el motivo, resetea los seguimientos y sale de la lista', () => {
    const p = conAccion(base(), 'later', '2027-03-01|Arrancan cuando terminen la obra');
    expect(p.retomar).toEqual({ fecha: '2027-03-01', desde: hoy, motivo: 'Arrancan cuando terminen la obra' });
    expect(p.followUps).toBe(0);
    expect(p.nextActionDate).toBe('2027-03-01');
    expect(buildDailyQueue([p], hoy).items).toHaveLength(0);
    expect(pendingOutcomes([p], hoy)).toHaveLength(0);
    expect(turnOf(p, hoy).label).toBe('Empieza más adelante: retomar el 01/03 · Arrancan cuando terminen la obra');
  });

  it('el día de la fecha vuelve sola como "Retomar", aunque la lista esté llena', () => {
    const p = conAccion(base(), 'later', '2027-03-01|');
    const nuevos = Array.from({ length: 40 }, (_, i) => base({ id: `n${i}`, stage: 'nuevo', plannedFirstContact: '2027-03-01', lastContactAt: undefined }));
    const { items } = buildDailyQueue([...nuevos, p], '2027-03-01');
    const item = items.find((i) => i.prospect.id === 'p1')!;
    expect(item.kind).toBe('retomar');
    expect(renderTemplate(templateFor(item, DEFAULT_PROSPECTING_SETTINGS), p)).toContain('por estas fechas');
    expect(nextMove(p, '2027-03-01').send).toBe('i_replied');
    expect(nextMove(p, hoy).due).toBe(false);
  });

  it('cualquier otra cosa que pase con él termina la espera', () => {
    const p = conAccion(base(), 'later', '2027-03-01|');
    expect(conAccion(p, 'they_replied').retomar).toBeUndefined();
    expect(conAccion(p, 'i_replied', undefined, '2027-03-01').retomar).toBeUndefined();
    expect(conAccion(p, 'note', 'llamó').retomar).toBeDefined();
  });

  it('sin fecha válida, retoma en un mes; y la cartera se ordena por fecha', () => {
    expect(conAccion(base(), 'later', 'cualquiera').retomar!.fecha).toBe('2026-12-12');
    const a = conAccion(base({ id: 'a' }), 'later', '2027-05-01|');
    const b = conAccion(base({ id: 'b' }), 'later', '2027-02-01|');
    expect(masAdelante([a, b, base({ id: 'c' })]).map((p) => p.id)).toEqual(['b', 'a']);
  });
});
