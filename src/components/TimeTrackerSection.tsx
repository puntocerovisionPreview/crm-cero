import React, { useState, useEffect, useRef } from 'react';
import { TimeLog, Project } from '../types';
import { 
  Clock, 
  Play, 
  Pause, 
  Square, 
  Plus, 
  TrendingUp, 
  Trash2, 
  Award, 
  Sparkles,
  CheckCircle2,
  Calendar,
  Hourglass
} from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { todayLocal } from '../utils/dates';

interface Props {
  project: Project;
  timeLogs?: TimeLog[];
  onAddTimeLog: (log: Omit<TimeLog, 'id' | 'createdAt'>) => void;
  onDeleteTimeLog: (id: string) => void;
  onUpdateProjectConsultingHours?: (hours: number) => void;
  incomeCobrado: number;
  incomeCurrency: 'USD' | 'ARS';
  privacyMode?: boolean;
}

export const TimeTrackerSection: React.FC<Props> = ({
  project,
  timeLogs = [],
  onAddTimeLog,
  onDeleteTimeLog,
  onUpdateProjectConsultingHours,
  incomeCobrado,
  incomeCurrency,
  privacyMode = false,
}) => {
  // Live Stopwatch
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchDesc, setStopwatchDesc] = useState('');
  const stopwatchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Manual Log Form
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualHours, setManualHours] = useState<number | ''>(1);
  const [manualMinutes, setManualMinutes] = useState<number | ''>(0);
  const [manualDesc, setManualDesc] = useState('');
  const [isConsultingSession, setIsConsultingSession] = useState(project.projectType === 'paf_pro');

  useEffect(() => {
    if (isStopwatchRunning) {
      stopwatchIntervalRef.current = setInterval(() => {
        setStopwatchSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    }
    return () => {
      if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    };
  }, [isStopwatchRunning]);

  const handleStopAndSaveStopwatch = () => {
    if (stopwatchSeconds < 30) {
      // Too short to record
      setIsStopwatchRunning(false);
      setStopwatchSeconds(0);
      return;
    }

    const minutes = Math.round(stopwatchSeconds / 60);
    const desc = stopwatchDesc.trim() || 'Sesión de trabajo en vivo';

    onAddTimeLog({
      projectId: project.id,
      projectName: project.clientName,
      durationMinutes: Math.max(1, minutes),
      description: desc,
      date: todayLocal(),
    });

    // If consulting session and PAF Pro
    if (project.projectType === 'paf_pro' && onUpdateProjectConsultingHours) {
      const addedHours = Number((minutes / 60).toFixed(1));
      const current = project.pafConsultingHoursDone || 0;
      onUpdateProjectConsultingHours(Number((current + addedHours).toFixed(1)));
    }

    setIsStopwatchRunning(false);
    setStopwatchSeconds(0);
    setStopwatchDesc('');
    hapticFeedback.success();
    playTaskDone();
  };

  const handleSaveManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    const h = Number(manualHours || 0);
    const m = Number(manualMinutes || 0);
    const totalMinutes = h * 60 + m;

    if (totalMinutes <= 0) return;

    const desc = manualDesc.trim() || (isConsultingSession ? 'Sesión de Consultoría y Mentoría 1:1' : 'Dedicación de proyecto');

    onAddTimeLog({
      projectId: project.id,
      projectName: project.clientName,
      durationMinutes: totalMinutes,
      description: desc,
      date: todayLocal(),
    });

    if (isConsultingSession && project.projectType === 'paf_pro' && onUpdateProjectConsultingHours) {
      const addedHours = Number((totalMinutes / 60).toFixed(1));
      const current = project.pafConsultingHoursDone || 0;
      onUpdateProjectConsultingHours(Number((current + addedHours).toFixed(1)));
    }

    setManualHours(1);
    setManualMinutes(0);
    setManualDesc('');
    setShowManualForm(false);
    hapticFeedback.success();
    playTaskDone();
  };

  // Quick 1-click consulting hour addition for PAF Pro
  const handleQuickAddConsultingHour = () => {
    onAddTimeLog({
      projectId: project.id,
      projectName: project.clientName,
      durationMinutes: 60,
      description: 'Sesión de Consultoría y Mentoría 1:1 (PAF)',
      date: todayLocal(),
    });

    if (onUpdateProjectConsultingHours) {
      const current = project.pafConsultingHoursDone || 0;
      onUpdateProjectConsultingHours(Math.min(26, current + 1));
    }

    hapticFeedback.success();
    playTaskDone();
  };

  // Filter logs for this project
  const projectLogs = timeLogs.filter(l => l.projectId === project.id);
  const totalMinutes = projectLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
  const totalHours = totalMinutes / 60;

  // Real hourly yield ($ earned / total hours)
  const hourlyYield = totalHours > 0 && incomeCobrado > 0 ? incomeCobrado / totalHours : 0;

  // Format Stopwatch
  const swMinutes = Math.floor(stopwatchSeconds / 60);
  const swSecs = stopwatchSeconds % 60;
  const swFormatted = `${String(swMinutes).padStart(2, '0')}:${String(swSecs).padStart(2, '0')}`;

  const formatMoney = (amount: number) => {
    if (privacyMode) return '$ ••••••';
    return `${incomeCurrency === 'USD' ? 'US$' : '$'} ${Math.round(amount).toLocaleString('es-AR')}`;
  };

  const consultingHours = project.pafConsultingHoursDone || 0;
  const isPafPro = project.projectType === 'paf_pro';

  return (
    <div className="space-y-4">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
          <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-semibold mb-1">
            <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Horas Totales Invertidas</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-zinc-100 font-mono">
            {totalHours.toFixed(1)} <span className="text-xs font-normal text-zinc-400">hs ({totalMinutes}m)</span>
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            {projectLogs.length} sesiones registradas
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
          <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-semibold mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Valor Hora Real Logrado</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {hourlyYield > 0 ? (
              <>
                {formatMoney(hourlyYield)}
                <span className="text-xs font-normal text-zinc-400"> /h</span>
              </>
            ) : (
              <span className="text-xs font-normal text-zinc-500">Sin cobro / horas</span>
            )}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Basado en {formatMoney(incomeCobrado)} cobrados
          </div>
        </div>

        {/* PAF 26 Hours Indicator */}
        {isPafPro ? (
          <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-amber-950/20 border border-amber-800/40">
            <div className="flex items-center justify-between text-[11px] font-semibold text-amber-300 mb-1">
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                Mentoría 1:1 PAF
              </span>
              <span>{consultingHours} / 26 hs</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden mt-1.5 mb-1">
              <div 
                className="bg-amber-400 h-full rounded-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset]"
                style={{ width: `${Math.min(100, (consultingHours / 26) * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-zinc-400 flex items-center justify-between">
              <span>{Math.round((consultingHours / 26) * 100)}% completado</span>
              <button 
                type="button" 
                onClick={handleQuickAddConsultingHour}
                className="text-amber-400 hover:text-amber-300 font-bold hover:underline"
              >
                +1 hora rápida
              </button>
            </div>
          </div>
        ) : (
          <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col justify-center">
            <div className="text-[11px] text-zinc-500 font-semibold mb-1">Control de Margen</div>
            <div className="text-xs text-zinc-300">
              Registra cada bloque para saber cuánto rinde realmente tu tiempo con este cliente.
            </div>
          </div>
        )}
      </div>

      {/* Live Stopwatch Bar */}
      <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/90 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className={`p-2.5 rounded-xl border flex items-center justify-center transition ${
            isStopwatchRunning 
              ? 'bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)] animate-pulse' 
              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
          }`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-200">Cronómetro en Vivo</div>
            <div className="text-2xl font-black text-zinc-100 font-mono tracking-tight">
              {swFormatted}
            </div>
          </div>
        </div>

        {isStopwatchRunning && (
          <input
            type="text"
            placeholder="¿Qué estás trabajando? (ej: Grabación VSL...)"
            value={stopwatchDesc}
            onChange={(e) => setStopwatchDesc(e.target.value)}
            className="w-full sm:w-64 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[var(--accent)]"
          />
        )}

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {!isStopwatchRunning ? (
            <>
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setIsStopwatchRunning(true);
                }}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[#ff691e] text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-[var(--accent)]/20"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Iniciar Cronómetro</span>
              </button>
              <button
                type="button"
                onClick={() => setShowManualForm(!showManualForm)}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-semibold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Manual</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleStopAndSaveStopwatch}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Terminar y Guardar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsStopwatchRunning(false);
                  setStopwatchSeconds(0);
                }}
                className="px-2.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs transition"
                title="Descartar"
              >
                Descartar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Manual Log Form */}
      {showManualForm && (
        <form onSubmit={handleSaveManualLog} className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
          <div className="text-xs font-bold text-zinc-200">Registrar Horas Manualmente</div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 font-semibold block mb-1">Horas</label>
              <input
                type="number"
                min="0"
                max="24"
                step="1"
                value={manualHours}
                onChange={(e) => setManualHours(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 font-semibold block mb-1">Minutos</label>
              <input
                type="number"
                min="0"
                max="59"
                step="5"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] text-zinc-400 font-semibold block mb-1">Tipo de sesión</label>
              <button
                type="button"
                onClick={() => setIsConsultingSession(!isConsultingSession)}
                className={`w-full py-2 px-2 rounded-xl text-xs font-semibold border text-center transition ${
                  isConsultingSession 
                    ? 'bg-amber-950/40 border-amber-600/50 text-amber-300' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
              >
                {isConsultingSession ? '⭐ Mentoría 1:1 PAF' : 'Trabajo técnico'}
              </button>
            </div>
          </div>

          <input
            type="text"
            placeholder="Descripción (ej: Armado de guiones, Revisión de pauta Meta Ads...)"
            value={manualDesc}
            onChange={(e) => setManualDesc(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[var(--accent)]"
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowManualForm(false)}
              className="px-3 py-1.5 rounded-xl text-xs text-zinc-400 hover:bg-zinc-900 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-[var(--accent)] hover:bg-[#ff691e] text-white text-xs font-bold transition"
            >
              Guardar Horas
            </button>
          </div>
        </form>
      )}

      {/* History List */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-zinc-400 flex items-center justify-between">
          <span>Historial de Sesiones ({projectLogs.length})</span>
        </div>

        {projectLogs.length === 0 ? (
          <div className="p-4 rounded-2xl bg-zinc-950/40 border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
            Aún no hay tiempo registrado. Usa el cronómetro o registra tus horas manualmente.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {projectLogs.map((log) => {
              const hours = (log.durationMinutes / 60).toFixed(1);
              return (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-zinc-200 truncate">
                      {log.description}
                    </div>
                    <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5">
                      <span>{log.date}</span>
                      <span>•</span>
                      <span className="font-mono text-zinc-400">{log.durationMinutes} min ({hours}h)</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onDeleteTimeLog(log.id);
                      hapticFeedback.light();
                    }}
                    className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-900 transition"
                    title="Eliminar registro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
