import { describe, expect, it } from 'vitest';
import { nosotrosDe, portalFromProject, seccionesVisibles } from '../src/portal/model';

describe('portal flexible: solo lo importante', () => {
  it('"Mientras tanto, nosotros" sale solo de lo que escribe Juan', () => {
    expect(nosotrosDe('')).toEqual([]);
    expect(nosotrosDe('- Armando tu kit\n\nRevisando tu web\nUna\nOtra')).toEqual([
      { texto: 'Armando tu kit', quien: 'cero' }, { texto: 'Revisando tu web', quien: 'cero' }, { texto: 'Una', quien: 'cero' },
    ]);
  });

  it('el trabajo interno (entregas que se preparan, tareas de .CERO) no se publica solo', () => {
    const project: any = {
      id: 'p', clientName: 'Estudio', pafClienteId: 'PAF-010',
      pafTareas: [{ id: 't', titulo: 'Preparar el informe', estado: 'habilitada', responsable: 'cero' }],
      pafEntregas: [{ id: 'e', titulo: 'Kit', publicada: false, tema: 'cliente_ideal' }],
    };
    const draft: any = { emails: ['a@b.com'], hito: 1, resumen: '', enlaces: {} };
    const sin = portalFromProject(project, [], draft, 'PAF-010') as any;
    expect(sin.doc.enMarcha).toEqual([]);
    const con = portalFromProject(project, [], { ...draft, nosotros: 'Estamos con tu kit' }, 'PAF-010') as any;
    expect(con.doc.enMarcha).toEqual([{ texto: 'Estamos con tu kit', quien: 'cero' }]);
  });

  it('el detalle del recorrido viene apagado (se prende en Ajustes)', () => {
    expect(seccionesVisibles(undefined).recorrido).toBe(false);
    expect(seccionesVisibles({ recorrido: true }).recorrido).toBe(true);
  });
});
