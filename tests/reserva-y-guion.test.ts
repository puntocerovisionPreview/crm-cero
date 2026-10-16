import { describe, expect, it } from 'vitest';
import { analyzePhone, buildPool, parseCsv, pickBatch, scoreLead, tierFor, poolToCsv } from '../src/prospecting/pool';
import { applyAction, buildDailyQueue, renderTemplate, templateFor, DEFAULT_PROSPECTING_SETTINGS, mergeProspectingSettings, greetingFor } from '../src/prospecting/core';

const AR = { code: 'AR', dial: '54' };

describe('teléfonos para WhatsApp', () => {
  it('Argentina: el 15 indica celular y se convierte a 549 + característica', () => {
    expect(analyzePhone('0351 15-528-7974', AR)).toMatchObject({ whatsapp: '5493515287974', kind: 'celular' });
    expect(analyzePhone('011 15-6701-6275', AR)).toMatchObject({ whatsapp: '5491167016275', kind: 'celular' });
    expect(analyzePhone('03543 15-51-7656', AR)).toMatchObject({ whatsapp: '5493543517656', kind: 'celular' });
    expect(analyzePhone('0351 753-2543', AR)?.kind).toBe('fijo');
    expect(analyzePhone('+54 9 11 2345-6789', AR)).toMatchObject({ whatsapp: '5491123456789', kind: 'celular' });
  });

  it('otros países por su formato de celular', () => {
    expect(analyzePhone('+57 315 2875796', { code: 'CO', dial: '57' })?.kind).toBe('celular');
    expect(analyzePhone('+57 601 6108555', { code: 'CO', dial: '57' })?.kind).toBe('fijo');
    expect(analyzePhone('+56 9 6613 4412', { code: 'CL', dial: '56' })).toMatchObject({ whatsapp: '56966134412', kind: 'celular' });
    expect(analyzePhone('+598 2904 2222', { code: 'UY', dial: '598' })?.kind).toBe('fijo');
    expect(analyzePhone('+58 412-2760322', { code: 'VE', dial: '58' })?.kind).toBe('celular');
    expect(analyzePhone('+52 55 5335 6299', { code: 'MX', dial: '52' })?.kind).toBe('posible');
  });

  it('descarta "Enviar al teléfono" y los íconos del scraper', () => {
    expect(analyzePhone('\nEnviar al teléfono', AR)).toBeNull();
    expect(analyzePhone('\n+56 9 6613 4412', { code: 'CL', dial: '56' })?.whatsapp).toBe('56966134412');
  });
});

describe('base del scraper', () => {
  const csv = [
    'nombre,categoria,busqueda,ciudad_busqueda,direccion,telefono,sitio_web,rating,num_reviews,permanentemente_cerrado,google_maps_url',
    '"Estudio Uno",Estudio de arquitectura,estudio de arquitectura,"Córdoba, Argentina","\nAv. Siempre Viva 1",0351 15-111-2222,,4.8,3,False,u1',
    '"Estudio Uno (duplicado)",Arquitecto,arquitectos,"Córdoba, Argentina",x,0351 15-111-2222,,5,1,False,u2',
    'Vivero Verde,Vivero,paisajismo,"Lima, Perú",x,+51 998 141 229,,4,10,False,u3',
    'Casa Brasil,Arquitecto,arquitectos,"São Paulo, Brasil",x,+55 11 99459-2199,,5,2,False,u4',
    'Cerrado SA,Arquitecto,arquitectos,"Lima, Perú",x,+51 998 000 111,,5,2,True,u5',
    'Constructora Grande,Empresa constructora,constructora,"Bogotá, Colombia",x,+57 601 6108555,https://grande.com,4.5,900,False,u6',
  ].join('\n');

  it('respeta saltos de línea dentro de comillas', () => {
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(6);
    expect(rows[0].nombre).toBe('Estudio Uno');
  });

  it('descarta fuera de nicho, Brasil, cerrados y duplicados; ordena por puntaje', () => {
    const r = buildPool(parseCsv(csv));
    expect(r.accepted.map((l) => l.name)).toEqual(['Estudio Uno', 'Constructora Grande']);
    expect(r.rejected).toMatchObject({ 'Rubro fuera del nicho': 1, 'Brasil (portugués)': 1, Cerrado: 1, Repetido: 1 });
    expect(r.accepted[0]).toMatchObject({ tier: 'A', phoneKind: 'celular', whatsapp: '5493511112222', country: 'AR' });
    expect(r.accepted[1].tier).toBe('C');
  });

  it('no suma a quien ya está en prospección', () => {
    const r = buildPool(parseCsv(csv), { excludePhones: new Set(['1112222']) });
    expect(r.accepted.map((l) => l.name)).toEqual(['Constructora Grande']);
  });

  it('puntaje: estudio con celular y sin web es A; constructora grande con fijo es C', () => {
    expect(tierFor(scoreLead('arquitectura', 'celular', '', 5, 3).score)).toBe('A');
    expect(tierFor(scoreLead('construccion', 'fijo', 'https://x.com', 4, 900).score)).toBe('C');
  });

  it('la tanda varía de país', () => {
    const leads = Array.from({ length: 12 }, (_, i) => ({ id: `l${i}`, country: i < 8 ? 'MX' : 'AR', segment: 'arquitectura', score: 90 - i } as any));
    // Los 8 mejores son de México, pero la tanda mezcla: entra Argentina aunque tenga menos puntaje
    const batch = pickBatch(leads, 4);
    expect(batch.map((l) => l.country)).toEqual(['MX', 'MX', 'AR', 'AR']);
    // Si un solo país no alcanza, se completa con el resto (no se queda corta)
    expect(pickBatch(leads, 6)).toHaveLength(6);
    expect(pickBatch(leads, 3, { countries: ['AR'] }).every((l) => l.country === 'AR')).toBe(true);
  });

  it('exporta para Excel con link de WhatsApp', () => {
    const out = poolToCsv(buildPool(parseCsv(csv)).accepted);
    expect(out).toContain('"https://wa.me/5493511112222"');
  });
});

describe('guion de conversación', () => {
  const s = DEFAULT_PROSPECTING_SETTINGS;
  const base = { id: 'p1', name: 'Estudio Uno', studio: 'Estudio Uno', stage: 'contactado', createdAt: '2026-10-12', followUps: 0 } as any;

  it('el primer mensaje saluda por el @ o por el estudio', () => {
    expect(greetingFor({ ...base, instagram: 'https://instagram.com/estudiouno/' })).toBe('@estudiouno');
    expect(renderTemplate(s.templates.first, base)).toMatch(/^Hola Estudio Uno\. Mi nombre es Juan, soy el dueño de \.Cero\./);
  });

  it('recorre los pasos: pregunta → su respuesta → empatía → acuerdo → speech con link → auditoría enviada', () => {
    let p = { ...base, ...applyAction(base, 'reply', '2026-10-16', s).updates };
    const step = () => buildDailyQueue([p], '2026-10-16', s).items[0];
    expect(p.convStep).toBe('pregunta');
    expect(renderTemplate(templateFor(step(), s), p)).toBe('¿Cómo haces para difundir tu trabajo y llegar a más personas?');

    p = { ...p, ...applyAction(p, 'conv_question_sent', '2026-10-16', s).updates };
    expect(p.convStep).toBe('esperando_respuesta');

    const ans = applyAction(p, 'conv_answer:portales', '2026-10-16', s);
    expect(ans.event).toBeNull(); // no suma en las métricas
    p = { ...p, ...ans.updates };
    expect(p).toMatchObject({ convStep: 'empatia', difusion: 'portales' });
    expect(renderTemplate(templateFor(step(), s), p)).toContain('dependemos de la suerte');

    p = { ...p, ...applyAction(p, 'conv_empathy_sent', '2026-10-16', s).updates };
    p = { ...p, ...applyAction(p, 'conv_agreed', '2026-10-16', s).updates };
    expect(p.convStep).toBe('speech');
    expect(renderTemplate(templateFor(step(), s), p)).toContain('https://somospuntocero.online/auditoria?p=p1');

    const sent = applyAction(p, 'audit_sent', '2026-10-16', s);
    expect(sent.event?.type).toBe('audit_sent');
    expect(sent.updates).toMatchObject({ stage: 'auditoria_enviada', convStep: undefined });
  });

  it('"sigue mañana" lo saca de la lista de hoy', () => {
    const p = { ...base, stage: 'respondio', convStep: 'esperando_respuesta', ...applyAction(base, 'snooze', '2026-10-16', s).updates };
    expect(buildDailyQueue([p], '2026-10-16', s).items).toHaveLength(0);
    expect(buildDailyQueue([p], '2026-10-17', s).items).toHaveLength(1);
  });

  it('la configuración guardada vieja se completa con los textos nuevos del guion', () => {
    const merged = mergeProspectingSettings({ dailyCap: 5, templates: { first: 'Hola {saludo}' } as any });
    expect(merged.dailyCap).toBe(5);
    expect(merged.templates.first).toBe('Hola {saludo}');
    expect(merged.templates.empathy.portales).toContain('portales');
    expect(merged.weeklyBatchSize).toBe(10);
  });
});
