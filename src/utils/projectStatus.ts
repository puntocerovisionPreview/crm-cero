import React from 'react';
import { Project, AgendaTask } from '../types';
import { getTodayString } from './storage';
import { 
  CircleDashed, 
  PlayCircle, 
  Clock, 
  AlertTriangle, 
  CheckCircle2 
} from 'lucide-react';

export type ProjectVisualStatus =
  | 'not_started'       // No iniciado / lead frío
  | 'in_progress'       // En curso / activo
  | 'waiting_client'    // Esperando al cliente (bloqueado)
  | 'overdue_payment'   // Cuota vencida / pago atrasado
  | 'completed';        // Completado / cerrado

export interface VisualStatusConfig {
  id: ProjectVisualStatus;
  label: string;
  description: string;
  dotColor: string;
  badgeClass: string;
  cardClass: string;
  borderAccent: string;
  textColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const VISUAL_STATUS_CONFIGS: Record<ProjectVisualStatus, VisualStatusConfig> = {
  not_started: {
    id: 'not_started',
    label: 'No iniciado / Lead frío',
    description: 'Cliente cargado pero sin actividad real todavía',
    dotColor: 'bg-zinc-600',
    badgeClass: 'bg-zinc-800 text-zinc-400 border border-zinc-700/60',
    cardClass: 'bg-zinc-950/40 border-l-4 border-l-zinc-700 border-zinc-800/60 text-zinc-400 opacity-65 hover:opacity-100 transition-opacity',
    borderAccent: 'border-l-zinc-700',
    textColor: 'text-zinc-500',
    icon: CircleDashed,
  },
  in_progress: {
    id: 'in_progress',
    label: 'En curso / Activo',
    description: 'Actividad normal, sin alertas ni bloqueos',
    dotColor: 'bg-[var(--accent)]',
    badgeClass: 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 font-semibold',
    cardClass: 'bg-zinc-900/80 border-l-4 border-l-[var(--accent)] border-zinc-800 shadow-sm',
    borderAccent: 'border-l-[var(--accent)]',
    textColor: 'text-[var(--accent)]',
    icon: PlayCircle,
  },
  waiting_client: {
    id: 'waiting_client',
    label: 'Esperando al cliente',
    description: 'Bloqueado o pendiente de respuesta/contenido del cliente',
    dotColor: 'bg-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30 border-dashed font-semibold',
    cardClass: 'bg-amber-950/10 border-l-4 border-l-amber-400 border-zinc-800/90 shadow-xs border-dashed',
    borderAccent: 'border-l-amber-400',
    textColor: 'text-amber-400',
    icon: Clock,
  },
  overdue_payment: {
    id: 'overdue_payment',
    label: 'Cuota vencida / Atrasado',
    description: 'Tiene pagos o cuotas pendientes con fecha pasada',
    dotColor: 'bg-red-500 animate-pulse',
    badgeClass: 'bg-red-500/20 text-red-400 border border-red-500/40 font-bold',
    cardClass: 'bg-red-950/20 border-l-4 border-l-red-500 border-red-500/30 shadow-lg shadow-red-950/20',
    borderAccent: 'border-l-red-500',
    textColor: 'text-red-400',
    icon: AlertTriangle,
  },
  completed: {
    id: 'completed',
    label: 'Completado / Graduado',
    description: 'Proyecto cerrado o arquitecto graduado con éxito',
    dotColor: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium',
    cardClass: 'bg-zinc-900/50 border-l-4 border-l-emerald-500 border-zinc-800/80 opacity-80 hover:opacity-100',
    borderAccent: 'border-l-emerald-500',
    textColor: 'text-emerald-400',
    icon: CheckCircle2,
  },
};

/**
 * Calculates project visual status automatically based on business rules:
 * 1. statusOverride (if manually set by user)
 * 2. completed (archived, status === 'Entregado', or pafStage === 'Graduados')
 * 3. overdue_payment (any unpaid installment with dueDate < today)
 * 4. waiting_client (status 'Esperando contenido' | 'Pausado' | 'En revisión' or pending tasks indicating waiting)
 * 5. not_started (isLead, status 'Posible proyecto' | 'Propuesta enviada', or zero tasks/hours/installments done)
 * 6. in_progress (default)
 */
export function getProjectVisualStatus(
  project: Project,
  projectTasks: AgendaTask[] = []
): ProjectVisualStatus {
  // 1. Manual override check
  if (project.statusOverride && VISUAL_STATUS_CONFIGS[project.statusOverride]) {
    return project.statusOverride;
  }

  // 2. Completed / Graduated / Archived
  if (
    project.archived ||
    project.status === 'Entregado' ||
    project.status === 'Graduados' ||
    project.pafStage === 'Graduados'
  ) {
    return 'completed';
  }

  const todayStr = getTodayString();

  // 3. Overdue payment check
  // Check new installments array
  if (project.installments && project.installments.length > 0) {
    const hasOverdue = project.installments.some(
      inst => !inst.paid && inst.dueDate && inst.dueDate < todayStr
    );
    if (hasOverdue) return 'overdue_payment';
  }

  // Check legacy pafInstallmentDates array
  if (project.pafInstallmentDates && project.pafInstallmentDates.length > 0) {
    const hasOverdue = project.pafInstallmentDates.some(
      inst => !inst.paid && inst.dueDate && inst.dueDate < todayStr
    );
    if (hasOverdue) return 'overdue_payment';
  }

  // 4. Waiting on client / Blocked
  const waitingStatuses = ['Esperando contenido', 'Pausado', 'En revisión'];
  if (waitingStatuses.includes(project.status)) {
    return 'waiting_client';
  }

  // Check if any pending task title mentions "esperando" or "cliente"
  const hasWaitingTask = projectTasks.some(
    t =>
      !t.completed &&
      (t.title.toLowerCase().includes('esperando') ||
        t.title.toLowerCase().includes('contenido del cliente') ||
        t.title.toLowerCase().includes('bloqueado'))
  );
  if (hasWaitingTask) {
    return 'waiting_client';
  }

  // 5. Not started / Cold Lead
  if (
    project.isLead ||
    project.status === 'Posible proyecto' ||
    project.status === 'Propuesta enviada'
  ) {
    return 'not_started';
  }

  // If no tasks completed, no hours done, and no milestones completed
  const hasDoneTasks = projectTasks.some(t => t.completed);
  const hasDoneHours = Boolean(
    project.pafConsultingHoursDone && project.pafConsultingHoursDone > 0
  );
  const hasDoneMilestones = Boolean(
    project.pafMilestones && project.pafMilestones.some(m => m.completed)
  );
  const hasPaidInstallments = Boolean(
    project.installments && project.installments.some(i => i.paid)
  );

  if (!hasDoneTasks && !hasDoneHours && !hasDoneMilestones && !hasPaidInstallments) {
    return 'not_started';
  }

  // 6. Default in progress
  return 'in_progress';
}

/**
 * Returns complete styling configuration for a project
 */
export function getProjectStatusConfig(
  project: Project,
  projectTasks: AgendaTask[] = []
): VisualStatusConfig {
  const status = getProjectVisualStatus(project, projectTasks);
  const config = { ...VISUAL_STATUS_CONFIGS[status] };

  // Adjust in_progress color for Web projects vs PAF
  if (status === 'in_progress' && project.projectType === 'web') {
    config.dotColor = 'bg-blue-500';
    config.badgeClass = 'bg-blue-500/15 text-blue-400 border border-blue-500/30 font-semibold';
    config.cardClass = 'bg-zinc-900/80 border-l-4 border-l-blue-500 border-zinc-800 shadow-sm';
    config.borderAccent = 'border-l-blue-500';
    config.textColor = 'text-blue-400';
  }

  return config;
}
