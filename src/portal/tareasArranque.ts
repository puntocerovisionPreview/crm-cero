/**
 * ARRANQUE AUTOMÁTICO del estudio (según la entrega del servicio):
 * - Cuando el script devuelve sus carpetas de Drive, se habilitan solas las primeras tareas:
 *   leer la bienvenida y cargar sus proyectos en Materiales › Proyectos.
 * - Las tareas viejas ("Marcar tus 3 proyectos favoritos") se reemplazan por las actuales.
 * Funciones puras: devuelven la lista nueva o null si no hay nada que cambiar.
 */
import type { PafTask } from './model';
import { temaPorId } from './presencia';

const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
const plantilla = (titulo: string) => temaPorId('arranque').tareas.find((t) => t.titulo === titulo)!;

export const TAREA_BIENVENIDA = 'Leer la bienvenida y conocer tu carpeta';
export const TAREA_PROYECTOS = 'Cargar tus proyectos en Materiales › Proyectos';

/** Títulos anteriores → tarea actual que la reemplaza */
const VIEJAS: Record<string, string> = {
  'marcar tus 3 proyectos favoritos en materiales': TAREA_PROYECTOS,
};

/** Reemplaza tareas viejas por la versión actual (mismo id, estado y fecha) */
export function actualizarTareasViejas(tareas: PafTask[] = []): PafTask[] | null {
  let cambio = false;
  const next = tareas.map((t) => {
    const nueva = VIEJAS[t.titulo.trim().toLowerCase()];
    if (!nueva || t.estado === 'aprobada') return t;
    cambio = true;
    const p = plantilla(nueva);
    return { ...t, titulo: p.titulo, paraQue: p.paraQue, ...(p.detalle ? { detalle: p.detalle } : {}), pideArchivos: !!p.pideArchivos, ...(p.carpeta ? { carpeta: p.carpeta } : {}) };
  });
  return cambio ? next : null;
}

/**
 * Llegaron las carpetas: habilita "Leer la bienvenida" y "Cargar tus proyectos" (si siguen
 * ocultas), con fecha a una semana para los proyectos y como su próxima acción.
 * Si faltan (clientes creados antes), las agrega.
 */
export function habilitarConCarpetas(tareas: PafTask[] = [], ahora: string, newId: () => string): PafTask[] | null {
  const hoy = ahora.slice(0, 10);
  const yaPrioritaria = tareas.some((t) => t.prioritaria && t.estado === 'habilitada');
  let cambio = false;
  const lista = [...tareas];
  for (const titulo of [TAREA_BIENVENIDA, TAREA_PROYECTOS]) {
    const i = lista.findIndex((t) => t.titulo === titulo);
    const p = plantilla(titulo);
    const extra = titulo === TAREA_PROYECTOS ? { fecha: addDays(hoy, 7), ...(yaPrioritaria ? {} : { prioritaria: true }) } : {};
    if (i === -1) {
      lista.push({ id: newId(), titulo, paraQue: p.paraQue, ...(p.detalle ? { detalle: p.detalle } : {}), ...(p.pideArchivos ? { pideArchivos: true } : {}), ...(p.carpeta ? { carpeta: p.carpeta } : {}), tema: 'arranque', estado: 'habilitada', habilitadaEn: ahora, ...extra });
      cambio = true;
    } else if (lista[i].estado === 'borrador') {
      lista[i] = { ...lista[i], estado: 'habilitada', habilitadaEn: ahora, ...(lista[i].fecha ? {} : extra) };
      cambio = true;
    }
  }
  return cambio ? lista : null;
}

/** Alta sin Tally: las 4 tareas de materiales, juntas en la carta "Tus materiales" */
export const CARTA_MATERIALES = 'Tus materiales';
export const TAREAS_MATERIALES: { titulo: string; carpeta: 'proyectos' | 'equipo' | 'referencias' | 'registro'; paraQue: string; detalle: string }[] = [
  { titulo: 'Subí tus proyectos', carpeta: 'proyectos', paraQue: 'Con tus obras reales armamos tu contenido, tu portfolio y tu web.', detalle: 'Una carpeta por obra, con su nombre: fotos, renders, planos y videos. Subí todo lo que tengas, terminado o en curso; después elegimos juntos qué mostrar. Adentro de la carpeta hay un PDF que lo explica.' },
  { titulo: 'Subí tu logo y fotos del equipo', carpeta: 'equipo', paraQue: 'Para que todo lo que publiquemos se vea como tu estudio.', detalle: 'El logo en su archivo original si lo tenés, fotos del equipo y del estudio. Adentro de la carpeta hay un PDF que lo explica.' },
  { titulo: 'Sumá tus referencias', carpeta: 'referencias', paraQue: 'Para entender qué te gusta y hacia dónde querés llevar tu estudio.', detalle: 'Campañas que hayas hecho y cuentas o estudios que te gusten. Adentro de la carpeta hay un PDF que lo explica.' },
  { titulo: 'Mandanos el registro de obra', carpeta: 'registro', paraQue: 'Mostrar el proceso genera confianza: es de lo que mejor funciona.', detalle: 'Imaginate que somos un cliente exigente que quiere ver el paso a paso: mandanos lo que le mandarías a él, aunque parezca chico. Adentro de la carpeta hay un PDF que lo explica.' },
];

/**
 * Llegaron las carpetas del alta nueva: habilita las 4 tareas de materiales (las agrega si no
 * están), en la carta "Tus materiales", para dentro de una semana y la primera como "va primero".
 * Las de arranque viejas que hacen lo mismo ("Cargar tus proyectos…", "Subir tu logo…") quedan ocultas.
 */
export function habilitarMateriales(tareas: PafTask[] = [], ahora: string, newId: () => string): PafTask[] | null {
  const fecha = addDays(ahora.slice(0, 10), 7);
  const yaPrioritaria = tareas.some((t) => t.prioritaria && t.estado === 'habilitada');
  let cambio = false;
  const lista = [...tareas];
  TAREAS_MATERIALES.forEach((def, i) => {
    const k = lista.findIndex((t) => t.titulo === def.titulo);
    const prioritaria = i === 0 && !yaPrioritaria ? { prioritaria: true } : {};
    if (k === -1) {
      lista.push({ id: newId(), titulo: def.titulo, paraQue: def.paraQue, detalle: def.detalle, pideArchivos: true, carpeta: def.carpeta, tema: 'arranque', carta: CARTA_MATERIALES, fecha, estado: 'habilitada', habilitadaEn: ahora, ...prioritaria });
      cambio = true;
    } else if (lista[k].estado === 'borrador') {
      lista[k] = { ...lista[k], estado: 'habilitada', habilitadaEn: ahora, carta: lista[k].carta || CARTA_MATERIALES, ...(lista[k].fecha ? {} : { fecha }), ...prioritaria };
      cambio = true;
    }
  });
  return cambio ? lista : null;
}
