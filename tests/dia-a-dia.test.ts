import { describe, expect, it } from 'vitest';
import { sortTasks } from '../src/utils/taskSort';
import { computeStreak, appliesOn } from '../src/utils/dailyRoutineCore';
import { addMonths, monthOf } from '../src/utils/dates';
import { planClientLinks, normalizeClientName } from '../src/utils/clients';
import { buildDailyBrief, getDueReminders, escapeHtml } from '../src/automation/messages';
import { meetingToEvent, eventToLocal, meetingHash } from '../server/calendarSync';

const task = (over: any) => ({ id: over.id, title: over.id, date: '2026-10-16', completed: false, createdAt: '2026-10-01', ...over }) as any;

describe('orden de tareas', () => {
  const tasks = [
    task({ id: 'baja', priority: 'baja', time: '08:00' }),
    task({ id: 'sin', time: '10:00' }),
    task({ id: 'alta', priority: 'alta' }),
    task({ id: 'hecha', priority: 'alta', completed: true }),
    task({ id: 'mañana', priority: 'alta', date: '2026-10-17' }),
  ];

  it('por prioridad: alta, media (sin prioridad) y baja; completadas al final; agrupado por día', () => {
    expect(sortTasks(tasks, 'prioridad').map((t) => t.id)).toEqual(['alta', 'sin', 'baja', 'mañana', 'hecha']);
  });

  it('por hora: con hora primero, sin hora al final', () => {
    expect(sortTasks(tasks, 'hora').map((t) => t.id)).toEqual(['baja', 'sin', 'alta', 'mañana', 'hecha']);
  });
});

describe('rutina diaria', () => {
  const items = [{ id: 'a', title: 'A', order: 1, createdAt: '2026-10-01' }] as any;

  it('cuenta días seguidos y no corta la racha antes de que termine el día', () => {
    const logs = {
      '2026-10-14': { date: '2026-10-14', done: { a: 'x' } },
      '2026-10-15': { date: '2026-10-15', done: { a: 'x' } },
    };
    expect(computeStreak(items, logs, '2026-10-16')).toBe(2); // hoy todavía no la hizo
    expect(computeStreak(items, { ...logs, '2026-10-16': { date: '2026-10-16', done: { a: 'x' } } }, '2026-10-16')).toBe(3);
  });

  it('respeta los días de la semana elegidos', () => {
    const weekdaysOnly = { id: 'b', title: 'B', order: 1, createdAt: '2026-10-01', weekdays: [1, 2, 3, 4, 5] } as any;
    expect(appliesOn(weekdaysOnly, '2026-10-17')).toBe(false); // sábado
    expect(appliesOn(weekdaysOnly, '2026-10-16')).toBe(true); // viernes
  });
});

describe('fechas', () => {
  it('fin de mes no se desborda', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
  it('mes de una fecha', () => {
    expect(monthOf('2026-10-16')).toBe('2026-10');
  });
});

describe('clientes', () => {
  it('agrupa proyectos del mismo cliente aunque cambien tildes y espacios', () => {
    expect(normalizeClientName('Estudio Cané  Arquitectura')).toBe('estudio cane arquitectura');
    const projects = [
      { id: 'p1', clientName: 'Estudio Cané', createdAt: '2026-01-01', clientPhone: '111' },
      { id: 'p2', clientName: 'estudio cane', createdAt: '2026-05-01' },
      { id: 'p3', clientName: 'Remodelante', createdAt: '2026-06-01', clientId: 'cli_ya' },
    ] as any;
    const plan = planClientLinks(projects, [], '2026-10-16');
    expect(plan.newClients).toHaveLength(1);
    expect(plan.newClients[0].phone).toBe('111');
    expect(plan.projectLinks.map((l) => l.projectId)).toEqual(['p1', 'p2']);
  });

  it('reusa un cliente existente', () => {
    const plan = planClientLinks([{ id: 'p1', clientName: 'Arquitrek' }] as any, [{ id: 'c1', name: 'ARQUITREK', createdAt: '' }], '2026-10-16');
    expect(plan.newClients).toHaveLength(0);
    expect(plan.projectLinks[0].clientId).toBe('c1');
  });
});

describe('mensajes de Telegram', () => {
  const base = { tasks: [], meetings: [], projects: [], incomes: [], fixedExpenses: [], routine: [] } as any;

  it('escapa el texto del usuario', () => {
    expect(escapeHtml('<b>&')).toBe('&lt;b&gt;&amp;');
    const msg = buildDailyBrief({ ...base, tasks: [task({ id: '<script>', priority: 'alta' })] }, '2026-10-16');
    expect(msg).toContain('&lt;script&gt;');
    expect(msg).not.toContain('<script>');
  });

  it('avisa la reunión 15 minutos antes, una sola vez', () => {
    const meetings = [{ id: 'm1', title: 'Remodelante', date: '2026-10-16', time: '15:00', completed: false, createdAt: '' }];
    expect(getDueReminders({ ...base, meetings }, '2026-10-16', 14 * 60 + 44)).toHaveLength(0);
    expect(getDueReminders({ ...base, meetings }, '2026-10-16', 14 * 60 + 45)).toHaveLength(1);
    expect(getDueReminders({ ...base, meetings: [{ ...meetings[0], telegramReminded: true }] }, '2026-10-16', 14 * 60 + 50)).toHaveLength(0);
  });
});

describe('Google Calendar', () => {
  it('convierte una reunión en evento con hora argentina y duración', () => {
    const ev = meetingToEvent({ id: 'm1', title: 'Sesión PAF', date: '2026-10-16', time: '23:30', durationHours: 1 } as any);
    expect(ev.start).toEqual({ dateTime: '2026-10-16T23:30:00', timeZone: 'America/Argentina/Cordoba' });
    expect(ev.end.dateTime).toBe('2026-10-17T00:30:00');
    expect(ev.extendedProperties.private.ceroMeetingId).toBe('m1');
  });

  it('lee un evento de Google en hora local y vuelve igual (sin ida y vuelta infinita)', () => {
    const local = eventToLocal({ start: { dateTime: '2026-10-16T15:00:00-03:00' }, end: { dateTime: '2026-10-16T16:30:00-03:00' } });
    expect(local).toEqual({ date: '2026-10-16', time: '15:00', durationHours: 1.5 });
    expect(meetingHash({ title: 'X', ...local! })).toBe('X|2026-10-16|15:00|1.5');
  });

  it('ignora eventos de día completo', () => {
    expect(eventToLocal({ start: { date: '2026-10-16' } })).toBeNull();
  });
});
