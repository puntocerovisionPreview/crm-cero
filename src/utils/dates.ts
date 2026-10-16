/**
 * Utilidades de fecha y hora local para Argentina (America/Argentina/Cordoba / UTC-3).
 * Evita cualquier corrimiento de día provocado por new Date('YYYY-MM-DD') en UTC
 * o toISOString().slice(0, 10).
 */

const TIMEZONE_AR = 'America/Argentina/Cordoba';

/**
 * Obtiene la fecha actual formateada en 'YYYY-MM-DD' según la zona horaria de Argentina.
 */
export function todayLocal(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_AR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Obtiene el nombre del día de la semana actual en español (ej: "jueves").
 */
export function currentWeekdayLocal(): string {
  const formatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE_AR,
    weekday: 'long',
  });
  return formatter.format(new Date()).toLowerCase();
}

/**
 * Parsea un string 'YYYY-MM-DD' o Date a un objeto Date local seguro (sin desfase UTC).
 */
export function parseLocalDate(input: string | Date): Date {
  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }
  if (!input || typeof input !== 'string') {
    return new Date();
  }
  const clean = input.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d);
    }
  }
  return new Date();
}

/**
 * Convierte un objeto Date a formato 'YYYY-MM-DD' usando las componentes locales.
 */
export function formatLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Devuelve el mes en formato 'YYYY-MM' de una fecha 'YYYY-MM-DD' o Date.
 */
export function monthOf(input: string | Date): string {
  if (!input) return todayLocal().slice(0, 7);
  if (typeof input === 'string') {
    const clean = input.split('T')[0];
    const parts = clean.split('-');
    if (parts.length >= 2) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}`;
    }
  }
  const d = parseLocalDate(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Suma o resta días a una fecha de forma segura.
 */
export function addDays(input: string | Date, days: number): string {
  const d = parseLocalDate(input);
  d.setDate(d.getDate() + days);
  return formatLocalISO(d);
}

/**
 * Suma meses de forma segura para fin de mes.
 * (Ej: 31 de Enero + 1 mes = 28/29 de Febrero, no 3 de Marzo).
 */
export function addMonths(input: string | Date, months: number): string {
  const base = parseLocalDate(input);
  const targetYear = base.getFullYear();
  const targetMonth = base.getMonth() + months;
  const originalDay = base.getDate();

  // Primer día del mes objetivo
  const temp = new Date(targetYear, targetMonth, 1);
  // Último día válido del mes objetivo
  const lastDayInTarget = new Date(temp.getFullYear(), temp.getMonth() + 1, 0).getDate();
  const finalDay = Math.min(originalDay, lastDayInTarget);

  const result = new Date(temp.getFullYear(), temp.getMonth(), finalDay);
  return formatLocalISO(result);
}

/**
 * Devuelve el lunes correspondiente a la semana de la fecha dada ('YYYY-MM-DD').
 */
export function startOfWeekMonday(input?: string | Date): string {
  const d = input ? parseLocalDate(input) : parseLocalDate(todayLocal());
  const day = d.getDay(); // 0 = Domingo, 1 = Lunes, ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return formatLocalISO(d);
}

/**
 * Compara si date1 es menor, igual o mayor que date2 ('YYYY-MM-DD').
 */
export function compareDates(date1: string, date2: string): number {
  if (date1 < date2) return -1;
  if (date1 > date2) return 1;
  return 0;
}

/**
 * Convierte de forma 100% segura cualquier valor (string, Timestamp de Firestore, Date, number, null)
 * a un string de fecha en formato 'YYYY-MM-DD'.
 */
export function toSafeDateString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    return val.split('T')[0];
  }
  if (val instanceof Date) {
    return formatLocalISO(val);
  }
  if (typeof val === 'object') {
    // Firestore Timestamp con método toDate()
    if (typeof val.toDate === 'function') {
      try {
        return formatLocalISO(val.toDate());
      } catch {
        return todayLocal();
      }
    }
    // Firestore Timestamp con propiedad seconds
    if (typeof val.seconds === 'number') {
      return formatLocalISO(new Date(val.seconds * 1000));
    }
  }
  if (typeof val === 'number') {
    return formatLocalISO(new Date(val));
  }
  return String(val).split('T')[0];
}

/**
 * Convierte de forma segura cualquier valor a string ISO.
 */
export function normalizeTimestamp(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        return val.toDate().toISOString();
      } catch {
        return new Date().toISOString();
      }
    }
    if (typeof val.seconds === 'number') {
      return new Date(val.seconds * 1000).toISOString();
    }
  }
  if (typeof val === 'number') {
    return new Date(val).toISOString();
  }
  return String(val);
}
