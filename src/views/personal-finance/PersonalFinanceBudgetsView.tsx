import React, { useState } from 'react';
import { 
  Target, 
  Plus, 
  AlertTriangle, 
  Check, 
  ArrowLeft, 
  Calendar, 
  TrendingUp, 
  Edit2, 
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  PersonalBudget, 
  PersonalCategory, 
  PersonalTransaction, 
  PersonalFinanceSettings 
} from '../../types';
import { 
  calculateBudgetsStatus, 
  formatPersonalAmount, 
  getCurrentMonthStr, 
  formatMonthName,
  getPreviousMonthStr
} from '../../utils/personalFinance';
import { hapticFeedback } from '../../utils/haptics';

interface Props {
  budgets: PersonalBudget[];
  categories: PersonalCategory[];
  transactions: PersonalTransaction[];
  settings: PersonalFinanceSettings;
  privacyMode: boolean;
  onSaveBudget: (budget: PersonalBudget) => Promise<void>;
  onUpdateBudget: (id: string, updates: Partial<PersonalBudget>) => Promise<void>;
  onDeleteBudget: (id: string) => Promise<void>;
  onNavigate: (path: string) => void;
}

export const PersonalFinanceBudgetsView: React.FC<Props> = ({
  budgets,
  categories,
  transactions,
  settings,
  privacyMode,
  onSaveBudget,
  onUpdateBudget,
  onDeleteBudget,
  onNavigate,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [editingBudget, setEditingBudget] = useState<PersonalBudget | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [categoryId, setCategoryId] = useState('');
  const [limit, setLimit] = useState<number>(50000);
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');

  const usdRate = settings.usdExchangeRate || 1250;
  const expenseCategories = categories.filter(c => c.type === 'gasto');
  const budgetStatuses = calculateBudgetsStatus(budgets, categories, transactions, selectedMonth, usdRate);

  const startCreate = () => {
    hapticFeedback.light();
    setEditingBudget(null);
    if (expenseCategories.length > 0) {
      setCategoryId(expenseCategories[0].id);
    }
    setLimit(50000);
    setCurrency('ARS');
    setIsCreating(true);
  };

  const startEdit = (b: PersonalBudget) => {
    hapticFeedback.light();
    setIsCreating(false);
    setEditingBudget(b);
    setCategoryId(b.categoryId);
    setLimit(b.limit);
    setCurrency(b.currency);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || limit <= 0) return;

    hapticFeedback.success();
    if (editingBudget) {
      await onUpdateBudget(editingBudget.id, {
        limit,
        currency,
        categoryId,
      });
      setEditingBudget(null);
    } else {
      const newBudget: PersonalBudget = {
        id: `bgt_${selectedMonth}_${categoryId}_${Date.now()}`,
        categoryId,
        month: selectedMonth,
        limit,
        currency,
        createdAt: new Date().toISOString(),
      };
      await onSaveBudget(newBudget);
      setIsCreating(false);
    }
  };

  // Month navigation
  const goToPrevMonth = () => {
    hapticFeedback.selection();
    setSelectedMonth(prev => getPreviousMonthStr(prev));
  };

  const goToNextMonth = () => {
    hapticFeedback.selection();
    const [y, m] = selectedMonth.split('-').map(Number);
    let nextY = y;
    let nextM = m + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    setSelectedMonth(`${nextY}-${String(nextM).padStart(2, '0')}`);
  };

  // FULL PAGE EDITOR / CREATOR (Principle #3)
  if (isCreating || editingBudget) {
    return (
      <div className="w-full max-w-md mx-auto space-y-4 animate-in fade-in duration-150 pb-16">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setEditingBudget(null);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a presupuestos</span>
          </button>
          <span className="text-[10px] font-mono text-zinc-500 uppercase">
            {editingBudget ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
          </span>
        </div>

        <form onSubmit={handleSave} className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400 block">Categoría de Gasto</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#E8590C] rounded-2xl p-3 text-sm text-zinc-200 focus:outline-hidden"
            >
              {expenseCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400 block">Límite Mensual</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                required
                value={limit || ''}
                onChange={(e) => setLimit(parseFloat(e.target.value) || 0)}
                placeholder="50000"
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#E8590C] rounded-2xl p-3 text-xl font-mono font-bold text-zinc-100 focus:outline-hidden"
              />
              <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-2xl border border-zinc-800 shrink-0 font-mono text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCurrency('ARS')}
                  className={`px-3 py-2 rounded-xl transition ${currency === 'ARS' ? 'bg-emerald-500 text-black' : 'text-zinc-400'}`}
                >
                  ARS
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-3 py-2 rounded-xl transition ${currency === 'USD' ? 'bg-blue-500 text-white' : 'text-zinc-400'}`}
                >
                  USD
                </button>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingBudget(null);
              }}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#E8590C] hover:bg-[#d94f08] text-black font-black text-xs transition active:scale-95 shadow-md shadow-[#E8590C]/20"
            >
              Guardar Presupuesto
            </button>
          </div>
        </form>
      </div>
    );
  }

  const warningCount = budgetStatuses.filter(b => b.isWarning).length;
  const exceededCount = budgetStatuses.filter(b => b.isOverLimit).length;

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-150">
      
      {/* Header with Month Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-zinc-100">Presupuestos y Límites</h3>
          <p className="text-xs text-zinc-400">Control de topes de consumo mensual</p>
        </div>

        <button
          type="button"
          onClick={startCreate}
          className="px-3 py-1.5 rounded-xl bg-[#E8590C] hover:bg-[#d94f08] text-black font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-[#E8590C]/20 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Fijar Presupuesto</span>
        </button>
      </div>

      {/* Month Navigator */}
      <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
        <button
          type="button"
          onClick={goToPrevMonth}
          className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-xs font-bold text-zinc-100 uppercase tracking-wide">
          {formatMonthName(selectedMonth)}
        </div>

        <button
          type="button"
          onClick={goToNextMonth}
          className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Warnings Banner if any budget > 80% */}
      {(warningCount > 0 || exceededCount > 0) && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            {exceededCount > 0 && (
              <span className="font-bold text-rose-400">
                {exceededCount} {exceededCount === 1 ? 'categoría superó' : 'categorías superaron'} el límite mensual. {' '}
              </span>
            )}
            {warningCount > 0 && (
              <span>
                {warningCount} {warningCount === 1 ? 'categoría está' : 'categorías están'} por encima del 80% de su presupuesto.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Budgets List */}
      {budgetStatuses.length === 0 ? (
        <div className="p-8 rounded-3xl bg-zinc-950 border border-zinc-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
            <Target className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-zinc-300">No hay presupuestos para este mes</div>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto">
            Fijá límites por categoría para controlar tus gastos y recibir alertas antes de pasarte.
          </p>
          <button
            type="button"
            onClick={startCreate}
            className="px-4 py-2 rounded-xl bg-[#E8590C] text-black font-bold text-xs"
          >
            Fijar mi primer presupuesto
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {budgetStatuses.map(({ budget, category, spent, remaining, percentageUsed, isOverLimit, isWarning }) => {
            const barColor = isOverLimit ? 'bg-rose-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-500';

            return (
              <div
                key={budget.id}
                className="p-4 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-3 hover:border-zinc-700/80 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-8 h-8 rounded-xl flex items-center justify-center border text-xs"
                      style={{ 
                        backgroundColor: category ? `${category.color}20` : '#27272a',
                        borderColor: category ? `${category.color}40` : '#3f3f46',
                        color: category?.color || '#ffffff'
                      }}
                    >
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-zinc-100">{category?.name || 'Categoría'}</h4>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Límite: {formatPersonalAmount(budget.limit, budget.currency, privacyMode)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEdit(budget)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        hapticFeedback.medium();
                        await onDeleteBudget(budget.id);
                      }}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 transition"
                      title="Eliminar presupuesto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar with Semáforo */}
                <div className="space-y-1">
                  <div className="w-full bg-zinc-900 rounded-full h-2.5 overflow-hidden border border-zinc-800/80">
                    <div 
                      className={`h-full ${barColor} rounded-full transition-all duration-300`}
                      style={{ width: `${Math.min(100, percentageUsed)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-zinc-400">
                      Gastado: <strong className="text-zinc-200">{formatPersonalAmount(spent, budget.currency, privacyMode)}</strong>
                    </span>
                    <span className={`font-bold ${isOverLimit ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {percentageUsed}% {isOverLimit && '(Excedido)'}
                    </span>
                  </div>
                </div>

                {/* Remaining */}
                <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">Disponible restante:</span>
                  <span className={`font-mono font-bold ${isOverLimit ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {isOverLimit ? '-' : ''}{formatPersonalAmount(remaining, budget.currency, privacyMode)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
