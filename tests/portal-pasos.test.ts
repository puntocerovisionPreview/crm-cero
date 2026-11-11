import { describe, expect, it } from 'vitest';
import { CARTA_SOLA, armarPasos, cartaDe, cartasEnUso, pasosPorHito, publicPasos } from '../src/portal/pasos';
import { publicDeliveries, publicTasks, type PafDelivery, type PafTask } from '../src/portal/model';

const t = (x: Partial<PafTask> & { id: string }): PafTask => ({ titulo: x.id, estado: 'habilitada', ...x });
const e = (x: Partial<PafDelivery> & { id: string }): PafDelivery => ({ titulo: x.id, publicada: true, ...x });

describe('cartas del portal', () => {
  it('por defecto, la tarea y la devolución del mismo tema van en la misma carta', () => {
    const tareas = [t({ id: 't1', tema: 'cliente_ideal', titulo: 'Completá el kit' })];
    const entregas = [e({ id: 'e1', tema: 'cliente_ideal', titulo: 'Devolución del kit' })];
    const pub = { tareas: publicTasks(tareas), entregas: publicDeliveries(entregas), pasos: publicPasos(tareas, entregas) };
    expect(pub.tareas[0].paso).toBe('cliente_ideal');
    expect(pub.entregas[0].paso).toBe('cliente_ideal');
    const cartas = armarPasos(pub);
    expect(cartas).toHaveLength(1);
    expect(cartas[0].tareas).toHaveLength(1);
    expect(cartas[0].entregas).toHaveLength(1);
    expect(cartas[0].estado).toBe('te_toca');
  });

  it('Juan puede dejar algo solo, juntarlo con otra cosa o inventar una carta', () => {
    expect(cartaDe(t({ id: 'a', tema: 'cliente_ideal', carta: CARTA_SOLA }), 't').id).toBe('t:a');
    expect(cartaDe(t({ id: 'a', carta: 'diagnóstico, competencia y metas' }), 't').id).toBe('diagnostico');
    const libre = cartaDe(t({ id: 'a', carta: '  Fotos   del estudio ' }), 't');
    expect(libre).toEqual({ id: 'c:fotos del estudio', titulo: 'Fotos del estudio' });
    expect(cartaDe(e({ id: 'b', carta: 'fotos del estudio' }), 'e').id).toBe(libre.id);
    expect(cartasEnUso([t({ id: 'a', carta: 'Fotos del estudio' })], [e({ id: 'b', tema: 'diagnostico' })])).toEqual(['Fotos del estudio', 'Diagnóstico, competencia y metas']);
  });

  it('lo suelto no publica carta y lo oculto no aparece', () => {
    const tareas = [t({ id: 'x' }), t({ id: 'y', tema: 'mensaje', estado: 'borrador' })];
    const entregas = [e({ id: 'z', tema: 'web', publicada: false })];
    expect(publicPasos(tareas, entregas)).toEqual([]);
    expect(publicTasks(tareas)[0].paso).toBeUndefined();
    expect(JSON.stringify(publicTasks(tareas))).not.toContain('mensaje');
  });

  it('va primero lo prioritario, después lo que le toca, lo que revisa, lo nuestro y lo cerrado', () => {
    const cartas = armarPasos({
      tareas: [
        { id: 'listo', titulo: 'Listo', estado: 'aprobada' },
        { id: 'nuestro', titulo: 'Nuestro', estado: 'enviada' },
        { id: 'toca', titulo: 'Toca', estado: 'habilitada' },
        { id: 'prio', titulo: 'Prio', estado: 'habilitada', prioritaria: true },
      ],
      entregas: [{ id: 'rev', titulo: 'Revisar', decision: '¿Aprobás?' }],
    });
    expect(cartas.map((c) => c.id)).toEqual(['t:prio', 't:toca', 'e:rev', 't:nuestro', 't:listo']);
    expect(cartas.every((c) => c.solo)).toBe(true);
  });

  it('una tarea que hace .CERO no le toca al cliente', () => {
    const [c] = armarPasos({ tareas: [{ id: 'a', titulo: 'A', estado: 'habilitada', responsable: 'cero' }] });
    expect(c.estado).toBe('nosotros');
  });

  it('si el portal viejo no tiene cartas, cada cosa va sola', () => {
    const cartas = armarPasos({ tareas: [{ id: 'a', titulo: 'A', estado: 'habilitada', paso: 'mensaje' }] });
    expect(cartas[0].id).toBe('t:a');
  });

  it('lo cerrado se agrupa por hito del programa', () => {
    const listos = armarPasos({
      pasos: [{ id: 'arranque', titulo: 'Arranque', hito: 1 }, { id: 'mensaje', titulo: 'Mensaje', hito: 3 }],
      tareas: [
        { id: 'a', titulo: 'A', estado: 'aprobada', paso: 'mensaje' },
        { id: 'b', titulo: 'B', estado: 'aprobada', paso: 'arranque' },
        { id: 'c', titulo: 'C', estado: 'aprobada' },
      ],
    });
    const grupos = pasosPorHito(listos);
    expect(grupos.map((g) => g.pasos.map((p) => p.id))).toEqual([['arranque'], ['mensaje'], ['t:c']]);
    expect(grupos[2].titulo).toBe('Otras cosas');
  });
});
