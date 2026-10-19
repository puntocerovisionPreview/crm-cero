import { Prospect } from '../types';
import { addDays } from '../utils/dates';

/**
 * PREPARAR LA LLAMADA
 * Al agendar una llamada, tareas para el día anterior (o para hoy, si la llamada es mañana u hoy).
 * Lógica pura: la usa la app al agendar a mano y el servidor cuando reservan por Calendly.
 */

export interface PrepTask {
  key: string;
  title: string;
  on: boolean; // marcada por defecto
}

/** El día anterior a la llamada, pero nunca antes de hoy. */
export function prepDateFor(callDate: string, today: string): string {
  const before = addDays(callDate, -1);
  return before < today ? today : before;
}

export function suggestedPrepTasks(p: Prospect): PrepTask[] {
  const name = p.studio || p.name;
  const tasks: PrepTask[] = [
    { key: 'confirmar', title: `Confirmar la llamada con ${name} por WhatsApp`, on: true },
    {
      key: 'revisar',
      title: p.audit ? `Repasar la auditoría y la web de ${name}` : `Mirar la web y el Instagram de ${name}`,
      on: true,
    },
    { key: 'oferta', title: `Preparar qué ofrecerle a ${name} (precios y próximos pasos)`, on: true },
  ];
  if (p.stage === 'auditoria_completada' && !p.videoUrl) tasks.push({ key: 'video', title: `Grabar el video de la auditoría para ${name}`, on: true });
  tasks.push({ key: 'presupuesto', title: `Dejar armado el presupuesto para ${name}`, on: false });
  return tasks;
}

/** Id fijo por prospecto y tarea: si reprogramás, se actualiza en vez de duplicarse. */
export const prepTaskId = (prospectId: string, key: string) => `task_call_${prospectId}_${key}`.slice(0, 140);

/** "mañana (mar 20)", "hoy", "el jue 22". */
export function prepDayLabel(date: string, today: string): string {
  const d = new Date(`${date}T12:00:00`);
  const short = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
  if (date === today) return 'hoy';
  if (date === addDays(today, 1)) return `mañana (${short})`;
  return `el ${short}`;
}

/** Para cualquier reunión de la agenda (clientes, alumnos, llamadas): qué preparar el día anterior. */
export function suggestedMeetingPrep(title: string, clientName?: string): PrepTask[] {
  const t = title.trim();
  const who = (clientName || t).trim();
  return [
    { key: 'confirmar', title: who ? `Confirmar la reunión con ${who}` : 'Confirmar la reunión', on: true },
    { key: 'preparar', title: t ? `Preparar la reunión: ${t} (temas y materiales)` : 'Preparar la reunión (temas y materiales)', on: true },
    { key: 'repasar', title: who ? `Repasar notas y pendientes de ${who}` : 'Repasar notas y pendientes', on: false },
  ];
}
