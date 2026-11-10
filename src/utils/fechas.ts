// Fechas como se las dirías a alguien: "10 jun", "Venció el 10 jun", "Vence hoy".

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-06-10" → "10 jun" (con el año si no es el actual). Si no es una fecha, la devuelve tal cual. */
export function fechaCorta(iso?: string | null, today?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return iso || 'Sin fecha';
  const base = `${Number(m[3])} ${MESES[Number(m[2]) - 1] || m[2]}`;
  const anioActual = (today || new Date().toISOString()).slice(0, 4);
  return m[1] === anioActual ? base : `${base} ${m[1]}`;
}

/** "Venció el 10 jun" / "Vence hoy" / "Vence el 10 jun" */
export function textoVence(iso: string | undefined | null, today: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return 'Sin fecha';
  const dia = iso.slice(0, 10);
  if (dia === today) return 'Vence hoy';
  return `${dia < today ? 'Venció' : 'Vence'} el ${fechaCorta(dia, today)}`;
}

const MESES_CICLO: Record<string, number> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12, bianual: 24 };

/**
 * Próximo vencimiento real de un gasto fijo. Si el último pago cae en el mismo mes que el
 * vencimiento anotado, ese vencimiento ya está pago: el que sigue es el del ciclo siguiente.
 * (Pasa cuando se anota el pago sin tocar "Renovar": quedaba "pagado este mes" y "vencido" a la vez.)
 */
export function proximoVencimiento(nextDueDate: string, lastPaidDate: string | undefined, billingCycle: string | undefined): string {
  if (!nextDueDate || !lastPaidDate || lastPaidDate.slice(0, 7) !== nextDueDate.slice(0, 7)) return nextDueDate;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(nextDueDate);
  if (!m) return nextDueDate;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + (MESES_CICLO[billingCycle || 'mensual'] || 1);
  const anio = Math.floor(total / 12);
  const mes = total % 12;
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(Math.min(Number(m[3]), ultimoDia)).padStart(2, '0')}`;
}
