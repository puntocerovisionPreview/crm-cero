import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  DollarSign, 
  Lock, 
  KeyRound, 
  Download, 
  Copy, 
  Check, 
  RefreshCw, 
  Smartphone, 
  ExternalLink, 
  ShieldCheck, 
  FileSpreadsheet, 
  Code2, 
  Eye, 
  EyeOff, 
  Layers,
  HelpCircle,
  Share2,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  PersonalFinanceSettings, 
  PersonalTransaction, 
  PersonalAccount, 
  PersonalCategory,
  SavingsGoal
} from '../../types';
import { 
  calculateTotalBalances, 
  calculateMonthlyFinanceSummary, 
  formatPersonalAmount,
  getCurrentMonthStr 
} from '../../utils/personalFinance';
import { hapticFeedback } from '../../utils/haptics';
import { DEFAULT_USD_RATE } from '../../utils/currency';

interface Props {
  settings: PersonalFinanceSettings;
  accounts: PersonalAccount[];
  categories: PersonalCategory[];
  transactions: PersonalTransaction[];
  goals: SavingsGoal[];
  onSaveSettings: (settings: PersonalFinanceSettings) => Promise<void>;
  onNavigate: (path: string) => void;
}

export const PersonalFinanceSettingsView: React.FC<Props> = ({
  settings,
  accounts,
  categories,
  transactions,
  goals,
  onSaveSettings,
  onNavigate,
}) => {
  const [usdRateStr, setUsdRateStr] = useState<string>(String(settings.usdExchangeRate || DEFAULT_USD_RATE));
  const [pinEnabled, setPinEnabled] = useState<boolean>(settings.pinEnabled || false);
  const [customPin, setCustomPin] = useState<string>(settings.customPin || '');
  const [hideAmountsInWidget, setHideAmountsInWidget] = useState<boolean>(settings.hideAmountsInWidget || false);
  const [token, setToken] = useState<string>(settings.scriptableToken || 'cero_fin_' + Math.random().toString(36).substring(2, 10));
  
  const [copiedShortcut, setCopiedShortcut] = useState<string | null>(null);
  const [copiedScriptable, setCopiedScriptable] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://cero-crm.web.app';

  // Summary object generated for the Scriptable widget or external sync
  const currentMonth = getCurrentMonthStr();
  const usdRateNum = parseFloat(usdRateStr) || 1250;
  const balances = calculateTotalBalances(accounts, transactions, usdRateNum);
  const monthSummary = calculateMonthlyFinanceSummary(transactions, currentMonth, usdRateNum);
  const primaryGoal = goals.length > 0 ? goals[0] : null;

  const widgetData = {
    updatedAt: new Date().toISOString(),
    privacy: hideAmountsInWidget,
    arsTotal: hideAmountsInWidget ? '••••' : balances.arsTotal,
    usdTotal: hideAmountsInWidget ? '••••' : balances.usdTotal,
    combinedInARS: hideAmountsInWidget ? '••••' : balances.combinedInARS,
    monthlyExpenseARS: hideAmountsInWidget ? '••••' : monthSummary.normalizedExpenseARS,
    monthlyIncomeARS: hideAmountsInWidget ? '••••' : monthSummary.normalizedIncomeARS,
    monthlySavingsARS: hideAmountsInWidget ? '••••' : monthSummary.normalizedSavingsARS,
    savingsRatePercent: monthSummary.savingsRatePercent,
    primaryGoal: primaryGoal ? {
      name: primaryGoal.name,
      target: primaryGoal.targetAmount,
      saved: primaryGoal.savedAmount,
      percentage: Math.min(100, Math.round((primaryGoal.savedAmount / (primaryGoal.targetAmount || 1)) * 100)),
    } : null,
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    hapticFeedback.medium();

    const rate = parseFloat(usdRateStr) || DEFAULT_USD_RATE;
    // Si cambiaste el número a mano, pasa a cotización manual; si no, se mantiene la automática
    const rateChanged = Math.round(rate) !== Math.round(settings.usdExchangeRate || 0);
    const updated: PersonalFinanceSettings = {
      ...settings,
      usdExchangeRate: rate,
      ...(rateChanged ? { usdRateSource: 'manual' as const } : {}),
      pinEnabled,
      customPin: pinEnabled ? customPin.trim() : undefined,
      scriptableToken: token,
      hideAmountsInWidget,
    };

    await onSaveSettings(updated);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleRegenerateToken = () => {
    hapticFeedback.light();
    const nextToken = 'cero_fin_' + Math.random().toString(36).substring(2, 10);
    setToken(nextToken);
  };

  // Export transactions to CSV
  const handleExportCSV = () => {
    hapticFeedback.light();
    const accountMap = new Map(accounts.map(a => [a.id, a.name]));
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    const headers = ['ID', 'Fecha', 'Tipo', 'Monto', 'Moneda', 'Cuenta', 'Categoría', 'Nota', 'Proyecto', 'Estado'];
    const rows = transactions.map(t => [
      t.id,
      t.date,
      t.type,
      t.amount,
      t.currency,
      `"${accountMap.get(t.accountId) || t.accountId}"`,
      `"${categoryMap.get(t.categoryId) || t.categoryId}"`,
      `"${(t.note || '').replace(/"/g, '""')}"`,
      `"${t.projectName || ''}"`,
      t.status,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cero-finanzas-personales-${currentMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export JSON for widget
  const handleExportJSON = () => {
    hapticFeedback.light();
    const blob = new Blob([JSON.stringify(widgetData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cero-finanzas-widget.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Scriptable iOS Code
  const scriptableCode = `// Variables de configuración de .Cero CRM
// Pegar este código en la app Scriptable en tu iPhone

const DATA = ${JSON.stringify(widgetData, null, 2)};

// Crear Widget Swiss Minimalista Oscuro
let widget = new ListWidget();
widget.backgroundColor = new Color("#0B0F17");
widget.setPadding(14, 14, 14, 14);

// Header
let titleStack = widget.addStack();
titleStack.layoutHorizontally();
let dot = titleStack.addText("● ");
dot.textColor = new Color("#E8590C");
dot.font = Font.boldSystemFont(11);
let header = titleStack.addText(".CERO FINANZAS");
header.textColor = new Color("#A1A1AA");
header.font = Font.boldSystemFont(10);
widget.addSpacer(8);

// ARS & USD Saldo
let arsText = widget.addText("$ " + (DATA.privacy ? "••••••" : DATA.arsTotal.toLocaleString("es-AR")));
arsText.textColor = new Color("#F4F4F5");
arsText.font = Font.boldSystemFont(18);

let usdText = widget.addText("US$ " + (DATA.privacy ? "••••••" : DATA.usdTotal.toLocaleString("es-AR")));
usdText.textColor = new Color("#10B981");
usdText.font = Font.systemFont(13);
widget.addSpacer(6);

// Gasto del mes
let expStack = widget.addStack();
let expLabel = expStack.addText("Gasto mes: ");
expLabel.textColor = new Color("#71717A");
expLabel.font = Font.systemFont(11);
let expVal = expStack.addText("$ " + (DATA.privacy ? "••••" : DATA.monthlyExpenseARS.toLocaleString("es-AR")));
expVal.textColor = new Color("#FB7185");
expVal.font = Font.boldSystemFont(11);

// Open app on tap
widget.url = "${originUrl}/mis-finanzas";

Script.setWidget(widget);
Script.complete();
widget.presentMedium();
`;

  const copyToClipboard = (text: string, key: string) => {
    hapticFeedback.success();
    navigator.clipboard.writeText(text);
    if (key === 'scriptable') {
      setCopiedScriptable(true);
      setTimeout(() => setCopiedScriptable(false), 2000);
    } else {
      setCopiedShortcut(key);
      setTimeout(() => setCopiedShortcut(null), 2000);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 animate-in fade-in">
      
      {/* 1. Header */}
      <div className="pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-zinc-300" />
          <h1 className="text-lg font-black tracking-tight text-zinc-100">
            Ajustes & Integraciones
          </h1>
        </div>
        <p className="text-xs text-zinc-400">
          Cotización de divisas, privacidad, PIN y atajos para iPhone / PWA
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Ajustes guardados correctamente</span>
        </div>
      )}

      {/* 2. Cotización USD Manual */}
      <div className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Cotización USD ↔ ARS</h2>
              <p className="text-xs text-zinc-400">
                {settings.usdRateSource === 'manual'
                  ? 'Usás un valor manual. Para volver a la cotización automática, cambialo en Ajustes.'
                  : 'Se actualiza sola con el dólar del día. Si cargás otro número, pasa a ser manual.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-2.5 text-xs font-mono text-zinc-400">$</span>
            <input
              type="number"
              step="1"
              value={usdRateStr}
              onChange={(e) => setUsdRateStr(e.target.value)}
              placeholder="1250"
              className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700/80 text-zinc-100 font-mono text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSaveSettings()}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-[var(--on-accent)] text-xs font-bold transition shadow-sm"
          >
            {isSaving ? 'Guardando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* 3. PIN de Acceso Opcional para este módulo */}
      <div className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">PIN Extra de Seguridad</h2>
              <p className="text-xs text-zinc-400">
                Bloquear exclusivamente la sección /mis-finanzas con un PIN de 4 dígitos
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={pinEnabled} 
              onChange={(e) => {
                setPinEnabled(e.target.checked);
              }}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] peer-checked:bg-[var(--accent)]" />
          </label>
        </div>

        {pinEnabled && (
          <div className="pt-2 border-t border-zinc-900 space-y-3 animate-in fade-in">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              PIN Numérico (4 dígitos)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="password"
                maxLength={4}
                value={customPin}
                onChange={(e) => setCustomPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-32 text-center tracking-[0.5em] px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700/80 text-zinc-100 font-mono text-base focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => handleSaveSettings()}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold transition"
              >
                Guardar PIN
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. SECCIÓN iPHONE (PWA, Apple Shortcuts & Scriptable) */}
      <div className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-5">
        <div className="flex items-start justify-between gap-3 pb-2 border-b border-zinc-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Atajos de iPhone (iOS 18+ / PWA)</h2>
              <p className="text-xs text-zinc-400">
                Acceso ultra-rápido en menos de 5 segundos desde Centro de Control y Pantalla de Bloqueo
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer requested: Estos accesos son atajos y no widgets nativos */}
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-300">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            <strong>Aclaración:</strong> Una PWA no tiene acceso a widgets nativos de iOS sin compilación en Xcode; estos accesos directos funcionan como <em>Atajos de Apple Shortcuts</em> y scripts de <em>Scriptable</em>.
          </p>
        </div>

        {/* Step-by-step Apple Shortcuts */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            Enlaces Profundos para Apple Shortcuts
          </h3>

          <div className="space-y-2">
            {/* Shortcut 1: Gasto Rápido */}
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-bold text-zinc-200 block">Gasto Rápido</span>
                <code className="text-[10px] text-zinc-400 font-mono truncate block">
                  {originUrl}/mis-finanzas/nuevo?tipo=gasto
                </code>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(`${originUrl}/mis-finanzas/nuevo?tipo=gasto`, 'gasto')}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 shrink-0"
              >
                {copiedShortcut === 'gasto' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copiar</span>
              </button>
            </div>

            {/* Shortcut 2: Ingreso Rápido */}
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-bold text-zinc-200 block">Ingreso Rápido</span>
                <code className="text-[10px] text-zinc-400 font-mono truncate block">
                  {originUrl}/mis-finanzas/nuevo?tipo=ingreso
                </code>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(`${originUrl}/mis-finanzas/nuevo?tipo=ingreso`, 'ingreso')}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 shrink-0"
              >
                {copiedShortcut === 'ingreso' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copiar</span>
              </button>
            </div>

            {/* Shortcut 3: Atajo Avanzado con 'Ask for Input' */}
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-bold text-zinc-200 block">Atajo Avanzado con Monto Dinámico</span>
                <p className="text-[11px] text-zinc-400">
                  En la app Atajos: Acción <em>"Solicitar entrada (Número)"</em> → Acción <em>"Abrir URL"</em>:
                </p>
                <code className="text-[10px] text-zinc-400 font-mono truncate block mt-0.5">
                  {originUrl}/mis-finanzas/nuevo?tipo=gasto&monto=[Entrada]
                </code>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(`${originUrl}/mis-finanzas/nuevo?tipo=gasto&monto=`, 'avanzado')}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 shrink-0"
              >
                {copiedShortcut === 'avanzado' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copiar Base</span>
              </button>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1">
            <span className="font-bold text-zinc-300 block">¿Cómo agregarlo al botón de Acción o Pantalla de Bloqueo en iPhone?</span>
            <p>1. Abrí la app <strong>Atajos</strong> (Shortcuts) en tu iPhone y creá un nuevo atajo con la acción <em>"Abrir URL"</em>.</p>
            <p>2. En Ajustes de iOS → <strong>Centro de Control</strong> o en la <strong>Pantalla de Bloqueo</strong> (editar controles en iOS 18), seleccioná el atajo creado.</p>
          </div>
        </div>

        {/* Scriptable Widget Section */}
        <div className="pt-4 border-t border-zinc-900 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                Widget Swiss Oscuro con Scriptable
              </h3>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(scriptableCode, 'scriptable')}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5"
            >
              {copiedScriptable ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedScriptable ? 'Copiado' : 'Copiar Script'}</span>
            </button>
          </div>

          <p className="text-xs text-zinc-400">
            Instalá la app gratuita <strong>Scriptable</strong> del App Store, creá un nuevo script y pegá este código para tener un widget estético en tu Home Screen.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setHideAmountsInWidget(prev => !prev);
                handleSaveSettings();
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-2"
            >
              {hideAmountsInWidget ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{hideAmountsInWidget ? 'Montos Ocultos en Widget' : 'Montos Visibles en Widget'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportJSON}
              className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-2 hover:bg-zinc-800"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar JSON de Widget</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. Export Data CSV */}
      <div className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100">Exportar Movimientos a CSV</h2>
            <p className="text-xs text-zinc-400">
              Descargá un archivo compatible con Excel, Google Sheets o Numbers
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700/80 hover:bg-zinc-800 text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 transition"
        >
          <Download className="w-4 h-4" />
          <span>Exportar {transactions.length} Movimientos</span>
        </button>
      </div>

    </div>
  );
};
