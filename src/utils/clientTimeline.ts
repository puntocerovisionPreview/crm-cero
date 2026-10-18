import type { AgendaMeeting, AgendaTask, ContactLogEntry, Project } from '../types';

/**
 * HISTORIAL DEL CLIENTE
 * Una sola línea de tiempo con todo lo que pasó con un cliente:
 * contactos registrados, reuniones, tareas terminadas, pagos y sesiones PAF.
 */

export type TimelineKind = ContactLogEntry['type'] | 'tarea' | 'pago' | 'sesion' | 'alta';

export interface TimelineEntry {
  id: string;
  date: string;
  kind: TimelineKind;
  title: string;
  detail?: string;
  amount?: number;
  currency?: 'ARS' | 'USD';
  /** Se puede borrar (solo los contactos registrados a mano) */
  removable?: boolean;
}

export const CONTACT_TYPES: { value: ContactLogEntry['type']; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'llamada', label: 'Llamada' },
  { value: 'email', label: 'Mail' },
  { value: 'reunion', label: 'Reunión' },
  { value: 'nota', label: 'Nota' },
];

const d10 = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '');

export function buildTimeline(project: Project, tasks: AgendaTask[], meetings: AgendaMeeting[]): TimelineEntry[] {
  const out: TimelineEntry[] = [];

  (project.contactLog || []).forEach((c) => {
    out.push({ id: `c-${c.id}`, date: d10(c.date), kind: c.type, title: CONTACT_TYPES.find((t) => t.value === c.type)?.label || 'Contacto', detail: c.text, removable: true });
  });
  meetings
    .filter((m) => m.projectId === project.id)
    .forEach((m) => out.push({ id: `m-${m.id}`, date: d10(m.date), kind: 'reunion', title: m.completed ? `Reunión: ${m.title}` : `Reunión agendada: ${m.title}`, detail: m.notes }));
  tasks
    .filter((t) => t.projectId === project.id && t.completed)
    .forEach((t) => out.push({ id: `t-${t.id}`, date: d10(t.completedAt) || d10(t.date), kind: 'tarea', title: t.title }));
  (project.payments || []).forEach((p) =>
    out.push({ id: `p-${p.id}`, date: d10(p.date), kind: 'pago', title: 'Pago recibido', detail: p.note, amount: p.amount, currency: p.currency })
  );
  (project.consultingSessions || []).forEach((s) =>
    out.push({ id: `s-${s.id}`, date: d10(s.date), kind: 'sesion', title: `Sesión 1:1${s.topics || s.topic ? `: ${s.topics || s.topic}` : ''}`, detail: s.notes })
  );
  if (d10(project.createdAt)) out.push({ id: 'alta', date: d10(project.createdAt), kind: 'alta', title: 'Se sumó como cliente' });

  return out.filter((e) => e.date).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

/** Agrupa por mes para mostrar "Octubre 2026", "Septiembre 2026"… */
export function groupByMonth(entries: TimelineEntry[]): { month: string; entries: TimelineEntry[] }[] {
  const groups: { month: string; entries: TimelineEntry[] }[] = [];
  entries.forEach((e) => {
    const month = e.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.entries.push(e);
    else groups.push({ month, entries: [e] });
  });
  return groups;
}
