import { describe, expect, it } from 'vitest';
import { PRESENCIA_TEMAS, faseDelTema, kitDelTema, temaPorId, temasDelAlcance } from '../src/portal/presencia';
import { buildEjemplo, EJEMPLO_ID } from '../src/portal/ejemplo';
import { CLIENTE_ID_RE, PRESENCIA_HITOS, portalFromProject } from '../src/portal/model';
import { buildNewClientProject } from '../src/utils/newClient';
import { conHistorial } from '../src/portal/historial';

describe('plan de Presencia', () => {
  it('9 temas repartidos en los 5 hitos, cada uno con su checklist', () => {
    expect(PRESENCIA_TEMAS).toHaveLength(9);
    expect(new Set(PRESENCIA_TEMAS.map((t) => t.hito))).toEqual(new Set([1, 2, 3, 4, 5]));
    PRESENCIA_TEMAS.forEach((t) => expect(t.completoCuando.length).toBeGreaterThan(0));
  });

  it('lo no contratado no aparece', () => {
    expect(temasDelAlcance([]).map((t) => t.id)).toEqual(['arranque', 'cliente_ideal', 'diagnostico', 'mensaje', 'cierre']);
    expect(temasDelAlcance(['contenido']).map((t) => t.id)).toContain('instagram');
    expect(temasDelAlcance(['web']).map((t) => t.id)).not.toContain('google');
  });

  it('empezar un tema carga sus tareas ocultas y sus entregas, sin repetir', () => {
    let n = 0;
    const id = () => `x${++n}`;
    const kit = kitDelTema(temaPorId('cliente_ideal'), { tareas: [], entregas: [] }, id);
    expect(kit.tareas.every((t) => t.estado === 'borrador' && t.tema === 'cliente_ideal')).toBe(true);
    expect(kit.entregas[0]).toMatchObject({ titulo: 'Kit de cliente ideal, nicho y oferta', publicada: false, tema: 'cliente_ideal' });
    const otra = kitDelTema(temaPorId('cliente_ideal'), { tareas: kit.tareas, entregas: kit.entregas }, id);
    expect(otra.tareas).toEqual([]);
    expect(otra.entregas).toEqual([]);
  });

  it('fase del tema: sin empezar, esperando al cliente, en curso y completo', () => {
    const t = temaPorId('diagnostico');
    expect(faseDelTema(t, undefined, [])).toBe('sin_empezar');
    expect(faseDelTema(t, { empezado: '2026-11-01' }, [{ tema: 'diagnostico', estado: 'habilitada' }])).toBe('esperando');
    expect(faseDelTema(t, { empezado: '2026-11-01' }, [{ tema: 'diagnostico', estado: 'habilitada', responsable: 'cero' }])).toBe('en_curso');
    expect(faseDelTema(t, { empezado: '2026-11-01', checks: [true, true, true] }, [])).toBe('completo');
  });

  it('un PAF nuevo arranca con su alcance y el tema Arranque empezado', () => {
    const p = buildNewClientProject({ tipo: 'paf', plan: 'paf_pro', estudio: 'E', contacto: '', email: 'a@b.com', whatsapp: '', monto: 0, moneda: 'USD', modo: 'unico', primerCobro: '2026-11-03', cuotas: 1, nota: '', alcance: ['google'] }, new Date('2026-11-03T12:00:00Z'));
    expect(p.pafAlcance).toEqual(['google']);
    expect(p.pafTemas?.arranque?.empezado).toBe('2026-11-03');
    expect(p.pafTareas?.map((t) => t.tema)).toEqual(['arranque', 'arranque', 'arranque']);
  });

  it('el historial suma arriba y no crece sin fin', () => {
    const h = conHistorial({ pafHistorial: Array.from({ length: 200 }, (_, i) => ({ fecha: '', texto: `v${i}` })) }, 'nuevo');
    expect(h.pafHistorial[0].texto).toBe('nuevo');
    expect(h.pafHistorial).toHaveLength(200);
  });
});

describe('cliente de ejemplo', () => {
  const { project, meetings } = buildEjemplo('Juan@Gmail.com', new Date('2026-11-03T12:00:00'));
  it('tiene ID de ejemplo válido y se publica solo para tu correo', () => {
    expect(CLIENTE_ID_RE.test(EJEMPLO_ID)).toBe(true);
    const r = portalFromProject({ ...project, id: 'p' }, meetings.map((m) => ({ ...m, projectId: 'p' })));
    if (!('doc' in r)) throw new Error(r.errors.join());
    expect(r.doc.emailsAutorizados).toEqual(['juan@gmail.com']);
    expect(r.doc.hitosCompletados).toEqual([1]);
    expect(r.doc.proximaReunion).toMatchObject({ fecha: '2026-11-09', objetivo: 'Mostrar el kit y el diagnóstico, y decidir qué priorizar' });
    expect(r.doc.tareas.find((t) => t.prioritaria)?.titulo).toBe('Pasarnos referencias y competidores');
    expect(r.doc.entregas).toHaveLength(1); // el informe sin publicar no viaja
    expect(PRESENCIA_HITOS[r.doc.hitoVisible - 1]).toBe('Definimos el foco');
  });
  it('sus reuniones nunca van a Calendar y nada privado viaja', () => {
    expect(meetings.every((m) => m.sinCalendar)).toBe(true);
    const r = portalFromProject({ ...project, id: 'p' }, meetings.map((m) => ({ ...m, projectId: 'p' })));
    const json = JSON.stringify('doc' in r ? r.doc : {});
    expect(json).not.toContain('Martín no conoce el Excel'); // preparación privada
    expect(json).not.toContain('Cruzarlo con el diagnóstico'); // próxima acción privada
    expect(json).not.toContain('Hito confirmado'); // historial privado
  });
});
