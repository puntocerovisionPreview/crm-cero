import React, { useState } from 'react';
import { AgendaTask, AgendaMeeting, Project, IncomeRecord, WeeklyGoal } from '../types';
import { getTodayString, getWeekMonday, addDays } from '../utils/storage';
import { formatCurrency } from '../utils/pricingCatalog';
import { hapticFeedback } from '../utils/haptics';
import { 
  CheckCircle2, 
  X, 
  Sparkles, 
  TrendingUp, 
  Calendar, 
  Clock, 
  DollarSign, 
  Target, 
  Plus, 
  Check, 
  Loader2,
  Award,
  AlertCircle
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects: Project[];
  incomes: IncomeRecord[];
  onAddWeeklyGoal: (title: string, category?: 'ventas' | 'produccion' | 'organizacion' | 'general') => void;
  privacyMode?: boolean;
}

interface SuggestedGoal {
  title: string;
  category: 'ventas' | 'produccion' | 'organizacion' | 'general';
  added?: boolean;
}

export const WeeklyCloseModal: React.FC<Props> = ({
  isOpen,
  onClose,
  tasks,
  meetings,
  projects,
  incomes,
  onAddWeeklyGoal,
  privacyMode = false,
}) => {
  const today = getTodayString();
  const weekMonday = getWeekMonday(today);
  const weekSunday = addDays(weekMonday, 6);

  const [loadingAi, setLoadingAi] = useState(false);
  const [aiGoals, setAiGoals] = useState<SuggestedGoal[]>([]);
  const [errorAi, setErrorAi] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. Calculations for current week
  const weekTasks = tasks.filter(t => t.date && t.date >= weekMonday && t.date <= weekSunday);
  const completedTasks = weekTasks.filter(t => t.completed);
  const taskCompletionRate = weekTasks.length > 0 
    ? Math.round((completedTasks.length / weekTasks.length) * 100) 
    : 100;

  const weekMeetings = meetings.filter(m => m.date && m.date >= weekMonday && m.date <= weekSunday);
  const completedMeetings = weekMeetings.filter(m => m.completed);
  
  // Hours of consulting: 1h per completed meeting by default or custom
  const pafConsultingSessions = completedMeetings.filter(m => 
    m.title.toLowerCase().includes('paf') || 
    m.notes?.toLowerCase().includes('paf') ||
    projects.some(p => p.id === m.projectId && p.projectType?.startsWith('paf'))
  );
  const consultingHours = pafConsultingSessions.length * 1.5; // ~1h30m promedio de sesión PAF

  // Incomes collected this week
  const weekIncomes = incomes.filter(inc => inc.date && inc.date >= weekMonday && inc.date <= weekSunday && inc.status === 'cobrado');
  const totalArs = weekIncomes.filter(i => i.currency === 'ARS').reduce((acc, i) => acc + i.amount, 0);
  const totalUsd = weekIncomes.filter(i => i.currency === 'USD').reduce((acc, i) => acc + i.amount, 0);

  // Active PAF Clients in progress
  const activePafClients = projects.filter(p => !p.archived && p.projectType?.startsWith('paf'));

  const handleGenerateAiGoals = async () => {
    hapticFeedback.medium();
    setLoadingAi(true);
    setErrorAi(null);

    try {
      const summaryPayload = {
        weekStart: weekMonday,
        weekEnd: weekSunday,
        taskCompletionRate: `${taskCompletionRate}%`,
        tasksCompleted: completedTasks.length,
        tasksPending: weekTasks.length - completedTasks.length,
        consultingHoursCompleted: `${consultingHours} horas`,
        incomesCollectedARS: totalArs,
        incomesCollectedUSD: totalUsd,
        activePafClients: activePafClients.map(p => ({
          name: p.clientName,
          stage: p.pafStage || 'En curso',
        })),
      };

      const res = await fetch('/api/ai/suggest-weekly-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: summaryPayload }),
      });

      if (!res.ok) {
        throw new Error('No se pudo conectar con el asistente de IA.');
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.goals)) {
        setAiGoals(data.goals.map((g: any) => ({ ...g, added: false })));
      } else {
        throw new Error('Respuesta inválida de IA.');
      }
    } catch (err: any) {
      console.error('Error generating AI goals:', err);
      setErrorAi(err.message || 'Error al sugerir objetivos.');
    } finally {
      setLoadingAi(false);
    }
  };

  const handleAddGoal = (index: number) => {
    hapticFeedback.success();
    const goal = aiGoals[index];
    if (!goal || goal.added) return;

    onAddWeeklyGoal(goal.title, goal.category);
    setAiGoals(prev => prev.map((g, i) => (i === index ? { ...g, added: true } : g)));
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-[#121826] border border-[#263047] rounded-2xl shadow-2xl p-6 overflow-hidden relative max-h-[90vh] flex flex-col t-modal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#263047] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#8B7CF6]/20 border border-[#8B7CF6]/30 flex items-center justify-center text-[#8B7CF6]">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E8ECF4]">
                Cierre Semanal de Operaciones
              </h2>
              <p className="text-xs text-[#8B95A9]">
                Semana del {weekMonday} al {weekSunday}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8B95A9] hover:text-[#E8ECF4] hover:bg-[#1A2233] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto py-4 space-y-4 pr-1">
          {/* Metrics 4-grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-[#1A2233] border border-[#263047]">
              <span className="text-[10px] text-[#8B95A9] uppercase font-bold tracking-wider block">
                Cumplimiento Tareas
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-black text-[#E8ECF4] font-mono">
                  {taskCompletionRate}%
                </span>
                <span className="text-xs text-[#8B95A9]">
                  ({completedTasks.length}/{weekTasks.length})
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#1A2233] border border-[#263047]">
              <span className="text-[10px] text-[#8B95A9] uppercase font-bold tracking-wider block">
                Consultoría PAF 1:1
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-black text-[#D45B9E] font-mono">
                  {consultingHours} hs
                </span>
                <span className="text-xs text-[#8B95A9]">
                  ({pafConsultingSessions.length} ses.)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#1A2233] border border-[#263047]">
              <span className="text-[10px] text-[#8B95A9] uppercase font-bold tracking-wider block">
                Cobrado en ARS
              </span>
              <span className="text-lg font-black text-[#34C38F] font-mono block mt-1">
                {privacyMode ? '$ ••••••' : formatCurrency(totalArs, 'ARS')}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#1A2233] border border-[#263047]">
              <span className="text-[10px] text-[#8B95A9] uppercase font-bold tracking-wider block">
                Cobrado en USD
              </span>
              <span className="text-lg font-black text-[#22B8CF] font-mono block mt-1">
                {privacyMode ? '$ ••••••' : formatCurrency(totalUsd, 'USD')}
              </span>
            </div>
          </div>

          {/* AI Strategy Suggestion Section */}
          <div className="p-4 rounded-xl bg-[#1A2233] border border-[#263047] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#8B7CF6]" />
                <span className="text-xs font-bold text-[#E8ECF4]">
                  Planificar Próxima Semana con Gemini
                </span>
              </div>

              <button
                type="button"
                onClick={handleGenerateAiGoals}
                disabled={loadingAi}
                className="px-3 py-1.5 rounded-xl bg-[#4C8DFF] hover:bg-[#3B7BF0] text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                {loadingAi ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analizando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Sugerir Objetivos</span>
                  </>
                )}
              </button>
            </div>

            {errorAi && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorAi}</span>
              </div>
            )}

            {aiGoals.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#263047]">
                <span className="text-[11px] text-[#8B95A9] font-medium block">
                  Objetivos estratégicos recomendados:
                </span>
                {aiGoals.map((g, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#121826] border border-[#263047]"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#E8ECF4] leading-snug">
                        {g.title}
                      </p>
                      <span className="text-[10px] text-[#8B95A9] uppercase font-mono tracking-wider">
                        {g.category}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddGoal(idx)}
                      disabled={g.added}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition ${
                        g.added
                          ? 'bg-[#34C38F]/20 text-[#34C38F] border border-[#34C38F]/30'
                          : 'bg-[#263047] hover:bg-[#384666] text-[#E8ECF4] cursor-pointer'
                      }`}
                    >
                      {g.added ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Agregado</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          <span>Aceptar</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#263047] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#263047] hover:bg-[#384666] text-xs font-semibold text-[#E8ECF4] transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
