import { describe, expect, it } from 'vitest';
import { ClientPanel, applyClientAction, panelSummary, parseClientAction, snapshotOf, startNewWeek } from '../src/panels/model';

const panel: ClientPanel = {
  id: 'panel_x',
  token: 'a'.repeat(36),
  active: true,
  clientName: 'Estudio Cane',
  projectId: 'proj1',
  phone: '+5493510000000',
  weekStart: '2026-10-19',
  goals: [
    { id: 'g1', text: 'Publicar 3 piezas', done: true },
    { id: 'g2', text: 'Mandar fotos de obra', done: false },
  ],
  tasks: [
    { id: 't1', title: 'Mandar fotos', date: '2026-10-22', done: false },
    { id: 't2', title: 'Revisar bio', done: true },
  ],
  pieces: [{ id: 'p1', date: '2026-10-24', support: 'carrusel', title: 'Aberturas', slides: [{ display: 'pub:a', thumb: 'pub:b' }], state: 'para_aprobar' }],
  createdAt: '2026-10-20T10:00:00Z',
};

describe('panel del cliente: lo que ve', () => {
  it('la copia pública no lleva teléfono ni ids internos', () => {
    const s = snapshotOf(panel, '2026-10-20T12:00:00Z') as any;
    expect(s.kind).toBe('panel');
    expect(s.phone).toBeUndefined();
    expect(s.projectId).toBeUndefined();
    expect(s.id).toBeUndefined();
    expect(s.tasks.map((t: any) => t.id)).toEqual(['t1', 't2']); // pendientes primero
  });
});

describe('panel del cliente: lo que puede hacer', () => {
  it('solo acepta marcar tareas y aprobar o pedir cambios', () => {
    expect(parseClientAction({ type: 'tarea', taskId: 't1', done: true })).toEqual({ type: 'tarea', taskId: 't1', done: true, note: undefined });
    expect(parseClientAction({ type: 'pieza', pieceId: 'p1', decision: 'aprobar' })?.type).toBe('pieza');
    expect(parseClientAction({ type: 'pieza', pieceId: 'p1', decision: 'cambios' })).toBeNull(); // sin comentario
    expect(parseClientAction({ type: 'borrar', id: 'x' })).toBeNull();
    expect(parseClientAction({ type: 'pieza', pieceId: 'p1', decision: 'publicar' })).toBeNull();
  });

  it('marcar una tarea la guarda con la nota y te avisa', () => {
    const r = applyClientAction(panel, { type: 'tarea', taskId: 't1', done: true, note: 'Te las mandé por mail' }, '2026-10-21T09:00:00Z');
    if ('error' in r) throw new Error(r.error);
    const t = r.panel.tasks.find((x) => x.id === 't1')!;
    expect(t.done).toBe(true);
    expect(t.clientNote).toBe('Te las mandé por mail');
    expect(r.notice.title).toContain('Estudio Cane completó "Mandar fotos"');
    expect(r.panel.lastClientAction?.text).toContain('completó');
  });

  it('pedir cambios deja el comentario en la pieza', () => {
    const r = applyClientAction(panel, { type: 'pieza', pieceId: 'p1', decision: 'cambios', comment: 'Cambiar la foto 3' });
    if ('error' in r) throw new Error(r.error);
    expect(r.panel.pieces[0].state).toBe('cambios');
    expect(r.panel.pieces[0].clientComment).toBe('Cambiar la foto 3');
    expect(r.notice.title).toContain('pidió cambios');
  });

  it('no puede tocar cosas que no existen', () => {
    expect('error' in applyClientAction(panel, { type: 'tarea', taskId: 'nope', done: true })).toBe(true);
    expect('error' in applyClientAction(panel, { type: 'pieza', pieceId: 'nope', decision: 'aprobar' })).toBe(true);
  });
});

describe('panel del cliente: semanas', () => {
  it('semana nueva: guarda la anterior y pasa los objetivos sin cumplir', () => {
    const next = startNewWeek(panel, '2026-10-26');
    expect(next.weekStart).toBe('2026-10-26');
    expect(next.pastWeeks?.[0].weekStart).toBe('2026-10-19');
    expect(next.goals.map((g) => g.text)).toEqual(['Mandar fotos de obra']);
    expect(next.goals[0].done).toBe(false);
  });

  it('resumen para la lista', () => {
    expect(panelSummary(panel)).toEqual({ tasksOpen: 1, tasksDone: 1, toApprove: 1, changes: 0, goalsDone: 1, goals: 2 });
  });
});
