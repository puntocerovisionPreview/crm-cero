import React, { useState } from 'react';
import { 
  Repeat, 
  Plus, 
  Check, 
  Trash2, 
  Edit3, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  AlertCircle, 
  ArrowDownLeft, 
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  CalendarCheck,
  Zap,
  TrendingDown
} from 'lucide-react';
import { 
  PersonalRecurring, 
  PersonalAccount, 
  PersonalCategory, 
  PersonalRecurringFrequency, 
  PersonalTransactionType 
} from '../../types';
import { formatPersonalAmount } from '../../utils/personalFinance';
import { getTodayString, addDays } from '../../utils/storage';
import { hapticFeedback } from '../../utils/haptics';

interface Props {
  recurrings: PersonalRecurring[];
  accounts: PersonalAccount[];
  categories: PersonalCategory[];
  privacyMode: boolean;
  usdRate: number;
  onSaveRecurring: (item: Omit<PersonalRecurring, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateRecurring: (id: string, updates: Partial<PersonalRecurring>) => Promise<void>;
  onDeleteRecurring: (id: string) => Promise<void>;
  onConfirmRecurring: (recurring: PersonalRecurring) => void;
  onNavigate: (path: string) => void;
}

const FREQUENCY_LABELS: Record<PersonalRecurringFrequency, string> = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  anual: 'Anual',
  custom: 'Personalizada',
};

export const PersonalFinanceRecurringView: React.FC<Props> = ({
  recurrings,
  accounts,
  categories,
  privacyMode,
  usdRate,
  onSaveRecurring,
  onUpdateRecurring,
  onDeleteRecurring,
  onConfirmRecurring,
  onNavigate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<PersonalTransactionType>('gasto');
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState<PersonalRecurringFrequency>('mensual');
  const [nextDate, setNextDate] = useState(getTodayString());
  const [active, setActive] = useState(true);
  const [note, setNote] = useState('');

  const today = getTodayString();
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  // Monthly projected recurring expense & pending sum
  let monthlyExpenseARS = 0;
  let monthlyExpenseUSD = 0;
  let duePendingSumARS = 0;
  let duePendingSumUSD = 0;

  recurrings
    .filter(r => r.active && r.type === 'gasto')
    .forEach(r => {
      let monthlyMultiplier = 1;
      if (r.frequency === 'semanal') monthlyMultiplier = 4.33;
      if (r.frequency === 'quincenal') monthlyMultiplier = 2;
      if (r.frequency === 'anual') monthlyMultiplier = 1 / 12;

      if (r.currency === 'USD') {
        monthlyExpenseUSD += r.amount * monthlyMultiplier;
        if (r.nextDate <= today) duePendingSumUSD += r.amount;
      } else {
        monthlyExpenseARS += r.amount * monthlyMultiplier;
        if (r.nextDate <= today) duePendingSumARS += r.amount;
      }
    });

  const monthlyRecurringExpenseARS = monthlyExpenseARS + (monthlyExpenseUSD * usdRate);

  const openNewForm = () => {
    hapticFeedback.light();
    setEditingId(null);
    setTitle('');
    setType('gasto');
    setAmountStr('');
    setCurrency('ARS');
    setAccountId(accounts[0]?.id || '');
    setCategoryId(categories.find(c => c.type === 'gasto')?.id || '');
    setFrequency('mensual');
    setNextDate(getTodayString());
    setActive(true);
    setNote('');
    setIsEditing(true);
  };

  const openEditForm = (rec: PersonalRecurring) => {
    hapticFeedback.light();
    setEditingId(rec.id);
    setTitle(rec.title);
    setType(rec.type);
    setAmountStr(String(rec.amount));
    setCurrency(rec.currency);
    setAccountId(rec.accountId);
    setCategoryId(rec.categoryId);
    setFrequency(rec.frequency);
    setNextDate(rec.nextDate);
    setActive(rec.active);
    setNote(rec.note || '');
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !accountId || !categoryId) return;

    hapticFeedback.medium();
    const amount = parseFloat(amountStr.replace(',', '.')) || 0;

    const payload = {
      title: title.trim(),
      type,
      amount,
      currency,
      accountId,
      categoryId,
      frequency,
      nextDate,
      active,
      note: note.trim() || undefined,
    };

    if (editingId) {
      await onUpdateRecurring(editingId, payload);
    } else {
      await onSaveRecurring(payload);
    }

    setIsEditing(false);
    setEditingId(null);
  };

  // Full page edit/create panel (Swiss mobile-first)
  if (isEditing) {
    return (
      <div className="w-full max-w-xl mx-auto space-y-4 animate-in fade-in">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-zinc-100">
              {editingId ? 'Editar Recurrente' : 'Nuevo Recurrente / Suscripción'}
            </h2>
            <p className="text-xs text-zinc-400">
              Automatizá gastos fijos, servicios y suscripciones periódicas
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Título / Servicio *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Internet Fibertel, Figma Pro, Alquiler..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-[var(--accent)] transition"
            />
          </div>

          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('gasto')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                type === 'gasto' 
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' 
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Gasto Fijo</span>
            </button>
            <button
              type="button"
              onClick={() => setType('ingreso')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                type === 'ingreso' 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Ingreso Recurrente</span>
            </button>
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Monto *
              </label>
              <input
                type="number"
                step="any"
                required
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-sm focus:outline-none focus:border-[var(--accent)] transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Moneda
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCurrency('ARS')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition ${
                    currency === 'ARS' ? 'bg-[var(--accent)] text-black' : 'text-zinc-400'
                  }`}
                >
                  ARS
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition ${
                    currency === 'USD' ? 'bg-emerald-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  USD
                </button>
              </div>
            </div>
          </div>

          {/* Account & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Cuenta de Débito *
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-[var(--accent)] transition"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Categoría *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-[var(--accent)] transition"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Frequency & Next Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Frecuencia
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as PersonalRecurringFrequency)}
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-[var(--accent)] transition"
              >
                {Object.entries(FREQUENCY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Próximo Vencimiento
              </label>
              <input
                type="date"
                required
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-[var(--accent)] transition font-mono"
              />
            </div>
          </div>

          {/* Active status */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
            <input
              type="checkbox"
              id="activeRec"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded text-[var(--accent)] bg-zinc-900 border-zinc-700"
            />
            <label htmlFor="activeRec" className="text-xs font-semibold text-zinc-200 cursor-pointer">
              Suscripción activa (generar avisos y confirmaciones de vencimiento)
            </label>
          </div>

          {/* Note */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Nota Opcional
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Número de cliente, débito automático..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-[var(--accent)] transition"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[#d04f0b] text-black text-xs font-bold transition shadow-lg shadow-[var(--accent)]/20"
            >
              {editingId ? 'Guardar Cambios' : 'Crear Recurrente'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 animate-in fade-in">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-black tracking-tight text-zinc-100">
              Recurrentes & Suscripciones
            </h1>
          </div>
          <p className="text-xs text-zinc-400">
            Gastos fijos, abonos y cuotas con confirmación en un solo toque
          </p>
        </div>

        <button
          type="button"
          onClick={openNewForm}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[#d04f0b] text-black text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nuevo Recurrente</span>
        </button>
      </div>

      {/* 2. Monthly Projected Recurring Summary Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Gasto Fijo Mensual Estimado
              </span>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl font-black font-mono text-zinc-100">
                  {formatPersonalAmount(monthlyRecurringExpenseARS, 'ARS', privacyMode)}
                </span>
                {!privacyMode && (monthlyExpenseARS > 0 || monthlyExpenseUSD > 0) && (
                  <span className="text-xs font-mono text-zinc-400">
                    ({monthlyExpenseARS > 0 ? `$${Math.round(monthlyExpenseARS).toLocaleString('es-AR')}` : ''}
                    {monthlyExpenseARS > 0 && monthlyExpenseUSD > 0 ? ' + ' : ''}
                    {monthlyExpenseUSD > 0 ? `u$s ${monthlyExpenseUSD.toFixed(1)}` : ''})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <div>
              <span className="text-zinc-200 font-bold font-mono">
                {recurrings.filter(r => r.active).length}
              </span> activos
            </div>
            <span>•</span>
            <div>
              <span className="text-amber-400 font-bold font-mono">
                {recurrings.filter(r => r.active && r.nextDate <= today).length}
              </span> listos para pagar
            </div>
          </div>
        </div>

        {(duePendingSumARS > 0 || duePendingSumUSD > 0) && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2 text-xs">
            <span className="text-amber-300 font-medium">
              Suma de pagos listos hoy/vencidos:
            </span>
            <span className="font-mono font-bold text-amber-400">
              {privacyMode ? '$ •••' : (
                <>
                  {duePendingSumARS > 0 ? `$${Math.round(duePendingSumARS).toLocaleString('es-AR')} ARS` : ''}
                  {duePendingSumARS > 0 && duePendingSumUSD > 0 ? ' + ' : ''}
                  {duePendingSumUSD > 0 ? `u$s ${duePendingSumUSD}` : ''}
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* 3. List of Recurrings */}
      {recurrings.length === 0 ? (
        <div className="p-8 rounded-3xl bg-zinc-950/60 border border-zinc-800/80 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
            <Repeat className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-zinc-200">
            No tenés suscripciones ni pagos recurrentes
          </p>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Cargá servicios como Spotify, hosting, alquiler o internet para que la app te avise y los confirmes en un toque.
          </p>
          <button
            type="button"
            onClick={openNewForm}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Cargar Primer Recurrente</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {recurrings.map(rec => {
            const acc = accountMap.get(rec.accountId);
            const cat = categoryMap.get(rec.categoryId);
            const isDue = rec.nextDate <= today;
            const isDueSoon = !isDue && rec.nextDate <= addDays(today, 3);

            return (
              <div
                key={rec.id}
                className={`p-4 rounded-2xl bg-zinc-950 border transition space-y-3 ${
                  !rec.active 
                    ? 'border-zinc-900 opacity-60' 
                    : isDue 
                      ? 'border-amber-500/50 shadow-md shadow-amber-950/20' 
                      : 'border-zinc-800/80 hover:border-zinc-700/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      rec.type === 'ingreso' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      <Repeat className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-bold text-zinc-100 truncate">
                          {rec.title}
                        </h3>
                        {isDue && rec.active && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                            ¡Vencido / Hoy!
                          </span>
                        )}
                        {!rec.active && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                            Pausado
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 flex-wrap">
                        <span className="font-medium text-zinc-300">
                          {cat?.name || 'Categoría'}
                        </span>
                        <span>•</span>
                        <span>{acc?.name || 'Cuenta'}</span>
                        <span>•</span>
                        <span className="font-semibold text-zinc-300">
                          {FREQUENCY_LABELS[rec.frequency]}
                        </span>
                        <span>•</span>
                        <span className={`font-mono ${isDue ? 'text-amber-400 font-bold' : ''}`}>
                          Próx: {rec.nextDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Amount & Quick Confirm Button */}
                  <div className="text-right shrink-0">
                    <span className={`text-sm font-bold font-mono block ${
                      rec.type === 'ingreso' ? 'text-emerald-400' : 'text-zinc-100'
                    }`}>
                      {rec.type === 'ingreso' ? '+' : '-'}
                      {formatPersonalAmount(rec.amount, rec.currency, privacyMode)}
                    </span>

                    <div className="flex items-center justify-end gap-1.5 mt-2">
                      {/* One-touch confirm button */}
                      {rec.active && (
                        <button
                          type="button"
                          onClick={() => {
                            hapticFeedback.success();
                            onConfirmRecurring(rec);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold flex items-center gap-1 active:scale-95 transition"
                          title="Confirmar pago y avanzar fecha"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Pagar</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditForm(rec)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onDeleteRecurring(rec.id);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 transition"
                        title="Eliminar recurrente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {rec.note && (
                  <div className="pt-2 border-t border-zinc-900 text-[11px] text-zinc-400">
                    Nota: {rec.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
