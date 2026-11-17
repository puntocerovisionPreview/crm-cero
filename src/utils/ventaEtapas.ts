import type { Project, Prospect, ProspectEvent } from '../types';
import { getServiceType } from '../types';

/**
 * PASO A PASO DE VENTA (las 9 etapas de 03_CRECIMIENTO/venta_paf/01_proceso_paso_a_paso.md)
 * Cada oportunidad muestra en qué etapa está y su checklist "antes de seguir".
 * Si cambia el paso a paso en la carpeta de la empresa, se actualiza acá.
 */

export type Interes = 'web' | 'paf';

export interface VentaCheck {
  id: string;
  text: string;
}

export interface VentaEtapa {
  n: number;
  momento: 1 | 2 | 3;
  titulo: string;
  checks: VentaCheck[];
}

export const MOMENTOS: Record<1 | 2 | 3, string> = {
  1: 'Antes de la reunión',
  2: 'La reunión',
  3: 'Después de la reunión, hasta cerrar',
};

export const VENTA_ETAPAS: VentaEtapa[] = [
  {
    n: 1, momento: 1, titulo: 'Llega la auto auditoría',
    checks: [
      { id: 'e1_score', text: 'El score coincide con el que dio el formulario' },
      { id: 'e1_frase', text: 'La frase textual de "Observaciones" está guardada' },
      { id: 'e1_preguntas', text: 'Lo que no respondió quedó como pregunta para la reunión' },
    ],
  },
  {
    n: 2, momento: 1, titulo: 'Miro su presencia real',
    checks: [
      { id: 'e2_vivo', text: 'Cada hallazgo está comprobado en vivo' },
      { id: 'e2_hipotesis', text: 'Las contradicciones están anotadas como hipótesis' },
      { id: 'e2_capturas', text: 'Las capturas están guardadas' },
    ],
  },
  {
    n: 3, momento: 1, titulo: 'Ficha, video y mensaje para agendar',
    checks: [
      { id: 'e3_ficha', text: 'Ficha de llamada con calificación A, B o C' },
      { id: 'e3_video', text: 'Video con 3 acciones enviado' },
      { id: 'e3_whatsapp', text: 'WhatsApp para agendar la reunión enviado' },
    ],
  },
  {
    n: 4, momento: 1, titulo: 'Preparar la reunión',
    checks: [
      { id: 'e4_pilar', text: 'El guion arranca por el pilar que más le duele' },
      { id: 'e4_corchetes', text: 'Ningún dato repetido ni corchete sin completar' },
      { id: 'e4_interno', text: 'Nada interno en la propuesta' },
      { id: 'e4_presentar', text: 'Revisada en modo Presentar' },
      { id: 'e4_planb', text: 'Plan B si no decide (fecha o reunión con el socio)' },
    ],
  },
  {
    n: 5, momento: 2, titulo: 'La reunión',
    checks: [
      { id: 'e5_hecha', text: 'Reunión hecha' },
      { id: 'e5_grabada', text: 'Grabada para los resúmenes' },
    ],
  },
  {
    n: 6, momento: 3, titulo: 'Resúmenes',
    checks: [
      { id: 'e6_interno', text: 'Resumen interno armado' },
      { id: 'e6_estudio', text: 'El del estudio no tiene nada interno' },
      { id: 'e6_numeros', text: 'Los números coinciden con la propuesta' },
    ],
  },
  {
    n: 7, momento: 3, titulo: 'Propuesta final',
    checks: [
      { id: 'e7_resultados', text: 'No promete resultados: promete métricas y reportes' },
      { id: 'e7_global', text: 'Presupuesto global: programa + pauta + hosting' },
      { id: 'e7_resumen', text: 'Coincide con el resumen que tiene el estudio' },
      { id: 'e7_version', text: 'Guardada la versión que se mandó' },
    ],
  },
  {
    n: 8, momento: 3, titulo: 'Negociación por mensajes',
    checks: [
      { id: 'e8_razon', text: 'Toda concesión tiene una razón propia' },
      { id: 'e8_reunion', text: 'Si pidió reunión, no hubo más concesiones por mensaje' },
    ],
  },
  {
    n: 9, momento: 3, titulo: 'Cierre y traspaso',
    checks: [
      { id: 'e9_pago', text: 'Forma de pago acordada por escrito' },
      { id: 'e9_continuidad', text: 'Continuidad aclarada' },
      { id: 'e9_fecha', text: 'Fecha de arranque fijada' },
      { id: 'e9_traspaso', text: 'Traspaso sin datos inventados' },
      { id: 'e9_caso', text: 'Caso actualizado: qué funcionó y qué no' },
    ],
  },
];

/** Desde qué etapa arranca según dónde está en el embudo (lo anterior ya pasó en la práctica) */
function etapaMinima(p: Prospect): number {
  switch (p.stage) {
    case 'auditoria_completada': return 1;
    case 'video_enviado': return 3;
    case 'llamada': return p.proposalSentAt ? 7 : 4;
    case 'cliente': return 9;
    default: return 1;
  }
}

export interface EtapaActual {
  /** 0 = todavía no completó la auto auditoría; 10 = las 9 etapas tildadas */
  n: number;
  etapa?: VentaEtapa;
  hechos: number;
  total: number;
}

/**
 * Etapa en la que está una oportunidad: la primera, desde su etapa mínima, que tiene algo sin tildar.
 * Un "posible" de Clientes ya está en propuesta (etapa 7 en adelante).
 */
export function etapaActual(checks: Record<string, boolean> | undefined, minima: number): EtapaActual {
  const c = checks || {};
  for (const e of VENTA_ETAPAS) {
    if (e.n < minima) continue;
    const hechos = e.checks.filter((k) => c[k.id]).length;
    if (hechos < e.checks.length) return { n: e.n, etapa: e, hechos, total: e.checks.length };
  }
  return { n: 10, hechos: 0, total: 0 };
}

export function etapaDeProspecto(p: Prospect): EtapaActual {
  if (p.stage === 'respondio' || p.stage === 'auditoria_enviada') return { n: 0, hechos: 0, total: 0 };
  return etapaActual(p.ventaChecks, etapaMinima(p));
}

export function etapaDeLead(project: Project): EtapaActual {
  return etapaActual(project.ventaChecks, 7);
}

export function interesDeProject(project: Project): Interes | undefined {
  const t = project.serviceType || getServiceType(project.projectType);
  return t === 'paf' || t === 'web' ? t : undefined;
}

// ---------------- EMBUDO DEL MES ----------------

export type FilaEmbudo = 'web' | 'paf' | 'sin';

export interface EmbudoMes {
  conversaciones: number;
  auditorias: number;
  reuniones: number;
  propuestas: number;
  cierres: number;
}

export const PASOS_EMBUDO: { key: keyof EmbudoMes; label: string }[] = [
  { key: 'conversaciones', label: 'Conversaciones' },
  { key: 'auditorias', label: 'Auditorías' },
  { key: 'reuniones', label: 'Reuniones' },
  { key: 'propuestas', label: 'Propuestas' },
  { key: 'cierres', label: 'Cierres' },
];

const vacio = (): EmbudoMes => ({ conversaciones: 0, auditorias: 0, reuniones: 0, propuestas: 0, cierres: 0 });

/**
 * Los números del mes, separados en Web y PAF (y "sin definir" mientras no se eligió).
 * Sale de lo que el CRM ya tiene cargado: los eventos de prospección y los clientes. No lee nada extra.
 * - Conversaciones: primeros mensajes enviados
 * - Auditorías: auto auditorías completadas
 * - Reuniones: llamadas agendadas (reprogramar no suma)
 * - Propuestas: propuestas enviadas
 * - Cierres: clientes ganados en el mes (los de Prospección y los "posibles" de Clientes),
 *   más los clientes cargados directo en el mes
 */
export function embudoDelMes(events: ProspectEvent[], prospects: Prospect[], projects: Project[], month: string): Record<FilaEmbudo, EmbudoMes> {
  const out: Record<FilaEmbudo, EmbudoMes> = { web: vacio(), paf: vacio(), sin: vacio() };
  const interes = new Map<string, Interes | undefined>(prospects.map((p) => [p.id, p.interes]));
  const fila = (i?: Interes): FilaEmbudo => i || 'sin';

  events.forEach((e) => {
    if (!e.date || e.date.slice(0, 7) !== month) return;
    const f = fila(interes.get(e.prospectId));
    if (e.type === 'first_contact') out[f].conversaciones++;
    else if (e.type === 'audit_completed') out[f].auditorias++;
    else if (e.type === 'call') out[f].reuniones++;
    else if (e.type === 'proposal_sent') out[f].propuestas++;
  });

  // Cierres: cada cliente cuenta una vez, el mes en que se ganó o se cargó
  projects.forEach((p) => {
    if (p.isLead || p.archived) return;
    const when = p.wonAt || p.createdAt || '';
    if (when.slice(0, 7) !== month) return;
    out[fila(interesDeProject(p))].cierres++;
  });

  return out;
}
