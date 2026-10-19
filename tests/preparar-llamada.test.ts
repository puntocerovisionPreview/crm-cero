import { describe, expect, it } from 'vitest';
import { prepDateFor, prepDayLabel, prepTaskId, suggestedPrepTasks } from '../src/prospecting/callPrep';

const T = '2026-10-19';

describe('preparar la llamada', () => {
  it('las tareas van el día anterior, nunca antes de hoy', () => {
    expect(prepDateFor('2026-10-22', T)).toBe('2026-10-21');
    expect(prepDateFor('2026-10-20', T)).toBe('2026-10-19'); // llamada mañana → hoy
    expect(prepDateFor('2026-10-19', T)).toBe('2026-10-19'); // llamada hoy → hoy
  });

  it('sugiere confirmar, repasar y preparar; el video solo si falta', () => {
    const base = { id: 'p1', name: 'Estudio Sur', studio: 'Estudio Sur', stage: 'llamada', createdAt: T, followUps: 0 } as any;
    expect(suggestedPrepTasks(base).filter((t) => t.on).map((t) => t.key)).toEqual(['confirmar', 'revisar', 'oferta']);
    expect(suggestedPrepTasks({ ...base, stage: 'auditoria_completada' }).some((t) => t.key === 'video')).toBe(true);
    expect(suggestedPrepTasks({ ...base, stage: 'auditoria_completada', videoUrl: 'x' }).some((t) => t.key === 'video')).toBe(false);
  });

  it('ids fijos (reprogramar no duplica) y etiquetas claras', () => {
    expect(prepTaskId('p1', 'confirmar')).toBe('task_call_p1_confirmar');
    expect(prepDayLabel(T, T)).toBe('hoy');
    expect(prepDayLabel('2026-10-20', T)).toMatch(/^mañana/);
  });
});
