import type {
  AgendaMeeting,
  AgendaTask,
  ExpenseRecord,
  IncomeRecord,
  Project,
  ProspectEvent,
  StudioFixedExpense,
  StudioPaymentSettings,
  TaskPriority,
} from '../types';
import { addDays, parseLocalDate, startOfWeekMonday } from './dates';
import { calculateProjectBilling, resolveProjectAgreement } from './paymentPlans';
import { getCollectedEntries, monthMatcher, sumByCurrency } from './ledger';

/**
 * REVISIONES PERIÓDICAS (día, semana y mes)
 * Funciones puras: las usan la app (Inicio, Reportes) y el servidor (avisos automáticos).
 */

const PRIORITY_POINTS: Record<TaskPriority, number> = { alta: 30, media: 15, baja: 5 } as Record<TaskPriority, number>;

export const money = (n: number, cur: 'ARS' | 'USD') => `${cur === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`;

const daysBetween = (from: string, to: string) =>
  Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86400000);

// ---------------------------------------------------------------------------
// TUS 3 DEL DÍA
// ---------------------------------------------------------------------------

/** Puntaje: prioridad + atraso + si tiene hora hoy. Las de mañana en adelante no entran. */
export function scoreTask(t: AgendaTask, today: string): number {
  let score = PRIORITY_POINTS[(t.priority || 'media') as TaskPriority] ?? 15;
  if (t.date && t.date < today) score += 10 + Math.min(10, daysBetween(t.date, today));
  if (t.date === today && t.time) score += 5;
  if (t.projectId) score += 3; // trabajo de cliente
  return score;
}

export function pickTop3(tasks: AgendaTask[], today: string): AgendaTask[] {
  return tasks
    .filter((t) => !t.completed && t.date && t.date <= today)
    .sort((a, b) => scoreTask(b, today) - scoreTask(a, today) || (a.time || '99').localeCompare(b.time || '99'))
    .slice(0, 3);
}

// ---------------------------------------------------------------------------
// COBRANZA DE LA SEMANA
// ---------------------------------------------------------------------------

export interface CollectionItem {
  key: string;
  projectId: string;
  clientName: string;
  ownerName?: string;
  phone?: string;
  title: string;
  amount: number;
  currency: 'ARS' | 'USD';
  dueDate: string;
  daysLate: number; // > 0 si ya venció
}

/** Cuotas y compromisos que vencen en los próximos `days` días, más los vencidos sin cobrar */
export function weeklyCollections(projects: Project[], incomes: IncomeRecord[], today: string, days = 7): CollectionItem[] {
  const limit = addDays(today, days);
  const out: CollectionItem[] = [];
  projects
    .filter((p) => !p.archived && !p.isLead)
    .forEach((p) => {
      const seen = new Set<string>();
      const push = (title: string, amount: number, currency: 'ARS' | 'USD', dueDate: string) => {
        if (!(amount > 0) || !dueDate || dueDate > limit) return;
        const dedupe = `${dueDate}|${Math.round(amount)}`;
        if (seen.has(dedupe)) return;
        seen.add(dedupe);
        out.push({
          key: `${p.id}|${dueDate}|${title}`,
          projectId: p.id,
          clientName: p.clientName,
          ownerName: p.ownerName,
          phone: p.clientPhone,
          title,
          amount,
          currency,
          dueDate,
          daysLate: Math.max(0, daysBetween(dueDate, today)),
        });
      };
      try {
        resolveProjectAgreement(p, incomes).installments.forEach((c) =>
          push(c.title || `Cuota ${c.number}`, (Number(c.expectedAmount) || 0) - (Number(c.actualPaidAmount) || 0), c.currency, c.dueDate)
        );
        const billing = calculateProjectBilling(p, incomes);
        billing.commitments
          .filter((c) => c.status !== 'cobrado')
          .forEach((c) => push(c.title, (Number(c.amount) || 0) - (Number(c.amountPaid) || 0), c.currency || billing.currency, c.dueDate));
      } catch {
        // proyecto con datos incompletos: se ignora en la cobranza
      }
    });
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function collectionMessage(item: CollectionItem, settings?: StudioPaymentSettings): string {
  const first = (item.ownerName || item.clientName).split(' ')[0].replace(/^Arq\.?$/i, item.clientName);
  const when = `el ${fmtDay(item.dueDate)} ${item.daysLate > 0 ? 'venció' : 'vence'}`;
  const datos = [
    item.currency === 'USD' ? settings?.aliasUsd && `Alias USD: ${settings.aliasUsd}` : settings?.aliasArs && `Alias: ${settings.aliasArs}`,
    item.currency === 'USD' ? settings?.cbuUsd && `CBU/CVU: ${settings.cbuUsd}` : settings?.cbuArs && `CBU/CVU: ${settings.cbuArs}`,
    settings?.paymentLink && `Link de pago: ${settings.paymentLink}`,
    settings?.accountHolder && `Titular: ${settings.accountHolder}`,
  ].filter(Boolean);
  return [
    `¡Hola ${first}! ¿Cómo va?`,
    `Te escribo para recordarte que ${when} ${item.title.toLowerCase()} por ${money(item.amount, item.currency)}.`,
    datos.length ? `Te dejo los datos:\n${datos.join('\n')}` : '',
    '¡Gracias!',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export const fmtDay = (d: string) => parseLocalDate(d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

// ---------------------------------------------------------------------------
// SEMANA
// ---------------------------------------------------------------------------

export function weekBounds(today: string, offsetWeeks = 0) {
  const start = addDays(startOfWeekMonday(today), offsetWeeks * 7);
  return { start, end: addDays(start, 6) };
}

const inRange = (d: string | undefined | null, start: string, end: string) => Boolean(d && d.slice(0, 10) >= start && d.slice(0, 10) <= end);

export interface WeekSummary {
  start: string;
  end: string;
  tareasHechas: number;
  reunionesHechas: number;
  cobrado: { ARS: number; USD: number };
  contactos: number;
  atrasadas: AgendaTask[];
}

export function weekSummary(
  input: { tasks: AgendaTask[]; meetings: AgendaMeeting[]; projects: Project[]; incomes: IncomeRecord[]; events?: ProspectEvent[] },
  today: string,
  offsetWeeks = 0
): WeekSummary {
  const { start, end } = weekBounds(today, offsetWeeks);
  const tareasHechas = input.tasks.filter((t) => t.completed && inRange(t.completedAt || t.date, start, end)).length;
  const reunionesHechas = input.meetings.filter((m) => m.completed && inRange(m.date, start, end)).length;
  const cobrado = sumByCurrency(getCollectedEntries(input.incomes, input.projects, (d) => inRange(d || '', start, end)));
  const contactos = (input.events || []).filter((e) => ['first_contact', 'follow_up'].includes(e.type) && inRange(e.date, start, end)).length;
  const atrasadas = input.tasks.filter((t) => !t.completed && t.date && t.date < today).sort((a, b) => a.date.localeCompare(b.date));
  return { start, end, tareasHechas, reunionesHechas, cobrado, contactos, atrasadas };
}

// ---------------------------------------------------------------------------
// PROSPECCIÓN DE LA SEMANA
// ---------------------------------------------------------------------------

export interface ProspectingWeek {
  contactos: number;
  seguimientos: number;
  respuestas: number;
  llamadas: number;
  propuestas: number;
  ganados: number;
}

export function prospectingWeek(events: ProspectEvent[], today: string, offsetWeeks = 0): ProspectingWeek {
  const { start, end } = weekBounds(today, offsetWeeks);
  const count = (...types: string[]) => events.filter((e) => types.includes(e.type) && inRange(e.date, start, end)).length;
  return {
    contactos: count('first_contact'),
    seguimientos: count('follow_up'),
    respuestas: count('reply'),
    llamadas: count('call'),
    propuestas: count('proposal_sent'),
    ganados: count('won'),
  };
}

// ---------------------------------------------------------------------------
// ALUMNOS PAF
// ---------------------------------------------------------------------------

export interface PafStudentRow {
  project: Project;
  hitos: { done: number; total: number };
  horas: { done: number; total: number };
  lastSession?: string;
  daysSinceSession?: number;
  nextSession?: string;
  alert: boolean;
}

const isPaf = (p: Project) => p.serviceType === 'paf' || String(p.projectType || '').startsWith('paf');

export function pafReport(projects: Project[], meetings: AgendaMeeting[], today: string, alertDays = 10): PafStudentRow[] {
  return projects
    .filter((p) => isPaf(p) && !p.archived && !p.isLead && !['completado', 'cancelado', 'graduado'].includes(String(p.status || '').toLowerCase()))
    .map((p) => {
      const sessions = [
        ...(p.consultingSessions || []).map((s) => s.date),
        ...meetings.filter((m) => m.projectId === p.id && m.completed).map((m) => m.date),
      ].filter((d) => d && d <= today);
      const lastSession = sessions.sort().pop();
      const nextSession = meetings
        .filter((m) => m.projectId === p.id && !m.completed && m.date >= today)
        .map((m) => m.date)
        .sort()[0];
      const milestones = p.pafMilestones || [];
      const done = (p.consultingSessions || []).reduce((s, x) => s + (Number(x.durationHours ?? x.hours) || 0), 0) || Number(p.pafConsultingHoursDone) || 0;
      const daysSinceSession = lastSession ? daysBetween(lastSession, today) : undefined;
      return {
        project: p,
        hitos: { done: milestones.filter((m) => m.completed).length, total: milestones.length },
        horas: { done, total: Number(p.pafConsultingHoursTotal) || 0 },
        lastSession,
        daysSinceSession,
        nextSession,
        alert: daysSinceSession === undefined ? !nextSession : daysSinceSession >= alertDays && !nextSession,
      };
    })
    .sort((a, b) => Number(b.alert) - Number(a.alert) || (b.daysSinceSession ?? 999) - (a.daysSinceSession ?? 999));
}

// ---------------------------------------------------------------------------
// CIERRE DE MES
// ---------------------------------------------------------------------------

export interface MonthClose {
  month: string;
  cobrado: { ARS: number; USD: number };
  gastos: { ARS: number; USD: number };
  sinFacturar: { clientName: string; amount: number; currency: 'ARS' | 'USD'; date: string }[];
  renovaciones: StudioFixedExpense[];
}

export function monthClose(
  input: { projects: Project[]; incomes: IncomeRecord[]; expenses: ExpenseRecord[]; fixedExpenses: StudioFixedExpense[] },
  today: string,
  monthKey = today.slice(0, 7)
): MonthClose {
  const cobrado = sumByCurrency(getCollectedEntries(input.incomes, input.projects, monthMatcher(monthKey)));
  const gastos = { ARS: 0, USD: 0 };
  input.expenses
    .filter((e) => (e.month || e.date || '').slice(0, 7) === monthKey && e.status !== 'pendiente')
    .forEach((e) => (gastos[e.currency] += Number(e.amount) || 0));
  const sinFacturar = input.projects.flatMap((p) =>
    (p.payments || [])
      .filter((pay) => (pay.date || '').slice(0, 7) === monthKey && !pay.invoiced && !(pay as any).facturado)
      .map((pay) => ({ clientName: p.clientName, amount: Number(pay.amount) || 0, currency: pay.currency, date: pay.date }))
  );
  const limit = addDays(today, 30);
  const renovaciones = input.fixedExpenses
    .filter((f) => f.active !== false && f.nextDueDate && f.nextDueDate >= today && f.nextDueDate <= limit)
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  return { month: monthKey, cobrado, gastos, sinFacturar, renovaciones };
}
