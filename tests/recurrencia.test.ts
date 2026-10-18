import { describe, expect, it } from 'vitest';
import { makeRecurrence, nextOccurrence } from '../src/utils/recurrence';

describe('Tareas que se repiten', () => {
  const hoy = '2026-10-18'; // domingo

  it('diaria, semanal y quincenal', () => {
    expect(nextOccurrence({ preset: 'diaria' }, '2026-10-18', hoy)).toBe('2026-10-19');
    expect(nextOccurrence({ preset: 'semanal' }, '2026-10-19', hoy)).toBe('2026-10-26');
    expect(nextOccurrence({ preset: 'quincenal' }, '2026-10-19', hoy)).toBe('2026-11-02');
  });

  it('días hábiles salta el fin de semana', () => {
    expect(nextOccurrence({ preset: 'habiles' }, '2026-10-23', '2026-10-23')).toBe('2026-10-26'); // viernes → lunes
  });

  it('mensual mantiene el día y usa el último día en meses cortos', () => {
    const rec = makeRecurrence('mensual', '2026-01-31')!;
    expect(rec.monthDay).toBe(31);
    expect(nextOccurrence(rec, '2026-01-31', '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence(rec, '2026-02-28', '2026-02-28')).toBe('2026-03-31');
  });

  it('si estaba atrasada, la próxima no queda en el pasado', () => {
    expect(nextOccurrence({ preset: 'semanal' }, '2026-09-01', hoy)).toBe('2026-10-20');
    expect(nextOccurrence({ preset: 'diaria' }, '2026-10-01', hoy)).toBe(hoy);
  });

  it('"no se repite" no genera regla', () => {
    expect(makeRecurrence('', hoy)).toBeNull();
  });
});
