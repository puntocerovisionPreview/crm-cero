import React, { useState } from 'react';
import { Project, IncomeRecord, ProjectInstallment } from '../types';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  MessageCircle, 
  ChevronRight, 
  ChevronLeft, 
  CreditCard,
  Building2,
  Sparkles,
  ArrowUpRight,
  Filter,
  Check,
  ExternalLink
} from 'lucide-react';
import { 
  calculateActiveClientsMonthlyProjection, 
  getPaymentUrgency, 
  buildInstallmentWhatsAppMessage,
  formatCurrencyAmount,
  MonthlyProjectedRevenue
} from '../utils/paymentPlans';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';

interface Props {
  projects: Project[];
  incomes: IncomeRecord[];
  onSelectProject?: (project: Project) => void;
  onUpdateProject?: (id: string, updates: Partial<Project>) => void;
  onToggleIncomeStatus?: (id: string) => void;
  privacyMode?: boolean;
}

export const ActiveClientsCashflowProjection: React.FC<Props> = ({
  projects,
  incomes,
  onSelectProject,
  onUpdateProject,
  onToggleIncomeStatus,
  privacyMode = false,
}) => {
  // Default to current month or first month with pending items
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(() => {
    const data = calculateActiveClientsMonthlyProjection(projects, incomes);
    const currentIdx = data.monthlyProjections.findIndex(m => m.isCurrentMonth);
    return currentIdx >= 0 ? currentIdx : 0;
  });
  const [viewMode, setViewMode] = useState<'carousel' | 'grid'>('grid');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'paf' | 'web'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'USD' | 'ARS'>('all');

  const projectionData = calculateActiveClientsMonthlyProjection(projects, incomes);
  const {
    activeClientsCount,
    activePayingClientsCount,
    monthlyProjections,
    currentMonthProjectedUSD,
    currentMonthProjectedARS,
    nextMonthProjectedUSD,
    nextMonthProjectedARS,
  } = projectionData;

  // Find current month index in monthlyProjections
  const currentMonthIdx = Math.max(0, monthlyProjections.findIndex(m => m.isCurrentMonth));
  const activeMonth = monthlyProjections[selectedMonthIndex] || monthlyProjections[currentMonthIdx] || monthlyProjections[0];

  // Also extract next month projection details for quick explanation
  const nextMonthIdx = (currentMonthIdx + 1) < monthlyProjections.length ? currentMonthIdx + 1 : currentMonthIdx;
  const nextMonthData = monthlyProjections[nextMonthIdx];

  // Filter items in the active month
  const filteredMonthItems = activeMonth?.items.filter(item => {
    const urgency = getPaymentUrgency(item.dueDate, item.paid);
    const matchesStatus = 
      filterStatus === 'all' ? true :
      filterStatus === 'paid' ? item.paid :
      filterStatus === 'overdue' ? (!item.paid && urgency.status === 'overdue') :
      (!item.paid);

    const matchesCurrency = currencyFilter === 'all' || item.currency === currencyFilter;

    const matchesService = 
      serviceFilter === 'all' ? true :
      serviceFilter === 'paf' ? item.serviceCategory === 'paf' :
      serviceFilter === 'web' ? item.serviceCategory === 'web' :
      true;

    return matchesStatus && matchesCurrency && matchesService;
  }) || [];

  const formatMoney = (val: number, cur: 'USD' | 'ARS') => {
    if (privacyMode) return '$ ••••••';
    return formatCurrencyAmount(val, cur, true);
  };

  const handleSendReminder = (item: MonthlyProjectedRevenue['items'][0]) => {
    hapticFeedback.medium();
    const urgency = getPaymentUrgency(item.dueDate, item.paid);
    const msg = buildInstallmentWhatsAppMessage({
      clientName: item.clientName,
      projectTitle: item.projectType?.startsWith('paf') ? 'Método PAF' : 'Proyecto Web',
      installmentNumber: item.installmentNumber || 1,
      totalInstallments: item.totalInstallments || 1,
      amount: item.amount,
      currency: item.currency,
      dueDate: item.dueDate,
      isOverdue: urgency.status === 'overdue',
    });

    const phoneDigits = item.clientPhone ? item.clientPhone.replace(/\D/g, '') : '';
    if (phoneDigits) {
      window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      navigator.clipboard.writeText(msg);
      alert('¡Mensaje de recordatorio copiado al portapapeles!');
    }
  };

  const handleToggleItemPaid = (item: MonthlyProjectedRevenue['items'][0]) => {
    hapticFeedback.selection();
    playTaskDone();

    const targetProject = projects.find(p => p.id === item.projectId);
    if (targetProject && onUpdateProject) {
      const today = getTodayString();
      const currentInst = targetProject.installments || [];
      const updatedInst = currentInst.map(i => {
        if (i.number === item.installmentNumber || i.dueDate === item.dueDate) {
          return {
            ...i,
            paid: !item.paid,
            paidAt: !item.paid ? today : undefined,
          };
        }
        return i;
      });

      onUpdateProject(targetProject.id, {
        installments: updatedInst,
        pafInstallmentDates: updatedInst.map(i => ({
          number: i.number,
          dueDate: i.dueDate,
          amount: i.amount,
          paid: i.paid,
          paidAt: i.paidAt,
        })),
      });
    }

    if (item.incomeRecordId && onToggleIncomeStatus) {
      onToggleIncomeStatus(item.incomeRecordId);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Metric Overview Cards (Material Design 3 Surfaces) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Active Clients */}
        <div className="p-4 rounded-3xl bg-[#1E1F20] border border-[#2D2F31] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#C4C7C5]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Clientes Activos</span>
            <Users className="w-4 h-4 text-[#A8C7FA]" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-[#E3E3E3]">{activeClientsCount}</div>
            <div className="text-[11px] text-[#C4C7C5] mt-0.5">
              {activePayingClientsCount} con plan de cobros activo
            </div>
          </div>
        </div>

        {/* Current Month Projected USD */}
        <div className="p-4 rounded-3xl bg-[#1E1F20] border border-[#004A77]/50 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#A8C7FA]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Mes Actual (USD)</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-[#A8C7FA] font-mono">
              {formatMoney(currentMonthProjectedUSD, 'USD')}
            </div>
            <div className="text-[11px] text-[#C4C7C5] mt-0.5">
              Proyección cobros en dólares
            </div>
          </div>
        </div>

        {/* Current Month Projected ARS */}
        <div className="p-4 rounded-3xl bg-[#1E1F20] border border-[#0F5223]/50 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#C4EED0]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Mes Actual (ARS)</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-[#C4EED0] font-mono">
              {formatMoney(currentMonthProjectedARS, 'ARS')}
            </div>
            <div className="text-[11px] text-[#C4C7C5] mt-0.5">
              Proyección cobros en pesos
            </div>
          </div>
        </div>

        {/* Next Month Projected Flow */}
        <div 
          onClick={() => {
            setSelectedMonthIndex(nextMonthIdx);
            hapticFeedback.selection();
          }}
          className="p-4 rounded-3xl bg-[#1E1F20] border border-[#2D2F31] hover:border-[#D0BCFF]/50 transition cursor-pointer flex flex-col justify-between shadow-xs group"
          title="Ver detalle del próximo mes"
        >
          <div className="flex items-center justify-between text-[#D0BCFF]">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Próximo Mes ({nextMonthData?.monthName.split(' ')[0]})</span>
            <Calendar className="w-4 h-4 group-hover:scale-110 transition" />
          </div>
          <div className="mt-2">
            <div className="text-base font-bold text-[#D0BCFF] font-mono">
              {formatMoney(nextMonthProjectedUSD, 'USD')}{' '}
              {nextMonthProjectedARS > 0 && <span className="text-xs font-normal text-[#C4C7C5] block sm:inline">+ {formatMoney(nextMonthProjectedARS, 'ARS')}</span>}
            </div>
            <div className="text-[11px] text-[#C4C7C5] mt-1 flex items-center justify-between">
              <span>{nextMonthData?.pafCount || 0} PAF • {nextMonthData?.webCount || 0} Web</span>
              <span className="text-[#A8C7FA] font-medium text-[10px] group-hover:underline">Ver desglose →</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Monthly Cash Flow Projection Slider / Tabs */}
      <div className="bg-[#1E1F20] border border-[#2D2F31] rounded-3xl p-4 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#E3E3E3] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#A8C7FA]" />
              <span>Proyección de Ingresos Mes a Mes (Año Completo)</span>
            </h3>
            <p className="text-xs text-[#C4C7C5]">
              Navega entre todos los meses del año para auditar cobros de Método PAF y Desarrollo Web.
            </p>
          </div>

          {/* Controls: Prev/Next Month, View Mode, Currency Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-[#282A2C] p-0.5 rounded-full border border-[#37393B] text-xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 rounded-full font-medium transition ${
                  viewMode === 'grid' ? 'bg-[#37393B] text-[#E3E3E3] font-bold' : 'text-[#C4C7C5] hover:text-[#E3E3E3]'
                }`}
              >
                12 Meses
              </button>
              <button
                type="button"
                onClick={() => setViewMode('carousel')}
                className={`px-2.5 py-1 rounded-full font-medium transition ${
                  viewMode === 'carousel' ? 'bg-[#37393B] text-[#E3E3E3] font-bold' : 'text-[#C4C7C5] hover:text-[#E3E3E3]'
                }`}
              >
                Carrusel
              </button>
            </div>

            {/* Quick Currency Filter Pills */}
            <div className="flex items-center bg-[#282A2C] p-0.5 rounded-full border border-[#37393B] text-xs">
              <button
                type="button"
                onClick={() => setCurrencyFilter('all')}
                className={`px-2.5 py-1 rounded-full font-medium transition ${
                  currencyFilter === 'all' ? 'bg-[#37393B] text-[#E3E3E3] font-bold' : 'text-[#C4C7C5] hover:text-[#E3E3E3]'
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setCurrencyFilter('USD')}
                className={`px-2.5 py-1 rounded-full font-medium transition ${
                  currencyFilter === 'USD' ? 'bg-[#004A77] text-[#A8C7FA] font-bold' : 'text-[#C4C7C5] hover:text-[#E3E3E3]'
                }`}
              >
                USD
              </button>
              <button
                type="button"
                onClick={() => setCurrencyFilter('ARS')}
                className={`px-2.5 py-1 rounded-full font-medium transition ${
                  currencyFilter === 'ARS' ? 'bg-[#0F5223] text-[#C4EED0] font-bold' : 'text-[#C4C7C5] hover:text-[#E3E3E3]'
                }`}
              >
                ARS
              </button>
            </div>
          </div>
        </div>

        {/* Quick Month Navigation Controls (Previous, Current, Next) */}
        <div className="flex items-center justify-between gap-2 p-2 bg-[#282A2C]/70 rounded-2xl border border-[#37393B] text-xs">
          <button
            type="button"
            disabled={selectedMonthIndex === 0}
            onClick={() => {
              if (selectedMonthIndex > 0) setSelectedMonthIndex(prev => prev - 1);
              hapticFeedback.selection();
            }}
            className="px-3 py-1.5 rounded-xl text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#37393B] disabled:opacity-30 disabled:pointer-events-none transition flex items-center gap-1 font-semibold"
          >
            <span>← Mes Anterior</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="font-bold text-[#E3E3E3] capitalize">
              {activeMonth?.monthName}
            </span>
            {activeMonth?.isCurrentMonth ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#664600] text-[#FFDF99] border border-[#FFDF99]/30">
                Mes Actual
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedMonthIndex(currentMonthIdx)}
                className="text-[11px] text-[#A8C7FA] hover:underline font-medium"
              >
                Ir al Mes Actual
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={selectedMonthIndex >= monthlyProjections.length - 1}
            onClick={() => {
              if (selectedMonthIndex < monthlyProjections.length - 1) setSelectedMonthIndex(prev => prev + 1);
              hapticFeedback.selection();
            }}
            className="px-3 py-1.5 rounded-xl text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#37393B] disabled:opacity-30 disabled:pointer-events-none transition flex items-center gap-1 font-semibold"
          >
            <span>Mes Siguiente →</span>
          </button>
        </div>

        {/* 12 Months Display: Grid Mode or Carousel Mode */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
            {monthlyProjections.slice(0, 12).map((m, idx) => {
              const isSelected = selectedMonthIndex === idx;
              const hasActivity = m.totalUSD > 0 || m.totalARS > 0;

              return (
                <button
                  key={m.monthKey}
                  type="button"
                  onClick={() => {
                    setSelectedMonthIndex(idx);
                    hapticFeedback.selection();
                  }}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#282A2C] border-[#A8C7FA] ring-2 ring-[#A8C7FA]/40 shadow-sm'
                      : m.isCurrentMonth
                      ? 'bg-[#282A2C]/60 border-[#FFDF99]/50 hover:border-[#FFDF99]'
                      : 'bg-[#1E1F20] border-[#2D2F31] hover:border-[#37393B]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${m.isCurrentMonth ? 'text-[#FFDF99]' : 'text-[#E3E3E3]'}`}>
                      {m.monthName.split(' ')[0]}
                    </span>
                    {m.isCurrentMonth && (
                      <span className="text-[8px] font-bold uppercase px-1 py-0.2 rounded-full bg-[#664600] text-[#FFDF99]">
                        Hoy
                      </span>
                    )}
                  </div>

                  <div className="my-2 space-y-0.5">
                    {m.totalUSD > 0 && (
                      <div className="text-[11px] font-mono font-bold text-[#A8C7FA]">
                        {formatMoney(m.totalUSD, 'USD')}
                      </div>
                    )}
                    {m.totalARS > 0 && (
                      <div className="text-[11px] font-mono font-bold text-[#C4EED0]">
                        {formatMoney(m.totalARS, 'ARS')}
                      </div>
                    )}
                    {!hasActivity && (
                      <div className="text-[10px] text-[#585960] font-mono">$0</div>
                    )}
                  </div>

                  <div className="text-[10px] text-[#C4C7C5] flex items-center justify-between pt-1 border-t border-[#2D2F31]/60">
                    <span>{m.items.length} {m.items.length === 1 ? 'cobro' : 'cobros'}</span>
                    {(m.pendingUSD > 0 || m.pendingARS > 0) && (
                      <span className="w-2 h-2 rounded-full bg-amber-400" title="Cobros pendientes" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
            {monthlyProjections.map((m, idx) => {
              const isSelected = selectedMonthIndex === idx;
              const hasActivity = m.totalUSD > 0 || m.totalARS > 0;

              return (
                <button
                  key={m.monthKey}
                  type="button"
                  onClick={() => {
                    setSelectedMonthIndex(idx);
                    hapticFeedback.selection();
                  }}
                  className={`min-w-[145px] p-3.5 rounded-2xl border text-left transition shrink-0 ${
                    isSelected
                      ? 'bg-[#282A2C] border-[#A8C7FA] ring-2 ring-[#A8C7FA]/40'
                      : m.isCurrentMonth
                      ? 'bg-[#282A2C]/60 border-[#FFDF99]/40 hover:border-[#FFDF99]'
                      : 'bg-[#1E1F20] border-[#2D2F31] hover:border-[#37393B]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${m.isCurrentMonth ? 'text-[#FFDF99]' : 'text-[#E3E3E3]'}`}>
                      {m.monthName}
                    </span>
                    {m.isCurrentMonth && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-[#664600] text-[#FFDF99]">
                        Actual
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 space-y-0.5">
                    {m.totalUSD > 0 && (
                      <div className="text-xs font-mono font-bold text-[#A8C7FA]">
                        {formatMoney(m.totalUSD, 'USD')}
                      </div>
                    )}
                    {m.totalARS > 0 && (
                      <div className="text-xs font-mono font-bold text-[#C4EED0]">
                        {formatMoney(m.totalARS, 'ARS')}
                      </div>
                    )}
                    {!hasActivity && (
                      <div className="text-[11px] text-[#585960] font-mono">$0</div>
                    )}
                  </div>

                  <div className="text-[10px] text-[#C4C7C5] mt-1.5 flex items-center justify-between">
                    <span>{m.items.length} cobros</span>
                    {m.pendingUSD > 0 || m.pendingARS > 0 ? <span className="text-[#FFDF99] font-bold">•</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Unified Breakdown Card: ¿Por qué este dinero? (Método PAF + Desarrollo Web) */}
        <div className="p-4 rounded-2xl bg-[#282A2C]/90 border border-[#37393B] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#A8C7FA]" />
              <h4 className="text-xs font-bold text-[#E3E3E3] uppercase tracking-wider">
                ¿Por qué este dinero en {activeMonth?.monthName}? (Desglose Unificado Web + PAF)
              </h4>
            </div>
            <span className="text-xs font-mono font-bold text-[#A8C7FA]">
              {activeMonth?.totalARS > 0 && formatMoney(activeMonth.totalARS, 'ARS')}
              {activeMonth?.totalARS > 0 && activeMonth?.totalUSD > 0 && ' + '}
              {activeMonth?.totalUSD > 0 && formatMoney(activeMonth.totalUSD, 'USD')}
              {!activeMonth?.totalARS && !activeMonth?.totalUSD && '$0'}
            </span>
          </div>

          <p className="text-xs text-[#E3E3E3] leading-relaxed bg-[#1E1F20] p-2.5 rounded-xl border border-[#37393B]">
            {activeMonth?.explanation || 'No hay cobros previstos para este mes.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Método PAF / Retainers Column */}
            <div className="p-3 rounded-xl bg-[#1E1F20] border border-amber-500/25 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  <span>🏛️ Método PAF & Abonos / Retainers</span>
                </span>
                <span className="text-xs font-mono font-bold text-[#E3E3E3]">
                  {activeMonth?.pafARS > 0 ? formatMoney(activeMonth.pafARS, 'ARS') : ''}
                  {activeMonth?.pafARS > 0 && activeMonth?.pafUSD > 0 ? ' + ' : ''}
                  {activeMonth?.pafUSD > 0 ? formatMoney(activeMonth.pafUSD, 'USD') : ''}
                  {!activeMonth?.pafARS && !activeMonth?.pafUSD ? '$0' : ''}
                </span>
              </div>
              <p className="text-[11px] text-[#C4C7C5]">
                {activeMonth?.pafCount || 0} cuotas de programas de aceleración, consultoría recurrente o abonos mensuales.
              </p>
            </div>

            {/* Desarrollo Web & Proyectos Column */}
            <div className="p-3 rounded-xl bg-[#1E1F20] border border-cyan-500/25 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <span>🌐 Desarrollo Web & Digital (Hitos / Entregas)</span>
                </span>
                <span className="text-xs font-mono font-bold text-[#E3E3E3]">
                  {activeMonth?.webARS > 0 ? formatMoney(activeMonth.webARS, 'ARS') : ''}
                  {activeMonth?.webARS > 0 && activeMonth?.webUSD > 0 ? ' + ' : ''}
                  {activeMonth?.webUSD > 0 ? formatMoney(activeMonth.webUSD, 'USD') : ''}
                  {!activeMonth?.webARS && !activeMonth?.webUSD ? '$0' : ''}
                </span>
              </div>
              <p className="text-[11px] text-[#C4C7C5]">
                {activeMonth?.webCount || 0} cobros correspondientes a anticipos, hitos intermedios o saldo contra entrega.
              </p>
            </div>
          </div>
        </div>

        {/* Selected Month Breakdown Table */}
        <div className="space-y-3 pt-3 border-t border-[#2D2F31]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[#E3E3E3] capitalize">
                Detalle de Cobros: {activeMonth?.monthName}
              </span>
              <span className="text-xs text-[#C4C7C5]">
                ({filteredMonthItems.length} cuotas visibles)
              </span>

              {/* Service Line Filter Pills */}
              <div className="flex items-center gap-1 bg-[#282A2C] p-0.5 rounded-full border border-[#37393B] text-[11px] ml-2">
                <button
                  type="button"
                  onClick={() => setServiceFilter('all')}
                  className={`px-2.5 py-0.5 rounded-full font-medium transition ${
                    serviceFilter === 'all' ? 'bg-[#37393B] text-[#E3E3E3] font-bold' : 'text-[#C4C7C5] hover:text-[#E3E3E3]'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setServiceFilter('paf')}
                  className={`px-2.5 py-0.5 rounded-full font-medium transition ${
                    serviceFilter === 'paf' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-[#C4C7C5] hover:text-[#E3E3E3]'
                  }`}
                >
                  PAF ({activeMonth?.pafCount || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setServiceFilter('web')}
                  className={`px-2.5 py-0.5 rounded-full font-medium transition ${
                    serviceFilter === 'web' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-[#C4C7C5] hover:text-[#E3E3E3]'
                  }`}
                >
                  Web ({activeMonth?.webCount || 0})
                </button>
              </div>
            </div>

            {/* Filter by status */}
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <span className="text-[#C4C7C5] text-[11px]">Estado:</span>
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  filterStatus === 'all' ? 'bg-[#282A2C] text-[#E3E3E3] font-bold' : 'text-[#C4C7C5] hover:text-[#E3E3E3]'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('pending')}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  filterStatus === 'pending' ? 'bg-[#664600] text-[#FFDF99] font-bold' : 'text-[#C4C7C5] hover:text-[#E3E3E3]'
                }`}
              >
                Pendientes
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('overdue')}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  filterStatus === 'overdue' ? 'bg-[#8C1D18] text-[#F2B8B5] font-bold' : 'text-[#C4C7C5] hover:text-[#E3E3E3]'
                }`}
              >
                Atrasados
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('paid')}
                className={`px-3 py-1 rounded-full font-medium transition ${
                  filterStatus === 'paid' ? 'bg-[#0F5223] text-[#C4EED0] font-bold' : 'text-[#C4C7C5] hover:text-[#E3E3E3]'
                }`}
              >
                Cobrados
              </button>
            </div>
          </div>

          {filteredMonthItems.length === 0 ? (
            <div className="text-center py-8 text-[#C4C7C5] text-xs bg-[#282A2C]/40 rounded-2xl border border-dashed border-[#37393B]">
              No hay cobros registrados o programados en {activeMonth?.monthName} con los filtros seleccionados.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMonthItems.map((item, idx) => {
                const urgency = getPaymentUrgency(item.dueDate, item.paid);
                const matchedProj = projects.find(p => p.id === item.projectId);

                return (
                  <div
                    key={`${item.projectId}_${item.dueDate}_${idx}`}
                    className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                      item.paid
                        ? 'bg-[#1E1F20]/60 border-[#2D2F31] opacity-85'
                        : urgency.status === 'overdue'
                        ? 'bg-[#8C1D18]/15 border-[#F2B8B5]/30'
                        : urgency.status === 'due_today' || urgency.status === 'due_soon'
                        ? 'bg-[#664600]/15 border-[#FFDF99]/30'
                        : 'bg-[#282A2C] border-[#37393B]'
                    }`}
                  >
                    {/* Left: Client Name & Concept */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleItemPaid(item)}
                        className={`p-1 rounded-full transition ${
                          item.paid
                            ? 'text-[#C4EED0] hover:text-[#A8C7FA]'
                            : 'text-[#C4C7C5] hover:text-[#C4EED0]'
                        }`}
                        title={item.paid ? 'Marcar como pendiente' : 'Marcar como cobrado'}
                      >
                        {item.paid ? (
                          <CheckCircle2 className="w-5 h-5 text-[#C4EED0]" />
                        ) : (
                          <Clock className="w-5 h-5 text-[#C4C7C5]" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            onClick={() => matchedProj && onSelectProject && onSelectProject(matchedProj)}
                            className={`text-xs font-semibold hover:text-[#A8C7FA] cursor-pointer transition ${
                              item.paid ? 'line-through text-[#C4C7C5]' : 'text-[#E3E3E3]'
                            }`}
                          >
                            {item.clientName}
                          </span>

                          {item.serviceCategory === 'web' || item.projectType === 'web' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                              🌐 Web (50/50)
                            </span>
                          ) : item.projectType === 'paf_pro' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              ⭐ PAF Pro (12s)
                            </span>
                          ) : item.projectType === 'paf_base' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                              PAF Base
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                              {item.projectType || 'Servicio'}
                            </span>
                          )}

                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${urgency.badgeClass}`}>
                            {urgency.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-[#C4C7C5] mt-0.5 flex-wrap">
                          <span>{item.concept}</span>
                          <span>•</span>
                          <span className="font-mono">Vence: {item.dueDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount + Reminder Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-8 sm:pl-0 flex-wrap">
                      <span className="text-sm font-bold font-mono text-[#E3E3E3]">
                        {formatMoney(item.amount, item.currency)}
                      </span>

                      {!item.paid && (
                        <button
                          type="button"
                          onClick={() => handleSendReminder(item)}
                          className="px-3 py-1.5 rounded-full bg-[#0F5223] hover:bg-[#156e30] text-[#C4EED0] border border-[#C4EED0]/30 text-xs font-semibold flex items-center gap-1.5 transition"
                          title="Enviar recordatorio por WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Recordar</span>
                        </button>
                      )}

                      {matchedProj && onSelectProject && (
                        <button
                          type="button"
                          onClick={() => onSelectProject(matchedProj)}
                          className="p-1.5 rounded-full text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#37393B] transition"
                          title="Ver Ficha 360°"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
