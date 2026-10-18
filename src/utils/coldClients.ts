import type { AgendaMeeting, AgendaTask, Project } from '../types';
import { parseLocalDate } from './dates';

/**
 * CLIENTES QUE SE ENFRÍAN
 * Un cliente activo sin contacto hace X días aparece en Inicio para escribirle.
 * "Último contacto" = lo más reciente entre: la fecha que marcaste, una reunión hecha
 * o un pago recibido. Si no hay nada de eso, se toma cuando se creó el cliente.
 */

export const COLD_AFTER_DAYS = 14;
const INACTIVE = ['completado', 'cancelado', 'pausado', 'finalizado', 'archivado'];

export interface ColdClient {
  project: Project;
  lastContact: string;
  daysSince: number;
  /** Ya hay una tarea pendiente para escribirle */
  hasTask: boolean;
}

const day = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '');

export function daysBetween(from: string, to: string): number {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86400000);
}

export function coldClients(projects: Project[], meetings: AgendaMeeting[], tasks: AgendaTask[], today: string, afterDays = COLD_AFTER_DAYS): ColdClient[] {
  return projects
    .filter((p) => !p.archived && !p.isLead && !INACTIVE.includes(String(p.status || '').toLowerCase()))
    .map((p) => {
      const candidates = [
        day(p.lastContactDate),
        ...meetings.filter((m) => m.projectId === p.id && m.completed).map((m) => day(m.date)),
        ...(p.payments || []).map((pay) => day(pay.date)),
        day(p.createdAt),
      ].filter((d) => d && d <= today);
      const lastContact = candidates.sort().pop() || today;
      const hasTask = tasks.some((t) => !t.completed && t.projectId === p.id && /^escribirle/i.test(t.title));
      return { project: p, lastContact, daysSince: daysBetween(lastContact, today), hasTask };
    })
    .filter((c) => c.daysSince >= afterDays)
    .sort((a, b) => b.daysSince - a.daysSince);
}

/** Link de WhatsApp con el número del cliente (Argentina: agrega 549 si falta) */
export function whatsappLink(phone?: string): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.startsWith('54')) return `https://wa.me/${digits}`;
  // Número nacional: 10 dígitos (característica + número). Se quita el 0 y el "15" de celular.
  let national = digits.replace(/^0/, '');
  if (national.length === 12) {
    for (const at of [2, 3, 4]) {
      if (national.slice(at, at + 2) === '15') {
        national = national.slice(0, at) + national.slice(at + 2);
        break;
      }
    }
  }
  return `https://wa.me/549${national}`;
}
