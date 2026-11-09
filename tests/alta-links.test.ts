import { describe, expect, it } from 'vitest';
import { _titulosQueAbren, aplicarAlta, linkDeTarea } from '../src/portal/altaLinks';
import { publicTasks } from '../src/portal/model';

let n = 0;
const id = () => `a${n++}`;
const D = (x: string) => `https://drive.google.com/drive/folders/${x}`;
const draft: any = { emails: [], hito: 1, resumen: '', enlaces: {}, accesos: [] };
const alta = {
  carpetaCompartida: D('raiz'), carpetaInterna: D('interna'), ficha: D('ficha'),
  materiales: D('mat'), paraCompletar: D('pc'), resultados: D('res'),
  proyectos: D('proy'), equipo: D('eq'), referencias: D('ref'), registro: D('reg'),
  excelClienteIdeal: 'https://docs.google.com/spreadsheets/d/excel',
};

describe('links del alta en la ficha y el portal', () => {
  it('guarda todo y lo reparte en el portal', () => {
    const tareas: any[] = [{ id: 't', titulo: 'Completar el Excel de cliente ideal (las partes que vimos juntos)', estado: 'borrador' }];
    const r = aplicarAlta({ pafTareas: tareas }, draft, alta, id)!;
    expect(r.pafDrive).toMatchObject({ carpetaCompartida: D('raiz'), paraCompletar: D('pc'), resultados: D('res'), excelClienteIdeal: alta.excelClienteIdeal, subcarpetas: { proyectos: D('proy'), equipo: D('eq'), referencias: D('ref'), registro: D('reg') } });
    expect(r.draft.accesos.map((a: any) => a.nombre)).toEqual(['Tu carpeta', 'Para completar', 'Materiales', 'Resultados']);
    expect(r.draft.accesos.some((a: any) => a.url === D('interna') || a.url === D('ficha'))).toBe(false); // lo privado nunca
    expect(r.draft.materiales).toEqual({ proyectos: D('proy'), equipo: D('eq'), referencias: D('ref'), registro: D('reg') });
    expect(r.draft.enlaces).toMatchObject({ carpeta: D('raiz'), materiales: D('mat'), resultados: D('res') });
    expect(r.pafTareas![0].link).toBe(alta.excelClienteIdeal);
  });

  it('solo agrega lo nuevo (lo que sacaste del portal no vuelve)', () => {
    const primera = aplicarAlta({}, draft, alta, id)!;
    expect(aplicarAlta({ pafDrive: primera.pafDrive }, { ...draft, accesos: [] }, alta, id)).toBeNull();
  });

  it('con el script viejo (solo carpeta y Materiales) también funciona', () => {
    const r = aplicarAlta({}, draft, { carpetaCompartida: D('raiz'), materiales: D('mat') }, id)!;
    expect(r.draft.accesos.map((a: any) => a.nombre)).toEqual(['Tu carpeta', 'Materiales']);
    expect(r.draft.materiales).toEqual({});
  });

  it('una tarea que se empieza después abre su Excel', () => {
    expect(linkDeTarea('Completar el Excel de cliente ideal (las partes que vimos juntos)', { excelClienteIdeal: alta.excelClienteIdeal })).toBe(alta.excelClienteIdeal);
    expect(linkDeTarea('Otra', { excelClienteIdeal: alta.excelClienteIdeal })).toBeUndefined();
    expect(_titulosQueAbren().every(Boolean)).toBe(true);
    expect(publicTasks([{ id: 'x', titulo: 'x', estado: 'habilitada', link: alta.excelClienteIdeal } as any])[0].link).toBe(alta.excelClienteIdeal);
  });
});
