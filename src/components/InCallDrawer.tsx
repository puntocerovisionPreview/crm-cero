import React, { useState, useEffect, useRef } from 'react';
import { 
  Project, 
  PafStage, 
  PAF_STAGES 
} from '../types';
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  CheckCircle2, 
  Circle, 
  MessageSquare, 
  Target, 
  FileText, 
  Clock, 
  ChevronRight, 
  Save, 
  Check, 
  ExternalLink,
  Minimize2,
  Maximize2,
  PhoneCall,
  Award,
  AlertTriangle,
  HelpCircle,
  FolderKanban
} from 'lucide-react';
import { 
  PAF_SALES_OBJECTIONS, 
  PAF_LEAD_SCORING_INFO, 
  DEFAULT_PAF_STAGE_EXIT_MILESTONES,
  generatePafWhatsAppMessage,
  checkPafPacing
} from '../utils/pafTemplates';
import { formatWhatsAppUrl, extractPhoneFromText } from '../utils/contact';
import { hapticFeedback } from '../utils/haptics';
import { getTodayString } from '../utils/storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  initialProjectId?: string;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onAddMeeting?: (meeting: any) => void;
}

export const InCallDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  projects,
  initialProjectId,
  onUpdateProject,
}) => {
  // Filter PAF client architects and leads
  const pafProjects = projects.filter(
    p => (p.projectType === 'paf_pro' || p.projectType === 'paf_base') && !p.archived
  );
  const leadProjects = projects.filter(p => p.isLead && !p.archived);
  const allCallClients = [...pafProjects, ...leadProjects.filter(l => !pafProjects.some(p => p.id === l.id))];

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId || (allCallClients[0]?.id ?? '')
  );

  useEffect(() => {
    if (initialProjectId) {
      setSelectedProjectId(initialProjectId);
    } else if (!selectedProjectId && allCallClients.length > 0) {
      setSelectedProjectId(allCallClients[0].id);
    }
  }, [initialProjectId, allCallClients.length]);

  const activeProject = projects.find(p => p.id === selectedProjectId);

  // In-call tabs: 'hitos' | 'scripts' | 'notas' | 'scoring'
  const [drawerTab, setDrawerTab] = useState<'hitos' | 'scripts' | 'notas' | 'scoring'>('hitos');
  const [isMinimized, setIsMinimized] = useState(false);

  // Live Call Stopwatch
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  // Format Stopwatch display HH:MM:SS or MM:SS
  const formatStopwatch = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Quick Notes auto-save
  const [callNotes, setCallNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setCallNotes(activeProject.notes || '');
    }
  }, [activeProject?.id]);

  const handleSaveNotes = () => {
    if (!activeProject) return;
    hapticFeedback.light();
    onUpdateProject(activeProject.id, { notes: callNotes });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  // 1-Click: Add Hours to PAF consulting
  const handleAddHoursToProject = (hours: number) => {
    if (!activeProject) return;
    hapticFeedback.medium();
    const currentDone = activeProject.pafConsultingHoursDone || 0;
    const total = activeProject.pafConsultingHoursTotal || 26;
    const nextDone = Math.min(total, currentDone + hours);

    onUpdateProject(activeProject.id, {
      pafConsultingHoursDone: nextDone,
      updatedAt: new Date().toISOString(),
    });
  };

  // Toggle exit milestone checklist for current stage
  const currentStage = activeProject?.pafStage || 'Kick-off / Diagnóstico';
  const defaultStageMilestones = DEFAULT_PAF_STAGE_EXIT_MILESTONES[currentStage] || [];
  const projectStageChecklist = activeProject?.pafStageChecklist?.[currentStage] || [];

  const handleToggleStageMilestone = (milestoneId: string, milestoneText: string) => {
    if (!activeProject) return;
    hapticFeedback.selection();
    const existingList = activeProject.pafStageChecklist?.[currentStage] || 
      defaultStageMilestones.map(m => ({ id: m.id, text: m.text, done: false }));

    const updatedList = existingList.map(item => 
      item.id === milestoneId ? { ...item, done: !item.done } : item
    );

    // If item wasn't in list yet, append
    if (!existingList.some(item => item.id === milestoneId)) {
      updatedList.push({ id: milestoneId, text: milestoneText, done: true });
    }

    const updatedChecklistMap = {
      ...(activeProject.pafStageChecklist || {}),
      [currentStage]: updatedList,
    };

    onUpdateProject(activeProject.id, {
      pafStageChecklist: updatedChecklistMap,
    });
  };

  if (!isOpen) return null;

  // Minimized floating pill during calls
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="bg-zinc-900/95 border border-[#E8590C]/50 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isTimerRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="font-mono font-bold text-xs text-zinc-100">
              {formatStopwatch(timerSeconds)}
            </span>
          </div>
          <span className="text-xs font-semibold text-zinc-300 max-w-[120px] truncate">
            {activeProject ? activeProject.clientName : 'En Llamada'}
          </span>
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
            title="Expandir HUD de Llamada"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const pacing = activeProject ? checkPafPacing(activeProject.pafConsultingHoursDone, activeProject.pafConsultingHoursTotal || 26, activeProject.pafStartDate || activeProject.createdAt) : null;
  const clientPhone = activeProject?.clientPhone || extractPhoneFromText(activeProject?.notes || '');

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] md:w-[480px] bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Top Bar: Timer & Controls */}
      <div 
        style={{ paddingTop: 'max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))' }}
        className="px-4 pb-4 border-b border-zinc-800/90 bg-zinc-900/70 flex items-center justify-between shrink-0 safe-area-top-header"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#E8590C]/15 border border-[#E8590C]/30 flex items-center justify-center text-[#E8590C]">
            <PhoneCall className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
              <span>HUD de Llamada 1:1</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#E8590C]/20 text-[#E8590C] font-bold">En Vivo</span>
            </h3>
            <p className="text-[11px] text-zinc-400">Asistente táctico para sesiones de consultoría</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            title="Minimizar a píldora flotante"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            title="Cerrar panel lateral"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Client Selector & Stopwatch Section */}
      <div className="p-3.5 bg-zinc-900/40 border-b border-zinc-800/80 space-y-3 shrink-0">
        {/* Client Picker */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
            Cliente Arquitecto en Sesión:
          </label>
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-100 focus:outline-none focus:border-[#E8590C] cursor-pointer"
          >
            {allCallClients.map(c => (
              <option key={c.id} value={c.id}>
                {c.clientName} {c.isLead ? '(Lead)' : `(${c.pafStage || 'PAF'})`}
              </option>
            ))}
          </select>
        </div>

        {/* Stopwatch & 1-Click Hour Logging */}
        <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/90 flex items-center justify-between gap-2 shadow-inner">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                hapticFeedback.medium();
                setIsTimerRunning(r => !r);
              }}
              className={`p-2 rounded-xl text-white font-bold transition shadow-xs active:scale-95 ${
                isTimerRunning 
                  ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title={isTimerRunning ? 'Pausar cronómetro' : 'Iniciar cronómetro de sesión'}
            >
              {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </button>

            <button
              onClick={() => {
                hapticFeedback.light();
                setIsTimerRunning(false);
                setTimerSeconds(0);
              }}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition active:scale-95"
              title="Reiniciar cronómetro a cero"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div>
              <div className="text-[10px] text-zinc-400 uppercase font-semibold">Tiempo de Sesión</div>
              <div className="font-mono text-base font-extrabold text-zinc-100 tracking-tight">
                {formatStopwatch(timerSeconds)}
              </div>
            </div>
          </div>

          {/* 1-Click Add Hours Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleAddHoursToProject(1)}
              className="px-2.5 py-1.5 rounded-xl bg-[#E8590C]/15 hover:bg-[#E8590C] hover:text-white border border-[#E8590C]/30 text-[#E8590C] text-xs font-bold transition flex items-center gap-1 active:scale-95 shadow-xs"
              title="Sumar 1 hora a las horas realizadas de consultoría del cliente arquitecto"
            >
              <Plus className="w-3 h-3" />
              <span>1h</span>
            </button>
            <button
              onClick={() => handleAddHoursToProject(1.5)}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-[#E8590C] hover:text-white text-zinc-200 text-xs font-bold transition flex items-center gap-1 active:scale-95"
              title="Sumar 1.5 horas a la consultoría"
            >
              <Plus className="w-3 h-3" />
              <span>1.5h</span>
            </button>
          </div>
        </div>

        {/* Hour Meter & Pacing Alert */}
        {activeProject && !activeProject.isLead && (
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 font-medium">Bolsa de Horas 1:1:</span>
              <span className="font-mono font-bold text-zinc-200">
                {activeProject.pafConsultingHoursDone || 0} / {activeProject.pafConsultingHoursTotal || 26} hs
              </span>
            </div>

            <div className="w-full bg-zinc-800/80 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-[#E8590C] h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.min(100, (((activeProject.pafConsultingHoursDone || 0) / (activeProject.pafConsultingHoursTotal || 26)) * 100))}%`
                }}
              />
            </div>

            {pacing?.isFast && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2 text-[10px] text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{pacing.message}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs Row */}
      <div className="p-2 bg-zinc-950 border-b border-zinc-800 flex items-center gap-1 shrink-0 overflow-x-auto">
        {[
          { id: 'hitos', label: 'Hitos de Etapa', icon: Target },
          { id: 'notas', label: 'Notas Rápidas', icon: FileText },
          { id: 'scripts', label: 'Chuleta & Objeciones', icon: MessageSquare },
          { id: 'scoring', label: 'Lead Scoring', icon: Award },
        ].map(tab => {
          const Icon = tab.icon;
          const active = drawerTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                hapticFeedback.selection();
                setDrawerTab(tab.id as any);
              }}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 ${
                active 
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700/80' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-3 h-3 text-[#E8590C]" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Drawer Body - Scrollable */}
      <div className="p-4 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
        {/* TAB 1: HITOS DE ETAPA */}
        {drawerTab === 'hitos' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#E8590C]">
                  Etapa Actual
                </span>
                <h4 className="text-xs font-bold text-zinc-100">
                  {currentStage}
                </h4>
              </div>

              {/* Stage advance picker */}
              {activeProject && (
                <select
                  value={currentStage}
                  onChange={e => onUpdateProject(activeProject.id, { pafStage: e.target.value as PafStage })}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1 text-[11px] font-semibold text-zinc-200 cursor-pointer"
                >
                  {PAF_STAGES.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2.5">
              <div className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E8590C]" />
                <span>Requisitos de Salida para Desbloquear Avance:</span>
              </div>

              <div className="space-y-2">
                {defaultStageMilestones.map(milestone => {
                  const isDone = projectStageChecklist.find(m => m.id === milestone.id)?.done ?? false;
                  return (
                    <button
                      key={milestone.id}
                      type="button"
                      onClick={() => handleToggleStageMilestone(milestone.id, milestone.text)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition active:scale-98 ${
                        isDone 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                          : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-zinc-600" />
                        )}
                      </div>
                      <span className={`text-xs leading-snug font-medium ${isDone ? 'line-through opacity-80' : ''}`}>
                        {milestone.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick WhatsApp Action with Pre-filled Template */}
            {clientPhone && activeProject && (
              <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                <div className="text-[11px] font-bold text-zinc-300">
                  Mensajes Rápidos a {activeProject.clientName}:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <a
                    href={formatWhatsAppUrl(
                      clientPhone,
                      generatePafWhatsAppMessage({
                        clientName: activeProject.clientName,
                        hoursUsed: activeProject.pafConsultingHoursDone || 0,
                        totalHours: activeProject.pafConsultingHoursTotal || 26,
                        stage: activeProject.pafStage,
                        type: 'horas_restantes',
                      })
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition text-center"
                  >
                    <span>Enviar Balance de Horas</span>
                  </a>

                  <a
                    href={formatWhatsAppUrl(
                      clientPhone,
                      generatePafWhatsAppMessage({
                        clientName: activeProject.clientName,
                        hoursUsed: activeProject.pafConsultingHoursDone || 0,
                        totalHours: activeProject.pafConsultingHoursTotal || 26,
                        stage: activeProject.pafStage,
                        type: 'hitos_pendientes',
                      })
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition text-center"
                  >
                    <span>Pedir Entregable Pendiente</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NOTAS RÁPIDAS DE LA SESIÓN */}
        {drawerTab === 'notas' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#E8590C]" />
                <span>Bitácora de la Llamada / Acuerdos:</span>
              </span>
              <button
                onClick={handleSaveNotes}
                className="px-2.5 py-1 rounded-lg bg-[#E8590C] hover:bg-[#d04e0a] text-white text-xs font-bold transition flex items-center gap-1 shadow-xs active:scale-95"
              >
                {notesSaved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                <span>{notesSaved ? 'Guardado' : 'Guardar'}</span>
              </button>
            </div>

            <textarea
              rows={12}
              value={callNotes}
              onChange={e => setCallNotes(e.target.value)}
              placeholder="Tomá nota en vivo de dudas, objeciones, decisiones del comitente o tareas pactadas para la próxima llamada..."
              className="w-full text-xs text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 focus:outline-none focus:border-[#E8590C] transition leading-relaxed custom-scrollbar font-mono resize-none shadow-inner"
            />
          </div>
        )}

        {/* TAB 3: CHULETA DE SCRIPTS & OBJECIONES */}
        {drawerTab === 'scripts' && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#E8590C]" />
              <span>Rebatidor de Objeciones Frecuentes (En Llamada)</span>
            </div>

            <div className="space-y-2.5">
              {PAF_SALES_OBJECTIONS.map((item, idx) => (
                <div key={idx} className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                  <div className="text-xs font-bold text-amber-400">
                    {item.objection}
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    {item.rebuttal}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: LEAD SCORING */}
        {drawerTab === 'scoring' && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#E8590C]" />
              <span>Criterios de Lead Scoring para Arquitectos</span>
            </div>

            <div className="space-y-2.5">
              {Object.entries(PAF_LEAD_SCORING_INFO).map(([key, info]) => (
                <div key={key} className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-100">{info.label}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                      {info.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    <strong className="text-zinc-300">Criterio:</strong> {info.criteria}
                  </p>
                  <p className="text-[11px] text-[#E8590C] leading-snug font-medium">
                    <strong>Acción sugerida:</strong> {info.action}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-3 bg-zinc-900/80 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 shrink-0">
        <span className="text-[11px]">.Cero Operativo 1:1</span>
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition active:scale-95"
        >
          Cerrar HUD
        </button>
      </div>
    </div>
  );
};
