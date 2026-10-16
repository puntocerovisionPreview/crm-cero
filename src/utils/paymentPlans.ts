import { 
  Project, 
  ProjectInstallment, 
  IncomeRecord,
  Payment,
  PaymentMethod,
  StudioPaymentSettings,
  FlexiblePaymentCommitment,
  PaymentCommitmentStatus,
  RecurringIncomePlan,
  RecurringFrequency,
  BillingAgreement,
  BillingAgreementType,
  BillingInstallment,
  CuotaStatus
} from '../types';
import { getTodayString, getMonthKey, MONTH_NAMES } from './storage';

export type InstallmentFrequency = 'monthly' | 'monthly_same_day' | 'biweekly' | 'custom';

export interface CalculatedInstallment {
  id: string;
  number: number;
  totalInstallments: number;
  dueDate: string; // YYYY-MM-DD
  amount: number;
  currency: 'USD' | 'ARS';
  paid: boolean;
  paidAt?: string;
  note?: string;
}

/**
 * Calculates a date offset by months while respecting day of the month
 */
export function addMonthsToDate(dateStr: string, monthsToAdd: number): string {
  if (!dateStr) return getTodayString();
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const targetDate = new Date(year, month - 1 + monthsToAdd, 1);
  const lastDayOfTargetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
  const adjustedDay = Math.min(day, lastDayOfTargetMonth);

  const finalYear = targetDate.getFullYear();
  const finalMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
  const finalDay = String(adjustedDay).padStart(2, '0');

  return `${finalYear}-${finalMonth}-${finalDay}`;
}

/**
 * Adds exact days to a YYYY-MM-DD string
 */
export function addDaysToDate(dateStr: string, daysToAdd: number): string {
  if (!dateStr) return getTodayString();
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const d = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));
  d.setDate(d.getDate() + daysToAdd);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Generates a clean, evenly distributed list of installments based on count, total, start date, and frequency.
 * Strict Financial Rule: The total is immutable.
 * The difference due to integer residue is assigned to the LAST installment:
 *   cuotaBase = Math.floor(total / cantidad)
 *   residuo = total - (cuotaBase * cantidad)
 *   cuota[i].monto = (i === cantidad - 1) ? cuotaBase + residuo : cuotaBase
 * Sum of installments is always 100% mathematically equal to totalAmount.
 */
export function generateInstallmentSchedule(options: {
  totalAmount: number;
  currency: 'USD' | 'ARS';
  installmentsCount: number;
  startDate?: string;
  frequency?: 'monthly' | 'biweekly' | 'custom';
  customInstallmentAmount?: number;
}): CalculatedInstallment[] {
  const {
    totalAmount,
    currency,
    installmentsCount,
    startDate = getTodayString(),
    frequency = 'monthly',
    customInstallmentAmount,
  } = options;

  const count = Math.max(1, Math.round(installmentsCount || 1));
  const total = Math.max(0, Math.round(totalAmount || 0));

  let cuotaBase = 0;
  let residuo = 0;

  if (customInstallmentAmount && customInstallmentAmount > 0) {
    cuotaBase = Math.round(customInstallmentAmount);
    residuo = 0;
  } else {
    cuotaBase = Math.floor(total / count);
    residuo = total - (cuotaBase * count);
  }

  const result: CalculatedInstallment[] = [];

  for (let i = 0; i < count; i++) {
    let dueDate = startDate;
    if (i > 0) {
      if (frequency === 'biweekly') {
        dueDate = addDaysToDate(startDate, i * 14);
      } else {
        // Standard monthly frequency (same day of following months)
        dueDate = addMonthsToDate(startDate, i);
      }
    }

    // Assign residue to the last installment if automatic
    const amount = (i === count - 1 && !customInstallmentAmount)
      ? cuotaBase + residuo
      : cuotaBase;

    result.push({
      id: `inst_${Date.now()}_${i + 1}_${Math.random().toString(36).substring(2, 6)}`,
      number: i + 1,
      totalInstallments: count,
      dueDate,
      amount,
      currency,
      paid: false,
    });
  }

  return result;
}

export type PaymentUrgencyStatus = 'paid' | 'overdue' | 'due_today' | 'due_soon' | 'upcoming';

/**
 * Calculates payment status and days remaining for an installment
 */
export function getPaymentUrgency(dueDate: string, paid: boolean): {
  status: PaymentUrgencyStatus;
  daysDiff: number; // positive = days until due, negative = days overdue
  label: string;
  badgeClass: string;
} {
  if (paid) {
    return {
      status: 'paid',
      daysDiff: 0,
      label: 'Cobrado',
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    };
  }

  const todayStr = getTodayString();
  const [tY, tM, tD] = todayStr.split('-').map(Number);
  const [dY, dM, dD] = dueDate.split('-').map(Number);

  const todayDate = new Date(tY, tM - 1, tD).getTime();
  const targetDate = new Date(dY, dM - 1, dD).getTime();
  const diffDays = Math.round((targetDate - todayDate) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      status: 'overdue',
      daysDiff: diffDays,
      label: `Atrasado ${overdueDays}d`,
      badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse',
    };
  }

  if (diffDays === 0) {
    return {
      status: 'due_today',
      daysDiff: 0,
      label: 'Vence hoy',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold',
    };
  }

  if (diffDays <= 7) {
    return {
      status: 'due_soon',
      daysDiff: diffDays,
      label: `Vence en ${diffDays}d`,
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    };
  }

  return {
    status: 'upcoming',
    daysDiff: diffDays,
    label: `Vence en ${diffDays}d`,
    badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  };
}

/**
 * Resolves the effective currency for a project or installment, preventing
 * erroneous USD formatting for high ARS amounts.
 */
export function resolveProjectCurrency(currency?: string, amount?: number, projectType?: string): 'USD' | 'ARS' {
  if (currency === 'USD') return 'USD';
  if (currency === 'ARS') return 'ARS';
  if (projectType === 'web') return 'USD';
  if (amount !== undefined && amount > 0 && amount <= 10000) return 'USD';
  if (amount !== undefined && amount > 10000) return 'ARS';
  return 'USD';
}

/**
 * Formats a project price cleanly with currency badge
 */
export function formatProjectPrice(price?: number, currency?: string): string {
  if (!price || price <= 0) return 'Sin cotizar';
  const effectiveCur = resolveProjectCurrency(currency, price);
  const formatted = Math.round(price).toLocaleString('es-AR');
  return effectiveCur === 'USD' ? `US$ ${formatted}` : `$ ${formatted} ARS`;
}

/**
 * Formats a number nicely according to currency:
 * ARS -> "$ 1.100.000 ARS" or "$ 366.666"
 * USD -> "US$ 1.100" or "US$ 366"
 */
export function formatCurrencyAmount(amount: number, currency?: string, showCurrencySuffix: boolean = false): string {
  const effectiveCur = resolveProjectCurrency(currency, amount);
  const formatted = Math.round(amount).toLocaleString('es-AR');
  if (effectiveCur === 'USD') {
    return `US$ ${formatted}`;
  }
  return showCurrencySuffix ? `$ ${formatted} ARS` : `$ ${formatted}`;
}

/**
 * Generates the standard 50% / 50% commercial plan for Web / Landing Page projects:
 * - 50% Anticipo / Seña al inicio
 * - 50% Saldo contra entrega al finalizar (calculado con residuo exacto al último pago)
 */
export function generateWeb5050InstallmentSchedule(params: {
  totalAmount: number;
  currency?: 'USD' | 'ARS';
  startDate?: string;
  deliveryDate?: string;
}): ProjectInstallment[] {
  const { totalAmount, currency = 'ARS', startDate, deliveryDate } = params;
  const start = startDate || getTodayString();
  const delivery = deliveryDate || addMonthsToDate(start, 1);
  const effectiveCur = resolveProjectCurrency(currency, totalAmount);

  const upfront = Math.floor(totalAmount / 2);
  const finalBal = totalAmount - upfront;

  return [
    {
      id: `web_inst_${Date.now()}_1`,
      number: 1,
      totalInstallments: 2,
      dueDate: start,
      amount: upfront,
      currency: effectiveCur,
      status: 'pendiente',
      paid: false,
      note: '50% Anticipo / Seña al inicio',
    },
    {
      id: `web_inst_${Date.now()}_2`,
      number: 2,
      totalInstallments: 2,
      dueDate: delivery,
      amount: finalBal,
      currency: effectiveCur,
      status: 'pendiente',
      paid: false,
      note: '50% Saldo contra entrega al finalizar',
    },
  ];
}

/**
 * Formats a WhatsApp friendly reminder message with studio client and installment details
 * Follows the official .Cero template:
 * "Hola [Nombre], te escribo de .Cero para recordarte el vencimiento de la Cuota [N°] de [Total] correspondiente al Programa PAF por un total de [$ Monto Moneda] con fecha límite el [Fecha]. ¡Avisame cuando realices la transferencia para registrar el comprobante!"
 */
export function buildInstallmentWhatsAppMessage(params: {
  clientName: string;
  projectTitle?: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  currency: 'USD' | 'ARS';
  dueDate: string;
  isOverdue?: boolean;
}): string {
  const {
    clientName,
    projectTitle,
    installmentNumber,
    totalInstallments,
    amount,
    currency,
    dueDate,
  } = params;

  const formattedAmount = formatCurrencyAmount(amount, currency, true);
  let formattedDate = dueDate;
  if (dueDate && dueDate.includes('-')) {
    const [y, m, d] = dueDate.split('-');
    formattedDate = `${d}/${m}/${y}`;
  }

  const programName = projectTitle || 'Programa PAF';

  return `Hola ${clientName}, te escribo de .Cero para recordarte el vencimiento de la Cuota ${installmentNumber} de ${totalInstallments} correspondiente al ${programName} por un total de ${formattedAmount} con fecha límite el ${formattedDate}. ¡Avisame cuando realices la transferencia para registrar el comprobante!`;
}

/**
 * Extracts and unifies installments from a project (both new `installments` array and legacy `pafInstallmentDates`)
 */
export function getProjectInstallments(project: Project): ProjectInstallment[] {
  const projectCur = resolveProjectCurrency(project.estimatedCurrency, project.estimatedPrice);

  if (project.installments && project.installments.length > 0) {
    return project.installments.map(i => ({
      ...i,
      currency: resolveProjectCurrency(i.currency, i.amount),
    }));
  }

  if (project.pafInstallmentDates && project.pafInstallmentDates.length > 0) {
    return project.pafInstallmentDates.map((item, idx) => ({
      id: `paf_legacy_${project.id}_${idx}`,
      number: item.number,
      dueDate: item.dueDate,
      amount: item.amount,
      currency: resolveProjectCurrency(project.estimatedCurrency, item.amount),
      paid: item.paid,
      paidAt: item.paidAt,
      note: item.note,
    }));
  }

  return [];
}

/**
 * Finds the next pending installment for a project, or null if all are paid or none exist
 */
export function getNextPendingInstallment(project: Project): ProjectInstallment | null {
  const installments = getProjectInstallments(project);
  if (installments.length === 0) return null;

  const pending = installments.filter(i => !i.paid);
  if (pending.length === 0) return null;

  // Sort by due date ascending
  pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return pending[0];
}

export interface MonthlyProjectedRevenue {
  monthKey: string; // YYYY-MM
  monthName: string; // ej. Octubre 2026
  year: number;
  monthNumber: string; // 01 - 12
  isCurrentMonth: boolean;
  totalUSD: number;
  paidUSD: number;
  pendingUSD: number;
  totalARS: number;
  paidARS: number;
  pendingARS: number;
  pafUSD: number;
  pafARS: number;
  pafCount: number;
  webUSD: number;
  webARS: number;
  webCount: number;
  otherUSD: number;
  otherARS: number;
  otherCount: number;
  explanation: string;
  items: {
    projectId: string;
    clientName: string;
    projectType?: string;
    projectStatus: string;
    clientPhone?: string;
    installmentNumber?: number;
    totalInstallments?: number;
    amount: number;
    currency: 'USD' | 'ARS';
    dueDate: string;
    paid: boolean;
    paidAt?: string;
    concept: string;
    serviceCategory: 'paf' | 'web' | 'otro';
    incomeRecordId?: string;
  }[];
}

/**
 * Computes projected monthly cash flow across all active projects and clients
 */
export function calculateActiveClientsMonthlyProjection(
  projects: Project[],
  incomes: IncomeRecord[],
  targetYear?: number
): {
  activeClientsCount: number;
  activePayingClientsCount: number;
  monthlyProjections: MonthlyProjectedRevenue[];
  currentMonthProjectedUSD: number;
  currentMonthProjectedARS: number;
  nextMonthProjectedUSD: number;
  nextMonthProjectedARS: number;
  allUpcomingPendingItems: MonthlyProjectedRevenue['items'];
} {
  const today = getTodayString();
  const currentYear = targetYear || Number(today.slice(0, 4));
  const currentMonthNum = today.slice(5, 7);
  const currentMonthKey = `${currentYear}-${currentMonthNum}`;

  const activeProjects = projects.filter(p => !p.archived && p.status !== 'No concretado');
  const activeClientsCount = activeProjects.length;

  // Month map for the 12 months of the given year + next year's first 3 months (for rolling 15 months)
  const monthKeys: string[] = [];
  for (let m = 1; m <= 12; m++) {
    monthKeys.push(`${currentYear}-${String(m).padStart(2, '0')}`);
  }
  // Add first 3 months of next year
  for (let m = 1; m <= 3; m++) {
    monthKeys.push(`${currentYear + 1}-${String(m).padStart(2, '0')}`);
  }

  const map: Record<string, MonthlyProjectedRevenue> = {};
  monthKeys.forEach(mKey => {
    const [yStr, mStr] = mKey.split('-');
    const mIndex = parseInt(mStr, 10) - 1;
    map[mKey] = {
      monthKey: mKey,
      monthName: `${MONTH_NAMES[mIndex]} ${yStr}`,
      year: parseInt(yStr, 10),
      monthNumber: mStr,
      isCurrentMonth: mKey === currentMonthKey,
      totalUSD: 0,
      paidUSD: 0,
      pendingUSD: 0,
      totalARS: 0,
      paidARS: 0,
      pendingARS: 0,
      pafUSD: 0,
      pafARS: 0,
      pafCount: 0,
      webUSD: 0,
      webARS: 0,
      webCount: 0,
      otherUSD: 0,
      otherARS: 0,
      otherCount: 0,
      explanation: '',
      items: [],
    };
  });

  const payingProjectIds = new Set<string>();

  // Helper to categorize service
  const getServiceCategory = (pType?: string): 'paf' | 'web' | 'otro' => {
    if (!pType) return 'otro';
    if (pType.startsWith('paf')) return 'paf';
    if (pType === 'web') return 'web';
    return 'otro';
  };

  // 1. Process Installments from Active Projects
  activeProjects.forEach(project => {
    const installments = getProjectInstallments(project);
    const totalInst = installments.length;

    if (totalInst > 0) {
      payingProjectIds.add(project.id);
      const serviceCat = getServiceCategory(project.projectType);

      installments.forEach(inst => {
        const mKey = getMonthKey(inst.dueDate);
        const currency = resolveProjectCurrency(inst.currency || project.estimatedCurrency, inst.amount);
        const targetObj = map[mKey];

        // Format concept clearly
        let concept = inst.note;
        if (!concept) {
          if (serviceCat === 'web') {
            concept = inst.number === 1 ? '50% Anticipo / Seña inicial' : inst.number === 2 && totalInst === 2 ? '50% Saldo final contra entrega' : `Cuota ${inst.number}/${totalInst}`;
          } else if (project.projectType === 'paf_pro') {
            concept = `Cuota ${inst.number}/${totalInst} - PAF Pro (12s)`;
          } else if (project.projectType === 'paf_base') {
            concept = `Cuota ${inst.number}/${totalInst} - PAF Base`;
          } else {
            concept = `Cuota ${inst.number}/${totalInst}`;
          }
        }

        const item: MonthlyProjectedRevenue['items'][0] = {
          projectId: project.id,
          clientName: project.clientName,
          projectType: project.projectType,
          projectStatus: project.status,
          clientPhone: project.clientPhone,
          installmentNumber: inst.number,
          totalInstallments: totalInst,
          amount: inst.amount,
          currency,
          dueDate: inst.dueDate,
          paid: inst.paid,
          paidAt: inst.paidAt,
          concept,
          serviceCategory: serviceCat,
          incomeRecordId: inst.incomeRecordId,
        };

        if (targetObj) {
          targetObj.items.push(item);
          if (currency === 'USD') {
            targetObj.totalUSD += inst.amount;
            if (inst.paid) targetObj.paidUSD += inst.amount;
            else targetObj.pendingUSD += inst.amount;

            if (serviceCat === 'paf') targetObj.pafUSD += inst.amount;
            else if (serviceCat === 'web') targetObj.webUSD += inst.amount;
            else targetObj.otherUSD += inst.amount;
          } else {
            targetObj.totalARS += inst.amount;
            if (inst.paid) targetObj.paidARS += inst.amount;
            else targetObj.pendingARS += inst.amount;

            if (serviceCat === 'paf') targetObj.pafARS += inst.amount;
            else if (serviceCat === 'web') targetObj.webARS += inst.amount;
            else targetObj.otherARS += inst.amount;
          }

          if (serviceCat === 'paf') targetObj.pafCount += 1;
          else if (serviceCat === 'web') targetObj.webCount += 1;
          else targetObj.otherCount += 1;
        }
      });
    }
  });

  // 2. Also process any direct IncomeRecords that might not be in the project installments
  incomes.forEach(inc => {
    const incMonthKey = inc.month || getMonthKey(inc.date);
    const targetObj = map[incMonthKey];
    if (!targetObj) return;

    // Check if this income is already represented by an installment
    const alreadyListed = targetObj.items.some(
      it => it.incomeRecordId === inc.id || (it.projectId === inc.projectId && Math.abs(it.amount - inc.amount) < 0.01 && it.dueDate === inc.date)
    );

    if (!alreadyListed) {
      const linkedProj = projects.find(p => p.id === inc.projectId);
      const isPaid = inc.status === 'cobrado';
      const serviceCat = getServiceCategory(linkedProj?.projectType);
      const currency = resolveProjectCurrency(inc.currency, inc.amount);

      const item: MonthlyProjectedRevenue['items'][0] = {
        projectId: inc.projectId || '',
        clientName: inc.projectName || linkedProj?.clientName || inc.title,
        projectType: linkedProj?.projectType,
        projectStatus: linkedProj?.status || 'En curso',
        clientPhone: linkedProj?.clientPhone,
        amount: inc.amount,
        currency,
        dueDate: inc.date,
        paid: isPaid,
        concept: inc.title,
        serviceCategory: serviceCat,
        incomeRecordId: inc.id,
      };

      targetObj.items.push(item);
      if (inc.projectId) payingProjectIds.add(inc.projectId);

      if (currency === 'USD') {
        targetObj.totalUSD += inc.amount;
        if (isPaid) targetObj.paidUSD += inc.amount;
        else targetObj.pendingUSD += inc.amount;

        if (serviceCat === 'paf') targetObj.pafUSD += inc.amount;
        else if (serviceCat === 'web') targetObj.webUSD += inc.amount;
        else targetObj.otherUSD += inc.amount;
      } else {
        targetObj.totalARS += inc.amount;
        if (isPaid) targetObj.paidARS += inc.amount;
        else targetObj.pendingARS += inc.amount;

        if (serviceCat === 'paf') targetObj.pafARS += inc.amount;
        else if (serviceCat === 'web') targetObj.webARS += inc.amount;
        else targetObj.otherARS += inc.amount;
      }

      if (serviceCat === 'paf') targetObj.pafCount += 1;
      else if (serviceCat === 'web') targetObj.webCount += 1;
      else targetObj.otherCount += 1;
    }
  });

  // 3. Generate human readable explanation for each month
  monthKeys.forEach(mKey => {
    const obj = map[mKey];
    const parts: string[] = [];

    if (obj.pafCount > 0) {
      const pafAmounts: string[] = [];
      if (obj.pafARS > 0) pafAmounts.push(`$ ${obj.pafARS.toLocaleString('es-AR')} ARS`);
      if (obj.pafUSD > 0) pafAmounts.push(`US$ ${obj.pafUSD.toLocaleString('es-AR')}`);
      parts.push(`${obj.pafCount} ${obj.pafCount === 1 ? 'cuota' : 'cuotas'} del Método PAF (${pafAmounts.join(' + ')})`);
    }

    if (obj.webCount > 0) {
      const webAmounts: string[] = [];
      if (obj.webARS > 0) webAmounts.push(`$ ${obj.webARS.toLocaleString('es-AR')} ARS`);
      if (obj.webUSD > 0) webAmounts.push(`US$ ${obj.webUSD.toLocaleString('es-AR')}`);
      parts.push(`${obj.webCount} ${obj.webCount === 1 ? 'cobro Web (seña/entrega)' : 'cobros Web'} (${webAmounts.join(' + ')})`);
    }

    if (obj.otherCount > 0) {
      const otherAmounts: string[] = [];
      if (obj.otherARS > 0) otherAmounts.push(`$ ${obj.otherARS.toLocaleString('es-AR')} ARS`);
      if (obj.otherUSD > 0) otherAmounts.push(`US$ ${obj.otherUSD.toLocaleString('es-AR')}`);
      parts.push(`${obj.otherCount} otros movimientos (${otherAmounts.join(' + ')})`);
    }

    if (parts.length > 0) {
      obj.explanation = `Composición: ${parts.join(' y ')}. Total de ${obj.items.length} ${obj.items.length === 1 ? 'cobro programado' : 'cobros programados'}.`;
    } else {
      obj.explanation = 'Sin cobros programados para este mes.';
    }
  });

  const projectionsList = monthKeys.map(k => map[k]);

  // Current month & next month numbers
  const currentMonthData = map[currentMonthKey];
  const nextMonthNum = String(Number(currentMonthNum) === 12 ? 1 : Number(currentMonthNum) + 1).padStart(2, '0');
  const nextMonthYear = Number(currentMonthNum) === 12 ? currentYear + 1 : currentYear;
  const nextMonthKey = `${nextMonthYear}-${nextMonthNum}`;
  const nextMonthData = map[nextMonthKey];

  // Extract all pending upcoming items sorted by due date
  const allUpcomingPendingItems: MonthlyProjectedRevenue['items'] = [];
  projectionsList.forEach(m => {
    m.items.forEach(it => {
      if (!it.paid) {
        allUpcomingPendingItems.push(it);
      }
    });
  });
  allUpcomingPendingItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    activeClientsCount,
    activePayingClientsCount: payingProjectIds.size,
    monthlyProjections: projectionsList,
    currentMonthProjectedUSD: currentMonthData ? currentMonthData.totalUSD : 0,
    currentMonthProjectedARS: currentMonthData ? currentMonthData.totalARS : 0,
    nextMonthProjectedUSD: nextMonthData ? nextMonthData.totalUSD : 0,
    nextMonthProjectedARS: nextMonthData ? nextMonthData.totalARS : 0,
    allUpcomingPendingItems,
  };
}

/**
 * Migrates legacy ProjectInstallment array to FlexiblePaymentCommitment array without loss
 */
export function migrateInstallmentsToCommitments(
  installments?: ProjectInstallment[],
  project?: { id?: string; clientName?: string }
): FlexiblePaymentCommitment[] {
  if (!installments || installments.length === 0) return [];
  const today = getTodayString();

  return installments.map((inst, i) => {
    let status: PaymentCommitmentStatus = 'pendiente';
    if (inst.paid || inst.status === 'cobrado') {
      status = 'cobrado';
    } else if (inst.status === 'atrasado' || (inst.dueDate && inst.dueDate < today)) {
      status = 'atrasado';
    }

    return {
      id: inst.id || `cmt_${Date.now()}_${i + 1}`,
      title: inst.note || `Cuota ${inst.number || i + 1}${inst.totalInstallments ? ` de ${inst.totalInstallments}` : ''}`,
      dueDate: inst.dueDate || today,
      amount: Number(inst.amount) || 0,
      amountPaid: inst.paid ? Number(inst.amount) || 0 : 0,
      currency: inst.currency || 'USD',
      status,
      paid: inst.paid,
      paidAt: inst.paidAt,
      notes: inst.note,
      incomeRecordId: inst.incomeRecordId,
      projectId: project?.id,
      clientName: project?.clientName,
    };
  });
}

/**
 * Calculates automatic status for a payment commitment
 */
export function calculateCommitmentStatus(commitment: {
  dueDate: string;
  amount: number;
  amountPaid?: number;
  paid?: boolean;
}): PaymentCommitmentStatus {
  const today = getTodayString();
  const amt = Number(commitment.amount) || 0;
  const paidAmt = Number(commitment.amountPaid) || 0;

  if (commitment.paid || (amt > 0 && paidAmt >= amt)) {
    return 'cobrado';
  }
  if (paidAmt > 0 && paidAmt < amt) {
    return 'parcial';
  }
  if (commitment.dueDate && commitment.dueDate < today) {
    return 'atrasado';
  }
  return 'pendiente';
}

/**
 * Financial summary for a project: Monto acordado, Cobrado real, Saldo pendiente
 */
export function calculateProjectFinancials(
  project: Project,
  incomes: IncomeRecord[]
): {
  montoAcordado: number;
  currency: 'USD' | 'ARS';
  totalCobrado: number;
  saldoPendiente: number;
  porcentajeCobrado: number;
  commitments: FlexiblePaymentCommitment[];
  cobradoDirectoIncomes: IncomeRecord[];
} {
  const montoAcordado = Number(project.montoAcordado ?? project.estimatedPrice ?? 0);
  const currency = project.estimatedCurrency || 'USD';

  // Find all incomes linked to this project
  const linkedIncomes = incomes.filter(inc => {
    if (inc.projectId && inc.projectId === project.id) return true;
    if (inc.projectName && inc.projectName.toLowerCase() === project.clientName.toLowerCase()) return true;
    if (inc.title && inc.title.toLowerCase().includes(project.clientName.toLowerCase())) return true;
    return false;
  });

  const totalCobrado = linkedIncomes
    .filter(i => i.status === 'cobrado')
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const saldoPendiente = Math.max(0, montoAcordado - totalCobrado);
  const porcentajeCobrado = montoAcordado > 0 
    ? Math.min(100, Math.round((totalCobrado / montoAcordado) * 100))
    : (totalCobrado > 0 ? 100 : 0);

  // Commitments (flexible or migrated from legacy installments)
  let commitments = project.paymentCommitments;
  if (!commitments || commitments.length === 0) {
    commitments = migrateInstallmentsToCommitments(project.installments, project);
  }

  // Auto-refresh statuses
  const refreshedCommitments = commitments.map(c => ({
    ...c,
    status: calculateCommitmentStatus(c),
  }));

  return {
    montoAcordado,
    currency,
    totalCobrado,
    saldoPendiente,
    porcentajeCobrado,
    commitments: refreshedCommitments,
    cobradoDirectoIncomes: linkedIncomes,
  };
}

/**
 * Extracts real and effective payments for a project.
 * Seamless migration:
 * 1. Uses project.payments if populated.
 * 2. Fallback: extracts from project.installments marked paid.
 * 3. Fallback: extracts from linked IncomeRecords with status 'cobrado'.
 * Guarantees zero data loss for existing clients.
 */
export function getProjectPayments(project: Project, incomes: IncomeRecord[] = []): Payment[] {
  if (Array.isArray(project.payments)) {
    return [...project.payments].sort((a, b) => b.date.localeCompare(a.date));
  }

  const list: Payment[] = [];

  // Migration from installments
  if (project.installments && project.installments.length > 0) {
    project.installments.forEach((inst, idx) => {
      if (inst.paid || inst.status === 'cobrado') {
        const amt = Number(inst.amount) || 0;
        const cur = resolveProjectCurrency(inst.currency || project.estimatedCurrency, amt);
        list.push({
          id: inst.id || `mig_inst_${project.id}_${idx + 1}`,
          projectId: project.id,
          amount: amt,
          currency: cur,
          date: inst.paidAt || inst.dueDate || getTodayString(),
          method: 'transferencia',
          note: inst.note || `Cuota ${inst.number}${inst.totalInstallments ? ` de ${inst.totalInstallments}` : ''}`,
          incomeRecordId: inst.incomeRecordId,
          createdAt: inst.paidAt || inst.dueDate || getTodayString(),
        });
      }
    });
  }

  // Migration from linked IncomeRecords
  if (list.length === 0 && incomes && incomes.length > 0) {
    const linkedIncomes = incomes.filter(inc => {
      if (inc.projectId && inc.projectId === project.id) return true;
      if (inc.projectName && inc.projectName.toLowerCase() === project.clientName.toLowerCase()) return true;
      if (inc.title && inc.title.toLowerCase().includes(project.clientName.toLowerCase())) return true;
      return false;
    });

    linkedIncomes.forEach((inc) => {
      if (inc.status === 'cobrado') {
        const amt = Number(inc.amount) || 0;
        const cur = resolveProjectCurrency(inc.currency, amt);
        list.push({
          id: `mig_inc_${inc.id}`,
          projectId: project.id,
          amount: amt,
          currency: cur,
          date: inc.date || getTodayString(),
          method: 'transferencia',
          note: inc.title,
          incomeRecordId: inc.id,
          createdAt: inc.createdAt || inc.date || getTodayString(),
        });
      }
    });
  }

  return list.sort((a, b) => b.date.localeCompare(a.date));
}

export interface ProjectBillingSummary {
  montoAcordado: number;
  currency: 'USD' | 'ARS';
  payments: Payment[];
  totalCobrado: number;
  saldoPendiente: number;
  porcentajeCobrado: number;
  excedente: number;
  estado: 'sin_cobrar' | 'parcial' | 'cobrado_completo' | 'excedente';
  isOverdue: boolean;
  overdueCommitment?: FlexiblePaymentCommitment;
  nextCommitment?: FlexiblePaymentCommitment;
  commitments: FlexiblePaymentCommitment[];
  allCommitmentsFulfilled: boolean;
}

/**
 * Calculates complete billing metrics for a project based on REAL payments.
 * Monto acordado is the reference, payments are the ground truth.
 */
export function calculateProjectBilling(
  project: Project,
  incomes: IncomeRecord[] = []
): ProjectBillingSummary {
  const montoAcordado = Number(project.montoAcordado ?? project.estimatedPrice ?? 0);
  const currency = resolveProjectCurrency(project.estimatedCurrency, montoAcordado, project.projectType);
  const payments = getProjectPayments(project, incomes);

  const totalCobrado = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const saldoPendiente = Math.max(0, montoAcordado - totalCobrado);
  const excedente = Math.max(0, totalCobrado - montoAcordado);

  const porcentajeCobrado = montoAcordado > 0 
    ? Math.round((totalCobrado / montoAcordado) * 100)
    : (totalCobrado > 0 ? 100 : 0);

  let estado: 'sin_cobrar' | 'parcial' | 'cobrado_completo' | 'excedente' = 'sin_cobrar';
  if (excedente > 0) {
    estado = 'excedente';
  } else if (totalCobrado >= montoAcordado && montoAcordado > 0) {
    estado = 'cobrado_completo';
  } else if (totalCobrado > 0) {
    estado = 'parcial';
  } else {
    estado = 'sin_cobrar';
  }

  // Commitments (optional)
  const today = getTodayString();
  const commitments = (project.paymentCommitments || []).map(c => ({
    ...c,
    status: calculateCommitmentStatus(c),
  }));

  const pendingCommitments = commitments.filter(c => c.status !== 'cobrado');
  const overdueCommitment = pendingCommitments.find(c => c.dueDate && c.dueDate < today);
  const isOverdue = Boolean(overdueCommitment && saldoPendiente > 0);

  // Next commitment sorted by date
  const futureCommitments = [...pendingCommitments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nextCommitment = futureCommitments[0];

  return {
    montoAcordado,
    currency,
    payments,
    totalCobrado,
    saldoPendiente,
    porcentajeCobrado,
    excedente,
    estado,
    isOverdue,
    overdueCommitment,
    nextCommitment,
    commitments,
    allCommitmentsFulfilled: commitments.length > 0 && pendingCommitments.length === 0,
  };
}

/**
 * Formats a smart, tailored WhatsApp payment reminder adapting to real outstanding balance
 * and automatically incorporating studio bank/payment details (Alias, CBU, Links).
 */
export function buildSmartWhatsAppPaymentMessage(params: {
  project: Project;
  studioSettings?: StudioPaymentSettings;
  commitment?: FlexiblePaymentCommitment;
  customAmount?: number;
  incomes?: IncomeRecord[];
}): string {
  const { project, studioSettings, commitment, customAmount, incomes = [] } = params;
  const billing = calculateProjectBilling(project, incomes);
  const clientName = project.clientName || 'Hola';
  const effectiveCur = billing.currency;

  const amountToMention = customAmount 
    ?? (commitment ? commitment.amount : (billing.saldoPendiente > 0 ? billing.saldoPendiente : billing.montoAcordado));

  const formattedAmount = formatCurrencyAmount(amountToMention, effectiveCur, true);
  const serviceTitle = project.projectType?.startsWith('paf') 
    ? 'Programa PAF' 
    : (project.serviceType === 'web' ? 'desarrollo web' : 'proyecto');

  let text = `Hola ${clientName}, te escribo de .Cero`;

  if (commitment) {
    let dateStr = commitment.dueDate;
    if (dateStr && dateStr.includes('-')) {
      const [y, m, d] = dateStr.split('-');
      dateStr = `${d}/${m}/${y}`;
    }
    text += ` para recordarte el pago de "${commitment.title || 'compromiso acordado'}" correspondiente al ${serviceTitle} por un total de ${formattedAmount} con fecha límite ${dateStr}.`;
  } else if (billing.saldoPendiente > 0) {
    text += ` para pasarte el estado de tu cuenta correspondiente al ${serviceTitle}. Al día de hoy el saldo pendiente es de ${formattedAmount}.`;
  } else {
    text += ` para pasarte los datos para el pago del ${serviceTitle} por un total de ${formattedAmount}.`;
  }

  // Include payment details if configured
  const bankDetails: string[] = [];
  if (effectiveCur === 'ARS') {
    if (studioSettings?.aliasArs) bankDetails.push(`• Alias: ${studioSettings.aliasArs}`);
    if (studioSettings?.cbuArs) bankDetails.push(`• CBU/CVU: ${studioSettings.cbuArs}`);
  } else {
    if (studioSettings?.aliasUsd) bankDetails.push(`• Alias/Cuenta USD: ${studioSettings.aliasUsd}`);
    if (studioSettings?.cbuUsd) bankDetails.push(`• CBU/Cuenta USD: ${studioSettings.cbuUsd}`);
  }

  if (studioSettings?.accountHolder) {
    bankDetails.push(`• Titular: ${studioSettings.accountHolder}`);
  }

  if (studioSettings?.paymentLink) {
    bankDetails.push(`• Link de pago: ${studioSettings.paymentLink}`);
  }

  if (studioSettings?.usdtAddress && effectiveCur === 'USD') {
    bankDetails.push(`• USDT: ${studioSettings.usdtAddress}`);
  }

  if (bankDetails.length > 0) {
    text += `\n\nPodés transferir directamente a:\n${bankDetails.join('\n')}`;
  }

  text += `\n\n¡Avisame cuando realices el pago y pasame el comprobante por acá para registrarlo en tu ficha! Muchas gracias.`;

  return text;
}

export type ScheduleTemplateType = 'pago_unico' | 'dos_cuotas' | 'mensual' | 'hitos_40_30_30' | 'personalizado';

/**
 * Generates initial flexible schedule templates
 */
export function generateFlexibleSchedule(options: {
  template: ScheduleTemplateType;
  totalAmount: number;
  currency: 'USD' | 'ARS';
  startDate?: string;
  monthlyCount?: number;
  projectId?: string;
  clientName?: string;
}): FlexiblePaymentCommitment[] {
  const {
    template,
    totalAmount,
    currency,
    startDate = getTodayString(),
    monthlyCount = 3,
    projectId,
    clientName,
  } = options;

  const total = Math.max(0, Math.round(totalAmount));

  switch (template) {
    case 'pago_unico':
      return [
        {
          id: `cmt_${Date.now()}_1`,
          title: 'Pago Único (100%)',
          dueDate: startDate,
          amount: total,
          currency,
          status: 'pendiente',
          projectId,
          clientName,
        }
      ];

    case 'dos_cuotas': {
      const c1 = Math.floor(total / 2);
      const c2 = total - c1;
      return [
        {
          id: `cmt_${Date.now()}_1`,
          title: 'Anticipo 50%',
          dueDate: startDate,
          amount: c1,
          currency,
          status: 'pendiente',
          projectId,
          clientName,
        },
        {
          id: `cmt_${Date.now()}_2`,
          title: 'Entrega final 50%',
          dueDate: addMonthsToDate(startDate, 1),
          amount: c2,
          currency,
          status: 'pendiente',
          projectId,
          clientName,
        }
      ];
    }

    case 'hitos_40_30_30': {
      const c1 = Math.round(total * 0.40);
      const c2 = Math.round(total * 0.30);
      const c3 = total - c1 - c2;
      return [
        {
          id: `cmt_${Date.now()}_1`,
          title: 'Anticipo Kick-Off (40%)',
          dueDate: startDate,
          amount: c1,
          currency,
          status: 'pendiente',
          projectId,
          clientName,
        },
        {
          id: `cmt_${Date.now()}_2`,
          title: 'Hito Intermedio / Desarrollo (30%)',
          dueDate: addDaysToDate(startDate, 20),
          amount: c2,
          currency,
          status: 'pendiente',
          projectId,
          clientName,
        },
        {
          id: `cmt_${Date.now()}_3`,
          title: 'Entrega & Lanzamiento (30%)',
          dueDate: addMonthsToDate(startDate, 2),
          amount: c3,
          currency,
          status: 'pendiente',
          projectId,
          clientName,
        }
      ];
    }

    case 'mensual': {
      const count = Math.max(1, monthlyCount);
      const base = Math.floor(total / count);
      const res = total - (base * count);
      const list: FlexiblePaymentCommitment[] = [];
      for (let i = 0; i < count; i++) {
        const amt = (i === count - 1) ? base + res : base;
        list.push({
          id: `cmt_${Date.now()}_${i + 1}`,
          title: `Cuota ${i + 1} de ${count}`,
          dueDate: addMonthsToDate(startDate, i),
          amount: amt,
          currency,
          status: 'pendiente',
          projectId,
          clientName,
        });
      }
      return list;
    }

    case 'personalizado':
    default:
      return [
        {
          id: `cmt_${Date.now()}_1`,
          title: 'Compromiso 1',
          dueDate: startDate,
          amount: total,
          currency,
          status: 'pendiente',
          projectId,
          clientName,
        }
      ];
  }
}

// =============================================================
// NUEVO SISTEMA DE COBROS Y ACUERDOS FLEXIBLES (.CERO v3.8)
// =============================================================

/**
 * Difference in calendar days between date A and date B (A - B)
 */
export function diffDays(dateStrA: string, dateStrB: string): number {
  if (!dateStrA || !dateStrB) return 0;
  try {
    const da = new Date(dateStrA.slice(0, 10) + 'T12:00:00Z');
    const db = new Date(dateStrB.slice(0, 10) + 'T12:00:00Z');
    const diffMs = da.getTime() - db.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

/**
 * Resolves the exact 7-state status for a cuota/installment
 */
export function resolveCuotaStatus(
  expectedAmount: number,
  actualPaidAmount: number,
  dueDate: string,
  paidAt?: string
): { status: CuotaStatus; delayDays: number } {
  const today = getTodayString();
  const exp = Math.max(0, Number(expectedAmount) || 0);
  const act = Math.max(0, Number(actualPaidAmount) || 0);

  // 1. Pagado completo o con excedente
  if (act >= exp && exp > 0) {
    if (paidAt && dueDate && paidAt > dueDate) {
      const delay = Math.max(1, diffDays(paidAt, dueDate));
      return { status: 'pagado_tarde', delayDays: delay };
    }
    return { status: 'pagado_a_tiempo', delayDays: 0 };
  }

  // 2. Pago parcial
  if (act > 0 && act < exp) {
    const delay = dueDate && dueDate < today ? diffDays(today, dueDate) : 0;
    return { status: 'parcial', delayDays: delay };
  }

  // 3. Sin pagar
  if (dueDate && dueDate < today) {
    const delay = Math.max(1, diffDays(today, dueDate));
    return { status: 'vencido', delayDays: delay };
  }

  if (dueDate === today) {
    return { status: 'vence_hoy', delayDays: 0 };
  }

  // Si vence en el mes en curso o próximos 30 días -> Pendiente
  const todayMonthKey = today.slice(0, 7);
  const dueMonthKey = dueDate ? dueDate.slice(0, 7) : todayMonthKey;
  if (dueMonthKey <= todayMonthKey || (dueDate && diffDays(dueDate, today) <= 30)) {
    return { status: 'pendiente', delayDays: 0 };
  }

  return { status: 'futuro', delayDays: 0 };
}

/**
 * Visual metadata and labels for the 7 statuses
 */
export function getCuotaStatusBadge(status: CuotaStatus, delayDays: number = 0): {
  label: string;
  badgeClass: string;
  colorHex: string;
  iconName: 'check' | 'clock' | 'alert' | 'pie' | 'circle';
} {
  switch (status) {
    case 'pagado_a_tiempo':
      return {
        label: 'Pagado a tiempo',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
        colorHex: '#10B981',
        iconName: 'check',
      };
    case 'pagado_tarde':
      return {
        label: delayDays > 0 ? `Pagado (+${delayDays}d)` : 'Pagado con atraso',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
        colorHex: '#10B981',
        iconName: 'clock',
      };
    case 'pendiente':
      return {
        label: 'Pendiente',
        badgeClass: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
        colorHex: '#FBBF24',
        iconName: 'clock',
      };
    case 'vence_hoy':
      return {
        label: 'Vence hoy',
        badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 ring-1 ring-amber-500/20',
        colorHex: '#F59E0B',
        iconName: 'alert',
      };
    case 'vencido':
      return {
        label: delayDays > 0 ? `Vencido (${delayDays}d)` : 'Vencido',
        badgeClass: 'bg-rose-500/20 text-rose-400 border border-rose-500/40 font-semibold',
        colorHex: '#F43F5E',
        iconName: 'alert',
      };
    case 'parcial':
      return {
        label: 'Parcial',
        badgeClass: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
        colorHex: '#0EA5E9',
        iconName: 'pie',
      };
    case 'futuro':
    default:
      return {
        label: 'Futuro',
        badgeClass: 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/60',
        colorHex: '#71717A',
        iconName: 'circle',
      };
  }
}

/**
 * Generates initial or customized installments for an agreement
 */
export function generateAgreementInstallments(params: {
  type: BillingAgreementType;
  totalAmount?: number;
  currency?: 'USD' | 'ARS';
  startDate?: string;
  endDate?: string;
  installmentsCount?: number;
  monthlyAmount?: number;
  hourlyRate?: number;
  dueDayRule?: number;
  preferredPaymentMethod?: PaymentMethod;
  customMilestones?: { title: string; amount: number; dueDate: string }[];
}): BillingInstallment[] {
  const {
    type,
    totalAmount = 0,
    currency = 'ARS',
    startDate = getTodayString(),
    installmentsCount = 3,
    monthlyAmount = 0,
    dueDayRule,
    customMilestones,
  } = params;

  const result: BillingInstallment[] = [];

  // Helper to adjust day of month according to dueDayRule if set
  const applyDueDay = (dateStr: string): string => {
    if (!dueDayRule || dueDayRule < 1 || dueDayRule > 31) return dateStr;
    const [y, m] = dateStr.split('-');
    const lastDayOfMonth = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
    const day = Math.min(dueDayRule, lastDayOfMonth);
    return `${y}-${m}-${String(day).padStart(2, '0')}`;
  };

  switch (type) {
    case 'unico': {
      result.push({
        id: `inst_u_${Date.now()}`,
        number: 1,
        totalInstallments: 1,
        title: 'Pago Único',
        dueDate: applyDueDay(startDate),
        expectedAmount: Math.round(totalAmount),
        currency,
        actualPaidAmount: 0,
        status: 'pendiente',
      });
      break;
    }

    case 'hitos': {
      if (customMilestones && customMilestones.length > 0) {
        customMilestones.forEach((m, idx) => {
          result.push({
            id: `inst_h_${Date.now()}_${idx + 1}`,
            number: idx + 1,
            totalInstallments: customMilestones.length,
            title: m.title || `Hito ${idx + 1}`,
            dueDate: applyDueDay(m.dueDate || addMonthsToDate(startDate, idx)),
            expectedAmount: Math.round(m.amount),
            currency,
            actualPaidAmount: 0,
            status: 'pendiente',
          });
        });
      } else {
        // Standard 50% / 25% / 25% template
        const tot = Math.round(totalAmount);
        const m1 = Math.round(tot * 0.5);
        const m2 = Math.round(tot * 0.25);
        const m3 = tot - m1 - m2;
        result.push(
          {
            id: `inst_h_${Date.now()}_1`,
            number: 1,
            totalInstallments: 3,
            title: 'Anticipo (50%)',
            dueDate: applyDueDay(startDate),
            expectedAmount: m1,
            currency,
            actualPaidAmount: 0,
            status: 'pendiente',
          },
          {
            id: `inst_h_${Date.now()}_2`,
            number: 2,
            totalInstallments: 3,
            title: 'Hito Intermedio (25%)',
            dueDate: applyDueDay(addMonthsToDate(startDate, 1)),
            expectedAmount: m2,
            currency,
            actualPaidAmount: 0,
            status: 'pendiente',
          },
          {
            id: `inst_h_${Date.now()}_3`,
            number: 3,
            totalInstallments: 3,
            title: 'Entrega Final (25%)',
            dueDate: applyDueDay(addMonthsToDate(startDate, 2)),
            expectedAmount: m3,
            currency,
            actualPaidAmount: 0,
            status: 'pendiente',
          }
        );
      }
      break;
    }

    case 'retainer': {
      // Retainer sin fin: Mostramos los últimos 6 meses y los próximos 3 meses
      const today = getTodayString();
      const currentYear = parseInt(today.slice(0, 4), 10);
      const currentMonth = parseInt(today.slice(5, 7), 10);
      const mAmount = Math.round(monthlyAmount || totalAmount || 0);

      const targetMonths: { year: number; month: number }[] = [];
      for (let offset = -5; offset <= 3; offset++) {
        let m = currentMonth + offset;
        let y = currentYear;
        while (m < 1) {
          m += 12;
          y -= 1;
        }
        while (m > 12) {
          m -= 12;
          y += 1;
        }
        targetMonths.push({ year: y, month: m });
      }

      targetMonths.forEach((tm, idx) => {
        const mStr = String(tm.month).padStart(2, '0');
        const monthName = MONTH_NAMES[tm.month - 1];
        const rawDate = `${tm.year}-${mStr}-10`;
        const finalDueDate = applyDueDay(rawDate);

        result.push({
          id: `inst_ret_${tm.year}_${mStr}`,
          number: idx + 1,
          totalInstallments: targetMonths.length,
          title: `Abono ${monthName}`,
          dueDate: finalDueDate,
          expectedAmount: mAmount,
          currency,
          actualPaidAmount: 0,
          status: 'pendiente',
        });
      });
      break;
    }

    case 'por_hora': {
      result.push({
        id: `inst_ph_${Date.now()}`,
        number: 1,
        totalInstallments: 1,
        title: 'Horas / Trabajo suelto',
        dueDate: applyDueDay(startDate),
        expectedAmount: Math.round(totalAmount),
        currency,
        actualPaidAmount: 0,
        status: 'pendiente',
      });
      break;
    }

    case 'cuotas':
    default: {
      const count = Math.max(1, Math.round(installmentsCount || 1));
      const tot = Math.round(totalAmount);
      const base = Math.floor(tot / count);
      const res = tot - (base * count);

      for (let i = 0; i < count; i++) {
        const rawDate = addMonthsToDate(startDate, i);
        const finalDueDate = applyDueDay(rawDate);
        const amt = (i === count - 1) ? base + res : base;

        result.push({
          id: `inst_c_${Date.now()}_${i + 1}`,
          number: i + 1,
          totalInstallments: count,
          title: `Mes ${i + 1} de ${count}`,
          dueDate: finalDueDate,
          expectedAmount: amt,
          currency,
          actualPaidAmount: 0,
          status: 'pendiente',
        });
      }
      break;
    }
  }

  // Calculate initial status
  return result.map(inst => {
    const res = resolveCuotaStatus(inst.expectedAmount, inst.actualPaidAmount, inst.dueDate, inst.paidAt);
    return {
      ...inst,
      status: res.status,
      delayDays: res.delayDays,
    };
  });
}

/**
 * Resolves and unifies the complete BillingAgreement for any project.
 * Backward-compatible: If project.billingAgreement exists, refreshes real payment associations and statuses.
 * If not, synthesizes it from project.installments, pafInstallmentDates, recurringPlans, or estimatedPrice.
 */
export function resolveProjectAgreement(
  project: Project,
  incomes: IncomeRecord[] = []
): BillingAgreement {
  const realPayments = getProjectPayments(project, incomes);
  const totalPaidSum = realPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const currency = resolveProjectCurrency(project.estimatedCurrency, project.estimatedPrice, project.projectType);
  const totalAmount = Number(project.montoAcordado ?? project.estimatedPrice ?? 0);

  let agreement: BillingAgreement;

  if (project.billingAgreement && project.billingAgreement.installments && project.billingAgreement.installments.length > 0) {
    agreement = {
      ...project.billingAgreement,
      currency: project.billingAgreement.currency || currency,
      totalAmount: project.billingAgreement.totalAmount ?? totalAmount,
      installments: [...project.billingAgreement.installments],
    };
  } else {
    // Legacy migration
    let type: BillingAgreementType = 'cuotas';
    let installmentsCount = 3;
    let customMilestones: { title: string; amount: number; dueDate: string }[] | undefined;

    if (project.recurringPlans && project.recurringPlans.length > 0) {
      type = 'retainer';
    } else if (project.projectType === 'web') {
      type = 'hitos';
      const m1 = Math.floor(totalAmount / 2);
      const m2 = totalAmount - m1;
      customMilestones = [
        { title: 'Anticipo 50%', amount: m1, dueDate: project.startDate || getTodayString() },
        { title: 'Entrega final 50%', amount: m2, dueDate: project.deliveryDate || addMonthsToDate(project.startDate || getTodayString(), 1) },
      ];
    } else if (project.pafPlan === '1_pago') {
      type = 'unico';
      installmentsCount = 1;
    } else if (project.pafPlan === '2_pagos') {
      type = 'cuotas';
      installmentsCount = 2;
    } else if (project.installments && project.installments.length > 0) {
      type = 'cuotas';
      installmentsCount = project.installments.length;
    }

    const generated = generateAgreementInstallments({
      type,
      totalAmount,
      currency,
      startDate: project.startDate || getTodayString(),
      endDate: project.deliveryDate,
      installmentsCount,
      monthlyAmount: project.recurringPlans?.[0]?.amount || (totalAmount > 0 ? Math.round(totalAmount / 3) : 0),
      customMilestones,
    });

    // If project already had installments with individual custom dates/amounts, preserve them
    if (project.installments && project.installments.length > 0 && type === 'cuotas') {
      project.installments.forEach((legacyInst, idx) => {
        if (generated[idx]) {
          generated[idx].expectedAmount = legacyInst.amount || generated[idx].expectedAmount;
          generated[idx].dueDate = legacyInst.dueDate || generated[idx].dueDate;
          if (legacyInst.note) generated[idx].title = legacyInst.note;
          if (legacyInst.paid) {
            generated[idx].actualPaidAmount = legacyInst.amount;
            generated[idx].paidAt = legacyInst.paidAt || legacyInst.dueDate;
          }
        }
      });
    }

    agreement = {
      id: `agr_${project.id}`,
      type,
      title: project.projectType === 'web' ? 'Desarrollo Web' : (project.serviceType === 'paf' ? 'Programa PAF' : 'Acuerdo de Servicios'),
      currency,
      totalAmount,
      installmentsCount: generated.length,
      startDate: project.startDate || getTodayString(),
      endDate: project.deliveryDate,
      installments: generated,
    };
  }

  // Real Payments Mapping onto Cuotas
  // 1. Direct link if cuota has paymentId or matches payment note
  // 2. Chronological allocation of real payments to installments
  const updatedInstallments = agreement.installments.map((inst, index) => {
    let paidAmount = 0;
    let paidAt: string | undefined;
    let paymentMethod: PaymentMethod | undefined;
    let destAccId: string | undefined;
    let note: string | undefined = inst.note;
    let paymentId: string | undefined;

    // Check direct payment link
    const matchedPay = realPayments.find(p => 
      p.id === inst.paymentId || 
      (p.note && p.note.toLowerCase().includes(`cuota ${inst.number}`)) ||
      (p.note && p.note.toLowerCase().includes(inst.title.toLowerCase()))
    );

    if (matchedPay) {
      paidAmount = matchedPay.amount;
      paidAt = matchedPay.date;
      paymentMethod = matchedPay.method;
      destAccId = matchedPay.destinationAccountId;
      note = matchedPay.note;
      paymentId = matchedPay.id;
    } else if (inst.actualPaidAmount > 0) {
      paidAmount = inst.actualPaidAmount;
      paidAt = inst.paidAt;
      paymentMethod = inst.paymentMethod;
      destAccId = inst.destinationAccountId;
    }

    return {
      ...inst,
      actualPaidAmount: paidAmount,
      paidAt,
      paymentMethod,
      destinationAccountId: destAccId,
      note,
      paymentId,
    };
  });

  // If there are real payments not yet assigned and some cuotas have 0 paid, allocate sequentially
  let unassignedPaidSum = totalPaidSum - updatedInstallments.reduce((sum, i) => sum + i.actualPaidAmount, 0);

  if (unassignedPaidSum > 0) {
    for (let i = 0; i < updatedInstallments.length; i++) {
      const inst = updatedInstallments[i];
      const remainingExpected = Math.max(0, inst.expectedAmount - inst.actualPaidAmount);
      if (remainingExpected > 0 && unassignedPaidSum > 0) {
        const canTake = Math.min(unassignedPaidSum, remainingExpected);
        inst.actualPaidAmount += canTake;
        unassignedPaidSum -= canTake;
        if (!inst.paidAt && realPayments[0]) {
          inst.paidAt = realPayments[0].date;
          inst.paymentMethod = realPayments[0].method;
        }
      }
    }
  }

  // Recalculate 7-state status for all installments
  agreement.installments = updatedInstallments.map(inst => {
    const res = resolveCuotaStatus(inst.expectedAmount, inst.actualPaidAmount, inst.dueDate, inst.paidAt);
    return {
      ...inst,
      status: res.status,
      delayDays: res.delayDays,
    };
  });

  return agreement;
}

/**
 * Punctuality and Payment Habits Analyzer per Client
 */
export interface ClientPaymentHabits {
  totalPaidCycles: number;
  onTimeCount: number;
  lateCount: number;
  onTimePercentage: number; // 0 - 100
  avgDelayDays: number; // días promedio
  usualPaymentDay?: number; // día habitual del mes (1 - 31)
  tag: 'Puntual' | 'Se atrasa seguido' | 'Sin historial suficiente';
  lastPaidCuota?: {
    title: string;
    date: string;
    amount: number;
    currency: 'USD' | 'ARS';
    delayDays: number;
  };
  nextUpcomingCuota?: {
    title: string;
    dueDate: string;
    amount: number;
    currency: 'USD' | 'ARS';
    isOverdue: boolean;
    delayDays?: number;
  };
}

export function calculateClientPaymentHabits(
  project: Project,
  incomes: IncomeRecord[] = []
): ClientPaymentHabits {
  const agreement = resolveProjectAgreement(project, incomes);
  const installments = agreement.installments;

  // Paid installments
  const paidCuotas = installments.filter(i => i.status === 'pagado_a_tiempo' || i.status === 'pagado_tarde' || i.actualPaidAmount >= i.expectedAmount);
  const totalPaidCycles = paidCuotas.length;

  let onTimeCount = 0;
  let lateCount = 0;
  let totalDelayDays = 0;
  const paymentDaysOfMonth: number[] = [];

  paidCuotas.forEach(c => {
    if (c.status === 'pagado_a_tiempo') {
      onTimeCount += 1;
    } else {
      lateCount += 1;
      totalDelayDays += (c.delayDays || 0);
    }

    if (c.paidAt && c.paidAt.length >= 10) {
      const dayNum = parseInt(c.paidAt.slice(8, 10), 10);
      if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
        paymentDaysOfMonth.push(dayNum);
      }
    }
  });

  const onTimePercentage = totalPaidCycles > 0 ? Math.round((onTimeCount / totalPaidCycles) * 100) : 0;
  const avgDelayDays = lateCount > 0 ? Math.round(totalDelayDays / lateCount) : 0;

  // Calculate usual payment day (average of days of month)
  let usualPaymentDay: number | undefined;
  if (paymentDaysOfMonth.length > 0) {
    const sumDays = paymentDaysOfMonth.reduce((a, b) => a + b, 0);
    usualPaymentDay = Math.round(sumDays / paymentDaysOfMonth.length);
  }

  // Etiqueta automática (mínimo 2 pagos para etiquetar)
  let tag: 'Puntual' | 'Se atrasa seguido' | 'Sin historial suficiente' = 'Sin historial suficiente';
  if (totalPaidCycles >= 2) {
    if (onTimePercentage >= 75 && avgDelayDays <= 3) {
      tag = 'Puntual';
    } else {
      tag = 'Se atrasa seguido';
    }
  }

  // Last paid cuota
  const sortedPaid = [...paidCuotas].sort((a, b) => (b.paidAt || b.dueDate).localeCompare(a.paidAt || a.dueDate));
  const lastPaid = sortedPaid[0];

  // Next upcoming cuota (pending, overdue or future)
  const pendingCuotas = installments
    .filter(i => i.status !== 'pagado_a_tiempo' && i.status !== 'pagado_tarde' && i.actualPaidAmount < i.expectedAmount)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nextCuota = pendingCuotas[0];

  return {
    totalPaidCycles,
    onTimeCount,
    lateCount,
    onTimePercentage,
    avgDelayDays,
    usualPaymentDay,
    tag,
    lastPaidCuota: lastPaid ? {
      title: lastPaid.title,
      date: lastPaid.paidAt || lastPaid.dueDate,
      amount: lastPaid.actualPaidAmount || lastPaid.expectedAmount,
      currency: lastPaid.currency,
      delayDays: lastPaid.delayDays || 0,
    } : undefined,
    nextUpcomingCuota: nextCuota ? {
      title: nextCuota.title,
      dueDate: nextCuota.dueDate,
      amount: Math.max(0, nextCuota.expectedAmount - nextCuota.actualPaidAmount),
      currency: nextCuota.currency,
      isOverdue: nextCuota.status === 'vencido',
      delayDays: nextCuota.delayDays,
    } : undefined,
  };
}

/**
 * Monthly studio revenue summary for Dinero > Estudio
 */
export interface MonthIncomeSummary {
  year: number;
  monthNumber: string; // "01" - "12"
  monthKey: string; // YYYY-MM
  monthName: string; // "Octubre 2026"
  isCurrentMonth: boolean;

  // 4 Big Numbers
  cobradoARS: number;
  cobradoUSD: number;
  cobradoUnifiedARS: number;

  porCobrarARS: number;
  porCobrarUSD: number;
  porCobrarUnifiedARS: number;

  vencidoARS: number;
  vencidoUSD: number;
  vencidoUnifiedARS: number;

  proyectadoTotalARS: number;
  proyectadoTotalUSD: number;
  proyectadoTotalUnifiedARS: number;

  porcentajeAvance: number; // cobrado / proyectado * 100
  usdRateUsed: number;

  // Client items sorted by urgency
  clientItems: Array<{
    projectId: string;
    clientName: string;
    rubro: string;
    clientPhone?: string;
    agreementType: BillingAgreementType;
    cuotaTitle: string; // ej. "Mes 2 de 6"
    expectedAmount: number;
    pendingAmount: number;
    currency: 'USD' | 'ARS';
    dueDate: string;
    status: CuotaStatus;
    delayDays: number;
    cuotaId: string;
    isPaid: boolean;
    urgencyScore: number;
  }>;

  // 6-month evolution data for bar chart
  sixMonthsEvolution: Array<{
    monthKey: string;
    shortLabel: string;
    cobradoARS: number;
    cobradoUSD: number;
    proyectadoARS: number;
    proyectadoUSD: number;
    cobradoUnifiedARS: number;
    proyectadoUnifiedARS: number;
    isCurrentMonth: boolean;
  }>;
}

export function calculateMonthIncomeSummary(
  projects: Project[],
  incomes: IncomeRecord[],
  targetYear: number,
  targetMonthNum: string,
  usdRate: number = 1250
): MonthIncomeSummary {
  const today = getTodayString();
  const currentMonthKey = today.slice(0, 7);
  const selectedMonthKey = `${targetYear}-${targetMonthNum.padStart(2, '0')}`;
  const monthIdx = parseInt(targetMonthNum, 10) - 1;
  const monthName = `${MONTH_NAMES[monthIdx]} ${targetYear}`;
  const isCurrentMonth = selectedMonthKey === currentMonthKey;

  let cobradoARS = 0;
  let cobradoUSD = 0;
  let porCobrarARS = 0;
  let porCobrarUSD = 0;
  let vencidoARS = 0;
  let vencidoUSD = 0;

  const clientItems: MonthIncomeSummary['clientItems'] = [];

  const activeProjects = projects.filter(p => !p.archived && p.status !== 'No concretado');

  activeProjects.forEach(project => {
    const agreement = resolveProjectAgreement(project, incomes);
    const rubro = project.rubro || (project.serviceType === 'paf' ? 'Consultoría PAF' : (project.projectType === 'web' ? 'Desarrollo Web' : 'Cliente'));

    agreement.installments.forEach(cuota => {
      const cuotaMonthKey = cuota.dueDate ? cuota.dueDate.slice(0, 7) : '';
      const cuotaPaidMonthKey = cuota.paidAt ? cuota.paidAt.slice(0, 7) : '';

      // Item belongs to this month if its due date is in this month OR it was paid in this month
      // OR if it's currently overdue and uncollected
      const isDueInMonth = cuotaMonthKey === selectedMonthKey;
      const isPaidInMonth = cuotaPaidMonthKey === selectedMonthKey;
      const isOverdueNow = cuota.status === 'vencido' && isCurrentMonth;

      if (!isDueInMonth && !isPaidInMonth && !isOverdueNow) return;

      const amt = Number(cuota.expectedAmount) || 0;
      const paid = Number(cuota.actualPaidAmount) || 0;
      const pending = Math.max(0, amt - paid);

      // Accumulate metrics
      if (cuota.currency === 'USD') {
        if (isPaidInMonth || (cuota.status === 'pagado_a_tiempo' || cuota.status === 'pagado_tarde')) {
          cobradoUSD += paid;
        }
        if (cuota.status === 'vencido') {
          vencidoUSD += pending;
        } else if (cuota.status === 'pendiente' || cuota.status === 'vence_hoy' || cuota.status === 'parcial') {
          porCobrarUSD += pending;
        }
      } else {
        if (isPaidInMonth || (cuota.status === 'pagado_a_tiempo' || cuota.status === 'pagado_tarde')) {
          cobradoARS += paid;
        }
        if (cuota.status === 'vencido') {
          vencidoARS += pending;
        } else if (cuota.status === 'pendiente' || cuota.status === 'vence_hoy' || cuota.status === 'parcial') {
          porCobrarARS += pending;
        }
      }

      // Calculate urgency score for sorting:
      // Vencidos = 1000 + delayDays
      // Vence hoy = 800
      // Parcial = 600
      // Pendiente = 400 - diffDays(dueDate, today)
      // Futuro = 100
      // Pagado = 10
      let urgencyScore = 10;
      if (cuota.status === 'vencido') {
        urgencyScore = 1000 + (cuota.delayDays || 1);
      } else if (cuota.status === 'vence_hoy') {
        urgencyScore = 800;
      } else if (cuota.status === 'parcial') {
        urgencyScore = 600;
      } else if (cuota.status === 'pendiente') {
        urgencyScore = 400 - Math.max(0, diffDays(cuota.dueDate, today));
      } else if (cuota.status === 'futuro') {
        urgencyScore = 100;
      }

      clientItems.push({
        projectId: project.id,
        clientName: project.clientName,
        rubro,
        clientPhone: project.clientPhone,
        agreementType: agreement.type,
        cuotaTitle: cuota.title,
        expectedAmount: amt,
        pendingAmount: pending > 0 ? pending : amt,
        currency: cuota.currency,
        dueDate: cuota.dueDate,
        status: cuota.status,
        delayDays: cuota.delayDays || 0,
        cuotaId: cuota.id,
        isPaid: cuota.status === 'pagado_a_tiempo' || cuota.status === 'pagado_tarde',
        urgencyScore,
      });
    });
  });

  // Also include direct Incomes recorded in this month that don't belong to any project
  incomes.forEach(inc => {
    if (inc.month === selectedMonthKey && !inc.projectId) {
      const amt = Number(inc.amount) || 0;
      if (inc.status === 'cobrado') {
        if (inc.currency === 'USD') cobradoUSD += amt;
        else cobradoARS += amt;
      } else {
        if (inc.currency === 'USD') porCobrarUSD += amt;
        else porCobrarARS += amt;
      }
    }
  });

  // Totales
  const proyectadoTotalARS = cobradoARS + porCobrarARS + vencidoARS;
  const proyectadoTotalUSD = cobradoUSD + porCobrarUSD + vencidoUSD;

  const cobradoUnifiedARS = cobradoARS + (cobradoUSD * usdRate);
  const porCobrarUnifiedARS = porCobrarARS + (porCobrarUSD * usdRate);
  const vencidoUnifiedARS = vencidoARS + (vencidoUSD * usdRate);
  const proyectadoTotalUnifiedARS = proyectadoTotalARS + (proyectadoTotalUSD * usdRate);

  const porcentajeAvance = proyectadoTotalUnifiedARS > 0 
    ? Math.min(100, Math.round((cobradoUnifiedARS / proyectadoTotalUnifiedARS) * 100))
    : (cobradoUnifiedARS > 0 ? 100 : 0);

  // Sort client items by urgency (highest first)
  clientItems.sort((a, b) => b.urgencyScore - a.urgencyScore);

  // 6-Month Evolution Bar Chart Data
  // Build rolling 6 months up to target month
  const targetYearNum = targetYear;
  const targetM = parseInt(targetMonthNum, 10);
  const sixMonthsEvolution: MonthIncomeSummary['sixMonthsEvolution'] = [];

  for (let offset = -5; offset <= 0; offset++) {
    let m = targetM + offset;
    let y = targetYearNum;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    const mStr = String(m).padStart(2, '0');
    const mKey = `${y}-${mStr}`;
    const shortLabel = `${MONTH_NAMES[m - 1].slice(0, 3)} ${String(y).slice(2)}`;

    let mCobradoARS = 0;
    let mCobradoUSD = 0;
    let mProyectadoARS = 0;
    let mProyectadoUSD = 0;

    activeProjects.forEach(p => {
      const agr = resolveProjectAgreement(p, incomes);
      agr.installments.forEach(c => {
        const cMKey = c.dueDate ? c.dueDate.slice(0, 7) : '';
        const cPMKey = c.paidAt ? c.paidAt.slice(0, 7) : '';
        const amt = Number(c.expectedAmount) || 0;
        const paid = Number(c.actualPaidAmount) || 0;

        if (cMKey === mKey) {
          if (c.currency === 'USD') mProyectadoUSD += amt;
          else mProyectadoARS += amt;
        }

        if (cPMKey === mKey || (cMKey === mKey && (c.status === 'pagado_a_tiempo' || c.status === 'pagado_tarde'))) {
          if (c.currency === 'USD') mCobradoUSD += paid;
          else mCobradoARS += paid;
        }
      });
    });

    incomes.forEach(inc => {
      if (inc.month === mKey) {
        const amt = Number(inc.amount) || 0;
        if (inc.status === 'cobrado') {
          if (inc.currency === 'USD') mCobradoUSD += amt;
          else mCobradoARS += amt;
        }
        if (inc.currency === 'USD') mProyectadoUSD += amt;
        else mProyectadoARS += amt;
      }
    });

    const mCobradoUnified = mCobradoARS + (mCobradoUSD * usdRate);
    const mProyectadoUnified = Math.max(mCobradoUnified, mProyectadoARS + (mProyectadoUSD * usdRate));

    sixMonthsEvolution.push({
      monthKey: mKey,
      shortLabel,
      cobradoARS: mCobradoARS,
      cobradoUSD: mCobradoUSD,
      proyectadoARS: mProyectadoARS,
      proyectadoUSD: mProyectadoUSD,
      cobradoUnifiedARS: mCobradoUnified,
      proyectadoUnifiedARS: mProyectadoUnified,
      isCurrentMonth: mKey === currentMonthKey,
    });
  }

  return {
    year: targetYear,
    monthNumber: targetMonthNum.padStart(2, '0'),
    monthKey: selectedMonthKey,
    monthName,
    isCurrentMonth,
    cobradoARS,
    cobradoUSD,
    cobradoUnifiedARS,
    porCobrarARS,
    porCobrarUSD,
    porCobrarUnifiedARS,
    vencidoARS,
    vencidoUSD,
    vencidoUnifiedARS,
    proyectadoTotalARS,
    proyectadoTotalUSD,
    proyectadoTotalUnifiedARS,
    porcentajeAvance,
    usdRateUsed: usdRate,
    clientItems,
    sixMonthsEvolution,
  };
}
