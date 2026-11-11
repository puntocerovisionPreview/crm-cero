/**
 * CARTAS DEL PORTAL: el cliente ve una cosa a la vez.
 * Cada carta junta lo que le toca a él (tareas) con la devolución que le damos (entregas).
 * Por defecto se arman solas con el tema del plan; Juan puede mover cualquier tarea o entrega
 * a otra carta, dejarla sola o inventar una carta nueva. Nada de esto obliga a seguir el método.
 */
import { ETAPA_HITOS, TODOS_LOS_TEMAS, type Etapa, type TemaId } from './presencia';
import type { PafDelivery, PafPortalDelivery, PafPortalTask, PafTask } from './model';

/** Valor de `carta` para que una tarea o entrega con tema vaya en su propia carta */
export const CARTA_SOLA = '-';

/** Carta tal como viaja al portal (las tareas y entregas la nombran con `paso`) */
export interface PafPortalPaso {
  id: string;
  titulo: string;
  objetivo?: string;
  hito?: number;
  etapa?: Etapa;
}

type Agrupable = { id: string; titulo: string; tema?: TemaId; carta?: string };

const limpio = (s: string) => s.trim().replace(/\s+/g, ' ');
const deTema = (id: TemaId): PafPortalPaso | null => {
  const t = TODOS_LOS_TEMAS.find((x) => x.id === id);
  return t ? { id: t.id, titulo: t.titulo, objetivo: t.objetivo, hito: t.hito, ...(t.etapa && t.etapa !== 'presencia' ? { etapa: t.etapa } : {}) } : null;
};

/** En qué carta va una tarea ('t') o una entrega ('e') */
export function cartaDe(x: Agrupable, tipo: 't' | 'e'): PafPortalPaso {
  const libre = limpio(x.carta || '');
  if (libre && libre !== CARTA_SOLA) {
    // Si escribió el nombre de un tema, es esa carta (así se suma a la que ya existe)
    const tema = TODOS_LOS_TEMAS.find((t) => t.titulo.toLowerCase() === libre.toLowerCase());
    return tema ? deTema(tema.id)! : { id: `c:${libre.toLowerCase()}`, titulo: libre.slice(0, 80) };
  }
  return (!libre && x.tema && deTema(x.tema)) || { id: `${tipo}:${x.id}`, titulo: x.titulo };
}

/** true si la carta es de una sola cosa (no se publica su definición: alcanza con la tarea o entrega) */
export const esCartaSuelta = (pasoId: string) => /^[te]:/.test(pasoId);

/** Las cartas compartidas que ve el cliente, en el orden del programa (las inventadas, al final) */
export function publicPasos(tareas: PafTask[] = [], entregas: PafDelivery[] = []): PafPortalPaso[] {
  const vistos = new Map<string, PafPortalPaso>();
  for (const t of tareas) if (t.estado !== 'borrador') { const c = cartaDe(t, 't'); if (!esCartaSuelta(c.id) && !vistos.has(c.id)) vistos.set(c.id, c); }
  for (const e of entregas) if (e.publicada) { const c = cartaDe(e, 'e'); if (!esCartaSuelta(c.id) && !vistos.has(c.id)) vistos.set(c.id, c); }
  const orden = (p: PafPortalPaso) => { const i = TODOS_LOS_TEMAS.findIndex((t) => t.id === p.id); return i < 0 ? 999 : i; };
  return [...vistos.values()].sort((a, b) => orden(a) - orden(b));
}

/** Nombres de las cartas que ya existen en este cliente (para elegir "Va con…") */
export function cartasEnUso(tareas: PafTask[] = [], entregas: PafDelivery[] = []): string[] {
  const out = new Map<string, string>();
  for (const [x, tipo] of [...tareas.map((t) => [t, 't'] as const), ...entregas.map((e) => [e, 'e'] as const)]) {
    const c = cartaDe(x, tipo);
    if (!esCartaSuelta(c.id)) out.set(c.id, c.titulo);
  }
  return [...out.values()];
}

// ---------- Del lado del cliente ----------

export type PasoEstado = 'te_toca' | 'revisar' | 'nosotros' | 'listo';
export const PASO_ESTADO_LABEL: Record<PasoEstado, string> = {
  te_toca: 'Te toca a vos',
  revisar: 'Para que revises',
  nosotros: 'Lo tenemos nosotros',
  listo: 'Listo',
};

export interface PortalPaso extends PafPortalPaso {
  tareas: PafPortalTask[];
  entregas: PafPortalDelivery[];
  estado: PasoEstado;
  /** Carta de una sola cosa: el título ya es la tarea o la entrega */
  solo: boolean;
}

/**
 * Arma las cartas con lo publicado. `avisada` dice si el cliente ya tocó "Terminé" en una tarea.
 * Orden: primero la que Juan marcó como prioritaria, después lo que le toca, lo que tiene para
 * revisar, lo que tenemos nosotros y, al final, lo cerrado.
 */
export function armarPasos(
  p: { tareas?: PafPortalTask[]; entregas?: PafPortalDelivery[]; pasos?: PafPortalPaso[] },
  avisada: (t: PafPortalTask) => boolean = (t) => t.estado === 'enviada'
): PortalPaso[] {
  const defs = new Map((p.pasos || []).map((x) => [x.id, x]));
  const out = new Map<string, PortalPaso>();
  const carta = (id: string, titulo: string) => {
    if (!out.has(id)) {
      const def = defs.get(id);
      out.set(id, { ...(def || { id, titulo }), tareas: [], entregas: [], estado: 'listo', solo: !def });
    }
    return out.get(id)!;
  };
  // Las cartas compartidas, en el orden en que se publicaron; las sueltas, a medida que aparecen
  for (const d of p.pasos || []) carta(d.id, d.titulo);
  for (const t of p.tareas || []) carta(t.paso && defs.has(t.paso) ? t.paso : `t:${t.id}`, t.titulo).tareas.push(t);
  for (const e of p.entregas || []) carta(e.paso && defs.has(e.paso) ? e.paso : `e:${e.id}`, e.titulo).entregas.push(e);

  const pendiente = (t: PafPortalTask) => t.estado === 'habilitada' && !avisada(t);
  const suya = (t: PafPortalTask) => (t.responsable || 'estudio') === 'estudio';
  const pasos = [...out.values()].filter((c) => c.tareas.length || c.entregas.length);
  for (const c of pasos) {
    c.estado = c.tareas.some((t) => pendiente(t) && suya(t)) ? 'te_toca'
      : c.entregas.some((e) => e.decision && (e.estado || 'en_revision') === 'en_revision') ? 'revisar'
        : c.tareas.some((t) => t.estado !== 'aprobada') ? 'nosotros'
          : 'listo';
  }
  const rango: Record<PasoEstado, number> = { te_toca: 1, revisar: 2, nosotros: 3, listo: 4 };
  const primero = (c: PortalPaso) => (c.estado === 'te_toca' && c.tareas.some((t) => t.prioritaria && pendiente(t)) ? 0 : rango[c.estado]);
  return pasos.map((c, i) => ({ c, i })).sort((a, b) => primero(a.c) - primero(b.c) || a.i - b.i).map((x) => x.c);
}

/** Lo cerrado, agrupado por hito del programa (lo que no tiene hito va en "Otras cosas") */
export function pasosPorHito(listos: PortalPaso[], etapaActual: Etapa = 'presencia'): { titulo: string; pasos: PortalPaso[] }[] {
  const grupos = new Map<string, { orden: number; titulo: string; pasos: PortalPaso[] }>();
  for (const c of listos) {
    const etapa = c.etapa || 'presencia';
    const hito = c.hito ? ETAPA_HITOS[etapa]?.[c.hito - 1] : undefined;
    const key = hito ? `${etapa}:${c.hito}` : 'otras';
    const orden = hito ? (etapa === etapaActual ? 0 : 100) + (['presencia', 'adquisicion', 'conversion'].indexOf(etapa) * 10) + c.hito! : 999;
    if (!grupos.has(key)) grupos.set(key, { orden, titulo: hito ? hito.titulo : 'Otras cosas', pasos: [] });
    grupos.get(key)!.pasos.push(c);
  }
  return [...grupos.values()].sort((a, b) => a.orden - b.orden).map(({ titulo, pasos }) => ({ titulo, pasos }));
}
