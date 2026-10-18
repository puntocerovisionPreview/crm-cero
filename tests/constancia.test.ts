import { describe, expect, it } from 'vitest';
import { buildActivity, buildWeeks, computeStats, countFor, levelFor } from '../src/utils/activity';

const task = (id: string, date: string, completed = true, completedAt?: string) => ({ id, title: id, date, completed, completedAt, createdAt: date } as any);

describe('Constancia (mapa estilo GitHub)', () => {
  it('cuenta cada tarea en el día en que se terminó', () => {
    const days = buildActivity({ tasks: [task('a', '2026-10-10', true, '2026-10-12'), task('b', '2026-10-12'), task('c', '2026-10-12', false)], meetings: [] });
    expect(days.get('2026-10-12')?.tareas).toBe(2);
    expect(days.has('2026-10-10')).toBe(false);
  });

  it('suma prospección (solo lo que hiciste vos) y rutina', () => {
    const days = buildActivity({
      tasks: [],
      meetings: [{ id: 'm', title: 'x', date: '2026-10-15', completed: true, createdAt: '' } as any],
      prospectEvents: [
        { id: '1', prospectId: 'p', type: 'first_contact', date: '2026-10-15', createdAt: '' },
        { id: '2', prospectId: 'p', type: 'reply', date: '2026-10-15', createdAt: '' },
      ] as any,
      routineLogs: { '2026-10-15': { date: '2026-10-15', done: { a: 'x', b: 'y' } } },
    });
    const d = days.get('2026-10-15');
    expect(d).toEqual({ tareas: 0, reuniones: 1, prospeccion: 1, rutina: 2 });
    expect(countFor(d, 'todo')).toBe(4);
    expect(countFor(d, 'tareas')).toBe(1);
  });

  it('racha: cuenta hasta hoy, o hasta ayer si hoy todavía no hiciste nada', () => {
    const days = buildActivity({ tasks: ['2026-10-14', '2026-10-15', '2026-10-16'].map((d, i) => task(String(i), d)), meetings: [] });
    expect(computeStats(days, 'todo', '2026-10-17').current).toBe(3);
    expect(computeStats(days, 'todo', '2026-10-16').current).toBe(3);
    expect(computeStats(days, 'todo', '2026-10-18').current).toBe(0);
    expect(computeStats(days, 'todo', '2026-10-18').best).toBe(3);
  });

  it('la grilla son 53 semanas de lunes a domingo e incluye hoy', () => {
    const weeks = buildWeeks('2026-10-18');
    expect(weeks).toHaveLength(53);
    expect(weeks[52][0]).toBe('2026-10-12');
    expect(weeks[52]).toContain('2026-10-18');
  });

  it('niveles de color relativos al día más activo', () => {
    expect(levelFor(0, 10)).toBe(0);
    expect(levelFor(1, 10)).toBe(1);
    expect(levelFor(10, 10)).toBe(4);
  });
});
