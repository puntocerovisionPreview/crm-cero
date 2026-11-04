/**
 * AVISOS DE CLIENTES (para Juan, nunca para el cliente): lo que necesita una acción tuya.
 * Funciones puras: las usa el servidor para el resumen de las 8, el plan del domingo,
 * los avisos antes y después de cada reunión y el recordatorio de reportes del viernes.
 */
import type { AgendaMeeting, Project } from '../types';
import { escapeHtml } from './messages';

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
const activos = (projects: Project[]) => projects.filter((p) => !p.archived && !p.isLead && !p.ejemplo);
const esPaf = (p: Project) => p.serviceType === 'paf' || (!!p.projectType && p.projectType.startsWith('paf'));
const prepListas = (m: AgendaMeeting) => Object.values(m.prep || {}).filter((v) => v?.trim()).length;
const titulo = (m: AgendaMeeting) => m.title.split(' · ')[0].replace(/^\[Ejemplo\]\s*/, '');

/** Reunión de un cliente que ya pasó y no tiene "lo que acordamos" anotado */
export function acuerdosSinAnotar(projects: Project[], meetings: AgendaMeeting[], today: string, dias = 14): { project: Project; meeting: AgendaMeeting }[] {
  const byId = new Map(activos(projects).map((p) => [p.id, p]));
  const desde = addDays(today, -dias);
  return meetings
    .filter((m) => m.projectId && byId.has(m.projectId) && !m.proposed && m.date <= today && m.date >= desde && (m.completed || m.date < today))
    .filter((m) => !(byId.get(m.projectId!)!.pafResumenes || []).some((r) => r.fecha >= m.date))
    .map((m) => ({ project: byId.get(m.projectId!)!, meeting: m }));
}

export interface ItemClienteHoy {
  /** Cliente al que lleva (si es de uno solo) */
  projectId?: string;
  tipo: 'revisar' | 'reunion' | 'acuerdos' | 'decision' | 'accion' | 'bloqueado' | 'vencidas' | 'reportes';
  texto: string;
  /** Detalle chico (ej. "sin preparar") */
  nota?: string;
}

/** Lo que tus clientes necesitan de vos hoy, en orden (lo usan el Inicio y el resumen de las 8) */
export function itemsClientesHoy(projects: Project[], meetings: AgendaMeeting[], today: string): ItemClienteHoy[] {
  const ps = activos(projects);
  const out: ItemClienteHoy[] = [];
  ps.forEach((p) => (p.pafTareas || []).filter((t) => t.estado === 'enviada').forEach((t) => out.push({ projectId: p.id, tipo: 'revisar', texto: `${p.clientName} terminó «${t.titulo}»: revisala` })));
  const byId = new Map(ps.map((p) => [p.id, p]));
  meetings.filter((m) => m.projectId && byId.has(m.projectId) && m.date === today && !m.completed && !m.proposed)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    .forEach((m) => out.push({ projectId: m.projectId, tipo: 'reunion', texto: `${m.time ? `${m.time} ` : ''}reunión con ${byId.get(m.projectId!)!.clientName}`, ...(prepListas(m) < 3 ? { nota: 'sin preparar' } : {}) }));
  acuerdosSinAnotar(projects, meetings, today).forEach(({ project, meeting }) => out.push({ projectId: project.id, tipo: 'acuerdos', texto: `Anotá lo que acordaron con ${project.clientName} (reunión del ${ddmm(meeting.date)})` }));
  ps.forEach((p) => (p.pafEntregas || []).filter((e) => e.publicada && (e.estado || 'en_revision') === 'en_revision' && e.hasta && e.hasta <= addDays(today, 1))
    .forEach((e) => out.push({ projectId: p.id, tipo: 'decision', texto: `${p.clientName} tiene que decidir «${e.titulo}» ${e.hasta! < today ? `(venció el ${ddmm(e.hasta!)})` : e.hasta === today ? '(hoy)' : '(mañana)'}` })));
  ps.forEach((p) => {
    const a = p.proximaAccion;
    if (a?.responsable === 'yo' && a.fecha && a.fecha <= today) out.push({ projectId: p.id, tipo: 'accion', texto: `${p.clientName}: ${a.texto}${a.fecha < today ? ` (venció el ${ddmm(a.fecha)})` : ''}` });
    if (a?.bloqueado) out.push({ projectId: p.id, tipo: 'bloqueado', texto: `${p.clientName} está bloqueado: ${a.texto}` });
  });
  const vencidas = ps.flatMap((p) => (p.pafTareas || []).filter((t) => t.estado === 'habilitada' && (t.responsable || 'estudio') === 'estudio' && t.fecha && t.fecha < today).map(() => p));
  if (vencidas.length) {
    const quienes = [...new Map(vencidas.map((p) => [p.id, p])).values()];
    out.push({ ...(quienes.length === 1 ? { projectId: quienes[0].id } : {}), tipo: 'vencidas', texto: `${vencidas.length} ${vencidas.length === 1 ? 'tarea vencida' : 'tareas vencidas'} de clientes (${quienes.map((p) => p.clientName).join(', ')}): mandales un recordatorio` });
  }
  if (new Date(`${today}T12:00:00`).getDay() === 5) {
    const faltan = reportesQueFaltan(projects, today);
    if (faltan.length) out.push({ ...(faltan.length === 1 ? { projectId: faltan[0].id } : {}), tipo: 'reportes', texto: `Hoy es viernes: faltan los reportes de ${faltan.map((p) => p.clientName).join(', ')}` });
  }
  return out;
}

/** Sección "Tus clientes hoy" del resumen de las 8 (HTML de Telegram; vacío si no hay nada) */
export function buildClientesHoy(projects: Project[], meetings: AgendaMeeting[], today: string): string {
  const items = itemsClientesHoy(projects, meetings, today);
  return items.length ? ['<b>Tus clientes hoy</b>', ...items.map((i) => `• ${escapeHtml(i.texto)}${i.nota ? ` · <i>${escapeHtml(i.nota)}</i>` : ''}`)].join('\n') : '';
}

/** Clientes PAF activos sin reporte de esta semana (lunes a hoy) */
export function reportesQueFaltan(projects: Project[], today: string): Project[] {
  const d = new Date(`${today}T12:00:00`);
  const lunes = addDays(today, -((d.getDay() + 6) % 7));
  return activos(projects).filter((p) => esPaf(p) && !(p.pafReportes || []).some((r) => r.hasta >= lunes));
}

/** Para el plan del domingo: la semana que viene con tus clientes */
export function buildClientesSemana(projects: Project[], meetings: AgendaMeeting[], monday: string): string {
  const fin = addDays(monday, 6);
  const ps = activos(projects);
  const byId = new Map(ps.map((p) => [p.id, p]));
  const lines: string[] = [];
  meetings.filter((m) => m.projectId && byId.has(m.projectId) && !m.completed && !m.proposed && m.date >= monday && m.date <= fin)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
    .forEach((m) => lines.push(`• ${ddmm(m.date)}${m.time ? ` ${m.time}` : ''} · ${escapeHtml(byId.get(m.projectId!)!.clientName)}: ${escapeHtml(titulo(m))}`));
  ps.forEach((p) => (p.pafEntregas || []).filter((e) => e.publicada && (e.estado || 'en_revision') === 'en_revision' && e.hasta && e.hasta <= fin)
    .forEach((e) => lines.push(`• ${escapeHtml(p.clientName)} decide «${escapeHtml(e.titulo)}» hasta el ${ddmm(e.hasta!)}`)));
  ps.filter((p) => p.proximaAccion && p.proximaAccion.responsable !== 'yo' && !p.proximaAccion.bloqueado)
    .forEach((p) => lines.push(`• Esperando a ${escapeHtml(p.clientName)}: ${escapeHtml(p.proximaAccion!.necesita || p.proximaAccion!.texto)}`));
  ps.filter((p) => !p.proximaAccion).forEach((p) => lines.push(`• ${escapeHtml(p.clientName)} no tiene próxima acción: definila`));
  return lines.length ? ['<b>Tus clientes esta semana</b>', ...lines].join('\n') : '';
}

export interface Nudge { key: string; title: string; body: string; url: string }

/**
 * Avisos alrededor de cada reunión con un cliente:
 * - el día anterior desde las 18: "Mañana: reunión con X. Preparala"
 * - una hora después de terminada: "¿Anotás lo que acordaron con X?"
 * `key` sirve para no repetirlos.
 */
export function meetingNudges(projects: Project[], meetings: AgendaMeeting[], today: string, nowMinutes: number): Nudge[] {
  const byId = new Map(activos(projects).map((p) => [p.id, p]));
  const out: Nudge[] = [];
  const manana = addDays(today, 1);
  if (nowMinutes >= 18 * 60) {
    meetings.filter((m) => m.projectId && byId.has(m.projectId) && m.date === manana && !m.completed && !m.proposed).forEach((m) => {
      const p = byId.get(m.projectId!)!;
      const n = prepListas(m);
      out.push({
        key: `prep_${m.id}`,
        title: `Mañana${m.time ? ` ${m.time}` : ''}: reunión con ${p.clientName}`,
        body: `${titulo(m)}${m.objetivo ? ` · ${m.objetivo}` : ''}. ${n >= 3 ? 'Ya la preparaste.' : `Preparala (${n} de 5).`}`,
        url: `/clientes/${p.id}`,
      });
    });
  }
  meetings.filter((m) => m.projectId && byId.has(m.projectId) && m.date === today && m.time && !m.proposed).forEach((m) => {
    const [h, mm] = m.time!.split(':').map(Number);
    const fin = h * 60 + (mm || 0) + Math.round((m.durationHours || 1) * 60);
    const p = byId.get(m.projectId!)!;
    if (nowMinutes >= fin + 60 && !(p.pafResumenes || []).some((r) => r.fecha >= m.date)) {
      out.push({ key: `acuerdos_${m.id}`, title: `¿Anotás lo que acordaron con ${p.clientName}?`, body: 'Lo cargás en Reuniones → Anotar acuerdos y te arma el mensaje "Hoy acordamos".', url: `/clientes/${p.id}` });
    }
  });
  return out;
}
