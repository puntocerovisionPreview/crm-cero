import React, { useState, useMemo, useEffect } from 'react';
import { 
  WeeklyMission, 
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
  WeeklyReviewHistoryItem
} from '../types';
import { 
  DIAS_SEMANA, 
  FRENTE_CONFIG, 
  calculateMissionProgress, 
  calculateWeekRitmo, 
  getMissionRealHours, 
  getWeekCapacityHours, 
  checkMissionLimit, 
  generateAutoCobroMissions, 
  getSuggestedHorizonProjects, 
  getMissionsConfig, 
  getWeeklyReviewHistory, 
  saveWeeklyReviewHistoryItem,
  getDateForDiaSemana,
  getDiaSemanaFromDate
} from '../utils/missions';
import { getTodayString, getWeekMonday, addDays, formatDayName } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { 
  Target, 
  Plus, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Calendar, 
  AlertCircle, 
  AlertTriangle,
  ArrowRight, 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Flame, 
  Sparkles, 
  Check, 
  X, 
  History, 
  TrendingUp, 
  DollarSign, 
  Building2, 
  Briefcase, 
  ListTodo, 
  HelpCircle,
  FileText,
  RotateCcw
} from 'lucide-react';

interface Props {
  missions: WeeklyMission[];
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects: Project[];
  incomes: IncomeRecord[];
  dailyAllocations?: DailyAllocation[];
  onSaveMission: (mission: WeeklyMission) => void;
  onDeleteMission: (missionId: string) => void;
  onAddTask: (task: Omit<AgendaTask, 'id' | 'createdAt'>) => void;
  onToggleTask: (taskId: string) => void;
  onNavigate: (path: string) => void;
  selectedMissionId?: string;
}

export const SemanaView: React.FC<Props> = ({
  missions,
  tasks,
  meetings,
  projects,
  incomes,
  dailyAllocations = [],
  onSaveMission,
  onDeleteMission,
  onAddTask,
  onToggleTask,
  onNavigate,
  selectedMissionId: initialSelectedMissionId,
}) => {
  const today = getTodayString();
  const currentWeekMonday = getWeekMonday(today);

  // Semana activa en visualización
  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeekMonday);
  const [activeTab, setActiveTab] = useState<'carriles' | 'historial'>('carriles');
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(initialSelectedMissionId || null);

  // Sync selectedMissionId when prop changes
  useEffect(() => {
    if (initialSelectedMissionId) {
      setSelectedMissionId(initialSelectedMissionId);
    }
  }, [initialSelectedMissionId]);

  // Modal / Formulario Nueva Misión
  const [showNewMissionModal, setShowNewMissionModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState('');
  const [newResultado, setNewResultado] = useState('');
  const [newFrente, setNewFrente] = useState<MissionFrente>('PAF');
  const [newTipo, setNewTipo] = useState<MissionTipo>('mision');
  const [newProjectId, setNewProjectId] = useState<string>('');
  const [newPresupuestoHoras, setNewPresupuestoHoras] = useState<number>(4);
  const [newDias, setNewDias] = useState<DiaSemana[]>(['lunes', 'martes', 'miercoles', 'jueves', 'viernes']);
  const [newPasos, setNewPasos] = useState<string[]>(['', '', '']);
  const [acceptOverCapacity, setAcceptOverCapacity] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal Cierre de Semana
  const [showWeeklyClose, setShowWeeklyClose] = useState<boolean>(false);
  const [closeLearnings, setCloseLearnings] = useState<string>('');
  const [carryDecisions, setCarryDecisions] = useState<Record<string, { action: 'arrastrar' | 'descartar' | 'terminar'; motivo?: string }>>({});

  // Configuración de misiones
  const config = useMemo(() => getMissionsConfig(), []);

  // Generar automáticamente misiones de 'cobro' para la semana seleccionada
  useEffect(() => {
    const autoCobros = generateAutoCobroMissions(selectedWeek, projects, missions);
    if (autoCobros.length > 0) {
      autoCobros.forEach(cobro => {
        onSaveMission(cobro);
      });
    }
  }, [selectedWeek, projects, missions, onSaveMission]);

  // Misiones filtradas para la semana seleccionada
  const weekMissions = useMemo(() => {
    return missions.filter(m => m.weekStart === selectedWeek);
  }, [missions, selectedWeek]);

  // Misiones activas de la semana (excluyendo descartadas y arrastradas para cálculo de compromiso)
  const activeWeekMissions = useMemo(() => {
    return weekMissions.filter(m => m.estado !== 'descartada');
  }, [weekMissions]);

  // Capacidad de la semana en horas
  const weekCapacityHours = useMemo(() => {
    return getWeekCapacityHours(selectedWeek, dailyAllocations);
  }, [selectedWeek, dailyAllocations]);

  // Horas comprometidas en misiones
  const committedHours = useMemo(() => {
    return activeWeekMissions.reduce((acc, m) => acc + (Number(m.presupuestoHoras) || 0), 0);
  }, [activeWeekMissions]);

  // Horas reales ejecutadas en misiones
  const totalRealHours = useMemo(() => {
    return activeWeekMissions.reduce((acc, m) => {
      return acc + getMissionRealHours(m, tasks, meetings, selectedWeek);
    }, 0);
  }, [activeWeekMissions, tasks, meetings, selectedWeek]);

  // Semáforo de capacidad
  const capacityRatio = weekCapacityHours > 0 ? (committedHours / weekCapacityHours) : 0;
  const isOverCapacity = committedHours > weekCapacityHours;
  const capacitySemaphore = useMemo(() => {
    if (capacityRatio > 1) return { color: 'text-red-500', bg: 'bg-red-500/20', bar: 'bg-red-500', status: 'Sobrecarga' };
    if (capacityRatio > 0.85) return { color: 'text-amber-500', bg: 'bg-amber-500/20', bar: 'bg-amber-500', status: 'Carga Alta' };
    return { color: 'text-emerald-500', bg: 'bg-emerald-500/20', bar: 'bg-emerald-500', status: 'Equilibrada' };
  }, [capacityRatio]);

  // Proyectos sugeridos desde Horizonte / Clientes Activos
  const suggestedProjects = useMemo(() => {
    return getSuggestedHorizonProjects(projects, selectedWeek, missions);
  }, [projects, selectedWeek, missions]);

  // Historial de cierres guardados
  const reviewHistory = useMemo(() => {
    return getWeeklyReviewHistory();
  }, [showWeeklyClose, activeTab]);

  // Manejo de semana anterior y siguiente
  const handlePrevWeek = () => {
    hapticFeedback.light();
    setSelectedWeek(prev => addDays(prev, -7));
    setSelectedMissionId(null);
  };

  const handleNextWeek = () => {
    hapticFeedback.light();
    setSelectedWeek(prev => addDays(prev, 7));
    setSelectedMissionId(null);
  };

  const handleCurrentWeek = () => {
    hapticFeedback.selection();
    setSelectedWeek(currentWeekMonday);
    setSelectedMissionId(null);
  };

  // Abrir modal de nueva misión
  const handleOpenNewMission = (presetProject?: Project) => {
    hapticFeedback.medium();
    setFormError(null);
    setAcceptOverCapacity(false);

    if (presetProject) {
      setNewTitle(`Entrega: ${presetProject.clientName}`);
      setNewResultado(`Cerrar hito principal de ${presetProject.clientName}`);
      setNewFrente(presetProject.projectType?.startsWith('paf') ? 'PAF' : 'Webs');
      setNewTipo('mision');
      setNewProjectId(presetProject.id);
      setNewPresupuestoHoras(6);
      setNewPasos(['Kickoff y alineación', 'Desarrollo de entregable', 'Validación con cliente']);
    } else {
      setNewTitle('');
      setNewResultado('');
      setNewFrente('PAF');
      setNewTipo('mision');
      setNewProjectId('');
      setNewPresupuestoHoras(4);
      setNewPasos(['Paso 1: Arranque y alcance', 'Paso 2: Ejecución principal', 'Paso 3: Cierre y entrega']);
    }
    setShowNewMissionModal(true);
  };

  // Guardar nueva misión con validación de topes
  const handleCreateMission = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const titleTrim = newTitle.trim();
    const resultadoTrim = newResultado.trim();

    if (!titleTrim) {
      setFormError('Ingresá un título claro para la misión.');
      return;
    }

    if (!resultadoTrim) {
      setFormError('Definí el Resultado Esperado (la frase que determina cuándo está terminada).');
      return;
    }

    // Validación de topes 3 grandes + 1 mantenimiento
    const limitCheck = checkMissionLimit(selectedWeek, newTipo, missions, config);
    if (!limitCheck.allowed) {
      setFormError(limitCheck.reason || 'Se alcanzó el tope de misiones para esta semana.');
      return;
    }

    // Validación de sobrecarga de horas
    const nextTotalCommitted = committedHours + Number(newPresupuestoHoras);
    if (nextTotalCommitted > weekCapacityHours && !acceptOverCapacity) {
      setFormError(`La suma comprometida (${nextTotalCommitted}h) supera la capacidad de la semana (${weekCapacityHours}h). Marcá la casilla para confirmar sobrecarga.`);
      return;
    }

    // Armar lista de pasos
    const cleanedPasos: MissionPaso[] = newPasos
      .map(p => p.trim())
      .filter(Boolean)
      .map((titulo, i) => ({
        id: `paso-${Date.now()}-${i}`,
        titulo,
        hecho: false,
      }));

    if (cleanedPasos.length === 0) {
      cleanedPasos.push({
        id: `paso-${Date.now()}-1`,
        titulo: 'Ejecutar entrega principal',
        hecho: false,
      });
    }

    const createdMission: WeeklyMission = {
      id: `mision-${Date.now()}`,
      title: titleTrim,
      weekStart: selectedWeek,
      resultadoEsperado: resultadoTrim,
      frente: newFrente,
      tipo: newTipo,
      projectId: newProjectId || undefined,
      presupuestoHoras: Number(newPresupuestoHoras) || 4,
      pasos: cleanedPasos,
      diasPlanificados: newDias.length > 0 ? newDias : ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
      estado: 'activa',
      orden: weekMissions.length,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    onSaveMission(createdMission);
    setShowNewMissionModal(false);
    hapticFeedback.success();
  };

  // Convertir sugerencia de proyecto activo en misión con 1 clic
  const handleQuickConvertProjectToMission = (proj: Project) => {
    const limitCheck = checkMissionLimit(selectedWeek, 'mision', missions, config);
    if (!limitCheck.allowed) {
      alert(limitCheck.reason);
      return;
    }

    const isPaf = proj.projectType?.startsWith('paf');
    const createdMission: WeeklyMission = {
      id: `mision-${Date.now()}`,
      title: `Avance: ${proj.clientName}`,
      weekStart: selectedWeek,
      resultadoEsperado: `Entregar avance acordado y validar próximos pasos con ${proj.clientName}`,
      frente: isPaf ? 'PAF' : 'Webs',
      tipo: 'mision',
      projectId: proj.id,
      presupuestoHoras: 5,
      pasos: [
        { id: `p-${Date.now()}-1`, titulo: 'Preparar entregable semanal', hecho: false },
        { id: `p-${Date.now()}-2`, titulo: 'Revisión y feedback con el cliente', hecho: false },
        { id: `p-${Date.now()}-3`, titulo: 'Ajustes finales y registro de horas', hecho: false },
      ],
      diasPlanificados: ['lunes', 'miercoles', 'viernes'],
      estado: 'activa',
      orden: weekMissions.length,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    onSaveMission(createdMission);
    hapticFeedback.success();
  };

  // Cambiar estado de paso dentro de una misión
  const handleTogglePaso = (mission: WeeklyMission, pasoId: string) => {
    hapticFeedback.light();
    const updatedPasos = (mission.pasos || []).map(p => 
      p.id === pasoId ? { ...p, hecho: !p.hecho } : p
    );
    const allDone = updatedPasos.length > 0 && updatedPasos.every(p => p.hecho);

    onSaveMission({
      ...mission,
      pasos: updatedPasos,
      estado: allDone ? 'terminada' : (mission.estado === 'terminada' ? 'activa' : mission.estado),
      completed: allDone,
    });
  };

  // Arrastrar misión a la próxima semana
  const handleArrastrarMission = (mission: WeeklyMission) => {
    hapticFeedback.medium();
    const nextWeekStart = addDays(mission.weekStart, 7);

    // 1. Marcar como arrastrada en la semana actual
    onSaveMission({
      ...mission,
      estado: 'arrastrada',
      completed: false,
    });

    // 2. Crear nueva misión activa en la próxima semana conservando pasos pendientes
    const carryMission: WeeklyMission = {
      ...mission,
      id: `mision-${Date.now()}`,
      weekStart: nextWeekStart,
      estado: 'activa',
      completed: false,
      arrastradaFromWeek: mission.weekStart,
      createdAt: new Date().toISOString(),
    };

    onSaveMission(carryMission);
    hapticFeedback.success();
  };

  // Descartar misión con motivo breve
  const handleDescartarMission = (mission: WeeklyMission, motivo: string = '') => {
    hapticFeedback.medium();
    onSaveMission({
      ...mission,
      estado: 'descartada',
      descarteMotivo: motivo.trim() || 'Descartada por el usuario',
      completed: false,
    });
  };

  // Marcar misión como terminada
  const handleTerminarMission = (mission: WeeklyMission) => {
    hapticFeedback.success();
    const updatedPasos = (mission.pasos || []).map(p => ({ ...p, hecho: true }));
    onSaveMission({
      ...mission,
      estado: 'terminada',
      completed: true,
      pasos: updatedPasos,
    });
  };

  // Cierre de Semana
  const handleOpenWeeklyClose = () => {
    hapticFeedback.selection();
    // Pre-cargar decisiones por defecto para las misiones no terminadas
    const decisions: Record<string, { action: 'arrastrar' | 'descartar' | 'terminar'; motivo?: string }> = {};
    activeWeekMissions.forEach(m => {
      if (m.estado !== 'terminada') {
        decisions[m.id] = { action: 'arrastrar' };
      }
    });
    setCarryDecisions(decisions);
    setCloseLearnings('');
    setShowWeeklyClose(true);
  };

  const handleConfirmWeeklyClose = () => {
    hapticFeedback.success();

    // Procesar decisiones
    activeWeekMissions.forEach(m => {
      if (m.estado !== 'terminada') {
        const dec = carryDecisions[m.id];
        if (dec?.action === 'arrastrar') {
          handleArrastrarMission(m);
        } else if (dec?.action === 'descartar') {
          handleDescartarMission(m, dec.motivo);
        } else if (dec?.action === 'terminar') {
          handleTerminarMission(m);
        }
      }
    });

    // Guardar balance en historial
    const terminadasCount = activeWeekMissions.filter(m => m.estado === 'terminada').length;
    const aMediasCount = activeWeekMissions.filter(m => m.estado !== 'terminada').length;

    const historyItem: WeeklyReviewHistoryItem = {
      id: `cierre-${selectedWeek}`,
      weekStart: selectedWeek,
      closedAt: new Date().toISOString(),
      balance: {
        total: activeWeekMissions.length,
        terminadas: terminadasCount,
        aMedias: aMediasCount,
        descartadas: weekMissions.filter(m => m.estado === 'descartada').length,
        arrastradas: Object.values(carryDecisions).filter(d => d.action === 'arrastrar').length,
        horasPresupuestadas: committedHours,
        horasReales: totalRealHours,
      },
      aprendizaje: closeLearnings.trim() || 'Semana completada.',
    };

    saveWeeklyReviewHistoryItem(historyItem);
    setShowWeeklyClose(false);
  };

  // Si hay una misión seleccionada, mostrar la pantalla dedicada de misión (NO MODAL)
  const currentSelectedMission = useMemo(() => {
    if (!selectedMissionId) return null;
    return missions.find(m => m.id === selectedMissionId) || null;
  }, [missions, selectedMissionId]);

  if (currentSelectedMission) {
    return (
      <MissionDedicatedScreen
        mission={currentSelectedMission}
        tasks={tasks}
        meetings={meetings}
        projects={projects}
        onBack={() => setSelectedMissionId(null)}
        onSaveMission={onSaveMission}
        onDeleteMission={(id) => {
          onDeleteMission(id);
          setSelectedMissionId(null);
        }}
        onArrastrar={handleArrastrarMission}
        onDescartar={handleDescartarMission}
        onTerminar={handleTerminarMission}
        onTogglePaso={handleTogglePaso}
        onAddTask={onAddTask}
        onToggleTask={onToggleTask}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header con Navegación de Semana y Selector de Vistas */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Misiones de la Semana
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold border border-[var(--accent)]/20">
                Unidad de Avance
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              Foco en 3 grandes objetivos terminados. Sin dispersión en tareas sueltas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de Semana */}
            <div className="flex items-center bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={handlePrevWeek}
                className="p-1.5 hover:bg-[var(--bg-surface-muted)] rounded-lg text-[var(--text-secondary)] transition cursor-pointer"
                title="Semana anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleCurrentWeek}
                className={`px-3 py-1 font-medium rounded-lg transition cursor-pointer ${
                  selectedWeek === currentWeekMonday
                    ? 'bg-[var(--accent)] text-white font-semibold'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
                }`}
              >
                {selectedWeek === currentWeekMonday ? 'Esta Semana' : `Semana del ${selectedWeek.slice(5)}`}
              </button>

              <button
                type="button"
                onClick={handleNextWeek}
                className="p-1.5 hover:bg-[var(--bg-surface-muted)] rounded-lg text-[var(--text-secondary)] transition cursor-pointer"
                title="Semana siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Pestañas: Carriles vs Historial */}
            <div className="flex items-center bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.selection();
                  setActiveTab('carriles');
                }}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  activeTab === 'carriles'
                    ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Carriles
              </button>
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.selection();
                  setActiveTab('historial');
                }}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'historial'
                    ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Historial</span>
              </button>
            </div>

            {/* Botón Cierre de Semana */}
            <button
              type="button"
              onClick={handleOpenWeeklyClose}
              className="px-3.5 py-1.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              title="Realizar balance y aprendizaje de la semana"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Cierre de Semana</span>
            </button>

            {/* Botón Nueva Misión */}
            <button
              type="button"
              onClick={() => handleOpenNewMission()}
              className="px-4 py-1.5 rounded-xl bg-[var(--accent)] hover:bg-[#d04f0a] text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nueva Misión</span>
            </button>
          </div>
        </div>

        {/* 2. Capacidad vs. Compromiso (Barra con semáforo y horas) */}
        <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--text-primary)]">
                Capacidad vs. Compromiso:
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${capacitySemaphore.bg} ${capacitySemaphore.color}`}>
                {capacitySemaphore.status} ({Math.round(capacityRatio * 100)}%)
              </span>
            </div>

            <div className="flex items-center gap-4 text-[var(--text-secondary)]">
              <span>
                Comprometido: <strong className="text-[var(--text-primary)]">{committedHours}h</strong>
              </span>
              <span>
                Disponible: <strong className="text-[var(--text-primary)]">{weekCapacityHours}h</strong>
              </span>
              <span>
                Tiempo Real: <strong className="text-[var(--accent)]">{totalRealHours.toFixed(1)}h</strong>
              </span>
            </div>
          </div>

          <div className="w-full h-2.5 bg-[var(--bg-app)] rounded-full overflow-hidden border border-[var(--border-subtle)] relative">
            <div 
              className={`h-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300 ${capacitySemaphore.bar}`}
              style={{ width: `${Math.min(100, capacityRatio * 100)}%` }}
            />
          </div>

          {isOverCapacity && (
            <div className="mt-2 flex items-center gap-2 text-xs text-red-400 bg-red-950/40 border border-red-800/40 px-3 py-1.5 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                Atención: El presupuesto de misiones ({committedHours}h) supera la capacidad de la semana ({weekCapacityHours}h).
              </span>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'historial' ? (
        /* Vista Histórica de Semanas Anteriores */
        <WeeklyHistoryView 
          history={reviewHistory} 
          missions={missions}
          onSelectWeek={(w) => {
            setSelectedWeek(w);
            setActiveTab('carriles');
          }}
        />
      ) : (
        /* Vista de Carriles y Planificación Semanal */
        <div className="space-y-6">
          {/* Topes Info Bar (3 grandes + 1 mantenimiento) */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-3">
              <span>
                Tope semanal: <strong className="text-[var(--text-primary)]">{config.maxGrandes} grandes</strong> + <strong className="text-[var(--text-primary)]">{config.maxMantenimiento} mantenimiento</strong>
              </span>
              <span className="text-[var(--text-tertiary)]">·</span>
              <span>
                Grandes activas: <strong className={activeWeekMissions.filter(m => m.tipo === 'mision').length > config.maxGrandes ? 'text-red-400' : 'text-[var(--text-primary)]'}>
                  {activeWeekMissions.filter(m => m.tipo === 'mision').length}/{config.maxGrandes}
                </strong>
              </span>
              <span className="text-[var(--text-tertiary)]">·</span>
              <span>
                Mantenimiento: <strong className="text-[var(--text-primary)]">
                  {activeWeekMissions.filter(m => m.tipo === 'mantenimiento').length}/{config.maxMantenimiento}
                </strong>
              </span>
            </div>

            <div className="text-[11px] text-[var(--text-tertiary)]">
              (Cobros automáticos no ocupan cupo)
            </div>
          </div>

          {/* Carriles de la Semana (Gantt Semanal: Lunes a Domingo) */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 shadow-xs overflow-x-auto">
            {weekMissions.length === 0 ? (
              <div className="text-center py-12">
                <Target className="w-10 h-10 mx-auto text-[var(--text-tertiary)] mb-3 opacity-60" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Sin misiones planificadas para esta semana
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-md mx-auto">
                  Seleccioná hasta 3 objetivos grandes que marquen el avance de tu negocio esta semana.
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleOpenNewMission()}
                    className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[#d04f0a] text-white text-xs font-bold transition cursor-pointer shadow-sm"
                  >
                    + Crear Primera Misión
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-w-[760px] space-y-4">
                {/* Header Días: Lun a Dom */}
                <div className="grid grid-cols-12 gap-2 text-xs border-b border-[var(--border-subtle)] pb-2 font-semibold text-[var(--text-secondary)]">
                  <div className="col-span-5 px-2">Misión & Frente</div>
                  <div className="col-span-7 grid grid-cols-7 gap-1 text-center">
                    {DIAS_SEMANA.map((dia) => {
                      const dayDate = getDateForDiaSemana(selectedWeek, dia.key);
                      const isToday = dayDate === today;
                      return (
                        <div 
                          key={dia.key} 
                          className={`py-1 rounded-lg transition ${
                            isToday ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-bold border border-[var(--accent)]/30' : ''
                          }`}
                        >
                          <div className="text-[11px]">{dia.short}</div>
                          <div className="text-[10px] opacity-75">{dayDate.slice(8)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Filas de Misiones */}
                {weekMissions.map(mission => {
                  const progress = calculateMissionProgress(mission, tasks, meetings, selectedWeek);
                  const ritmo = calculateWeekRitmo(mission, progress, today, selectedWeek);
                  const frenteCfg = FRENTE_CONFIG[mission.frente || 'Otros'];
                  const projectLinked = projects.find(p => p.id === mission.projectId);

                  return (
                    <div 
                      key={mission.id}
                      onClick={() => {
                        hapticFeedback.light();
                        setSelectedMissionId(mission.id);
                      }}
                      className="grid grid-cols-12 gap-2 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] hover:border-[var(--text-tertiary)] transition cursor-pointer group shadow-2xs"
                    >
                      {/* Columna Izquierda: Información de la Misión */}
                      <div className="col-span-5 pr-3 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${frenteCfg.bg} ${frenteCfg.color} border ${frenteCfg.border}`}>
                              {mission.frente}
                            </span>
                            {mission.tipo !== 'mision' && (
                              <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-medium">
                                {mission.tipo}
                              </span>
                            )}
                            {projectLinked && (
                              <span className="text-[10px] text-[var(--text-secondary)] truncate">
                                · {projectLinked.clientName}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition truncate flex-1">
                              {mission.title}
                            </h4>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('¿Eliminar esta misión?')) {
                                  hapticFeedback.heavy();
                                  onDeleteMission(mission.id);
                                }
                              }}
                              className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Eliminar misión"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <p className="text-xs text-[var(--text-secondary)] line-clamp-1 mt-0.5">
                            🎯 {mission.resultadoEsperado}
                          </p>
                        </div>

                        {/* Indicadores de Ritmo y Progreso Numérico */}
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="text-[var(--text-tertiary)] font-medium">
                            {progress.labelProgreso}
                          </span>

                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            ritmo.estado === 'demorada' 
                              ? 'bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse'
                              : ritmo.estado === 'adelantada'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}>
                            {ritmo.mensaje}
                          </span>
                        </div>
                      </div>

                      {/* Columna Derecha: Barra de Carril en Calendario Semanal */}
                      <div className="col-span-7 grid grid-cols-7 gap-1 items-center relative py-1">
                        {DIAS_SEMANA.map((dia) => {
                          const dayDate = getDateForDiaSemana(selectedWeek, dia.key);
                          const isPlanned = mission.diasPlanificados?.includes(dia.key);
                          const isToday = dayDate === today;

                          return (
                            <div 
                              key={dia.key} 
                              className={`h-10 rounded-lg flex items-center justify-center relative transition ${
                                isPlanned 
                                  ? `${frenteCfg.bg} border ${frenteCfg.border}` 
                                  : 'bg-[var(--bg-surface-muted)]/30 border border-transparent'
                              }`}
                            >
                              {/* Línea vertical de HOY */}
                              {isToday && (
                                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-[var(--accent)] z-10 opacity-70 pointer-events-none" />
                              )}

                              {isPlanned && (
                                <div className="text-[10px] font-bold opacity-80" style={{ color: frenteCfg.hex }}>
                                  ✓
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Barra de Relleno según Avance Real */}
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300"
                            style={{ 
                              width: `${progress.avancePct}%`,
                              backgroundColor: frenteCfg.hex,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sugeridas para esta Semana (desde Horizonte / Clientes Activos) */}
          {suggestedProjects.length > 0 && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Sugeridas para esta semana (desde Horizonte)
                </h3>
                <span className="text-xs text-[var(--text-tertiary)]">
                  Clientes activos del mes sin misión asignada
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {suggestedProjects.map(proj => (
                  <div 
                    key={proj.id}
                    className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[var(--text-primary)] truncate">
                        {proj.clientName}
                      </div>
                      <div className="text-[10.5px] text-[var(--text-secondary)]">
                        {proj.projectType?.startsWith('paf') ? 'Consultoría PAF' : 'Web / Identidad'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuickConvertProjectToMission(proj)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-muted)] hover:bg-[var(--accent)] hover:text-white text-[var(--text-primary)] font-semibold transition active:scale-95 shrink-0 cursor-pointer"
                    >
                      Convertir en misión
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Nueva Misión */}
      {showNewMissionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl t-modal-enter">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Nueva Misión de la Semana
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewMissionModal(false)}
                className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMission} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Título */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Título de la Misión *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="ej: Entrega PAF Módulo 1 Estudio Alfa"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  autoFocus
                />
              </div>

              {/* Resultado Esperado */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Resultado Esperado (¿Cuándo está terminada?) *
                </label>
                <input
                  type="text"
                  value={newResultado}
                  onChange={(e) => setNewResultado(e.target.value)}
                  placeholder="ej: Entregables validados y reunión de feedback cerrada"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* Frente & Tipo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Frente *
                  </label>
                  <select
                    value={newFrente}
                    onChange={(e) => setNewFrente(e.target.value as MissionFrente)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                  >
                    <option value="PAF">PAF</option>
                    <option value="Webs">Webs</option>
                    <option value="Contenido">Contenido</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Tipo de Misión *
                  </label>
                  <select
                    value={newTipo}
                    onChange={(e) => setNewTipo(e.target.value as MissionTipo)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                  >
                    <option value="mision">Misión Grande</option>
                    <option value="mantenimiento">Mantenimiento</option>
                    <option value="cobro">Cobro</option>
                  </select>
                </div>
              </div>

              {/* Cliente Vinculado & Presupuesto Horas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Cliente / Proyecto (opcional)
                  </label>
                  <select
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                  >
                    <option value="">Ninguno (Interno / Estudio)</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.clientName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Presupuesto Horas *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    step="0.5"
                    value={newPresupuestoHoras}
                    onChange={(e) => setNewPresupuestoHoras(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Días Planificados */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Días Planificados de Trabajo
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {DIAS_SEMANA.map(dia => {
                    const isSelected = newDias.includes(dia.key);
                    return (
                      <button
                        type="button"
                        key={dia.key}
                        onClick={() => {
                          setNewDias(prev => 
                            isSelected ? prev.filter(d => d !== dia.key) : [...prev, dia.key]
                          );
                        }}
                        className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                          isSelected 
                            ? 'bg-[var(--accent)] text-white' 
                            : 'bg-[var(--bg-app)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--text-tertiary)]'
                        }`}
                      >
                        {dia.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pasos Grandes (3 a 5 pasos) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">
                    Pasos Grandes (3 a 5 hitos)
                  </label>
                  {newPasos.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setNewPasos(prev => [...prev, ''])}
                      className="text-[11px] text-[var(--accent)] font-semibold hover:underline"
                    >
                      + Añadir paso
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {newPasos.map((paso, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-[var(--text-tertiary)] w-4 text-center">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={paso}
                        onChange={(e) => {
                          const updated = [...newPasos];
                          updated[idx] = e.target.value;
                          setNewPasos(updated);
                        }}
                        placeholder={`Paso ${idx + 1}`}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                      />
                      {newPasos.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setNewPasos(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-[var(--text-tertiary)] hover:text-red-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Checkbox Aceptar Sobrecarga */}
              {committedHours + Number(newPresupuestoHoras) > weekCapacityHours && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 text-xs text-amber-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      Esta misión elevará el compromiso semanal a <strong>{committedHours + Number(newPresupuestoHoras)}h</strong> frente a una capacidad de <strong>{weekCapacityHours}h</strong>.
                    </div>
                  </div>
                  <label className="flex items-center gap-2 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptOverCapacity}
                      onChange={(e) => setAcceptOverCapacity(e.target.checked)}
                      className="rounded accent-[var(--accent)]"
                    />
                    <span>Acepto explícitamente la sobrecarga horaria</span>
                  </label>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowNewMissionModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[#d04f0a] text-white text-xs font-bold transition shadow-sm"
                >
                  Confirmar Misión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Cierre de Semana */}
      {showWeeklyClose && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl t-modal-enter">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Cierre de Semana: Balance & Aprendizaje
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWeeklyClose(false)}
                className="p-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Resumen Métrico */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-center text-xs">
                <div>
                  <div className="text-[var(--text-tertiary)]">Terminadas</div>
                  <div className="text-lg font-bold text-emerald-400">
                    {activeWeekMissions.filter(m => m.estado === 'terminada').length}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--text-tertiary)]">Pendientes / A medias</div>
                  <div className="text-lg font-bold text-amber-400">
                    {activeWeekMissions.filter(m => m.estado !== 'terminada').length}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--text-tertiary)]">Horas (Reales / Est)</div>
                  <div className="text-lg font-bold text-[var(--text-primary)]">
                    {totalRealHours.toFixed(1)}h / {committedHours}h
                  </div>
                </div>
              </div>

              {/* Misiones vivas que requieren decisión */}
              {activeWeekMissions.filter(m => m.estado !== 'terminada').length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)] mb-2">
                    Misiones que quedaron vivas: ¿Qué hacemos con ellas?
                  </h4>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {activeWeekMissions.filter(m => m.estado !== 'terminada').map(m => {
                      const dec = carryDecisions[m.id] || { action: 'arrastrar' };
                      return (
                        <div key={m.id} className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] text-xs space-y-2">
                          <div className="font-bold text-[var(--text-primary)] truncate">
                            {m.title}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setCarryDecisions(prev => ({ ...prev, [m.id]: { action: 'arrastrar' } }))}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                dec.action === 'arrastrar' 
                                  ? 'bg-[var(--accent)] text-white' 
                                  : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]'
                              }`}
                            >
                              🚀 Arrastrar a próxima semana
                            </button>

                            <button
                              type="button"
                              onClick={() => setCarryDecisions(prev => ({ ...prev, [m.id]: { action: 'terminar' } }))}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                dec.action === 'terminar' 
                                  ? 'bg-emerald-600 text-white' 
                                  : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]'
                              }`}
                            >
                              ✓ Marcar terminada
                            </button>

                            <button
                              type="button"
                              onClick={() => setCarryDecisions(prev => ({ ...prev, [m.id]: { action: 'descartar', motivo: '' } }))}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                dec.action === 'descartar' 
                                  ? 'bg-red-600 text-white' 
                                  : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]'
                              }`}
                            >
                              ✖ Descartar
                            </button>
                          </div>

                          {dec.action === 'descartar' && (
                            <input
                              type="text"
                              value={dec.motivo || ''}
                              onChange={(e) => setCarryDecisions(prev => ({ ...prev, [m.id]: { action: 'descartar', motivo: e.target.value } }))}
                              placeholder="Motivo breve de descarte"
                              className="w-full px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] mt-1"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Aprendizaje Semanal */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Aprendizaje: ¿Qué funcionó / qué trabó la semana?
                </label>
                <textarea
                  value={closeLearnings}
                  onChange={(e) => setCloseLearnings(e.target.value)}
                  placeholder="ej: Agrupar llamadas los martes permitió foco los miércoles. Faltó estimar mejor el tiempo de revisión con cliente."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* Botón Confirmar */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowWeeklyClose(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmWeeklyClose}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[#d04f0a] text-white text-xs font-bold transition shadow-sm"
                >
                  Confirmar y Guardar Cierre
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * PANTALLA DEDICADA DE MISIÓN (NO MODAL)
 * Tocar una misión en los carriles abre esta vista completa
 */
interface MissionScreenProps {
  mission: WeeklyMission;
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects: Project[];
  onBack: () => void;
  onSaveMission: (m: WeeklyMission) => void;
  onDeleteMission: (id: string) => void;
  onArrastrar: (m: WeeklyMission) => void;
  onDescartar: (m: WeeklyMission, motivo?: string) => void;
  onTerminar: (m: WeeklyMission) => void;
  onTogglePaso: (m: WeeklyMission, pasoId: string) => void;
  onAddTask: (task: Omit<AgendaTask, 'id' | 'createdAt'>) => void;
  onToggleTask: (taskId: string) => void;
  onNavigate: (path: string) => void;
}

const MissionDedicatedScreen: React.FC<MissionScreenProps> = ({
  mission,
  tasks,
  meetings,
  projects,
  onBack,
  onSaveMission,
  onDeleteMission,
  onArrastrar,
  onDescartar,
  onTerminar,
  onTogglePaso,
  onAddTask,
  onToggleTask,
  onNavigate,
}) => {
  const today = getTodayString();
  const progress = calculateMissionProgress(mission, tasks, meetings, mission.weekStart);
  const ritmo = calculateWeekRitmo(mission, progress, today, mission.weekStart);
  const frenteCfg = FRENTE_CONFIG[mission.frente || 'Otros'];
  const projectLinked = projects.find(p => p.id === mission.projectId);

  const [newStepText, setNewStepText] = useState('');
  const [newLinkedTaskText, setNewLinkedTaskText] = useState('');
  const [descarteMotivoInput, setDescarteMotivoInput] = useState('');
  const [showDescartePrompt, setShowDescartePrompt] = useState(false);

  // Tareas vinculadas a esta misión
  const linkedTasks = useMemo(() => {
    return tasks.filter(t => t.missionId === mission.id);
  }, [tasks, mission.id]);

  // Reuniones de la semana que sumaron horas a esta misión
  const linkedMeetings = useMemo(() => {
    const weekSunday = addDays(mission.weekStart, 6);
    return meetings.filter(m => {
      const inWeek = m.date && m.date >= mission.weekStart && m.date <= weekSunday;
      if (!inWeek) return false;
      return m.missionId === mission.id || (mission.projectId && m.projectId === mission.projectId);
    });
  }, [meetings, mission]);

  // Añadir un nuevo paso a la misión
  const handleAddStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepText.trim()) return;

    const newPaso: MissionPaso = {
      id: `p-${Date.now()}`,
      titulo: newStepText.trim(),
      hecho: false,
    };

    onSaveMission({
      ...mission,
      pasos: [...(mission.pasos || []), newPaso],
    });
    setNewStepText('');
    hapticFeedback.light();
  };

  // Añadir una tarea vinculada a esta misión para hoy
  const handleAddLinkedTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkedTaskText.trim()) return;

    onAddTask({
      title: newLinkedTaskText.trim(),
      date: today,
      completed: false,
      missionId: mission.id,
      projectId: mission.projectId,
      projectName: projectLinked?.clientName,
    });

    setNewLinkedTaskText('');
    hapticFeedback.success();
  };

  return (
    <div className="space-y-6">
      {/* Barra Superior con botón Volver */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Misiones de la Semana</span>
        </button>

        <div className="flex items-center gap-2">
          {mission.estado !== 'terminada' && (
            <button
              type="button"
              onClick={() => onTerminar(mission)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Marcar Terminada</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onArrastrar(mission)}
            className="px-3 py-1.5 rounded-xl bg-[var(--bg-surface-muted)] hover:bg-[var(--text-tertiary)] text-[var(--text-primary)] text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Arrastrar a próxima semana"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Arrastrar</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDescartePrompt(true)}
            className="px-3 py-1.5 rounded-xl border border-red-800/40 text-red-400 hover:bg-red-950/40 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Descartar</span>
          </button>
        </div>
      </div>

      {showDescartePrompt && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-xs space-y-2">
          <div className="font-bold text-red-200">
            ¿Confirmás descartar esta misión? Indicá un motivo breve:
          </div>
          <input
            type="text"
            value={descarteMotivoInput}
            onChange={(e) => setDescarteMotivoInput(e.target.value)}
            placeholder="ej: Prioridad cambiada por cliente"
            className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-red-700 text-xs text-white"
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowDescartePrompt(false)}
              className="px-3 py-1 rounded text-zinc-300 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                onDescartar(mission, descarteMotivoInput);
                setShowDescartePrompt(false);
                onBack();
              }}
              className="px-3 py-1 rounded bg-red-600 text-white font-bold"
            >
              Confirmar Descarte
            </button>
          </div>
        </div>
      )}

      {/* Tarjeta Principal de la Misión */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${frenteCfg.bg} ${frenteCfg.color} border ${frenteCfg.border}`}>
                Frente: {mission.frente}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-medium">
                Tipo: {mission.tipo}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase ${
                mission.estado === 'terminada' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--accent)]/20 text-[var(--accent)]'
              }`}>
                {mission.estado}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              {mission.title}
            </h1>

            {projectLinked && (
              <div 
                onClick={() => onNavigate(`/clientes/${projectLinked.id}`)}
                className="mt-1 text-xs text-[var(--accent)] hover:underline cursor-pointer flex items-center gap-1 font-semibold"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Cliente: {projectLinked.clientName} (Ver ficha 360°)</span>
              </div>
            )}
          </div>

          {/* Tarjeta de Progreso Calculado */}
          <div className="p-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] min-w-[240px] text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)] font-medium">Avance Real</span>
              <span className="text-base font-bold text-[var(--text-primary)]">
                {progress.avancePct}%
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300"
                style={{ width: `${progress.avancePct}%`, backgroundColor: frenteCfg.hex }}
              />
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)] pt-1 border-t border-[var(--border-subtle)] space-y-1">
              <div>{progress.labelProgreso}</div>
              <div className="font-semibold text-[var(--text-primary)]">{ritmo.mensaje}</div>
            </div>
          </div>
        </div>

        {/* Resultado Esperado Destacado */}
        <div className="p-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs">
          <div className="text-[10.5px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
            🎯 Resultado Esperado (Criterio de éxito)
          </div>
          <div className="text-sm font-semibold text-[var(--text-primary)] italic">
            "{mission.resultadoEsperado}"
          </div>
        </div>

        {/* Pasos Grandes (3 a 5 pasos) */}
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-[var(--accent)]" />
            <span>Pasos Grandes ({progress.pasosHechos}/{progress.totalPasos})</span>
          </h3>

          <div className="space-y-2">
            {(mission.pasos || []).map((paso) => (
              <div 
                key={paso.id}
                onClick={() => onTogglePaso(mission, paso.id)}
                className={`p-3 rounded-xl border flex items-center gap-3 transition cursor-pointer ${
                  paso.hecho
                    ? 'bg-zinc-950/40 border-zinc-800/60 opacity-60'
                    : 'bg-[var(--bg-app)] border-[var(--border-subtle)] hover:border-[var(--text-tertiary)]'
                }`}
              >
                <button
                  type="button"
                  className={`w-5 h-5 rounded-lg flex items-center justify-center transition ${
                    paso.hecho ? 'bg-emerald-600 text-white' : 'border border-[var(--border-subtle)]'
                  }`}
                >
                  {paso.hecho && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </button>
                <span className={`text-xs font-medium flex-1 ${paso.hecho ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
                  {paso.titulo}
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddStep} className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={newStepText}
              onChange={(e) => setNewStepText(e.target.value)}
              placeholder="+ Añadir nuevo paso grande"
              className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-[var(--bg-surface-muted)] hover:bg-[var(--accent)] hover:text-white text-xs font-semibold transition"
            >
              Agregar
            </button>
          </form>
        </div>

        {/* Tareas de la Agenda Vinculadas a esta Misión */}
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--accent)]" />
            <span>Tareas Diarias Vinculadas ({linkedTasks.length})</span>
          </h3>

          <div className="space-y-2">
            {linkedTasks.length === 0 ? (
              <p className="text-xs text-[var(--text-tertiary)] italic">
                No hay tareas de agenda asignadas a esta misión aún.
              </p>
            ) : (
              linkedTasks.map(task => (
                <div 
                  key={task.id}
                  className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => onToggleTask(task.id)}
                      className={`w-4 h-4 rounded flex items-center justify-center transition ${
                        task.completed ? 'bg-emerald-600 text-white' : 'border border-[var(--border-subtle)]'
                      }`}
                    >
                      {task.completed && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                    <span className={`truncate ${task.completed ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
                      {task.title}
                    </span>
                    <span className="text-[10.5px] text-[var(--text-tertiary)]">
                      ({task.date})
                    </span>
                  </div>

                  <div className="text-[11px] text-[var(--text-secondary)] font-mono">
                    {task.tiempoRealMin ? `${task.tiempoRealMin}m real` : ''}
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddLinkedTask} className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={newLinkedTaskText}
              onChange={(e) => setNewLinkedTaskText(e.target.value)}
              placeholder="+ Crear tarea puntual de agenda vinculada a esta misión"
              className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold transition"
            >
              Crear tarea
            </button>
          </form>
        </div>

        {/* Reuniones que computan horas */}
        {linkedMeetings.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>Reuniones Computadas ({linkedMeetings.length})</span>
            </h3>
            <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
              {linkedMeetings.map(m => (
                <div key={m.id} className="p-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-between">
                  <span>{m.title} ({m.date})</span>
                  <span className="font-mono text-[var(--accent)]">+{m.durationHours || 1}h</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Zona de peligro / Eliminar Misión */}
        <div className="pt-6 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('¿Estás seguro de eliminar permanentemente esta misión?')) {
                hapticFeedback.heavy();
                onDeleteMission(mission.id);
                onBack();
              }
            }}
            className="px-4 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-800/60 text-red-400 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Eliminar Misión Permanentemente</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * VISTA HISTÓRICA DE SEMANAS ANTERIORES
 */
interface HistoryProps {
  history: WeeklyReviewHistoryItem[];
  missions: WeeklyMission[];
  onSelectWeek: (weekStart: string) => void;
}

const WeeklyHistoryView: React.FC<HistoryProps> = ({
  history,
  missions,
  onSelectWeek,
}) => {
  if (history.length === 0) {
    return (
      <div className="p-12 text-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl">
        <History className="w-10 h-10 mx-auto text-[var(--text-tertiary)] mb-3 opacity-60" />
        <h3 className="text-base font-bold text-[var(--text-primary)]">
          Aún no hay cierres registrados en el historial
        </h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Al finalizar una semana, usá el botón "Cierre de Semana" para registrar tu balance y aprendizajes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map(item => (
        <div 
          key={item.id}
          className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <h4 className="text-sm font-bold text-[var(--text-primary)]">
                Semana del {item.weekStart}
              </h4>
            </div>

            <button
              type="button"
              onClick={() => onSelectWeek(item.weekStart)}
              className="text-xs text-[var(--accent)] hover:underline font-semibold cursor-pointer"
            >
              Ver misiones de esa semana →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
              <div className="text-[var(--text-tertiary)] text-[10.5px]">Terminadas</div>
              <div className="text-base font-bold text-emerald-400">{item.balance.terminadas}/{item.balance.total}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
              <div className="text-[var(--text-tertiary)] text-[10.5px]">Arrastradas</div>
              <div className="text-base font-bold text-amber-400">{item.balance.arrastradas}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
              <div className="text-[var(--text-tertiary)] text-[10.5px]">Descartadas</div>
              <div className="text-base font-bold text-zinc-400">{item.balance.descartadas}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)]">
              <div className="text-[var(--text-tertiary)] text-[10.5px]">Horas Reales</div>
              <div className="text-base font-bold text-[var(--text-primary)]">{item.balance.horasReales}h / {item.balance.horasPresupuestadas}h</div>
            </div>
          </div>

          {item.aprendizaje && (
            <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] block mb-0.5">
                Aprendizaje registrado
              </span>
              <p className="text-[var(--text-secondary)] italic">
                "{item.aprendizaje}"
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
