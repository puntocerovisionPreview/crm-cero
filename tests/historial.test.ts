import { describe, expect, it } from 'vitest';
import { buildTimeline, groupByMonth } from '../src/utils/clientTimeline';

const project = {
  id: 'p1', clientName: 'Estudio Cane', status: 'En curso', archived: false, notes: '', createdAt: '2026-08-01', updatedAt: '',
  contactLog: [{ id: 'c1', date: '2026-10-10', type: 'whatsapp', text: 'Le pasé la propuesta' }],
  payments: [{ id: 'pay1', projectId: 'p1', amount: 500, currency: 'USD', date: '2026-09-15', method: 'transferencia' }],
} as any;

describe('Historial del cliente', () => {
  it('junta contactos, reuniones, tareas terminadas, pagos y el alta, del más nuevo al más viejo', () => {
    const tasks = [
      { id: 't1', title: 'Maqueta', date: '2026-10-01', completed: true, completedAt: '2026-10-03', projectId: 'p1', createdAt: '' },
      { id: 't2', title: 'Pendiente', date: '2026-10-01', completed: false, projectId: 'p1', createdAt: '' },
      { id: 't3', title: 'De otro cliente', date: '2026-10-01', completed: true, projectId: 'p2', createdAt: '' },
    ] as any;
    const meetings = [{ id: 'm1', title: 'Kickoff', date: '2026-08-05', completed: true, projectId: 'p1', createdAt: '' }] as any;
    const t = buildTimeline(project, tasks, meetings);
    expect(t.map(e => e.kind)).toEqual(['whatsapp', 'tarea', 'pago', 'reunion', 'alta']);
    expect(t[1].date).toBe('2026-10-03');
    expect(t[0].removable).toBe(true);
  });

  it('agrupa por mes', () => {
    const g = groupByMonth(buildTimeline(project, [], []));
    expect(g.map(x => x.month)).toEqual(['2026-10', '2026-09', '2026-08']);
  });
});
