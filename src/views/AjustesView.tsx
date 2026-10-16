import React, { useState } from 'react';
import { 
  CreditCard, 
  Tag, 
  DollarSign, 
  Shield, 
  Smartphone, 
  HelpCircle, 
  Cloud, 
  Sliders, 
  Lock, 
  ArrowLeft, 
  Check, 
  Download, 
  UploadCloud, 
  FileSpreadsheet, 
  RefreshCw, 
  Link2, 
  Keyboard, 
  BookOpen, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  AlertTriangle,
  Trash2,
  RotateCcw,
  Calculator,
  PieChart,
  Users,
  FileText,
  CheckCircle2,
  Compass,
  Sun,
  Moon
} from 'lucide-react';
import { StudioPaymentSettings, PersonalFinanceSettings, SyncStatus, TrashItem, StudioEconomicGoals } from '../types';
import { getUiPreferences, setUiPreference, HOY_BLOCK_LABELS, UiPreferences } from '../utils/uiPreferences';
import { hapticFeedback } from '../utils/haptics';
import { loadStoredTrash, purgeTrashRecord, emptyTrashRecords, loadFromStorage, saveToStorage } from '../utils/storage';
import { getHorizonCapacity, setHorizonCapacity } from '../utils/horizon';
import { getLeadProbabilities, setLeadProbabilities } from '../utils/monthlyCashProjection';
import { getMissionsConfig, saveMissionsConfig, MissionsConfig } from '../utils/missions';
import { DEFAULT_USD_RATE, USD_RATE_SOURCE_LABELS, UsdRateSource } from '../utils/currency';
import { AutomationSettings } from '../components/AutomationSettings';
import { Zap } from 'lucide-react';

interface Props {
  subSection?: string;
  studioSettings?: StudioPaymentSettings;
  onUpdateStudioSettings?: (settings: StudioPaymentSettings) => void;
  personalSettings?: PersonalFinanceSettings;
  onUpdatePersonalSettings?: (settings: Partial<PersonalFinanceSettings>) => void;
  privacyMode: boolean;
  onTogglePrivacy: () => void;
  syncStatus: SyncStatus;
  onForceSync?: () => void;
  onExportJSON?: () => void;
  onExportCSV?: () => void;
  onImportJSON?: (file: File) => void;
  onResetDatabase?: () => void;
  onLockSession: () => void;
  onRepairTaskLinks?: () => void;
  onRestoreTrashItem?: (item: TrashItem) => void;
  onNavigate: (path: string) => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const AjustesView: React.FC<Props> = ({
  subSection,
  studioSettings,
  onUpdateStudioSettings,
  personalSettings,
  onUpdatePersonalSettings,
  privacyMode,
  onTogglePrivacy,
  syncStatus,
  onForceSync,
  onExportJSON,
  onExportCSV,
  onImportJSON,
  onResetDatabase,
  onLockSession,
  onRepairTaskLinks,
  onRestoreTrashItem,
  onNavigate,
  theme = 'dark',
  onToggleTheme,
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(subSection || null);
  const [prefs, setPrefs] = useState<UiPreferences>(getUiPreferences());

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Section 1: Studio Payment Form State
  const [aliasArs, setAliasArs] = useState(studioSettings?.aliasArs || '');
  const [cbuArs, setCbuArs] = useState(studioSettings?.cbuArs || '');
  const [aliasUsd, setAliasUsd] = useState(studioSettings?.aliasUsd || '');
  const [cbuUsd, setCbuUsd] = useState(studioSettings?.cbuUsd || '');
  const [accountHolder, setAccountHolder] = useState(studioSettings?.accountHolder || '');
  const [paymentLink, setPaymentLink] = useState(studioSettings?.paymentLink || '');
  const [usdtAddress, setUsdtAddress] = useState(studioSettings?.usdtAddress || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Section 2: Personal Finance Form State
  const [usdRate, setUsdRate] = useState<string>(String(personalSettings?.usdExchangeRate || DEFAULT_USD_RATE));
  const [usdRateSource, setUsdRateSource] = useState<UsdRateSource>(personalSettings?.usdRateSource || 'blue');
  const [horizonCapacity, setHorizonCapacityState] = useState<number>(() => getHorizonCapacity());
  const [leadProbMap, setLeadProbMap] = useState<Record<string, number>>(() => getLeadProbabilities());
  const [missionsCfg, setMissionsCfg] = useState<MissionsConfig>(() => getMissionsConfig());

  // Section: Fiscal & Economic Goals Form State
  const [economicGoals, setEconomicGoals] = useState<StudioEconomicGoals>(() => {
    return loadFromStorage<StudioEconomicGoals>('cero_v3_economic_goals', {
      monotributoCategory: 'Cat. H',
      monotributoCapArs: 68000000,
      suggestedSplitTaxes: 15,
      suggestedSplitSavings: 20,
      suggestedSplitReinvestment: 15,
      suggestedSplitSalary: 50,
      targetHourlyRateUsd: 35,
    });
  });

  // Section: Papelera State
  const [trashItems, setTrashItems] = useState<TrashItem[]>(() => loadStoredTrash());
  const [trashFilter, setTrashFilter] = useState<'todos' | 'cliente' | 'tarea' | 'movimiento' | 'nota'>('todos');
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);

  const handleSaveStudioSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateStudioSettings) {
      onUpdateStudioSettings({
        aliasArs: aliasArs.trim(),
        cbuArs: cbuArs.trim(),
        aliasUsd: aliasUsd.trim(),
        cbuUsd: cbuUsd.trim(),
        accountHolder: accountHolder.trim(),
        paymentLink: paymentLink.trim(),
        usdtAddress: usdtAddress.trim(),
        updatedAt: new Date().toISOString(),
      });
      hapticFeedback.success();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const handleSavePersonalSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(usdRate);
    if (onUpdatePersonalSettings) {
      onUpdatePersonalSettings({
        usdRateSource,
        ...(usdRateSource === 'manual' && !isNaN(rate) && rate > 0 ? { usdExchangeRate: rate } : {}),
      });
    }
    setHorizonCapacity(horizonCapacity);
    hapticFeedback.success();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleSaveEconomicGoals = (e: React.FormEvent) => {
    e.preventDefault();
    saveToStorage('cero_v3_economic_goals', economicGoals);
    setLeadProbabilities(leadProbMap);
    saveMissionsConfig(missionsCfg);
    hapticFeedback.success();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleRestore = (item: TrashItem) => {
    hapticFeedback.success();
    if (onRestoreTrashItem) {
      onRestoreTrashItem(item);
    }
    purgeTrashRecord(item.id);
    setTrashItems(prev => prev.filter(i => i.id !== item.id));
  };

  const handlePurge = (id: string) => {
    hapticFeedback.medium();
    purgeTrashRecord(id);
    setTrashItems(prev => prev.filter(i => i.id !== id));
  };

  const handleEmptyAll = () => {
    hapticFeedback.medium();
    emptyTrashRecords();
    setTrashItems([]);
    setConfirmEmptyTrash(false);
  };

  const filteredTrash = trashItems.filter(item => {
    if (trashFilter === 'todos') return true;
    if (trashFilter === 'cliente') return item.itemType === 'cliente' || (item.itemType as any) === 'proyecto';
    if (trashFilter === 'tarea') return item.itemType === 'tarea' || item.itemType === 'reunion';
    if (trashFilter === 'movimiento') return item.itemType === 'ingreso' || item.itemType === 'gasto' || item.itemType === 'movimiento_personal';
    if (trashFilter === 'nota') return item.itemType === 'nota';
    return true;
  });

  const handleTogglePref = (key: keyof UiPreferences) => {
    hapticFeedback.light();
    const currentVal = prefs[key];
    if (typeof currentVal === 'boolean') {
      const nextVal = !currentVal;
      setUiPreference(key, nextVal as any);
      setPrefs(prev => ({ ...prev, [key]: nextVal }));
    }
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    hapticFeedback.light();
    const newOrder = [...prefs.hoyBlocksOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    setUiPreference('hoyBlocksOrder', newOrder);
    setPrefs(prev => ({ ...prev, hoyBlocksOrder: newOrder }));
  };

  const SECTIONS = [
    {
      id: 'automatizaciones',
      title: 'Automatizaciones',
      description: 'Resumen diario y avisos por Telegram, plan semanal y Google Calendar',
      icon: Zap,
    },
    {
      id: 'cobro',
      title: 'Datos de cobro del estudio',
      description: 'CBU, CVU, Alias, Banco y datos de facturación para WhatsApp',
      icon: CreditCard,
    },
    {
      id: 'fiscal',
      title: 'Monotributo y Parámetros de Reparto',
      description: 'Categoría, tope anual en pesos y reparto sugerido de ingresos (% impuestos, ahorro, sueldo)',
      icon: Calculator,
    },
    {
      id: 'precios-paf',
      title: 'Precios PAF y Servicios',
      description: 'Valores base de programas PAF, cuotas y ajustes por inflación',
      icon: Tag,
    },
    {
      id: 'finanzas-personales',
      title: 'Finanzas personales y Cotizaciones',
      description: 'Cotización de referencia USD / ARS y parámetros financieros',
      icon: DollarSign,
    },
    {
      id: 'papelera',
      title: `Papelera de reciclaje (30 días)${trashItems.length > 0 ? ` · ${trashItems.length}` : ''}`,
      description: 'Ver, restaurar o vaciar clientes, movimientos, tareas y notas eliminadas',
      icon: Trash2,
    },
    {
      id: 'seguridad',
      title: 'Privacidad y Seguridad',
      description: 'Modo privacidad ($ ••••••), sesión con Google y acceso',
      icon: Shield,
    },
    {
      id: 'widgets',
      title: 'Widgets iPhone (iOS)',
      description: 'Acceso directo y widgets rápidos para la PWA en iOS',
      icon: Smartphone,
    },
    {
      id: 'ayuda',
      title: 'Ayuda, atajos y guías',
      description: 'Atajos de teclado (⌘K), método PAF, 2° cerebro y diagnósticos',
      icon: HelpCircle,
    },
    {
      id: 'sincronizacion',
      title: 'Sincronización y Respaldo',
      description: 'Estado Firestore, copias de seguridad JSON, exportar CSV',
      icon: Cloud,
    },
    {
      id: 'personalizar',
      title: 'Personalizar interfaz',
      description: 'Ocultar sectores, conmutar módulos y reordenar bloques de Hoy',
      icon: Sliders,
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-[var(--bg-app)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] px-4 py-3 flex items-center justify-between safe-area-top-header">
        <div className="flex items-center gap-3">
          {activeSection ? (
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setActiveSection(null);
                onNavigate('/ajustes');
              }}
              className="min-h-[44px] sm:min-h-[36px] px-3 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ajustes</span>
            </button>
          ) : (
            <h1 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
              Ajustes y Configuración
            </h1>
          )}

          {activeSection && (
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              / {SECTIONS.find(s => s.id === activeSection)?.title || activeSection}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            hapticFeedback.medium();
            onLockSession();
          }}
          className="min-h-[44px] sm:min-h-[32px] px-3 py-1.5 rounded-[var(--radius-control)] border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Cerrar sesión</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-3xl mx-auto w-full pb-16">
        {/* Main Sections Index */}
        {!activeSection && (
          <div className="space-y-3">
            {/* Direct Theme Switcher (Claro / Oscuro) */}
            {onToggleTheme && (
              <div className="card-swiss p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-surface)]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] shrink-0">
                    {theme === 'dark' ? (
                      <Moon className="w-4 h-4 text-sky-400 stroke-[1.75]" />
                    ) : (
                      <Sun className="w-4 h-4 text-amber-500 stroke-[1.75]" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold text-[var(--text-primary)] font-heading">
                      Apariencia y Modo visual
                    </h2>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Tema activo: <strong className="text-[var(--text-primary)]">{theme === 'dark' ? 'Modo Oscuro (.Cero)' : 'Modo Claro (Swiss Minimal)'}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      if (theme !== 'light') onToggleTheme();
                    }}
                    className={`px-3 py-1.5 rounded-[var(--radius-control)] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                      theme === 'light'
                        ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] border-transparent shadow-xs'
                        : 'bg-[var(--bg-app)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)]'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>Claro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (theme !== 'dark') onToggleTheme();
                    }}
                    className={`px-3 py-1.5 rounded-[var(--radius-control)] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                      theme === 'dark'
                        ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] border-transparent shadow-xs'
                        : 'bg-[var(--bg-app)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)]'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5 text-sky-400" />
                    <span>Oscuro</span>
                  </button>
                </div>
              </div>
            )}

            <p className="text-xs text-[var(--text-secondary)] mb-2">
              Configurá todos los módulos, preferencias visuales, datos bancarios y copias de seguridad de tu CRM .Cero.
            </p>

            <div className="card-swiss divide-y divide-[var(--border-subtle)] overflow-hidden">
              {SECTIONS.map((sec) => {
                const Icon = sec.icon;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      hapticFeedback.light();
                      setActiveSection(sec.id);
                      onNavigate(`/ajustes/${sec.id}`);
                    }}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--bg-surface-muted)] transition cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] shrink-0">
                        <Icon className="w-4 h-4 stroke-[1.75]" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xs font-semibold text-[var(--text-primary)] font-heading truncate">
                          {sec.title}
                        </h2>
                        <p className="text-[11px] text-[var(--text-secondary)] truncate">
                          {sec.description}
                        </p>
                      </div>
                    </div>

                    <span className="text-[var(--text-tertiary)] text-xs">→</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sub-section 1: Datos de cobro */}
        {activeSection === 'automatizaciones' && <AutomationSettings />}

        {activeSection === 'cobro' && (
          <form onSubmit={handleSaveStudioSettings} className="space-y-4">
            <div className="card-swiss p-4 sm:p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
                Datos de Cobro del Estudio (.Cero)
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Estos datos se incluyen automáticamente al presionar "WhatsApp de cobro" para enviar recordatorios a clientes.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">Titular de la cuenta</label>
                  <input
                    type="text"
                    placeholder="Nombre y Apellido"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">Link de Cobro (MercadoPago / Stripe)</label>
                  <input
                    type="text"
                    placeholder="https://mpago.la/..."
                    value={paymentLink}
                    onChange={(e) => setPaymentLink(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">Alias ARS (Pesos)</label>
                  <input
                    type="text"
                    placeholder="ej: punto.cero.mp"
                    value={aliasArs}
                    onChange={(e) => setAliasArs(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">CBU / CVU ARS (Pesos)</label>
                  <input
                    type="text"
                    placeholder="22 dígitos"
                    value={cbuArs}
                    onChange={(e) => setCbuArs(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">Alias / Cuenta USD (Dólares)</label>
                  <input
                    type="text"
                    placeholder="ej: punto.cero.usd"
                    value={aliasUsd}
                    onChange={(e) => setAliasUsd(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">CBU USD (Dólares)</label>
                  <input
                    type="text"
                    placeholder="22 dígitos cuenta USD"
                    value={cbuUsd}
                    onChange={(e) => setCbuUsd(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Billetera Cripto USDT (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Dirección TRC20 / ERC20"
                  value={usdtAddress}
                  onChange={(e) => setUsdtAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                {saveSuccess && (
                  <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Datos guardados correctamente
                  </span>
                )}
                <button
                  type="submit"
                  className="min-h-[44px] ml-auto px-5 py-2 rounded-[var(--radius-control)] btn-solid-primary text-xs font-semibold transition active:scale-95 cursor-pointer"
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Sub-section: Monotributo y Parámetros Fiscales */}
        {activeSection === 'fiscal' && (
          <form onSubmit={handleSaveEconomicGoals} className="card-swiss p-4 sm:p-5 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
                Monotributo y Parámetros de Reparto
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Cargá tus topes fiscales y proporciones de reparto según tu realidad operativa. No asumimos valores fijos.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Categoría Monotributo actual
                </label>
                <input
                  type="text"
                  placeholder="Ej: Cat. H"
                  value={economicGoals.monotributoCategory || ''}
                  onChange={(e) => setEconomicGoals(prev => ({ ...prev, monotributoCategory: e.target.value }))}
                  className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Tope anual facturación ARS
                </label>
                <input
                  type="number"
                  placeholder="Ej: 68000000"
                  value={economicGoals.monotributoCapArs || ''}
                  onChange={(e) => setEconomicGoals(prev => ({ ...prev, monotributoCapArs: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Tarifa objetivo por hora (USD)
                </label>
                <input
                  type="number"
                  placeholder="Ej: 35"
                  value={economicGoals.targetHourlyRateUsd || ''}
                  onChange={(e) => setEconomicGoals(prev => ({ ...prev, targetHourlyRateUsd: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Sueldo mensual objetivo retiro (USD)
                </label>
                <input
                  type="number"
                  placeholder="Ej: 1500"
                  value={economicGoals.monthlyTargetSalaryUsd || ''}
                  onChange={(e) => setEconomicGoals(prev => ({ ...prev, monthlyTargetSalaryUsd: Number(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--border-subtle)] space-y-3">
              <span className="text-xs font-semibold text-[var(--text-primary)] block font-heading">
                Reparto sugerido de cada cobro (%)
              </span>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Guía porcentual para reservar impuestos, separar fondo de ahorro y disponer de honorarios.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[10px] text-[var(--text-secondary)] font-medium">Impuestos / AFIP</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={economicGoals.suggestedSplitTaxes ?? 15}
                      onChange={(e) => setEconomicGoals(prev => ({ ...prev, suggestedSplitTaxes: Number(e.target.value) }))}
                      className="w-14 px-2 py-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono font-bold"
                    />
                    <span className="text-xs font-mono text-[var(--text-tertiary)]">%</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[10px] text-[var(--text-secondary)] font-medium">Fondo / Ahorro</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={economicGoals.suggestedSplitSavings ?? 20}
                      onChange={(e) => setEconomicGoals(prev => ({ ...prev, suggestedSplitSavings: Number(e.target.value) }))}
                      className="w-14 px-2 py-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono font-bold"
                    />
                    <span className="text-xs font-mono text-[var(--text-tertiary)]">%</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[10px] text-[var(--text-secondary)] font-medium">Herramientas / Gasto</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={economicGoals.suggestedSplitReinvestment ?? 15}
                      onChange={(e) => setEconomicGoals(prev => ({ ...prev, suggestedSplitReinvestment: Number(e.target.value) }))}
                      className="w-14 px-2 py-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono font-bold"
                    />
                    <span className="text-xs font-mono text-[var(--text-tertiary)]">%</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[10px] text-[var(--text-secondary)] font-medium">Sueldo / Retiro</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={economicGoals.suggestedSplitSalary ?? 50}
                      onChange={(e) => setEconomicGoals(prev => ({ ...prev, suggestedSplitSalary: Number(e.target.value) }))}
                      className="w-14 px-2 py-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono font-bold"
                    />
                    <span className="text-xs font-mono text-[var(--text-tertiary)]">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Probabilidades de Leads para Horizonte */}
            <div className="pt-2 border-t border-[var(--border-subtle)] space-y-3">
              <span className="text-xs font-semibold text-[var(--text-primary)] block font-heading">
                Probabilidades de Cierre para Prospectos / Leads (%)
              </span>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Ponderación usada en el Horizonte para calcular el potencial estimado de prospectos sin confirmación.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[10px] text-[var(--text-secondary)] font-medium">Posible proyecto</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={leadProbMap['Posible proyecto'] ?? 25}
                      onChange={(e) => setLeadProbMap(prev => ({ ...prev, 'Posible proyecto': Number(e.target.value) }))}
                      className="w-14 px-2 py-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono font-bold"
                    />
                    <span className="text-xs font-mono text-[var(--text-tertiary)]">%</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[10px] text-[var(--text-secondary)] font-medium">Propuesta enviada</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={leadProbMap['Propuesta enviada'] ?? 50}
                      onChange={(e) => setLeadProbMap(prev => ({ ...prev, 'Propuesta enviada': Number(e.target.value) }))}
                      className="w-14 px-2 py-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono font-bold"
                    />
                    <span className="text-xs font-mono text-[var(--text-tertiary)]">%</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[10px] text-[var(--text-secondary)] font-medium">En negociación</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={leadProbMap['En negociación'] ?? 70}
                      onChange={(e) => setLeadProbMap(prev => ({ ...prev, 'En negociación': Number(e.target.value) }))}
                      className="w-14 px-2 py-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono font-bold"
                    />
                    <span className="text-xs font-mono text-[var(--text-tertiary)]">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Configuración Misiones de la Semana (Topes & Cierre) */}
            <div className="pt-2 border-t border-[var(--border-subtle)] space-y-3">
              <span className="text-xs font-semibold text-[var(--text-primary)] block font-heading">
                Misiones de la Semana: Topes & Cierre
              </span>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Límite de misiones simultáneas por semana y día sugerido para el balance semanal.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/50 space-y-1">
                  <span className="text-[11px] text-[var(--text-secondary)] block">
                    Tope Misiones Grandes
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={missionsCfg.maxGrandes ?? 3}
                    onChange={(e) => setMissionsCfg(prev => ({ ...prev, maxGrandes: Number(e.target.value) || 3 }))}
                    className="w-full px-2.5 py-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono font-bold"
                  />
                  <span className="text-[10px] text-[var(--text-tertiary)]">Por defecto: 3</span>
                </div>

                <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/50 space-y-1">
                  <span className="text-[11px] text-[var(--text-secondary)] block">
                    Tope Mantenimiento
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={missionsCfg.maxMantenimiento ?? 1}
                    onChange={(e) => setMissionsCfg(prev => ({ ...prev, maxMantenimiento: Number(e.target.value) || 1 }))}
                    className="w-full px-2.5 py-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono font-bold"
                  />
                  <span className="text-[10px] text-[var(--text-tertiary)]">Por defecto: 1</span>
                </div>

                <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/50 space-y-1">
                  <span className="text-[11px] text-[var(--text-secondary)] block">
                    Día de Cierre Sugerido
                  </span>
                  <select
                    value={missionsCfg.diaCierre ?? 'domingo'}
                    onChange={(e) => setMissionsCfg(prev => ({ ...prev, diaCierre: e.target.value as 'viernes' | 'domingo' }))}
                    className="w-full px-2.5 py-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold"
                  >
                    <option value="viernes">Viernes (Fin de jornada)</option>
                    <option value="domingo">Domingo (Planificación previa)</option>
                  </select>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Aviso automático</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              {saveSuccess && (
                <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Parámetros guardados correctamente
                </span>
              )}
              <button
                type="submit"
                className="min-h-[44px] ml-auto px-5 py-2 rounded-[var(--radius-control)] btn-solid-primary text-xs font-semibold transition active:scale-95 cursor-pointer"
              >
                Guardar parámetros
              </button>
            </div>
          </form>
        )}

        {/* Sub-section 2: Precios PAF */}
        {activeSection === 'precios-paf' && (
          <div className="card-swiss p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
              Precios y Planes PAF (Programa de Acompañamiento Financiero)
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Referencia estándar de precios para consultoría PAF y desarrollo web.
            </p>

            <div className="space-y-3 pt-2">
              <div className="p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">PAF Pro (12 Semanas)</span>
                  <span className="text-xs font-mono font-bold text-[var(--accent)]">u$s 1.200 - 1.800</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  Diagnóstico + 12 sesiones 1:1 + Tablero de control financiero + Soporte prioritario.
                </p>
              </div>

              <div className="p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">PAF Base (6 Semanas)</span>
                  <span className="text-xs font-mono font-bold text-[var(--accent)]">u$s 750 - 950</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  Orden de caja + 6 sesiones 1:1 + Plantilla de flujo de fondos.
                </p>
              </div>

              <div className="p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Desarrollo Web & Apps</span>
                  <span className="text-xs font-mono font-bold text-emerald-500">A medida (desde u$s 600)</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  Landing page, sistema web, integración de pagos, soporte mensual de mantenimiento.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sub-section 3: Finanzas personales */}
        {activeSection === 'finanzas-personales' && (
          <form onSubmit={handleSavePersonalSettings} className="card-swiss p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
              Cotización de Dólar y Monedas
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Tipo de cambio de referencia utilizado para convertir y unificar saldos en pesos y dólares.
            </p>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-[var(--text-primary)]" htmlFor="usd-rate-source">
                De dónde sale la cotización
              </label>
              <select
                id="usd-rate-source"
                value={usdRateSource}
                onChange={(e) => setUsdRateSource(e.target.value as UsdRateSource)}
                className="w-full max-w-xs px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] focus:outline-none"
              >
                {(Object.keys(USD_RATE_SOURCE_LABELS) as UsdRateSource[]).map(src => (
                  <option key={src} value={src}>{USD_RATE_SOURCE_LABELS[src]}</option>
                ))}
              </select>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {usdRateSource === 'manual'
                  ? 'Se usa siempre el valor que cargues abajo.'
                  : `Se actualiza sola cada hora (precio de compra). Hoy: $ ${Number(personalSettings?.usdExchangeRate || 0).toLocaleString('es-AR')}.`}
              </p>
            </div>

            <div className={`space-y-2 pt-2 ${usdRateSource === 'manual' ? '' : 'hidden'}`}>
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                Tipo de cambio Dólar (ARS por USD)
              </label>
              <div className="flex items-center gap-2 max-w-xs">
                <span className="text-xs font-mono text-[var(--text-secondary)]">$</span>
                <input
                  type="number"
                  step="any"
                  value={usdRate}
                  onChange={(e) => setUsdRate(e.target.value)}
                  className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm font-mono font-bold text-[var(--text-primary)] focus:outline-none"
                />
              </div>
            </div>

            {/* Capacidad en Horizonte */}
            <div className="space-y-2 pt-4 border-t border-[var(--border-subtle)]">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                <span>Capacidad simultánea de proyectos (Horizonte)</span>
              </label>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Cantidad máxima de proyectos activos que podés gestionar por mes en la vista de Horizonte. Por defecto: 4.
              </p>
              <div className="flex items-center gap-2 max-w-xs">
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={horizonCapacity}
                  onChange={(e) => setHorizonCapacityState(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-24 px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm font-mono font-bold text-[var(--text-primary)] focus:outline-none"
                />
                <span className="text-xs text-[var(--text-secondary)] font-mono">proyectos / mes</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              {saveSuccess && (
                <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Ajustes guardados correctamente
                </span>
              )}
              <button
                type="submit"
                className="min-h-[44px] ml-auto px-5 py-2 rounded-[var(--radius-control)] btn-solid-primary text-xs font-semibold transition active:scale-95 cursor-pointer"
              >
                Guardar ajustes
              </button>
            </div>
          </form>
        )}

        {/* Sub-section: Papelera de Reciclaje */}
        {activeSection === 'papelera' && (
          <div className="card-swiss p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
                  Papelera de Reciclaje (.Cero)
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Los elementos eliminados se conservan por 30 días. Podés restaurar cualquier registro a su lista activa con sus datos intactos.
                </p>
              </div>

              {trashItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmEmptyTrash(true)}
                  className="min-h-[44px] sm:min-h-[32px] px-3 py-1.5 rounded-[var(--radius-control)] border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vaciar papelera ({trashItems.length})</span>
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {[
                { id: 'todos', label: `Todos (${trashItems.length})` },
                { id: 'cliente', label: 'Clientes' },
                { id: 'tarea', label: 'Tareas y Reuniones' },
                { id: 'movimiento', label: 'Movimientos' },
                { id: 'nota', label: 'Notas' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    hapticFeedback.light();
                    setTrashFilter(f.id as any);
                  }}
                  className={`px-3 py-1 rounded-[var(--radius-control)] border transition font-medium cursor-pointer shrink-0 ${
                    trashFilter === f.id
                      ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] border-transparent font-semibold shadow-xs'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Items List */}
            {filteredTrash.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed border-[var(--border-subtle)] rounded-xl">
                <Trash2 className="w-8 h-8 mx-auto text-[var(--text-tertiary)] opacity-60" />
                <p className="text-xs text-[var(--text-secondary)] font-medium">
                  {trashItems.length === 0 ? 'La papelera está vacía.' : 'No hay elementos para este filtro.'}
                </p>
                <p className="text-[11px] text-[var(--text-tertiary)] max-w-sm mx-auto">
                  Cualquier registro que elimines (cliente, movimiento, tarea o nota) aparecerá aquí durante 30 días con opción de restauración.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                {filteredTrash.map((item) => {
                  const daysLeft = item.expiresAt 
                    ? Math.max(0, Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                    : 30;

                  return (
                    <div key={item.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--bg-surface-muted)] transition">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-bold uppercase">
                            {item.itemType}
                          </span>
                          <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {item.title}
                          </span>
                          {item.amount !== undefined && (
                            <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                              {privacyMode ? '$ ••••••' : `$ ${item.amount.toLocaleString('es-AR')} ${item.currency || ''}`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--text-tertiary)]">
                          {item.subtitle && <span>{item.subtitle} · </span>}
                          <span>Eliminado el {item.deletedAt.slice(0, 10)}</span>
                          <span>·</span>
                          <span className="text-amber-500 font-medium">Expira en {daysLeft} días</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleRestore(item)}
                          className="min-h-[44px] sm:min-h-[32px] px-3 py-1.5 rounded-[var(--radius-control)] border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                          title="Restaurar a su lista activa"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restaurar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePurge(item.id)}
                          className="min-h-[44px] sm:min-h-[32px] p-2 rounded-[var(--radius-control)] text-[var(--text-tertiary)] hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Eliminar definitivamente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Confirmation Modal to Empty Trash */}
            {confirmEmptyTrash && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl t-modal-enter">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100">¿Vaciar toda la papelera?</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Se borrarán definitivamente los {trashItems.length} elementos de la papelera. Esta acción no se puede deshacer.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setConfirmEmptyTrash(false)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleEmptyAll}
                      className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition active:scale-95 cursor-pointer"
                    >
                      Sí, vaciar definitivamente
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sub-section 4: Privacidad y seguridad */}
        {activeSection === 'seguridad' && (
          <div className="card-swiss p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
              Privacidad y Bloqueo de Sesión
            </h2>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
                <div>
                  <span className="text-xs font-semibold text-[var(--text-primary)] block">
                    Modo Privacidad ($ ••••••)
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)] block">
                    Oculta todos los montos y cifras en pantalla al trabajar en público.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onTogglePrivacy}
                  className="min-h-[44px] px-3 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {privacyMode ? <EyeOff className="w-4 h-4 text-emerald-500" /> : <Eye className="w-4 h-4 text-[var(--text-tertiary)]" />}
                  <span>{privacyMode ? 'Activo' : 'Inactivo'}</span>
                </button>
              </div>

              <div className="p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] space-y-2">
                <span className="text-xs font-semibold text-[var(--text-primary)] block">
                  Sesión
                </span>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Entrás con tu cuenta de Google. Solo las cuentas autorizadas pueden ver tus datos.
                </p>
                <button
                  type="button"
                  onClick={onLockSession}
                  className="min-h-[44px] px-4 py-2 rounded-[var(--radius-control)] btn-solid-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sub-section 5: Widgets iOS */}
        {activeSection === 'widgets' && (
          <div className="card-swiss p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
              Instalación y Widgets iPhone (iOS)
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Tu app funciona como PWA nativa con soporte táctil de 44px, gestos y sin scroll accidental.
            </p>

            <div className="space-y-3 pt-2 text-xs text-[var(--text-secondary)]">
              <div className="p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] space-y-1">
                <strong className="text-[var(--text-primary)] block">1. Agregar a la pantalla de inicio:</strong>
                <span>En Safari, tocá el botón Compartir y seleccioná <strong>"Agregar a pantalla de inicio"</strong>.</span>
              </div>

              <div className="p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] space-y-1">
                <strong className="text-[var(--text-primary)] block">2. Atajos rápidos desde el ícono:</strong>
                <span>Podés ingresar directo a <strong>/hoy</strong>, abrir <strong>Modo Foco</strong> o consultar <strong>Clientes</strong>.</span>
              </div>
            </div>
          </div>
        )}

        {/* Sub-section 6: Ayuda, atajos y guías */}
        {activeSection === 'ayuda' && (
          <div className="card-swiss p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
              Atajos de Teclado y Utilidades
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              {[
                { k: '⌘K / Ctrl+K', label: 'Buscador y paleta de comandos' },
                { k: '1', label: 'Ir a Hoy' },
                { k: '2', label: 'Ir a Clientes' },
                { k: '3', label: 'Ir a Dinero' },
                { k: '4', label: 'Ir a Cerebro' },
                { k: 'F', label: 'Modo Foco (Pantalla completa)' },
                { k: 'T', label: 'Nueva Tarea rápida' },
                { k: 'R', label: 'Nueva Reunión' },
                { k: 'Esc', label: 'Cerrar panel o modal activo' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] text-xs">
                  <span className="text-[var(--text-secondary)]">{item.label}</span>
                  <kbd className="font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-primary)]">
                    {item.k}
                  </kbd>
                </div>
              ))}
            </div>

            {onRepairTaskLinks && (
              <div className="pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.medium();
                    onRepairTaskLinks();
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Link2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Reparar vínculos entre tareas y clientes</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sub-section 7: Sincronización */}
        {activeSection === 'sincronizacion' && (
          <div className="card-swiss p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
              Sincronización Cloud y Copias de Seguridad
            </h2>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-xs">
                <div>
                  <span className="font-semibold text-[var(--text-primary)] block">Estado de conexión Firestore</span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {syncStatus === 'synced' ? 'Sincronizado en tiempo real' : 'Sincronizando cambios...'}
                  </span>
                </div>
                {onForceSync && (
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.light();
                      onForceSync();
                    }}
                    className="min-h-[44px] px-3 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Forzar sync</span>
                  </button>
                )}
              </div>

              {/* Backups */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {onExportJSON && (
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.medium();
                      onExportJSON();
                    }}
                    className="min-h-[44px] p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-left flex items-center gap-2.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-[var(--text-primary)] block">Descargar copia JSON</span>
                      <span className="text-[10px] text-[var(--text-secondary)] block">Respaldo completo de la app</span>
                    </div>
                  </button>
                )}

                {onExportCSV && (
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.medium();
                      onExportCSV();
                    }}
                    className="min-h-[44px] p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-left flex items-center gap-2.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-blue-500 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-[var(--text-primary)] block">Exportar a CSV</span>
                      <span className="text-[10px] text-[var(--text-secondary)] block">Para Excel o Google Sheets</span>
                    </div>
                  </button>
                )}
              </div>

              {/* Import */}
              {onImportJSON && (
                <div className="pt-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onImportJSON(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] w-full p-3 rounded-[var(--radius-control)] border border-dashed border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] text-xs text-center flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span>Restaurar copia desde archivo JSON</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sub-section 8: Personalizar (ETAPA 5) */}
        {activeSection === 'personalizar' && (
          <div className="card-swiss p-4 sm:p-5 space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
                Personalizar Experiencia (.Cero)
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Ocultá o mostrá sectores y bloques sin perder ningún dato. Todos los cambios se guardan al instante.
              </p>
            </div>

            {/* Grupo 0: Tema Visual */}
            {onToggleTheme && (
              <div className="space-y-3 pb-3 border-b border-[var(--border-subtle)]">
                <span className="text-xs font-semibold text-[var(--text-primary)] block font-heading">
                  Tema visual de la aplicación
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]">
                  <div className="flex items-center gap-2.5">
                    {theme === 'dark' ? (
                      <Moon className="w-4 h-4 text-sky-400 shrink-0" />
                    ) : (
                      <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <div>
                      <span className="text-xs font-semibold text-[var(--text-primary)] block">
                        {theme === 'dark' ? 'Modo Oscuro (.Cero)' : 'Modo Claro (Swiss Minimal)'}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)] block">
                        Ajusta el fondo, contraste tipográfico y estética general
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="btn-solid-primary px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95 transition shrink-0 self-start sm:self-auto"
                  >
                    Cambiar a {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                  </button>
                </div>
              </div>
            )}

            {/* Grupo 1: Sectores Completos */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-[var(--text-primary)] block font-heading">
                1. Sectores de la navegación
              </span>

              <div className="space-y-2">
                {[
                  { key: 'hideCerebro' as const, label: 'Ocultar sector 2° Cerebro (Notas y Grafo)' },
                  { key: 'hideDineroPersonal' as const, label: 'Ocultar módulo de Finanzas Personales (dejar solo Estudio)' },
                  { key: 'hideCalendarioMes' as const, label: 'Ocultar vista Calendario Mensual en Hoy' },
                  { key: 'hideVistasEisenhowerKanban' as const, label: 'Ocultar vistas Eisenhower y Kanban' },
                ].map((item) => (
                  <div 
                    key={item.key}
                    onClick={() => handleTogglePref(item.key)}
                    className="flex items-center justify-between p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] cursor-pointer select-none"
                  >
                    <span className="text-xs text-[var(--text-primary)]">{item.label}</span>
                    <button
                      type="button"
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        prefs[item.key] ? 'bg-[var(--solid-contrast-bg)]' : 'bg-[var(--border-subtle)]'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-[var(--bg-surface)] absolute top-1 transition-transform ${
                        prefs[item.key] ? 'left-6' : 'left-1'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Grupo 2: Bloques de la pantalla Hoy */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-[var(--text-primary)] block font-heading">
                2. Bloques visibles en pantalla Hoy
              </span>

              <div className="space-y-2">
                {[
                  { key: 'hideHoyFocoBanner' as const, label: 'Ocultar "Lo más importante hoy"' },
                  { key: 'hideHoyAtrasadas' as const, label: 'Ocultar bloque de Tareas Atrasadas' },
                  { key: 'hideHoyInbox' as const, label: 'Ocultar bloque de Inbox sin fecha' },
                  { key: 'hideHoyObjetivos' as const, label: 'Ocultar Objetivos de la semana' },
                  { key: 'hideHoyTiempo' as const, label: 'Ocultar Presupuesto de tiempo' },
                ].map((item) => (
                  <div 
                    key={item.key}
                    onClick={() => handleTogglePref(item.key)}
                    className="flex items-center justify-between p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] cursor-pointer select-none"
                  >
                    <span className="text-xs text-[var(--text-primary)]">{item.label}</span>
                    <button
                      type="button"
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        prefs[item.key] ? 'bg-[var(--solid-contrast-bg)]' : 'bg-[var(--border-subtle)]'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-[var(--bg-surface)] absolute top-1 transition-transform ${
                        prefs[item.key] ? 'left-6' : 'left-1'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Grupo 3: Reordenar Bloques de la Pantalla Hoy */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-[var(--text-primary)] block font-heading">
                3. Orden de los bloques en Hoy (Subir / Bajar)
              </span>

              <div className="card-swiss divide-y divide-[var(--border-subtle)] overflow-hidden">
                {prefs.hoyBlocksOrder.map((blockId, idx) => (
                  <div key={blockId} className="p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-[11px] text-[var(--text-tertiary)] w-4">
                        {idx + 1}.
                      </span>
                      <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {HOY_BLOCK_LABELS[blockId] || blockId}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveBlock(idx, 'up')}
                        className="min-h-[44px] min-w-[36px] sm:min-h-[28px] sm:min-w-[28px] p-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                        title="Subir"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === prefs.hoyBlocksOrder.length - 1}
                        onClick={() => handleMoveBlock(idx, 'down')}
                        className="min-h-[44px] min-w-[36px] sm:min-h-[28px] sm:min-w-[28px] p-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                        title="Bajar"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
