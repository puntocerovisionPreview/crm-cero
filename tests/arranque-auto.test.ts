import { describe, expect, it } from 'vitest';
import { TAREA_BIENVENIDA, TAREA_PROYECTOS, actualizarTareasViejas, habilitarConCarpetas } from '../src/portal/tareasArranque';
import { kitDelTema, temaPorId } from '../src/portal/presencia';
import { publicTasks } from '../src/portal/model';

const ahora = '2026-11-09T12:00:00.000Z';
let n = 0;
const id = () => `x${n++}`;

describe('arranque según la entrega del servicio', () => {
  it('las tareas de arranque ya no piden "3 favoritos" y cada una sube a su carpeta', () => {
    const t = temaPorId('arranque').tareas;
    expect(t.map((x) => x.titulo)).toContain(TAREA_PROYECTOS);
    expect(t.some((x) => /favorit/i.test(x.titulo + (x.detalle || '')))).toBe(false);
    expect(t.find((x) => x.titulo === TAREA_PROYECTOS)!.carpeta).toBe('proyectos');
    expect(t.find((x) => x.titulo.startsWith('Subir tu logo'))!.carpeta).toBe('equipo');
  });

  it('al llegar las carpetas se habilitan la bienvenida y cargar proyectos (con fecha y como prioritaria)', () => {
    const kit = kitDelTema(temaPorId('arranque'), { tareas: [], entregas: [] }, id).tareas;
    const r = habilitarConCarpetas(kit as any, ahora, id)!;
    const bienvenida = r.find((t) => t.titulo === TAREA_BIENVENIDA)!;
    const proyectos = r.find((t) => t.titulo === TAREA_PROYECTOS)!;
    expect(bienvenida.estado).toBe('habilitada');
    expect(proyectos).toMatchObject({ estado: 'habilitada', fecha: '2026-11-16', prioritaria: true, habilitadaEn: ahora });
    expect(r.filter((t) => t.estado === 'borrador').length).toBe(kit.length - 2);
    expect(habilitarConCarpetas(r, ahora, id)).toBeNull(); // ya estaban
  });

  it('a un cliente viejo sin esas tareas se las agrega', () => {
    const r = habilitarConCarpetas([], ahora, id)!;
    expect(r.map((t) => t.titulo)).toEqual([TAREA_BIENVENIDA, TAREA_PROYECTOS]);
  });

  it('reemplaza "Marcar tus 3 proyectos favoritos" por la tarea actual', () => {
    const viejas: any[] = [{ id: 'a', titulo: 'Marcar tus 3 proyectos favoritos en Materiales', estado: 'habilitada', fecha: '2026-11-12' }, { id: 'b', titulo: 'Otra', estado: 'borrador' }];
    const r = actualizarTareasViejas(viejas)!;
    expect(r[0]).toMatchObject({ id: 'a', titulo: TAREA_PROYECTOS, estado: 'habilitada', fecha: '2026-11-12', carpeta: 'proyectos' });
    expect(r[1]).toBe(viejas[1]);
    expect(actualizarTareasViejas(r)).toBeNull();
  });

  it('el portal recibe la carpeta de cada tarea', () => {
    const r = publicTasks([{ id: 'a', titulo: 'x', estado: 'habilitada', pideArchivos: true, carpeta: 'registro' } as any]);
    expect(r[0].carpeta).toBe('registro');
  });
});
