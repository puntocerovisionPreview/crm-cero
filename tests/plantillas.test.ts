import { describe, expect, it } from 'vitest';
import { buildOnboardingTasks, templateFor } from '../src/utils/onboardingTemplates';

describe('Plantillas de arranque', () => {
  it('elige PAF o Web según el cliente', () => {
    expect(templateFor({ serviceType: 'paf' } as any)).toBe('paf');
    expect(templateFor({ projectType: 'paf_base' } as any)).toBe('paf');
    expect(templateFor({ serviceType: 'web' } as any)).toBe('web');
  });

  it('crea las tareas vinculadas al cliente con fechas desde hoy', () => {
    const tasks = buildOnboardingTasks({ id: 'p1', clientName: 'Estudio Cane' } as any, 'web', '2026-10-18');
    expect(tasks[0]).toMatchObject({ date: '2026-10-18', projectId: 'p1', projectName: 'Estudio Cane', completed: false, priority: 'alta' });
    expect(tasks[tasks.length - 1].date).toBe('2026-11-18');
  });
});
