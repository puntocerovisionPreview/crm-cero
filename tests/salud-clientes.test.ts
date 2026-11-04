import { describe, expect, it } from 'vitest';
import { clientesSinEntrar, haceDias, saludCliente, textoVisita } from '../src/portal/salud';
import { recordatorioPagos } from '../src/automation/recordatorios';
import { recordatorioPendientes } from '../src/portal/mensajes';
import { itemsClientesHoy } from '../src/automation/clientes';

const today = '2026-11-04';
const base: any = { id: 'p', clientName: 'Estudio Río', serviceType: 'paf', archived: false, pafClienteId: 'PAF-002', proximaAccion: { texto: 'Revisar', responsable: 'yo', actualizada: '' } };
const portal = { pafPortal: { emails: [], hito: 1, resumen: '', enlaces: {}, publishedAt: '2026-10-20T10:00:00.000Z' } };
const reunion = (date: string, completed = true): any => ({ id: date, projectId: 'p', title: 'R', date, completed });

describe('salud del cliente', () => {
  it('todo en orden: sin motivos', () => {
    const s = saludCliente({ ...base, ...portal } as any, { meetings: [reunion('2026-11-01'), reunion('2026-11-10', false)], visita: { id: 'PAF-002', ultima: '2026-11-03T12:00:00Z' }, today });
    expect(s).toEqual({ nivel: 'ok', motivos: [] });
  });

  it('riesgo primero: cuota atrasada y nunca entró al portal', () => {
    const p = { ...base, ...portal, installments: [{ id: 'c', number: 1, dueDate: '2026-11-01', amount: 100, paid: false }], proximaAccion: undefined };
    const s = saludCliente(p as any, { meetings: [reunion('2026-11-01'), reunion('2026-11-10', false)], today });
    expect(s.nivel).toBe('riesgo');
    expect(s.motivos.map((m) => m.texto)).toEqual(['Cuota atrasada desde el 01/11', 'Nunca entró a su portal (publicado el 20/10)', 'Sin próxima acción definida']);
  });

  it('tareas vencidas, sin reunión y fin del programa', () => {
    const p = { ...base, deliveryDate: '2026-11-12', pafTareas: [{ id: 't', titulo: 'Excel', estado: 'habilitada', fecha: '2026-11-02' }] };
    const s = saludCliente(p as any, { meetings: [reunion('2026-10-10')], today });
    expect(s.nivel).toBe('atencion');
    expect(s.motivos.map((m) => m.texto)).toEqual(['Tarea vencida: «Excel» (hace 2 días)', 'Sin reunión hace 25 días y nada agendado', 'Termina el programa el 12/11: hablá de cómo sigue']);
  });

  it('textos de la visita', () => {
    expect(haceDias('2026-11-04T09:00:00Z', today)).toBe('hoy');
    expect(haceDias('2026-11-03T09:00:00Z', today)).toBe('ayer');
    expect(textoVisita(portal as any, { id: 'x', ultima: '2026-10-30T09:00:00Z' }, today)).toBe('Entró al portal hace 5 días');
    expect(textoVisita(portal as any, undefined, today)).toBe('Todavía no entró al portal');
    expect(textoVisita({} as any, undefined, today)).toBeNull();
  });

  it('el lunes: quién no entra y tiene tareas pendientes', () => {
    const p = { ...base, ...portal, pafTareas: [{ id: 't', titulo: 'Fotos', estado: 'habilitada' }] };
    expect(clientesSinEntrar([p] as any, [{ id: 'PAF-002', ultima: '2026-10-20T10:00:00Z' }], today).map((x) => x.texto)).toEqual(['Estudio Río: no entra hace 15 días y tiene 1 tarea pendiente']);
    expect(clientesSinEntrar([p] as any, [{ id: 'PAF-002', ultima: '2026-11-01T10:00:00Z' }], today)).toEqual([]);
    expect(clientesSinEntrar([{ ...p, pafTareas: [] }] as any, [], today)).toEqual([]);
  });
});

describe('pagos personales en el aviso de pagos', () => {
  const rec = (x: object): any => ({ id: 'r', title: 'Alquiler', type: 'gasto', amount: 300000, currency: 'ARS', accountId: 'a', categoryId: 'c', frequency: 'mensual', nextDate: today, active: true, ...x });
  it('suma los recurrentes personales (solo gastos activos)', () => {
    const r = recordatorioPagos([], today, 9 * 60, [rec({}), rec({ title: 'Sueldo', type: 'ingreso' }), rec({ title: 'Viejo', active: false })])!;
    expect(r.title).toBe('💳 Alquiler vence hoy');
    expect(r.body).toContain('Alquiler: $ 300.000 (personal)');
    expect(r.body).not.toContain('Sueldo');
    expect(r.body).toContain('Mis finanzas → Recurrentes');
    expect(r.url).toBe('/mis-finanzas/recurrentes');
  });
  it('mezclados: un solo aviso', () => {
    const r = recordatorioPagos([{ id: 'f', name: 'Hosting', amount: 10, currency: 'USD', active: true, nextDueDate: '2026-11-02' } as any], today, 9 * 60, [rec({})])!;
    expect(r.title).toBe('💳 2 pagos vencidos o de hoy');
    expect(r.url).toBe('/dinero');
  });
});

describe('recordarle lo pendiente', () => {
  it('arma el WhatsApp con las vencidas primero', () => {
    const txt = recordatorioPendientes('Ana', [{ titulo: 'Fotos', fecha: '2026-11-10' }, { titulo: 'Excel', fecha: '2026-11-01' }, { titulo: 'Logo' }], 'https://x/portal', today);
    const lineas = txt.split('\n');
    expect(lineas[0]).toContain('¡Hola Ana!');
    expect(lineas[1]).toMatch(/^• Excel \(era para el /);
    expect(lineas[2]).toMatch(/^• Fotos \(para el /);
    expect(lineas[3]).toBe('• Logo');
    expect(txt).toContain('https://x/portal');
    expect(recordatorioPendientes('Ana', [], '', today)).toBe('');
  });
});

describe('tus clientes hoy (Inicio)', () => {
  it('cada cosa lleva a su cliente', () => {
    const items = itemsClientesHoy([{ ...base, pafTareas: [{ id: '1', titulo: 'Excel', estado: 'enviada' }] }] as any, [{ id: 'm', projectId: 'p', title: 'R', date: today, time: '10:00', completed: false } as any], today);
    expect(items).toEqual([
      { projectId: 'p', tipo: 'revisar', texto: 'Estudio Río terminó «Excel»: revisala' },
      { projectId: 'p', tipo: 'reunion', texto: '10:00 reunión con Estudio Río', nota: 'sin preparar' },
    ]);
  });
});
