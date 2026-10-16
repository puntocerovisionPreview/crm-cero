import { describe, expect, it } from 'vitest';
import {
  applyAction,
  auditFromWebPayload,
  buildDailyQueue,
  computeMonthMetrics,
  distributeFirstContacts,
  findDuplicate,
  isHot,
  matchAuditToProspect,
  metricsToCsv,
  monthWeeks,
  newProspectFromRow,
  parsePastedProspects,
  pendingDayClose,
  renderTemplate,
  DEFAULT_PROSPECTING_SETTINGS,
} from '../src/prospecting/core';
import { buildProspectingClose, prospectingSummary } from '../src/automation/messages';
import { buildWebSnippet } from '../src/prospecting/webSnippet';

const P = (over: any) => ({ id: over.id || 'p', name: 'Laura Pérez', stage: 'nuevo', createdAt: '2026-10-12', followUps: 0, ...over }) as any;

describe('cargar la tanda', () => {
  it('lee lo pegado desde Excel con títulos', () => {
    const rows = parsePastedProspects('Nombre\tEstudio\tInstagram\tWhatsApp\tCiudad\nLaura Pérez\tEstudio LP\t@estudiolp\t+54 9 351 555 1234\tCórdoba\n\n');
    expect(rows).toEqual([{ name: 'Laura Pérez', studio: 'Estudio LP', instagram: '@estudiolp', whatsapp: '+54 9 351 555 1234', city: 'Córdoba' }]);
  });

  it('sin títulos, reconoce @usuario, email y teléfono', () => {
    const rows = parsePastedProspects('Juan Gómez, Arq JG, @arqjg, juan@jg.com, 3515551234, Rosario');
    expect(rows[0]).toMatchObject({ name: 'Juan Gómez', studio: 'Arq JG', instagram: '@arqjg', email: 'juan@jg.com', whatsapp: '3515551234', city: 'Rosario' });
  });

  it('avisa si ya está en prospección o ya es cliente', () => {
    const existing = [P({ id: 'x', whatsapp: '0351 15-555-1234', stage: 'contactado' })];
    const projects = [{ id: 'c', clientName: 'Remodelante', instagramUrl: 'https://instagram.com/remodelante/' }] as any;
    expect(findDuplicate({ name: 'L', whatsapp: '+54 9 351 555 1234' }, existing)?.kind).toBe('prospecto');
    expect(findDuplicate({ name: 'Otro', instagram: '@Remodelante' }, [], projects)?.kind).toBe('cliente');
    expect(findDuplicate({ name: 'Nadie', instagram: '@nuevo' }, existing, projects)).toBeNull();
  });

  it('reparte los primeros mensajes en días hábiles', () => {
    // viernes 16/10: 2 el viernes, 2 el lunes, 1 el martes
    expect(distributeFirstContacts(5, '2026-10-16', 2)).toEqual(['2026-10-16', '2026-10-16', '2026-10-19', '2026-10-19', '2026-10-20']);
    // cargada un sábado: arranca el lunes
    expect(distributeFirstContacts(1, '2026-10-17', 2)).toEqual(['2026-10-19']);
  });
});

describe('etapas y cola del día', () => {
  const s = DEFAULT_PROSPECTING_SETTINGS;

  it('primer mensaje → seguimiento a los 2 días → descartar sugerido después de 3', () => {
    let p = P({ id: 'a' });
    p = { ...p, ...applyAction(p, 'first_contact', '2026-10-12', s).updates };
    expect(p).toMatchObject({ stage: 'contactado', nextActionDate: '2026-10-14', lastContactAt: '2026-10-12' });
    for (let i = 0; i < 3; i++) p = { ...p, ...applyAction(p, 'follow_up', '2026-10-14', s).updates };
    expect(p.followUps).toBe(3);
    const q = buildDailyQueue([{ ...p, lastContactAt: '2026-10-14' }], '2026-10-16', s).items;
    expect(q[0]).toMatchObject({ kind: 'seguimiento', suggestDiscard: true });
  });

  it('"seguimos hablando" no suma en las métricas', () => {
    expect(applyAction(P({}), 'chatting', '2026-10-16', s).event).toBeNull();
  });

  it('auditoría completada → video con vencimiento a 48 hs, primero en la cola', () => {
    const done = { ...P({ id: 'v', stage: 'auditoria_enviada' }), ...applyAction(P({ id: 'v' }), 'audit_completed', '2026-10-16', s).updates };
    expect(done.videoDueDate).toBe('2026-10-18');
    const q = buildDailyQueue([P({ id: 'n', plannedFirstContact: '2026-10-16' }), done], '2026-10-16', s).items;
    expect(q.map((i) => i.kind)).toEqual(['video', 'primer']);
  });

  it('respeta el tope diario, pero videos y respuestas siempre entran', () => {
    const many = Array.from({ length: 10 }, (_, i) => P({ id: `n${i}`, name: `N${i}`, plannedFirstContact: '2026-10-16' }));
    const urgent = [P({ id: 'r', stage: 'respondio' }), P({ id: 'v', stage: 'auditoria_completada', videoDueDate: '2026-10-17' })];
    const { items, overflow } = buildDailyQueue([...many, ...urgent], '2026-10-16', { ...s, dailyCap: 4 });
    expect(items.map((i) => i.kind)).toEqual(['video', 'responder', 'primer', 'primer']);
    expect(overflow).toBe(8);
  });

  it('el cierre del día pide solo a quienes recibieron mensaje hoy y no tienen resultado', () => {
    const list = [
      P({ id: 'a', name: 'A', stage: 'contactado', lastContactAt: '2026-10-16' }),
      P({ id: 'b', name: 'B', stage: 'contactado', lastContactAt: '2026-10-16', lastOutcomeAt: '2026-10-16' }),
      P({ id: 'c', name: 'C', stage: 'contactado', lastContactAt: '2026-10-15' }),
    ];
    expect(pendingDayClose(list, '2026-10-16').map((p) => p.id)).toEqual(['a']);
    expect(buildProspectingClose({ tasks: [], meetings: [], projects: [], incomes: [], fixedExpenses: [], routine: [], prospects: list } as any, '2026-10-16')).toContain('• A');
  });

  it('arma el mensaje con nombre, estudio y su link personal', () => {
    const msg = renderTemplate('Hola {nombre} de {estudio}: {link}', P({ id: 'pros_1', name: 'Laura Pérez', studio: 'Estudio LP' }));
    expect(msg).toBe('Hola Laura de Estudio LP: https://somospuntocero.online/auditoria?p=pros_1');
  });
});

describe('métricas del mentor', () => {
  it('semanas del mes de lunes a domingo (octubre 2026 arranca jueves)', () => {
    expect(monthWeeks('2026-10').map((w) => `${w.start}/${w.end}`)).toEqual([
      '2026-10-01/2026-10-04',
      '2026-10-05/2026-10-11',
      '2026-10-12/2026-10-18',
      '2026-10-19/2026-10-25',
      '2026-10-26/2026-10-31',
    ]);
  });

  it('cuenta conversaciones, seguimientos, respuestas únicas y auditorías por semana', () => {
    const ev = (type: string, date: string, prospectId = 'a') => ({ id: Math.random().toString(), prospectId, type, date, createdAt: '' }) as any;
    const weeks = computeMonthMetrics(
      [
        ev('first_contact', '2026-10-12'),
        ev('first_contact', '2026-10-13', 'b'),
        ev('follow_up', '2026-10-14'),
        ev('reply', '2026-10-15'),
        ev('reply', '2026-10-16'), // mismo prospecto: cuenta una respuesta
        ev('audit_completed', '2026-10-20'),
        ev('first_contact', '2026-09-30'), // otro mes
      ],
      '2026-10'
    );
    expect(weeks[2]).toMatchObject({ conversacionesOut: 2, seguimientos: 1, respuestas: 1, autoAuditorias: 0 });
    expect(weeks[3].autoAuditorias).toBe(1);
    expect(metricsToCsv(weeks)).toContain('"Conversaciones OUT";"0";"0";"2";"0";"0";"2"');
  });
});

describe('auditoría desde la web', () => {
  const body = {
    ref: '',
    nombre: 'Laura Pérez',
    nombre_estudio: 'Estudio LP',
    whatsapp: '351 555-1234',
    email: 'laura@lp.com',
    score_total: '9 / 30',
    score_presencia: '4 / 10',
    score_adquisicion: '3 / 10',
    score_funnel: '2 / 10',
    nivel_paf: 'Inicial',
    proyectos_activos: '4 a 7 proyectos',
    dolor_captacion: 'No llegan consultas',
    q1_respuesta: 'Sí (2 pts)',
  };

  it('convierte el formulario en puntajes y respuestas', () => {
    const a = auditFromWebPayload(body, '2026-10-16T15:00:00Z');
    expect(a).toMatchObject({ total: 9, presencia: 4, adquisicion: 3, funnel: 2, nivel: 'Inicial', dolorCaptacion: 'No llegan consultas' });
    expect(a.respuestas).toEqual({ q1: 'Sí (2 pts)' });
  });

  it('la encuentra por el link personal y, si no, por WhatsApp', () => {
    const list = [P({ id: 'pros_1' }), P({ id: 'pros_2', whatsapp: '+54 9 351 555 1234' })];
    expect(matchAuditToProspect({ ...body, ref: 'pros_1' }, list)?.id).toBe('pros_1');
    expect(matchAuditToProspect(body, list)?.id).toBe('pros_2');
    expect(matchAuditToProspect({ nombre: 'X', whatsapp: '1111 2222' }, list)).toBeNull();
  });

  it('caliente: le falta funnel o adquisición y tiene varios proyectos', () => {
    expect(isHot(P({ audit: auditFromWebPayload(body, '') }))).toBe(true);
    expect(isHot(P({ audit: { ...auditFromWebPayload(body, ''), proyectosActivos: 'Ninguno' } }))).toBe(false);
  });

  it('el fragmento para la web apunta al CRM y no frena el quiz si falla', () => {
    const js = buildWebSnippet('https://crm-cero.ai.studio/');
    expect(js).toContain("fetch('https://crm-cero.ai.studio/api/prospects/audit'");
    expect(js).toContain('.catch(function () {})');
    expect(js).toContain('try {');
  });
});

describe('resumen de la mañana', () => {
  it('suma la prospección del día', () => {
    const data = {
      tasks: [], meetings: [], projects: [], incomes: [], fixedExpenses: [], routine: [],
      prospects: [P({ id: 'n', plannedFirstContact: '2026-10-16' }), P({ id: 'v', studio: 'Estudio LP', stage: 'auditoria_completada', videoDueDate: '2026-10-16' })],
    } as any;
    const text = prospectingSummary(data, '2026-10-16');
    expect(text).toContain('1 video de auditoría para mandar');
    expect(text).toContain('1 primer mensaje');
    expect(text).toContain('Video para Estudio LP: vence hoy');
  });
});

describe('alta de prospecto', () => {
  it('queda con su día de primer mensaje', () => {
    const p = newProspectFromRow({ name: ' Laura ', studio: 'LP' }, '2026-10-19', '2026-10-16');
    expect(p).toMatchObject({ name: 'Laura', stage: 'nuevo', plannedFirstContact: '2026-10-19', nextActionDate: '2026-10-19', followUps: 0 });
  });
});
