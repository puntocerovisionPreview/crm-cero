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
    const block = rules.slice(rules.indexOf('match /paf_portal/'), rules.indexOf('match /{document=**}'));
    expect(block).toContain('request.auth.token.email in resource.data.emailsAutorizados');
    expect(block).toContain('email_verified == true');
    expect(block).not.toMatch(/allow (create|update|delete|write)/);
    expect(block).not.toContain('if true');
  });
});
