import React from 'react';
import { AgendaTask } from '../types';
import { CheckCircle2, AlertTriangle, Clock, CircleDot, Check } from 'lucide-react';
import { getTodayString } from '../utils/storage';

interface ProjectHealthBadgeProps {
  tasks: AgendaTask[];
  compact?: boolean;
  showBar?: boolean;
  deliveryDate?: string;
  className?: string;
}

export type HealthStatus = 'completado' | 'saludable' | 'progreso' | 'atrasado' | 'sin_tareas';

export function calculateProjectHealth(tasks: AgendaTask[], deliveryDate?: string): {
  status: HealthStatus;
  percentage: number;
  completedCount: number;
  pendingCount: number;
  totalCount: number;
  overdueCount: number;
  label: string;
  colorClass: string;
  barColor: string;
  dotColor: string;
} {
  const today = getTodayString();
  const totalCount = tasks.length;
  const completedCount = tasks.filter(t => t.completed).length;
  const pendingCount = totalCount - completedCount;
  
  // Tasks that are pending and their date is in the past
  const overdueCount = tasks.filter(t => !t.completed && t.date && t.date < today).length;

  if (totalCount === 0) {
    return {
      status: 'sin_tareas',
      percentage: 0,
      completedCount: 0,
      pendingCount: 0,
      totalCount: 0,
      overdueCount: 0,
      label: 'Sin tareas',
      colorClass: 'bg-zinc-800 text-zinc-400 border-zinc-700/60',
      barColor: 'bg-zinc-700',
      dotColor: 'bg-zinc-500',
    };
  }

  const percentage = Math.round((completedCount / totalCount) * 100);

  if (completedCount === totalCount) {
    return {
      status: 'completado',
      percentage: 100,
      completedCount,
      pendingCount,
      totalCount,
      overdueCount,
      label: '100% Completado',
      colorClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold',
      barColor: 'bg-emerald-500',
      dotColor: 'bg-emerald-400',
    };
  }

  // If there are overdue tasks or delivery date passed with pending tasks
  if (overdueCount > 0 || (deliveryDate && deliveryDate < today && pendingCount > 0)) {
    return {
      status: 'atrasado',
      percentage,
      completedCount,
      pendingCount,
      totalCount,
      overdueCount,
      label: overdueCount > 0 ? `${overdueCount} atrasada${overdueCount > 1 ? 's' : ''}` : 'Entrega vencida',
      colorClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-bold animate-pulse',
      barColor: 'bg-rose-500',
      dotColor: 'bg-rose-500',
    };
  }

  if (percentage >= 60) {
    return {
      status: 'saludable',
      percentage,
      completedCount,
      pendingCount,
      totalCount,
      overdueCount: 0,
      label: 'Saludable',
      colorClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30 font-medium',
      barColor: 'bg-sky-500',
      dotColor: 'bg-sky-400',
    };
  }

  return {
    status: 'progreso',
    percentage,
    completedCount,
    pendingCount,
    totalCount,
    overdueCount: 0,
    label: 'En progreso',
    colorClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-medium',
    barColor: 'bg-amber-500',
    dotColor: 'bg-amber-400',
  };
}

export const ProjectHealthBadge: React.FC<ProjectHealthBadgeProps> = ({
  tasks,
  compact = false,
  showBar = true,
  deliveryDate,
  className = '',
}) => {
  const health = calculateProjectHealth(tasks, deliveryDate);

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border ${health.colorClass} ${className}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${health.dotColor}`} />
        <span>{health.label}</span>
        {health.totalCount > 0 && (
          <span className="font-mono opacity-75 font-normal">
            ({health.completedCount}/{health.totalCount})
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${health.dotColor}`} />
          <span className="font-semibold text-zinc-200 truncate">
            Salud: <span className="font-normal text-zinc-300">{health.label}</span>
          </span>
        </div>
        <div className="font-mono text-[11px] text-zinc-400 font-bold shrink-0">
          {health.completedCount}/{health.totalCount} ({health.percentage}%)
        </div>
      </div>

      {showBar && (
        <div className="w-full h-1.5 bg-zinc-800/90 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300 ${health.barColor}`}
            style={{ width: `${Math.max(health.percentage, health.totalCount > 0 ? 5 : 0)}%` }}
          />
        </div>
      )}
    </div>
  );
};
