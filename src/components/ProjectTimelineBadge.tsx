import React, { useState } from 'react';
import { Project } from '../types';
import { calculateProjectTimeline, formatDisplayDate, addMonths, isPafProject } from '../utils/projectTimeline';
import { Calendar, Clock, AlertTriangle, CheckCircle2, ChevronRight, Edit3, X, Check } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  project: Project;
  onUpdateProject?: (id: string, updates: Partial<Project>) => void;
  compact?: boolean;
  showProgressBar?: boolean;
}

export const ProjectTimelineBadge: React.FC<Props> = ({
  project,
  onUpdateProject,
  compact = false,
  showProgressBar = true,
}) => {
  const timeline = calculateProjectTimeline(project);
  const [isEditing, setIsEditing] = useState(false);
  const [startDraft, setStartDraft] = useState(timeline.startDate);
  const [deliveryDraft, setDeliveryDraft] = useState(timeline.deliveryDate || '');

  const handleOpenEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStartDraft(timeline.startDate);
    setDeliveryDraft(timeline.deliveryDate || (timeline.isPaf ? addMonths(timeline.startDate, 3) : ''));
    setIsEditing(true);
  };

  const handleSaveDates = (e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onUpdateProject) {
      onUpdateProject(project.id, {
        startDate: startDraft || undefined,
        pafStartDate: timeline.isPaf ? startDraft : project.pafStartDate,
        deliveryDate: deliveryDraft || undefined,
      });
      hapticFeedback.success();
    }
    setIsEditing(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  const handleAutoPaf3Months = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (startDraft) {
      setDeliveryDraft(addMonths(startDraft, 3));
      hapticFeedback.selection();
    }
  };

  // Theme styling based on status
  const themeStyles = {
    purple: {
      bg: 'bg-purple-950/40 border-purple-800/60 text-purple-300',
      bar: 'bg-purple-500',
      icon: 'text-purple-400',
      pill: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    },
    amber: {
      bg: 'bg-amber-950/40 border-amber-800/60 text-amber-300',
      bar: 'bg-amber-500',
      icon: 'text-amber-400',
      pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    },
    blue: {
      bg: 'bg-blue-950/40 border-blue-800/60 text-blue-300',
      bar: 'bg-blue-500',
      icon: 'text-blue-400',
      pill: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    },
    emerald: {
      bg: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300',
      bar: 'bg-emerald-500',
      icon: 'text-emerald-400',
      pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    },
    rose: {
      bg: 'bg-rose-950/40 border-rose-800/60 text-rose-300',
      bar: 'bg-rose-500',
      icon: 'text-rose-400',
      pill: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    },
    zinc: {
      bg: 'bg-zinc-900/60 border-zinc-800 text-zinc-300',
      bar: 'bg-zinc-600',
      icon: 'text-zinc-400',
      pill: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    },
  }[timeline.themeColor];

  if (isEditing) {
    return (
      <div 
        onClick={e => e.stopPropagation()} 
        className="p-2.5 rounded-2xl bg-zinc-950 border border-[#E8590C]/50 space-y-2 text-xs shadow-xl animate-in fade-in"
      >
        <div className="flex items-center justify-between font-bold text-zinc-200">
          <span className="flex items-center gap-1.5 text-[11px]">
            <Calendar className="w-3.5 h-3.5 text-[#E8590C]" />
            Cronograma & Meses: {project.clientName}
          </span>
          <button 
            type="button" 
            onClick={handleCancel}
            className="text-zinc-500 hover:text-zinc-300 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-zinc-400 font-semibold mb-1">
              Fecha de Arranque (ej: Octubre)
            </label>
            <input
              type="date"
              value={startDraft}
              onChange={e => {
                const newStart = e.target.value;
                setStartDraft(newStart);
                if (timeline.isPaf && newStart) {
                  setDeliveryDraft(addMonths(newStart, 3));
                }
              }}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-1.5 text-zinc-100 font-mono text-xs focus:outline-none focus:border-[#E8590C]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] text-zinc-400 font-semibold">
                {timeline.isPaf ? 'Finalización PAF (3 meses)' : 'Fecha Límite Web'}
              </label>
              {timeline.isPaf && (
                <button
                  type="button"
                  onClick={handleAutoPaf3Months}
                  className="text-[9px] text-amber-400 hover:underline"
                >
                  +3 meses
                </button>
              )}
            </div>
            <input
              type="date"
              value={deliveryDraft}
              onChange={e => setDeliveryDraft(e.target.value)}
              placeholder="Sin fecha límite"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-1.5 text-zinc-100 font-mono text-xs focus:outline-none focus:border-[#E8590C]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-zinc-500">
            {timeline.isPaf ? 'Partida automática de 3 meses' : 'Conteo mensual automático'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCancel}
              className="px-2 py-1 rounded-lg text-[10px] text-zinc-400 hover:text-zinc-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveDates}
              className="px-2.5 py-1 rounded-lg bg-[#E8590C] hover:bg-[#cf4d07] text-white font-bold text-[10px] flex items-center gap-1 shadow-sm"
            >
              <Check className="w-3 h-3" />
              <span>Guardar</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compact badge rendering (for table views or small areas)
  if (compact) {
    return (
      <div 
        onClick={onUpdateProject ? handleOpenEdit : undefined}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-mono transition ${themeStyles.pill} ${onUpdateProject ? 'cursor-pointer hover:opacity-85' : ''}`}
        title={`Inicio: ${formatDisplayDate(timeline.startDate)} | Fin: ${formatDisplayDate(timeline.deliveryDate)}`}
      >
        {timeline.isUpcoming ? (
          <Calendar className="w-3 h-3 text-purple-400" />
        ) : timeline.isOverdue ? (
          <AlertTriangle className="w-3 h-3 text-rose-400" />
        ) : timeline.isCompleted ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        ) : (
          <Clock className="w-3 h-3 text-amber-400" />
        )}
        <span className="font-bold">{timeline.monthLabel}</span>
        {onUpdateProject && <Edit3 className="w-2.5 h-2.5 opacity-50 ml-0.5" />}
      </div>
    );
  }

  // Full detailed timeline card badge
  return (
    <div 
      className={`p-2.5 rounded-2xl border ${themeStyles.bg} transition relative group space-y-1.5`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1 rounded-lg bg-black/30 shrink-0 ${themeStyles.icon}`}>
            {timeline.isUpcoming ? (
              <Calendar className="w-3.5 h-3.5" />
            ) : timeline.isOverdue ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : timeline.isCompleted ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-tight leading-none text-zinc-100">
                {timeline.monthLabel}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${themeStyles.pill}`}>
                {timeline.isPaf ? 'PAF 3m' : 'Web'}
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono truncate mt-0.5">
              {timeline.statusBadgeText}
            </div>
          </div>
        </div>

        {onUpdateProject && (
          <button
            type="button"
            onClick={handleOpenEdit}
            className="opacity-60 hover:opacity-100 p-1 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-black/30 transition shrink-0"
            title="Ajustar fecha de arranque o plazo límite"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Micro progress bar for elapsed time */}
      {showProgressBar && !timeline.isUpcoming && (
        <div className="space-y-1 pt-0.5">
          <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden border border-white/5">
            <div
              className={`h-full ${themeStyles.bar} transition-all duration-300`}
              style={{ width: `${timeline.progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span>Inicio: {formatDisplayDate(timeline.startDate)}</span>
            <span>{timeline.deliveryDate ? `Fin: ${formatDisplayDate(timeline.deliveryDate)}` : 'En curso'}</span>
          </div>
        </div>
      )}

      {/* Upcoming specific subtext */}
      {timeline.isUpcoming && (
        <div className="text-[10px] text-zinc-400 font-mono flex items-center justify-between pt-0.5">
          <span>Arranca: {formatDisplayDate(timeline.startDate)}</span>
          <span className="text-purple-300 font-semibold">{timeline.statusBadgeSubtext}</span>
        </div>
      )}
    </div>
  );
};
