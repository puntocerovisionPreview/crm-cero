import React, { useState } from 'react';
import { Project, PafMilestone, PafStage, PAF_STAGES, ProjectType } from '../types';
import { 
  Building2,
  Briefcase, 
  Sparkles, 
  ChevronRight, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Phone, 
  MessageCircle, 
  Plus, 
  FolderKanban, 
  Layers, 
  TrendingUp, 
  Filter,
  Check,
  Calendar,
  ExternalLink,
  Target
} from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { ProjectTimelineBadge } from './ProjectTimelineBadge';
import { formatProjectPrice } from '../utils/paymentPlans';

interface Props {
  projects: Project[];
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onSelectProject: (project: Project) => void;
  onOpenNewPafModal: () => void;
}

export const PafDashboard: React.FC<Props> = ({
  projects,
  onUpdateProject,
  onSelectProject,
  onOpenNewPafModal,
}) => {
  const [stageFilter, setStageFilter] = useState<'todos' | PafStage>('todos');
  const [tierFilter, setTierFilter] = useState<'todos' | 'paf_pro' | 'paf_base'>('todos');

  // Filter only PAF projects
  const isPaf = (p: Project) => {
    return (
      p.projectType === 'paf_pro' ||
      p.projectType === 'paf_base' ||
      Boolean(p.pafStage) ||
      (p.pafMilestones && p.pafMilestones.length > 0) ||
      p.clientName.toLowerCase().includes('paf')
    );
  };

  const allPafProjects = projects.filter(isPaf);
  const activePaf = allPafProjects.filter(p => !p.archived && p.status !== 'No concretado');
  const completedPaf = allPafProjects.filter(p => p.pafStage === 'Completado / Graduado' || p.status === 'Entregado');

  // Counts by stage
  const countMes1 = activePaf.filter(p => p.pafStage === 'Mes 1: Infraestructura & Web').length;
  const countMes2 = activePaf.filter(p => p.pafStage === 'Mes 2: Adquisición & Ads').length;
  const countMes3 = activePaf.filter(p => p.pafStage === 'Mes 3: Conversión & Cierres').length;
  const countKickoff = activePaf.filter(p => !p.pafStage || p.pafStage === 'Kick-off / Diagnóstico').length;
  const countPro = activePaf.filter(p => p.projectType === 'paf_pro').length;
  const countBase = activePaf.filter(p => p.projectType === 'paf_base').length;

  // Filtered list
  const filteredList = activePaf.filter(p => {
    const matchesStage = stageFilter === 'todos' || (
      stageFilter === 'Kick-off / Diagnóstico' 
        ? (!p.pafStage || p.pafStage === 'Kick-off / Diagnóstico')
        : p.pafStage === stageFilter
    );
    const matchesTier = tierFilter === 'todos' || p.projectType === tierFilter;
    return matchesStage && matchesTier;
  });

  const handleStageChange = (projectId: string, newStage: PafStage) => {
    hapticFeedback.medium();
    playTaskDone();
    onUpdateProject(projectId, { pafStage: newStage });
  };

  const handleIncrementHours = (project: Project, delta: number) => {
    hapticFeedback.light();
    const current = project.pafConsultingHoursDone || 0;
    const max = project.pafConsultingHoursTotal || 26;
    const next = Math.max(0, Math.min(max, current + delta));
    onUpdateProject(project.id, { pafConsultingHoursDone: next });
  };

  const handleToggleMilestone = (project: Project, milestoneId: string) => {
    hapticFeedback.selection();
    playTaskDone();
    const currentList = project.pafMilestones || [];
    const updated = currentList.map(m => 
      m.id === milestoneId ? { ...m, completed: !m.completed } : m
    );
    onUpdateProject(project.id, { pafMilestones: updated });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Metric Summary Bar */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/25 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#E8590C] uppercase tracking-wider mb-0.5">
            <Building2 className="w-4 h-4 text-[#E8590C]" />
            <span>Infraestructura & Aceleración de Estudios</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
            Control de Proyectos Método PAF
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Visualiza y actualiza la etapa de cada cliente de arquitectura en sus 3 meses de aceleración.
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenNewPafModal}
            className="px-4 py-2 rounded-xl bg-[#E8590C] hover:bg-[#d04e0a] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-[#E8590C]/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuevo Cliente PAF</span>
          </button>
        </div>
      </div>

      {/* 2. Compact Stage Counter Pills (Dashboard) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {/* Total Activos */}
        <div 
          onClick={() => { setStageFilter('todos'); setTierFilter('todos'); }}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            stageFilter === 'todos' && tierFilter === 'todos'
              ? 'bg-zinc-800/90 border-[#E8590C] shadow-md shadow-[#E8590C]/10' 
              : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Activos Totales</div>
          <div className="text-xl font-extrabold text-zinc-100 mt-0.5 flex items-baseline gap-2">
            <span>{activePaf.length}</span>
            <span className="text-[11px] font-normal text-zinc-400">
              ({countPro} Pro · {countBase} Base)
            </span>
          </div>
        </div>

        {/* Kick-off */}
        <div 
          onClick={() => setStageFilter('Kick-off / Diagnóstico')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            stageFilter === 'Kick-off / Diagnóstico'
              ? 'bg-zinc-800/90 border-blue-500 shadow-md shadow-blue-500/10' 
              : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Kick-Off</div>
          <div className="text-xl font-extrabold text-zinc-100 mt-0.5">
            {countKickoff} <span className="text-[11px] font-normal text-zinc-500">estudios</span>
          </div>
        </div>

        {/* Mes 1: Infraestructura */}
        <div 
          onClick={() => setStageFilter('Mes 1: Infraestructura & Web')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            stageFilter === 'Mes 1: Infraestructura & Web'
              ? 'bg-zinc-800/90 border-amber-500 shadow-md shadow-amber-500/10' 
              : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Mes 1: Infra & Web</div>
          <div className="text-xl font-extrabold text-zinc-100 mt-0.5">
            {countMes1} <span className="text-[11px] font-normal text-zinc-500">estudios</span>
          </div>
        </div>

        {/* Mes 2: Adquisición */}
        <div 
          onClick={() => setStageFilter('Mes 2: Adquisición & Ads')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            stageFilter === 'Mes 2: Adquisición & Ads'
              ? 'bg-zinc-800/90 border-purple-500 shadow-md shadow-purple-500/10' 
              : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Mes 2: Ads & VSL</div>
          <div className="text-xl font-extrabold text-zinc-100 mt-0.5">
            {countMes2} <span className="text-[11px] font-normal text-zinc-500">estudios</span>
          </div>
        </div>

        {/* Mes 3: Conversión */}
        <div 
          onClick={() => setStageFilter('Mes 3: Conversión & Cierres')}
          className={`p-3 rounded-xl border transition cursor-pointer col-span-2 sm:col-span-1 ${
            stageFilter === 'Mes 3: Conversión & Cierres'
              ? 'bg-zinc-800/90 border-emerald-500 shadow-md shadow-emerald-500/10' 
              : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Mes 3: Cierres</div>
          <div className="text-xl font-extrabold text-zinc-100 mt-0.5">
            {countMes3} <span className="text-[11px] font-normal text-zinc-500">estudios</span>
          </div>
        </div>
      </div>

      {/* 3. Stage & Tier Sub-filters */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-zinc-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtro etapa:</span>
          </span>
          <button
            onClick={() => setStageFilter('todos')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
              stageFilter === 'todos' 
                ? 'bg-[#E8590C] text-white shadow-xs' 
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            Todos ({activePaf.length})
          </button>
          {PAF_STAGES.map(s => {
            const count = activePaf.filter(p => (s === 'Kick-Off & Diagnóstico' ? (!p.pafStage || p.pafStage === s || p.pafStage === 'Kick-off / Diagnóstico') : p.pafStage === s)).length;
            if (count === 0 && stageFilter !== s) return null;
            return (
              <button
                key={s}
                onClick={() => setStageFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  stageFilter === s 
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' 
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {s.split(':')[0]} ({count})
              </button>
            );
          })}
        </div>

        {/* Tier switcher */}
        <div className="flex items-center bg-zinc-950 p-0.5 rounded-xl border border-zinc-800 text-xs">
          <button
            onClick={() => setTierFilter('todos')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              tierFilter === 'todos' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Todos los planes
          </button>
          <button
            onClick={() => setTierFilter('paf_pro')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              tierFilter === 'paf_pro' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            PAF Pro ({countPro})
          </button>
          <button
            onClick={() => setTierFilter('paf_base')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              tierFilter === 'paf_base' ? 'bg-blue-500/20 text-blue-300 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            PAF Base ({countBase})
          </button>
        </div>
      </div>

      {/* 4. Active PAF Projects List */}
      {filteredList.length === 0 ? (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-200">
            {stageFilter === 'todos' && tierFilter === 'todos' 
              ? 'No tienes clientes PAF activos registrados aún' 
              : 'No hay estudios PAF en esta etapa o filtro'}
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
            Puedes registrar a estudios de arquitectura y arquitectos para llevar el seguimiento de sus 12 semanas de infraestructura comercial, hitos y consultorías 1:1.
          </p>
          <button
            onClick={onOpenNewPafModal}
            className="px-4 py-2 rounded-xl bg-[#E8590C] hover:bg-[#d04e0a] text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-md shadow-[#E8590C]/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Registrar Estudio Método PAF</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredList.map(project => {
            const isPro = project.projectType === 'paf_pro';
            const currentStage: PafStage = project.pafStage || 'Kick-off / Diagnóstico';
            const milestones = project.pafMilestones || [];
            const completedMilestones = milestones.filter(m => m.completed).length;
            const progressPercent = milestones.length > 0 
              ? Math.round((completedMilestones / milestones.length) * 100) 
              : 0;
            const hoursDone = project.pafConsultingHoursDone || 0;
            const hoursTotal = project.pafConsultingHoursTotal || (isPro ? 26 : 0);

            // Clean phone for whatsapp
            const cleanPhone = project.clientPhone ? project.clientPhone.replace(/\D/g, '') : null;

            return (
              <div
                key={project.id}
                className="bg-zinc-900 border border-zinc-800/90 hover:border-zinc-700/80 rounded-2xl p-4 sm:p-5 shadow-md shadow-black/20 space-y-4 transition flex flex-col justify-between"
              >
                {/* Header: Title & Badges */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {isPro ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>PAF Pro (12 Sem)</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-500/15 text-orange-300 border border-orange-500/30">
                            PAF Base
                          </span>
                        )}

                        {project.pafPlan && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {project.pafPlan === '1_pago' ? '1 pago total' : project.pafPlan === '2_pagos' ? '2 cuotas' : '3 cuotas'}
                          </span>
                        )}

                        {project.estimatedPrice && project.estimatedPrice > 0 && (
                          <span className="text-[11px] font-bold text-emerald-400 font-mono">
                            {formatProjectPrice(project.estimatedPrice, project.estimatedCurrency)}
                          </span>
                        )}
                      </div>

                      <h3 
                        onClick={() => onSelectProject(project)}
                        className="text-base sm:text-lg font-bold text-zinc-100 hover:text-[#E8590C] transition cursor-pointer truncate"
                        title={project.clientName}
                      >
                        {project.clientName}
                      </h3>
                    </div>

                    {/* Quick WhatsApp / Phone */}
                    <div className="flex items-center gap-1 shrink-0">
                      {cleanPhone && (
                        <a
                          href={`https://wa.me/${cleanPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition"
                          title="Contactar por WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => onSelectProject(project)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition text-xs font-semibold flex items-center gap-1"
                        title="Ver Ficha 360° Completa"
                      >
                        <span>Ficha 360°</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Notes / Context */}
                  {project.notes && (
                    <p className="text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed bg-zinc-950/60 p-2 rounded-xl border border-zinc-800/60">
                      {project.notes}
                    </p>
                  )}

                  {/* 3-Month Cycle Timeline Badge */}
                  <div className="mt-2.5">
                    <ProjectTimelineBadge project={project} onUpdateProject={onUpdateProject} />
                  </div>
                </div>

                {/* 1-Click Interactive Stage Stepper */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-zinc-300">Etapa del Método:</span>
                    <span className="font-semibold text-amber-400">
                      {currentStage}
                    </span>
                  </div>

                  {/* Segmented Stage Buttons */}
                  <div className="grid grid-cols-5 gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
                    {PAF_STAGES.map((s, sIdx) => {
                      const isCurrent = (s === 'Kick-Off & Diagnóstico' && (!project.pafStage || project.pafStage === s || project.pafStage === 'Kick-off / Diagnóstico')) || project.pafStage === s;
                      const shortLabel = sIdx === 0 ? 'Kick-off' : sIdx === 1 ? 'Mes 1' : sIdx === 2 ? 'Mes 2' : sIdx === 3 ? 'Mes 3' : 'Graduado';
                      
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleStageChange(project.id, s)}
                          className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition text-center truncate active:scale-95 ${
                            isCurrent
                              ? 'bg-[#E8590C] text-white shadow-xs font-extrabold'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                          }`}
                          title={`Cambiar a: ${s}`}
                        >
                          {shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Consulting Hours Tracker (for PAF Pro) */}
                {isPro && (
                  <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-[11px] font-bold text-zinc-200">
                          Consultoría 1:1: {hoursDone} / {hoursTotal} hs
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {hoursTotal - hoursDone > 0 ? `Quedan ${hoursTotal - hoursDone} hs acordadas` : '¡26 hs completadas!'}
                        </div>
                      </div>
                    </div>

                    {/* Quick +1h / -1h buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleIncrementHours(project, -1)}
                        disabled={hoursDone <= 0}
                        className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 text-xs font-bold transition"
                        title="Restar 1 hora"
                      >
                        -1h
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIncrementHours(project, 1)}
                        disabled={hoursDone >= hoursTotal}
                        className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 hover:text-black border border-amber-500/30 text-amber-300 text-xs font-bold transition active:scale-95"
                        title="Sumar 1 hora realizada"
                      >
                        +1h
                      </button>
                    </div>
                  </div>
                )}

                {/* Milestones Progress Bar & Toggle */}
                {milestones.length > 0 ? (
                  <div className="space-y-2 pt-2 border-t border-zinc-800/70">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                        <Target className="w-3.5 h-3.5 text-[#E8590C]" />
                        <span>Hitos del Método:</span>
                      </div>
                      <span className="text-[11px] font-bold text-zinc-400">
                        {completedMilestones} de {milestones.length} ({progressPercent}%)
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                      <div 
                        className="h-full bg-gradient-to-r from-[#E8590C] to-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    {/* Next 2 Pending Milestones Preview */}
                    <div className="space-y-1 pt-1">
                      {milestones
                        .filter(m => !m.completed)
                        .slice(0, 2)
                        .map(m => (
                          <div 
                            key={m.id}
                            onClick={() => handleToggleMilestone(project, m.id)}
                            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition text-zinc-300 hover:text-zinc-100"
                          >
                            <Circle className="w-3.5 h-3.5 text-zinc-500 hover:text-amber-400 shrink-0" />
                            <span className="text-xs truncate flex-1">{m.title}</span>
                            <span className="text-[9px] font-mono uppercase text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded shrink-0">
                              Mes {m.month}
                            </span>
                          </div>
                        ))}

                      {completedMilestones === milestones.length && milestones.length > 0 && (
                        <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 p-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>¡Todos los hitos del programa completados con éxito!</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-zinc-800/70 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 italic">Sin checklist de hitos cargado</span>
                    <button
                      type="button"
                      onClick={() => onSelectProject(project)}
                      className="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition"
                    >
                      + Cargar Hitos PAF
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
