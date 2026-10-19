import { AgendaMeeting, AgendaTask, IncomeRecord, Project, StudioFixedExpense } from '../types';
import { calculateProjectBilling, resolveProjectAgreement } from '../utils/paymentPlans';
import { addDays, parseLocalDate } from '../utils/dates';
import { RoutineItem, appliesOn } from '../utils/dailyRoutineCore';
import { sortTasks } from '../utils/taskSort';
import { Prospect, ProspectingSettings } from '../types';
import { buildDailyQueue, callsWithoutTime, pendingDayClose, pendingOutcomes, DEFAULT_PROSPECTING_SETTINGS } from '../prospecting/core';

/**
 * Textos que manda el motor de automatización (Telegram). Lógica pura:
 * recibe los datos y la fecha, devuelve el mensaje. La usa el servidor y se puede probar.
 * Formato: HTML de Telegram (<b>, <i>), con el texto del usuario escapado.
 */

export interface AutomationData {
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects: Project[];
  incomes: IncomeRecord[];
  fixedExpenses: StudioFixedExpense[];
  routine: RoutineItem[];
  prospects?: Prospect[];
  prospectingSettings?: ProspectingSettings;
}

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function escapeHtml(text: string): string {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatMoney(amount: number, currency: 'USD' | 'ARS' | string = 'ARS'): string {
  const n = Math.round(Number(amount) || 0).toLocaleString('es-AR');
  return currency === 'USD' ? `US$ ${n}` : `$ ${n}`;
}

export function longDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

function isActiveClient(p: Project): boolean {
  if (p.archived) return false;
  return !(p.isLead || ['Posible proyecto', 'Propuesta enviada', 'En negociación', 'No concretado'].includes(p.status));
}

const PRIORITY_MARK: Record<string, string> = { alta: '🔴 ', media: '', baja: '⚪ ' };

export interface DueCollection {
  projectId: string;
  clientName: string;
  amount: number;
  currency: 'USD' | 'ARS';
  dueDate: string;
  overdue: boolean;
  phone?: string;
}

/** Cobros que vencen hasta `untilDate` (incluye atrasados). Un renglón por cliente. */
export function getDueCollections(data: AutomationData, today: string, untilDate: string = today): DueCollection[] {
  const out: DueCollection[] = [];
  data.projects.filter(isActiveClient).forEach((p) => {
    const billing = calculateProjectBilling(p, data.incomes);
    if (billing.saldoPendiente <= 0) return;
    const agreement = resolveProjectAgreement(p, data.incomes);
    const pendingCuotas = agreement.installments
      .filter((c) => c.dueDate && c.dueDate <= untilDate && (Number(c.expectedAmount) || 0) > (Number(c.actualPaidAmount) || 0))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const pendingCommitments = billing.commitments
      .filter((c) => c.status !== 'cobrado' && c.dueDate && c.dueDate <= untilDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const first = pendingCommitments[0]?.dueDate || pendingCuotas[0]?.dueDate;
    if (!first) return;
    const dueAmount =
      pendingCommitments.length > 0
        ? pendingCommitments.reduce((s, c) => s + Math.max(0, (Number(c.amount) || 0) - (Number(c.amountPaid) || 0)), 0)
        : pendingCuotas.reduce((s, c) => s + Math.max(0, (Number(c.expectedAmount) || 0) - (Number(c.actualPaidAmount) || 0)), 0);
    out.push({
      projectId: p.id,
      clientName: p.clientName,
      amount: Math.min(dueAmount, billing.saldoPendiente),
      currency: billing.currency,
      dueDate: first,
      overdue: first < today,
      phone: p.clientPhone,
    });
  });
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function getUpcomingFixedExpenses(data: AutomationData, today: string, days = 3): StudioFixedExpense[] {
  const until = addDays(today, days);
  return data.fixedExpenses
    .filter((f) => f.active && f.nextDueDate && f.nextDueDate <= until)
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
}

export function buildDailyBrief(data: AutomationData, today: string, greeting = 'Buen día'): string {
  const lines: string[] = [];
  lines.push(`<b>${greeting}. Hoy es ${longDate(today)}.</b>`);

  const routine = data.routine.filter((r) => appliesOn(r, today));
  if (routine.length) {
    lines.push('', `<b>Primero, tu rutina</b>`);
    routine.forEach((r) => lines.push(`• ${escapeHtml(r.title)}`));
  }

  const meetings = data.meetings
    .filter((m) => m.date === today && !m.completed)
    .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  if (meetings.length) {
    lines.push('', `<b>Reuniones</b>`);
    meetings.forEach((m) => lines.push(`• ${m.time ? `${m.time} ` : ''}${escapeHtml(m.title)}`));
  }

  const todayTasks = sortTasks(data.tasks.filter((t) => t.date === today && !t.completed), 'prioridad');
  if (todayTasks.length) {
    lines.push('', `<b>Tareas de hoy</b>`);
    todayTasks.slice(0, 10).forEach((t) =>
      lines.push(`• ${PRIORITY_MARK[t.priority || 'media'] || ''}${escapeHtml(t.title)}${t.time ? ` (${t.time})` : ''}`)
    );
    if (todayTasks.length > 10) lines.push(`<i>y ${todayTasks.length - 10} más</i>`);
  }

  const overdue = data.tasks.filter((t) => !t.completed && t.date && t.date < today);
  if (overdue.length) {
    lines.push('', `<b>Atrasadas:</b> ${overdue.length} ${overdue.length === 1 ? 'tarea' : 'tareas'} de días anteriores.`);
  }

  const collections = getDueCollections(data, today);
  if (collections.length) {
    lines.push('', `<b>Cobros</b>`);
    collections.forEach((c) =>
      lines.push(
        `• ${escapeHtml(c.clientName)}: ${formatMoney(c.amount, c.currency)} ${c.overdue ? `(atrasado desde el ${c.dueDate.slice(8, 10)}/${c.dueDate.slice(5, 7)})` : '(vence hoy)'}`
      )
    );
  }

  const fixed = getUpcomingFixedExpenses(data, today);
  if (fixed.length) {
    lines.push('', `<b>Pagos que vencen</b>`);
    fixed.forEach((f) =>
      lines.push(`• ${escapeHtml(f.name)}: ${formatMoney(f.amount, f.currency)} (${f.nextDueDate < today ? 'vencido' : f.nextDueDate === today ? 'hoy' : `el ${f.nextDueDate.slice(8, 10)}/${f.nextDueDate.slice(5, 7)}`})`)
    );
  }

  const prospecting = prospectingSummary(data, today);
  if (prospecting) lines.push('', prospecting);

  if (lines.length === 1) lines.push('', 'No hay nada agendado. Buen día para avanzar en lo importante.');
  return lines.join('\n');
}

export interface ReminderItem {
  kind: 'reunion' | 'tarea';
  id: string;
  title: string;
  time: string;
  minutesBefore: number;
}

/**
 * Lo que hay que avisar ahora: reuniones (15 min antes por defecto) y tareas con aviso,
 * cuya hora de aviso cayó en los últimos `windowMinutes` y que todavía no se avisaron.
 */
export function getDueReminders(
  data: AutomationData,
  today: string,
  nowMinutes: number,
  windowMinutes = 20
): ReminderItem[] {
  const out: ReminderItem[] = [];
  const consider = (kind: 'reunion' | 'tarea', item: AgendaTask | AgendaMeeting, defaultBefore?: number) => {
    if (item.completed || item.date !== today || !item.time || !item.time.includes(':')) return;
    if ((item as any).telegramReminded) return;
    const before = item.reminderMinutesBefore ?? defaultBefore;
    if (before === undefined) return;
    const [h, m] = item.time.split(':').map(Number);
    const alertAt = h * 60 + m - before;
    if (nowMinutes >= alertAt && nowMinutes < alertAt + windowMinutes) {
      out.push({ kind, id: item.id, title: item.title, time: item.time, minutesBefore: before });
    }
  };
  data.meetings.forEach((m) => consider('reunion', m, 15));
  data.tasks.forEach((t) => consider('tarea', t));
  return out;
}

export function buildReminderMessage(r: ReminderItem): string {
  const when = r.minutesBefore > 0 ? `en ${r.minutesBefore} min` : 'ahora';
  return r.kind === 'reunion'
    ? `<b>Reunión ${when}</b> (${r.time})\n${escapeHtml(r.title)}`
    : `<b>Tarea ${when}</b> (${r.time})\n${escapeHtml(r.title)}`;
}

/** Plan de la semana que empieza el lunes `weekStart`. */
export function buildWeeklyPlan(data: AutomationData, weekStart: string, today: string): string {
  const weekEnd = addDays(weekStart, 6);
  const lines: string[] = [`<b>Tu semana: ${longDate(weekStart)} al ${longDate(weekEnd)}</b>`];

  const overdue = data.tasks.filter((t) => !t.completed && t.date && t.date < weekStart);
  if (overdue.length) {
    lines.push('', `<b>Arrastrás ${overdue.length} ${overdue.length === 1 ? 'tarea atrasada' : 'tareas atrasadas'}</b>`);
    sortTasks(overdue, 'prioridad')
      .slice(0, 5)
      .forEach((t) => lines.push(`• ${PRIORITY_MARK[t.priority || 'media'] || ''}${escapeHtml(t.title)}`));
  }

  lines.push('', '<b>Día por día</b>');
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const m = data.meetings.filter((x) => x.date === d && !x.completed).length;
    const t = data.tasks.filter((x) => x.date === d && !x.completed);
    const high = t.filter((x) => x.priority === 'alta').length;
    if (m === 0 && t.length === 0) continue;
    const name = DAY_NAMES[parseLocalDate(d).getDay()];
    const parts: string[] = [];
    if (t.length) parts.push(`${t.length} ${t.length === 1 ? 'tarea' : 'tareas'}${high ? ` (${high} de prioridad alta)` : ''}`);
    if (m) parts.push(`${m} ${m === 1 ? 'reunión' : 'reuniones'}`);
    lines.push(`• ${name.charAt(0).toUpperCase() + name.slice(1)}: ${parts.join(' y ')}`);
  }

  const collections = getDueCollections(data, today, weekEnd);
  if (collections.length) {
    lines.push('', '<b>Cobros de la semana</b>');
    collections.forEach((c) =>
      lines.push(`• ${escapeHtml(c.clientName)}: ${formatMoney(c.amount, c.currency)}${c.overdue ? ' (atrasado)' : ` (vence ${c.dueDate.slice(8, 10)}/${c.dueDate.slice(5, 7)})`}`)
    );
  }

  const fixed = data.fixedExpenses.filter((f) => f.active && f.nextDueDate && f.nextDueDate <= weekEnd);
  if (fixed.length) {
    lines.push('', '<b>Pagos de la semana</b>');
    fixed.forEach((f) => lines.push(`• ${escapeHtml(f.name)}: ${formatMoney(f.amount, f.currency)}`));
  }

  return lines.join('\n');
}

// ---------------- PROSPECCIÓN ----------------

/** Bloque de prospección para el resumen de la mañana (vacío si no hay nada). */
export function prospectingSummary(data: AutomationData, today: string): string {
  if (!data.prospects || data.prospects.length === 0) return '';
  const settings = data.prospectingSettings || DEFAULT_PROSPECTING_SETTINGS;
  const { items } = buildDailyQueue(data.prospects, today, settings);
  const toMark = pendingOutcomes(data.prospects, today).length;
  const noTime = callsWithoutTime(data.prospects, today);
  if (items.length === 0 && !toMark && !noTime.length) return '';
  const count = (k: string) => items.filter((i) => i.kind === k).length;
  const parts: string[] = [];
  const calls = items.filter((i) => i.kind === 'llamada_hoy');
  const replies = items.filter((i) => i.kind === 'responder');
  if (calls.length) parts.push(`${calls.length} ${calls.length === 1 ? 'llamada' : 'llamadas'} hoy`);
  if (replies.length) parts.push(`te toca contestarle a ${replies.length}`);
  const videos = items.filter((i) => i.kind === 'video');
  if (videos.length) parts.push(`${videos.length} ${videos.length === 1 ? 'video de auditoría' : 'videos de auditoría'} para mandar`);
  if (count('seguimiento')) parts.push(`${count('seguimiento')} ${count('seguimiento') === 1 ? 'seguimiento' : 'seguimientos'}`);
  if (count('primer')) parts.push(`${count('primer')} ${count('primer') === 1 ? 'primer mensaje' : 'primeros mensajes'}`);
  if (toMark) parts.push(`${toMark} sin anotar si respondieron`);
  const lines = [`<b>Prospección</b>`, `${parts.join(', ')}.`];
  calls.forEach((c) => lines.push(`• ${c.prospect.callTime || 'sin hora'} · llamada con ${escapeHtml(c.prospect.studio || c.prospect.name)}`));
  replies.slice(0, 5).forEach((r) => lines.push(`• Contestale a ${escapeHtml(r.prospect.studio || r.prospect.name)}${r.prospect.lastReplyNote ? `: «${escapeHtml(r.prospect.lastReplyNote.slice(0, 60))}»` : ''}`));
  if (noTime.length) lines.push(`• ${noTime.length === 1 ? 'Hay una llamada' : `Hay ${noTime.length} llamadas`} sin hora: cargala en Prospección.`);
  videos
    .filter((v) => v.overdueDays > 0 || v.prospect.videoDueDate === today)
    .forEach((v) => lines.push(`• Video para ${escapeHtml(v.prospect.studio || v.prospect.name)}: vence ${v.overdueDays > 0 ? 'ya pasó' : 'hoy'}`));
  return lines.join('\n');
}

/** Mensaje de la tarde: a quiénes les escribiste hoy y falta anotar qué pasó. */
export function buildProspectingClose(data: AutomationData, today: string): string | null {
  const pending = pendingDayClose(data.prospects || [], today);
  if (pending.length === 0) return null;
  return [
    `<b>Cierre del día de prospección</b>`,
    `Hoy les escribiste a ${pending.length} ${pending.length === 1 ? 'persona' : 'personas'}. ¿Qué pasó con cada una?`,
    ...pending.slice(0, 15).map((p) => `• ${escapeHtml(p.name)}${p.studio && p.studio !== p.name ? ` (${escapeHtml(p.studio)})` : ''}`),
    '',
    'Anotalo en la app (Hoy o Prospección): un toque por persona.',
  ].join('\n');
}
