import { 
  WeeklyMission, 
  WeeklyGoal, 
  AgendaTask, 
  AgendaMeeting, 
  Project, 
  IncomeRecord, 
  DailyAllocation,
  MissionFrente,
  MissionTipo,
  MissionEstado,
  DiaSemana,
  MissionPaso,
  WeeklyReviewHistoryItem,
  MissionsConfig
} from '../types';
import { getWeekMonday, addDays, getTodayString } from './storage';
import { getReconciledCommitments } from './paymentPlans';

export type { MissionsConfig };

export const DIAS_SEMANA: { key: DiaSemana; label: string; short: string; dayIndex: number }[] = [
  { key: 'lunes', label: 'Lunes', short: 'Lun', dayIndex: 1 },
  { key: 'martes', label: 'Martes', short: 'Mar', dayIndex: 2 },
  { key: 'miercoles', label: 'Miércoles', short: 'Mié', dayIndex: 3 },
  { key: 'jueves', label: 'Jueves', short: 'Jue', dayIndex: 4 },
  { key: 'viernes', label: 'Viernes', short: 'Vie', dayIndex: 5 },
  { key: 'sabado', label: 'Sábado', short: 'Sáb', dayIndex: 6 },
  { key: 'domingo', label: 'Domingo', short: 'Dom', dayIndex: 0 },
];

export const FRENTE_CONFIG: Record<MissionFrente, {
  label: string;
  color: string; // Tailwind text
  bg: string; // Tailwind background
  border: string; // Tailwind border
  hex: string;
  ring: string;
}> = {
  PAF: {
    label: 'PAF',
    color: 'text-amber-500 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    hex: '#F59E0B',
    ring: 'ring-amber-500',
  },
  Webs: {
    label: 'Webs',
    color: 'text-sky-500 dark:text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    hex: '#0EA5E9',
    ring: 'ring-sky-500',
  },
  Contenido: {
    label: 'Contenido',
    color: 'text-purple-500 dark:text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    hex: '#A855F7',
    ring: 'ring-purple-500',
  },
  Comercial: {
    label: 'Comercial',
    color: 'text-emerald-500 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    hex: '#10B981',
    ring: 'ring-emerald-500',
  },
  Otros: {
    label: 'Otros',
    color: 'text-zinc-400 dark:text-zinc-300',
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/30',
    hex: '#71717A',
    ring: 'ring-zinc-400',
  },
};

export const MISSIONS_STORAGE_KEYS = {
  config: 'cero_missions_config',
  history: 'cero_missions_review_history',
};

export const DEFAULT_MISSIONS_CONFIG: MissionsConfig = {
  maxGrandes: 3,
  maxMantenimiento: 1,
  diaCierre: 'domingo',
};

export function getMissionsConfig(): MissionsConfig {
  if (typeof window === 'undefined') return DEFAULT_MISSIONS_CONFIG;
  try {
    const raw = localStorage.getItem(MISSIONS_STORAGE_KEYS.config);
    if (!raw) return DEFAULT_MISSIONS_CONFIG;
    return { ...DEFAULT_MISSIONS_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_MISSIONS_CONFIG;
  }
}

export function saveMissionsConfig(cfg: MissionsConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MISSIONS_STORAGE_KEYS.config, JSON.stringify(cfg));
  } catch {}
}

export function getWeeklyReviewHistory(): WeeklyReviewHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MISSIONS_STORAGE_KEYS.history);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveWeeklyReviewHistoryItem(item: WeeklyReviewHistoryItem): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getWeeklyReviewHistory();
    const existingIndex = history.findIndex(h => h.weekStart === item.weekStart);
    if (existingIndex >= 0) {
      history[existingIndex] = item;
    } else {
      history.unshift(item);
    }
    localStorage.setItem(MISSIONS_STORAGE_KEYS.history, JSON.stringify(history));
  } catch {}
}

/**
 * Convierte cualquier fecha YYYY-MM-DD al día de la semana correspondiente
 */
export function getDiaSemanaFromDate(dateStr: string): DiaSemana {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDay(); // 0 is Sunday, 1 is Monday...
    switch (day) {
      case 1: return 'lunes';
      case 2: return 'martes';
      case 3: return 'miercoles';
      case 4: return 'jueves';
      case 5: return 'viernes';
      case 6: return 'sabado';
      case 0: return 'domingo';
      default: return 'lunes';
    }
  } catch {
    return 'lunes';
  }
}

/**
 * Devuelve la fecha ISO YYYY-MM-DD para un día de la semana dado su weekStart (Lunes)
 */
export function getDateForDiaSemana(weekStart: string, dia: DiaSemana): string {
  const mapOffset: Record<DiaSemana, number> = {
    lunes: 0,
    martes: 1,
    miercoles: 2,
    jueves: 3,
    viernes: 4,
    sabado: 5,
    domingo: 6,
  };
  return addDays(weekStart, mapOffset[dia] ?? 0);
}

/**
 * Migra sin pérdida los WeeklyGoals históricos a WeeklyMissions
 */
export function migrateGoalsToMissions(goals: WeeklyGoal[]): WeeklyMission[] {
  const today = getTodayString();
  const currentWeek = getWeekMonday(today);

  return (goals || []).map((goal, index) => {
    // Si ya tiene los atributos de WeeklyMission, mantenerlos
    const existingMission = goal as WeeklyMission;
    if (existingMission.resultadoEsperado && existingMission.frente && existingMission.tipo && existingMission.pasos) {
      return {
        ...existingMission,
        orden: existingMission.orden ?? index,
        estado: existingMission.estado || (existingMission.completed ? 'terminada' : 'activa'),
        diasPlanificados: existingMission.diasPlanificados || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
      };
    }

    // Mapeo seguro de WeeklyGoal legacy
    let inferredFrente: MissionFrente = 'Otros';
    if (goal.category === 'produccion') inferredFrente = 'PAF';
    else if (goal.category === 'ventas') inferredFrente = 'Comercial';
    else if (goal.category === 'organizacion') inferredFrente = 'Otros';
    else if (goal.title.toLowerCase().includes('web')) inferredFrente = 'Webs';
    else if (goal.title.toLowerCase().includes('contenido') || goal.title.toLowerCase().includes('video')) inferredFrente = 'Contenido';

    const pasos: MissionPaso[] = goal.subtasks && goal.subtasks.length > 0
      ? goal.subtasks.map((s, i) => ({
          id: s.id || `paso-${i + 1}`,
          titulo: s.title,
          hecho: Boolean(s.completed),
        }))
      : [
          { id: 'p-1', titulo: 'Definir alcance y arranque', hecho: Boolean(goal.completed) },
          { id: 'p-2', titulo: 'Ejecutar entrega principal', hecho: Boolean(goal.completed) },
          { id: 'p-3', titulo: 'Cierre y validación', hecho: Boolean(goal.completed) },
        ];

    const presupuestoHoras = goal.unit === 'horas' && goal.targetValue ? Number(goal.targetValue) : 4;

    return {
      ...goal,
      weekStart: goal.weekStart || currentWeek,
      resultadoEsperado: goal.notes?.trim() || `Completar con éxito: ${goal.title}`,
      frente: inferredFrente,
      tipo: 'mision',
      presupuestoHoras,
      pasos,
      diasPlanificados: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
      estado: goal.completed ? 'terminada' : 'activa',
      orden: index,
    };
  });
}

/**
 * Calcula las horas reales imputadas a la misión:
 * - Tiempo real acumulado de Modo Foco (tiempoRealMin) en tareas vinculadas (task.missionId === mission.id)
 * - Horas de reuniones vinculadas al cliente o a la misión (meeting.durationHours o 1h por defecto)
 */
export function getMissionRealHours(
  mission: WeeklyMission,
  tasks: AgendaTask[],
  meetings: AgendaMeeting[],
  weekStart: string
): number {
  const weekSunday = addDays(weekStart, 6);
  let totalMinutos = 0;

  // 1. Tareas con missionId
  tasks.forEach(t => {
    if (t.missionId === mission.id) {
      if (t.tiempoRealMin && t.tiempoRealMin > 0) {
        totalMinutos += t.tiempoRealMin;
      } else if (t.completed && t.estimadoMin) {
        totalMinutos += t.estimadoMin;
      }
    }
  });

  let totalHoras = totalMinutos / 60;

  // 2. Reuniones de la semana vinculadas al cliente de la misión o directamente a la misión
  meetings.forEach(m => {
    const isThisWeek = m.date && m.date >= weekStart && m.date <= weekSunday;
    if (!isThisWeek) return;

    const matchesProject = mission.projectId && m.projectId === mission.projectId;
    const matchesDirectMission = m.missionId === mission.id;

    if (matchesProject || matchesDirectMission) {
      const dur = m.durationHours && m.durationHours > 0 ? m.durationHours : 1;
      totalHoras += dur;
    }
  });

  return Math.round(totalHoras * 10) / 10;
}

export interface MissionProgressResult {
  avancePct: number;
  pasosHechos: number;
  totalPasos: number;
  pasosPct: number;
  horasReales: number;
  presupuestoHoras: number;
  horasPct: number;
  labelProgreso: string;
}

/**
 * Regla de Oro: PROGRESO (calculado, no manual)
 * - Avance de la misión = promedio entre pasos hechos y horas reales / presupuestoHoras (tope 100%),
 *   mostrando ambos datos por separado además del porcentaje.
 * - Si no hay horas imputadas, el avance se basa solo en pasos.
 */
export function calculateMissionProgress(
  mission: WeeklyMission,
  tasks: AgendaTask[],
  meetings: AgendaMeeting[],
  weekStart: string
): MissionProgressResult {
  const totalPasos = mission.pasos?.length || 0;
  const pasosHechos = (mission.pasos || []).filter(p => p.hecho).length;
  const pasosPct = totalPasos > 0 ? Math.round((pasosHechos / totalPasos) * 100) : (mission.estado === 'terminada' ? 100 : 0);

  const horasReales = getMissionRealHours(mission, tasks, meetings, weekStart);
  const presupuestoHoras = mission.presupuestoHoras || 0;
  const horasPct = presupuestoHoras > 0 ? Math.min(100, Math.round((horasReales / presupuestoHoras) * 100)) : 0;

  let avancePct = 0;
  if (mission.estado === 'terminada') {
    avancePct = 100;
  } else if (horasReales <= 0 || presupuestoHoras <= 0) {
    avancePct = pasosPct;
  } else if (totalPasos <= 0) {
    avancePct = horasPct;
  } else {
    avancePct = Math.min(100, Math.round((pasosPct + horasPct) / 2));
  }

  // Label amigable con ambos datos por separado
  const pasosPart = totalPasos > 0 ? `${pasosHechos}/${totalPasos} pasos (${pasosPct}%)` : '';
  const horasPart = presupuestoHoras > 0 ? `${horasReales.toFixed(1)}h / ${presupuestoHoras}h (${horasPct}%)` : (horasReales > 0 ? `${horasReales.toFixed(1)}h` : '');
  const labelProgreso = [pasosPart, horasPart].filter(Boolean).join(' · ');

  return {
    avancePct,
    pasosHechos,
    totalPasos,
    pasosPct,
    horasReales,
    presupuestoHoras,
    horasPct,
    labelProgreso,
  };
}

export interface WeekRitmoResult {
  deberiaIrEnPct: number;
  avanceRealPct: number;
  diasTranscurridos: number;
  totalDiasPlanificados: number;
  estado: 'adelantada' | 'al_dia' | 'demorada' | 'terminada';
  mensaje: string;
  isAlert: boolean;
}

/**
 * Calcula el ritmo semanal: "Debería ir en X% y voy en Y%"
 * X = proporción de días transcurridos vs total de días planificados
 * Y = avance real de la misión
 * Alerta visual si está demorada
 */
export function calculateWeekRitmo(
  mission: WeeklyMission,
  progress: MissionProgressResult,
  todayStr: string,
  weekStart: string
): WeekRitmoResult {
  if (mission.estado === 'terminada' || progress.avancePct >= 100) {
    return {
      deberiaIrEnPct: 100,
      avanceRealPct: 100,
      diasTranscurridos: mission.diasPlanificados?.length || 5,
      totalDiasPlanificados: mission.diasPlanificados?.length || 5,
      estado: 'terminada',
      mensaje: 'Misión cumplida',
      isAlert: false,
    };
  }

  const planned = mission.diasPlanificados && mission.diasPlanificados.length > 0 
    ? mission.diasPlanificados 
    : (['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] as DiaSemana[]);

  const totalDias = planned.length;
  let diasTranscurridos = 0;

  planned.forEach(d => {
    const dayDate = getDateForDiaSemana(weekStart, d);
    if (dayDate <= todayStr) {
      diasTranscurridos += 1;
    }
  });

  const deberiaIrEnPct = totalDias > 0 ? Math.min(100, Math.round((diasTranscurridos / totalDias) * 100)) : 0;
  const avanceRealPct = progress.avancePct;

  let estado: 'adelantada' | 'al_dia' | 'demorada' | 'terminada' = 'al_dia';
  let isAlert = false;

  // Si hoy es anterior al primer día planificado
  if (diasTranscurridos === 0) {
    return {
      deberiaIrEnPct: 0,
      avanceRealPct,
      diasTranscurridos: 0,
      totalDiasPlanificados: totalDias,
      estado: 'al_dia',
      mensaje: `Planificada para ${totalDias} días`,
      isAlert: false,
    };
  }

  if (avanceRealPct >= deberiaIrEnPct + 10) {
    estado = 'adelantada';
  } else if (avanceRealPct < deberiaIrEnPct - 15) {
    estado = 'demorada';
    isAlert = true;
  }

  const mensaje = `Debería ir en ${deberiaIrEnPct}% · va en ${avanceRealPct}%`;

  return {
    deberiaIrEnPct,
    avanceRealPct,
    diasTranscurridos,
    totalDiasPlanificados: totalDias,
    estado,
    mensaje,
    isAlert,
  };
}

/**
 * Genera automáticamente misiones de tipo 'cobro' para cuotas reales que vencen en la semana
 * Usando la MISMA fuente de verdad de Finanzas y sin recalcular montos con otra fórmula.
 * Las misiones de 'cobro' automáticas son editables, descartables y NO cuentan contra el tope 3+1.
 */
export function generateAutoCobroMissions(
  weekStart: string,
  projects: Project[],
  existingMissions: WeeklyMission[]
): WeeklyMission[] {
  const weekSunday = addDays(weekStart, 6);
  const newCobros: WeeklyMission[] = [];

  projects.forEach(proj => {
    if (proj.archived) return;

    // A. Cuotas de billingAgreement
    if (proj.billingAgreement?.installments) {
      proj.billingAgreement.installments.forEach(inst => {
        if (inst.dueDate && inst.dueDate >= weekStart && inst.dueDate <= weekSunday) {
          const expected = Number(inst.expectedAmount || 0);
          const paid = Number(inst.actualPaidAmount || 0);
          const pending = Math.max(0, expected - paid);
          const isPaid = inst.status === 'pagado_a_tiempo' || inst.status === 'pagado_tarde';

          if (pending > 0 && !isPaid) {
            // Verificar si ya existe una misión vinculada a esta cuota
            const alreadyExists = existingMissions.some(m => 
              m.cobroInstallmentId === inst.id || 
              (m.tipo === 'cobro' && m.weekStart === weekStart && m.projectId === proj.id && m.title.includes(String(inst.number || '')))
            );

            if (!alreadyExists) {
              const diaVencimiento = getDiaSemanaFromDate(inst.dueDate);
              newCobros.push({
                id: `auto-cobro-${proj.id}-${inst.id}`,
                title: `Cobro: ${proj.clientName} (Cuota ${inst.number || 1})`,
                weekStart,
                resultadoEsperado: `Cobro verificado de ${inst.currency === 'USD' ? 'USD $' : '$'}${pending.toLocaleString('es-AR')} y recibo emitido`,
                frente: 'Comercial',
                projectId: proj.id,
                tipo: 'cobro',
                presupuestoHoras: 0.5,
                pasos: [
                  { id: 'paso-c1', titulo: 'Verificar acreditación en banco / pasarela', hecho: false },
                  { id: 'paso-c2', titulo: 'Registrar cobro en Finanzas y emitir recibo', hecho: false },
                ],
                diasPlanificados: [diaVencimiento],
                estado: 'activa',
                orden: 99,
                completed: false,
                createdAt: new Date().toISOString(),
                isAutoCobro: true,
                cobroInstallmentId: inst.id,
                cobroAmount: pending,
                cobroCurrency: inst.currency || 'ARS',
              });
            }
          }
        }
      });
    }

    // B. Compromisos de pago directo
    if (proj.paymentCommitments) {
      getReconciledCommitments(proj).forEach(comm => {
        if (comm.dueDate && comm.dueDate >= weekStart && comm.dueDate <= weekSunday && !comm.paid && comm.status !== 'cobrado') {
          const expected = Number(comm.amount || 0);
          const alreadyExists = existingMissions.some(m => 
            m.cobroInstallmentId === comm.id ||
            (m.tipo === 'cobro' && m.weekStart === weekStart && m.projectId === proj.id)
          );

          if (!alreadyExists) {
            const diaVencimiento = getDiaSemanaFromDate(comm.dueDate);
            newCobros.push({
              id: `auto-cobro-${proj.id}-${comm.id}`,
              title: `Cobro: ${proj.clientName} (${comm.title || 'Compromiso'})`,
              weekStart,
              resultadoEsperado: `Acreditación confirmada de ${comm.currency === 'USD' ? 'USD $' : '$'}${expected.toLocaleString('es-AR')}`,
              frente: 'Comercial',
              projectId: proj.id,
              tipo: 'cobro',
              presupuestoHoras: 0.5,
              pasos: [
                { id: 'paso-c1', titulo: 'Verificar acreditación bancaria', hecho: false },
                { id: 'paso-c2', titulo: 'Enviar constancia al cliente', hecho: false },
              ],
              diasPlanificados: [diaVencimiento],
              estado: 'activa',
              orden: 99,
              completed: false,
              createdAt: new Date().toISOString(),
              isAutoCobro: true,
              cobroInstallmentId: comm.id,
              cobroAmount: expected,
              cobroCurrency: comm.currency || 'ARS',
            });
          }
        }
      });
    }
  });

  return newCobros;
}

/**
 * Obtiene proyectos activos del mes para sugerir al armar la semana
 */
export function getSuggestedHorizonProjects(
  projects: Project[],
  weekStart: string,
  existingMissions: WeeklyMission[]
): Project[] {
  const currentLinkedProjectIds = new Set(
    existingMissions
      .filter(m => m.weekStart === weekStart && m.projectId)
      .map(m => m.projectId!)
  );

  return projects.filter(p => {
    if (p.archived) return false;
    if (p.status === 'completado' || p.status === 'cancelado' || p.status === 'pausado') return false;
    if (currentLinkedProjectIds.has(p.id)) return false;
    return true;
  }).slice(0, 5); // Sugerir top 5
}

/**
 * Calcula la capacidad en horas de la semana sumando los DailyAllocation de los 7 días
 * (o 6h/día por defecto para los 5 días hábiles = 30h)
 */
export function getWeekCapacityHours(
  weekStart: string,
  dailyAllocations: DailyAllocation[] = []
): number {
  let totalHours = 0;
  const daysInWeek = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(weekStart, i));

  daysInWeek.forEach(dateStr => {
    const alloc = dailyAllocations.find(a => a.date === dateStr || a.id === dateStr);
    if (alloc && alloc.targetHours && alloc.targetHours > 0) {
      totalHours += alloc.targetHours;
    } else {
      // Si es lunes a viernes: 6 horas base; fin de semana 0h base
      const dayOfWeek = getDiaSemanaFromDate(dateStr);
      if (dayOfWeek !== 'sabado' && dayOfWeek !== 'domingo') {
        totalHours += 6;
      }
    }
  });

  return totalHours;
}

/**
 * Valida si se puede agregar una nueva misión según los topes:
 * Máximo 3 misiones grandes + 1 de mantenimiento (las de cobro no cuentan)
 */
export function checkMissionLimit(
  weekStart: string,
  tipo: MissionTipo,
  existingMissions: WeeklyMission[],
  config: MissionsConfig = DEFAULT_MISSIONS_CONFIG
): { allowed: boolean; currentCount: number; maxLimit: number; reason?: string } {
  if (tipo === 'cobro') {
    return { allowed: true, currentCount: 0, maxLimit: 999 };
  }

  const weekMissions = existingMissions.filter(m => 
    m.weekStart === weekStart && 
    m.estado !== 'descartada' && 
    m.estado !== 'arrastrada'
  );

  if (tipo === 'mision') {
    const grandesCount = weekMissions.filter(m => m.tipo === 'mision').length;
    if (grandesCount >= config.maxGrandes) {
      return {
        allowed: false,
        currentCount: grandesCount,
        maxLimit: config.maxGrandes,
        reason: `Ya tenés ${grandesCount} misiones grandes esta semana (tope: ${config.maxGrandes}). Sugerencia: arrastrá o descartá una antes de agregar otra.`,
      };
    }
    return { allowed: true, currentCount: grandesCount, maxLimit: config.maxGrandes };
  }

  if (tipo === 'mantenimiento') {
    const mantenimientosCount = weekMissions.filter(m => m.tipo === 'mantenimiento').length;
    if (mantenimientosCount >= config.maxMantenimiento) {
      return {
        allowed: false,
        currentCount: mantenimientosCount,
        maxLimit: config.maxMantenimiento,
        reason: `Ya alcanzaste el tope de ${config.maxMantenimiento} misión de mantenimiento para esta semana.`,
      };
    }
    return { allowed: true, currentCount: mantenimientosCount, maxLimit: config.maxMantenimiento };
  }

  return { allowed: true, currentCount: 0, maxLimit: 999 };
}
