/**
 * SALUD DE CADA CLIENTE (para Juan, nunca para el cliente): un semáforo con los motivos
 * concretos de por qué un cliente necesita que le prestes atención. Lo usan la lista,
 * el tablero, la ficha, el Inicio y los avisos. Funciones puras.
 */
import type { AgendaMeeting, Project } from '../types';
import { accesosDemorados } from './presenciaAuto';

export const PAF_VISITAS_COLLECTION = 'paf_visitas';

/** Cuándo entró el estudio a su portal (lo registra el servidor; doc id = clienteId) */
export interface PortalVisita {
  id: string;
  ultima: string; // ISO
  primera?: string; // ISO
  total?: number;
}

export type NivelSalud = 'ok' | 'atencion' | 'riesgo';
export interface MotivoSalud { nivel: Exclude<NivelSalud, 'ok'>; texto: string }
export interface SaludCliente { nivel: NivelSalud; motivos: MotivoSalud[] }

const DIA = 86400000;
export const diasEntre = (desde: string, hasta: string) => Math.floor((Date.parse(`${hasta.slice(0, 10)}T12:00:00`) - Date.parse(`${desde.slice(0, 10)}T12:00:00`)) / DIA);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** "hoy", "ayer", "hace 5 días" */
export function haceDias(iso: string, today: string): string {
  const n = diasEntre(iso, today);
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`;
}

/** Texto corto de la última visita al portal (o null si no tiene portal publicado) */
export function textoVisita(project: Pick<Project, 'pafPortal'>, visita: PortalVisita | undefined, today: string): string | null {
  if (!project.pafPortal?.publishedAt) return null;
  return visita ? `Entró al portal ${haceDias(visita.ultima, today)}` : 'Todavía no entró al portal';
}

/**
 * Los motivos, del más grave al más leve:
 * - riesgo: bloqueado, cobro atrasado, tareas del estudio vencidas hace más de una semana,
 *   nunca entró al portal (publicado hace 5+ días), sin contacto hace 30+ días
 * - atención: tareas vencidas, decisión vencida, no entra al portal hace 10+ días,
 *   sin reunión hace 21+ días y nada agendado, termina el programa en 14 días, sin próxima acción
 */
export function saludCliente(p: Project, ctx: { meetings: AgendaMeeting[]; visita?: PortalVisita; today: string }): SaludCliente {
  const { today, visita } = ctx;
  const motivos: MotivoSalud[] = [];
  const add = (nivel: MotivoSalud['nivel'], texto: string) => motivos.push({ nivel, texto });

  if (p.proximaAccion?.bloqueado) add('riesgo', `Bloqueado: ${p.proximaAccion.texto}`);

  const atrasadas = (p.installments || []).filter((c) => !c.paid && c.status !== 'cobrado' && c.dueDate && c.dueDate < today);
  if (atrasadas.length) add('riesgo', `${atrasadas.length === 1 ? 'Cuota atrasada' : `${atrasadas.length} cuotas atrasadas`} desde el ${ddmm(atrasadas.map((c) => c.dueDate).sort()[0])}`);

  const vencidas = (p.pafTareas || []).filter((t) => t.estado === 'habilitada' && (t.responsable || 'estudio') === 'estudio' && t.fecha && t.fecha < today);
  if (vencidas.length) {
    const peor = Math.max(...vencidas.map((t) => diasEntre(t.fecha!, today)));
    add(peor > 7 ? 'riesgo' : 'atencion', `${vencidas.length === 1 ? `Tarea vencida: «${vencidas[0].titulo}»` : `${vencidas.length} tareas vencidas`} (${peor === 1 ? 'desde ayer' : `hace ${peor} días`})`);
  }

  const decisiones = (p.pafEntregas || []).filter((e) => e.publicada && (e.estado || 'en_revision') === 'en_revision' && e.hasta && e.hasta < today);
  if (decisiones.length) add('atencion', `Tiene que decidir «${decisiones[0].titulo}» (venció el ${ddmm(decisiones[0].hasta!)})`);

  const publicado = p.pafPortal?.publishedAt;
  if (publicado) {
    if (!visita) {
      if (diasEntre(publicado, today) >= 5) add('riesgo', `Nunca entró a su portal (publicado el ${ddmm(publicado.slice(0, 10))})`);
    } else if (diasEntre(visita.ultima, today) >= 10) add('atencion', `No entra al portal ${haceDias(visita.ultima, today)}`);
  }

  const suyas = ctx.meetings.filter((m) => m.projectId === p.id && !m.proposed);
  const pasadas = suyas.filter((m) => m.date <= today).map((m) => m.date).sort();
  const proxima = suyas.some((m) => m.date >= today && !m.completed);
  const ultima = pasadas[pasadas.length - 1];
  if (!proxima) {
    if (ultima && diasEntre(ultima, today) >= 30) add('riesgo', `Sin reunión hace ${diasEntre(ultima, today)} días y nada agendado`);
    else if (ultima && diasEntre(ultima, today) >= 21) add('atencion', `Sin reunión hace ${diasEntre(ultima, today)} días y nada agendado`);
  }

  const demorados = accesosDemorados(p, today);
  if (demorados.length) add('atencion', `Faltan accesos que pediste: ${demorados.map((a) => a.label).join(', ')}`);

  const fin = p.deliveryDate;
  if (fin && fin >= today && diasEntre(today, fin) <= 14) add('atencion', `Termina el programa el ${ddmm(fin)}: hablá de cómo sigue`);

  if (!p.proximaAccion) add('atencion', 'Sin próxima acción definida');

  motivos.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'riesgo' ? -1 : 1));
  return { nivel: motivos.some((m) => m.nivel === 'riesgo') ? 'riesgo' : motivos.length ? 'atencion' : 'ok', motivos };
}

/** Mapa clienteId → visita */
export const visitasPorCliente = (visitas: PortalVisita[] = []) => new Map(visitas.map((v) => [v.id, v]));

/**
 * Aviso del lunes: clientes que no entran al portal y tienen algo pendiente de su lado.
 * Así sabés a quién escribirle esa semana (el mensaje lo armás desde su ficha).
 */
export function clientesSinEntrar(projects: Project[], visitas: PortalVisita[] = [], today: string): { project: Project; texto: string }[] {
  const porId = visitasPorCliente(visitas);
  return projects
    .filter((p) => !p.archived && !p.isLead && !p.ejemplo && p.pafClienteId && p.pafPortal?.publishedAt)
    .map((p) => {
      const v = porId.get(p.pafClienteId!);
      const pendientes = (p.pafTareas || []).filter((t) => t.estado === 'habilitada' && (t.responsable || 'estudio') === 'estudio').length;
      const dias = v ? diasEntre(v.ultima, today) : diasEntre(p.pafPortal!.publishedAt!, today);
      if (dias < (v ? 10 : 5) || !pendientes) return null;
      return { project: p, texto: `${p.clientName}: ${v ? `no entra ${haceDias(v.ultima, today)}` : 'nunca entró'} y tiene ${pendientes === 1 ? '1 tarea pendiente' : `${pendientes} tareas pendientes`}` };
    })
    .filter((x): x is { project: Project; texto: string } => !!x);
}

/**
 * Cómo está el cliente en UNA frase, como se lo contarías a alguien (lista y ficha).
 * Primero lo que te pide algo, después lo que está esperando y si no, que está en orden.
 */
export function resumenCliente(p: Project, salud: SaludCliente, ctx: { meetings: AgendaMeeting[]; today: string }): string {
  const revisar = (p.pafTareas || []).filter((t) => t.estado === 'enviada');
  const a = p.proximaAccion;
  const partes: string[] = [];
  if (revisar.length) partes.push(revisar.length === 1 ? `Terminó «${revisar[0].titulo}»: revisala` : `Terminó ${revisar.length} tareas: revisalas`);
  else if (a?.bloqueado) partes.push(`Está trabado: ${a.texto}`);
  else if (a?.responsable === 'yo') partes.push(`Te toca: ${a.texto}${a.fecha ? (a.fecha < ctx.today ? ` (venció el ${ddmm(a.fecha)})` : ` para el ${ddmm(a.fecha)}`) : ''}`);
  else if (a) partes.push(`Esperando ${a.responsable === 'cm' ? 'a la CM' : 'que te mande'}: ${a.necesita || a.texto}`);
  const motivo = salud.motivos.find((m) => !m.texto.startsWith('Bloqueado') && m.texto !== 'Sin próxima acción definida');
  if (motivo) partes.push(partes.length ? motivo.texto.charAt(0).toLowerCase() + motivo.texto.slice(1) : motivo.texto);
  if (!partes.length) {
    const proxima = ctx.meetings.filter((m) => m.projectId === p.id && !m.completed && !m.proposed && m.date >= ctx.today).map((m) => m.date).sort()[0];
    return !a ? 'Le falta definir la próxima acción.' : proxima ? `Todo en orden. Próxima reunión el ${ddmm(proxima)}.` : 'Todo en orden.';
  }
  return `${partes.join('. Además, ')}.`;
}

/** "Cómo viene" de la ficha: en qué parte del programa está y su frase de estado */
export function comoViene(p: Project, salud: SaludCliente, ctx: { meetings: AgendaMeeting[]; today: string; semana?: number | null; etapa?: string; hitoTitulo?: string }): string {
  const donde = ctx.etapa
    ? `${ctx.semana ? `Va por la semana ${ctx.semana}, en` : 'Está en'} ${ctx.etapa}${ctx.hitoTitulo ? `: ${ctx.hitoTitulo.charAt(0).toLowerCase()}${ctx.hitoTitulo.slice(1)}` : ''}. `
    : '';
  return `${donde}${resumenCliente(p, salud, ctx)}`;
}
