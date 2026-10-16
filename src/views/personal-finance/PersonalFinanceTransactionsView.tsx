import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  Trash2, 
  Edit3, 
  Check, 
  ArrowLeft, 
  Calendar, 
  Tag, 
  FolderKanban, 
  X, 
  Plus,
  Wallet
} from 'lucide-react';
import { 
  PersonalAccount, 
  PersonalCategory, 
  PersonalTransaction, 
  PersonalTransactionType, 
  Project 
} from '../../types';
import { formatPersonalAmount } from '../../utils/personalFinance';
import { formatDayName, formatShortDay } from '../../utils/storage';
import { hapticFeedback } from '../../utils/haptics';

interface Props {
  transactions: PersonalTransaction[];
  accounts: PersonalAccount[];
  categories: PersonalCategory[];
  projects: Project[];
  privacyMode: boolean;
  onUpdateTransaction: (id: string, updates: Partial<PersonalTransaction>) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onNavigate: (path: string) => void;
}

export const PersonalFinanceTransactionsView: React.FC<Props> = ({
  transactions,
  accounts,
  categories,
  projects,
  privacyMode,
  onUpdateTransaction,
  onDeleteTransaction,
  onNavigate,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [accountFilter, setAccountFilter] = useState<string>('todos');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [currencyFilter, setCurrencyFilter] = useState<string>('todos');
  const [selectedTx, setSelectedTx] = useState<PersonalTransaction | null>(null);

  // Edit form state when inspecting detail
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editCurrency, setEditCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [editType, setEditType] = useState<PersonalTransactionType>('gasto');
  const [editAccountId, setEditAccountId] = useState<string>('');
  const [editToAccountId, setEditToAccountId] = useState<string>('');
  const [editCategoryId, setEditCategoryId] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editProjectId, setEditProjectId] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  // Filter transactions
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (typeFilter !== 'todos' && t.type !== typeFilter) return false;
      if (accountFilter !== 'todos' && t.accountId !== accountFilter && t.toAccountId !== accountFilter) return false;
      if (categoryFilter !== 'todos' && t.categoryId !== categoryFilter) return false;
      if (currencyFilter !== 'todos' && t.currency !== currencyFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const noteMatch = (t.note || '').toLowerCase().includes(q);
        const catMatch = (categoryMap.get(t.categoryId)?.name || '').toLowerCase().includes(q);
        const accMatch = (accountMap.get(t.accountId)?.name || '').toLowerCase().includes(q);
        const projMatch = (t.projectName || '').toLowerCase().includes(q);
        const amountMatch = t.amount.toString().includes(q);
        if (!noteMatch && !catMatch && !accMatch && !projMatch && !amountMatch) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, accountFilter, categoryFilter, currencyFilter, search, categoryMap, accountMap]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, PersonalTransaction[]>();
    for (const t of filtered) {
      const list = groups.get(t.date) || [];
      list.push(t);
      groups.set(t.date, list);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const handleOpenDetail = (tx: PersonalTransaction) => {
    hapticFeedback.light();
    setSelectedTx(tx);
    setEditAmount(tx.amount);
    setEditCurrency(tx.currency);
    setEditType(tx.type);
    setEditAccountId(tx.accountId);
    setEditToAccountId(tx.toAccountId || '');
    setEditCategoryId(tx.categoryId);
    setEditNote(tx.note || '');
    setEditDate(tx.date);
    setEditProjectId(tx.projectId || '');
    setIsDeleting(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedTx) return;
    hapticFeedback.success();
    const proj = projects.find(p => p.id === editProjectId);
    await onUpdateTransaction(selectedTx.id, {
      amount: editAmount,
      currency: editCurrency,
      type: editType,
      accountId: editAccountId,
      toAccountId: editType === 'transferencia' ? editToAccountId : undefined,
      categoryId: editCategoryId,
      note: editNote.trim() || undefined,
      date: editDate,
      projectId: proj ? proj.id : undefined,
      projectName: proj ? proj.clientName : undefined,
    });
    setSelectedTx(null);
  };

  const handleDelete = async () => {
    if (!selectedTx) return;
    hapticFeedback.medium();
    await onDeleteTransaction(selectedTx.id);
    setSelectedTx(null);
  };

  // FULL PAGE DETAIL VIEW (No popup per principle #3)
  if (selectedTx) {
    return (
      <div className="w-full max-w-lg mx-auto space-y-4 animate-in fade-in duration-150 pb-16">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedTx(null)}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a la lista</span>
          </button>
          <span className="text-[10px] font-mono text-zinc-500 uppercase">
            Detalle de Movimiento
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-zinc-500 block">Tipo</span>
              <span className="text-sm font-bold text-zinc-100 capitalize">{editType}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-zinc-500 block">Fecha</span>
              <span className="text-xs font-mono text-zinc-300">{editDate}</span>
            </div>
          </div>

          {/* Amount and Currency */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400 block">Monto</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                value={editAmount || ''}
                onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#E8590C] rounded-2xl p-3 text-xl font-mono font-bold text-zinc-100 focus:outline-hidden"
              />
              <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-2xl border border-zinc-800 shrink-0 font-mono text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setEditCurrency('ARS')}
                  className={`px-3 py-2 rounded-xl transition ${editCurrency === 'ARS' ? 'bg-emerald-500 text-black' : 'text-zinc-400'}`}
                >
                  ARS
                </button>
                <button
                  type="button"
                  onClick={() => setEditCurrency('USD')}
                  className={`px-3 py-2 rounded-xl transition ${editCurrency === 'USD' ? 'bg-blue-500 text-white' : 'text-zinc-400'}`}
                >
                  USD
                </button>
              </div>
            </div>
          </div>

          {/* Account */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400 block">Cuenta</label>
            <select
              value={editAccountId}
              onChange={(e) => setEditAccountId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#E8590C] rounded-2xl p-3 text-xs text-zinc-200 focus:outline-hidden"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </select>
          </div>

          {/* Category */}
          {editType !== 'transferencia' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-400 block">Categoría</label>
              <select
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#E8590C] rounded-2xl p-3 text-xs text-zinc-200 focus:outline-hidden"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Note */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400 block">Detalle / Concepto</label>
            <input
              type="text"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Descripción del gasto o ingreso..."
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#E8590C] rounded-2xl p-3 text-xs text-zinc-200 focus:outline-hidden"
            />
          </div>

          {/* Project Link */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400 block">Asociado a Cliente / Proyecto</label>
            <select
              value={editProjectId}
              onChange={(e) => setEditProjectId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#E8590C] rounded-2xl p-3 text-xs text-zinc-200 focus:outline-hidden truncate"
            >
              <option value="">(Sin vincular)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.clientName}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-3">
            {isDeleting ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold active:scale-95 transition"
                >
                  Confirmar Borrar
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleting(false)}
                  className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsDeleting(true)}
                className="p-2.5 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                title="Eliminar movimiento"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveEdit}
              className="px-5 py-2.5 rounded-2xl bg-[#E8590C] hover:bg-[#d94f08] text-black font-black text-xs transition active:scale-95 shadow-md shadow-[#E8590C]/25"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-150">
      
      {/* Top Header & Quick Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-100">Movimientos Personales</h3>
          <p className="text-xs text-zinc-400">{filtered.length} transacciones registradas</p>
        </div>

        <button
          type="button"
          onClick={() => {
            hapticFeedback.light();
            onNavigate('/mis-finanzas/nuevo');
          }}
          className="px-3 py-1.5 rounded-xl bg-[#E8590C] hover:bg-[#d94f08] text-black font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-[#E8590C]/20"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Cargar</span>
        </button>
      </div>

      {/* Search & Filters Bar */}
      <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por detalle, categoría, cuenta..."
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-[#E8590C] rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-200 focus:outline-hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-semibold">
          {/* Type filter */}
          {['todos', 'gasto', 'ingreso', 'transferencia', 'ahorro'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded-lg capitalize whitespace-nowrap transition border ${
                typeFilter === t
                  ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:text-zinc-300'
              }`}
            >
              {t}
            </button>
          ))}

          {/* Currency Filter */}
          <div className="h-4 w-px bg-zinc-800 shrink-0 mx-0.5" />

          {['todos', 'ARS', 'USD'].map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrencyFilter(c)}
              className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition font-mono border ${
                currencyFilter === c
                  ? 'bg-[#E8590C]/20 text-[#E8590C] border-[#E8590C]/40'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:text-zinc-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions List Grouped by Day */}
      {groupedByDate.length === 0 ? (
        <div className="p-8 rounded-3xl bg-zinc-950 border border-zinc-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-zinc-300">No se encontraron movimientos</div>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto">
            Ajustá los filtros o cargá un nuevo movimiento para ver el registro aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map(([dateStr, items]) => {
            const dayName = formatDayName(dateStr);
            const shortDay = formatShortDay(dateStr);

            return (
              <div key={dateStr} className="space-y-1.5">
                <div className="flex items-center justify-between px-1 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  <span>{dayName} ({shortDay})</span>
                  <span className="font-mono font-normal">{items.length} movs</span>
                </div>

                <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden divide-y divide-zinc-900">
                  {items.map(t => {
                    const acc = accountMap.get(t.accountId);
                    const toAcc = t.toAccountId ? accountMap.get(t.toAccountId) : undefined;
                    const cat = categoryMap.get(t.categoryId);

                    const isIncome = t.type === 'ingreso';
                    const isExpense = t.type === 'gasto';
                    const isTransfer = t.type === 'transferencia';
                    const isSavings = t.type === 'ahorro';

                    return (
                      <div
                        key={t.id}
                        onClick={() => handleOpenDetail(t)}
                        className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-zinc-900/60 transition cursor-pointer active:bg-zinc-900"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Semantic Category Dot / Type Icon */}
                          <div 
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
                            style={{ 
                              backgroundColor: cat ? `${cat.color}15` : '#27272a',
                              borderColor: cat ? `${cat.color}40` : '#3f3f46'
                            }}
                          >
                            {isIncome && <ArrowUpRight className="w-4 h-4 text-emerald-400 stroke-[2.5]" />}
                            {isExpense && <ArrowDownLeft className="w-4 h-4 text-rose-400 stroke-[2.5]" />}
                            {isTransfer && <ArrowLeftRight className="w-4 h-4 text-sky-400 stroke-[2.5]" />}
                            {isSavings && <Wallet className="w-4 h-4 text-blue-400 stroke-[2.5]" />}
                          </div>

                          <div className="min-w-0">
                            <div className="text-xs font-bold text-zinc-100 truncate flex items-center gap-1.5">
                              <span>{t.note || cat?.name || 'Movimiento'}</span>
                              {t.projectName && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#E8590C]/10 text-[#E8590C] font-semibold truncate max-w-[120px]">
                                  {t.projectName}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 font-medium truncate">
                              <span>{cat?.name}</span>
                              <span>·</span>
                              <span className="text-zinc-300">
                                {isTransfer ? `${acc?.name || 'Origen'} → ${toAcc?.name || 'Destino'}` : acc?.name}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-right shrink-0 font-mono">
                          <div className={`text-sm font-black ${
                            isIncome ? 'text-emerald-400' : isExpense ? 'text-rose-400' : isTransfer ? 'text-sky-400' : 'text-blue-400'
                          }`}>
                            {isIncome ? '+' : isExpense ? '-' : ''}
                            {formatPersonalAmount(t.amount, t.currency, privacyMode)}
                          </div>
                          <span className="text-[9px] text-zinc-500 uppercase font-semibold">
                            {t.currency}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
