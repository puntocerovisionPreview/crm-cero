/**
 * ALTA QUE NO SE TRABA (ID + link de Tally)
 * Antes, si al crear el cliente fallaba la búsqueda del ID o se cortaba la conexión (pasa mucho
 * en el celular al volver a la app), el link de Tally no se creaba y el motivo quedaba escondido.
 * Ahora: el ID se busca en el momento si falta, si ya se usó se toma el siguiente libre y, si se
 * corta la conexión, se reintenta. Lo que falla igual se explica con su motivo real.
 * Lógica pura: la usan la pantalla "Nuevo cliente", la ficha y los tests.
 */
import { clienteIdNumber, formatClienteId, type PafPedidoAlta } from './model';

type Pedido = Omit<PafPedidoAlta, 'id'>;

/** Datos del alta que están mal (correo, nombre): reintentar no sirve, hay que corregirlos */
export class AltaInvalida extends Error {
  constructor(public errores: string[]) {
    super(errores.join(' '));
    this.name = 'AltaInvalida';
  }
}

/** El motivo, en criollo, para mostrarlo en pantalla */
export function motivoError(err: unknown): string {
  const e = err as { code?: string; message?: string } | undefined;
  const msg = e?.message || '';
  if (e?.code === 'permission-denied' || /permission/i.test(msg)) return 'esta cuenta no tiene permiso para escribir en la base';
  if (e?.code === 'unavailable' || e?.code === 'deadline-exceeded' || /offline|network|unavailable|fetch/i.test(msg)) return 'se cortó la conexión con la base';
  return msg || 'error desconocido';
}

export async function crearConReintentos(
  deps: {
    sugerir: (prueba: boolean) => Promise<string>;
    crear: (pedido: Pedido, replacesId?: string) => Promise<unknown>;
    esperar?: (ms: number) => Promise<void>;
  },
  armar: (clienteId: string) => { pedido: Pedido } | { errors: string[] },
  opts: { prueba: boolean; clienteId?: string; fijo?: boolean; replacesId?: string; intentos?: number }
): Promise<Pedido> {
  const esperar = deps.esperar || ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const usados = new Set<string>();
  let id = (opts.clienteId || '').trim().toUpperCase();
  let ultimo: unknown = new Error('No se pudo crear el alta.');
  for (let i = 0; i < (opts.intentos ?? 4); i++) {
    if (i) await esperar(800 * i);
    try {
      if (clienteIdNumber(id, opts.prueba) === null) {
        id = (await deps.sugerir(opts.prueba)).trim().toUpperCase();
        // Si la sugerencia viene de datos viejos del teléfono, no repetir uno que ya falló
        while (usados.has(id)) id = formatClienteId((clienteIdNumber(id, opts.prueba) || 0) + 1, opts.prueba);
      }
      const r = armar(id);
      if ('errors' in r) throw new AltaInvalida(r.errors);
      await deps.crear(r.pedido, opts.replacesId);
      return r.pedido;
    } catch (err) {
      if (err instanceof AltaInvalida) throw err;
      ultimo = err;
      if ((err as Error)?.message?.includes('ya se usó')) {
        // El ID que eligió Juan a mano no se cambia solo
        if (opts.fijo) throw err;
        usados.add(id);
        id = '';
      }
    }
  }
  throw ultimo;
}

/**
 * Qué hacer con el pedido de un ID cuando ya hay algo guardado con ese ID.
 * - No hay nada (o quedó en error): se crea.
 * - Lo creó la planilla (alta cargada a mano con el menú PAF, sin cliente del CRM) o ya es de
 *   este mismo cliente: se VINCULA a la ficha, conservando lo que trajo el script (estado y carpetas).
 * - Es de otro cliente del CRM: no se toca.
 */
export function decidirPedido(
  prev: Partial<PafPedidoAlta> | undefined,
  nuevo: Pedido
): { accion: 'crear'; datos: Pedido } | { accion: 'vincular'; datos: Partial<Pedido> } | { accion: 'error'; mensaje: string } {
  if (!prev || prev.estado === 'error') return { accion: 'crear', datos: nuevo };
  if (!prev.projectId || prev.projectId === nuevo.projectId) {
    const { estado: _e, creadoEn, alta: _a, ...datos } = nuevo;
    return {
      accion: 'vincular',
      datos: { ...datos, estado: prev.estado || 'registrado', creadoEn: prev.creadoEn || creadoEn },
    };
  }
  return { accion: 'error', mensaje: `El ID ${nuevo.clienteId} ya se usó. Elegí otro.` };
}
