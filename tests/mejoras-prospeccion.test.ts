import { describe, expect, it } from 'vitest';
import {
  applyAction,
  breakdownBy,
  buildDailyQueue,
  countryBoosts,
  distributeFirstContacts,
  localTimeFor,
  lostReasons,
  normalizePersonalLine,
  pendingOutcomes,
  recycleDue,
  renderTemplate,
  templateFor,
  variantFor,
  weeklyReportText,
  DEFAULT_PROSPECTING_SETTINGS,
  mergeProspectingSettings,
} from '../src/prospecting/core';
import { pickBatch } from '../src/prospecting/pool';

const P = (over: any) => ({ id: over.id || 'p', name: 'Laura Pérez', stage: 'nuevo', createdAt: '2026-10-12', followUps: 0, ...over }) as any;
const S = DEFAULT_PROSPECTING_SETTINGS;

describe('sumar más y fines de semana', () => {
  it('la tanda semanal se reparte en tus días de trabajo (sábado → lunes)', () => {
    expect(distributeFirstContacts(3, '2026-10-17', 2)).toEqual(['2026-10-19', '2026-10-19', '2026-10-20']);
  });

  it('si prospectás los sábados, el sábado cuenta', () => {
    expect(distributeFirstContacts(2, '2026-10-17', 5, [1, 2, 3, 4, 5, 6])).toEqual(['2026-10-17', '2026-10-17']);
  });

  it('lo que sumaste a mano hoy entra a la lista aunque se pase el tope', () => {
    const settings = { ...S, dailyCap: 1 };
    const prospects = [
      P({ id: 'a', plannedFirstContact: '2026-10-17' }),
      P({ id: 'b', plannedFirstContact: '2026-10-17', pulledOn: '2026-10-17' }),
      P({ id: 'c', plannedFirstContact: '2026-10-17', pulledOn: '2026-10-17' }),
    ];
    const q = buildDailyQueue(prospects, '2026-10-17', settings);
    expect(q.items.map((i) => i.prospect.id).sort()).toEqual(['b', 'c']);
    expect(q.overflow).toBe(1);
  });

  it('"Mañana" en un primer mensaje lo pasa de día', () => {
    const { updates } = applyAction(P({ pulledOn: '2026-10-17' }), 'snooze', '2026-10-17');
    expect(updates.plannedFirstContact).toBe('2026-10-18');
    expect(updates.pulledOn).toBeUndefined();
  });
});

describe('inicio del día', () => {
  it('pide anotar a quienes les escribiste antes y no marcaste', () => {
    const list = [
      P({ id: 'a', stage: 'contactado', lastContactAt: '2026-10-15' }),
      P({ id: 'b', stage: 'contactado', lastContactAt: '2026-10-15', lastOutcomeAt: '2026-10-15' }),
      P({ id: 'c', stage: 'contactado', lastContactAt: '2026-10-17' }),
      P({ id: 'd', stage: 'respondio', lastContactAt: '2026-10-14' }),
    ];
    expect(pendingOutcomes(list, '2026-10-17').map((p) => p.id)).toEqual(['a']);
  });
});

describe('hora de cada país', () => {
  it('a las 10 de Argentina en México son las 7: mejor más tarde', () => {
    const now = new Date('2026-10-16T13:00:00Z'); // 10:00 en Argentina
    expect(localTimeFor('AR', now)?.quality).toBe('bueno');
    expect(localTimeFor('MX', now)).toMatchObject({ hour: 7, quality: 'malo' });
    expect(localTimeFor('XX', now)).toBeUndefined();
  });

  it('dentro de los primeros mensajes, primero a quien está en horario', () => {
    const now = new Date('2026-10-16T13:00:00Z');
    const q = buildDailyQueue([P({ id: 'mx', name: 'A', country: 'MX' }), P({ id: 'ar', name: 'B', country: 'AR' })], '2026-10-16', S, now);
    expect(q.items.map((i) => i.prospect.id)).toEqual(['ar', 'mx']);
  });
});

describe('mensajes', () => {
  it('frase personalizada con IA o la genérica', () => {
    const t = S.templates.first;
    expect(renderTemplate(t, P({ studio: 'Estudio LP', personalLine: 'Viendo sus casas en Mendoza.' }))).toContain('Viendo sus casas en Mendoza, ¿me permites');
    expect(renderTemplate(t, P({ studio: 'Estudio LP' }))).toContain('Viendo el enfoque y la trayectoria que tienes en tu estudio, ¿me permites');
    expect(normalizePersonalLine('  ')).toBe('');
  });

  it('video y agenda', () => {
    const settings = { ...S, bookingUrl: 'https://cal.com/juan' };
    expect(renderTemplate(S.templates.video, P({ videoUrl: 'https://loom.com/x' }))).toContain('https://loom.com/x');
    const item = { prospect: P({ stage: 'video_enviado' }), kind: 'seguimiento' } as any;
    expect(renderTemplate(templateFor(item, settings), item.prospect, settings)).toContain('https://cal.com/juan');
  });

  it('A/B: sin versión B siempre A; con versión B se reparte y queda guardada', () => {
    expect(variantFor(P({ id: 'x1' }), S)).toBe('A');
    const ab = { ...S, templates: { ...S.templates, firstB: 'Hola {saludo}, versión B' } };
    const ids = Array.from({ length: 20 }, (_, i) => `p${i}`);
    const vs = ids.map((id) => variantFor(P({ id }), ab));
    expect(vs).toContain('A');
    expect(vs).toContain('B');
    const { updates, event } = applyAction(P({ id: 'p1' }), 'first_contact', '2026-10-16', ab);
    expect(updates.variant).toBe(variantFor(P({ id: 'p1' }), ab));
    expect(event?.variant).toBe(updates.variant);
  });

  it('segunda chance usa su propio mensaje', () => {
    const item = { prospect: P({ secondChance: true }), kind: 'primer' } as any;
    expect(templateFor(item, S)).toBe(S.templates.secondChance);
  });

  it('configuraciones viejas guardadas reciben los campos nuevos', () => {
    const m = mergeProspectingSettings({ dailyCap: 9, templates: { first: 'x' } } as any);
    expect(m.workDays).toEqual([1, 2, 3, 4, 5]);
    expect(m.templates.booking).toBeTruthy();
    expect(m.templates.first).toBe('x');
  });
});

describe('llamada, propuesta y descartes', () => {
  it('llamada agendada aparece el día de la llamada para anotar cómo salió', () => {
    const { updates } = applyAction(P({ stage: 'respondio' }), 'call', '2026-10-16', S, '2026-10-20');
    const p = P({ id: 'c', ...updates });
    expect(buildDailyQueue([p], '2026-10-19', S).items).toHaveLength(0);
    expect(buildDailyQueue([p], '2026-10-20', S).items[0].kind).toBe('llamada');
  });

  it('propuesta enviada: seguimiento a los 3 días', () => {
    const { updates } = applyAction(P({ stage: 'llamada', callDate: '2026-10-16' }), 'proposal_sent', '2026-10-16');
    const p = P({ id: 'c', stage: 'llamada', ...updates });
    expect(buildDailyQueue([p], '2026-10-19', S).items[0].kind).toBe('propuesta');
  });

  it('sin respuesta → vuelve en 90 días; no le interesa → no vuelve', () => {
    const a = applyAction(P({ stage: 'contactado' }), 'lost', '2026-10-16', S, 'Sin respuesta tras los seguimientos');
    expect(a.updates.recycleAfter).toBe('2027-01-14');
    const b = applyAction(P({ stage: 'contactado' }), 'lost', '2026-10-16', S, 'No le interesa');
    expect(b.updates.recycleAfter).toBeUndefined();
    const due = recycleDue([P({ id: 'x', stage: 'descartado', recycleAfter: '2027-01-14' }), P({ id: 'y', stage: 'descartado', recycleAfter: '2027-01-14', doNotContact: true })], '2027-01-14');
    expect(due.map((p) => p.id)).toEqual(['x']);
  });

  it('no contactar: descartado para siempre', () => {
    const { updates } = applyAction(P({ stage: 'respondio' }), 'do_not_contact', '2026-10-16');
    expect(updates).toMatchObject({ stage: 'descartado', doNotContact: true });
  });

  it('motivos de pérdida contados', () => {
    const r = lostReasons([P({ id: '1', stage: 'descartado', lostReason: 'Precio' }), P({ id: '2', stage: 'descartado', lostReason: 'Precio' }), P({ id: '3', stage: 'descartado', lostReason: 'No es el momento' })]);
    expect(r[0]).toEqual({ reason: 'Precio', count: 2 });
  });
});

describe('métricas que aprenden', () => {
  const prospects = [
    ...Array.from({ length: 10 }, (_, i) => P({ id: `mx${i}`, country: 'MX' })),
    ...Array.from({ length: 10 }, (_, i) => P({ id: `ar${i}`, country: 'AR' })),
  ];
  const events: any[] = [
    ...prospects.map((p) => ({ prospectId: p.id, type: 'first_contact', date: '2026-10-13' })),
    ...['mx0', 'mx1', 'mx2', 'mx3', 'mx4', 'ar0'].map((id) => ({ prospectId: id, type: 'reply', date: '2026-10-14' })),
  ];

  it('tasa de respuesta por país', () => {
    const b = breakdownBy(prospects, events, (p) => p.country);
    expect(b.find((g) => g.key === 'MX')).toMatchObject({ contacted: 10, replied: 5 });
    expect(b.find((g) => g.key === 'AR')).toMatchObject({ contacted: 10, replied: 1 });
  });

  it('el país que responde más sube en la reserva', () => {
    const boosts = countryBoosts(prospects, events);
    expect(boosts.MX).toBeGreaterThan(0);
    expect(boosts.AR).toBeLessThan(0);
    const leads = [
      { id: 'l1', country: 'AR', segment: 'arquitectura', score: 80 },
      { id: 'l2', country: 'MX', segment: 'arquitectura', score: 76 },
    ] as any[];
    expect(pickBatch(leads, 1)[0].id).toBe('l1');
    expect(pickBatch(leads, 1, { boosts })[0].id).toBe('l2');
  });

  it('reporte para el mentor', () => {
    const txt = weeklyReportText({ label: 'Semana 3', range: '13/10 – 19/10', conversacionesOut: 40, seguimientos: 20, respuestas: 8, autoAuditorias: 2 } as any, 50);
    expect(txt).toContain('40 de 50');
    expect(txt).toContain('20% de respuesta');
  });
});
