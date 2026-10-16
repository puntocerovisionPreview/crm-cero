import { Project, IncomeRecord, ExpenseRecord } from '../types';
import { getTodayString } from './storage';
import { 
  calculateMonthlyCashProjection, 
  MonthlyCashProjection,
  getIncludeLeadsSetting,
  setIncludeLeadsSetting 
} from './monthlyCashProjection';
import { DEFAULT_USD_RATE } from './currency';

export type HorizonFrente = 'PAF' | 'Webs' | 'Otros';
export type HorizonEstado = 'por entrar' | 'no comenzó' | 'activo' | 'finalizado';

export interface DerivedHorizonProject {
  project: Project;
  id: string;
  clientName: string;
  hasDates: boolean;
  hasLoadedCuotas: boolean;
  inicio: string | null; // YYYY-MM-DD
  fin: string | null;    // YYYY-MM-DD
  monto: number;
  currency: 'USD' | 'ARS';
  montoEnARS: number;
  montoEnUSD: number;
  frente: HorizonFrente;
  estado: HorizonEstado;
  cupos: number;
  isOverrideStart: boolean;
  isOverrideEnd: boolean;
  isOverrideFrente: boolean;
  isOverrideCupos: boolean;
}

export interface HorizonMonthColumn {
  monthKey: string;     // YYYY-MM
  label: string;        // "Octubre 2026"
  shortLabel: string;   // "Oct"
  year: number;
  startDay: string;     // YYYY-MM-01
  endDay: string;       // YYYY-MM-31
  isCurrent: boolean;
}

export interface HorizonMonthOccupancy {
  month: HorizonMonthColumn;
  usedSlots: number;
  capacity: number;
  availableSlots: number;
  status: 'green' | 'yellow' | 'red';
  shortText: string;
  projectIds: string[];
  
  // Finanzas compartidas exactas con /finanzas
  cobradoARS: number;
  cobradoUSD: number;
  porCobrarARS: number;
  porCobrarUSD: number;
  retainersARS: number;
  retainersUSD: number;
  totalEstimadoARS: number; // Cobrado + Por Cobrar + Retainers
  totalEstimadoUSD: number;
  targetGoalARS: number;
  targetProgressPercent: number;

  // Leads siempre separados
  leadsPonderadoARS: number;
  leadsTotalARS: number;

  cashProjection: MonthlyCashProjection;
}

export interface HorizonFrenteWeight {
  frente: HorizonFrente;
  count: number;
  countPercent: number;
  amountARS: number;
  amountUSD: number;
  amountPercent: number;
  colorClass: string;
  borderClass: string;
  bgLightClass: string;
  dotColor: string;
}

export const HORIZON_STORAGE_KEYS = {
  capacity: 'cero_horizon_capacity',
  rangeMonths: 'cero_horizon_range_months',
  includeLeads: 'cero_horizon_include_leads',
  targetGoalArs: 'cero_horizon_target_goal_ars',
  includeWebInTarget: 'cero_horizon_include_web_in_target',
};

/**
 * Obtiene la meta mensual recurrente en ARS (por defecto: 1.500.000 ARS)
 */
export function getHorizonTargetGoalARS(): number {
  if (typeof window === 'undefined') return 1500000;
  try {
    const raw = localStorage.getItem(HORIZON_STORAGE_KEYS.targetGoalArs);
    if (!raw) return 1500000;
    const parsed = parseFloat(raw);
    return isNaN(parsed) || parsed <= 0 ? 1500000 : parsed;
  } catch {
    return 1500000;
  }
}

/**
 * Guarda la meta mensual recurrente en ARS
 */
export function setHorizonTargetGoalARS(goal: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HORIZON_STORAGE_KEYS.targetGoalArs, String(Math.max(1, goal)));
  } catch {}
}

/**
 * Obtiene si se incluye facturación Web en la meta mensual (por defecto: true)
 */
export function getHorizonIncludeWebInTarget(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(HORIZON_STORAGE_KEYS.includeWebInTarget);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

/**
 * Guarda si se incluye facturación Web en la meta mensual
 */
export function setHorizonIncludeWebInTarget(include: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HORIZON_STORAGE_KEYS.includeWebInTarget, String(include));
  } catch {}
}

/**
 * Obtiene la capacidad configurada de proyectos simultáneos (default: 4)
 */
export function getHorizonCapacity(): number {
  if (typeof window === 'undefined') return 4;
  try {
    const raw = localStorage.getItem(HORIZON_STORAGE_KEYS.capacity);
    if (!raw) return 4;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) || parsed < 1 ? 4 : parsed;
  } catch {
    return 4;
  }
}

/**
 * Guarda la capacidad configurada en localStorage
 */
export function setHorizonCapacity(capacity: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HORIZON_STORAGE_KEYS.capacity, String(Math.max(1, capacity)));
  } catch {}
}

export { getIncludeLeadsSetting, setIncludeLeadsSetting };

/**
 * Deriva las fechas, estado, frente y cuotas de un proyecto.
 * REGLA ESTRICTA: NO INVENTA FECHAS FICTICIAS.
 * Si el usuario no cargó fechas reales, inicio y fin son null y hasDates = false.
 */
export function deriveHorizonProject(project: Project, usdRate: number = 1250): DerivedHorizonProject {
  const today = getTodayString();

  // 1. FRENTE (con override si existe)
  const isOverrideFrente = Boolean(project.frente && project.frente.trim().length > 0);
  let frente: HorizonFrente = 'Otros';

  if (isOverrideFrente) {
    const rawFrente = project.frente!.trim().toLowerCase();
    if (rawFrente.includes('paf')) frente = 'PAF';
    else if (rawFrente.includes('web')) frente = 'Webs';
    else frente = 'Otros';
  } else {
    if (project.serviceType === 'paf' || project.projectType === 'paf_pro' || project.projectType === 'paf_base') {
      frente = 'PAF';
    } else if (project.serviceType === 'web' || project.projectType === 'web') {
      frente = 'Webs';
    } else {
      frente = 'Otros';
    }
  }

  // 2. INICIO (Sin fallback a createdAt ni al día de hoy)
  let inicio: string | null = null;
  const isOverrideStart = Boolean(project.horizonStart && project.horizonStart.trim().length >= 8);

  if (isOverrideStart) {
    inicio = project.horizonStart!.trim();
  } else if (project.startDate && project.startDate.trim().length >= 8) {
    inicio = project.startDate.trim();
  } else if (project.billingAgreement?.startDate && project.billingAgreement.startDate.trim().length >= 8) {
    inicio = project.billingAgreement.startDate.trim();
  } else {
    // Buscar la fecha de la primera cuota cargada explícitamente
    const allDates: string[] = [];
    (project.billingAgreement?.installments || []).forEach(i => {
      if (i.dueDate && i.dueDate.trim().length >= 8) allDates.push(i.dueDate.trim());
    });
    (project.paymentCommitments || []).forEach(c => {
      if (c.dueDate && c.dueDate.trim().length >= 8) allDates.push(c.dueDate.trim());
    });
    (project.installments || []).forEach(i => {
      if (i.dueDate && i.dueDate.trim().length >= 8) allDates.push(i.dueDate.trim());
    });

    if (allDates.length > 0) {
      allDates.sort();
      inicio = allDates[0];
    } else {
      inicio = null; // No inventar
    }
  }

  // 3. FIN (Sin fallback a +3m, +2m, +6m)
  let fin: string | null = null;
  const isOverrideEnd = Boolean(project.horizonEnd && project.horizonEnd.trim().length >= 8);

  if (isOverrideEnd) {
    fin = project.horizonEnd!.trim();
  } else if (project.deliveryDate && project.deliveryDate.trim().length >= 8) {
    fin = project.deliveryDate.trim();
  } else if (project.billingAgreement?.endDate && project.billingAgreement.endDate.trim().length >= 8) {
    fin = project.billingAgreement.endDate.trim();
  } else {
    // Buscar la fecha de la última cuota cargada explícitamente
    const allEndDates: string[] = [];
    (project.billingAgreement?.installments || []).forEach(i => {
      if (i.dueDate && i.dueDate.trim().length >= 8) allEndDates.push(i.dueDate.trim());
    });
    (project.paymentCommitments || []).forEach(c => {
      if (c.dueDate && c.dueDate.trim().length >= 8) allEndDates.push(c.dueDate.trim());
    });
    (project.installments || []).forEach(i => {
      if (i.dueDate && i.dueDate.trim().length >= 8) allEndDates.push(i.dueDate.trim());
    });
    (project.pafMilestones || []).forEach(m => {
      if (m.completedAt && m.completedAt.trim().length >= 8) allEndDates.push(m.completedAt.trim());
    });

    if (allEndDates.length > 0) {
      allEndDates.sort();
      fin = allEndDates[allEndDates.length - 1];
    } else {
      fin = null; // No inventar
    }
  }

  // Si inicio y fin existen pero fin es menor a inicio, corregir
  if (inicio && fin && fin < inicio) {
    fin = inicio;
  }

  // REGLA CLAVE: Solo tiene fechas si AMBAS están explícitamente definidas
  const hasDates = Boolean(inicio && fin);

  // 4. VERIFICACIÓN DE CUOTAS REALES CARGADAS
  const hasLoadedCuotas = Boolean(
    (project.billingAgreement?.installments && project.billingAgreement.installments.length > 0) ||
    (project.paymentCommitments && project.paymentCommitments.length > 0) ||
    (project.installments && project.installments.length > 0)
  );

  // 5. MONTO
  const rawMonto = Number(project.billingAgreement?.totalAmount ?? project.montoAcordado ?? project.estimatedPrice ?? 0);
  const monto = isNaN(rawMonto) || rawMonto < 0 ? 0 : rawMonto;
  const currency: 'USD' | 'ARS' = (project.billingAgreement?.currency || project.estimatedCurrency || 'ARS') as 'USD' | 'ARS';

  const validRate = usdRate > 0 ? usdRate : DEFAULT_USD_RATE;
  const montoEnARS = currency === 'USD' ? monto * validRate : monto;
  const montoEnUSD = currency === 'USD' ? monto : (validRate > 0 ? monto / validRate : 0);

  // 6. ESTADO
  let estado: HorizonEstado = 'activo';

  const isArchivedOrCompleted =
    project.archived ||
    project.status === 'Entregado' ||
    project.pafStage === 'Graduados' ||
    project.statusOverride === 'completed';

  const isProspectOrLead =
    project.isLead ||
    project.status === 'Posible proyecto' ||
    project.status === 'Propuesta enviada' ||
    project.status === 'En negociación';

  const isPausedOrNotStarted =
    project.status === 'Pausado' ||
    project.status === 'No iniciado' ||
    project.statusOverride === 'not_started';

  if (isArchivedOrCompleted) {
    estado = 'finalizado';
  } else if (isProspectOrLead) {
    estado = 'por entrar';
  } else if (isPausedOrNotStarted) {
    estado = 'no comenzó';
  } else if (inicio && inicio > today && project.status !== 'En curso') {
    estado = 'no comenzó';
  } else {
    estado = 'activo';
  }

  // 7. CUPOS (Capacidad simultánea operativa)
  const isOverrideCupos = project.cupos !== undefined && project.cupos !== null;
  const parsedCupos = Number(project.cupos);
  const cupos = !isNaN(parsedCupos) && parsedCupos >= 0 ? parsedCupos : 1;

  return {
    project,
    id: project.id,
    clientName: project.clientName || 'Cliente sin nombre',
    hasDates,
    hasLoadedCuotas,
    inicio,
    fin,
    monto,
    currency,
    montoEnARS,
    montoEnUSD,
    frente,
    estado,
    cupos,
    isOverrideStart,
    isOverrideEnd,
    isOverrideFrente,
    isOverrideCupos,
  };
}

/**
 * Genera la lista de columnas de meses para la línea de tiempo
 */
export function generateHorizonMonths(rangeMonths: 3 | 6 | 12 = 3, referenceDateStr?: string): HorizonMonthColumn[] {
  const ref = referenceDateStr ? new Date(`${referenceDateStr}T12:00:00`) : new Date();
  const currentYear = ref.getFullYear();
  const currentMonth = ref.getMonth(); // 0-indexed

  const todayStr = getTodayString();
  const currentYearMonth = todayStr.slice(0, 7);

  const monthNamesEs = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const shortNamesEs = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  const columns: HorizonMonthColumn[] = [];

  for (let i = 0; i < rangeMonths; i++) {
    const targetDate = new Date(currentYear, currentMonth + i, 1);
    const y = targetDate.getFullYear();
    const m = targetDate.getMonth();
    const monthNumber = String(m + 1).padStart(2, '0');
    const monthKey = `${y}-${monthNumber}`;

    const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
    const startDay = `${monthKey}-01`;
    const endDay = `${monthKey}-${String(lastDayOfMonth).padStart(2, '0')}`;

    columns.push({
      monthKey,
      label: `${monthNamesEs[m]} ${y}`,
      shortLabel: shortNamesEs[m],
      year: y,
      startDay,
      endDay,
      isCurrent: monthKey === currentYearMonth,
    });
  }

  return columns;
}

/**
 * Calcula si un proyecto con inicio y fin se superpone con un mes dado
 */
export function isProjectInMonth(
  project: { inicio: string | null; fin: string | null },
  month: HorizonMonthColumn
): boolean {
  if (!project.inicio || !project.fin) return false;
  return project.inicio <= month.endDay && project.fin >= month.startDay;
}

/**
 * Calcula la ocupación operativa y el flujo de caja del mes.
 * EL DINERO DE CADA MES SALE EXCLUSIVAMENTE DEL HELPER COMPARTIDO monthlyCashProjection.
 * Prohibido hacer divisiones teóricas monto/3 o monto/2.
 */
export function calculateMonthlyOccupancy(
  derivedProjects: DerivedHorizonProject[],
  months: HorizonMonthColumn[],
  capacity: number,
  includeLeads: boolean,
  targetGoalARS: number = 1500000,
  incomes: IncomeRecord[] = [],
  rawProjects: Project[] = [],
  usdRate: number = 1250,
  leadProbabilities?: Record<string, number>
): HorizonMonthOccupancy[] {
  // Solo proyectos con fechas reales y no finalizados entran a los cupos
  const applicableProjects = derivedProjects.filter(p => {
    if (!p.hasDates) return false;
    if (p.estado === 'finalizado') return false;
    if (!includeLeads && p.estado === 'por entrar') return false;
    return true;
  });

  return months.map(col => {
    const overlapping = applicableProjects.filter(p => isProjectInMonth(p, col));
    const usedSlots = overlapping.reduce((sum, p) => sum + p.cupos, 0);
    const availableSlots = capacity - usedSlots;

    let status: 'green' | 'yellow' | 'red' = 'green';
    if (availableSlots <= 0) {
      status = 'red';
    } else if (availableSlots === 1) {
      status = 'yellow';
    } else {
      status = 'green';
    }

    let shortText = '';
    if (availableSlots > 1) {
      shortText = `${col.shortLabel}: ${availableSlots} lugares libres`;
    } else if (availableSlots === 1) {
      shortText = `${col.shortLabel}: 1 lugar libre`;
    } else if (availableSlots === 0) {
      shortText = `${col.shortLabel}: Lleno (${usedSlots}/${capacity})`;
    } else {
      shortText = `${col.shortLabel}: Sobrecupo (${usedSlots}/${capacity})`;
    }

    // FUENTE DE VERDAD ÚNICA: calculateMonthlyCashProjection
    const cashProj = calculateMonthlyCashProjection({
      monthKey: col.monthKey,
      incomes,
      projects: rawProjects,
      usdRate,
      leadProbabilities,
    });

    const targetProgressPercent = targetGoalARS > 0 
      ? Math.min(150, Math.round((cashProj.totalMesARS / targetGoalARS) * 100)) 
      : 0;

    return {
      month: col,
      usedSlots,
      capacity,
      availableSlots,
      status,
      shortText,
      projectIds: overlapping.map(p => p.id),
      cobradoARS: cashProj.cobradoARS,
      cobradoUSD: cashProj.cobradoUSD,
      porCobrarARS: cashProj.porCobrarARS,
      porCobrarUSD: cashProj.porCobrarUSD,
      retainersARS: cashProj.retainersARS,
      retainersUSD: cashProj.retainersUSD,
      totalEstimadoARS: cashProj.totalMesARS,
      totalEstimadoUSD: cashProj.totalMesUSD,
      leadsPonderadoARS: cashProj.leadsPonderadoARS,
      leadsTotalARS: cashProj.leadsTotalARS,
      targetGoalARS,
      targetProgressPercent,
      cashProjection: cashProj,
    };
  });
}

/**
 * Calcula el reparto de frentes (por monto y por cantidad)
 */
export function calculateFrentesWeight(
  projects: DerivedHorizonProject[],
  includeLeads: boolean
): HorizonFrenteWeight[] {
  const activeProjects = projects.filter(p => {
    if (p.estado === 'finalizado') return false;
    if (!includeLeads && p.estado === 'por entrar') return false;
    return true;
  });

  const totals = {
    PAF: { count: 0, amountARS: 0, amountUSD: 0 },
    Webs: { count: 0, amountARS: 0, amountUSD: 0 },
    Otros: { count: 0, amountARS: 0, amountUSD: 0 },
  };

  activeProjects.forEach(p => {
    totals[p.frente].count += 1;
    totals[p.frente].amountARS += p.montoEnARS;
    totals[p.frente].amountUSD += p.montoEnUSD;
  });

  const totalCount = activeProjects.length;
  const totalAmountARS = activeProjects.reduce((sum, p) => sum + p.montoEnARS, 0);

  const configs: Record<HorizonFrente, { colorClass: string; borderClass: string; bgLightClass: string; dotColor: string }> = {
    PAF: {
      colorClass: 'bg-emerald-500 text-white',
      borderClass: 'border-emerald-500/40',
      bgLightClass: 'bg-emerald-500/15 text-emerald-400',
      dotColor: 'bg-emerald-400',
    },
    Webs: {
      colorClass: 'bg-sky-500 text-white',
      borderClass: 'border-sky-500/40',
      bgLightClass: 'bg-sky-500/15 text-sky-400',
      dotColor: 'bg-sky-400',
    },
    Otros: {
      colorClass: 'bg-violet-500 text-white',
      borderClass: 'border-violet-500/40',
      bgLightClass: 'bg-violet-500/15 text-violet-400',
      dotColor: 'bg-violet-400',
    },
  };

  return (['PAF', 'Webs', 'Otros'] as HorizonFrente[]).map(frente => {
    const data = totals[frente];
    const countPercent = totalCount > 0 ? Math.round((data.count / totalCount) * 100) : 0;
    const amountPercent = totalAmountARS > 0 ? Math.round((data.amountARS / totalAmountARS) * 100) : 0;
    const cfg = configs[frente];

    return {
      frente,
      count: data.count,
      countPercent,
      amountARS: data.amountARS,
      amountUSD: data.amountUSD,
      amountPercent,
      ...cfg,
    };
  });
}

/**
 * Calcula posición y ancho de una barra en el Gantt según el rango visible
 */
export function calculateBarPosition(
  inicioStr: string,
  finStr: string,
  timelineStart: string,
  timelineEnd: string
): { leftPercent: number; widthPercent: number; isVisible: boolean } {
  const dStart = new Date(`${timelineStart}T00:00:00`).getTime();
  const dEnd = new Date(`${timelineEnd}T23:59:59`).getTime();
  const totalDuration = dEnd - dStart;

  if (totalDuration <= 0) return { leftPercent: 0, widthPercent: 0, isVisible: false };

  const pStart = new Date(`${inicioStr}T00:00:00`).getTime();
  const pFin = new Date(`${finStr}T23:59:59`).getTime();

  if (pFin < dStart || pStart > dEnd) {
    return { leftPercent: 0, widthPercent: 0, isVisible: false };
  }

  const clampedStart = Math.max(dStart, pStart);
  const clampedEnd = Math.min(dEnd, pFin);

  const left = ((clampedStart - dStart) / totalDuration) * 100;
  const width = Math.max(2, ((clampedEnd - clampedStart) / totalDuration) * 100);

  return {
    leftPercent: Math.max(0, Math.min(98, left)),
    widthPercent: Math.max(2, Math.min(100 - left, width)),
    isVisible: true,
  };
}

/**
 * Calcula la posición de la línea "Hoy" en el eje del Gantt
 */
export function calculateTodayPosition(
  timelineStart: string,
  timelineEnd: string
): number | null {
  const todayStr = getTodayString();
  const dStart = new Date(`${timelineStart}T00:00:00`).getTime();
  const dEnd = new Date(`${timelineEnd}T23:59:59`).getTime();
  const dToday = new Date(`${todayStr}T12:00:00`).getTime();

  if (dToday < dStart || dToday > dEnd) return null;
  const total = dEnd - dStart;
  if (total <= 0) return null;

  return Math.max(0, Math.min(100, ((dToday - dStart) / total) * 100));
}

/**
 * Genera la frase resumen ejecutiva superior
 */
export function generateHorizonSummarySentence(
  projects: DerivedHorizonProject[],
  occupancies: HorizonMonthOccupancy[],
  months: HorizonMonthColumn[],
  privacyMode: boolean = false
): string {
  const visibleProjects = projects.filter(p => p.hasDates && p.estado !== 'finalizado');
  const count = visibleProjects.length;

  if (count === 0 && projects.length === 0) {
    return 'Sin proyectos registrados en el horizonte.';
  }

  const currentMonthOccupancy = occupancies.find(o => o.month.isCurrent) || occupancies[0];
  const endMonth = months[months.length - 1]?.shortLabel.toLowerCase() || 'fin de período';

  // Monto del mes en curso confirmado
  let currentMonthStr = '';
  if (currentMonthOccupancy) {
    if (privacyMode) {
      currentMonthStr = `$•••••• confirmados este mes`;
    } else {
      currentMonthStr = `$${Math.round(currentMonthOccupancy.totalEstimadoARS).toLocaleString('es-AR')} confirmados este mes`;
    }
  }

  let fullMonth: HorizonMonthOccupancy | null = null;
  let freeMonth: HorizonMonthOccupancy | null = null;

  for (const occ of occupancies) {
    if (occ.availableSlots <= 0 && !fullMonth) {
      fullMonth = occ;
    }
    if (occ.availableSlots > 0 && (!freeMonth || occ.availableSlots > freeMonth.availableSlots)) {
      freeMonth = occ;
    }
  }

  let ocupacionStr = '';
  if (fullMonth && freeMonth) {
    const freeCount = freeMonth.availableSlots;
    const placesText = freeCount === 1 ? '1 lugar libre' : `${freeCount} lugares libres`;
    ocupacionStr = `${fullMonth.month.shortLabel.toLowerCase()} completo, ${freeMonth.month.shortLabel.toLowerCase()} con ${placesText}`;
  } else if (fullMonth) {
    ocupacionStr = `${fullMonth.month.shortLabel.toLowerCase()} al máximo de cupos`;
  } else if (freeMonth) {
    const freeCount = freeMonth.availableSlots;
    const placesText = freeCount === 1 ? '1 lugar libre' : `${freeCount} lugares libres`;
    ocupacionStr = `capacidad disponible (${freeMonth.month.shortLabel.toLowerCase()} con ${placesText})`;
  } else {
    ocupacionStr = 'calendario libre';
  }

  const countText = count === 1 ? '1 proyecto con fechas' : `${count} proyectos con fechas`;
  return `${countText} hasta ${endMonth} · ${currentMonthStr} · ${ocupacionStr}`;
}
