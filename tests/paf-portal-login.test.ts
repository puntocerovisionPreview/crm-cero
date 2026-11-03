import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPafPortal, emptyPortalDraft, normalizeEmails, type PafPortalDraft } from '../src/portal/model';
import { seccionesVisibles } from '../src/portal/model';
import { CLIENTE_ID_RE, accessHost, accessIcon, accessIssue, calendarLink, normalizeLinkInput, portalDirty as dirtyOf, safeLogo, suggestWebClienteId } from '../src/portal/model';

const draft: PafPortalDraft = {
  emails: ['Estudio@Gmail.com', 'estudio@gmail.com', 'socia@gmail.com'],
  hito: 2,
  resumen: '  Cerramos el foco.  ',
  enlaces: { carpeta: 'https://drive.google.com/drive/folders/abc', asana: 'https://app.asana.com/0/1' },
};

describe('portal PAF con login', () => {
  it('normaliza correos: minúsculas y sin repetidos', () => {
    expect(normalizeEmails(' A@x.com, a@x.com; b@y.com ')).toEqual(['a@x.com', 'b@y.com']);
    expect(emptyPortalDraft('Juan@X.com').emails).toEqual(['juan@x.com']);
  });

  it('arma solo los campos publicables, con el ID como clave', () => {
    const r = buildPafPortal({ clienteId: 'paf-prueba-001', estudio: 'Estudio Uno', draft }, '2026-11-02T10:00:00.000Z');
    if (!('doc' in r)) throw new Error(r.errors.join());
    expect(r.doc).toEqual({
      clienteId: 'PAF-PRUEBA-001',
      estudio: 'Estudio Uno',
      emailsAutorizados: ['estudio@gmail.com', 'socia@gmail.com'],
      hitoVisible: 2,
      resumenVisible: 'Cerramos el foco.',
      enlaces: { carpeta: 'https://drive.google.com/drive/folders/abc', asana: 'https://app.asana.com/0/1' },
      tareas: [],
      tareasHabilitadas: [],
      entregas: [],
      proximaReunion: null,
      semana: null,
      reuniones: [],
      accesos: [
        { nombre: 'Tu carpeta', url: 'https://drive.google.com/drive/folders/abc' },
        { nombre: 'Calendario de contenido', url: 'https://app.asana.com/0/1' },
      ],
      anuncios: [],
      mostrarAvance: true,
      hitosCompletados: [],
      recorrido: 'presencia',
      logo: null,
      marca: null,
      linkReunion: null,
      secciones: seccionesVisibles(),
      gestionContenido: null,
      bienvenida: null,
      materiales: {},
      reunionesAcuerdo: null,
      reunionPorConfirmar: null,
      reportes: [],
      actualizadoEn: '2026-11-02T10:00:00.000Z',
    });
  });

  it('no deja pasar campos privados aunque vengan en el borrador', () => {
    const sucio = { ...draft, notasInternas: 'secreto', enlaces: { ...draft.enlaces, carpetaInterna: 'https://drive.google.com/privada' } } as any;
    const r = buildPafPortal({ clienteId: 'PAF-002', estudio: 'Estudio', draft: sucio });
    if (!('doc' in r)) throw new Error(r.errors.join());
    const json = JSON.stringify(r.doc);
    expect(json).not.toContain('secreto');
    expect(json).not.toContain('privada');
  });

  it('rechaza sin ID válido, sin correos o con enlaces que no son https', () => {
    const r = buildPafPortal({ clienteId: 'abc', estudio: 'E', draft: { ...draft, emails: [], enlaces: { web: 'javascript:alert(1)' } } });
    expect('errors' in r && r.errors.length).toBe(3);
    const r2 = buildPafPortal({ clienteId: 'PAF-003', estudio: 'E', draft: { ...draft, emails: ['no-es-correo'] } });
    expect('errors' in r2 && r2.errors[0]).toContain('no-es-correo');
  });

  it('el hito visible queda entre 1 y 5', () => {
    const r = buildPafPortal({ clienteId: 'PAF-004', estudio: 'E', draft: { ...draft, hito: 9 } });
    expect('doc' in r && r.doc.hitoVisible).toBe(5);
  });

  it('las reglas no dejan leer paf_portal por ID: piden el correo en emailsAutorizados', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const block = rules.slice(rules.indexOf('match /paf_portal/{clienteId} {'), rules.indexOf('// "Terminé" del estudio'));
    expect(block).toContain('request.auth.token.email.lower() in resource.data.emailsAutorizados');
    expect(block).toContain('email_verified == true');
    expect(block).not.toMatch(/allow (create|update|delete|write)/);
    expect(block).not.toContain('if true');
  });
});

import { applyAvisos, approveTask, buildPedidoAlta, nextMeeting, portalFromProject, publicTasks, type PafTask } from '../src/portal/model';

describe('tareas, avisos y aprobaciones', () => {
  const tasks: PafTask[] = [
    { id: 't1', titulo: 'Borrador', estado: 'borrador' },
    { id: 't2', titulo: 'Completar formulario', estado: 'habilitada', habilitadaEn: '2026-11-02T10:00:00.000Z' },
    { id: 't3', titulo: 'Fotos', estado: 'aprobada', aprobacion: { fecha: '2026-11-01T12:00:00.000Z', canal: 'WhatsApp' } },
  ];

  it('el estudio no ve las tareas sin habilitar ni el canal de aprobación', () => {
    const pub = publicTasks(tasks);
    expect(pub.map((t) => t.id)).toEqual(['t2', 't3']);
    expect(pub[1]).toMatchObject({ estado: 'aprobada', aprobadaEl: '2026-11-01' });
    expect(JSON.stringify(pub)).not.toContain('WhatsApp');
  });

  it('"Terminé" pasa a enviada, no aprueba', () => {
    const next = applyAvisos(tasks, [{ id: 'a', tareaId: 't2', email: 'x@y.com', creadoEn: '2026-11-02T11:00:00.000Z' }]);
    expect(next?.find((t) => t.id === 't2')).toMatchObject({ estado: 'enviada', avisoEn: '2026-11-02T11:00:00.000Z' });
    expect(next?.find((t) => t.id === 't2')?.aprobacion).toBeUndefined();
  });

  it('ignora avisos viejos, de tareas sin habilitar o ya aprobadas', () => {
    expect(applyAvisos(tasks, [
      { id: 'a', tareaId: 't2', email: 'x@y.com', creadoEn: '2026-11-02T09:00:00.000Z' },
      { id: 'b', tareaId: 't1', email: 'x@y.com', creadoEn: '2026-11-03T09:00:00.000Z' },
      { id: 'c', tareaId: 't3', email: 'x@y.com', creadoEn: '2026-11-03T09:00:00.000Z' },
    ])).toBeNull();
  });

  it('la aprobación de Juan queda con fecha y canal', () => {
    expect(approveTask(tasks[1], 'Reunión', '2026-11-04T15:00:00.000Z')).toMatchObject({ estado: 'aprobada', aprobacion: { fecha: '2026-11-04T15:00:00.000Z', canal: 'Reunión' } });
  });

  it('próxima reunión: la confirmada más cercana del proyecto', () => {
    const meetings = [
      { projectId: 'p1', date: '2026-11-01', completed: false },
      { projectId: 'p1', date: '2026-11-10', time: '10:00', completed: false },
      { projectId: 'p1', date: '2026-11-05', completed: false, proposed: true },
      { projectId: 'p1', date: '2026-11-06', completed: true },
      { projectId: 'otro', date: '2026-11-03', completed: false },
    ];
    expect(nextMeeting(meetings, 'p1', '2026-11-02')).toEqual({ fecha: '2026-11-10', hora: '10:00' });
    expect(nextMeeting([], 'p1', '2026-11-02')).toBeNull();
  });

  it('el portal sale de la ficha solo con lo publicable', () => {
    const r = portalFromProject(
      { id: 'p1', clientName: 'Estudio', pafClienteId: 'PAF-002', pafTareas: tasks,
        pafEntregas: [{ id: 'e1', titulo: 'Guía', enlace: 'https://drive.google.com/x', publicada: true }, { id: 'e2', titulo: 'Interna', publicada: false }],
        pafPortal: { emails: ['a@b.com'], hito: 3, resumen: '', enlaces: {} }, notes: 'nota privada' } as any,
      [], undefined, undefined, new Date('2026-11-02T12:00:00')
    );
    if (!('doc' in r)) throw new Error(r.errors.join());
    expect(r.doc.tareas).toHaveLength(2);
    expect(r.doc.entregas).toEqual([{ id: 'e1', titulo: 'Guía', enlace: 'https://drive.google.com/x' }]);
    expect(JSON.stringify(r.doc)).not.toContain('nota privada');
  });
});

describe('pedido de alta', () => {
  it('arma el pedido pendiente con el correo normalizado', () => {
    const r = buildPedidoAlta({ projectId: 'p1', clienteId: 'paf-prueba-002', estudio: ' Estudio ', contacto: 'Ana', email: 'Ana@Gmail.com', zonaHoraria: 'America/Argentina/Buenos_Aires', prueba: true }, '2026-11-02T10:00:00.000Z');
    expect(r).toEqual({ pedido: { projectId: 'p1', estudio: 'Estudio', contacto: 'Ana', email: 'ana@gmail.com', zonaHoraria: 'America/Argentina/Buenos_Aires', prueba: true, estado: 'pendiente', clienteId: 'PAF-PRUEBA-002', enlaceFormulario: 'https://tally.so/r/2jXEVg?cliente_id=PAF-PRUEBA-002', creadoEn: '2026-11-02T10:00:00.000Z', actualizadoEn: '2026-11-02T10:00:00.000Z' } });
  });
  it('no deja pedir sin correo válido ni con un ID de otro tipo', () => {
    const r = buildPedidoAlta({ projectId: 'p1', clienteId: 'PAF-PRUEBA-003', estudio: 'E', contacto: '', email: 'no', zonaHoraria: 'X', prueba: false });
    expect('errors' in r && r.errors).toHaveLength(2);
  });
});

describe('reglas de avisos', () => {
  it('el cliente solo crea avisos con su correo y hora del servidor, y no los edita', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const block = rules.slice(rules.indexOf('match /paf_portal/{clienteId}/avisos'), rules.indexOf('match /{document=**}'));
    expect(block).toContain("hasOnly(['tareaId', 'email', 'creadoEn'])");
    expect(block).toContain('request.resource.data.email == request.auth.token.email.lower()');
    expect(block).toContain("request.resource.data.tareaId in portalOf(clienteId).get('tareasHabilitadas', [])");
    expect(block).toContain('request.resource.data.creadoEn == request.time');
    expect(block).not.toMatch(/allow (update|delete|write)/);
  });
});

import { suggestClienteId, tallyLink } from '../src/portal/model';
import { googleCalendarLink } from '../src/components/PafReunionCard';

describe('link de Tally e ID', () => {
  it('el link lleva el ID en el campo oculto cliente_id', () => {
    expect(tallyLink('PAF-002')).toBe('https://tally.so/r/2jXEVg?cliente_id=PAF-002');
  });
  it('el primer real es PAF-002 y después sigue el mayor usado', () => {
    expect(suggestClienteId([], false)).toBe('PAF-002');
    expect(suggestClienteId(['PAF-002', 'PAF-007', 'PAF-PRUEBA-009'], false)).toBe('PAF-008');
    expect(suggestClienteId(['PAF-PRUEBA-001', 'PAF-010'], true)).toBe('PAF-PRUEBA-002');
  });
  it('el contador evita reutilizar un ID borrado', () => {
    expect(suggestClienteId(['PAF-002'], false, 5)).toBe('PAF-006');
  });
});

describe('reunión en Google Calendar', () => {
  it('arma el evento con hora y duración, sin invitados', () => {
    const url = new URL(googleCalendarLink({ title: 'Reunión PAF · Estudio', date: '2026-11-10', time: '10:30', durationHours: 1.5 }));
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20261110T103000/20261110T120000');
    expect(url.searchParams.get('text')).toBe('Reunión PAF · Estudio');
    expect(url.searchParams.has('add')).toBe(false);
  });
});
import { checkTerminado, pafToReview } from '../src/portal/model';

describe('fase 1: circuito del "Terminé"', () => {
  const portal = {
    emailsAutorizados: ['estudio@gmail.com'],
    tareas: [{ id: 't1', titulo: 'Fotos', estado: 'habilitada' as const }, { id: 't2', titulo: 'Oculta no', estado: 'aprobada' as const }],
    tareasHabilitadas: ['t1'],
  };

  it('el portal publica solo los IDs de tareas habilitadas', () => {
    const r = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft, tareas: [
      { id: 'a', titulo: 'A', estado: 'habilitada' }, { id: 'b', titulo: 'B', estado: 'enviada' }, { id: 'c', titulo: 'C', estado: 'aprobada' },
    ] });
    expect('doc' in r && r.doc.tareasHabilitadas).toEqual(['a']);
  });

  it('el aviso solo vale para un correo autorizado y una tarea habilitada', () => {
    expect(checkTerminado(portal, ' Estudio@Gmail.com ', 't1')).toEqual({ titulo: 'Fotos' });
    expect(checkTerminado(portal, 'otro@gmail.com', 't1')).toEqual({ error: 'Correo no autorizado' });
    expect(checkTerminado(portal, 'estudio@gmail.com', 't2')).toEqual({ error: 'Tarea no habilitada' });
    expect(checkTerminado(null, 'estudio@gmail.com', 't1')).toEqual({ error: 'Portal inexistente' });
  });

  it('los correos con mayúsculas o espacios se guardan normalizados', () => {
    const r = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft: { ...draft, emails: ['  Ana@Estudio.COM ', 'ana@estudio.com'] } });
    expect('doc' in r && r.doc.emailsAutorizados).toEqual(['ana@estudio.com']);
  });

  it('"PAF para revisar" cuenta solo tareas avisadas de estudios activos', () => {
    const list = pafToReview([
      { id: 'p1', clientName: 'B', pafTareas: [{ id: '1', titulo: 'x', estado: 'enviada' }] },
      { id: 'p2', clientName: 'A', pafTareas: [{ id: '1', titulo: 'x', estado: 'enviada' }, { id: '2', titulo: 'y', estado: 'enviada' }] },
      { id: 'p3', clientName: 'C', archived: true, pafTareas: [{ id: '1', titulo: 'x', estado: 'enviada' }] },
      { id: 'p4', clientName: 'D', pafTareas: [{ id: '1', titulo: 'x', estado: 'habilitada' }] },
    ]);
    expect(list.map((x) => [x.project.id, x.count])).toEqual([['p2', 2], ['p1', 1]]);
  });

  it('el CRM puede leer los avisos de todos los estudios (solo el dueño)', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    expect(rules).toMatch(/match \/\{path=\*\*\}\/avisos\/\{avisoId\} \{\s*allow read: if isOwner\(\);/);
  });
});
import { driveKey, isPrivateUrl, portalDirty, reopenTask, suggestedChannel } from '../src/portal/model';

describe('fase 2: panel de Juan', () => {
  const pub = { emailsAutorizados: ['a@b.com'], hitoVisible: 2, resumenVisible: 'Foco', enlaces: { carpeta: 'https://drive.google.com/drive/folders/abcdefghij123' } };
  const base = { emails: ['a@b.com'], hito: 2, resumen: 'Foco', enlaces: { carpeta: 'https://drive.google.com/drive/folders/abcdefghij123' } };

  it('"Hay cambios sin publicar" solo cuando cambia algo que ve el estudio', () => {
    expect(portalDirty(base, pub)).toBe(false);
    expect(portalDirty({ ...base, emails: [' A@B.com '] }, pub)).toBe(false);
    expect(portalDirty({ ...base, resumen: 'Foco  ' }, pub)).toBe(false);
    expect(portalDirty({ ...base, hito: 3 }, pub)).toBe(true);
    expect(portalDirty({ ...base, resumen: 'Otro' }, pub)).toBe(true);
    expect(portalDirty({ ...base, emails: ['a@b.com', 'c@d.com'] }, pub)).toBe(true);
    expect(portalDirty({ ...base, enlaces: { ...base.enlaces, web: 'https://x.com' } }, pub)).toBe(true);
    expect(portalDirty(base, null)).toBe(false);
  });

  it('bloquea la carpeta interna o la ficha aunque el link venga escrito distinto', () => {
    expect(driveKey('https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjK?usp=sharing')).toBe('1AbCdEfGhIjK');
    expect(isPrivateUrl('https://drive.google.com/drive/folders/1AbCdEfGhIjK', ['https://drive.google.com/drive/u/1/folders/1AbCdEfGhIjK?usp=drive_link'])).toBe(true);
    expect(isPrivateUrl('https://docs.google.com/document/d/1ZyXwVuTsRqP/edit', [undefined, 'https://docs.google.com/document/d/1ZyXwVuTsRqP/view'])).toBe(true);
    expect(isPrivateUrl('https://drive.google.com/drive/folders/otraCarpeta123', ['https://drive.google.com/drive/folders/1AbCdEfGhIjK'])).toBe(false);
    const r = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft: { ...draft, enlaces: { carpeta: 'https://drive.google.com/drive/folders/1AbCdEfGhIjK' } }, privados: ['https://drive.google.com/drive/folders/1AbCdEfGhIjK?usp=sharing'] });
    expect('errors' in r && r.errors[0]).toContain('carpeta interna');
  });

  it('al aprobar propone el último canal usado, o Portal', () => {
    expect(suggestedChannel([])).toBe('Portal');
    expect(suggestedChannel([
      { id: '1', titulo: 'a', estado: 'aprobada', aprobacion: { fecha: '2026-11-01T10:00:00Z', canal: 'Reunión' } },
      { id: '2', titulo: 'b', estado: 'aprobada', aprobacion: { fecha: '2026-11-02T10:00:00Z', canal: 'WhatsApp' } },
    ])).toBe('WhatsApp');
  });

  it('volver a habilitar guarda el motivo, borra aviso y aprobación, y el estudio lo ve', () => {
    const t = reopenTask({ id: '1', titulo: 'Fotos', estado: 'aprobada', avisoEn: 'x', aprobacion: { fecha: 'y', canal: 'Portal' } }, '  Faltan las de Belgrano ', '2026-11-03T10:00:00.000Z');
    expect(t).toEqual({ id: '1', titulo: 'Fotos', estado: 'habilitada', habilitadaEn: '2026-11-03T10:00:00.000Z', motivo: 'Faltan las de Belgrano' });
    const r = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft, tareas: publicTasks([t]) });
    expect('doc' in r && r.doc.tareas[0].motivo).toBe('Faltan las de Belgrano');
    const aprobada = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft, tareas: publicTasks([{ ...t, estado: 'aprobada' }]) });
    expect('doc' in aprobada && aprobada.doc.tareas[0].motivo).toBeUndefined();
  });
});

import { isOverdue, portalGoals, programWeek, whatsappDigits, PORTAL_SEPARATE_FIELDS, PAF_PORTAL_LINK_LABEL as PAF_PORTAL_LINK_LABEL_FOR_TEST } from '../src/portal/model';

describe('fase 3: portal del cliente', () => {
  it('semana X de 12 desde la fecha de inicio', () => {
    expect(programWeek('2026-10-20', '2026-11-03')).toEqual({ actual: 3, total: 12 });
    expect(programWeek('2026-10-20', '2026-10-20')).toEqual({ actual: 1, total: 12 });
    expect(programWeek('2026-01-01', '2026-11-03')).toEqual({ actual: 12, total: 12 });
    expect(programWeek('2026-12-01', '2026-11-03')).toBeNull();
    expect(programWeek(undefined, '2026-11-03')).toBeNull();
  });

  it('el portal publica la semana desde la ficha', () => {
    const r = portalFromProject({ id: 'p', clientName: 'E', pafClienteId: 'PAF-002', pafPortal: draft, pafStartDate: '2026-10-20' }, [], undefined, undefined, new Date('2026-11-03T12:00:00'));
    expect('doc' in r && r.doc.semana).toEqual({ actual: 3, total: 12 });
  });

  it('objetivos: solo texto, hecho y quién (sin IDs); sin dato es del estudio', () => {
    expect(portalGoals([{ text: ' Mensaje ', done: false, quien: 'cero' }, { text: 'Fotos', done: true }, { text: '  ', done: false }]))
      .toEqual([{ texto: 'Mensaje', hecho: false, quien: 'cero' }, { texto: 'Fotos', hecho: true, quien: 'estudio' }]);
  });

  it('objetivos y WhatsApp no se pisan al republicar desde la ficha', () => {
    const r = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft });
    expect('doc' in r && PORTAL_SEPARATE_FIELDS.every((k) => !(k in r.doc))).toBe(true);
  });

  it('vencida: habilitada, con fecha pasada y sin avisar', () => {
    expect(isOverdue({ estado: 'habilitada', fecha: '2026-11-01' }, '2026-11-03')).toBe(true);
    expect(isOverdue({ estado: 'habilitada', fecha: '2026-11-03' }, '2026-11-03')).toBe(false);
    expect(isOverdue({ estado: 'enviada', fecha: '2026-11-01' }, '2026-11-03')).toBe(false);
    expect(isOverdue({ estado: 'habilitada' }, '2026-11-03')).toBe(false);
  });

  it('las tareas que piden archivos lo publican', () => {
    const r = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft, tareas: publicTasks([{ id: '1', titulo: 'Fotos', estado: 'habilitada', pideArchivos: true }]) });
    expect('doc' in r && r.doc.tareas[0].pideArchivos).toBe(true);
  });

  it('WhatsApp: deja solo números y agrega 549 a celulares argentinos', () => {
    expect(whatsappDigits('11 2345-6789')).toBe('5491123456789');
    expect(whatsappDigits('+54 9 11 2345 6789')).toBe('5491123456789');
    expect(whatsappDigits('+54 11 2345 6789')).toBe('5491123456789');
    expect(whatsappDigits('')).toBe('');
  });

  it('el cliente ve "Calendario de contenido" en lugar de Asana', () => {
    expect(PAF_PORTAL_LINK_LABEL_FOR_TEST.asana).toBe('Calendario de contenido');
  });
});

import { checkPieza, missingTemplateTasks, pafTodayRows, portalPieces, publicSummaries, PAF_STAGE_TEMPLATES } from '../src/portal/model';

describe('fase 4: operación', () => {
  it('PAF hoy: para revisar arriba, después el más quieto', () => {
    const rows = pafTodayRows([
      { id: 'a', clientName: 'Quieto', lastContactDate: '2026-10-20', pafPortal: { emails: [], hito: 2, resumen: '', enlaces: {} } },
      { id: 'b', clientName: 'Con aviso', pafTareas: [{ id: '1', titulo: 'x', estado: 'enviada', avisoEn: '2026-11-03T09:00:00Z' }] },
      { id: 'c', clientName: 'Nuevo' },
    ], [{ projectId: 'a', date: '2026-11-10', time: '10:00', completed: false }], '2026-11-03');
    expect(rows.map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(rows[0]).toMatchObject({ paraRevisar: 1, diasSinNovedades: 0, etapa: null });
    expect(rows[1]).toMatchObject({ etapa: 2, diasSinNovedades: 14, proximaReunion: { fecha: '2026-11-10', hora: '10:00' } });
    expect(rows[2].diasSinNovedades).toBeNull();
  });

  it('resúmenes de reunión: solo los publicados, del más nuevo al más viejo', () => {
    expect(publicSummaries([
      { id: '1', fecha: '2026-10-01', acuerdos: 'A', proximosPasos: '', publicado: true },
      { id: '2', fecha: '2026-10-20', acuerdos: 'B', proximosPasos: 'C', publicado: true },
      { id: '3', fecha: '2026-10-25', acuerdos: 'Privado', proximosPasos: '', publicado: false },
    ])).toEqual([{ fecha: '2026-10-20', acuerdos: 'B', proximosPasos: 'C' }, { fecha: '2026-10-01', acuerdos: 'A', proximosPasos: '' }]);
  });

  it('plantilla de etapa: arranque con formulario, sin repetir lo que ya está', () => {
    expect(PAF_STAGE_TEMPLATES[1].reunion).toBe('Reunión de arranque');
    expect(PAF_STAGE_TEMPLATES[1].tareas.map((t) => t.titulo)).toContain('Completar el formulario de arranque');
    const falta = missingTemplateTasks(1, [{ id: 'x', titulo: ' completar el formulario de arranque ', estado: 'aprobada' }]);
    expect(falta.map((t) => t.titulo)).not.toContain('Completar el formulario de arranque');
    expect(missingTemplateTasks(9)).toEqual([]);
  });

  it('contenido: el estudio nunca recibe archivos privados (fs:)', () => {
    const r = portalPieces([{ id: 'p', date: '2026-11-05', support: 'carrusel', title: 'T', state: 'para_aprobar',
      slides: [{ display: 'pub:a', thumb: 'pub:b' }, { display: 'fs:privado', thumb: 'fs:privado2' }, { display: 'https://x.com/i.png', thumb: 'https://x.com/t.png' }] }]);
    expect(r[0].slides).toEqual([{ display: 'pub:a', thumb: 'pub:b' }, { display: 'https://x.com/i.png', thumb: 'https://x.com/t.png' }]);
    expect(JSON.stringify(r)).not.toContain('fs:');
  });

  it('contenido: solo el estudio autorizado aprueba, y solo lo que está para revisar', () => {
    const portal = { emailsAutorizados: ['e@x.com'], piezas: [
      { id: '1', fecha: '', soporte: 'reel' as const, titulo: 'Para revisar', slides: [], estado: 'para_aprobar' as const },
      { id: '2', fecha: '', soporte: 'reel' as const, titulo: 'Ya publicada', slides: [], estado: 'publicada' as const },
    ] };
    expect(checkPieza(portal, 'E@x.com', '1')).toEqual({ titulo: 'Para revisar' });
    expect(checkPieza(portal, 'otro@x.com', '1')).toEqual({ error: 'Correo no autorizado' });
    expect('error' in checkPieza(portal, 'e@x.com', '2')).toBe(true);
    expect('error' in checkPieza(portal, 'e@x.com', 'zzz')).toBe(true);
  });
});

import { accessesFromEnlaces, draftAccesos, publicAnnouncements } from '../src/portal/model';

describe('portal libre (fase 2): anuncios, tareas simples y accesos', () => {
  it('anuncios: solo publicados, fijados arriba, link solo https', () => {
    const r = publicAnnouncements([
      { id: '1', texto: 'Viejo', publicado: true, creadoEn: '2026-11-01T10:00:00Z' },
      { id: '2', texto: 'Nuevo', publicado: true, creadoEn: '2026-11-03T10:00:00Z', link: 'javascript:alert(1)' },
      { id: '3', texto: 'Fijado', publicado: true, fijado: true, creadoEn: '2026-10-01T10:00:00Z', titulo: 'Importante', link: 'https://x.com' },
      { id: '4', texto: 'Borrador', publicado: false, creadoEn: '2026-11-04T10:00:00Z' },
    ]);
    expect(r.map((a) => a.id)).toEqual(['3', '2', '1']);
    expect(r[0]).toEqual({ id: '3', texto: 'Fijado', titulo: 'Importante', link: 'https://x.com/', fijado: true, fecha: '2026-10-01' });
    expect(r[1].link).toBeUndefined();
  });

  it('el portal publica los anuncios desde la ficha', () => {
    const r = portalFromProject({ id: 'p', clientName: 'E', pafClienteId: 'PAF-002', pafPortal: draft, pafAnuncios: [{ id: 'a', texto: 'Hola', publicado: true, creadoEn: '2026-11-03T10:00:00Z' }] }, []);
    expect('doc' in r && r.doc.anuncios?.map((a) => a.texto)).toEqual(['Hola']);
  });

  it('los 5 enlaces de antes pasan a accesos sin perderse', () => {
    expect(accessesFromEnlaces({ carpeta: 'https://a.com', asana: 'https://b.com' }).map((a) => [a.nombre, a.url])).toEqual([['Tu carpeta', 'https://a.com'], ['Calendario de contenido', 'https://b.com']]);
    const r = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft: { ...draft, enlaces: { carpeta: 'https://drive.google.com/drive/folders/abc' } } });
    expect('doc' in r && r.doc.accesos).toEqual([{ nombre: 'Tu carpeta', url: 'https://drive.google.com/drive/folders/abc' }]);
  });

  it('accesos libres: orden de Juan, nombre libre, solo https, bloquea carpeta interna y ficha', () => {
    const libres = { ...draft, accesos: [
      { id: '1', nombre: 'Contenido en Asana', url: 'https://app.asana.com/x' },
      { id: '2', nombre: 'Carpeta', url: 'https://drive.google.com/drive/folders/1AbCdEfGhIjK' },
    ] };
    const ok = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft: libres });
    expect('doc' in ok && ok.doc.accesos?.map((a) => a.nombre)).toEqual(['Contenido en Asana', 'Carpeta']);
    expect('doc' in ok && ok.doc.enlaces).toEqual({});
    const privado = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft: libres, privados: ['https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjK?usp=sharing'] });
    // Lo privado o mal cargado no se publica, pero no frena el resto del portal
    expect('doc' in privado && privado.doc.accesos?.map((a) => a.nombre)).toEqual(['Contenido en Asana']);
    expect(accessIssue(libres.accesos[1], ['https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjK?usp=sharing'])).toContain('carpeta interna');
    // Lo que se pega a mano se completa: https, y un nombre si no tiene
    const pegados = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft: { ...draft, accesos: [
      { id: '1', nombre: 'Web', url: 'http://x.com' },
      { id: '2', nombre: '', url: 'drive.google.com/drive/folders/1AbCdEfGhIjK' },
      { id: '3', nombre: '', url: '' },
      { id: '4', nombre: 'Roto', url: 'no es un link' },
    ] } });
    expect('doc' in pegados && pegados.doc.accesos).toEqual([
      { nombre: 'Web', url: 'https://x.com/' },
      { nombre: 'Carpeta de Drive', url: 'https://drive.google.com/drive/folders/1AbCdEfGhIjK' },
    ]);
    expect(accessIssue({ nombre: 'Web', url: 'http://x.com' })).toBeNull();
    expect(accessIssue({ nombre: 'Roto', url: 'no es un link' })).toContain('link');
    expect(accessIssue({ nombre: 'Algo', url: '' })).toContain('link');
    expect(accessIssue({ nombre: '', url: '' })).toBeNull();
    expect(normalizeLinkInput('app.asana.com/0/1')).toBe('https://app.asana.com/0/1');
    expect(draftAccesos({ enlaces: {}, accesos: [] })).toEqual([]);
  });

  it('accesos: el ícono sale del link o del nombre', () => {
    expect(accessIcon('Contenido', 'https://app.asana.com/0/1')).toBe('calendar');
    expect(accessIcon('Tu carpeta', 'https://drive.google.com/drive/folders/x')).toBe('drive');
    expect(accessIcon('Métricas', 'https://docs.google.com/spreadsheets/d/x')).toBe('sheet');
    expect(accessIcon('Brief', 'https://docs.google.com/document/d/x')).toBe('doc');
    expect(accessIcon('Perfil', 'https://www.instagram.com/estudio')).toBe('instagram');
    expect(accessIcon('Diseño de marca', 'https://www.figma.com/file/x')).toBe('design');
    expect(accessIcon('Resultados del mes', 'https://lookerstudio.google.com/x')).toBe('chart');
    expect(accessIcon('Tu web', 'https://estudio.com.ar')).toBe('web');
    expect(accessIcon('Algo', '')).toBe('link');
    expect(accessHost('https://www.figma.com/file/x')).toBe('figma.com');
  });

  it('logo, color y reunión: solo lo seguro llega al portal', () => {
    const logo = 'data:image/png;base64,iVBORw0KGgo=';
    const r = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft: { ...emptyPortalDraft('a@b.com'), logo, marca: '#C2410C', linkReunion: 'meet.google.com/abc-defg-hij' } });
    expect('doc' in r && [r.doc.logo, r.doc.marca, r.doc.linkReunion]).toEqual([logo, '#c2410c', 'https://meet.google.com/abc-defg-hij']);
    expect(safeLogo('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(safeLogo(`data:image/png;base64,${'A'.repeat(210_000)}`)).toBeNull();
    const bad = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft: { ...emptyPortalDraft('a@b.com'), marca: 'red; x', linkReunion: 'javascript:alert(1)' } });
    expect('doc' in bad && [bad.doc.marca, bad.doc.linkReunion]).toEqual([null, null]);
    expect(calendarLink({ fecha: '2026-11-10', hora: '10:30' }, 'Reunión', 'https://meet.google.com/x')).toContain('dates=20261110T103000%2F20261110T113000');
    if ('doc' in r) expect(dirtyOf({ ...emptyPortalDraft('a@b.com'), logo, marca: '#c2410c', linkReunion: 'meet.google.com/abc-defg-hij' }, r.doc)).toBe(false);
    if ('doc' in r) expect(dirtyOf({ ...emptyPortalDraft('a@b.com'), marca: '#c2410c', linkReunion: 'meet.google.com/abc-defg-hij' }, r.doc)).toBe(true);
  });

  it('clientes Web: ID WEB-### válido y el siguiente libre', () => {
    expect(CLIENTE_ID_RE.test('WEB-001')).toBe(true);
    expect(CLIENTE_ID_RE.test('WEB-PRUEBA-001')).toBe(false);
    expect(suggestWebClienteId(['PAF-004', 'WEB-001', 'WEB-007'])).toBe('WEB-008');
    expect(suggestWebClienteId([])).toBe('WEB-001');
  });

  it('tareas simples: link opcional (solo https) y sin fecha no vencen', () => {
    const r = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft, tareas: publicTasks([
      { id: '1', titulo: 'Con link', estado: 'habilitada', link: 'https://drive.google.com/x' },
      { id: '2', titulo: 'Link raro', estado: 'habilitada', link: 'javascript:alert(1)' },
    ]) });
    expect('doc' in r && r.doc.tareas.map((t) => t.link)).toEqual(['https://drive.google.com/x', undefined]);
    expect('doc' in r && r.doc.tareasHabilitadas).toEqual(['1', '2']);
    expect(isOverdue({ estado: 'habilitada' }, '2026-11-03')).toBe(false);
  });

  it('el documento público nunca lleva montos ni pagos', () => {
    const project = {
      id: 'p', clientName: 'E', pafClienteId: 'PAF-002', pafPortal: draft,
      montoAcordado: 400, estimatedPrice: 400, estimatedCurrency: 'USD', payments: [{ amount: 400 }], installments: [{ amount: 400 }],
      billingAgreement: { amount: 400 }, notes: 'nota privada',
    } as any;
    const r = portalFromProject(project, []);
    if (!('doc' in r)) throw new Error(r.errors.join());
    const json = JSON.stringify(r.doc);
    for (const k of ['monto', 'amount', 'price', 'payments', 'installments', 'billing', 'currency', 'nota privada']) expect(json.toLowerCase()).not.toContain(k.toLowerCase());
  });
});

describe('portal restaurado: mostrar avance', () => {
  it('por defecto se muestra; si Juan lo apaga, el portal lo oculta', () => {
    const on = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft });
    expect('doc' in on && on.doc.mostrarAvance).toBe(true);
    const off = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft: { ...draft, mostrarAvance: false } });
    expect('doc' in off && off.doc.mostrarAvance).toBe(false);
  });
});

describe('portal según el método: hitos, secciones y lo que no compromete', () => {
  const base = { ...emptyPortalDraft('a@b.com') };
  it('el avance se cuenta por hitos confirmados, sin repetir ni fuera de rango', () => {
    const r = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft: base, hitosCompletados: [2, 1, 2, 9] });
    expect('doc' in r && r.doc.hitosCompletados).toEqual([1, 2]);
  });
  it('lo oculto no viaja al navegador del cliente', () => {
    const draft = { ...base, secciones: { entregas: false, anuncios: false, reportes: false }, reunionesAcordadas: 8 };
    const r = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft,
      entregas: [{ id: 'e', titulo: 'Kit' }], anuncios: [{ id: 'a', texto: 'Hola', fecha: '2026-11-03' }], reunionesHechas: 3,
      reportes: [{ id: 'r', desde: '2026-11-01', hasta: '2026-11-07', hicimos: 'x', aprobaste: '', falta: '', viene: '', numeros: '', publicado: true, creadoEn: '' }] });
    if (!('doc' in r)) throw new Error('sin doc');
    expect(r.doc.entregas).toEqual([]);
    expect(r.doc.anuncios).toEqual([]);
    expect(r.doc.reportes).toEqual([]);
    expect(r.doc.reunionesAcuerdo).toBeNull(); // apagado por defecto: no compromete
    const conAcuerdo = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft: { ...draft, secciones: { reunionesAcuerdo: true } }, reunionesHechas: 3 });
    expect('doc' in conAcuerdo && conAcuerdo.doc.reunionesAcuerdo).toEqual({ total: 8, hechas: 3 });
  });
  it('materiales y gestión de contenido solo con links válidos', () => {
    const r = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft: { ...base, materiales: { proyectos: 'drive.google.com/drive/folders/abc', equipo: 'no' }, gestionContenido: 'app.asana.com/0/1' } });
    if (!('doc' in r)) throw new Error('sin doc');
    expect(r.doc.materiales).toEqual({ proyectos: 'https://drive.google.com/drive/folders/abc' });
    expect(r.doc.gestionContenido).toBe('https://app.asana.com/0/1');
  });
});
