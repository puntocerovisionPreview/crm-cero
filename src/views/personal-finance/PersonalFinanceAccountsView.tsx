import React, { useState } from 'react';
import { 
  Wallet, 
  Plus, 
  ArrowLeftRight, 
  Edit2, 
  Archive, 
  Check, 
  ArrowLeft, 
  DollarSign, 
  Building2, 
  Smartphone, 
  Banknote,
  TrendingUp,
  AlertCircle,
  Trash2,
  X
} from 'lucide-react';
import { PersonalAccount, PersonalTransaction } from '../../types';
import { calculateAccountBalance, formatPersonalAmount } from '../../utils/personalFinance';
import { hapticFeedback } from '../../utils/haptics';

interface Props {
  accounts: PersonalAccount[];
  transactions: PersonalTransaction[];
  privacyMode: boolean;
  onSaveAccount: (account: PersonalAccount) => Promise<void>;
  onUpdateAccount: (id: string, updates: Partial<PersonalAccount>) => Promise<void>;
  onDeleteAccount?: (id: string, permanent?: boolean) => Promise<void>;
  onNavigate: (path: string) => void;
}

export const PersonalFinanceAccountsView: React.FC<Props> = ({
  accounts,
  transactions,
  privacyMode,
  onSaveAccount,
  onUpdateAccount,
  onDeleteAccount,
  onNavigate,
}) => {
  const [editingAccount, setEditingAccount] = useState<PersonalAccount | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<PersonalAccount | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [color, setColor] = useState('#10b981');
  const [icon, setIcon] = useState('Wallet');

  const startCreate = () => {
    hapticFeedback.light();
    setEditingAccount(null);
    setName('');
    setCurrency('ARS');
    setInitialBalance(0);
    setColor('#10b981');
    setIcon('Wallet');
    setIsCreating(true);
  };

  const startEdit = (acc: PersonalAccount) => {
    hapticFeedback.light();
    setIsCreating(false);
    setEditingAccount(acc);
    setName(acc.name);
    setCurrency(acc.currency);
    setInitialBalance(acc.initialBalance || 0);
    setColor(acc.color);
    setIcon(acc.icon);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    hapticFeedback.success();
    if (editingAccount) {
      await onUpdateAccount(editingAccount.id, {
        name: name.trim(),
        currency,
        initialBalance,
        color,
        icon,
      });
      setEditingAccount(null);
    } else {
      const newAcc: PersonalAccount = {
        id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim(),
        currency,
        initialBalance,
        color,
        icon,
        archived: false,
        createdAt: new Date().toISOString(),
      };
      await onSaveAccount(newAcc);
      setIsCreating(false);
    }
  };

  // FULL PAGE ACCOUNT EDITOR / CREATOR (No popups per principle #3)
  if (isCreating || editingAccount) {
    return (
      <div className="w-full max-w-md mx-auto space-y-4 animate-in fade-in duration-150 pb-16">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setEditingAccount(null);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a cuentas</span>
          </button>
          <span className="text-[10px] font-mono text-zinc-500 uppercase">
            {editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}
          </span>
        </div>

        <form onSubmit={handleSave} className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400 block">Nombre de la Cuenta</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Mercado Pago, Banco Nación, Caja fuerte…"
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--accent)] rounded-2xl p-3 text-sm text-zinc-100 focus:outline-hidden"
            />
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
              <label className="text-[10px] font-bold uppercase text-zinc-400 block">Saldo Inicial / Base</label>
              <input
                type="number"
                step="any"
                value={initialBalance || ''}
                onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--accent)] rounded-2xl p-2.5 text-sm font-mono text-zinc-100 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Color Picker Chips */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-zinc-400 block">Color de Identificación</label>
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {['#10b981', '#009EE3', '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#a1a1aa'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition active:scale-90 border-2 ${
                    color === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingAccount(null);
              }}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-black font-black text-xs transition active:scale-95 shadow-md shadow-[var(--accent)]/20"
            >
              Guardar Cuenta
            </button>
          </div>
        </form>
      </div>
    );
  }

  const activeAccounts = accounts.filter(a => !a.archived);
  const archivedAccounts = accounts.filter(a => a.archived);

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-150">
      
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-100">Cuentas y Billeteras</h3>
          <p className="text-xs text-zinc-400">Control de saldo en bancos, efectivo y dólares</p>
        </div>

        <button
          type="button"
          onClick={startCreate}
          className="px-3 py-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-black font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-[var(--accent)]/20 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Nueva Cuenta</span>
        </button>
      </div>

      {/* Accounts List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {activeAccounts.map(acc => {
          const balance = calculateAccountBalance(acc, transactions);

          return (
            <div
              key={acc.id}
              className="p-4 rounded-3xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700/80 transition flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-9 h-9 rounded-2xl flex items-center justify-center text-white border shadow-sm"
                    style={{ backgroundColor: `${acc.color}20`, borderColor: `${acc.color}40`, color: acc.color }}
                  >
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-zinc-100">{acc.name}</h4>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">{acc.currency}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(acc)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition cursor-pointer"
                    title="Editar cuenta"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.medium();
                      onUpdateAccount(acc.id, { archived: true });
                    }}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-zinc-900 transition cursor-pointer"
                    title="Archivar cuenta"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  {onDeleteAccount && (
                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.warning();
                        setAccountToDelete(acc);
                      }}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                      title="Eliminar cuenta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Balance */}
              <div className="pt-2 border-t border-zinc-900 flex items-baseline justify-between font-mono">
                <span className="text-[10px] font-bold uppercase text-zinc-500">Saldo Actual</span>
                <span className={`text-xl font-black ${balance >= 0 ? 'text-zinc-100' : 'text-rose-400'}`}>
                  {formatPersonalAmount(balance, acc.currency, privacyMode)}
                </span>
              </div>

              {/* Quick Actions */}
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.light();
                    onNavigate(`/mis-finanzas/nuevo?tipo=transferencia&cuenta=${acc.name}`);
                  }}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <ArrowLeftRight className="w-3 h-3 text-sky-400" />
                  <span>Transferir</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.light();
                    onNavigate(`/mis-finanzas/movimientos`);
                  }}
                  className="py-1.5 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold transition"
                >
                  Movimientos
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Archived Accounts */}
      {archivedAccounts.length > 0 && (
        <div className="p-4 rounded-3xl bg-zinc-950/60 border border-zinc-900 space-y-2 mt-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            Cuentas Archivadas ({archivedAccounts.length})
          </span>
          <div className="divide-y divide-zinc-900">
            {archivedAccounts.map(a => (
              <div key={a.id} className="py-2 flex items-center justify-between text-xs text-zinc-400">
                <span>{a.name} ({a.currency})</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.light();
                      onUpdateAccount(a.id, { archived: false });
                    }}
                    className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    Desarchivar
                  </button>
                  {onDeleteAccount && (
                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.warning();
                        setAccountToDelete(a);
                      }}
                      className="p-1 text-zinc-600 hover:text-red-400 rounded transition cursor-pointer"
                      title="Eliminar cuenta definitivamente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">¿Eliminar cuenta?</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  ¿Deseas eliminar <strong className="text-zinc-200">«{accountToDelete.name}»</strong>? Esta acción se guardará en la papelera para poder restaurarla si lo necesitas.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (onDeleteAccount) {
                    await onDeleteAccount(accountToDelete.id, true);
                  }
                  setAccountToDelete(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-lg shadow-red-600/25 cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
