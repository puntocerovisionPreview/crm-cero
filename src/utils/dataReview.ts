import { IncomeRecord, Project } from '../types';
import { calculateProjectBilling, getProjectPayments } from './paymentPlans';
import { normalizeClientName } from './clients';

/**
 * Revisión de datos: detecta inconsistencias para que las corrijas vos.
 * No cambia nada por su cuenta.
 */
export interface DataIssue {
  id: string;
  kind: 'cobrado_de_mas' | 'pago_duplicado' | 'ingreso_sin_proyecto';
  projectId?: string;
  title: string;
  detail: string;
}

const money = (n: number, c: string) => `${c === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`;

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
}

export function findDataIssues(projects: Project[], incomes: IncomeRecord[]): DataIssue[] {
  const issues: DataIssue[] = [];

  projects.forEach((p) => {
    const billing = calculateProjectBilling(p, incomes);
    if (billing.montoAcordado > 0 && billing.excedente > 0) {
      issues.push({
        id: `over_${p.id}`,
        kind: 'cobrado_de_mas',
        projectId: p.id,
        title: `${p.clientName}: cobrado de más`,
        detail: `Figuran ${money(billing.totalCobrado, billing.currency)} cobrados sobre ${money(billing.montoAcordado, billing.currency)} acordados. Si un pago está cargado dos veces, borralo desde la ficha; si te pagaron más, actualizá el monto acordado.`,
      });
    }

    const payments = getProjectPayments(p, incomes).filter((x) => Number(x.amount) > 0);
    const seen = new Set<string>();
    payments.forEach((a, i) => {
      payments.slice(i + 1).forEach((b) => {
        if (Number(a.amount) !== Number(b.amount) || a.currency !== b.currency) return;
        if (!a.date || !b.date || daysBetween(a.date, b.date) > 3) return;
        const key = [a.id, b.id].sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        issues.push({
          id: `dup_${key}`,
          kind: 'pago_duplicado',
          projectId: p.id,
          title: `${p.clientName}: posible pago repetido`,
          detail: `Dos pagos de ${money(Number(a.amount), a.currency)} el ${a.date} y el ${b.date}.`,
        });
      });
    });
  });

  // Ingresos cobrados sin proyecto cuyo título menciona a un cliente: conviene vincularlos
  const names = projects
    .filter((p) => p.clientName)
    .map((p) => ({ p, key: normalizeClientName(p.clientName) }))
    .filter((x) => x.key.length >= 4);
  incomes
    .filter((inc) => inc.status === 'cobrado' && !inc.projectId)
    .forEach((inc) => {
      const t = normalizeClientName(inc.title || '');
      const match = names.find((n) => t.includes(n.key));
      if (!match) return;
      issues.push({
        id: `inc_${inc.id}`,
        kind: 'ingreso_sin_proyecto',
        projectId: match.p.id,
        title: `Ingreso suelto que parece de ${match.p.clientName}`,
        detail: `"${inc.title}" (${money(Number(inc.amount) || 0, inc.currency || 'ARS')}, ${inc.date}) no está vinculado al proyecto, así que no suma en su saldo.`,
      });
    });

  return issues;
}
