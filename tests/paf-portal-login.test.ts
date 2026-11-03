import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPafPortal, emptyPortalDraft, normalizeEmails, type PafPortalDraft } from '../src/portal/model';

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
