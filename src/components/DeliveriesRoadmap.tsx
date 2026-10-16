import React, { useState } from 'react';
import { Project, AgendaTask, ProjectType } from '../types';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  FolderKanban, 
  ExternalLink,
  Flame,
  Filter,
  LayoutGrid,
  List
} from 'lucide-react';
import { 
  MONTH_NAMES, 
  formatDate, 
  parseDate, 
  addDays, 
  getTodayString,
  getWeekMonday
} from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  projects: Project[];
  tasks?: AgendaTask[];
  onSelectProject: (project: Project) => void;
  onUpdateProjectDeliveryDate: (projectId: string, date: string) => void;
}

export const DeliveriesRoadmap: React.FC<Props> = ({
  projects,
  tasks = [],
  onSelectProject,
  onUpdateProjectDeliveryDate,
}) => {
  const today = getTodayString();
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth()); // 0-11
  const [typeFilter, setTypeFilter] = useState<'todos' | ProjectType>('todos');
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline'>('calendar');

  // Month Navigation
  const handlePrevMonth = () => {
    hapticFeedback.selection();
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    hapticFeedback.selection();
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleGoToToday = () => {
    hapticFeedback.selection();
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  const monthStr = String(currentMonth + 1).padStart(2, '0');
  const currentMonthPrefix = `${currentYear}-${monthStr}`;

  // Filter projects with delivery dates or active
  const filteredProjects = projects.filter(p => {
    if (p.archived) return false;
    if (typeFilter !== 'todos' && p.projectType !== typeFilter) return false;
    return true;
  });

  const projectsWithDeliveriesInMonth = filteredProjects.filter(p => {
    return p.deliveryDate && p.deliveryDate.startsWith(currentMonthPrefix);
  });

  // Calculate bottlenecks: group by week
  const weekDeliveryCounts: Record<string, Project[]> = {};
  filteredProjects.forEach(p => {
    if (p.deliveryDate && p.deliveryDate.startsWith(currentMonthPrefix)) {
      const weekMonday = getWeekMonday(p.deliveryDate);
      if (!weekDeliveryCounts[weekMonday]) weekDeliveryCounts[weekMonday] = [];
      weekDeliveryCounts[weekMonday].push(p);
    }
  });

  // Any week with 2 or more deliveries is a bottleneck candidate
  const bottleneckWeeks = Object.entries(weekDeliveryCounts).filter(([_, list]) => list.length >= 2);

  // Calendar Grid calculations
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  
  // Starting day of week (Monday=1, Sunday=0) -> convert to Monday=0
  const startingDay = (firstDayOfMonth.getDay() + 6) % 7;

  const calendarDays: { dayNum: number; dateStr: string; isCurrentMonth: boolean }[] = [];

  // Previous month filler days
  for (let i = startingDay - 1; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth, -i);
    calendarDays.push({
      dayNum: d.getDate(),
      dateStr: formatDate(d),
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, '0');
    calendarDays.push({
      dayNum: d,
      dateStr: `${currentYear}-${monthStr}-${dayStr}`,
      isCurrentMonth: true,
    });
  }

  // Next month filler days (to complete 35 or 42 grid slots)
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(currentYear, currentMonth + 1, i);
    calendarDays.push({
      dayNum: d.getDate(),
      dateStr: formatDate(d),
      isCurrentMonth: false,
    });
  }

  const getTypeBadge = (type?: ProjectType) => {
    switch (type) {
      case 'paf_pro':
        return <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">PAF Pro (12s)</span>;
      case 'paf_base':
        return <span className="px-1.5 py-0.5 rounded-md bg-orange-500/20 text-orange-300 text-[10px] font-bold border border-orange-500/30">PAF Base</span>;
      case 'web':
        return <span className="px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-semibold border border-cyan-500/30">Web / Landing</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-[10px]">Proyecto</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-zinc-950 border border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#E8590C]/10 border border-[#E8590C]/30 flex items-center justify-center text-[#E8590C] shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
              Roadmap & Cronograma Visual de Entregas
            </h2>
            <p className="text-xs text-zinc-400">
              Control mensual de plazos, fechas límite de proyectos y hitos del Método PAF
            </p>
          </div>
        </div>

        {/* View Mode Toggle & Month Controls */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* View Mode: Calendar vs Chronological List */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-2xl p-1">
            <button
              onClick={() => {
                hapticFeedback.selection();
                setViewMode('calendar');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'calendar' ? 'bg-[#E8590C] text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Vista de Calendario Mensual (Lun a Dom)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Calendario</span>
            </button>
            <button
              onClick={() => {
                hapticFeedback.selection();
                setViewMode('timeline');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'timeline' ? 'bg-[#E8590C] text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Vista Cronograma Lineal Semana por Semana"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cronograma</span>
            </button>
          </div>

          {/* Month Selector Controls */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-2xl p-1">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs sm:text-sm font-bold text-zinc-100 min-w-[130px] text-center font-mono">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleGoToToday}
            className="px-3 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 transition"
          >
            Hoy
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs text-zinc-500 flex items-center gap-1 pl-1 shrink-0">
          <Filter className="w-3.5 h-3.5" /> Filtrar:
        </span>
        {[
          { id: 'todos', label: 'Todos los Proyectos' },
          { id: 'paf_pro', label: '⭐ PAF Pro (12 Sem)' },
          { id: 'paf_base', label: 'PAF Base' },
          { id: 'web', label: 'Web / Landing' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              hapticFeedback.selection();
              setTypeFilter(tab.id as any);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              typeFilter === tab.id
                ? 'bg-[#E8590C] text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bottleneck Warning Banner */}
      {bottleneckWeeks.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/60 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-bold text-amber-300">
              ⚠️ Detección de Cuello de Botella Operativo
            </div>
            <div className="text-zinc-300">
              Hay semanas con 2 o más entregas simultáneas programadas. Recomendamos espaciar las revisiones para no saturar tu capacidad de entrega:
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {bottleneckWeeks.map(([weekMonday, projs]) => (
                <div key={weekMonday} className="px-2.5 py-1 rounded-xl bg-amber-900/40 border border-amber-700/50 text-[11px] text-amber-200">
                  Semana del {weekMonday}: <strong className="text-white">{projs.map(p => p.clientName).join(', ')}</strong> ({projs.length} entregas)
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Calendar View vs Chronological Timeline */}
      {viewMode === 'calendar' ? (
        <div className="rounded-3xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-sm">
          {/* Helper hint for mobile / small screens */}
          <div className="md:hidden px-3 py-1.5 bg-zinc-900/60 border-b border-zinc-800/80 text-[10px] text-zinc-400 flex items-center justify-between">
            <span>Desliza horizontalmente para ver la semana completa (Lun a Dom)</span>
            <span className="text-[#E8590C] font-semibold">7 columnas →</span>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[660px] sm:min-w-full">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-zinc-800/80 bg-zinc-900/40 text-center text-xs font-bold text-zinc-400 py-2.5">
                <span>Lun</span>
                <span>Mar</span>
                <span>Mié</span>
                <span>Jue</span>
                <span>Vie</span>
                <span className="text-zinc-500">Sáb</span>
                <span className="text-zinc-500">Dom</span>
              </div>

              {/* Day Grid */}
              <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-zinc-800/50">
                {calendarDays.map((cell, idx) => {
                  const isToday = cell.dateStr === today;
                  // Find projects with delivery date on this exact day
                  const dayDeliveries = filteredProjects.filter(p => p.deliveryDate === cell.dateStr);

                  return (
                    <div
                      key={idx}
                      className={`min-h-[105px] sm:min-h-[120px] p-1.5 sm:p-2 transition flex flex-col justify-between ${
                        !cell.isCurrentMonth 
                          ? 'bg-zinc-950/40 opacity-30' 
                          : isToday 
                          ? 'bg-[#E8590C]/5' 
                          : 'bg-zinc-950 hover:bg-zinc-900/40'
                      }`}
                    >
                      {/* Date header */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-mono font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday 
                              ? 'bg-[#E8590C] text-white' 
                              : 'text-zinc-400'
                          }`}
                        >
                          {cell.dayNum}
                        </span>

                        {dayDeliveries.length > 0 && (
                          <span className="text-[10px] font-extrabold text-[#E8590C] bg-[#E8590C]/10 px-1.5 py-0.5 rounded-md border border-[#E8590C]/20">
                            {dayDeliveries.length} {dayDeliveries.length === 1 ? 'Entrega' : 'Entregas'}
                          </span>
                        )}
                      </div>

                      {/* Delivery Cards inside date cell */}
                      <div className="space-y-1 flex-1 overflow-hidden">
                        {dayDeliveries.map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              hapticFeedback.light();
                              onSelectProject(p);
                            }}
                            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-[#E8590C] cursor-pointer transition text-left group"
                          >
                            <div className="text-[11px] font-bold text-zinc-100 truncate group-hover:text-[#E8590C]">
                              {p.clientName}
                            </div>
                            <div className="flex items-center justify-between gap-1 mt-0.5">
                              <span className="text-[9px] text-zinc-400 truncate">
                                {p.status}
                              </span>
                              {p.projectType === 'paf_pro' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Timeline View: Chronological by Weeks */
        <div className="space-y-3">
          {projectsWithDeliveriesInMonth.length === 0 ? (
            <div className="p-8 rounded-3xl bg-zinc-950 border border-zinc-800 text-center text-xs text-zinc-500">
              No hay entregas programadas en {MONTH_NAMES[currentMonth]} {currentYear}.
            </div>
          ) : (
            <div className="rounded-3xl bg-zinc-950 border border-zinc-800 p-4 sm:p-5 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#E8590C]" />
                <span>Cronograma Lineal Ordenado por Fecha de Entrega</span>
              </div>
              <div className="space-y-2">
                {projectsWithDeliveriesInMonth
                  .slice()
                  .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''))
                  .map(p => {
                    const dDate = p.deliveryDate || '';
                    const diffDays = Math.round((parseDate(dDate).getTime() - parseDate(today).getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div
                        key={p.id}
                        onClick={() => onSelectProject(p)}
                        className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-[#E8590C] cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-200 font-mono font-bold text-xs text-center shrink-0">
                            {p.deliveryDate}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-zinc-100 truncate">
                              {p.clientName}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {getTypeBadge(p.projectType)}
                              <span className="text-[11px] text-zinc-400 truncate">{p.status}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-xl ${
                            diffDays < 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                            diffDays === 0 ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {diffDays < 0 ? `Vencido (${Math.abs(diffDays)}d)` : diffDays === 0 ? '¡Vence Hoy!' : `En ${diffDays} días`}
                          </span>
                          <span className="text-xs text-[#E8590C] font-semibold hover:underline">Abrir Ficha 360 →</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deliveries List / Detail for this Month */}
      <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
            <span>Listado de Entregas Programadas ({projectsWithDeliveriesInMonth.length})</span>
          </h3>
          <span className="text-xs text-zinc-500 font-mono">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>
        </div>

        {projectsWithDeliveriesInMonth.length === 0 ? (
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
            No hay proyectos con fecha límite o entrega en este mes. Puedes asignar una fecha de entrega en la ficha de cada proyecto para que aparezca en el cronograma.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {projectsWithDeliveriesInMonth.map(p => {
              const dDate = p.deliveryDate || '';
              const diffDays = Math.round((parseDate(dDate).getTime() - parseDate(today).getTime()) / (1000 * 60 * 60 * 24));
              
              return (
                <div
                  key={p.id}
                  onClick={() => onSelectProject(p)}
                  className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900 cursor-pointer transition flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-zinc-100 truncate">
                        {p.clientName}
                      </div>
                      <div className="mt-1">
                        {getTypeBadge(p.projectType)}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-zinc-200">
                        {p.deliveryDate}
                      </div>
                      <div className={`text-[10px] font-semibold mt-0.5 ${
                        diffDays < 0 ? 'text-red-400' : diffDays <= 2 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {diffDays < 0 ? `Atrasado ${Math.abs(diffDays)}d` : diffDays === 0 ? '¡Vence HOY!' : `Faltan ${diffDays} días`}
                      </div>
                    </div>
                  </div>

                  {/* PAF Pro Progress Bar if applicable */}
                  {p.projectType === 'paf_pro' && (
                    <div className="pt-2 border-t border-zinc-800/60">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                        <span>Mentoría 1:1</span>
                        <span className="font-mono text-amber-400">{p.pafConsultingHoursDone || 0} / 26 hs</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-amber-400 h-full rounded-full"
                          style={{ width: `${Math.min(100, ((p.pafConsultingHoursDone || 0) / 26) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
