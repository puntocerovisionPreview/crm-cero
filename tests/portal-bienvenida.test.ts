import { describe, expect, it } from 'vitest';
import { bloquesBienvenida } from '../src/portal/bienvenida';
import { buildPafPortal } from '../src/portal/model';

describe('bienvenida escrita', () => {
  it('separa párrafos por línea en blanco y reconoce los títulos cortos', () => {
    const b = bloquesBienvenida('Qué bueno tenerte acá.\r\n\r\nCómo trabajamos\n\nNos vemos cada dos semanas.\nTe aviso cuando haya algo.\n\n\n');
    expect(b).toEqual([
      { tipo: 'parrafo', texto: 'Qué bueno tenerte acá.' },
      { tipo: 'titulo', texto: 'Cómo trabajamos' },
      { tipo: 'parrafo', texto: 'Nos vemos cada dos semanas.\nTe aviso cuando haya algo.' },
    ]);
    expect(bloquesBienvenida('')).toEqual([]);
    expect(bloquesBienvenida(null)).toEqual([]);
  });

  it('viaja al portal recortada, y vacía no viaja', () => {
    const draft = { emails: ['a@b.com'], hito: 1, resumen: '', enlaces: {} };
    const con = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft: { ...draft, bienvenidaTexto: '  Hola.  ' } });
    const sin = buildPafPortal({ clienteId: 'PAF-002', estudio: 'E', draft: { ...draft, bienvenidaTexto: '   ' } });
    expect('doc' in con && con.doc.bienvenidaTexto).toBe('Hola.');
    expect('doc' in sin && sin.doc.bienvenidaTexto).toBeNull();
  });
});
