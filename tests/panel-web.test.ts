import { describe, expect, it } from 'vitest';
import { ClientPanel, applyClientAction, parseClientAction, snapshotOf } from '../src/panels/model';
import { emptyWeb, requestsByPage, sendPreview, webSummary } from '../src/panels/web';

const base: ClientPanel = {
  id: 'p',
  token: 'b'.repeat(36),
  active: true,
  clientName: 'Estudio Sur',
  weekStart: '2026-10-19',
  goals: [],
  tasks: [],
  pieces: [],
  web: emptyWeb(),
  createdAt: '2026-10-20T00:00:00Z',
};

describe('panel web: versión de prueba', () => {
  it('al mandar el link pasa a revisión, ronda 1', () => {
    const w = sendPreview(base.web!, 'https://prueba.cero.com/sur', 2, 'T1');
    expect(w.stage).toBe('revision');
    expect(w.preview).toMatchObject({ url: 'https://prueba.cero.com/sur', round: 1, maxRounds: 2, state: 'revisar' });
  });

  it('el cliente pide cambios por página y quedan como pendientes de esa ronda', () => {
    const p = { ...base, web: sendPreview(base.web!, 'https://x.com', 2, 'T1') };
    const a = parseClientAction({ type: 'prueba', decision: 'cambios', items: [{ page: 'Inicio', text: 'Otra foto arriba' }, { page: 'Contacto', text: 'Sumar Instagram' }, { text: '' }] })!;
    const r = applyClientAction(p, a, 'T2');
    if ('error' in r) throw new Error(r.error);
    expect(r.panel.web!.preview!.state).toBe('cambios');
    expect(r.panel.web!.requests.map((x) => [x.page, x.round, x.kind])).toEqual([
      ['Inicio', 1, 'revision'],
      ['Contacto', 1, 'revision'],
    ]);
    expect(r.notice.title).toContain('pidió 2 cambios (ronda 1)');
    expect(requestsByPage(r.panel.web!.requests).map((g) => g.page)).toEqual(['Inicio', 'Contacto']);
    // Mandás la versión corregida: ronda 2
    expect(sendPreview(r.panel.web!, 'https://x.com', 2, 'T3').preview!.round).toBe(2);
  });

  it('aprobar sin versión para revisar no se puede', () => {
    const r = applyClientAction(base, { type: 'prueba', decision: 'aprobar', items: [] });
    expect('error' in r).toBe(true);
  });

  it('pedir cambios sin decir qué, no vale', () => {
    expect(parseClientAction({ type: 'prueba', decision: 'cambios', items: [] })).toBeNull();
  });
});

describe('panel web: materiales y pedidos', () => {
  it('el cliente marca un material con su link', () => {
    const m = base.web!.materials[0];
    const r = applyClientAction(base, parseClientAction({ type: 'material', id: m.id, done: true, link: 'drive.google.com/x' })!, 'T');
    if ('error' in r) throw new Error(r.error);
    const got = r.panel.web!.materials[0];
    expect(got.done).toBe(true);
    expect(got.link).toBe('https://drive.google.com/x');
    expect(r.notice.title).toContain('mandó "Logo en buena calidad"');
  });

  it('después de publicada, pide un cambio y te avisa', () => {
    const r = applyClientAction(base, parseClientAction({ type: 'pedido', page: 'Proyectos', text: 'Sumar la obra de Nueva Córdoba' })!, 'T');
    if ('error' in r) throw new Error(r.error);
    expect(r.panel.web!.requests[0]).toMatchObject({ kind: 'cambio', page: 'Proyectos', done: false });
    expect(r.notice.title).toContain('pidió un cambio en su web');
    expect(webSummary(r.panel.web!).openRequests).toBe(1);
  });

  it('un panel sin parte web no acepta acciones web', () => {
    const r = applyClientAction({ ...base, web: undefined }, { type: 'pedido', text: 'x' });
    expect('error' in r).toBe(true);
  });

  it('la copia pública lleva la parte web', () => {
    expect(snapshotOf(base).web?.pages).toEqual(['Inicio', 'Servicios', 'Proyectos', 'Contacto']);
  });
});
