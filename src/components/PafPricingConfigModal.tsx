import React, { useState } from 'react';
import { ModalPortal } from './ModalPortal';
import { 
  PafPricingSettings, 
  PafTierPricingConfig, 
  getStoredPafPricingSettings, 
  saveStoredPafPricingSettings, 
  savePafPricingToFirestore, 
  DEFAULT_PAF_PRICING_SETTINGS,
  getComputedPafPlans
} from '../utils/pafPricingConfig';
import { hapticFeedback } from '../utils/haptics';
import { 
  DollarSign, 
  X, 
  Check, 
  RotateCcw, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight,
  Calculator,
  Percent
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (settings: PafPricingSettings) => void;
}

export const PafPricingConfigModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [settings, setSettings] = useState<PafPricingSettings>(() => getStoredPafPricingSettings());
  const [activeTier, setActiveTier] = useState<'pro' | 'base'>('pro');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const currentTierConfig = activeTier === 'pro' ? settings.pro : settings.base;
  const isPro = activeTier === 'pro';

  const updateTierField = <K extends keyof PafTierPricingConfig>(
    field: K,
    val: PafTierPricingConfig[K]
  ) => {
    setSettings(prev => ({
      ...prev,
      [activeTier]: {
        ...prev[activeTier],
        [field]: val,
      },
    }));
  };

  // Helper when changing 2 payments installment: automatically recalculates total
  const handleTwoPaymentsInstallmentChange = (amount: number) => {
    setSettings(prev => ({
      ...prev,
      [activeTier]: {
        ...prev[activeTier],
        twoPaymentsInstallment: amount,
        twoPaymentsTotal: amount * 2,
      },
    }));
  };

  // Helper when changing 3 payments installment: automatically recalculates total
  const handleThreePaymentsInstallmentChange = (amount: number) => {
    setSettings(prev => ({
      ...prev,
      [activeTier]: {
        ...prev[activeTier],
        threePaymentsInstallment: amount,
        threePaymentsTotal: amount * 3,
      },
    }));
  };

  const handleResetDefaults = () => {
    hapticFeedback.medium();
    setSettings(DEFAULT_PAF_PRICING_SETTINGS);
  };

  const handleSave = async () => {
    setIsSaving(true);
    hapticFeedback.success();
    const updated: PafPricingSettings = {
      ...settings,
      updatedAt: new Date().toISOString(),
    };

    saveStoredPafPricingSettings(updated);
    await savePafPricingToFirestore(updated);

    setIsSaving(false);
    onSaved?.(updated);
    onClose();
  };

  const previewPlans = getComputedPafPlans(isPro ? 'paf_pro' : 'paf_base', settings);
  const curSymbol = currentTierConfig.currency === 'USD' ? 'US$' : '$';

  return (
    <ModalPortal>
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="relative w-full max-w-2xl bg-[#121826] border border-[#263047] rounded-3xl shadow-2xl overflow-hidden my-auto text-zinc-100 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#263047] bg-[#0B0F17]/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D45B9E]/15 border border-[#D45B9E]/30 text-[#D45B9E] flex items-center justify-center shadow-inner">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#E8ECF4] flex items-center gap-2">
                <span>Configuración de Precios y Cuotas PAF</span>
              </h3>
              <p className="text-xs text-[#8B95A9]">
                Define precios al contado (upfront), valor de cada cuota y recargos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1A2233] hover:bg-[#263047] text-[#8B95A9] hover:text-zinc-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Plan Tier Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#1A2233] rounded-2xl border border-[#263047]">
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setActiveTier('pro');
              }}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTier === 'pro'
                  ? 'bg-gradient-to-r from-[#D45B9E] to-[#A0407A] text-white shadow-md shadow-[#D45B9E]/20'
                  : 'text-[#8B95A9] hover:text-[#E8ECF4]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>⭐ Plan PAF Pro (12 Semanas)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setActiveTier('base');
              }}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTier === 'base'
                  ? 'bg-gradient-to-r from-[#4C8DFF] to-[#3B7BF0] text-white shadow-md shadow-[#4C8DFF]/20'
                  : 'text-[#8B95A9] hover:text-[#E8ECF4]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>🛡️ Plan PAF Base</span>
            </button>
          </div>

          {/* Currency Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#1A2233]/70 border border-[#263047]">
            <div>
              <span className="text-xs font-bold text-[#E8ECF4]">Moneda para {isPro ? 'Plan Pro' : 'Plan Base'}</span>
              <p className="text-[11px] text-[#8B95A9]">Moneda por defecto en que cotizas esta modalidad</p>
            </div>
            <div className="flex items-center gap-1 bg-[#121826] p-1 rounded-xl border border-[#263047]">
              <button
                type="button"
                onClick={() => updateTierField('currency', 'ARS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  currentTierConfig.currency === 'ARS'
                    ? 'bg-[#34C38F] text-[#0B0F17]'
                    : 'text-[#8B95A9] hover:text-[#E8ECF4]'
                }`}
              >
                ARS ($)
              </button>
              <button
                type="button"
                onClick={() => updateTierField('currency', 'USD')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  currentTierConfig.currency === 'USD'
                    ? 'bg-[#34C38F] text-[#0B0F17]'
                    : 'text-[#8B95A9] hover:text-[#E8ECF4]'
                }`}
              >
                USD (US$)
              </button>
            </div>
          </div>

          {/* Pricing Config Form */}
          <div className="space-y-4">
            {/* 1. UPFRONT PRICE */}
            <div className="p-4 rounded-2xl bg-[#1A2233] border border-[#263047] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#E8ECF4] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#34C38F]" />
                  <span>1 Pago Único / Upfront (Contado al inicio)</span>
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#34C38F]/20 text-[#34C38F] font-bold">
                  Tarifa Bonificada
                </span>
              </div>
              <p className="text-[11px] text-[#8B95A9]">
                Monto total que abona el cliente si paga el 100% por adelantado al iniciar el programa.
              </p>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#8B95A9]">
                  {curSymbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step={currentTierConfig.currency === 'USD' ? '50' : '10000'}
                  value={currentTierConfig.upfrontPrice || ''}
                  onChange={(e) => updateTierField('upfrontPrice', Math.max(0, Number(e.target.value)))}
                  className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-[#121826] border border-[#263047] text-[#E8ECF4] font-mono text-sm font-bold focus:outline-none focus:border-[#34C38F]"
                  placeholder="0"
                />
              </div>
            </div>

            {/* 2. TWO PAYMENTS */}
            <div className="p-4 rounded-2xl bg-[#1A2233] border border-[#263047] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#E8ECF4] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#4C8DFF]" />
                  <span>Plan 2 Pagos (Doble Cuota)</span>
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#4C8DFF]/20 text-[#4C8DFF] font-bold">
                  Día 0 + Día 30
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-[#8B95A9] block mb-1">
                    Monto de CADA cuota (x2)
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8B95A9]">
                      {curSymbol}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step={currentTierConfig.currency === 'USD' ? '25' : '10000'}
                      value={currentTierConfig.twoPaymentsInstallment || ''}
                      onChange={(e) => handleTwoPaymentsInstallmentChange(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#121826] border border-[#263047] text-[#E8ECF4] font-mono text-xs font-bold focus:outline-none focus:border-[#4C8DFF]"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-[#8B95A9] block mb-1">
                    Monto TOTAL del plan (2 cuotas)
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8B95A9]">
                      {curSymbol}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={currentTierConfig.twoPaymentsTotal || ''}
                      onChange={(e) => updateTierField('twoPaymentsTotal', Math.max(0, Number(e.target.value)))}
                      className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#121826] border border-[#263047] text-[#E8ECF4] font-mono text-xs font-bold focus:outline-none focus:border-[#4C8DFF]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#8B95A9] pt-1">
                <span>Total: 2 cuotas de {curSymbol} {(currentTierConfig.twoPaymentsInstallment || 0).toLocaleString('es-AR')}</span>
                <span className="text-[#E9C46A] font-semibold">
                  {currentTierConfig.twoPaymentsTotal > currentTierConfig.upfrontPrice
                    ? `+${curSymbol} ${(currentTierConfig.twoPaymentsTotal - currentTierConfig.upfrontPrice).toLocaleString('es-AR')} vs Upfront`
                    : 'Sin recargo'}
                </span>
              </div>
            </div>

            {/* 3. THREE PAYMENTS */}
            <div className="p-4 rounded-2xl bg-[#1A2233] border border-[#263047] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#E8ECF4] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#D45B9E]" />
                  <span>Plan 3 Pagos (Trimestral)</span>
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D45B9E]/20 text-[#D45B9E] font-bold">
                  Mes 1 + Mes 2 + Mes 3
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-[#8B95A9] block mb-1">
                    Monto de CADA cuota (x3)
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8B95A9]">
                      {curSymbol}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step={currentTierConfig.currency === 'USD' ? '25' : '10000'}
                      value={currentTierConfig.threePaymentsInstallment || ''}
                      onChange={(e) => handleThreePaymentsInstallmentChange(Math.max(0, Number(e.target.value)))}
                      className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#121826] border border-[#263047] text-[#E8ECF4] font-mono text-xs font-bold focus:outline-none focus:border-[#D45B9E]"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-[#8B95A9] block mb-1">
                    Monto TOTAL del plan (3 cuotas)
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8B95A9]">
                      {curSymbol}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={currentTierConfig.threePaymentsTotal || ''}
                      onChange={(e) => updateTierField('threePaymentsTotal', Math.max(0, Number(e.target.value)))}
                      className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#121826] border border-[#263047] text-[#E8ECF4] font-mono text-xs font-bold focus:outline-none focus:border-[#D45B9E]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#8B95A9] pt-1">
                <span>Total: 3 cuotas de {curSymbol} {(currentTierConfig.threePaymentsInstallment || 0).toLocaleString('es-AR')}</span>
                <span className="text-[#E9C46A] font-semibold">
                  {currentTierConfig.threePaymentsTotal > currentTierConfig.upfrontPrice
                    ? `+${curSymbol} ${(currentTierConfig.threePaymentsTotal - currentTierConfig.upfrontPrice).toLocaleString('es-AR')} vs Upfront`
                    : 'Sin recargo'}
                </span>
              </div>
            </div>
          </div>

          {/* LIVE PREVIEW BOX */}
          <div className="p-4 rounded-2xl bg-[#0B0F17] border border-[#263047] space-y-3">
            <span className="text-xs font-bold text-[#8B95A9] uppercase tracking-wider block">
              Vista Previa de Opciones Comerciales en {isPro ? 'PAF Pro' : 'PAF Base'}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {previewPlans.map((plan) => (
                <div 
                  key={plan.id}
                  className="p-3 rounded-xl bg-[#1A2233] border border-[#263047] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-[#E8ECF4]">{plan.name}</span>
                      {plan.badge && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#34C38F]/20 text-[#34C38F] font-bold">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold font-mono text-[#34C38F]">
                      {plan.installments === 1 
                        ? `${curSymbol} ${plan.totalAmount.toLocaleString('es-AR')}`
                        : `${plan.installments}x ${curSymbol} ${plan.installmentAmount.toLocaleString('es-AR')}`
                      }
                    </div>
                  </div>
                  <div className="text-[10px] text-[#8B95A9] mt-2 pt-1 border-t border-[#263047]/60">
                    Total: {curSymbol} {plan.totalAmount.toLocaleString('es-AR')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#263047] bg-[#0B0F17]/90 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#8B95A9] hover:text-[#E8ECF4] hover:bg-[#1A2233] flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8B95A9] hover:text-[#E8ECF4] hover:bg-[#1A2233] transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#34C38F] hover:bg-[#2DB382] text-[#0B0F17] flex items-center gap-1.5 shadow-md shadow-[#34C38F]/20 transition cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Guardando…' : 'Guardar Precios'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </ModalPortal>
);
};
