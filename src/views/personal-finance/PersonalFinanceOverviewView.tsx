import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  AlertCircle, 
  Check, 
  Repeat, 
  ArrowRight, 
  Sparkles,
  PieChart as PieIcon,
  BarChart3,
  ShieldCheck,
  ChevronRight,
  FolderKanban,
  Receipt
} from 'lucide-react';
import { 
  PersonalAccount, 
  PersonalCategory, 
  PersonalTransaction, 
  PersonalRecurring, 
  PersonalBudget, 
  PersonalFinanceSettings,
  IncomeRecord
} from '../../types';
import { 
  calculateTotalBalances, 
  calculateMonthlyFinanceSummary, 
  compareWithPreviousMonth,
  getCategorySpendingBreakdown,
  getLast6MonthsTrend,
  getWeeklyDistribution,
  getBusinessIncomeAllocationList,
  formatPersonalAmount,
  getCurrentMonthStr,
  formatMonthName
} from '../../utils/personalFinance';
import { hapticFeedback } from '../../utils/haptics';
import { DEFAULT_USD_RATE } from '../../utils/currency';

interface Props {
  accounts: PersonalAccount[];
  categories: PersonalCategory[];
  transactions: PersonalTransaction[];
  recurrings: PersonalRecurring[];
  budgets: PersonalBudget[];
  settings: PersonalFinanceSettings;
  incomes: IncomeRecord[];
  privacyMode: boolean;
  onNavigate: (path: string) => void;
  onConfirmRecurring: (recurring: PersonalRecurring) => void;
}

export const PersonalFinanceOverviewView: React.FC<Props> = ({
  accounts,
  categories,
  transactions,
  recurrings,
  budgets,
  settings,
  incomes,
  privacyMode,
  onNavigate,
  onConfirmRecurring,
}) => {
  const [showCombinedARS, setShowCombinedARS] = useState(false);
  const currentMonth = getCurrentMonthStr();
  const usdRate = settings.usdExchangeRate || DEFAULT_USD_RATE;

  const balances = calculateTotalBalances(accounts, transactions, usdRate);
  const monthSummary = calculateMonthlyFinanceSummary(transactions, currentMonth, usdRate);
  const monthComparison = compareWithPreviousMonth(transactions, currentMonth, usdRate);
  const categoryBreakdown = getCategorySpendingBreakdown(transactions, categories, currentMonth, usdRate);
  const last6Months = getLast6MonthsTrend(transactions, usdRate);
  const weeklyDist = getWeeklyDistribution(transactions, currentMonth, usdRate);
  const businessIncomesList = getBusinessIncomeAllocationList(incomes, transactions);
  const unallocatedIncomes = businessIncomesList.filter(item => !item.alreadyAllocated);

  // Active upcoming recurrings & monthly sum of fixed expenses
  const allActiveRecurrings = useMemo(() => recurrings.filter(r => r.active), [recurrings]);
  const activeRecurrings = useMemo(() => allActiveRecurrings.slice(0, 4), [allActiveRecurrings]);

  const recurringTotals = useMemo(() => {
    let monthlyARS = 0;
    let monthlyUSD = 0;
    let pendingThisMonthARS = 0;
    let pendingThisMonthUSD = 0;

    allActiveRecurrings.filter(r => r.type === 'gasto').forEach(r => {
      let multiplier = 1;
      if (r.frequency === 'semanal') multiplier = 4.33;
      else if (r.frequency === 'quincenal') multiplier = 2;
      else if (r.frequency === 'anual') multiplier = 1 / 12;

      if (r.currency === 'USD') {
        monthlyUSD += r.amount * multiplier;
      } else {
        monthlyARS += r.amount * multiplier;
      }

      const isDueThisMonth = r.nextDate && r.nextDate.startsWith(currentMonth);
      if (isDueThisMonth) {
        if (r.currency === 'USD') pendingThisMonthUSD += r.amount;
        else pendingThisMonthARS += r.amount;
      }
    });

    const combinedMonthlyARS = monthlyARS + (monthlyUSD * usdRate);

    return {
      monthlyARS,
      monthlyUSD,
      combinedMonthlyARS,
      pendingThisMonthARS,
      pendingThisMonthUSD,
      totalCount: allActiveRecurrings.length,
    };
  }, [allActiveRecurrings, currentMonth, usdRate]);

  // Total income vs expense bar progress
  const totalFlow = monthSummary.normalizedIncomeARS + monthSummary.normalizedExpenseARS;
  const incomeSharePct = totalFlow > 0 ? Math.round((monthSummary.normalizedIncomeARS / totalFlow) * 100) : 50;

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-150">
      
      {/* 1. HERO BALANCES: ARS & USD Separate with Toggle */}
      <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Patrimonio Disponible
            </span>
          </div>

          {/* Toggle Combined ARS */}
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setShowCombinedARS(prev => !prev);
            }}
            className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800"
          >
            <span>{showCombinedARS ? 'Ver Monedas Separadas' : 'Ver Total en ARS'}</span>
          </button>
        </div>

        {showCombinedARS ? (
          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-mono font-black text-zinc-100 tracking-tight">
              {formatPersonalAmount(balances.combinedInARS, 'ARS', privacyMode)}
            </div>
            <div className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
              <span>Equivalente total a</span>
              <span className="text-amber-400 font-mono font-bold">${usdRate.toLocaleString('es-AR')}</span>
              <span>/ USD</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* ARS Card */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-1">
              <div className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider flex items-center justify-between">
                <span>Cuentas en Pesos (ARS)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
                {formatPersonalAmount(balances.arsTotal, 'ARS', privacyMode)}
              </div>
              <div className="text-[11px] text-zinc-400 flex items-center gap-2 pt-0.5">
                <span className="text-emerald-500 font-semibold">+{formatPersonalAmount(monthSummary.totalIncomeARS, 'ARS', privacyMode)}</span>
                <span className="text-zinc-600">|</span>
                <span className="text-rose-400 font-semibold">-{formatPersonalAmount(monthSummary.totalExpenseARS, 'ARS', privacyMode)}</span>
              </div>
            </div>

            {/* USD Card */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-1">
              <div className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider flex items-center justify-between">
                <span>Dólares & Ahorros (USD)</span>
                <span className="w-2 h-2 rounded-full bg-blue-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-black text-sky-400">
                {formatPersonalAmount(balances.usdTotal, 'USD', privacyMode)}
              </div>
              <div className="text-[11px] text-zinc-400 flex items-center gap-2 pt-0.5">
                <span className="text-emerald-500 font-semibold">+{formatPersonalAmount(monthSummary.totalIncomeUSD, 'USD', privacyMode)}</span>
                <span className="text-zinc-600">|</span>
                <span className="text-rose-400 font-semibold">-{formatPersonalAmount(monthSummary.totalExpenseUSD, 'USD', privacyMode)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Action Buttons (Mobile 3-column touch triggers) */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              onNavigate('/mis-finanzas/nuevo?tipo=gasto');
            }}
            className="py-2.5 px-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Registrar gasto</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              onNavigate('/mis-finanzas/nuevo?tipo=ingreso');
            }}
            className="py-2.5 px-2 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
          >
            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Registrar ingreso</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              onNavigate('/mis-finanzas/nuevo?tipo=transferencia');
            }}
            className="py-2.5 px-2 rounded-2xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Transferir</span>
          </button>
        </div>
      </div>

      {/* 2. UNALLOCATED BUSINESS INCOME BANNER (Anti double-counting bridge) */}
      {unallocatedIncomes.length > 0 && (
        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2.5 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Cobros de Clientes sin Asignar ({unallocatedIncomes.length})
              </span>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
              Caja Negocio → Personal
            </span>
          </div>

          <p className="text-xs text-amber-200/80 leading-relaxed">
            Tenés cobros registrados en .Cero CRM que aún no fueron ingresados a tus cuentas personales:
          </p>

          <div className="space-y-2">
            {unallocatedIncomes.slice(0, 2).map(({ income }) => (
              <div 
                key={income.id}
                className="p-2.5 rounded-2xl bg-zinc-950/80 border border-amber-500/20 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-zinc-100 truncate">{income.title}</div>
                  <div className="text-[10px] text-zinc-400 font-mono">
                    {income.date} · {income.projectName || 'Sin proyecto'}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-black text-emerald-400">
                    {formatPersonalAmount(income.amount, income.currency, privacyMode)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.medium();
                      onNavigate(`/mis-finanzas/nuevo?tipo=ingreso&monto=${income.amount}&moneda=${income.currency}&nota=${encodeURIComponent('Cobro: ' + income.title)}&sourceIncomeId=${income.id}&proyecto=${income.projectId || ''}`);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] transition active:scale-95 shadow-sm cursor-pointer"
                  >
                    Registrar en mi cuenta
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. MONTH FLOW & SAVINGS RATE PROGRESS */}
      <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Flujo de {formatMonthName(currentMonth)}
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-sky-400">
            {monthSummary.savingsRatePercent}% Ahorro
          </span>
        </div>

        {/* Visual Dual Progress Bar */}
        <div className="w-full bg-zinc-900 rounded-full h-3 overflow-hidden flex border border-zinc-800/80">
          <div 
            className="bg-emerald-500 h-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-500"
            style={{ width: `${incomeSharePct}%` }}
            title={`Ingresos: ${incomeSharePct}%`}
          />
          <div 
            className="bg-rose-500 h-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-500"
            style={{ width: `${100 - incomeSharePct}%` }}
            title={`Salidas: ${100 - incomeSharePct}%`}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
          <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
            <div className="text-[10px] text-zinc-500 uppercase">Ingresos</div>
            <div className="text-xs sm:text-sm font-bold text-emerald-400 truncate">
              {formatPersonalAmount(monthSummary.normalizedIncomeARS, 'ARS', privacyMode)}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
            <div className="text-[10px] text-zinc-500 uppercase">Gastos</div>
            <div className="text-xs sm:text-sm font-bold text-rose-400 truncate">
              {formatPersonalAmount(monthSummary.normalizedExpenseARS, 'ARS', privacyMode)}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
            <div className="text-[10px] text-zinc-500 uppercase">Neto Mes</div>
            <div className={`text-xs sm:text-sm font-bold truncate ${monthSummary.normalizedNetARS >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatPersonalAmount(monthSummary.normalizedNetARS, 'ARS', privacyMode)}
            </div>
          </div>
        </div>
      </div>

      {/* 4. THREE LIGHTWEIGHT NATIVE SVG CHARTS (Mobile-first, 0 heavy libs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* CHART A: Gastos por Categoría */}
        <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Gastos por Categoría
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Este mes</span>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No hay gastos registrados en este período.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Stacked bar chart */}
              <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden flex">
                {categoryBreakdown.slice(0, 5).map(cat => (
                  <div
                    key={cat.categoryId}
                    style={{ 
                      width: `${cat.percentageOfTotal}%`,
                      backgroundColor: cat.categoryColor
                    }}
                    title={`${cat.categoryName}: ${cat.percentageOfTotal}%`}
                  />
                ))}
              </div>

              {/* Top categories list */}
              <div className="space-y-1.5 pt-1">
                {categoryBreakdown.slice(0, 4).map(cat => (
                  <div key={cat.categoryId} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.categoryColor }} />
                      <span className="text-zinc-300 truncate">{cat.categoryName}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                      <span className="text-zinc-400">{cat.percentageOfTotal}%</span>
                      <span className="text-zinc-100 font-bold">
                        {formatPersonalAmount(cat.totalSpentARS, 'ARS', privacyMode)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CHART B: Evolución Semanal */}
        <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Evolución Semanal
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Gastos vs Ingresos</span>
          </div>

          {/* SVG Bar Visualizer */}
          <div className="h-32 flex items-end justify-between gap-3 pt-4 px-2">
            {weeklyDist.map((w, idx) => {
              const maxVal = Math.max(...weeklyDist.map(item => Math.max(item.expenseARS, item.incomeARS)), 1);
              const expHeight = Math.max(4, Math.round((w.expenseARS / maxVal) * 85));
              const incHeight = Math.max(4, Math.round((w.incomeARS / maxVal) * 85));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-1 h-24">
                    {/* Income Bar */}
                    <div 
                      className="w-2 sm:w-3 bg-emerald-500 rounded-t transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset]"
                      style={{ height: `${incHeight}px` }}
                      title={`Ingresos ${w.weekLabel}: $${w.incomeARS}`}
                    />
                    {/* Expense Bar */}
                    <div 
                      className="w-2 sm:w-3 bg-rose-500 rounded-t transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset]"
                      style={{ height: `${expHeight}px` }}
                      title={`Gastos ${w.weekLabel}: $${w.expenseARS}`}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 font-semibold">{w.weekLabel}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-400 border-t border-zinc-900 pt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Ingresos</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Gastos</span>
            </span>
          </div>
        </div>

      </div>

      {/* CHART C: Tendencia Últimos 6 Meses */}
      <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Histórico de Últimos 6 Meses
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">Consolidado ARS</span>
        </div>

        <div className="h-32 flex items-end justify-between gap-2 pt-2 px-1">
          {last6Months.map((m, idx) => {
            const maxVal = Math.max(...last6Months.map(i => Math.max(i.incomeARS, i.expenseARS)), 1);
            const incH = Math.max(4, Math.round((m.incomeARS / maxVal) * 85));
            const expH = Math.max(4, Math.round((m.expenseARS / maxVal) * 85));

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div className="w-full flex items-end justify-center gap-1 h-24">
                  <div 
                    className="w-2.5 sm:w-3.5 bg-emerald-500/80 rounded-t"
                    style={{ height: `${incH}px` }}
                    title={`Ingreso ${m.month}: $${m.incomeARS}`}
                  />
                  <div 
                    className="w-2.5 sm:w-3.5 bg-rose-500/80 rounded-t"
                    style={{ height: `${expH}px` }}
                    title={`Gasto ${m.month}: $${m.expenseARS}`}
                  />
                </div>
                <span className="text-[10px] font-mono text-zinc-400">{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. UPCOMING RECURRING EXPENSES / SUBSCRIPTIONS */}
      {allActiveRecurrings.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-3.5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Repeat className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Suscripciones y Gastos Fijos
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25">
                {recurringTotals.totalCount} activos
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-rose-400">
                Suma total: {privacyMode ? '$ •••' : formatPersonalAmount(recurringTotals.combinedMonthlyARS, 'ARS', privacyMode)}/mes
              </span>
              <button
                type="button"
                onClick={() => onNavigate('/mis-finanzas/recurrentes')}
                className="text-xs text-[var(--accent)] hover:underline flex items-center gap-0.5"
              >
                <span>Ver todos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sum Breakdown Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                Total Mensual Estimado
              </span>
              <div className="text-sm font-bold font-mono text-zinc-100 truncate">
                {privacyMode ? '$ •••' : (
                  <>
                    {recurringTotals.monthlyARS > 0 ? `$${Math.round(recurringTotals.monthlyARS).toLocaleString('es-AR')}` : ''}
                    {recurringTotals.monthlyARS > 0 && recurringTotals.monthlyUSD > 0 ? ' + ' : ''}
                    {recurringTotals.monthlyUSD > 0 ? `u$s ${recurringTotals.monthlyUSD.toFixed(1)}` : ''}
                    {recurringTotals.monthlyARS === 0 && recurringTotals.monthlyUSD === 0 ? '$0' : ''}
                  </>
                )}
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300 block">
                Pendiente de Pago este Mes
              </span>
              <div className="text-sm font-bold font-mono text-amber-400 truncate">
                {privacyMode ? '$ •••' : (
                  <>
                    {recurringTotals.pendingThisMonthARS > 0 ? `$${Math.round(recurringTotals.pendingThisMonthARS).toLocaleString('es-AR')}` : ''}
                    {recurringTotals.pendingThisMonthARS > 0 && recurringTotals.pendingThisMonthUSD > 0 ? ' + ' : ''}
                    {recurringTotals.pendingThisMonthUSD > 0 ? `u$s ${recurringTotals.pendingThisMonthUSD}` : ''}
                    {recurringTotals.pendingThisMonthARS === 0 && recurringTotals.pendingThisMonthUSD === 0 ? '$0 (Al día)' : ''}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {activeRecurrings.map(rec => (
              <div
                key={rec.id}
                className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-zinc-200 truncate">{rec.title}</div>
                  <div className="text-[10px] text-zinc-400 font-mono">
                    Vence: {rec.nextDate} · {rec.frequency}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="font-mono font-bold text-rose-400">
                    -{formatPersonalAmount(rec.amount, rec.currency, privacyMode)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.success();
                      onConfirmRecurring(rec);
                    }}
                    className="p-1.5 px-2 rounded-xl bg-zinc-800 hover:bg-emerald-500 hover:text-black text-zinc-300 text-xs transition active:scale-95 cursor-pointer flex items-center gap-1 font-semibold"
                    title="Confirmar pago del mes y registrar movimiento"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span className="text-[11px]">Pagar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
