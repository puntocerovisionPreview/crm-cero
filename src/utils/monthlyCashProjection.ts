import { Project, IncomeRecord, ExpenseRecord, RecurringIncomePlan } from '../types';

export interface CashProjectionItem {
  id: string;
  title: string;
  clientName?: string;
  amount: number;
  currency: 'USD' | 'ARS';
  date?: string;
  status: 'cobrado' | 'pendiente' | 'recurrente' | 'lead';
  projectId?: string;
  isCommitment?: boolean;
}

export interface MonthlyCashProjection {
  monthKey: string; // 'YYYY-MM'
  label: string; // e.g. "Octubre 2026"

  // 1. Cobrado (ingresos confirmados y pagos reales)
  cobradoARS: number;
  cobradoUSD: number;

  // 2. Por cobrar (cuotas/compromisos pendientes que vencen en este mes + ingresos libres pendientes)
  porCobrarARS: number;
  porCobrarUSD: number;

  // 3. Retainers / Abonos recurrentes esperados para este mes (no cobrados aún)
  retainersARS: number;
  retainersUSD: number;

  // 4. Totales confirmados del mes (Cobrado + Por Cobrar + Retainers)
  totalMesARS: number;
  totalMesUSD: number;
  totalMesCombinadoARS: number; // Con USD convertidos a cotización de referencia

  // 5. Gastos operativos del mes (para cálculo de Neto)
  gastosARS: number;
  gastosUSD: number;
  netoARS: number;
  netoUSD: number;

  // 6. Prospectos / Leads (ESTRICTAMENTE SEPARADOS DE LA META Y DEL TOTAL CONFIRMADO)
  leadsPonderadoARS: number;
  leadsPonderadoUSD: number;
  leadsTotalARS: number;
  leadsTotalUSD: number;

  // Desgloses detallados
  itemsCobrados: CashProjectionItem[];
  itemsPorCobrar: CashProjectionItem[];
  itemsRetainers: CashProjectionItem[];
  itemsLeads: {
    id: string;
    clientName: string;
    title: string;
    rawAmount: number;
    weightedAmount: number;
    currency: 'USD' | 'ARS';
    probabilityPercent: number;
    status: string;
  }[];
}

export interface MonthlyProjectionOptions {
  monthKey: string; // 'YYYY-MM' o 'all'
  year?: number;
  incomes: IncomeRecord[];
  projects: Project[];
  expenses?: ExpenseRecord[];
  usdRate?: number;
  leadProbabilities?: Record<string, number>;
  standaloneRetainers?: RecurringIncomePlan[];
}

export const DEFAULT_LEAD_PROBABILITIES: Record<string, number> = {
  'Posible proyecto': 25,
  'Propuesta enviada': 50,
  'En negociación': 70,
};

export const PROJECTION_STORAGE_KEYS = {
  leadProbabilities: 'cero_lead_probabilities',
  includeLeads: 'cero_horizon_include_leads',
  standaloneRetainers: 'cero_standalone_retainers',
};

/**
 * Obtiene las probabilidades configuradas para los prospectos
 */
export function getLeadProbabilities(): Record<string, number> {
  if (typeof window === 'undefined') return { ...DEFAULT_LEAD_PROBABILITIES };
  try {
    const raw = localStorage.getItem(PROJECTION_STORAGE_KEYS.leadProbabilities);
    if (!raw) return { ...DEFAULT_LEAD_PROBABILITIES };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_LEAD_PROBABILITIES, ...parsed };
  } catch {
    return { ...DEFAULT_LEAD_PROBABILITIES };
  }
}

/**
 * Guarda las probabilidades configuradas para los prospectos
 */
export function setLeadProbabilities(map: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROJECTION_STORAGE_KEYS.leadProbabilities, JSON.stringify(map));
  } catch {}
}

/**
 * Obtiene el switch de incluir leads en el horizonte (default: FALSE)
 */
export function getIncludeLeadsSetting(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(PROJECTION_STORAGE_KEYS.includeLeads);
    if (raw === null) return false;
    return raw === 'true';
  } catch {
    return false;
  }
}

/**
 * Guarda el switch de incluir leads en el horizonte
 */
export function setIncludeLeadsSetting(val: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROJECTION_STORAGE_KEYS.includeLeads, String(val));
  } catch {}
}

/**
 * Extrae todos los retainers activos (tanto vinculados a proyectos como independientes)
 */
export function getAllStudioRetainers(projects: Project[], extraStandalone: RecurringIncomePlan[] = []): RecurringIncomePlan[] {
  const list: RecurringIncomePlan[] = [];
  const seenIds = new Set<string>();

  // 1. Retainers en proyectos
  projects.forEach(p => {
    (p.recurringPlans || []).forEach(rp => {
      if (!seenIds.has(rp.id)) {
        seenIds.add(rp.id);
        list.push({
          ...rp,
          projectId: rp.projectId || p.id,
          clientName: rp.clientName || p.clientName,
        });
      }
    });
  });

  // 2. Retainers independientes en localStorage o pasados
  let storedStandalone: RecurringIncomePlan[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(PROJECTION_STORAGE_KEYS.standaloneRetainers);
      if (raw) storedStandalone = JSON.parse(raw);
    } catch {}
  }

  [...storedStandalone, ...extraStandalone].forEach(rp => {
    if (!seenIds.has(rp.id)) {
      seenIds.add(rp.id);
      list.push(rp);
    }
  });

  return list;
}

/**
 * Guarda un retainer independiente en localStorage
 */
export function saveStandaloneRetainer(plan: RecurringIncomePlan): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PROJECTION_STORAGE_KEYS.standaloneRetainers);
    const list: RecurringIncomePlan[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(p => p.id === plan.id);
    if (idx >= 0) {
      list[idx] = plan;
    } else {
      list.push(plan);
    }
    localStorage.setItem(PROJECTION_STORAGE_KEYS.standaloneRetainers, JSON.stringify(list));
  } catch {}
}

/**
 * Elimina un retainer independiente de localStorage
 */
export function deleteStandaloneRetainer(planId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PROJECTION_STORAGE_KEYS.standaloneRetainers);
    if (!raw) return;
    const list: RecurringIncomePlan[] = JSON.parse(raw);
    const updated = list.filter(p => p.id !== planId);
    localStorage.setItem(PROJECTION_STORAGE_KEYS.standaloneRetainers, JSON.stringify(updated));
  } catch {}
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * HELPER ÚNICO COMPARTIDO: Calcula con absoluta precisión los números financieros de cualquier mes
 * Fuente de verdad unificada para IncomeView y HorizonView.
 */
export function calculateMonthlyCashProjection({
  monthKey,
  year,
  incomes,
  projects,
  expenses = [],
  usdRate = 1250,
  leadProbabilities,
  standaloneRetainers = [],
}: MonthlyProjectionOptions): MonthlyCashProjection {
  const isAllYear = monthKey === 'all';
  const targetYear = year || (isAllYear ? new Date().getFullYear() : parseInt(monthKey.slice(0, 4), 10));

  let label = monthKey;
  if (!isAllYear && monthKey.includes('-')) {
    const [y, m] = monthKey.split('-').map(Number);
    if (m >= 1 && m <= 12) {
      label = `${MONTH_NAMES_ES[m - 1]} ${y}`;
    }
  } else if (isAllYear) {
    label = `Año ${targetYear}`;
  }

  const effectiveProbabilities = leadProbabilities || getLeadProbabilities();
  const validRate = usdRate > 0 ? usdRate : 1250;

  const matchesMonth = (dateOrMonth?: string | null): boolean => {
    if (!dateOrMonth) return false;
    const clean = dateOrMonth.slice(0, 7);
    if (isAllYear) {
      return clean.startsWith(String(targetYear));
    }
    return clean === monthKey;
  };

  // -------------------------------------------------------------
  // 1. COBRADO: Incomes con status 'cobrado' + payments reales de proyectos
  // -------------------------------------------------------------
  const itemsCobrados: CashProjectionItem[] = [];
  const countedPaymentIds = new Set<string>();

  // A. Incomes cobrados
  incomes.forEach(inc => {
    if (inc.status === 'cobrado' && matchesMonth(inc.date || inc.month)) {
      itemsCobrados.push({
        id: inc.id,
        title: inc.title || inc.concept || 'Cobro registrado',
        clientName: inc.projectName,
        amount: Number(inc.amount) || 0,
        currency: inc.currency || 'ARS',
        date: inc.date,
        status: 'cobrado',
        projectId: inc.projectId,
      });

      if (inc.paymentId) countedPaymentIds.add(inc.paymentId);
    }
  });

  // B. Payments en proyectos no contemplados en incomes (salvaguarda anti-pérdida)
  projects.forEach(p => {
    (p.payments || []).forEach(pay => {
      if (matchesMonth(pay.date) && !countedPaymentIds.has(pay.id) && (!pay.incomeRecordId || !incomes.some(i => i.id === pay.incomeRecordId))) {
        countedPaymentIds.add(pay.id);
        itemsCobrados.push({
          id: pay.id,
          title: pay.note || `Pago de ${p.clientName}`,
          clientName: p.clientName,
          amount: Number(pay.amount) || 0,
          currency: pay.currency || 'ARS',
          date: pay.date,
          status: 'cobrado',
          projectId: p.id,
        });
      }
    });
  });

  const cobradoARS = itemsCobrados.filter(i => i.currency === 'ARS').reduce((sum, i) => sum + i.amount, 0);
  const cobradoUSD = itemsCobrados.filter(i => i.currency === 'USD').reduce((sum, i) => sum + i.amount, 0);

  // -------------------------------------------------------------
  // 2. POR COBRAR: Cuotas reales pendientes con dueDate en el mes + Incomes pendientes
  // -------------------------------------------------------------
  const itemsPorCobrar: CashProjectionItem[] = [];
  const seenCuotaKeys = new Set<string>();

  // Solo revisamos clientes reales activos (no archivados ni prospectos no cerrados)
  projects.forEach(proj => {
    if (proj.archived) return;
    const isLeadProject = Boolean(
      proj.isLead ||
      proj.status === 'Posible proyecto' ||
      proj.status === 'Propuesta enviada' ||
      proj.status === 'En negociación'
    );
    if (isLeadProject) return;

    // A. Cuotas de billingAgreement
    if (proj.billingAgreement?.installments && proj.billingAgreement.installments.length > 0) {
      proj.billingAgreement.installments.forEach(inst => {
        if (matchesMonth(inst.dueDate)) {
          const expected = Number(inst.expectedAmount || 0);
          const paid = Number(inst.actualPaidAmount || 0);
          const pending = Math.max(0, expected - paid);
          const isPaidStatus = inst.status === 'pagado_a_tiempo' || inst.status === 'pagado_tarde';

          if (pending > 0 && !isPaidStatus) {
            const key = `${proj.id}_${inst.id}_${inst.dueDate}`;
            seenCuotaKeys.add(key);
            itemsPorCobrar.push({
              id: inst.id,
              title: inst.title || `Cuota ${inst.number} (${proj.clientName})`,
              clientName: proj.clientName,
              amount: pending,
              currency: inst.currency || 'ARS',
              date: inst.dueDate,
              status: 'pendiente',
              projectId: proj.id,
              isCommitment: true,
            });
          }
        }
      });
    }

    // B. Compromisos flexibles directos (si no están en billingAgreement)
    if (proj.paymentCommitments && proj.paymentCommitments.length > 0) {
      proj.paymentCommitments.forEach(c => {
        if (matchesMonth(c.dueDate)) {
          const expected = Number(c.amount || 0);
          const paid = Number(c.amountPaid || (c.paid ? expected : 0));
          const pending = Math.max(0, expected - paid);
          const isPaid = c.status === 'cobrado' || c.paid;

          const key = `${proj.id}_${c.id}_${c.dueDate}`;
          if (pending > 0 && !isPaid && !seenCuotaKeys.has(key)) {
            seenCuotaKeys.add(key);
            itemsPorCobrar.push({
              id: c.id,
              title: c.title || `Compromiso (${proj.clientName})`,
              clientName: proj.clientName,
              amount: pending,
              currency: c.currency || proj.estimatedCurrency || 'ARS',
              date: c.dueDate,
              status: 'pendiente',
              projectId: proj.id,
              isCommitment: true,
            });
          }
        }
      });
    }

    // C. Cuotas legacy directas (installments) si no hay billingAgreement
    if ((!proj.billingAgreement?.installments || proj.billingAgreement.installments.length === 0) &&
        (!proj.paymentCommitments || proj.paymentCommitments.length === 0) &&
        proj.installments && proj.installments.length > 0) {
      proj.installments.forEach(inst => {
        if (matchesMonth(inst.dueDate)) {
          const expected = Number(inst.amount || 0);
          const isPaid = inst.paid || inst.status === 'cobrado';
          const key = `${proj.id}_${inst.id}_${inst.dueDate}`;

          if (!isPaid && expected > 0 && !seenCuotaKeys.has(key)) {
            seenCuotaKeys.add(key);
            itemsPorCobrar.push({
              id: inst.id,
              title: inst.note || `Cuota ${inst.number} (${proj.clientName})`,
              clientName: proj.clientName,
              amount: expected,
              currency: inst.currency || proj.estimatedCurrency || 'ARS',
              date: inst.dueDate,
              status: 'pendiente',
              projectId: proj.id,
              isCommitment: true,
            });
          }
        }
      });
    }
  });

  // D. Incomes libres pendientes creados manualmente (sin duplicar compromisos ya contemplados)
  incomes.forEach(inc => {
    if (inc.status === 'pendiente' && matchesMonth(inc.date || inc.month)) {
      const isAlreadyIncludedInCommitments = itemsPorCobrar.some(c => 
        (inc.commitmentId && c.id === inc.commitmentId) ||
        (inc.projectId && c.projectId === inc.projectId && Math.abs(c.amount - Number(inc.amount)) < 0.01)
      );

      if (!isAlreadyIncludedInCommitments) {
        itemsPorCobrar.push({
          id: inc.id,
          title: inc.title || inc.concept || 'Ingreso pendiente',
          clientName: inc.projectName,
          amount: Number(inc.amount) || 0,
          currency: inc.currency || 'ARS',
          date: inc.date,
          status: 'pendiente',
          projectId: inc.projectId,
          isCommitment: false,
        });
      }
    }
  });

  const porCobrarARS = itemsPorCobrar.filter(i => i.currency === 'ARS').reduce((sum, i) => sum + i.amount, 0);
  const porCobrarUSD = itemsPorCobrar.filter(i => i.currency === 'USD').reduce((sum, i) => sum + i.amount, 0);

  // -------------------------------------------------------------
  // 3. RETAINERS / ABONOS RECURRENTES: Planes activos del mes que no fueron cobrados aún
  // -------------------------------------------------------------
  const itemsRetainers: CashProjectionItem[] = [];
  const allRetainers = getAllStudioRetainers(projects, standaloneRetainers);

  allRetainers.forEach(plan => {
    if (!plan.active) return;
    const planStartMonth = plan.startDate ? plan.startDate.slice(0, 7) : '';

    if (!isAllYear && planStartMonth && planStartMonth > monthKey) {
      // El plan empieza en un mes futuro
      return;
    }

    // Verificar si ya fue registrado como cobrado o como cuota por cobrar en este mes
    const alreadyCollected = itemsCobrados.some(c => 
      c.title.toLowerCase().includes(plan.title.toLowerCase()) ||
      (plan.projectId && c.projectId === plan.projectId && Math.abs(c.amount - plan.amount) < 0.01)
    );

    const alreadyInPorCobrar = itemsPorCobrar.some(p =>
      p.title.toLowerCase().includes(plan.title.toLowerCase()) ||
      (plan.projectId && p.projectId === plan.projectId && Math.abs(p.amount - plan.amount) < 0.01)
    );

    if (!alreadyCollected && !alreadyInPorCobrar) {
      itemsRetainers.push({
        id: plan.id,
        title: plan.title,
        clientName: plan.clientName,
        amount: Number(plan.amount) || 0,
        currency: plan.currency || 'ARS',
        date: plan.nextDueDate || plan.startDate,
        status: 'recurrente',
        projectId: plan.projectId,
      });
    }
  });

  const retainersARS = itemsRetainers.filter(i => i.currency === 'ARS').reduce((sum, i) => sum + i.amount, 0);
  const retainersUSD = itemsRetainers.filter(i => i.currency === 'USD').reduce((sum, i) => sum + i.amount, 0);

  // -------------------------------------------------------------
  // 4. TOTALES DEL MES (Cobrado + Por Cobrar + Retainers)
  // -------------------------------------------------------------
  const totalMesARS = cobradoARS + porCobrarARS + retainersARS;
  const totalMesUSD = cobradoUSD + porCobrarUSD + retainersUSD;
  const totalMesCombinadoARS = totalMesARS + (totalMesUSD * validRate);

  // -------------------------------------------------------------
  // 5. GASTOS Y NETO
  // -------------------------------------------------------------
  const monthExpenses = expenses.filter(e => e.status === 'pagado' && matchesMonth(e.date || e.month));
  const gastosARS = monthExpenses.filter(e => e.currency === 'ARS').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const gastosUSD = monthExpenses.filter(e => e.currency === 'USD').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netoARS = cobradoARS - gastosARS;
  const netoUSD = cobradoUSD - gastosUSD;

  // -------------------------------------------------------------
  // 6. PROSPECTOS / LEADS (Separados rigurosamente)
  // -------------------------------------------------------------
  const itemsLeads: MonthlyCashProjection['itemsLeads'] = [];
  let leadsPonderadoARS = 0;
  let leadsPonderadoUSD = 0;
  let leadsTotalARS = 0;
  let leadsTotalUSD = 0;

  projects.forEach(p => {
    if (p.archived) return;
    const isLead = Boolean(
      p.isLead ||
      p.status === 'Posible proyecto' ||
      p.status === 'Propuesta enviada' ||
      p.status === 'En negociación'
    );

    if (isLead) {
      const rawAmt = Number(p.estimatedPrice || p.montoAcordado || 0);
      const curr = (p.estimatedCurrency || 'ARS') as 'USD' | 'ARS';
      const prob = effectiveProbabilities[p.status] !== undefined ? effectiveProbabilities[p.status] : 25;
      const weighted = Math.round(rawAmt * (prob / 100));

      itemsLeads.push({
        id: p.id,
        clientName: p.clientName,
        title: `Prospecto: ${p.clientName} (${p.status})`,
        rawAmount: rawAmt,
        weightedAmount: weighted,
        currency: curr,
        probabilityPercent: prob,
        status: p.status,
      });

      if (curr === 'ARS') {
        leadsTotalARS += rawAmt;
        leadsPonderadoARS += weighted;
      } else {
        leadsTotalUSD += rawAmt;
        leadsPonderadoUSD += weighted;
      }
    }
  });

  return {
    monthKey,
    label,
    cobradoARS,
    cobradoUSD,
    porCobrarARS,
    porCobrarUSD,
    retainersARS,
    retainersUSD,
    totalMesARS,
    totalMesUSD,
    totalMesCombinadoARS,
    gastosARS,
    gastosUSD,
    netoARS,
    netoUSD,
    leadsPonderadoARS,
    leadsPonderadoUSD,
    leadsTotalARS,
    leadsTotalUSD,
    itemsCobrados,
    itemsPorCobrar,
    itemsRetainers,
    itemsLeads,
  };
}
