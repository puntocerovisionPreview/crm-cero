import { Project } from '../types';
import { parseDate, formatDate, getTodayString } from './storage';

export const SPANISH_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const SPANISH_MONTHS_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

/**
 * Add specified months to a YYYY-MM-DD date string safely.
 */
export function addMonths(dateStr: string, months: number): string {
  if (!dateStr || !dateStr.includes('-')) return getTodayString();
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1 + months, day);
  
  // Handle edge cases like Jan 31 + 1 month -> Feb 28/29
  const expectedMonth = (month - 1 + months) % 12;
  const normalizedExpectedMonth = expectedMonth < 0 ? expectedMonth + 12 : expectedMonth;
  if (d.getMonth() !== normalizedExpectedMonth) {
    d.setDate(0); // clamp to last day of target month
  }
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

/**
 * Calculate difference in days between two YYYY-MM-DD dates (d2 - d1).
 */
export function diffDays(d1Str: string, d2Str: string): number {
  const d1 = parseDate(d1Str);
  const d2 = parseDate(d2Str);
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format a YYYY-MM-DD date for display (e.g. "15/10/2026" or "15 Oct 2026").
 */
export function formatDisplayDate(dateStr?: string, style: 'short' | 'medium' | 'monthOnly' = 'short'): string {
  if (!dateStr || !dateStr.includes('-')) return 'Sin definir';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;

  const monthIdx = m - 1;
  if (style === 'monthOnly') {
    return `${SPANISH_MONTHS[monthIdx]} ${y}`;
  }
  if (style === 'medium') {
    return `${d} de ${SPANISH_MONTHS[monthIdx]} ${y}`;
  }
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/**
 * Check if a project is PAF (Mentoría / Consultoría de 3 meses / 12 semanas).
 */
export function isPafProject(project: Partial<Project>): boolean {
  return (
    project.projectType === 'paf_pro' ||
    project.projectType === 'paf_base' ||
    Boolean(project.pafStage) ||
    (Boolean(project.pafMilestones) && project.pafMilestones!.length > 0) ||
    Boolean(project.pafConsultingHoursTotal) ||
    Boolean(project.clientName && project.clientName.toLowerCase().includes('paf'))
  );
}

/**
 * Get normalized start and delivery/end dates for a project.
 * For PAF, defaults deliveryDate to start date + 3 months if not set explicitly.
 */
export function getEffectiveDates(project: Partial<Project>): {
  startDate: string;
  deliveryDate?: string;
  isAutoPafDeadline: boolean;
} {
  const fallback = project.createdAt ? project.createdAt.slice(0, 10) : getTodayString();
  const startDate = project.startDate || project.pafStartDate || fallback;
  const isPaf = isPafProject(project);

  let deliveryDate = project.deliveryDate;
  let isAutoPafDeadline = false;

  if (!deliveryDate && isPaf) {
    deliveryDate = addMonths(startDate, 3);
    isAutoPafDeadline = true;
  }

  return { startDate, deliveryDate, isAutoPafDeadline };
}

export interface ProjectTimelineInfo {
  startDate: string;
  deliveryDate?: string;
  isPaf: boolean;
  isUpcoming: boolean;
  isInProgress: boolean;
  isCompleted: boolean;
  isOverdue: boolean;
  daysUntilStart: number;
  daysElapsed: number;
  weeksElapsed: number;
  currentMonthNumber: number;
  totalMonthsExpected?: number;
  daysRemaining?: number;
  totalDaysExpected?: number;
  progressPercent: number; // 0 to 100
  monthLabel: string; // e.g. "Mes 1 de 3", "Arranca en Octubre", "Mes 2 de 2"
  statusBadgeText: string;
  statusBadgeSubtext: string;
  themeColor: 'purple' | 'amber' | 'blue' | 'emerald' | 'rose' | 'zinc';
}

/**
 * Main engine to calculate timeline, month counting, progress and countdowns.
 * Specifically honors:
 * - Start date defined by user (even future months like October)
 * - Automatic 3-month cycle for PAF
 * - User-defined deadline for Web
 */
export function calculateProjectTimeline(
  project: Partial<Project>,
  referenceDateStr?: string
): ProjectTimelineInfo {
  const today = referenceDateStr || getTodayString();
  const isPaf = isPafProject(project);
  const { startDate, deliveryDate } = getEffectiveDates(project);

  const isCompleted =
    project.status === 'Entregado' ||
    project.pafStage === 'Completado / Graduado';

  const daysDiffStart = diffDays(today, startDate); // > 0 means start is in the future
  const isUpcoming = daysDiffStart > 0 && !isCompleted;
  const daysUntilStart = Math.max(0, daysDiffStart);

  const daysElapsed = isUpcoming ? 0 : Math.max(0, diffDays(startDate, today));
  const weeksElapsed = Math.max(1, Math.floor(daysElapsed / 7) + 1);

  // Month calculation
  let totalMonthsExpected: number | undefined;
  let currentMonthNumber = 1;
  let totalDaysExpected: number | undefined;
  let daysRemaining: number | undefined;
  let isOverdue = false;
  let progressPercent = 0;
  let monthLabel = '';
  let statusBadgeText = '';
  let statusBadgeSubtext = '';
  let themeColor: 'purple' | 'amber' | 'blue' | 'emerald' | 'rose' | 'zinc' = 'blue';

  if (isCompleted) {
    totalMonthsExpected = isPaf ? 3 : deliveryDate ? Math.max(1, Math.round(diffDays(startDate, deliveryDate) / 30)) : undefined;
    currentMonthNumber = totalMonthsExpected || 1;
    progressPercent = 100;
    monthLabel = isPaf ? 'Completado (3/3 Meses)' : 'Entregado / Finalizado';
    statusBadgeText = isPaf ? 'Graduado · 3 Meses Completados' : 'Proyecto Entregado';
    statusBadgeSubtext = `Inició el ${formatDisplayDate(startDate)} · Finalizado`;
    themeColor = 'emerald';
  } else if (isUpcoming) {
    const startMonthIdx = Number(startDate.split('-')[1]) - 1;
    const startMonthName = SPANISH_MONTHS[startMonthIdx] || 'Próximamente';

    totalMonthsExpected = isPaf ? 3 : deliveryDate ? Math.max(1, Math.round(diffDays(startDate, deliveryDate) / 30)) : undefined;
    progressPercent = 0;
    monthLabel = `Arranca en ${startMonthName}`;
    statusBadgeText = `Arranca en ${daysUntilStart === 1 ? '1 día' : `${daysUntilStart} días`} (${startMonthName})`;
    
    if (isPaf) {
      const estimatedEnd = deliveryDate || addMonths(startDate, 3);
      statusBadgeSubtext = `Programa PAF · 3 meses (hasta ${formatDisplayDate(estimatedEnd)})`;
      themeColor = 'purple';
    } else if (deliveryDate) {
      statusBadgeSubtext = `Plazo estimado de ${totalMonthsExpected} mes(es) · Límite ${formatDisplayDate(deliveryDate)}`;
      themeColor = 'purple';
    } else {
      statusBadgeSubtext = `Confirmado para ${formatDisplayDate(startDate)}`;
      themeColor = 'purple';
    }
  } else {
    // ACTIVE / IN PROGRESS
    if (isPaf) {
      totalMonthsExpected = 3;
      totalDaysExpected = 90; // 3 months nominal
      daysRemaining = deliveryDate ? Math.max(0, diffDays(today, deliveryDate)) : Math.max(0, 90 - daysElapsed);
      isOverdue = deliveryDate ? diffDays(today, deliveryDate) < 0 : daysElapsed > 90;

      // Current month for PAF
      if (daysElapsed <= 30) {
        currentMonthNumber = 1;
      } else if (daysElapsed <= 60) {
        currentMonthNumber = 2;
      } else if (daysElapsed <= 90) {
        currentMonthNumber = 3;
      } else {
        currentMonthNumber = 3;
      }

      progressPercent = Math.min(100, Math.max(0, Math.round((daysElapsed / (totalDaysExpected || 90)) * 100)));
      monthLabel = isOverdue ? 'Mes 3 de 3 (+90 días)' : `Mes ${currentMonthNumber} de 3`;
      statusBadgeText = isOverdue
        ? 'Mes 3 cumplido · Cierre de mentoría'
        : `Mes ${currentMonthNumber} de 3 · Sem ${Math.min(12, weeksElapsed)}/12`;

      if (deliveryDate) {
        statusBadgeSubtext = isOverdue
          ? `Plazo finalizó el ${formatDisplayDate(deliveryDate)}`
          : `Finaliza el ${formatDisplayDate(deliveryDate)} (${daysRemaining} días restantes)`;
      } else {
        statusBadgeSubtext = `Ciclo de 3 meses (${daysRemaining} días restantes)`;
      }
      themeColor = isOverdue ? 'rose' : 'amber';
    } else {
      // WEB DEVELOPMENT OR OTHER
      if (deliveryDate) {
        totalDaysExpected = Math.max(1, diffDays(startDate, deliveryDate));
        totalMonthsExpected = Math.max(1, Math.round(totalDaysExpected / 30));
        daysRemaining = diffDays(today, deliveryDate);
        isOverdue = daysRemaining < 0;

        // Calculate which month we are currently in based on 30-day buckets
        const calculatedMonth = Math.floor(daysElapsed / 30) + 1;
        currentMonthNumber = Math.min(totalMonthsExpected, Math.max(1, calculatedMonth));

        progressPercent = Math.min(100, Math.max(0, Math.round((daysElapsed / totalDaysExpected) * 100)));
        monthLabel = isOverdue 
          ? `Mes ${currentMonthNumber} (Vencido)` 
          : `Mes ${currentMonthNumber} de ${totalMonthsExpected}`;

        if (isOverdue) {
          const daysLate = Math.abs(daysRemaining);
          statusBadgeText = `Plazo vencido hace ${daysLate} ${daysLate === 1 ? 'día' : 'días'}`;
          statusBadgeSubtext = `Límite era ${formatDisplayDate(deliveryDate)}`;
          themeColor = 'rose';
        } else {
          statusBadgeText = `Mes ${currentMonthNumber} de ${totalMonthsExpected} · Entrega ${formatDisplayDate(deliveryDate)}`;
          statusBadgeSubtext = `Quedan ${daysRemaining} días (${Math.ceil(daysRemaining / 7)} semanas)`;
          themeColor = 'blue';
        }
      } else {
        // Web without defined deadline
        const calculatedMonth = Math.floor(daysElapsed / 30) + 1;
        currentMonthNumber = calculatedMonth;
        progressPercent = Math.min(100, Math.round((daysElapsed % 30) / 30 * 100));
        monthLabel = `Mes ${currentMonthNumber} en curso`;
        statusBadgeText = `Mes ${currentMonthNumber} en curso (desde ${formatDisplayDate(startDate)})`;
        statusBadgeSubtext = 'Sin fecha límite asignada';
        themeColor = 'zinc';
      }
    }
  }

  return {
    startDate,
    deliveryDate,
    isPaf,
    isUpcoming,
    isInProgress: !isUpcoming && !isCompleted,
    isCompleted,
    isOverdue,
    daysUntilStart,
    daysElapsed,
    weeksElapsed,
    currentMonthNumber,
    totalMonthsExpected,
    daysRemaining,
    totalDaysExpected,
    progressPercent,
    monthLabel,
    statusBadgeText,
    statusBadgeSubtext,
    themeColor,
  };
}
