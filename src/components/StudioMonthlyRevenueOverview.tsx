import React, { useState } from 'react';
import { Project, IncomeRecord, StudioPaymentSettings } from '../types';
import { 
  calculateMonthIncomeSummary, 
  formatCurrencyAmount, 
  getCuotaStatusBadge,
  buildSmartWhatsAppPaymentMessage
} from '../utils/paymentPlans';
import { formatWhatsAppUrl } from '../utils/contact';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { 
  ChevronLeft, 
  ChevronRight, 
  DollarSign, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  CheckCircle2, 
  MessageCircle, 
  Plus, 
  BarChart3, 
  Sliders, 
  ExternalLink,
  Layers,
  ArrowRight,
  PieChart,
  Circle
} from 'lucide-react';

interface Props {
  projects: Project[];
  incomes: IncomeRecord[];
  privacyMode?: boolean;
  usdRate?: number;
  studioSettings?: StudioPaymentSettings;
  onNavigateToProject: (projectId: string) => void;
  onRegisterPaymentForProject: (project: Project, cuotaId?: string) => void;
}

export const StudioMonthlyRevenueOverview: React.FC<Props> = ({
  projects,
  incomes,
  privacyMode = false,
  usdRate = 1250,
  studioSettings,
  onNavigateToProject,
  onRegisterPaymentForProject,
}) => {
  const today = getTodayString();
  const currentYear = parseInt(today.slice(0, 4), 10);
  const currentMonthNum = today.slice(5, 7);

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthNum);

  const summary = calculateMonthIncomeSummary(
    projects,
    incomes,
    selectedYear,
    selectedMonth,
    usdRate
  );

  const handlePrevMonth = () => {
    hapticFeedback.light();
    let m = parseInt(selectedMonth, 10) - 1;
    let y = selectedYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonth(String(m).padStart(2, '0'));
    setSelectedYear(y);
  };

  const handleNextMonth = () => {
    hapticFeedback.light();
    let m = parseInt(selectedMonth, 10) + 1;
    let y = selectedYear;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonth(String(m).padStart(2, '0'));
    setSelectedYear(y);
  };

  const handleResetToCurrentMonth = () => {
    hapticFeedback.light();
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonthNum);
  };

  const renderStatusIcon = (statusName: string) => {
    switch (statusName) {
      case 'pagado_a_tiempo':
      case 'pagado_tarde':
        return <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />;
      case 'vencido':
      case 'vence_hoy':
        return <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />;
      case 'parcial':
        return <PieChart className="w-3.5 h-3.5 stroke-[2.5]" />;
      case 'pendiente':
        return <Clock className="w-3.5 h-3.5 stroke-[2]" />;
      case 'futuro':
      default:
        return <Circle className="w-3.5 h-3.5 stroke-[2]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Month Selector Bar */}
      <div className="card-swiss p-3.5 sm:p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-3 shadow-xs">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="min-h-[44px] sm:min-h-[36px] px-3 py-1.5 rounded-[var(--radius-control)] btn-secondary text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          title="Mes anterior"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2]" />
          <span className="hidden sm:inline">Mes anterior</span>
        </button>

        <div className="flex items-center gap-2 text-center">
          <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] font-heading">
            {summary.monthName}
          </h2>
          {!summary.isCurrentMonth && (
            <button
              type="button"
              onClick={handleResetToCurrentMonth}
              className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
            >
              Ir a este mes
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          className="min-h-[44px] sm:min-h-[36px] px-3 py-1.5 rounded-[var(--radius-control)] btn-secondary text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          title="Mes siguiente"
        >
          <span className="hidden sm:inline">Mes siguiente</span>
          <ChevronRight className="w-4 h-4 stroke-[2]" />
        </button>
      </div>

      {/* 4 Big Numbers (4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Cobrado en el mes */}
        <div className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-[var(--text-tertiary)] tracking-wider">
              Cobrado en el mes
            </span>
            <div className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">
              {privacyMode ? '$ ••••••' : `$ ${summary.cobradoUnifiedARS.toLocaleString('es-AR')}`}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-secondary)] mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>ARS: {privacyMode ? '$ •••' : `$ ${summary.cobradoARS.toLocaleString('es-AR')}`}</span>
              <span>·</span>
              <span>USD: {privacyMode ? 'u$s •••' : `US$ ${summary.cobradoUSD.toLocaleString('es-AR')}`}</span>
            </div>
          </div>
          <span className="text-[10px] text-[var(--text-tertiary)] block">
            Dinero real ya ingresado
          </span>
        </div>

        {/* 2. Por cobrar en el mes */}
        <div className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-[var(--text-tertiary)] tracking-wider">
              Por cobrar en el mes
            </span>
            <div className="w-6 h-6 rounded-md bg-yellow-500/15 text-yellow-400 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-yellow-400">
              {privacyMode ? '$ ••••••' : `$ ${summary.porCobrarUnifiedARS.toLocaleString('es-AR')}`}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-secondary)] mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>ARS: {privacyMode ? '$ •••' : `$ ${summary.porCobrarARS.toLocaleString('es-AR')}`}</span>
              <span>·</span>
              <span>USD: {privacyMode ? 'u$s •••' : `US$ ${summary.porCobrarUSD.toLocaleString('es-AR')}`}</span>
            </div>
          </div>
          <span className="text-[10px] text-[var(--text-tertiary)] block">
            Pendiente en fecha (no vencido)
          </span>
        </div>

        {/* 3. Vencido (atrasado) */}
        <div className={`card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border space-y-2 relative overflow-hidden shadow-xs ${
          summary.vencidoUnifiedARS > 0 ? 'border-rose-500/40 bg-rose-500/5' : 'border-[var(--border-subtle)]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-[var(--text-tertiary)] tracking-wider">
              Vencido (atrasado)
            </span>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
              summary.vencidoUnifiedARS > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-zinc-800 text-zinc-500'
            }`}>
              <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>
          <div>
            <div className={`text-xl sm:text-2xl font-mono font-bold ${
              summary.vencidoUnifiedARS > 0 ? 'text-rose-400' : 'text-zinc-500'
            }`}>
              {privacyMode ? '$ ••••••' : `$ ${summary.vencidoUnifiedARS.toLocaleString('es-AR')}`}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-secondary)] mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>ARS: {privacyMode ? '$ •••' : `$ ${summary.vencidoARS.toLocaleString('es-AR')}`}</span>
              <span>·</span>
              <span>USD: {privacyMode ? 'u$s •••' : `US$ ${summary.vencidoUSD.toLocaleString('es-AR')}`}</span>
            </div>
          </div>
          <span className="text-[10px] text-[var(--text-tertiary)] block">
            {summary.vencidoUnifiedARS > 0 ? 'Cobros con fecha límite pasada' : 'Sin cobros atrasados'}
          </span>
        </div>

        {/* 4. Proyectado total del mes */}
        <div className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-[var(--text-tertiary)] tracking-wider">
              Proyectado total
            </span>
            <div className="w-6 h-6 rounded-md bg-zinc-800 text-zinc-300 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-[var(--text-primary)]">
              {privacyMode ? '$ ••••••' : `$ ${summary.proyectadoTotalUnifiedARS.toLocaleString('es-AR')}`}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-secondary)] mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>ARS: {privacyMode ? '$ •••' : `$ ${summary.proyectadoTotalARS.toLocaleString('es-AR')}`}</span>
              <span>·</span>
              <span>USD: {privacyMode ? 'u$s •••' : `US$ ${summary.proyectadoTotalUSD.toLocaleString('es-AR')}`}</span>
            </div>
          </div>
          <span className="text-[10px] text-[var(--text-tertiary)] block">
            Cobrado + Por cobrar + Vencido
          </span>
        </div>
      </div>

      {/* Progress Bar: Cobrado vs Proyectado */}
      <div className="card-swiss p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--text-primary)]">
            Avance de cobros del mes ({summary.monthName})
          </span>
          <span className="font-mono font-bold text-emerald-400">
            {summary.porcentajeAvance}% cobrado
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-[var(--border-subtle)] overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${summary.porcentajeAvance}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)] font-mono pt-0.5">
          <span>Cobrado: {privacyMode ? '$ ••••••' : `$ ${summary.cobradoUnifiedARS.toLocaleString('es-AR')}`}</span>
          <span>Proyectado: {privacyMode ? '$ ••••••' : `$ ${summary.proyectadoTotalUnifiedARS.toLocaleString('es-AR')}`}</span>
        </div>
        <p className="text-[10.5px] text-[var(--text-tertiary)] italic pt-1 border-t border-[var(--border-subtle)]">
          ℹ️ Cotización de referencia unificada: 1 USD = $ {usdRate.toLocaleString('es-AR')} ARS (Configurada en Ajustes).
        </p>
      </div>

      {/* Gráfico Simple de Barras de los Últimos 6 Meses (Cobrado vs Proyectado) */}
      <div className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-[var(--text-primary)] font-heading uppercase tracking-wider">
              Evolución últimos 6 meses (Cobrado vs Proyectado)
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              <span className="text-[var(--text-secondary)]">Cobrado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-zinc-700 inline-block" />
              <span className="text-[var(--text-secondary)]">Proyectado</span>
            </div>
          </div>
        </div>

        {/* Bar chart grid */}
        <div className="grid grid-cols-6 gap-2 sm:gap-4 pt-4 pb-2 items-end min-h-[140px]">
          {summary.sixMonthsEvolution.map((m) => {
            const maxVal = Math.max(
              ...summary.sixMonthsEvolution.map(x => Math.max(x.proyectadoUnifiedARS, x.cobradoUnifiedARS, 1))
            );
            const cobradoHeight = Math.max(4, Math.round((m.cobradoUnifiedARS / maxVal) * 100));
            const proyectadoHeight = Math.max(4, Math.round((m.proyectadoUnifiedARS / maxVal) * 100));

            return (
              <div key={m.monthKey} className="flex flex-col items-center gap-2 group">
                {/* Dual Bars container */}
                <div className="w-full flex items-end justify-center gap-1 h-24">
                  {/* Cobrado Bar */}
                  <div 
                    className="w-3 sm:w-5 bg-emerald-500 rounded-t-sm transition-all duration-300 relative group-hover:brightness-110"
                    style={{ height: `${cobradoHeight}%` }}
                    title={`Cobrado: $ ${m.cobradoUnifiedARS.toLocaleString('es-AR')}`}
                  />
                  {/* Proyectado Bar */}
                  <div 
                    className="w-3 sm:w-5 bg-zinc-700/80 rounded-t-sm transition-all duration-300 relative group-hover:bg-zinc-600"
                    style={{ height: `${proyectadoHeight}%` }}
                    title={`Proyectado: $ ${m.proyectadoUnifiedARS.toLocaleString('es-AR')}`}
                  />
                </div>

                {/* Month label */}
                <span className={`text-[10px] font-mono whitespace-nowrap ${
                  m.isCurrentMonth ? 'text-emerald-400 font-bold' : 'text-[var(--text-tertiary)]'
                }`}>
                  {m.shortLabel}
                </span>

                {/* Amount mini */}
                <span className="text-[9px] font-mono text-[var(--text-tertiary)] hidden sm:block">
                  {privacyMode ? '•••' : `$ ${Math.round(m.cobradoUnifiedARS / 1000)}k`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista por Cliente del Mes (Ordenada por urgencia: vencidos primero) */}
      <div className="card-swiss p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between pb-1 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-[var(--text-primary)] font-heading uppercase tracking-wider">
              Cobros del mes por cliente ({summary.clientItems.length})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
            Ordenado por urgencia
          </span>
        </div>

        {summary.clientItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-tertiary)] italic">
            No hay cobros proyectados ni registrados para este mes.
          </div>
        ) : (
          <div className="space-y-2.5">
            {summary.clientItems.map(item => {
              const project = projects.find(p => p.id === item.projectId);
              if (!project) return null;

              const badge = getCuotaStatusBadge(item.status, item.delayDays);
              const rawPhone = item.clientPhone || project.clientPhone || '';
              const wpText = buildSmartWhatsAppPaymentMessage({
                project,
                studioSettings,
                commitment: {
                  id: item.cuotaId,
                  title: item.cuotaTitle,
                  amount: item.pendingAmount,
                  dueDate: item.dueDate,
                  currency: item.currency,
                  status: 'pendiente',
                },
                customAmount: item.pendingAmount,
              });
              const wpUrl = rawPhone ? formatWhatsAppUrl(rawPhone, wpText) : null;

              return (
                <div
                  key={`${item.projectId}_${item.cuotaId}`}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    item.status === 'vencido' 
                      ? 'border-rose-500/40 bg-rose-500/5' 
                      : item.status === 'vence_hoy'
                      ? 'border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-app)]'
                  }`}
                >
                  {/* Left: Client name, rubro, cuota info */}
                  <div 
                    onClick={() => onNavigateToProject(project.id)}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[var(--text-primary)] hover:underline truncate">
                        {item.clientName}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.2 rounded-md bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                        {item.rubro}
                      </span>
                      <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                        {item.cuotaTitle}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span className="font-mono font-bold text-[var(--text-primary)]">
                        {privacyMode ? '$ ••••••' : formatCurrencyAmount(item.expectedAmount, item.currency, true)}
                      </span>
                      <span className="text-[var(--text-tertiary)]">·</span>
                      <span className={`text-[11px] font-semibold flex items-center gap-1 ${
                        item.status === 'vencido' ? 'text-rose-400' :
                        item.status === 'vence_hoy' ? 'text-amber-400' :
                        item.isPaid ? 'text-emerald-400' : 'text-[var(--text-secondary)]'
                      }`}>
                        {renderStatusIcon(item.status)}
                        <span>{badge.label}</span>
                      </span>
                      <span className="text-[var(--text-tertiary)]">·</span>
                      <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                        Vence: {item.dueDate}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {wpUrl && !item.isPaid && (
                      <a
                        href={wpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => hapticFeedback.light()}
                        className="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-[var(--radius-control)] border border-emerald-600/30 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                        title="Enviar recordatorio y datos por WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5 stroke-[2]" />
                        <span>WhatsApp</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.medium();
                        onRegisterPaymentForProject(project, item.cuotaId);
                      }}
                      className="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-[var(--radius-control)] btn-solid-primary text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                      title="Registrar pago de esta cuota"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{item.isPaid ? 'Pago extra' : 'Registrar pago'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
