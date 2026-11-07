import { describe, expect, it } from 'vitest';
import {
  accesosDelAlcance, accesosDemorados, mensajeAccesos, semanaDelPrograma, tareasNuestras, temasParaEmpezar, temasSinAgenda,
} from '../src/portal/presenciaAuto';
import { temaPorId } from '../src/portal/presencia';
import { itemsClientesHoy } from '../src/automation/clientes';
import { saludCliente } from '../src/portal/salud';

const today = '2026-11-07';
const base: any = { id: 'p', clientName: 'Estudio Bosque', serviceType: 'paf', archived: false, pafAlcance: ['contenido', 'google', 'web'], proximaAccion: { texto: 'x', responsable: 'yo', actualizada: '' } };

describe('Presencia casi automática', () => {
  it('semana del programa desde el inicio', () => {
    expect(semanaDelPrograma('2026-11-07', today)).toBe(1);
    expect(semanaDelPrograma('2026-10-31', today)).toBe(2);
    expect(semanaDelPrograma('2026-10-17', today)).toBe(4);
  });

  it('qué temas ya toca empezar, según la semana y lo contratado', () => {
    const p = { ...base, startDate: '2026-10-31', pafTemas: { arranque: { empezado: '2026-10-31' } } };
    expect(temasParaEmpezar(p, today).map((t) => t.id)).toEqual(['cliente_ideal', 'diagnostico', 'mensaje', 'contenido']);
    expect(temasParaEmpezar({ ...p, pafAlcance: [] }, today).map((t) => t.id)).toEqual(['cliente_ideal', 'diagnostico', 'mensaje']);
    expect(temasParaEmpezar({ ...p, pafEtapa: 'adquisicion' }, today)).toEqual([]);
    expect(temasParaEmpezar({ ...base }, today)).toEqual([]); // sin inicio, no supone nada
  });

  it('lo tuyo de un tema va a la agenda con fecha (nunca antes de hoy)', () => {
    const ts = tareasNuestras(temaPorId('diagnostico'), base, '2026-11-01', today);
    expect(ts.map((t) => [t.title, t.date])).toEqual([
      ['Pedirle referencias y competidores · Estudio Bosque', today],
      ['Revisar su web, perfiles y competencia con capturas fechadas · Estudio Bosque', today],
      ['Completar el Excel de diagnóstico interno · Estudio Bosque', today],
      ['Escribir el informe de diagnóstico y metas · Estudio Bosque', '2026-11-08'],
    ]);
    expect(ts[0].projectId).toBe('p');
    expect(temasSinAgenda({ ...base, pafTemas: { arranque: { empezado: today }, mensaje: { empezado: today, agendado: today } } }).map((t) => t.id)).toEqual(['arranque']);
  });

  it('accesos según lo contratado, el pedido por WhatsApp y los que no llegan', () => {
    expect(accesosDelAlcance(['google']).map((a) => a.id)).toEqual(['google_business']);
    const txt = mensajeAccesos('Laura', accesosDelAlcance(['contenido']), 'equipo@cero.test');
    expect(txt).toContain('• Instagram: como socio');
    expect(txt).toContain('Nunca nos pases contraseñas');
    expect(mensajeAccesos('Laura', [], 'x')).toBe('');
    const p = { ...base, pafAccesos: { instagram: { estado: 'pedido', fecha: '2026-10-30' }, web: { estado: 'pedido', fecha: '2026-11-05' }, google_business: { estado: 'concedido' } } };
    expect(accesosDemorados(p, today).map((a) => a.id)).toEqual(['instagram']);
    expect(saludCliente(p, { meetings: [], today }).motivos.map((m) => m.texto)).toContain('Faltan accesos que pediste: Instagram');
  });

  it('aparece en "Tus clientes hoy"', () => {
    const p = { ...base, startDate: '2026-10-31', pafTemas: { arranque: { empezado: '2026-10-31' } }, pafAccesos: { instagram: { estado: 'pedido', fecha: '2026-10-30' } } };
    const items = itemsClientesHoy([p], [], today);
    expect(items.map((i) => i.tipo)).toEqual(['plan', 'accesos']);
    expect(items[0].texto).toBe('Estudio Bosque: ya toca empezar Cliente ideal, nicho y oferta, Diagnóstico, competencia y metas, Mensaje y marca, Estrategia de contenido');
  });
});
