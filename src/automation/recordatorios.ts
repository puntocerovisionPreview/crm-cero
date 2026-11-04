/**
 * RECORDATORIOS DURANTE EL DÍA (para Juan): tareas que quedan, pagos que vencen y cobros.
 * Funciones puras: el servidor las corre cada 10 minutos y cada aviso sale una sola vez
 * (por su `key`). Agrupan todo en un aviso por momento, para no llenarte de notificaciones.
 */
import type { AgendaTask, PersonalRecurring, StudioFixedExpense } from '../types';
import { formatMoney, getDueCollections, type AutomationData } from './messages';

export interface Recordatorio { key: string; title: string; body: string; url: string }

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const PRIORIDAD: Record<string, number> = { alta: 0, media: 1, baja: 2 };

/** Momentos del día en que te recuerda lo que queda (si queda algo) */
export const TANDAS_TAREAS = [11 * 60, 14 * 60 + 30, 17 * 60 + 30];

/**
 * Tareas de hoy que siguen sin hacer: a las 11, a las 14:30 y a las 17:30 te dice cuántas
 * quedan y cuáles, las importantes primero. Si ya hiciste todo, no dice nada.
 */
export function recordatorioTareas(tasks: AgendaTask[], today: string, nowMin: number): Recordatorio | null {
  const tanda = [...TANDAS_TAREAS].reverse().find((t) => nowMin >= t && nowMin < t + 120);
  if (tanda === undefined) return null;
  const hoy = tasks.filter((t) => t.date === today && !t.completed)
    .sort((a, b) => (PRIORIDAD[(a as any).priority || 'media'] ?? 1) - (PRIORIDAD[(b as any).priority || 'media'] ?? 1) || (a.time || '99').localeCompare(b.time || '99'));
  const atrasadas = tasks.filter((t) => !t.completed && t.date && t.date < today);
  if (!hoy.length && !atrasadas.length) return null;
  const ultima = tanda === TANDAS_TAREAS[TANDAS_TAREAS.length - 1];
  const lines = hoy.slice(0, 5).map((t) => `• ${(t as any).priority === 'alta' ? '🔴 ' : ''}${t.title}${t.time ? ` (${t.time})` : ''}`);
  if (hoy.length > 5) lines.push(`y ${hoy.length - 5} más`);
  if (atrasadas.length) lines.push(`Además, ${atrasadas.length} ${atrasadas.length === 1 ? 'atrasada' : 'atrasadas'} de días anteriores.`);
  return {
    key: `tareas_${today}_${hhmm(tanda)}`,
    title: hoy.length
      ? `${ultima ? 'Antes de cerrar el día: ' : ''}te ${hoy.length === 1 ? 'queda 1 tarea' : `quedan ${hoy.length} tareas`} de hoy`
      : `Tenés ${atrasadas.length} ${atrasadas.length === 1 ? 'tarea atrasada' : 'tareas atrasadas'}`,
    body: lines.join('\n'),
    url: '/agenda',
  };
}

/**
 * Pagos fijos (hosting, dominios, suscripciones…) y personales (alquiler, servicios, tarjeta…).
 * Se dan por pagos cuando registrás el pago
 * (su próximo vencimiento pasa al siguiente período). Avisa:
 * - 9:00: lo que vence hoy, mañana y pasado, y lo vencido sin registrar
 * - 17:00: lo de hoy que todavía no registraste, y lo vencido
 */
export function recordatorioPagos(fixed: StudioFixedExpense[], today: string, nowMin: number, personales: PersonalRecurring[] = []): Recordatorio | null {
  // Los del estudio y los personales (Mis finanzas → Recurrentes: alquiler, servicios, tarjeta…)
  const activos: Pago[] = [
    ...fixed.filter((f) => f.active && f.nextDueDate).map((f) => ({ name: f.name, amount: f.amount, currency: f.currency, due: f.nextDueDate, autoRenew: !!f.autoRenew, personal: false })),
    ...personales.filter((r) => r.active && r.type === 'gasto' && r.nextDate).map((r) => ({ name: r.title, amount: r.amount, currency: r.currency, due: r.nextDate, autoRenew: false, personal: true })),
  ];
  const manana = nowMin >= 9 * 60 && nowMin < 13 * 60;
  const tarde = nowMin >= 17 * 60 && nowMin < 21 * 60;
  if (!manana && !tarde) return null;
  const vencidos = activos.filter((f) => f.due < today);
  const hoy = activos.filter((f) => f.due === today);
  const proximos = manana ? activos.filter((f) => f.due > today && f.due <= addDays(today, 2)) : [];
  if (!vencidos.length && !hoy.length && !proximos.length) return null;
  const linea = (f: Pago) => `• ${f.name}: ${formatMoney(f.amount, f.currency)}${f.personal ? ' (personal)' : ''}${f.autoRenew ? ' (se debita solo: registralo igual)' : ''}`;
  const lines: string[] = [];
  if (vencidos.length) lines.push('Vencidos sin registrar:', ...vencidos.sort((a, b) => a.due.localeCompare(b.due)).map((f) => `${linea(f)} · venció el ${ddmm(f.due)}`));
  if (hoy.length) lines.push(`${vencidos.length ? '\n' : ''}Vencen hoy:`, ...hoy.map(linea));
  if (proximos.length) lines.push(`${vencidos.length || hoy.length ? '\n' : ''}Próximos:`, ...proximos.map((f) => `${linea(f)} · ${f.due === addDays(today, 1) ? 'mañana' : `el ${ddmm(f.due)}`}`));
  const relevantes = [...vencidos, ...hoy, ...proximos];
  const soloPersonales = relevantes.every((f) => f.personal);
  const hayPersonales = relevantes.some((f) => f.personal);
  lines.push(`\nCuando pagues, registralo en ${soloPersonales ? 'Mis finanzas → Recurrentes' : hayPersonales ? 'Dinero (los del estudio) o Mis finanzas (los personales)' : 'Dinero'} y deja de avisarte.`);
  const total = vencidos.length + hoy.length;
  return {
    key: `pagos_${today}_${manana ? 'manana' : 'tarde'}`,
    title: total
      ? `💳 ${tarde ? '¿Ya pagaste? ' : ''}${total === 1 ? `${(vencidos[0] || hoy[0]).name} ${vencidos.length ? 'está vencido' : 'vence hoy'}` : `${total} pagos ${vencidos.length ? 'vencidos o de hoy' : 'vencen hoy'}`}`
      : `💳 ${proximos.length === 1 ? `${proximos[0].name} vence pronto` : `${proximos.length} pagos vencen pronto`}`,
    body: lines.join('\n'),
    url: soloPersonales ? '/mis-finanzas/recurrentes' : '/dinero',
  };
}

interface Pago { name: string; amount: number; currency: string; due: string; autoRenew: boolean; personal: boolean }

/** Cobros a clientes que vencen hoy o están atrasados: a las 10, con el recordatorio de mandar el WhatsApp */
export function recordatorioCobros(data: AutomationData, today: string, nowMin: number): Recordatorio | null {
  if (nowMin < 10 * 60 || nowMin >= 14 * 60) return null;
  const cobros = getDueCollections(data, today);
  if (!cobros.length) return null;
  const atrasados = cobros.filter((c) => c.overdue);
  return {
    key: `cobros_${today}`,
    title: `💰 ${cobros.length === 1 ? `Cobro de ${cobros[0].clientName} ${cobros[0].overdue ? 'atrasado' : 'para hoy'}` : `${cobros.length} cobros ${atrasados.length ? 'pendientes' : 'para hoy'}`}`,
    body: [...cobros.map((c) => `• ${c.clientName}: ${formatMoney(c.amount, c.currency)} ${c.overdue ? `(atrasado desde el ${ddmm(c.dueDate)})` : '(vence hoy)'}`), '\nEn su ficha tenés el WhatsApp de cobro armado. Cuando te paguen, registralo.'].join('\n'),
    url: '/dinero',
  };
}
