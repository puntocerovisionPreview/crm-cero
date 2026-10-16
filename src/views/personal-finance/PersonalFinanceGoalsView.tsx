import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  Plus, 
  Target, 
  Calendar, 
  Sparkles, 
  Edit2, 
  Trash2, 
  ArrowLeft, 
  Check, 
  TrendingUp,
  ShieldCheck,
  DollarSign
} from 'lucide-react';
import { 
  SavingsGoal, 
  PersonalTransaction, 
  PersonalFinanceSettings 
} from '../../types';
import { 
  calculateGoalProjection, 
  formatPersonalAmount, 
  calculateMonthlyFinanceSummary 
} from '../../utils/personalFinance';
import { hapticFeedback } from '../../utils/haptics';
import { DEFAULT_USD_RATE } from '../../utils/currency';

interface Props {
  goals: SavingsGoal[];
  transactions: PersonalTransaction[];
  settings: PersonalFinanceSettings;
  privacyMode: boolean;
  onSaveGoal: (goal: SavingsGoal) => Promise<void>;
  onUpdateGoal: (id: string, updates: Partial<SavingsGoal>) => Promise<void>;
  onDeleteGoal: (id: string) => Promise<void>;
  onNavigate: (path: string) => void;
}

export const PersonalFinanceGoalsView: React.FC<Props> = ({
  goals,
  transactions,
  settings,
  privacyMode,
  onSaveGoal,
  onUpdateGoal,
  onDeleteGoal,
  onNavigate,
}) => {
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [quickDepositGoal, setQuickDepositGoal] = useState<SavingsGoal | null>(null);
  const [depositAmount, setDepositAmount] = useState<number>(0);

  // Form state
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState<number>(100000);
  const [savedAmount, setSavedAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState('#3b82f6');

  const usdRate = settings.usdExchangeRate || DEFAULT_USD_RATE;
  const currentSummary = calculateMonthlyFinanceSummary(transactions, undefined, usdRate);
  const averageMonthlySavingsARS = Math.max(1, currentSummary.normalizedSavingsARS);

  const startCreate = () => {
    hapticFeedback.light();
    setEditingGoal(null);
    setName('');
    setTargetAmount(100000);
    setSavedAmount(0);
    setCurrency('ARS');
    setDeadline('');
    setColor('#3b82f6');
    setIsCreating(true);
  };

  const startEdit = (g: SavingsGoal) => {
    hapticFeedback.light();
    setIsCreating(false);
    setEditingGoal(g);
    setName(g.name);
    setTargetAmount(g.targetAmount);
    setSavedAmount(g.savedAmount);
    setCurrency(g.currency);
    setDeadline(g.deadline || '');
    setColor(g.color || '#3b82f6');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || targetAmount <= 0) return;

    hapticFeedback.success();
    if (editingGoal) {
      await onUpdateGoal(editingGoal.id, {
        name: name.trim(),
        targetAmount,
        savedAmount,
        currency,
        deadline: deadline || undefined,
        color,
      });
      setEditingGoal(null);
    } else {
      const newGoal: SavingsGoal = {
        id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim(),
        targetAmount,
        savedAmount,
        currency,
        deadline: deadline || undefined,
        color,
        createdAt: new Date().toISOString(),
      };
      await onSaveGoal(newGoal);
      setIsCreating(false);
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDepositGoal || depositAmount <= 0) return;

    hapticFeedback.success();
    await onUpdateGoal(quickDepositGoal.id, {
      savedAmount: (quickDepositGoal.savedAmount || 0) + depositAmount,
    });
    setQuickDepositGoal(null);
    setDepositAmount(0);
  };

  // FULL PAGE CREATOR / EDITOR (Principle #3)
  if (isCreating || editingGoal) {
    return (
      <div className="w-full max-w-md mx-auto space-y-4 animate-in fade-in duration-150 pb-16">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setEditingGoal(null);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a metas</span>
          </button>
          <span className="text-[10px] font-mono text-zinc-500 uppercase">
            {editingGoal ? 'Editar Meta' : 'Nueva Meta de Ahorro'}
          </span>
        </div>

        <form onSubmit={handleSave} className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400 block">Nombre de la Meta</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Fondo de emergencia, Vacaciones, MacBook Pro..."
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--accent)] rounded-2xl p-3 text-sm text-zinc-100 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-400 block">Monto Objetivo</label>
              <input
                type="number"
                step="any"
                required
                value={targetAmount || ''}
                onChange={(e) => setTargetAmount(parseFloat(e.target.value) || 0)}
                placeholder="100000"
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--accent)] rounded-2xl p-2.5 text-sm font-mono font-bold text-zinc-100 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-400 block">Ahorrado Inicial</label>
              <input
                type="number"
                step="any"
                value={savedAmount || ''}
                onChange={(e) => setSavedAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--accent)] rounded-2xl p-2.5 text-sm font-mono font-bold text-zinc-100 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-400 block">Moneda</label>
              <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs font-bold font-mono">
                <button
                  type="button"
                  onClick={() => setCurrency('ARS')}
                  className={`py-2 rounded-lg transition ${currency === 'ARS' ? 'bg-emerald-500 text-black' : 'text-zinc-400'}`}
                >
                  ARS
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`py-2 rounded-lg transition ${currency === 'USD' ? 'bg-blue-500 text-white' : 'text-zinc-400'}`}
                >
                  USD
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-400 block">Fecha Límite (Opcional)</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--accent)] rounded-xl px-2.5 py-2 text-xs text-zinc-200 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingGoal(null);
              }}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-black font-black text-xs transition active:scale-95 shadow-md shadow-[var(--accent)]/20"
            >
              Guardar Meta
            </button>
          </div>
        </form>
      </div>
    );
  }

  // QUICK DEPOSIT PANEL
  if (quickDepositGoal) {
    return (
      <div className="w-full max-w-md mx-auto space-y-4 animate-in fade-in duration-150 pb-16">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setQuickDepositGoal(null)}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>
          <span className="text-[10px] font-mono text-zinc-500 uppercase">
            Aportar a Meta
          </span>
        </div>

        <form onSubmit={handleDepositSubmit} className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl space-y-4">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-zinc-100">{quickDepositGoal.name}</h4>
              <p className="text-xs text-zinc-400 font-mono">
                Actual: {formatPersonalAmount(quickDepositGoal.savedAmount, quickDepositGoal.currency, privacyMode)} / {formatPersonalAmount(quickDepositGoal.targetAmount, quickDepositGoal.currency, privacyMode)}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400 block">Monto a Sumar ({quickDepositGoal.currency})</label>
            <input
              type="number"
              step="any"
              required
              autoFocus
              value={depositAmount || ''}
              onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--accent)] rounded-2xl p-3 text-2xl font-mono font-black text-zinc-100 focus:outline-hidden"
            />
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-2">
            {[10000, 25000, 50000, 100000].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setDepositAmount(val)}
                className="flex-1 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-[10px] font-mono font-bold text-zinc-300 border border-zinc-800"
              >
                +${val.toLocaleString()}
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setQuickDepositGoal(null)}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs transition active:scale-95 shadow-md shadow-emerald-500/20"
            >
              Confirmar Aporte
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-150">
      
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-100">Metas de Ahorro</h3>
          <p className="text-xs text-zinc-400">Progreso y proyección estimada a tu ritmo real</p>
        </div>

        <button
          type="button"
          onClick={startCreate}
          className="px-3 py-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-black font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-[var(--accent)]/20 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Nueva Meta</span>
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="p-8 rounded-3xl bg-zinc-950 border border-zinc-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
            <Target className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-zinc-300">No tenés metas de ahorro activas</div>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto">
            Definí objetivos financieros para proyectar cuándo los vas a cumplir según tu ahorro mensual.
          </p>
          <button
            type="button"
            onClick={startCreate}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black font-bold text-xs"
          >
            Crear mi primera meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {goals.map(g => {
            const projection = calculateGoalProjection(g, averageMonthlySavingsARS, usdRate);

            return (
              <div
                key={g.id}
                className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-3 hover:border-zinc-700/80 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <Target className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-zinc-100">{g.name}</h4>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">{g.currency}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(g)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          hapticFeedback.medium();
                          await onDeleteGoal(g.id);
                        }}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 transition cursor-pointer"
                        title="Eliminar meta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="space-y-1.5 mt-3">
                    <div className="w-full bg-zinc-900 rounded-full h-3 overflow-hidden border border-zinc-800">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-sky-400 rounded-full transition-all duration-500"
                        style={{ width: `${projection.percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-400">
                        {formatPersonalAmount(g.savedAmount, g.currency, privacyMode)}
                      </span>
                      <span className="font-bold text-sky-400">
                        {projection.percentage}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Target & Projection Details */}
                <div className="pt-2 border-t border-zinc-900 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Objetivo total:</span>
                    <span className="font-mono font-bold text-zinc-200">
                      {formatPersonalAmount(g.targetAmount, g.currency, privacyMode)}
                    </span>
                  </div>

                  {projection.estimatedDate && (
                    <div className="flex items-center justify-between text-[11px] text-amber-300">
                      <span className="flex items-center gap-1 text-zinc-400">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        <span>Estimado al ritmo actual:</span>
                      </span>
                      <span className="font-bold capitalize">{projection.estimatedDate}</span>
                    </div>
                  )}
                </div>

                {/* Quick Action Button */}
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.light();
                    setQuickDepositGoal(g);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 border border-zinc-800"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Aportar a esta meta</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
