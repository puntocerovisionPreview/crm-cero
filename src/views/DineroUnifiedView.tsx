import React, { useState, useEffect } from 'react';
import { 
  Project, 
  IncomeRecord, 
  ExpenseRecord, 
  Payment, 
  PersonalAccount, 
  PersonalCategory, 
  PersonalTransaction, 
  PersonalRecurring, 
  PersonalBudget, 
  SavingsGoal, 
  StudyItem, 
  PersonalFinanceSettings,
  TimeLog,
  StudioFixedExpense
} from '../types';
import { calculateTotalBalances } from '../utils/personalFinance';
import { IncomeView } from './IncomeView';
import { PersonalFinanceOverviewView } from './personal-finance/PersonalFinanceOverviewView';
import { PersonalFinanceTransactionsView } from './personal-finance/PersonalFinanceTransactionsView';
import { PersonalFinanceAccountsView } from './personal-finance/PersonalFinanceAccountsView';
import { PersonalFinanceBudgetsView } from './personal-finance/PersonalFinanceBudgetsView';
import { PersonalFinanceRecurringView } from './personal-finance/PersonalFinanceRecurringView';
import { PersonalFinanceGoalsView } from './personal-finance/PersonalFinanceGoalsView';
import { PersonalFinanceStudyView } from './personal-finance/PersonalFinanceStudyView';
import { hapticFeedback } from '../utils/haptics';
import { getUiPreferences } from '../utils/uiPreferences';
import { 
  Building2, 
  User, 
  Plus, 
  Wallet, 
  ArrowLeftRight, 
  TrendingUp, 
  TrendingDown,
  PiggyBank, 
  BookOpen, 
  PieChart, 
  Repeat,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DEFAULT_USD_RATE } from '../utils/currency';

interface Props {
  initialMode?: 'estudio' | 'personal';
  incomes: IncomeRecord[];
  expenses?: ExpenseRecord[];
  projects?: Project[];
  personalAccounts?: PersonalAccount[];
  personalCategories?: PersonalCategory[];
  personalTransactions?: PersonalTransaction[];
  personalRecurrings?: PersonalRecurring[];
  personalBudgets?: PersonalBudget[];
  personalSavingsGoals?: SavingsGoal[];
  personalStudyItems?: StudyItem[];
  personalSettings?: PersonalFinanceSettings;
  studioFixedExpenses?: StudioFixedExpense[];
  privacyMode?: boolean;
  usdRate?: number;
  onAddIncome: (income: Omit<IncomeRecord, 'id' | 'createdAt'>) => void;
  onUpdateIncome: (id: string, updates: Partial<IncomeRecord>) => void;
  onDeleteIncome: (id: string) => void;
  onAddExpense?: (expense: Omit<ExpenseRecord, 'id' | 'createdAt'>) => void;
  onUpdateExpense?: (id: string, updates: Partial<ExpenseRecord>) => void;
  onDeleteExpense?: (id: string) => void;
  onAddFixedExpense?: (item: Omit<StudioFixedExpense, 'id' | 'createdAt'>) => void;
  onUpdateFixedExpense?: (id: string, updates: Partial<StudioFixedExpense>) => void;
  onDeleteFixedExpense?: (id: string) => void;
  onUpdateProject?: (id: string, updates: Partial<Project>) => void;
  onOpenProject360?: (project: Project) => void;
  onSavePayment?: (projectId: string, payment: Payment, options?: any) => void;
  onDeletePayment?: (projectId: string, paymentId: string) => void;
  // Personal Finance handlers
  onSavePersonalTransaction?: (tx: Omit<PersonalTransaction, 'id' | 'createdAt'>) => void;
  onUpdatePersonalTransaction?: (id: string, updates: Partial<PersonalTransaction>) => void;
  onDeletePersonalTransaction?: (id: string) => void;
  onSavePersonalAccount?: (acc: Omit<PersonalAccount, 'id' | 'createdAt'>) => void;
  onUpdatePersonalAccount?: (id: string, updates: Partial<PersonalAccount>) => void;
  onDeletePersonalAccount?: (id: string) => void;
  onSavePersonalBudget?: (budget: Omit<PersonalBudget, 'id' | 'createdAt'>) => void;
  onUpdatePersonalBudget?: (id: string, updates: Partial<PersonalBudget>) => void;
  onDeletePersonalBudget?: (id: string) => void;
  onSavePersonalRecurring?: (rec: Omit<PersonalRecurring, 'id' | 'createdAt'>) => void;
  onUpdatePersonalRecurring?: (id: string, updates: Partial<PersonalRecurring>) => void;
  onDeletePersonalRecurring?: (id: string) => void;
  onConfirmPersonalRecurring?: (recurring: PersonalRecurring) => void;
  onSavePersonalSavingsGoal?: (goal: Omit<SavingsGoal, 'id' | 'createdAt'>) => void;
  onUpdatePersonalSavingsGoal?: (id: string, updates: Partial<SavingsGoal>) => void;
  onDeletePersonalSavingsGoal?: (id: string) => void;
  onSavePersonalStudyItem?: (item: Omit<StudyItem, 'id' | 'createdAt'>) => void;
  onUpdatePersonalStudyItem?: (id: string, updates: Partial<StudyItem>) => void;
  onDeletePersonalStudyItem?: (id: string) => void;
  timeLogs?: TimeLog[];
  onOpenQuickAdd?: (type?: any, defaultDate?: string) => void;
  onNavigate?: (path: string) => void;
}

export const DineroUnifiedView: React.FC<Props> = ({
  initialMode = 'estudio',
  incomes,
  expenses = [],
  projects = [],
  timeLogs = [],
  personalAccounts = [],
  personalCategories = [],
  personalTransactions = [],
  personalRecurrings = [],
  personalBudgets = [],
  personalSavingsGoals = [],
  personalStudyItems = [],
  personalSettings,
  studioFixedExpenses = [],
  privacyMode = false,
  usdRate = DEFAULT_USD_RATE,
  onAddIncome,
  onUpdateIncome,
  onDeleteIncome,
  onAddExpense = () => {},
  onUpdateExpense = () => {},
  onDeleteExpense = () => {},
  onAddFixedExpense = () => {},
  onUpdateFixedExpense = () => {},
  onDeleteFixedExpense = () => {},
  onUpdateProject = () => {},
  onOpenProject360,
  onSavePayment,
  onDeletePayment,
  onSavePersonalTransaction = () => {},
  onUpdatePersonalTransaction = () => {},
  onDeletePersonalTransaction = () => {},
  onSavePersonalAccount = () => {},
  onUpdatePersonalAccount = () => {},
  onDeletePersonalAccount = () => {},
  onSavePersonalBudget = () => {},
  onUpdatePersonalBudget = () => {},
  onDeletePersonalBudget = () => {},
  onSavePersonalRecurring = () => {},
  onUpdatePersonalRecurring = () => {},
  onDeletePersonalRecurring = () => {},
  onConfirmPersonalRecurring,
  onSavePersonalSavingsGoal = () => {},
  onUpdatePersonalSavingsGoal = () => {},
  onDeletePersonalSavingsGoal = () => {},
  onSavePersonalStudyItem = () => {},
  onUpdatePersonalStudyItem = () => {},
  onDeletePersonalStudyItem = () => {},
  onOpenQuickAdd,
  onNavigate,
}) => {
  const prefs = getUiPreferences();
  const [mode, setMode] = useState<'estudio' | 'personal'>(() => {
    if (prefs.hideDineroPersonal) return 'estudio';
    return initialMode;
  });

  useEffect(() => {
    if (initialMode) {
      if (initialMode === 'personal' && prefs.hideDineroPersonal) {
        setMode('estudio');
      } else {
        setMode(initialMode);
      }
    }
  }, [initialMode, prefs.hideDineroPersonal]);

  // Personal finance sub-tabs: 'resumen' | 'movimientos' | 'cuentas' | 'planificacion'
  const [personalTab, setPersonalTab] = useState<'resumen' | 'movimientos' | 'cuentas' | 'planificacion'>('resumen');

  // Planificacion sections collapsed states
  const [planPresupuestosOpen, setPlanPresupuestosOpen] = useState(true);
  const [planRecurrentesOpen, setPlanRecurrentesOpen] = useState(true);
  const [planMetasOpen, setPlanMetasOpen] = useState(true);
  const [planEstudioOpen, setPlanEstudioOpen] = useState(true);

  // Net worth calculation for Personal
  const totalBalances = calculateTotalBalances(personalAccounts, personalTransactions, usdRate);
  const totalNetWorthARS = totalBalances.combinedInARS;
  const totalNetWorthUSD = totalBalances.combinedInUSD;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* Fixed Sticky Top Header: Segmented Switch (Estudio | Personal) */}
      <div className="sticky top-0 z-20 bg-[var(--bg-app)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Segmented Switch: Estudio | Personal */}
        <div className="flex p-0.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              setMode('estudio');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] text-xs font-semibold transition cursor-pointer ${
              mode === 'estudio'
                ? 'btn-solid-primary shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Estudio</span>
          </button>

          {!prefs.hideDineroPersonal && (
            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                setMode('personal');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] text-xs font-semibold transition cursor-pointer ${
                mode === 'personal'
                  ? 'btn-solid-primary shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Personal</span>
            </button>
          )}
        </div>

        {/* Contextual Action Button */}
        {mode === 'estudio' ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                onOpenQuickAdd?.('ingreso');
              }}
              className="min-h-[44px] sm:min-h-[32px] px-3 py-1.5 rounded-[var(--radius-control)] btn-solid-primary text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              title="Registrar cobro o ingreso libre de estudio"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2]" />
              <span>Movimiento</span>
            </button>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                onOpenQuickAdd?.('gasto');
              }}
              className="min-h-[44px] sm:min-h-[32px] px-2.5 py-1.5 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold flex items-center gap-1 transition active:scale-95 cursor-pointer"
              title="Registrar gasto de estudio"
            >
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              <span>Registrar gasto</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                if (onNavigate) {
                  onNavigate('/mis-finanzas/nuevo?tipo=gasto');
                } else {
                  onOpenQuickAdd?.('gasto');
                }
              }}
              className="min-h-[44px] sm:min-h-[32px] px-3.5 py-1.5 rounded-[var(--radius-control)] btn-solid-primary text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              title="Cargar nuevo movimiento en tus finanzas personales"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2]" />
              <span>Movimiento</span>
            </button>
          </div>
        )}
      </div>

      {/* Mode 1: Estudio */}
      {mode === 'estudio' && (
        <div className="flex-1 overflow-y-auto">
          <IncomeView
            incomes={incomes}
            expenses={expenses}
            studioFixedExpenses={studioFixedExpenses}
            projects={projects}
            onAddIncome={onAddIncome}
            onUpdateIncome={onUpdateIncome}
            onDeleteIncome={onDeleteIncome}
            onAddExpense={onAddExpense}
            onUpdateExpense={onUpdateExpense}
            onDeleteExpense={onDeleteExpense}
            onAddFixedExpense={onAddFixedExpense}
            onUpdateFixedExpense={onUpdateFixedExpense}
            onDeleteFixedExpense={onDeleteFixedExpense}
            onUpdateProject={onUpdateProject}
            onOpenProject360={onOpenProject360}
            privacyMode={privacyMode}
            onSavePayment={onSavePayment}
            onDeletePayment={onDeletePayment}
            personalAccounts={personalAccounts}
            usdRate={usdRate}
          />
        </div>
      )}

      {/* Mode 2: Personal */}
      {mode === 'personal' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-w-6xl mx-auto w-full">
          {/* Top Total Net Worth Card */}
          <div className="card-swiss p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-surface)]">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] block">
                Patrimonio Neto Total (Mis Finanzas)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-mono font-bold text-[var(--text-primary)]">
                  {privacyMode ? '$ ••••••' : `$ ${totalNetWorthARS.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                </span>
                <span className="text-xs font-mono text-[var(--text-secondary)]">
                  {privacyMode ? 'u$s •••' : `≈ u$s ${totalNetWorthUSD.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
              <span>TC Ref: <strong>$ {usdRate}</strong></span>
              <span>·</span>
              <span>{personalAccounts.length} cuentas activas</span>
            </div>
          </div>

          {/* Personal Sub-Tabs (4 pestañas: Resumen · Movimientos · Cuentas · Planificación) */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border-subtle)] pb-2 scrollbar-none">
            {[
              { id: 'resumen' as const, label: 'Resumen' },
              { id: 'movimientos' as const, label: 'Movimientos' },
              { id: 'cuentas' as const, label: 'Cuentas' },
              { id: 'planificacion' as const, label: 'Planificación' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setPersonalTab(t.id);
                }}
                className={`min-h-[44px] sm:min-h-[34px] px-3.5 py-1.5 rounded-[var(--radius-control)] text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  personalTab === t.id
                    ? 'btn-solid-primary shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Sub-tab 1: Resumen */}
          {personalTab === 'resumen' && (
            <PersonalFinanceOverviewView
              accounts={personalAccounts}
              categories={personalCategories}
              transactions={personalTransactions}
              recurrings={personalRecurrings}
              budgets={personalBudgets}
              settings={personalSettings || { usdExchangeRate: usdRate }}
              incomes={incomes}
              privacyMode={privacyMode}
              onNavigate={(sub) => {
                if (sub.includes('transactions')) setPersonalTab('movimientos');
                else if (sub.includes('accounts')) setPersonalTab('cuentas');
                else if (sub.includes('budgets') || sub.includes('goals') || sub.includes('recurring')) setPersonalTab('planificacion');
                else onNavigate?.(sub);
              }}
              onConfirmRecurring={onConfirmPersonalRecurring || (async () => {})}
            />
          )}

          {/* Sub-tab 2: Movimientos */}
          {personalTab === 'movimientos' && (
            <PersonalFinanceTransactionsView
              transactions={personalTransactions}
              accounts={personalAccounts}
              categories={personalCategories}
              projects={projects}
              privacyMode={privacyMode}
              onUpdateTransaction={async (id, updates) => { onUpdatePersonalTransaction?.(id, updates); }}
              onDeleteTransaction={async (id) => { onDeletePersonalTransaction?.(id); }}
              onNavigate={onNavigate || (() => {})}
            />
          )}

          {/* Sub-tab 3: Cuentas */}
          {personalTab === 'cuentas' && (
            <PersonalFinanceAccountsView
              accounts={personalAccounts}
              transactions={personalTransactions}
              privacyMode={privacyMode}
              onSaveAccount={async (acc) => { onSavePersonalAccount?.(acc); }}
              onUpdateAccount={async (id, updates) => { onUpdatePersonalAccount?.(id, updates); }}
              onDeleteAccount={async (id) => { onDeletePersonalAccount?.(id); }}
              onNavigate={onNavigate || (() => {})}
            />
          )}

          {/* Sub-tab 4: Planificación (Collapsible sections: Presupuestos, Recurrentes, Metas, Estudio) */}
          {personalTab === 'planificacion' && (
            <div className="space-y-4">
              {/* Seccion 1: Presupuestos por categoría */}
              <div className="card-swiss overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPlanPresupuestosOpen(prev => !prev)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--bg-surface-muted)] transition cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-[var(--accent)]" />
                    <span className="text-xs font-semibold text-[var(--text-primary)] font-heading">
                      Presupuestos de Gasto Mensual
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]">
                      {personalBudgets.length} definidos
                    </span>
                  </div>
                  {planPresupuestosOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {planPresupuestosOpen && (
                  <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-app)]/30">
                    <PersonalFinanceBudgetsView
                      budgets={personalBudgets}
                      categories={personalCategories}
                      transactions={personalTransactions}
                      settings={personalSettings || { usdExchangeRate: usdRate }}
                      privacyMode={privacyMode}
                      onSaveBudget={async (budget) => { onSavePersonalBudget?.(budget); }}
                      onUpdateBudget={async (id, updates) => { onUpdatePersonalBudget?.(id, updates); }}
                      onDeleteBudget={async (id) => { onDeletePersonalBudget?.(id); }}
                      onNavigate={onNavigate || (() => {})}
                    />
                  </div>
                )}
              </div>

              {/* Seccion 2: Transacciones Recurrentes */}
              <div className="card-swiss overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPlanRecurrentesOpen(prev => !prev)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--bg-surface-muted)] transition cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-[var(--text-primary)] font-heading">
                      Gastos e Ingresos Recurrentes (Suscripciones, Servicios)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]">
                      {personalRecurrings.length} activos
                    </span>
                  </div>
                  {planRecurrentesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {planRecurrentesOpen && (
                  <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-app)]/30">
                    <PersonalFinanceRecurringView
                      recurrings={personalRecurrings}
                      accounts={personalAccounts}
                      categories={personalCategories}
                      privacyMode={privacyMode}
                      usdRate={usdRate}
                      onSaveRecurring={async (rec) => { onSavePersonalRecurring?.(rec); }}
                      onUpdateRecurring={async (id, updates) => { onUpdatePersonalRecurring?.(id, updates); }}
                      onDeleteRecurring={async (id) => { onDeletePersonalRecurring?.(id); }}
                      onConfirmRecurring={onConfirmPersonalRecurring || (async () => {})}
                      onNavigate={onNavigate || (() => {})}
                    />
                  </div>
                )}
              </div>

              {/* Seccion 3: Metas de Ahorro */}
              <div className="card-swiss overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPlanMetasOpen(prev => !prev)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--bg-surface-muted)] transition cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <PiggyBank className="w-4 h-4 text-sky-500" />
                    <span className="text-xs font-semibold text-[var(--text-primary)] font-heading">
                      Metas y Fondos de Ahorro
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]">
                      {personalSavingsGoals.length} metas
                    </span>
                  </div>
                  {planMetasOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {planMetasOpen && (
                  <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-app)]/30">
                    <PersonalFinanceGoalsView
                      goals={personalSavingsGoals}
                      transactions={personalTransactions}
                      settings={personalSettings || { usdExchangeRate: usdRate }}
                      privacyMode={privacyMode}
                      onSaveGoal={async (goal) => { onSavePersonalSavingsGoal?.(goal); }}
                      onUpdateGoal={async (id, updates) => { onUpdatePersonalSavingsGoal?.(id, updates); }}
                      onDeleteGoal={async (id) => { onDeletePersonalSavingsGoal?.(id); }}
                      onNavigate={onNavigate || (() => {})}
                    />
                  </div>
                )}
              </div>

              {/* Seccion 4: Estudio & Cursos */}
              <div className="card-swiss overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPlanEstudioOpen(prev => !prev)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--bg-surface-muted)] transition cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-500" />
                    <span className="text-xs font-semibold text-[var(--text-primary)] font-heading">
                      Inversión en Aprendizaje & Cursos
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]">
                      {personalStudyItems.length} ítems
                    </span>
                  </div>
                  {planEstudioOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {planEstudioOpen && (
                  <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-app)]/30">
                    <PersonalFinanceStudyView
                      studyItems={personalStudyItems}
                      projects={projects}
                      timeLogs={timeLogs}
                      privacyMode={privacyMode}
                      usdRate={usdRate}
                      onSaveStudyItem={async (item) => { onSavePersonalStudyItem?.(item); }}
                      onUpdateStudyItem={async (id, updates) => { onUpdatePersonalStudyItem?.(id, updates); }}
                      onDeleteStudyItem={async (id) => { onDeletePersonalStudyItem?.(id); }}
                      onNavigate={onNavigate || (() => {})}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
