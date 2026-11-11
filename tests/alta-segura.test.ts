import { describe, expect, it, vi } from 'vitest';
import { AltaInvalida, crearConReintentos, decidirPedido, motivoError } from '../src/portal/altaSegura';
import { buildPedidoAlta } from '../src/portal/model';

const armar = (email = 'estudio@gmail.com') => (id: string) =>
  buildPedidoAlta({ projectId: 'p1', clienteId: id, estudio: 'Estudio', contacto: 'Ana', email, zonaHoraria: 'America/Argentina/Buenos_Aires', prueba: false });
const sinEspera = async () => undefined;

describe('alta con link de Tally que no se traba', () => {
  it('si el ID no llegó a cargarse, lo busca al crear', async () => {
    const crear = vi.fn(async () => undefined);
    const p = await crearConReintentos({ sugerir: async () => 'PAF-007', crear, esperar: sinEspera }, armar(), { prueba: false, clienteId: '' });
    expect(p.clienteId).toBe('PAF-007');
    expect(p.enlaceFormulario).toContain('cliente_id=PAF-007');
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it('si se corta la conexión, reintenta', async () => {
    let n = 0;
    const crear = vi.fn(async () => { if (n++ < 2) throw Object.assign(new Error('Failed to get document because the client is offline.'), { code: 'unavailable' }); });
    const p = await crearConReintentos({ sugerir: async () => 'PAF-003', crear, esperar: sinEspera }, armar(), { prueba: false, clienteId: 'PAF-003' });
    expect(p.clienteId).toBe('PAF-003');
    expect(crear).toHaveBeenCalledTimes(3);
  });

  it('si el ID ya se usó (datos viejos en el teléfono), pasa al siguiente libre', async () => {
    const usados = new Set(['PAF-004']);
    const crear = vi.fn(async (pedido: { clienteId?: string }) => { if (usados.has(pedido.clienteId!)) throw new Error(`El ID ${pedido.clienteId} ya se usó. Elegí otro.`); });
    // La sugerencia sigue diciendo PAF-004 (caché vieja): no lo repite
    const p = await crearConReintentos({ sugerir: async () => 'PAF-004', crear, esperar: sinEspera }, armar(), { prueba: false, clienteId: 'PAF-004' });
    expect(p.clienteId).toBe('PAF-005');
  });

  it('un ID escrito a mano no se cambia solo', async () => {
    const crear = vi.fn(async () => { throw new Error('El ID PAF-009 ya se usó. Elegí otro.'); });
    await expect(crearConReintentos({ sugerir: async () => 'PAF-010', crear, esperar: sinEspera }, armar(), { prueba: false, clienteId: 'PAF-009', fijo: true })).rejects.toThrow('ya se usó');
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it('datos mal cargados no se reintentan: se dice qué corregir', async () => {
    const crear = vi.fn(async () => undefined);
    await expect(crearConReintentos({ sugerir: async () => 'PAF-002', crear, esperar: sinEspera }, armar('sin-arroba'), { prueba: false })).rejects.toBeInstanceOf(AltaInvalida);
    expect(crear).not.toHaveBeenCalled();
  });

  it('si nunca vuelve la conexión, avisa el motivo real', async () => {
    const err = Object.assign(new Error('offline'), { code: 'unavailable' });
    const crear = vi.fn(async () => { throw err; });
    await expect(crearConReintentos({ sugerir: async () => 'PAF-002', crear, esperar: sinEspera }, armar(), { prueba: false })).rejects.toBe(err);
    expect(crear).toHaveBeenCalledTimes(4);
    expect(motivoError(err)).toBe('se cortó la conexión con la base');
    expect(motivoError({ code: 'permission-denied' })).toContain('permiso');
  });
});

describe('alta cargada a mano en la planilla', () => {
  const nuevo = (armar()('PAF-012') as { pedido: any }).pedido;
  it('si la planilla ya devolvió las carpetas, el ID se vincula a la ficha y las conserva', () => {
    const prev = { clienteId: 'PAF-012', estado: 'registrado' as const, alta: { carpetaCompartida: 'https://drive.google.com/drive/folders/x' } };
    const d = decidirPedido(prev, nuevo);
    expect(d.accion).toBe('vincular');
    if (d.accion !== 'vincular') return;
    expect(d.datos.projectId).toBe('p1');
    expect(d.datos.estado).toBe('registrado');
    expect('alta' in d.datos).toBe(false); // el merge no pisa las carpetas
  });
  it('sin nada guardado se crea; si es de otro cliente, no se toca', () => {
    expect(decidirPedido(undefined, nuevo).accion).toBe('crear');
    expect(decidirPedido({ projectId: 'otro', estado: 'registrado' }, nuevo)).toEqual({ accion: 'error', mensaje: 'El ID PAF-012 ya se usó. Elegí otro.' });
    expect(decidirPedido({ projectId: 'p1', estado: 'pendiente' }, nuevo).accion).toBe('vincular');
  });
});
