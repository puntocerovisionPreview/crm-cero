import { describe, expect, it } from 'vitest';
import { hoyAcordamos, mensaje, tareasDeSuLado } from '../src/portal/mensajes';
import { estadoCliente } from '../src/components/ProximaAccionCard';
import { draftReporte, reporteTexto } from '../src/components/PafReportes';
import { hitosCompletados, nextMeeting, meetingPorConfirmar, publicTasks } from '../src/portal/model';

describe('Hoy acordamos', () => {
  it('arma el mensaje con la plantilla y la próxima reunión', () => {
    const txt = hoyAcordamos({ nombre: 'Ana', decisiones: 'Foco en vivienda\n- Tono cercano', deTuLado: 'Subir fotos — 12/11', deNuestroLado: 'Borrador del mensaje', proxima: { fecha: '2026-11-10', hora: '10:30' } });
    expect(txt.split('\n')).toEqual([
      '¡Gracias, Ana! Hoy acordamos:',
      '✅ Foco en vivienda',
      '✅ Tono cercano',
      '📌 De tu lado: Subir fotos — 12/11',
      '📌 De nuestro lado: Borrador del mensaje',
      expect.stringMatching(/^📅 Próxima reunión: martes,? 10 de noviembre a las 10:30/),
      'Cualquier duda, me escribís por acá.',
    ]);
  });
  it('lo de su lado se vuelve tareas, con fecha si la tiene', () => {
    expect(tareasDeSuLado('Subir fotos — 12/11\nElegir 3 proyectos\n', 2026)).toEqual([
      { titulo: 'Subir fotos', fecha: '2026-11-12' },
      { titulo: 'Elegir 3 proyectos' },
    ]);
  });
  it('los mensajes preparados dejan entre corchetes lo que no se sabe', () => {
    const m = mensaje('devolucion', { nombre: 'Ana', portal: 'https://x/portal', entrega: { titulo: 'Kit', version: 'v2', decision: 'si este foco te representa', canal: 'mail', hasta: '2026-11-07' } });
    expect(m).toContain('Kit (v2)');
    expect(m).toContain('si este foco te representa');
    expect(m).toContain('por mail hasta el 7 de noviembre');
    expect(mensaje('pedirMaterial', { nombre: 'Ana', portal: 'p' })).toContain('[subcarpeta de Materiales]');
  });
});

describe('próxima acción y lista de clientes', () => {
  const today = '2026-11-03';
  const accion = (x: object) => ({ texto: 'X', responsable: 'yo' as const, actualizada: '', ...x });
  it('clasifica: bloqueado, mi acción, esperando, sin acción', () => {
    expect(estadoCliente({ proximaAccion: accion({ bloqueado: true }) }, today)).toBe('bloqueado');
    expect(estadoCliente({ proximaAccion: accion({}) }, today)).toBe('mi_accion');
    expect(estadoCliente({ proximaAccion: accion({ responsable: 'cliente' }) }, today)).toBe('esperando');
    expect(estadoCliente({ proximaAccion: accion({ responsable: 'cm', fecha: '2026-11-01' }) }, today)).toBe('mi_accion'); // venció
    // Si el cliente avisó que terminó algo, te toca a vos aunque la acción sea suya
    expect(estadoCliente({ proximaAccion: accion({ responsable: 'cliente' }), pafTareas: [{ id: 't', titulo: 'x', estado: 'enviada' }] }, today)).toBe('mi_accion');
    expect(estadoCliente({}, today)).toBe('sin_accion');
  });
});

describe('reporte del viernes', () => {
  it('se arma con la semana y no inventa números', () => {
    const project: any = {
      id: 'p', clientName: 'Estudio', ownerName: 'Ana',
      pafTareas: [
        { id: '1', titulo: 'Formulario', estado: 'aprobada', aprobacion: { fecha: '2026-11-05', canal: 'Portal' } },
        { id: '2', titulo: 'Subir fotos', estado: 'habilitada', fecha: '2026-11-12' },
        { id: '3', titulo: 'Lo hace la CM', estado: 'habilitada', responsable: 'cm' },
      ],
      pafEntregas: [{ id: 'e', titulo: 'Kit', version: 'v1', publicada: true, fecha: '2026-11-04' }],
    };
    const meetings: any[] = [{ projectId: 'p', date: '2026-11-11', time: '10:00', completed: false, objetivo: 'Revisar el kit', title: 'R' }];
    const r = draftReporte(project, meetings, '2026-11-07');
    expect(r.desde).toBe('2026-11-01');
    expect(r.hicimos).toBe('- Te compartimos Kit (v1)');
    expect(r.aprobaste).toBe('- Formulario');
    expect(r.falta).toBe('- Subir fotos — para el 12/11');
    expect(r.viene).toBe('- Reunión del 11/11 a las 10:00: Revisar el kit');
    expect(r.numeros).toBe('');
    expect(reporteTexto(r, 'Estudio', 'Ana')).toContain('Asunto: Estudio · Periodo 01/11 a 07/11 · Resumen');
  });
});

describe('modelo del método', () => {
  it('la reunión lleva objetivo y preparación; la propuesta se ve por confirmar', () => {
    const ms: any[] = [
      { projectId: 'p', date: '2026-11-10', time: '10:30', completed: false, objetivo: 'Mensaje', preparar: '3 proyectos', conCM: true },
      { projectId: 'p', date: '2026-11-20', completed: false, proposed: true, objetivo: 'Cierre' },
    ];
    expect(nextMeeting(ms, 'p', '2026-11-03')).toEqual({ fecha: '2026-11-10', hora: '10:30', objetivo: 'Mensaje', preparar: '3 proyectos', conCM: true });
    expect(meetingPorConfirmar(ms, 'p')).toEqual({ objetivo: 'Cierre' });
  });
  it('la prioritaria solo cuenta si está disponible; para qué y quién viajan', () => {
    const t = publicTasks([{ id: '1', titulo: 'A', estado: 'habilitada', prioritaria: true, paraQue: 'X', responsable: 'cm' }, { id: '2', titulo: 'B', estado: 'aprobada', prioritaria: true, aprobacion: { fecha: '2026-11-01', canal: 'Portal' } }] as any);
    expect(t[0]).toMatchObject({ prioritaria: true, paraQue: 'X', responsable: 'cm' });
    expect(t[1].prioritaria).toBeUndefined();
  });
  it('hitos completados sin repetir', () => {
    expect(hitosCompletados([{ hito: 3, fecha: '', evidencia: '' }, { hito: 1, fecha: '', evidencia: '' }, { hito: 3, fecha: '', evidencia: '' }])).toEqual([1, 3]);
  });
});
