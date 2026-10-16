import React, { useState, useMemo } from 'react';
import { Project, IncomeRecord, ExpenseRecord, RecurringIncomePlan } from '../types';
import { 
  deriveHorizonProject, 
  generateHorizonMonths, 
  calculateMonthlyOccupancy, 
  calculateFrentesWeight, 
  calculateBarPosition, 
  calculateTodayPosition, 
  generateHorizonSummarySentence,
  getHorizonCapacity,
  setHorizonCapacity,
  getHorizonTargetGoalARS,
  setHorizonTargetGoalARS,
  getIncludeLeadsSetting,
  setIncludeLeadsSetting,
  HorizonFrente,
  DerivedHorizonProject
} from '../utils/horizon';
import { getLeadProbabilities, saveStandaloneRetainer } from '../utils/monthlyCashProjection';
import { hapticFeedback } from '../utils/haptics';
import { 
  Compass, 
  Calendar, 
  Users, 
  Building2, 
  Globe, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  ArrowLeft,
  Sparkles,
  Sliders,
  DollarSign,
  TrendingUp,
  Target,
  Check,
  Plus,
  AlertTriangle,
  Repeat,
  Info
} from 'lucide-react';
import { RegisterRecurringIncomeModal } from '../components/RegisterRecurringIncomeModal';
import { AssignProjectDatesModal } from '../components/AssignProjectDatesModal';
import { todayLocal } from '../utils/dates';

interface Props {
  projects: Project[];
  incomes?: IncomeRecord[];
  expenses?: ExpenseRecord[];
  usdRate?: number;
  privacyMode?: boolean;
  onNavigate: (path: string) => void;
  onBack?: () => void;
  onAddProject?: (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateProject?: (id: string, updates: Partial<Project>) => void;
  onDeleteProject?: (id: string) => void;
  onAddRecurringPlan?: (plan: RecurringIncomePlan, targetProjectId?: string) => void;
}

export const HorizonView: React.FC<Props> = ({
  projects,
  incomes = [],
  expenses = [],
  usdRate = 1250,
  privacyMode = false,
  onNavigate,
  onBack,
  onUpdateProject,
  onDeleteProject,
  onAddRecurringPlan,
}) => {
  // 1. Controls State - 3 meses por defecto para foco en flujo de caja real
  const [rangeMonths, setRangeMonths] = useState<3 | 6 | 12>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('cero_horizon_range');
      if (saved === '3' || saved === '6' || saved === '12') return parseInt(saved, 10) as any;
    }
    return 3;
  });

  const [selectedFrente, setSelectedFrente] = useState<HorizonFrente | 'todos'>('todos');
  
  // Leads por defecto apagados (false) para no inflar la meta
  const [includeLeads, setIncludeLeads] = useState<boolean>(() => getIncludeLeadsSetting());

  const [capacity, setCapacityState] = useState<number>(() => getHorizonCapacity());
  const [editingCapacity, setEditingCapacity] = useState<boolean>(false);
  const [capacityInput, setCapacityInput] = useState<string>(() => String(getHorizonCapacity()));

  // Meta mensual (por defecto $1.500.000 ARS)
  const [targetGoalARS, setTargetGoalARSState] = useState<number>(() => getHorizonTargetGoalARS());
  const [editingTargetGoal, setEditingTargetGoal] = useState<boolean>(false);
  const [targetGoalInput, setTargetGoalInput] = useState<string>(() => String(getHorizonTargetGoalARS()));

  const [frontWeightMode, setFrontWeightMode] = useState<'monto' | 'cantidad'>('monto');
  const [undatedCollapsed, setUndatedCollapsed] = useState<boolean>(false);
  
  // Modales
  const [showRecurringModal, setShowRecurringModal] = useState<boolean>(false);
  const [projectToAssignDates, setProjectToAssignDates] = useState<Project | null>(null);

  // Detección de proyectos fantasma antiguos creados por el botón "+ Ingreso Extra"
  const ghostProjects = useMemo(() => {
    return projects.filter(p => 
      !p.archived &&
      p.serviceType === 'otro' &&
      (p.rubro?.toLowerCase().includes('contrato') || p.rubro?.toLowerCase().includes('ingreso extra'))
    );
  }, [projects]);
  const [hideGhostMigrationBanner, setHideGhostMigrationBanner] = useState(false);

  // Handlers para controles
  const handleRangeChange = (r: 3 | 6 | 12) => {
    hapticFeedback.light();
    setRangeMonths(r);
    try {
      localStorage.setItem('cero_horizon_range', String(r));
    } catch {}
  };

  const handleToggleIncludeLeads = () => {
    hapticFeedback.light();
    const next = !includeLeads;
    setIncludeLeads(next);
    setIncludeLeadsSetting(next);
  };

  const handleSaveCapacity = () => {
    const parsed = parseInt(capacityInput, 10);
    const valid = !isNaN(parsed) && parsed > 0 ? parsed : 4;
    setCapacityState(valid);
    setCapacityInput(String(valid));
    setHorizonCapacity(valid);
    setEditingCapacity(false);
    hapticFeedback.selection();
  };

  const handleSaveTargetGoal = () => {
    const parsed = parseFloat(targetGoalInput);
    const valid = !isNaN(parsed) && parsed > 0 ? parsed : 1500000;
    setTargetGoalARSState(valid);
    setTargetGoalInput(String(valid));
    setHorizonTargetGoalARS(valid);
    setEditingTargetGoal(false);
    hapticFeedback.selection();
  };

  // 2. Procesamiento de Proyectos (Sin fechas inventadas)
  const derivedProjects = useMemo(() => {
    return projects.map(p => deriveHorizonProject(p, usdRate));
  }, [projects, usdRate]);

  // Columnas de meses
  const months = useMemo(() => {
    return generateHorizonMonths(rangeMonths);
  }, [rangeMonths]);

  const timelineStart = months[0].startDay;
  const timelineEnd = months[months.length - 1].endDay;

  // Filtrar proyectos aplicables al cronograma (solo los que tienen fecha y coinciden con filtro)
  const filteredDatedProjects = useMemo(() => {
    return derivedProjects.filter(p => {
      if (!p.hasDates) return false;
      if (selectedFrente !== 'todos' && p.frente !== selectedFrente) return false;
      if (!includeLeads && p.estado === 'por entrar') return false;
      return true;
    });
  }, [derivedProjects, selectedFrente, includeLeads]);

  // Proyectos sin fechas definidas (ahora se detectan honestamente)
  const undatedProjects = useMemo(() => {
    return derivedProjects.filter(p => !p.hasDates && !p.project.archived);
  }, [derivedProjects]);

  const leadProbabilities = useMemo(() => getLeadProbabilities(), []);

  // Ocupación mensual y proyección de caja 100% idéntica a /finanzas
  const occupancies = useMemo(() => {
    return calculateMonthlyOccupancy(
      derivedProjects, 
      months, 
      capacity, 
      includeLeads, 
      targetGoalARS, 
      incomes, 
      projects, 
      usdRate, 
      leadProbabilities
    );
  }, [derivedProjects, months, capacity, includeLeads, targetGoalARS, incomes, projects, usdRate, leadProbabilities]);

  // Reparto de frentes
  const frentesWeights = useMemo(() => {
    return calculateFrentesWeight(derivedProjects, includeLeads);
  }, [derivedProjects, includeLeads]);

  // Frase resumen ejecutiva
  const summarySentence = useMemo(() => {
    return generateHorizonSummarySentence(filteredDatedProjects, occupancies, months, privacyMode);
  }, [filteredDatedProjects, occupancies, months, privacyMode]);

  // 3. CIFRA DESTACADA: TOTAL DEL MES EN CURSO (Cobrado + Por Cobrar + Retainers)
  const currentMonthOccupancy = occupancies.find(o => o.month.isCurrent) || occupancies[0];
  
  const currentMonthTotalARS = currentMonthOccupancy ? currentMonthOccupancy.totalEstimadoARS : 0;
  const currentMonthCobradoARS = currentMonthOccupancy ? currentMonthOccupancy.cobradoARS : 0;
  const currentMonthPorCobrarARS = currentMonthOccupancy ? currentMonthOccupancy.porCobrarARS : 0;
  const currentMonthRetainersARS = currentMonthOccupancy ? currentMonthOccupancy.retainersARS : 0;

  const currentMonthTotalUSD = currentMonthOccupancy ? currentMonthOccupancy.totalEstimadoUSD : 0;
  const currentMonthCobradoUSD = currentMonthOccupancy ? currentMonthOccupancy.cobradoUSD : 0;
  const currentMonthPorCobrarUSD = currentMonthOccupancy ? currentMonthOccupancy.porCobrarUSD : 0;
  const currentMonthRetainersUSD = currentMonthOccupancy ? currentMonthOccupancy.retainersUSD : 0;

  const currentMonthLeadsPonderadoARS = currentMonthOccupancy ? currentMonthOccupancy.leadsPonderadoARS : 0;

  // Barra de progreso hacia la meta: USA EL TOTAL DEL MES EN CURSO
  const currentMonthProgressPercent = targetGoalARS > 0 
    ? Math.min(150, Math.round((currentMonthTotalARS / targetGoalARS) * 100)) 
    : 0;

  // Promedio de los próximos 3 meses (Dato secundario claramente rotulado)
  const next3Months = occupancies.slice(0, 3);
  const avgMonthlyTotalARS = next3Months.length > 0
    ? Math.round(next3Months.reduce((sum, m) => sum + m.totalEstimadoARS, 0) / next3Months.length)
    : 0;

  // Posición de la línea "Hoy" en el Gantt
  const todayLeftPercent = useMemo(() => {
    return calculateTodayPosition(timelineStart, timelineEnd);
  }, [timelineStart, timelineEnd]);

  // Agrupamiento por frente para el Gantt
  const groupedProjects = useMemo(() => {
    const groups: { frente: HorizonFrente; label: string; projects: DerivedHorizonProject[] }[] = [
      { frente: 'PAF', label: 'Método PAF (Arquitectura & Mentoría)', projects: [] },
      { frente: 'Webs', label: 'Proyectos Web & Aplicaciones', projects: [] },
      { frente: 'Otros', label: 'Otros Servicios & Consultoría', projects: [] },
    ];

    filteredDatedProjects.forEach(p => {
      const grp = groups.find(g => g.frente === p.frente);
      if (grp) grp.projects.push(p);
    });

    groups.forEach(g => {
      g.projects.sort((a, b) => (a.inicio || '').localeCompare(b.inicio || ''));
    });

    if (selectedFrente !== 'todos') {
      return groups.filter(g => g.frente === selectedFrente);
    }
    return groups.filter(g => g.projects.length > 0);
  }, [filteredDatedProjects, selectedFrente]);

  // Formateador de moneda
  const formatAmount = (amount: number, currency: 'USD' | 'ARS') => {
    if (privacyMode) return '••••';
    if (currency === 'USD') return `US$ ${Math.round(amount).toLocaleString('en-US')}`;
    return `$ ${Math.round(amount).toLocaleString('es-AR')}`;
  };

  const formatShortDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Convertir proyectos fantasma a abonos recurrentes en un clic
  const handleMigrateGhostProject = (project: Project) => {
    hapticFeedback.success();
    const plan = project.recurringPlans?.[0] || {
      id: `rec_mig_${Date.now()}`,
      title: project.clientName,
      amount: Number(project.montoAcordado || project.estimatedPrice || 0),
      currency: (project.estimatedCurrency || 'ARS') as 'USD' | 'ARS',
      frequency: 'mensual' as const,
      startDate: project.startDate || project.createdAt?.slice(0, 10) || todayLocal(),
      nextDueDate: project.startDate || todayLocal(),
      active: true,
      clientName: project.clientName,
      createdAt: new Date().toISOString(),
    };

    saveStandaloneRetainer(plan);

    if (onDeleteProject) {
      onDeleteProject(project.id);
    } else if (onUpdateProject) {
      onUpdateProject(project.id, { archived: true });
    }
  };

  return (
    <div className="space-y-6 pb-28 min-h-screen text-zinc-100 font-sans">
      {/* 0. Banner de Migración de Proyectos Fantasma Antiguos */}
      {ghostProjects.length > 0 && !hideGhostMigrationBanner && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-200">
                Se detectaron {ghostProjects.length} contratos antiguos creados como proyectos cliente
              </p>
              <p className="text-zinc-400 mt-0.5">
                Para mantener tu lista de clientes limpia, puedes convertirlos a Abonos Recurrentes limpios.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => ghostProjects.forEach(p => handleMigrateGhostProject(p))}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition cursor-pointer shadow-xs"
            >
              Convertir todos a Abonos ({ghostProjects.length})
            </button>
            <button
              type="button"
              onClick={() => setHideGhostMigrationBanner(true)}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              Ignorar
            </button>
          </div>
        </div>
      )}

      {/* Top Header & Navigation Tabs */}
      <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                title="Volver"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-sky-400" />
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white font-heading">
                  Horizonte
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  Largo Plazo & Capacidad
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Línea de tiempo de proyectos y flujo de caja proyectado sincronizado 1:1 con Finanzas
              </p>
            </div>
          </div>

          {/* Switch: Lista | Horizonte */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                onNavigate('/clientes');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>Lista de Clientes</span>
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 text-white shadow-xs transition cursor-default flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span>Horizonte</span>
            </button>
          </div>
        </div>

        {/* 1. Frase Resumen Ejecutiva */}
        <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800/90 flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
          <p className="text-xs sm:text-sm font-medium text-zinc-200 leading-snug">
            {summarySentence}
          </p>
        </div>

        {/* 2. Controles de Filtrado & Capacidad */}
        <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Selector de Rango (3 / 6 / 12 meses) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-400 font-mono">Rango:</span>
            <div className="inline-flex p-0.5 bg-zinc-900 rounded-lg border border-zinc-800">
              {([3, 6, 12] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRangeChange(r)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    rangeMonths === r
                      ? 'bg-zinc-800 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {r}m
                </button>
              ))}
            </div>
          </div>

          {/* Chips de Frente */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            <span className="text-[11px] text-zinc-400 font-mono">Frente:</span>
            {(['todos', 'PAF', 'Webs', 'Otros'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setSelectedFrente(f);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  selectedFrente === f
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80'
                }`}
              >
                {f === 'todos' ? 'Todos' : f}
              </button>
            ))}
          </div>

          {/* Switch "Incluir prospectos" (Default apagado) */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeLeads}
              onChange={handleToggleIncludeLeads}
              className="sr-only"
            />
            <div className={`w-8 h-4 rounded-full transition-colors relative ${includeLeads ? 'bg-sky-500' : 'bg-zinc-800'}`}>
              <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${includeLeads ? 'left-4.5' : 'left-0.5'}`} />
            </div>
            <span className="text-xs text-zinc-300">Mostrar prospectos</span>
          </label>

          {/* Capacidad simultánea */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400 font-mono">Mi capacidad:</span>
            {editingCapacity ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={capacityInput}
                  onChange={e => setCapacityInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveCapacity();
                    if (e.key === 'Escape') setEditingCapacity(false);
                  }}
                  className="w-14 px-2 py-0.5 text-xs rounded bg-zinc-900 border border-sky-500 text-white font-mono text-center focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveCapacity}
                  className="px-2 py-0.5 rounded bg-sky-600 text-white text-[11px] font-bold cursor-pointer"
                >
                  OK
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingCapacity(true)}
                className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 font-mono font-bold flex items-center gap-1 cursor-pointer"
                title="Editar capacidad mensual simultánea"
              >
                <span>{capacity} simultáneos</span>
                <Sliders className="w-3 h-3 text-zinc-400" />
              </button>
            )}
          </div>
        </div>

        {/* 2.5 TARJETA SUPERIOR: TOTAL DEL MES EN CURSO (COBRADO + POR COBRAR + RETAINERS) */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-zinc-900/90 to-zinc-950 border border-emerald-500/30 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-heading">
                    <span>Flujo del Mes en Curso ({currentMonthOccupancy?.month.label || 'Mes Actual'})</span>
                  </h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Sincronizado con Finanzas
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Cobros confirmados + cuotas reales por cobrar + abonos activos del mes
                </p>
              </div>
            </div>

            {/* Quick Actions: Meta & + Abono Recurrente */}
            <div className="flex items-center gap-2 flex-wrap">
              {editingTargetGoal ? (
                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-emerald-500">
                  <span className="text-xs font-mono text-zinc-400 pl-1">$</span>
                  <input
                    type="number"
                    step="50000"
                    value={targetGoalInput}
                    onChange={e => setTargetGoalInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveTargetGoal();
                      if (e.key === 'Escape') setEditingTargetGoal(false);
                    }}
                    className="w-28 px-2 py-1 text-xs rounded bg-zinc-950 text-white font-mono font-bold focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveTargetGoal}
                    className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Guardar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingTargetGoal(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 font-mono flex items-center gap-1.5 cursor-pointer"
                  title="Cambiar meta mensual"
                >
                  <span className="text-zinc-500">Meta:</span>
                  <span className="font-bold text-white">${targetGoalARS.toLocaleString('es-AR')}</span>
                  <Sliders className="w-3 h-3 text-zinc-500" />
                </button>
              )}

              {/* Botón Nuevo Abono Recurrente */}
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setShowRecurringModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                title="Registrar abono mensual fijo o retainer sin crear proyectos cliente ficticios"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Abono Mensual</span>
              </button>
            </div>
          </div>

          {/* Desglose visible del mes: Cobrado / Por Cobrar / Retainers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 pb-1">
            {/* 1. Cobrado */}
            <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-emerald-500/25 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <div>
                  <span className="text-[10.5px] text-zinc-400 block font-medium">Cobrado este mes</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {privacyMode ? '$ ••••••' : `$ ${currentMonthCobradoARS.toLocaleString('es-AR')}`}
                  </span>
                  {currentMonthCobradoUSD > 0 && (
                    <span className="text-[10px] font-mono text-zinc-400 block">
                      + US$ {currentMonthCobradoUSD.toLocaleString('en-US')}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                Confirmado
              </span>
            </div>

            {/* 2. Por Cobrar */}
            <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-sky-500/25 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                <div>
                  <span className="text-[10.5px] text-zinc-400 block font-medium">Por cobrar este mes</span>
                  <span className="text-xs font-mono font-bold text-sky-300">
                    {privacyMode ? '$ ••••••' : `$ ${currentMonthPorCobrarARS.toLocaleString('es-AR')}`}
                  </span>
                  {currentMonthPorCobrarUSD > 0 && (
                    <span className="text-[10px] font-mono text-zinc-400 block">
                      + US$ {currentMonthPorCobrarUSD.toLocaleString('en-US')}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400">
                Cuotas pactadas
              </span>
            </div>

            {/* 3. Retainers / Abonos */}
            <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-violet-500/25 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                <div>
                  <span className="text-[10.5px] text-zinc-400 block font-medium">Abonos recurrentes activos</span>
                  <span className="text-xs font-mono font-bold text-violet-300">
                    {privacyMode ? '$ ••••••' : `$ ${currentMonthRetainersARS.toLocaleString('es-AR')}`}
                  </span>
                  {currentMonthRetainersUSD > 0 && (
                    <span className="text-[10px] font-mono text-zinc-400 block">
                      + US$ {currentMonthRetainersUSD.toLocaleString('en-US')}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">
                Fijo
              </span>
            </div>
          </div>

          {/* Barra de Progreso hacia la Meta Mensual usando el TOTAL DEL MES EN CURSO */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-300 flex items-center gap-1.5 flex-wrap">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Total del mes:</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {privacyMode ? '$ ••••••' : `$ ${currentMonthTotalARS.toLocaleString('es-AR')} ARS`}
                </span>
                {currentMonthTotalUSD > 0 && (
                  <span className="text-zinc-400 text-[11px]">
                    (+ US$ {currentMonthTotalUSD.toLocaleString('en-US')})
                  </span>
                )}
                <span className="text-zinc-500 text-[11px] font-sans">
                  · (1 USD = ${usdRate})
                </span>
              </span>
              <span className={`font-bold ${currentMonthProgressPercent >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {currentMonthProgressPercent}% de la meta
              </span>
            </div>

            {/* Barra Visual */}
            <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 relative">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  currentMonthProgressPercent >= 100 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]' 
                    : 'bg-gradient-to-r from-amber-500 to-emerald-500'
                }`}
                style={{ width: `${Math.min(100, currentMonthProgressPercent)}%` }}
              />
            </div>

            {/* Pie de meta: Faltante + Dato Secundario de Promedio 3 Meses */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-zinc-400 pt-0.5 gap-1.5">
              <div className="flex items-center gap-2">
                {currentMonthProgressPercent >= 100 ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> ¡Meta mensual de ${(targetGoalARS / 1000).toFixed(0)}k alcanzada!
                  </span>
                ) : (
                  <span>
                    Faltan ${(targetGoalARS - currentMonthTotalARS).toLocaleString('es-AR')} para los ${targetGoalARS.toLocaleString('es-AR')}
                  </span>
                )}

                {/* Si hay leads, mostrar potencial ponderado SEPARADO */}
                {includeLeads && currentMonthLeadsPonderadoARS > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-sky-300 font-mono text-[10px] border border-sky-500/20">
                    +${(currentMonthLeadsPonderadoARS / 1000).toFixed(0)}k potencial ponderado (no confirmado)
                  </span>
                )}
              </div>

              {/* Dato secundario explícito: Promedio próximos 3 meses */}
              <div className="text-zinc-500 font-mono text-[10.5px]">
                Promedio próximos 3 meses: <strong className="text-zinc-300">${avgMonthlyTotalARS.toLocaleString('es-AR')} ARS/mes</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Gantt Simple & Cronograma Real */}
      <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Header con Leyenda de Estados */}
        <div className="p-3.5 sm:p-4 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-white">Cronograma Gantt ({filteredDatedProjects.length} proyectos con fechas)</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-zinc-400 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-xs bg-zinc-600 inline-block" />
              <span>No comenzó</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-xs bg-emerald-500 inline-block" />
              <span>Activo (PAF)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-xs bg-sky-500 inline-block" />
              <span>Activo (Webs)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-xs bg-violet-500 inline-block" />
              <span>Activo (Otros)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-xs border border-dashed border-zinc-400 bg-zinc-800/60 inline-block" />
              <span>Por entrar</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-xs bg-zinc-800 opacity-50 inline-block" />
              <span>Finalizado</span>
            </div>
          </div>
        </div>

        {/* Contenedor del Gantt con Scroll Horizontal */}
        <div className="overflow-x-auto relative">
          <div className="min-w-[720px] sm:min-w-[850px] relative">
            {/* Eje de Meses (Columnas) */}
            <div className="grid grid-cols-12 border-b border-zinc-800/80 bg-zinc-900/60 text-xs">
              <div className="col-span-3 sm:col-span-3 p-3 font-mono font-bold text-zinc-400 uppercase tracking-wider text-[11px] border-r border-zinc-800/80 sticky left-0 bg-zinc-900 z-30 shadow-r">
                Cliente / Proyecto
              </div>

              <div className="col-span-9 sm:col-span-9 grid" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
                {months.map(m => (
                  <div
                    key={m.monthKey}
                    className={`p-2.5 text-center border-r border-zinc-800/60 last:border-r-0 relative ${
                      m.isCurrent ? 'bg-sky-500/10 font-bold text-sky-300' : 'text-zinc-300'
                    }`}
                  >
                    <div className="text-xs font-semibold">{m.shortLabel}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">{m.year}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Marcador vertical de "Hoy" */}
            {todayLeftPercent !== null && (
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{
                  left: `calc(25% + (75% * ${todayLeftPercent / 100}))`,
                }}
              >
                <div className="w-[1.5px] h-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
                <span className="absolute -top-1 -translate-x-1/2 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-sky-500 text-black">
                  Hoy
                </span>
              </div>
            )}

            {/* Filas de Proyectos Agrupadas por Frente */}
            {groupedProjects.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <Compass className="w-10 h-10 mx-auto text-zinc-600 stroke-[1.2]" />
                <p className="text-sm font-semibold text-zinc-300">
                  No hay proyectos con fechas para los filtros seleccionados.
                </p>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Asigna fechas reales en la sección "Proyectos sin fechas" abajo o dentro de cada cliente.
                </p>
              </div>
            ) : (
              groupedProjects.map(group => (
                <div key={group.frente} className="border-b border-zinc-800/80 last:border-b-0">
                  <div className="grid grid-cols-12 bg-zinc-900/40 border-b border-zinc-800/60">
                    <div className="col-span-12 py-1.5 px-3 flex items-center justify-between text-xs sticky left-0 z-25 bg-zinc-900/90">
                      <div className="flex items-center gap-2">
                        {group.frente === 'PAF' ? (
                          <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : group.frente === 'Webs' ? (
                          <Globe className="w-3.5 h-3.5 text-sky-400" />
                        ) : (
                          <Layers className="w-3.5 h-3.5 text-violet-400" />
                        )}
                        <span className="font-bold text-zinc-200">{group.label}</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-400">
                          {group.projects.length}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline">
                        Total acordado: {formatAmount(group.projects.reduce((sum, p) => sum + p.monto, 0), group.projects[0]?.currency || 'ARS')}
                      </span>
                    </div>
                  </div>

                  {group.projects.map(proj => {
                    const pos = calculateBarPosition(proj.inicio!, proj.fin!, timelineStart, timelineEnd);

                    let barClasses = 'h-7 rounded-lg px-2 flex items-center justify-between text-xs font-semibold transition cursor-pointer select-none ';
                    if (proj.estado === 'no comenzó') {
                      barClasses += 'bg-zinc-700/80 border border-zinc-600 text-zinc-200 hover:bg-zinc-600 shadow-xs';
                    } else if (proj.estado === 'por entrar') {
                      barClasses += 'bg-zinc-900/90 border border-dashed border-zinc-400 text-zinc-200 hover:border-white opacity-70 shadow-xs [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.06),rgba(255,255,255,0.06)_6px,transparent_6px,transparent_12px)]';
                    } else if (proj.estado === 'finalizado') {
                      barClasses += 'bg-zinc-800/60 border border-zinc-700/60 text-zinc-400 opacity-50 hover:opacity-80';
                    } else {
                      if (proj.frente === 'PAF') {
                        barClasses += 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/60 text-white shadow-sm';
                      } else if (proj.frente === 'Webs') {
                        barClasses += 'bg-sky-600 hover:bg-sky-500 border border-sky-400/60 text-white shadow-sm';
                      } else {
                        barClasses += 'bg-violet-600 hover:bg-violet-500 border border-violet-400/60 text-white shadow-sm';
                      }
                    }

                    return (
                      <div
                        key={proj.id}
                        className="grid grid-cols-12 border-b border-zinc-850 hover:bg-zinc-900/30 transition items-center"
                      >
                        {/* Nombre del Cliente */}
                        <div
                          onClick={() => {
                            hapticFeedback.light();
                            onNavigate(`/clientes/${proj.id}`);
                          }}
                          className="col-span-3 sm:col-span-3 p-3 flex items-center justify-between gap-2 sticky left-0 bg-zinc-950 z-20 border-r border-zinc-800/80 cursor-pointer group hover:bg-zinc-900 transition"
                          title="Abrir ficha del cliente"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-zinc-200 group-hover:text-sky-300 truncate transition">
                              {proj.clientName}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 mt-0.5">
                              <span>{formatShortDate(proj.inicio)} - {formatShortDate(proj.fin)}</span>
                              {proj.cupos > 1 && (
                                <span className="px-1 py-0.2 rounded bg-zinc-800 text-zinc-300">
                                  {proj.cupos} cupos
                                </span>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-zinc-300 shrink-0 transition" />
                        </div>

                        {/* Barra del Gantt */}
                        <div className="col-span-9 sm:col-span-9 p-2 relative h-12 flex items-center">
                          <div className="absolute inset-0 grid pointer-events-none opacity-20" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
                            {months.map(m => (
                              <div key={m.monthKey} className="border-r border-zinc-700 h-full" />
                            ))}
                          </div>

                          {pos.isVisible ? (
                            <div
                              onClick={() => {
                                hapticFeedback.light();
                                onNavigate(`/clientes/${proj.id}`);
                              }}
                              className={barClasses}
                              style={{
                                marginLeft: `${pos.leftPercent}%`,
                                width: `${pos.widthPercent}%`,
                              }}
                              title={`${proj.clientName}: ${formatShortDate(proj.inicio)} al ${formatShortDate(proj.fin)} · ${proj.hasLoadedCuotas ? formatAmount(proj.monto, proj.currency) : 'Sin cuotas cargadas ($0)'}`}
                            >
                              <span className="truncate pr-1 text-[11px] drop-shadow-xs">
                                {proj.clientName}
                              </span>
                              <span className="text-[10px] font-mono shrink-0 font-bold opacity-90 drop-shadow-xs">
                                {proj.hasLoadedCuotas ? formatAmount(proj.monto, proj.currency) : 'sin cuotas ($0)'}
                              </span>
                            </div>
                          ) : (
                            <div className="text-[10px] font-mono text-zinc-600 italic px-2">
                              Fuera del rango ({formatShortDate(proj.inicio)} - {formatShortDate(proj.fin)})
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}

            {/* 4. Fila de Ocupación por Mes */}
            <div className="grid grid-cols-12 bg-zinc-900 border-t-2 border-zinc-800 text-xs">
              <div className="col-span-3 sm:col-span-3 p-3 font-mono font-bold text-zinc-300 border-r border-zinc-800/80 sticky left-0 bg-zinc-900 z-30">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <span>Ocupación Operativa</span>
                </div>
                <div className="text-[10px] text-zinc-500 font-normal mt-0.5 font-sans">
                  Cupos usados / Capacidad ({capacity})
                </div>
              </div>

              <div className="col-span-9 sm:col-span-9 grid" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
                {occupancies.map(occ => {
                  let badgeClass = 'px-2 py-1 rounded-lg text-xs font-bold font-mono inline-flex items-center gap-1 ';
                  if (occ.status === 'green') {
                    badgeClass += 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
                  } else if (occ.status === 'yellow') {
                    badgeClass += 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
                  } else {
                    badgeClass += 'bg-red-500/15 text-red-400 border border-red-500/30';
                  }

                  return (
                    <div
                      key={occ.month.monthKey}
                      className={`p-2.5 text-center border-r border-zinc-800/60 last:border-r-0 flex flex-col items-center justify-center gap-1 ${
                        occ.month.isCurrent ? 'bg-sky-500/5' : ''
                      }`}
                    >
                      <span className={badgeClass}>
                        {occ.usedSlots}/{occ.capacity}
                      </span>
                      <span className="text-[10px] text-zinc-400 leading-tight">
                        {occ.availableSlots > 0 ? (
                          <span>{occ.availableSlots} {occ.availableSlots === 1 ? 'libre' : 'libres'}</span>
                        ) : occ.availableSlots === 0 ? (
                          <span className="text-red-400 font-bold">Lleno</span>
                        ) : (
                          <span className="text-red-400 font-bold">+{Math.abs(occ.availableSlots)} cupo</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4.1 Fila de Desglose de Caja Mensual (IDÉNTICO A /finanzas) */}
            <div className="grid grid-cols-12 bg-zinc-950 border-t border-zinc-800/80 text-xs">
              <div className="col-span-3 sm:col-span-3 p-3 font-mono font-bold text-zinc-300 border-r border-zinc-800/80 sticky left-0 bg-zinc-950 z-30">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Flujo Mensual Real</span>
                </div>
                <div className="text-[10px] text-zinc-500 font-normal mt-0.5 font-sans">
                  Cobrado · Por cobrar · Retainers
                </div>
              </div>

              <div className="col-span-9 sm:col-span-9 grid" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
                {occupancies.map(occ => {
                  const isCurrent = occ.month.isCurrent;
                  const reachesGoal = occ.totalEstimadoARS >= targetGoalARS;

                  return (
                    <div
                      key={`rev_${occ.month.monthKey}`}
                      className={`p-2.5 text-center border-r border-zinc-800/60 last:border-r-0 flex flex-col items-center justify-center gap-1 ${
                        isCurrent ? 'bg-emerald-950/20' : ''
                      }`}
                    >
                      {/* Total Confirmado del mes */}
                      <span className={`text-xs font-mono font-bold ${reachesGoal ? 'text-emerald-400' : 'text-zinc-200'}`}>
                        {privacyMode ? '$ ••••••' : `$${(occ.totalEstimadoARS / 1000).toFixed(0)}k`}
                      </span>

                      {/* Micro Desglose: C: cobrado | P: por cobrar | R: retainers */}
                      <div className="text-[9.5px] font-mono text-zinc-400 flex items-center gap-1">
                        <span className="text-emerald-400" title="Cobrado">${(occ.cobradoARS / 1000).toFixed(0)}k</span>
                        <span>·</span>
                        <span className="text-sky-300" title="Por cobrar">${(occ.porCobrarARS / 1000).toFixed(0)}k</span>
                        {occ.retainersARS > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-violet-300" title="Retainers">${(occ.retainersARS / 1000).toFixed(0)}k</span>
                          </>
                        )}
                      </div>

                      {/* Progreso meta */}
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                          reachesGoal ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {occ.targetProgressPercent}% meta
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bloque Frentes (Barra Apilada Horizontal) */}
      <div className="bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <span>Reparto de Frentes de Trabajo</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Distribución de tu cartera activa entre Método PAF, Desarrollo Web y Otros
            </p>
          </div>

          <div className="inline-flex p-0.5 bg-zinc-900 rounded-lg border border-zinc-800 self-start sm:self-auto text-xs">
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setFrontWeightMode('monto');
              }}
              className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                frontWeightMode === 'monto'
                  ? 'bg-zinc-800 text-white shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Por monto</span>
            </button>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setFrontWeightMode('cantidad');
              }}
              className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                frontWeightMode === 'cantidad'
                  ? 'bg-zinc-800 text-white shadow-xs font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Por cantidad</span>
            </button>
          </div>
        </div>

        {/* Barra Apilada */}
        <div className="w-full h-4 bg-zinc-900 rounded-full overflow-hidden flex border border-zinc-800">
          {frentesWeights.map(fw => {
            const percent = frontWeightMode === 'monto' ? fw.amountPercent : fw.countPercent;
            if (percent <= 0) return null;
            return (
              <div
                key={fw.frente}
                style={{ width: `${percent}%` }}
                className={`h-full ${fw.colorClass} transition-all duration-300 relative group`}
                title={`${fw.frente}: ${percent}% (${fw.count} proyectos)`}
              />
            );
          })}
        </div>

        {/* Leyenda y Detalle por Frente */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {frentesWeights.map(fw => {
            const percent = frontWeightMode === 'monto' ? fw.amountPercent : fw.countPercent;
            return (
              <div
                key={fw.frente}
                className={`p-3 rounded-xl border ${fw.borderClass} ${fw.bgLightClass} space-y-1`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${fw.dotColor}`} />
                    <span className="font-bold text-xs">{fw.frente}</span>
                  </div>
                  <span className="font-mono font-bold text-xs">{percent}%</span>
                </div>
                <div className="text-[11px] opacity-80 flex items-center justify-between font-mono">
                  <span>{fw.count} {fw.count === 1 ? 'proyecto' : 'proyectos'}</span>
                  <span>{formatAmount(fw.amountARS, 'ARS')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Sección "Proyectos sin fechas" (Honesta y con acción directa para asignar fechas) */}
      <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => {
            hapticFeedback.light();
            setUndatedCollapsed(prev => !prev);
          }}
          className="w-full p-4 flex items-center justify-between bg-zinc-900/60 hover:bg-zinc-900/90 transition text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-sky-400 shrink-0" />
            <div>
              <span className="text-xs sm:text-sm font-bold text-zinc-200">
                Proyectos sin fechas definidas ({undatedProjects.length})
              </span>
              <p className="text-[11px] text-zinc-400">
                No entran al Gantt ni suman ocupación ficticia hasta que les asignes fecha de inicio y fin
              </p>
            </div>
          </div>
          <div className="p-1 rounded-lg bg-zinc-800 text-zinc-400">
            {undatedCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </button>

        {!undatedCollapsed && (
          <div className="p-4 border-t border-zinc-800/80 divide-y divide-zinc-800/60 space-y-2">
            {undatedProjects.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3 text-center">
                Todos tus proyectos activos tienen fechas de inicio y fin definidas.
              </p>
            ) : (
              undatedProjects.map(proj => (
                <div
                  key={proj.id}
                  className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-200 truncate">
                      {proj.clientName}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-2 mt-0.5">
                      <span>Frente: {proj.frente}</span>
                      <span>·</span>
                      <span>Estado: {proj.estado}</span>
                      <span>·</span>
                      <span>{proj.hasLoadedCuotas ? formatAmount(proj.monto, proj.currency) : 'Sin cuotas ($0)'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProjectToAssignDates(proj.project)}
                      className="px-3 py-1.5 rounded-xl bg-sky-600/30 hover:bg-sky-600/40 border border-sky-500/40 text-sky-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Asignar fechas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate(`/clientes/${proj.id}`)}
                      className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                      title="Abrir ficha completa"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal para Registrar Abono Recurrente Limpio */}
      {showRecurringModal && (
        <RegisterRecurringIncomeModal
          isOpen={showRecurringModal}
          onClose={() => setShowRecurringModal(false)}
          projects={projects}
          onSaveRecurringPlan={(plan, targetProjectId) => {
            if (onAddRecurringPlan) {
              onAddRecurringPlan(plan, targetProjectId);
            } else if (targetProjectId && onUpdateProject) {
              const target = projects.find(p => p.id === targetProjectId);
              if (target) {
                const existing = target.recurringPlans || [];
                onUpdateProject(targetProjectId, { recurringPlans: [...existing, plan] });
              }
            } else {
              saveStandaloneRetainer(plan);
            }
            setShowRecurringModal(false);
          }}
        />
      )}

      {/* Modal para Asignar Fechas a Proyectos Sin Fecha */}
      {projectToAssignDates && (
        <AssignProjectDatesModal
          isOpen={Boolean(projectToAssignDates)}
          onClose={() => setProjectToAssignDates(null)}
          project={projectToAssignDates}
          onSaveDates={(projId, startDate, deliveryDate) => {
            if (onUpdateProject) {
              onUpdateProject(projId, {
                startDate,
                deliveryDate,
                horizonStart: startDate,
                horizonEnd: deliveryDate,
              });
            }
            setProjectToAssignDates(null);
          }}
        />
      )}
    </div>
  );
};

export default HorizonView;
