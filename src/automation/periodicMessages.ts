import type { ExpenseRecord, ProspectEvent } from '../types';
import type { AutomationData } from './messages';
import { escapeHtml, formatMoney, longDate } from './messages';
import { monthClose, pafReport, pickTop3, prospectingWeek, weekSummary, weeklyCollections } from '../utils/periodic';
import { addMonths } from '../utils/dates';

/**
 * Avisos periódicos (Telegram / push). Usan los mismos cálculos que la app.
 * - Tus 3 del día (dentro del resumen de las 8)
 * - Cobranza de la semana (lunes)
 * - Reporte de alumnos PAF (viernes)
 * - Cierre de mes (día 1, sobre el mes que terminó)
 * - Recordatorio de cierre del día (19 hs)
 */

export interface PeriodicData extends AutomationData {
  expenses?: ExpenseRecord[];
  prospectEvents?: ProspectEvent[];
}

const shortDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const pair = (v: { ARS: number; USD: number }) => [v.ARS ? formatMoney(v.ARS, 'ARS') : '', v.USD ? formatMoney(v.USD, 'USD') : ''].filter(Boolean).join(' + ') || '$ 0';

export function buildTop3Section(data: AutomationData, today: string): string {
  const top = pickTop3(data.tasks, today);
  if (!top.length) return '';
  return ['<b>⭐ Tus 3 de hoy</b>', ...top.map((t, i) => `${i + 1}. ${escapeHtml(t.title)}${t.date < today ? ' <i>(atrasada)</i>' : ''}`), '<i>Confirmalas en Inicio.</i>'].join('\n');
}

export function buildWeeklyCollections(data: AutomationData, today: string): string | null {
  const items = weeklyCollections(data.projects, data.incomes, today);
  if (!items.length) return null;
  const totals = { ARS: 0, USD: 0 };
  items.forEach((i) => (totals[i.currency] += i.amount));
  return [
    `<b>💵 Cobranza de la semana</b>`,
    `${pair(totals)} en ${items.length} ${items.length === 1 ? 'cuota' : 'cuotas'}:`,
    ...items.map((i) => `• ${escapeHtml(i.clientName)}: ${formatMoney(i.amount, i.currency)} ${i.daysLate > 0 ? `(<b>vencida hace ${i.daysLate} d</b>)` : `(vence ${shortDay(i.dueDate)})`}`),
    '',
    '<i>En Inicio tenés el WhatsApp de recordatorio ya armado para cada una.</i>',
  ].join('\n');
}

export function buildPafReport(data: AutomationData, today: string): string | null {
  const rows = pafReport(data.projects, data.meetings, today);
  if (!rows.length) return null;
  const alerts = rows.filter((r) => r.alert);
  return [
    `<b>🎓 Alumnos PAF</b>`,
    ...rows.map((r) => {
      const hitos = r.hitos.total ? `${r.hitos.done}/${r.hitos.total} hitos` : 'sin hitos';
      const horas = r.horas.total ? `${r.horas.done}/${r.horas.total} h` : `${r.horas.done} h`;
      const ses = r.daysSinceSession === undefined ? 'sin sesiones' : `última sesión hace ${r.daysSinceSession} d`;
      return `• ${r.alert ? '⚠️ ' : ''}${escapeHtml(r.project.clientName)}: ${hitos}, ${horas}, ${ses}${r.nextSession ? `, próxima ${shortDay(r.nextSession)}` : ''}`;
    }),
    alerts.length ? `\n<b>Agendá sesión con:</b> ${alerts.map((a) => escapeHtml(a.project.clientName)).join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildProspectingWeek(data: PeriodicData, today: string): string | null {
  const events = data.prospectEvents || [];
  if (!events.length) return null;
  const w = prospectingWeek(events, today);
  const prev = prospectingWeek(events, today, -1);
  const goal = data.prospectingSettings?.weeklyGoal || 0;
  const diff = (a: number, b: number) => (a > b ? ` (+${a - b})` : a < b ? ` (${a - b})` : '');
  return [
    `<b>📈 Prospección de la semana</b>`,
    `• Primeros contactos: ${w.contactos}${diff(w.contactos, prev.contactos)}`,
    `• Seguimientos: ${w.seguimientos}`,
    `• Respuestas: ${w.respuestas}${goal ? ` de ${goal} de meta` : ''}${diff(w.respuestas, prev.respuestas)}`,
    `• Llamadas: ${w.llamadas} · Propuestas: ${w.propuestas} · Ganados: ${w.ganados}`,
  ].join('\n');
}

export function buildMonthClose(data: PeriodicData, today: string): string {
  const prevMonth = addMonths(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
  const m = monthClose({ projects: data.projects, incomes: data.incomes, expenses: data.expenses || [], fixedExpenses: data.fixedExpenses }, today, prevMonth);
  const name = `${longDate(`${prevMonth}-15`).split(' de ').slice(1).join(' de ')} ${prevMonth.slice(0, 4)}`;
  const lines = [
    `<b>📊 Cierre de ${escapeHtml(name)}</b>`,
    `• Cobrado: ${pair(m.cobrado)}`,
    `• Gastos registrados: ${pair(m.gastos)}`,
    `• Neto: ${pair({ ARS: m.cobrado.ARS - m.gastos.ARS, USD: m.cobrado.USD - m.gastos.USD })}`,
  ];
  if (m.sinFacturar.length) {
    lines.push('', `<b>Falta facturar</b> (${m.sinFacturar.length}):`, ...m.sinFacturar.map((s) => `• ${escapeHtml(s.clientName)}: ${formatMoney(s.amount, s.currency)}`));
  }
  if (m.renovaciones.length) {
    lines.push('', `<b>Se renueva en los próximos 30 días</b>:`, ...m.renovaciones.map((f) => `• ${escapeHtml(f.name)}: ${formatMoney(f.amount, f.currency)} (${shortDay(f.nextDueDate)})`));
  }
  lines.push('', '<i>Detalle en Reportes → Mes.</i>');
  return lines.join('\n');
}

export function buildDayCloseNudge(data: AutomationData, today: string): string {
  const s = weekSummary({ tasks: data.tasks, meetings: data.meetings, projects: data.projects, incomes: data.incomes }, today);
  const doneToday = data.tasks.filter((t) => t.completed && (t.completedAt || t.date) === today).length;
  const pending = data.tasks.filter((t) => !t.completed && t.date && t.date <= today).length;
  return [
    `<b>🌙 Cerrá el día</b>`,
    `Hoy terminaste ${doneToday} ${doneToday === 1 ? 'tarea' : 'tareas'}${pending ? ` y quedan ${pending} pendientes` : ' y no queda nada pendiente'}.`,
    `En la semana llevás ${s.tareasHechas}.`,
    'Entrá a Inicio → "Cerrar el día": pasás lo pendiente a mañana y dejás una línea de bitácora.',
  ].join('\n');
}
