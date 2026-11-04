import { describe, expect, it } from 'vitest';
import { acuerdosSinAnotar, buildClientesHoy, buildClientesSemana, meetingNudges, reportesQueFaltan } from '../src/automation/clientes';

const base: any = { id: 'p', clientName: 'Estudio Río', serviceType: 'paf', projectType: 'paf_pro', archived: false };
const today = '2026-11-06'; // viernes

describe('avisos de clientes para Juan', () => {
  it('el resumen de las 8 junta lo que necesita una acción tuya', () => {
    const p = {
      ...base,
      pafTareas: [
        { id: '1', titulo: 'Excel', estado: 'enviada' },
        { id: '2', titulo: 'Fotos', estado: 'habilitada', fecha: '2026-11-01' },
      ],
      pafEntregas: [{ id: 'e', titulo: 'Kit', publicada: true, estado: 'en_revision', hasta: '2026-11-06' }],
      proximaAccion: { texto: 'Preparar la devolución', responsable: 'yo', fecha: '2026-11-05', actualizada: '' },
    };
    const meetings: any[] = [
      { id: 'm1', projectId: 'p', title: 'Devolución · Estudio Río', date: today, time: '11:00', completed: false },
      { id: 'm0', projectId: 'p', title: 'Arranque', date: '2026-11-02', time: '10:00', completed: true },
    ];
    const txt = buildClientesHoy([p], meetings, today);
    expect(txt).toContain('<b>Tus clientes hoy</b>');
    expect(txt).toContain('Estudio Río terminó «Excel»: revisala');
    expect(txt).toContain('11:00 reunión con Estudio Río · <i>sin preparar</i>');
    expect(txt).toContain('Anotá lo que acordaron con Estudio Río (reunión del 02/11)');
    expect(txt).toContain('tiene que decidir «Kit» (hoy)');
    expect(txt).toContain('Preparar la devolución (venció el 05/11)');
    expect(txt).toContain('1 tarea vencida de clientes');
    expect(txt).toContain('Hoy es viernes: faltan los reportes de Estudio Río');
  });

  it('nada que hacer, nada que decir; el ejemplo y los archivados no cuentan', () => {
    expect(buildClientesHoy([{ ...base, archived: true, pafTareas: [{ id: '1', titulo: 'x', estado: 'enviada' }] }], [], today)).toBe('');
    expect(buildClientesHoy([{ ...base, ejemplo: true, pafTareas: [{ id: '1', titulo: 'x', estado: 'enviada' }] }], [], today)).toBe('');
  });

  it('acuerdos: una reunión con resumen anotado ya no aparece', () => {
    const m: any[] = [{ id: 'm', projectId: 'p', title: 'R', date: '2026-11-02', completed: true }];
    expect(acuerdosSinAnotar([{ ...base, pafResumenes: [{ id: 'r', fecha: '2026-11-02', acuerdos: 'x', proximosPasos: '', publicado: true }] }], m, today)).toEqual([]);
  });

  it('avisa el día anterior para preparar y una hora después para anotar', () => {
    const meetings: any[] = [
      { id: 'mañana', projectId: 'p', title: 'Mensaje · Estudio Río', date: '2026-11-07', time: '10:00', completed: false, objetivo: 'Acordar el tono', prep: { saleCon: 'x' } },
      { id: 'hoy', projectId: 'p', title: 'Devolución', date: today, time: '11:00', durationHours: 1, completed: false },
    ];
    expect(meetingNudges([base], meetings, today, 12 * 60)).toEqual([]); // a las 12 todavía no
    const tarde = meetingNudges([base], meetings, today, 18 * 60 + 5);
    expect(tarde.map((n) => n.key)).toEqual(['prep_mañana', 'acuerdos_hoy']);
    expect(tarde[0].body).toContain('Preparala (1 de 5)');
    expect(tarde[1].title).toBe('¿Anotás lo que acordaron con Estudio Río?');
  });

  it('reportes del viernes: solo los que no lo tienen esta semana', () => {
    const con = { ...base, id: 'q', clientName: 'Con reporte', pafReportes: [{ hasta: '2026-11-05' }] };
    expect(reportesQueFaltan([base, con], today).map((p) => p.clientName)).toEqual(['Estudio Río']);
  });

  it('el plan del domingo trae la semana de cada cliente', () => {
    const p = { ...base, proximaAccion: { texto: 'Aprobar el tope', responsable: 'cliente', necesita: 'Su aprobación del presupuesto', actualizada: '' } };
    const txt = buildClientesSemana([p, { ...base, id: 'z', clientName: 'Sin acción' }], [{ id: 'm', projectId: 'p', title: 'Seguimiento · Estudio Río', date: '2026-11-10', time: '09:00', completed: false } as any], '2026-11-09');
    expect(txt).toContain('10/11 09:00 · Estudio Río: Seguimiento');
    expect(txt).toContain('Esperando a Estudio Río: Su aprobación del presupuesto');
    expect(txt).toContain('Sin acción no tiene próxima acción');
  });
});
