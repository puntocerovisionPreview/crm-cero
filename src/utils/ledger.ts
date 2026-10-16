import { IncomeRecord, Project } from '../types';

/**
 * Libro único de cobros: la ÚNICA fuente para responder "¿cuánto cobré?".
 *
 * Cada cobro real vive como IncomeRecord con status 'cobrado' (registrar un pago,
 * cobrar una cuota o cargar un ingreso suelto crean uno). Como red de seguridad,
 * se suman los pagos de proyectos que no tengan su ingreso (datos viejos).
 *
 * Las cuotas y acuerdos solo describen lo ESPERADO (por cobrar / vencido);
 * nunca se usan para sumar lo cobrado, así no se cuenta dos veces.
 */
export interface CollectedEntry {
  id: string;
  title: string;
  clientName?: string;
  amount: number;
  currency: 'ARS' | 'USD';
  date: string;
  projectId?: string;
}

export function getCollectedEntries(
  incomes: IncomeRecord[],
  projects: Project[],
  matches: (dateOrMonth?: string | null) => boolean
): CollectedEntry[] {
  const entries: CollectedEntry[] = [];
  const countedPaymentIds = new Set<string>();
  const incomeIds = new Set(incomes.map(i => i.id));

  incomes.forEach(inc => {
    if (inc.status !== 'cobrado' || !matches(inc.date || inc.month)) return;
    entries.push({
      id: inc.id,
      title: inc.title || inc.concept || 'Cobro registrado',
      clientName: inc.projectName,
      amount: Number(inc.amount) || 0,
      currency: inc.currency === 'USD' ? 'USD' : 'ARS',
      date: inc.date,
      projectId: inc.projectId,
    });
    if (inc.paymentId) countedPaymentIds.add(inc.paymentId);
  });

  // Incluye proyectos archivados: lo cobrado en un mes no desaparece al archivar
  projects.forEach(p => {
    (p.payments || []).forEach(pay => {
      if (!matches(pay.date) || countedPaymentIds.has(pay.id)) return;
      if (pay.incomeRecordId && incomeIds.has(pay.incomeRecordId)) return;
      countedPaymentIds.add(pay.id);
      entries.push({
        id: pay.id,
        title: pay.note || `Pago de ${p.clientName}`,
        clientName: p.clientName,
        amount: Number(pay.amount) || 0,
        currency: pay.currency === 'USD' ? 'USD' : 'ARS',
        date: pay.date,
        projectId: p.id,
      });
    });
  });

  return entries;
}

export function sumByCurrency(entries: { amount: number; currency: 'ARS' | 'USD' }[]): { ARS: number; USD: number } {
  return entries.reduce(
    (acc, e) => {
      acc[e.currency] += e.amount;
      return acc;
    },
    { ARS: 0, USD: 0 }
  );
}

export function monthMatcher(monthKey: string) {
  return (dateOrMonth?: string | null) => Boolean(dateOrMonth && dateOrMonth.slice(0, 7) === monthKey);
}
