// Pure business logic and calculation engine for Personal Finance (.Cero Mis Finanzas)
import { 
  PersonalAccount, 
  PersonalCategory, 
  PersonalTransaction, 
  PersonalRecurring, 
  PersonalRecurringFrequency,
  PersonalBudget, 
  SavingsGoal, 
  StudyItem, 
  PersonalFinanceSettings,
  IncomeRecord,
  TimeLog
} from '../types';
import { getTodayString } from './storage';

// Default seeded accounts
export const DEFAULT_PERSONAL_ACCOUNTS: Omit<PersonalAccount, 'createdAt'>[] = [
  {
    id: 'acc_efectivo_ars',
    name: 'Efectivo en mano',
    currency: 'ARS',
    initialBalance: 0,
    color: '#10b981',
    icon: 'Banknote',
    archived: false,
  },
  {
    id: 'acc_mp_ars',
    name: 'Mercado Pago',
    currency: 'ARS',
    initialBalance: 0,
    color: '#009EE3',
    icon: 'Smartphone',
    archived: false,
  },
  {
    id: 'acc_banco_ars',
    name: 'Banco (Caja de Ahorro)',
    currency: 'ARS',
    initialBalance: 0,
    color: '#6366f1',
    icon: 'Building2',
    archived: false,
  },
  {
    id: 'acc_dolares_usd',
    name: 'Dólares en mano / Ahorro',
    currency: 'USD',
    initialBalance: 0,
    color: '#22c55e',
    icon: 'DollarSign',
    archived: false,
  },
];

// Default seeded categories
export const DEFAULT_PERSONAL_CATEGORIES: Omit<PersonalCategory, 'createdAt'>[] = [
  // --- Ingresos ---
  { id: 'cat_ing_honorarios', name: 'Honorarios & Clientes', type: 'ingreso', color: '#10b981', icon: 'Briefcase' },
  { id: 'cat_ing_cobros_cero', name: 'Cobros .Cero CRM', type: 'ingreso', color: '#E8590C', icon: 'FolderKanban' },
  { id: 'cat_ing_rendimientos', name: 'Rendimientos / Inversiones', type: 'ingreso', color: '#38bdf8', icon: 'TrendingUp' },
  { id: 'cat_ing_otros', name: 'Otros Ingresos', type: 'ingreso', color: '#a1a1aa', icon: 'Plus' },

  // --- Gastos ---
  { id: 'cat_gas_super', name: 'Comida & Supermercado', type: 'gasto', color: '#f43f5e', icon: 'ShoppingCart', monthlyBudget: 150000 },
  { id: 'cat_gas_vivienda', name: 'Vivienda & Servicios', type: 'gasto', color: '#ef4444', icon: 'Home', monthlyBudget: 120000 },
  { id: 'cat_gas_transporte', name: 'Transporte & Movilidad', type: 'gasto', color: '#f97316', icon: 'Car', monthlyBudget: 40000 },
  { id: 'cat_gas_software', name: 'Herramientas & Software', type: 'gasto', color: '#8b5cf6', icon: 'Laptop', monthlyBudget: 35000 },
  { id: 'cat_gas_salidas', name: 'Salidas, Café & Ocio', type: 'gasto', color: '#ec4899', icon: 'Coffee', monthlyBudget: 60000 },
  { id: 'cat_gas_salud', name: 'Salud & Cuidado Personal', type: 'gasto', color: '#06b6d4', icon: 'Heart', monthlyBudget: 30000 },
  { id: 'cat_gas_varios', name: 'Gastos Varios', type: 'gasto', color: '#71717a', icon: 'Tag', monthlyBudget: 25000 },

  // --- Ahorro ---
  { id: 'cat_aho_emergencia', name: 'Fondo de Emergencia', type: 'ahorro', color: '#3b82f6', icon: 'ShieldCheck' },
  { id: 'cat_aho_inversion', name: 'Inversiones & Dólares', type: 'ahorro', color: '#0ea5e9', icon: 'TrendingUp' },

  // --- Estudio ---
  { id: 'cat_est_cursos', name: 'Cursos & Mentorías', type: 'estudio', color: '#a855f7', icon: 'GraduationCap' },
  { id: 'cat_est_libros', name: 'Libros & Materiales', type: 'estudio', color: '#9333ea', icon: 'BookOpen' },
  { id: 'cat_est_herramientas', name: 'Herramientas de Estudio', type: 'estudio', color: '#c084fc', icon: 'Cpu' },
];

export const DEFAULT_PERSONAL_SETTINGS: PersonalFinanceSettings = {
  id: 'personal_settings_default',
  usdExchangeRate: 1250, // Cotización de referencia inicial ARS por USD
  pinEnabled: false,
  scriptableToken: 'cero_fin_token_' + Math.random().toString(36).substring(2, 10),
  hideAmountsInWidget: false,
};

// --- Formatters ---

export function formatPersonalAmount(
  amount: number, 
  currency: 'ARS' | 'USD', 
  privacyMode: boolean = false
): string {
  if (privacyMode) {
    return currency === 'USD' ? 'US$ ••••••' : '$ ••••••';
  }
  const formatted = Math.abs(amount).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const prefix = amount < 0 ? '-' : '';
  return currency === 'USD' ? `${prefix}US$ ${formatted}` : `${prefix}$ ${formatted}`;
}

export function getCurrentMonthStr(): string {
  const today = getTodayString();
  return today.slice(0, 7); // YYYY-MM
}

export function getPreviousMonthStr(currentMonth: string = getCurrentMonthStr()): string {
  const [yearStr, monthStr] = currentMonth.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatMonthName(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

// --- Account Balance Calculation ---

export function calculateAccountBalance(
  account: PersonalAccount, 
  transactions: PersonalTransaction[]
): number {
  let balance = account.initialBalance || 0;

  for (const t of transactions) {
    if (t.status !== 'confirmado') continue;

    // Movement from this account
    if (t.accountId === account.id) {
      if (t.type === 'ingreso') {
        balance += t.amount;
      } else if (t.type === 'gasto' || t.type === 'ahorro') {
        balance -= t.amount;
      } else if (t.type === 'transferencia') {
        balance -= t.amount;
      }
    }

    // Movement TO this account (Transfer receipt)
    if (t.type === 'transferencia' && t.toAccountId === account.id) {
      balance += t.amount;
    }
  }

  return Math.round(balance * 100) / 100;
}

export function calculateTotalBalances(
  accounts: PersonalAccount[], 
  transactions: PersonalTransaction[],
  usdRate: number = 1250
): {
  arsTotal: number;
  usdTotal: number;
  combinedInARS: number;
  combinedInUSD: number;
  activeAccountsCount: number;
} {
  let arsTotal = 0;
  let usdTotal = 0;
  let activeAccountsCount = 0;

  for (const acc of accounts) {
    if (acc.archived) continue;
    activeAccountsCount++;
    const bal = calculateAccountBalance(acc, transactions);
    if (acc.currency === 'ARS') {
      arsTotal += bal;
    } else {
      usdTotal += bal;
    }
  }

  const combinedInARS = Math.round((arsTotal + (usdTotal * usdRate)) * 100) / 100;
  const combinedInUSD = usdRate > 0 ? Math.round(((arsTotal / usdRate) + usdTotal) * 100) / 100 : usdTotal;

  return {
    arsTotal: Math.round(arsTotal * 100) / 100,
    usdTotal: Math.round(usdTotal * 100) / 100,
    combinedInARS,
    combinedInUSD,
    activeAccountsCount,
  };
}

// --- Monthly Analytics ---

export interface MonthlyFinanceSummary {
  month: string;
  totalIncomeARS: number;
  totalExpenseARS: number;
  totalSavingsARS: number;
  netCashflowARS: number;
  totalIncomeUSD: number;
  totalExpenseUSD: number;
  totalSavingsUSD: number;
  netCashflowUSD: number;
  // Normalized in ARS using manual exchange rate
  normalizedIncomeARS: number;
  normalizedExpenseARS: number;
  normalizedSavingsARS: number;
  normalizedNetARS: number;
  savingsRatePercent: number; // (Ahorro / Ingreso) * 100
  expenseCount: number;
  incomeCount: number;
}

export function calculateMonthlyFinanceSummary(
  transactions: PersonalTransaction[],
  month: string = getCurrentMonthStr(),
  usdRate: number = 1250
): MonthlyFinanceSummary {
  const monthTransactions = transactions.filter(t => 
    t.date.startsWith(month) && t.status === 'confirmado'
  );

  let totalIncomeARS = 0;
  let totalExpenseARS = 0;
  let totalSavingsARS = 0;

  let totalIncomeUSD = 0;
  let totalExpenseUSD = 0;
  let totalSavingsUSD = 0;

  let expenseCount = 0;
  let incomeCount = 0;

  for (const t of monthTransactions) {
    if (t.type === 'ingreso') {
      incomeCount++;
      if (t.currency === 'ARS') totalIncomeARS += t.amount;
      else totalIncomeUSD += t.amount;
    } else if (t.type === 'gasto') {
      expenseCount++;
      if (t.currency === 'ARS') totalExpenseARS += t.amount;
      else totalExpenseUSD += t.amount;
    } else if (t.type === 'ahorro') {
      if (t.currency === 'ARS') totalSavingsARS += t.amount;
      else totalSavingsUSD += t.amount;
    }
  }

  const netCashflowARS = totalIncomeARS - totalExpenseARS - totalSavingsARS;
  const netCashflowUSD = totalIncomeUSD - totalExpenseUSD - totalSavingsUSD;

  const normalizedIncomeARS = totalIncomeARS + (totalIncomeUSD * usdRate);
  const normalizedExpenseARS = totalExpenseARS + (totalExpenseUSD * usdRate);
  const normalizedSavingsARS = totalSavingsARS + (totalSavingsUSD * usdRate);
  const normalizedNetARS = normalizedIncomeARS - normalizedExpenseARS - normalizedSavingsARS;

  const savingsRatePercent = normalizedIncomeARS > 0 
    ? Math.round(((normalizedSavingsARS / normalizedIncomeARS) * 100) * 10) / 10
    : 0;

  return {
    month,
    totalIncomeARS: Math.round(totalIncomeARS * 100) / 100,
    totalExpenseARS: Math.round(totalExpenseARS * 100) / 100,
    totalSavingsARS: Math.round(totalSavingsARS * 100) / 100,
    netCashflowARS: Math.round(netCashflowARS * 100) / 100,
    totalIncomeUSD: Math.round(totalIncomeUSD * 100) / 100,
    totalExpenseUSD: Math.round(totalExpenseUSD * 100) / 100,
    totalSavingsUSD: Math.round(totalSavingsUSD * 100) / 100,
    netCashflowUSD: Math.round(netCashflowUSD * 100) / 100,
    normalizedIncomeARS: Math.round(normalizedIncomeARS * 100) / 100,
    normalizedExpenseARS: Math.round(normalizedExpenseARS * 100) / 100,
    normalizedSavingsARS: Math.round(normalizedSavingsARS * 100) / 100,
    normalizedNetARS: Math.round(normalizedNetARS * 100) / 100,
    savingsRatePercent,
    expenseCount,
    incomeCount,
  };
}

// Compare current month with previous month
export function compareWithPreviousMonth(
  transactions: PersonalTransaction[],
  currentMonth: string = getCurrentMonthStr(),
  usdRate: number = 1250
): {
  current: MonthlyFinanceSummary;
  previous: MonthlyFinanceSummary;
  expenseDiffPercent: number;
  incomeDiffPercent: number;
  netDiffPercent: number;
} {
  const prevMonth = getPreviousMonthStr(currentMonth);
  const current = calculateMonthlyFinanceSummary(transactions, currentMonth, usdRate);
  const previous = calculateMonthlyFinanceSummary(transactions, prevMonth, usdRate);

  const calcDiff = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return {
    current,
    previous,
    expenseDiffPercent: calcDiff(current.normalizedExpenseARS, previous.normalizedExpenseARS),
    incomeDiffPercent: calcDiff(current.normalizedIncomeARS, previous.normalizedIncomeARS),
    netDiffPercent: calcDiff(current.normalizedNetARS, previous.normalizedNetARS),
  };
}

// Category breakdown for charts
export interface CategorySpendingBreakdown {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  totalSpentARS: number;
  percentageOfTotal: number;
  transactionCount: number;
}

export function getCategorySpendingBreakdown(
  transactions: PersonalTransaction[],
  categories: PersonalCategory[],
  month: string = getCurrentMonthStr(),
  usdRate: number = 1250
): CategorySpendingBreakdown[] {
  const monthExpenses = transactions.filter(t => 
    t.date.startsWith(month) && 
    (t.type === 'gasto' || t.type === 'ahorro') && 
    t.status === 'confirmado'
  );

  const catMap = new Map<string, PersonalCategory>();
  for (const c of categories) catMap.set(c.id, c);

  const spendingMap = new Map<string, { total: number; count: number }>();
  let overallSpentARS = 0;

  for (const t of monthExpenses) {
    const amountInARS = t.currency === 'USD' ? t.amount * usdRate : t.amount;
    overallSpentARS += amountInARS;

    const existing = spendingMap.get(t.categoryId) || { total: 0, count: 0 };
    spendingMap.set(t.categoryId, {
      total: existing.total + amountInARS,
      count: existing.count + 1,
    });
  }

  const results: CategorySpendingBreakdown[] = [];
  for (const [catId, data] of spendingMap.entries()) {
    const cat = catMap.get(catId);
    results.push({
      categoryId: catId,
      categoryName: cat?.name || 'Otras',
      categoryColor: cat?.color || '#a1a1aa',
      categoryIcon: cat?.icon || 'Tag',
      totalSpentARS: Math.round(data.total),
      percentageOfTotal: overallSpentARS > 0 ? Math.round((data.total / overallSpentARS) * 100) : 0,
      transactionCount: data.count,
    });
  }

  // Sort descending by amount spent
  return results.sort((a, b) => b.totalSpentARS - a.totalSpentARS);
}

// --- Budgets ---

export interface BudgetStatusItem {
  budget: PersonalBudget;
  category: PersonalCategory | undefined;
  spent: number;
  remaining: number;
  percentageUsed: number;
  isOverLimit: boolean;
  isWarning: boolean; // >= 80%
}

export function calculateBudgetsStatus(
  budgets: PersonalBudget[],
  categories: PersonalCategory[],
  transactions: PersonalTransaction[],
  month: string = getCurrentMonthStr(),
  usdRate: number = 1250
): BudgetStatusItem[] {
  const currentBudgets = budgets.filter(b => b.month === month);
  const catMap = new Map<string, PersonalCategory>();
  for (const c of categories) catMap.set(c.id, c);

  const monthExpenses = transactions.filter(t => 
    t.date.startsWith(month) && 
    t.type === 'gasto' && 
    t.status === 'confirmado'
  );

  return currentBudgets.map(b => {
    const cat = catMap.get(b.categoryId);
    const catTransactions = monthExpenses.filter(t => t.categoryId === b.categoryId);
    
    let spent = 0;
    for (const t of catTransactions) {
      if (t.currency === b.currency) {
        spent += t.amount;
      } else if (b.currency === 'ARS') {
        spent += t.amount * usdRate;
      } else {
        spent += usdRate > 0 ? t.amount / usdRate : t.amount;
      }
    }

    const percentageUsed = b.limit > 0 ? Math.min(200, Math.round((spent / b.limit) * 100)) : 0;
    const remaining = Math.max(0, b.limit - spent);

    return {
      budget: b,
      category: cat,
      spent: Math.round(spent * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      percentageUsed,
      isOverLimit: spent > b.limit,
      isWarning: percentageUsed >= 80 && spent <= b.limit,
    };
  });
}

// --- Savings Goals Projections ---

export function calculateGoalProjection(
  goal: SavingsGoal,
  averageMonthlySavingsARS: number = 0,
  usdRate: number = 1250
): {
  percentage: number;
  remaining: number;
  estimatedMonths: number;
  estimatedDate: string | null;
} {
  const target = goal.targetAmount || 1;
  const current = goal.savedAmount || 0;
  const remaining = Math.max(0, target - current);
  const percentage = Math.min(100, Math.round((current / target) * 100));

  let monthlyRate = averageMonthlySavingsARS;
  if (goal.currency === 'USD') {
    monthlyRate = usdRate > 0 ? averageMonthlySavingsARS / usdRate : 0;
  }

  if (remaining <= 0) {
    return {
      percentage: 100,
      remaining: 0,
      estimatedMonths: 0,
      estimatedDate: '¡Meta alcanzada!',
    };
  }

  if (monthlyRate <= 0) {
    return {
      percentage,
      remaining,
      estimatedMonths: 999,
      estimatedDate: null,
    };
  }

  const estimatedMonths = Math.ceil(remaining / monthlyRate);
  const future = new Date();
  future.setMonth(future.getMonth() + estimatedMonths);
  const estimatedDate = future.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return {
    percentage,
    remaining: Math.round(remaining * 100) / 100,
    estimatedMonths,
    estimatedDate,
  };
}

// --- Study Items Investment Metrics ---

export function calculateStudyInvestmentMetrics(
  studyItems: StudyItem[],
  timeLogs: TimeLog[] = [],
  usdRate: number = 1250
): {
  totalItems: number;
  inProgressCount: number;
  completedCount: number;
  totalInvestedARS: number;
  totalInvestedUSD: number;
  normalizedTotalARS: number;
  totalHoursStudied: number;
  averageCostPerHourARS: number;
} {
  let totalInvestedARS = 0;
  let totalInvestedUSD = 0;
  let inProgressCount = 0;
  let completedCount = 0;

  for (const item of studyItems) {
    if (item.status === 'en curso') inProgressCount++;
    if (item.status === 'terminado') completedCount++;

    if (item.currency === 'ARS') {
      totalInvestedARS += item.totalCost || 0;
    } else {
      totalInvestedUSD += item.totalCost || 0;
    }
  }

  const normalizedTotalARS = totalInvestedARS + (totalInvestedUSD * usdRate);

  // Calculate hours invested from item directly or associated TimeLogs
  let totalHoursStudied = 0;
  for (const item of studyItems) {
    let itemHours = item.hoursInvested || 0;
    // If study item has related timeLogs by noteId or title
    const matchingLogs = timeLogs.filter(l => 
      (item.noteId && l.description.toLowerCase().includes(item.title.toLowerCase())) ||
      (l.description.toLowerCase().includes(item.title.toLowerCase()))
    );
    const logHours = matchingLogs.reduce((sum, l) => sum + ((l.durationMinutes || l.minutes || 0) / 60), 0);
    totalHoursStudied += Math.max(itemHours, logHours);
  }

  totalHoursStudied = Math.round(totalHoursStudied * 10) / 10;
  const averageCostPerHourARS = totalHoursStudied > 0 
    ? Math.round(normalizedTotalARS / totalHoursStudied) 
    : 0;

  return {
    totalItems: studyItems.length,
    inProgressCount,
    completedCount,
    totalInvestedARS: Math.round(totalInvestedARS),
    totalInvestedUSD: Math.round(totalInvestedUSD),
    normalizedTotalARS: Math.round(normalizedTotalARS),
    totalHoursStudied,
    averageCostPerHourARS,
  };
}

// --- Linking Business IncomeRecord to Personal Finance (No double count) ---

export interface UnallocatedBusinessIncome {
  income: IncomeRecord;
  alreadyAllocated: boolean;
  allocatedAmount?: number;
  allocatedDate?: string;
}

export function getBusinessIncomeAllocationList(
  businessIncomes: IncomeRecord[],
  transactions: PersonalTransaction[]
): UnallocatedBusinessIncome[] {
  // Map of transactions that reference an IncomeRecord
  const allocatedMap = new Map<string, PersonalTransaction>();
  for (const t of transactions) {
    if (t.sourceIncomeId) {
      allocatedMap.set(t.sourceIncomeId, t);
    }
  }

  // Only consider 'cobrado' incomes
  return businessIncomes
    .filter(i => i.status === 'cobrado')
    .map(inc => {
      const match = allocatedMap.get(inc.id);
      return {
        income: inc,
        alreadyAllocated: !!match,
        allocatedAmount: match?.amount,
        allocatedDate: match?.date,
      };
    })
    .sort((a, b) => b.income.date.localeCompare(a.income.date));
}

// Last 6 months trend data for SVG charts
export function getLast6MonthsTrend(
  transactions: PersonalTransaction[],
  usdRate: number = 1250
): {
  month: string;
  label: string;
  incomeARS: number;
  expenseARS: number;
  savingsARS: number;
}[] {
  const result: { month: string; label: string; incomeARS: number; expenseARS: number; savingsARS: number }[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('es-AR', { month: 'short' });
    const summary = calculateMonthlyFinanceSummary(transactions, mStr, usdRate);

    result.push({
      month: mStr,
      label: label.charAt(0).toUpperCase() + label.slice(1, 3),
      incomeARS: summary.normalizedIncomeARS,
      expenseARS: summary.normalizedExpenseARS,
      savingsARS: summary.normalizedSavingsARS,
    });
  }

  return result;
}

// Weekly distribution for sparklines (Current month weeks)
export function getWeeklyDistribution(
  transactions: PersonalTransaction[],
  month: string = getCurrentMonthStr(),
  usdRate: number = 1250
): { weekLabel: string; expenseARS: number; incomeARS: number }[] {
  const weeks = [
    { weekLabel: 'S1', minDay: 1, maxDay: 7, expenseARS: 0, incomeARS: 0 },
    { weekLabel: 'S2', minDay: 8, maxDay: 14, expenseARS: 0, incomeARS: 0 },
    { weekLabel: 'S3', minDay: 15, maxDay: 21, expenseARS: 0, incomeARS: 0 },
    { weekLabel: 'S4', minDay: 22, maxDay: 31, expenseARS: 0, incomeARS: 0 },
  ];

  const monthTxs = transactions.filter(t => t.date.startsWith(month) && t.status === 'confirmado');

  for (const t of monthTxs) {
    const day = parseInt(t.date.split('-')[2] || '1', 10);
    const amountInARS = t.currency === 'USD' ? t.amount * usdRate : t.amount;

    for (const w of weeks) {
      if (day >= w.minDay && day <= w.maxDay) {
        if (t.type === 'gasto') w.expenseARS += amountInARS;
        if (t.type === 'ingreso') w.incomeARS += amountInARS;
        break;
      }
    }
  }

  return weeks.map(w => ({
    weekLabel: w.weekLabel,
    expenseARS: Math.round(w.expenseARS),
    incomeARS: Math.round(w.incomeARS),
  }));
}

export function calculateNextRecurringDate(
  currentDateStr: string,
  frequency: PersonalRecurringFrequency
): string {
  const parts = currentDateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);

  switch (frequency) {
    case 'semanal':
      date.setDate(date.getDate() + 7);
      break;
    case 'quincenal':
      date.setDate(date.getDate() + 14);
      break;
    case 'mensual':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'anual':
      date.setFullYear(date.getFullYear() + 1);
      break;
    case 'custom':
    default:
      date.setMonth(date.getMonth() + 1);
      break;
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

