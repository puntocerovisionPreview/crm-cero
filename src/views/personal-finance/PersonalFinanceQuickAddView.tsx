import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  ShieldCheck, 
  Calendar, 
  Mic, 
  MicOff, 
  Check, 
  ArrowLeft, 
  Delete, 
  FolderKanban, 
  Tag, 
  Plus, 
  Sparkles,
  Layers
} from 'lucide-react';
import { 
  PersonalAccount, 
  PersonalCategory, 
  PersonalTransaction, 
  PersonalTransactionType, 
  Project,
  PersonalFinanceSettings
} from '../../types';
import { getTodayString, addDays } from '../../utils/storage';
import { hapticFeedback } from '../../utils/haptics';

interface Props {
  accounts: PersonalAccount[];
  categories: PersonalCategory[];
  projects: Project[];
  settings: PersonalFinanceSettings;
  onSaveTransaction: (transaction: Omit<PersonalTransaction, 'id' | 'createdAt'>) => Promise<void>;
  onNavigate: (path: string) => void;
}

export const PersonalFinanceQuickAddView: React.FC<Props> = ({
  accounts,
  categories,
  projects,
  settings,
  onSaveTransaction,
  onNavigate,
}) => {
  // Parse query params for iOS Shortcuts
  const [type, setType] = useState<PersonalTransactionType>('gasto');
  const [amountStr, setAmountStr] = useState<string>('');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedToAccountId, setSelectedToAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayString());
  const [note, setNote] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [sourceIncomeId, setSourceIncomeId] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize from accounts and URL query params (Shortcuts ready)
  useEffect(() => {
    const activeAccounts = accounts.filter(a => !a.archived);
    if (activeAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(activeAccounts[0].id);
      if (activeAccounts.length > 1) {
        setSelectedToAccountId(activeAccounts[1].id);
      }
    }

    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const qTipo = sp.get('tipo');
      const qMonto = sp.get('monto');
      const qMoneda = sp.get('moneda');
      const qCat = sp.get('cat');
      const qCuenta = sp.get('cuenta');
      const qNota = sp.get('nota');
      const qSourceIncomeId = sp.get('sourceIncomeId');
      const qProyecto = sp.get('proyecto');

      if (qTipo === 'gasto' || qTipo === 'ingreso' || qTipo === 'transferencia' || qTipo === 'ahorro') {
        setType(qTipo);
      }
      if (qMonto) {
        setAmountStr(qMonto);
      }
      if (qMoneda === 'USD' || qMoneda === 'ARS') {
        setCurrency(qMoneda);
      }
      if (qNota) {
        setNote(qNota);
      }
      if (qSourceIncomeId) {
        setSourceIncomeId(qSourceIncomeId);
      }
      if (qProyecto) {
        setSelectedProjectId(qProyecto);
      }

      // Match category by keyword
      if (qCat) {
        const foundCat = categories.find(c => 
          c.name.toLowerCase().includes(qCat.toLowerCase()) || 
          c.id.toLowerCase().includes(qCat.toLowerCase())
        );
        if (foundCat) setSelectedCategoryId(foundCat.id);
      }

      // Match account by keyword
      if (qCuenta) {
        const foundAcc = accounts.find(a => 
          a.name.toLowerCase().includes(qCuenta.toLowerCase()) || 
          a.id.toLowerCase().includes(qCuenta.toLowerCase())
        );
        if (foundAcc) setSelectedAccountId(foundAcc.id);
      }
    }
  }, [accounts, categories]);

  // Set default category when type changes if not selected
  useEffect(() => {
    const matchingCats = categories.filter(c => c.type === (type === 'transferencia' ? 'gasto' : type));
    if (matchingCats.length > 0 && (!selectedCategoryId || !matchingCats.some(c => c.id === selectedCategoryId))) {
      setSelectedCategoryId(matchingCats[0].id);
    }
  }, [type, categories]);

  // Keypad click handler
  const handleKeyClick = (key: string) => {
    hapticFeedback.light();
    if (key === 'del') {
      setAmountStr(prev => prev.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (!amountStr.includes('.')) {
        setAmountStr(prev => (prev === '' ? '0.' : prev + '.'));
      }
      return;
    }
    // Limit to max 12 characters
    if (amountStr.length < 12) {
      setAmountStr(prev => prev + key);
    }
  };

  // Speech Recognition voice dictation
  const toggleSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento por voz nativo.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-AR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        hapticFeedback.medium();
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          hapticFeedback.success();
          setNote(prev => (prev ? `${prev} ${transcript}` : transcript));
          
          // Auto detect numbers in speech if amount is empty (e.g. "gasté 4500 en almuerzo")
          const numMatch = transcript.match(/\b\d+(\.\d+)?\b/);
          if (numMatch && !amountStr) {
            setAmountStr(numMatch[0]);
          }
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  const handleSave = async (andLoadAnother: boolean = false) => {
    setFormError(null);
    const parsedAmount = parseFloat(amountStr);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      hapticFeedback.warning();
      setFormError('Por favor ingresá un monto mayor a 0');
      return;
    }

    if (!selectedAccountId) {
      hapticFeedback.warning();
      setFormError('Por favor seleccioná una cuenta');
      return;
    }

    if (type === 'transferencia' && selectedAccountId === selectedToAccountId) {
      hapticFeedback.warning();
      setFormError('La cuenta de origen y destino deben ser distintas');
      return;
    }

    const proj = projects.find(p => p.id === selectedProjectId);

    try {
      setIsSaving(true);
      hapticFeedback.success();

      await onSaveTransaction({
        type,
        amount: parsedAmount,
        currency,
        date,
        accountId: selectedAccountId,
        toAccountId: type === 'transferencia' ? selectedToAccountId : undefined,
        categoryId: selectedCategoryId,
        note: note.trim() || undefined,
        projectId: proj ? proj.id : undefined,
        projectName: proj ? proj.clientName : undefined,
        sourceIncomeId,
        status: 'confirmado',
      });

      if (andLoadAnother) {
        setAmountStr('');
        setNote('');
        setSourceIncomeId(undefined);
        setIsSaving(false);
      } else {
        onNavigate('/mis-finanzas/movimientos');
      }
    } catch (err) {
      console.error('Error saving transaction:', err);
      setIsSaving(false);
    }
  };

  const typeTabs: { type: PersonalTransactionType; label: string; activeClass: string }[] = [
    { type: 'gasto', label: 'Gasto', activeClass: 'bg-rose-500 text-white shadow-rose-500/20' },
    { type: 'ingreso', label: 'Ingreso', activeClass: 'bg-emerald-500 text-black shadow-emerald-500/20' },
    { type: 'transferencia', label: 'Transferir', activeClass: 'bg-sky-500 text-black shadow-sky-500/20' },
    { type: 'ahorro', label: 'Ahorro', activeClass: 'bg-blue-600 text-white shadow-blue-500/20' },
  ];

  const currentCategories = categories.filter(c => 
    c.type === (type === 'transferencia' ? 'gasto' : type)
  );

  return (
    <div className="w-full max-w-md mx-auto space-y-4 animate-in fade-in duration-150 pb-16">
      
      {/* Top Header with Back button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate('/mis-finanzas')}
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Resumen</span>
        </button>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
          Carga &lt;5s
        </span>
      </div>

      {/* Main Form Box */}
      <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl space-y-4">
        
        {/* 1. Transaction Type Toggle */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-zinc-900 rounded-2xl border border-zinc-800 text-xs font-bold">
          {typeTabs.map(tab => (
            <button
              key={tab.type}
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                setType(tab.type);
              }}
              className={`py-2 rounded-xl transition text-center active:scale-95 ${
                type === tab.type
                  ? `${tab.activeClass} shadow-md`
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {formError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* 2. Amount Display & Currency Switcher */}
        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-0.5">
              Monto a Registrar
            </span>
            <div className="flex items-baseline gap-1 font-mono">
              <span className={`text-2xl font-bold ${type === 'ingreso' ? 'text-emerald-400' : type === 'gasto' ? 'text-rose-400' : 'text-sky-400'}`}>
                {currency === 'USD' ? 'US$' : '$'}
              </span>
              <span className="text-3xl sm:text-4xl font-black text-zinc-100 tracking-tight truncate">
                {amountStr || '0'}
              </span>
            </div>
          </div>

          {/* Currency Toggle */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 shrink-0 font-mono text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setCurrency('ARS');
              }}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                currency === 'ARS' 
                  ? 'bg-emerald-500 text-black shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              ARS
            </button>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setCurrency('USD');
              }}
              className={`px-2.5 py-1.5 rounded-lg transition ${
                currency === 'USD' 
                  ? 'bg-blue-500 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              USD
            </button>
          </div>
        </div>

        {/* 3. Account Chips (1-Tap Selection) */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
            <span>{type === 'transferencia' ? 'Cuenta Origen' : 'Cuenta'}</span>
            <span className="text-zinc-600 font-mono text-[9px]">Tocar para elegir</span>
          </label>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {accounts.filter(a => !a.archived).length === 0 ? (
              <div className="text-xs text-amber-400 py-1 flex items-center gap-2">
                <span>No tenés cuentas creadas todavía.</span>
                <button
                  type="button"
                  onClick={() => onNavigate('/mis-finanzas/cuentas')}
                  className="underline font-bold text-zinc-100 hover:text-white cursor-pointer"
                >
                  Crear cuenta →
                </button>
              </div>
            ) : (
              accounts.filter(a => !a.archived).map(acc => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setSelectedAccountId(acc.id);
                    setCurrency(acc.currency);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 border cursor-pointer ${
                    selectedAccountId === acc.id
                      ? 'bg-zinc-800 text-zinc-100 border-[var(--accent)] ring-1 ring-[var(--accent)]/50'
                      : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                  <span>{acc.name}</span>
                  <span className="text-[10px] font-mono text-zinc-500">({acc.currency})</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Transfer Destination Account */}
        {type === 'transferencia' && (
          <div className="space-y-1.5 animate-in fade-in">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Cuenta Destino
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {accounts.filter(a => !a.archived && a.id !== selectedAccountId).map(acc => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setSelectedToAccountId(acc.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 border ${
                    selectedToAccountId === acc.id
                      ? 'bg-zinc-800 text-zinc-100 border-sky-500 ring-1 ring-sky-500/50'
                      : 'bg-zinc-900/60 text-zinc-400 border-zinc-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                  <span>{acc.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. Category Chips (1-Tap Selection) */}
        {type !== 'transferencia' && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Categoría
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {currentCategories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setSelectedCategoryId(cat.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 border ${
                    selectedCategoryId === cat.id
                      ? 'bg-zinc-800 text-zinc-100 border-amber-500 ring-1 ring-amber-500/50'
                      : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5. Note / Concept + Voice Dictation */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
            Detalle / Nota
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Almuerzo, Uber, Factura luz, Nafta..."
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--accent)] rounded-2xl pl-3.5 pr-11 py-2.5 text-xs text-zinc-200 focus:outline-hidden transition"
            />
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`absolute right-2 p-1.5 rounded-xl transition active:scale-90 ${
                isListening 
                  ? 'bg-rose-500 text-white animate-pulse' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
              title="Dictar concepto por voz"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 6. Date & Optional Project Link */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--accent)] rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">Cliente / Proyecto</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-[var(--accent)] rounded-xl px-2 py-1.5 text-xs text-zinc-200 focus:outline-hidden truncate"
            >
              <option value="">(Sin vincular)</option>
              {projects.filter(p => !p.archived).map(p => (
                <option key={p.id} value={p.id}>{p.clientName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 7. Large Tactile Numeric Keypad (Optimized for Mobile Touch) */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => handleKeyClick(k)}
              className={`h-12 sm:h-14 rounded-2xl border transition active:scale-95 flex items-center justify-center font-mono font-bold text-lg sm:text-xl ${
                k === 'del'
                  ? 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  : 'bg-zinc-900 border-zinc-800/80 text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              {k === 'del' ? <Delete className="w-5 h-5" /> : k}
            </button>
          ))}
        </div>

        {/* 8. Save Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            disabled={isSaving || !amountStr}
            onClick={() => handleSave(true)}
            className="py-3 px-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-xs font-bold transition active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            Guardar y Cargar Otro
          </button>

          <button
            type="button"
            disabled={isSaving || !amountStr}
            onClick={() => handleSave(false)}
            className="py-3 px-3 rounded-2xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-black text-xs font-black transition active:scale-95 disabled:opacity-40 shadow-lg shadow-[var(--accent)]/25 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Guardar</span>
          </button>
        </div>

      </div>
    </div>
  );
};
