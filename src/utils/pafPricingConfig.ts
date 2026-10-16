import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { loadFromStorage, saveToStorage } from './storage';

export interface PafTierPricingConfig {
  currency: 'ARS' | 'USD';
  upfrontPrice: number; // Precio al contado / 1 pago
  twoPaymentsInstallment: number; // Monto por cuota en 2 pagos
  twoPaymentsTotal: number; // Total en 2 pagos (calculado o manual)
  threePaymentsInstallment: number; // Monto por cuota en 3 pagos
  threePaymentsTotal: number; // Total en 3 pagos (calculado o manual)
  consultingHours?: number;
}

export interface PafPricingSettings {
  pro: PafTierPricingConfig;
  base: PafTierPricingConfig;
  updatedAt?: string;
}

export const STORAGE_KEY_PAF_PRICING = 'cero_v3_paf_pricing_settings';

export const DEFAULT_PAF_PRICING_SETTINGS: PafPricingSettings = {
  pro: {
    currency: 'ARS',
    upfrontPrice: 1100000,
    twoPaymentsInstallment: 750000,
    twoPaymentsTotal: 1500000,
    threePaymentsInstallment: 550000,
    threePaymentsTotal: 1650000,
    consultingHours: 26,
  },
  base: {
    currency: 'ARS',
    upfrontPrice: 800000,
    twoPaymentsInstallment: 460000,
    twoPaymentsTotal: 920000,
    threePaymentsInstallment: 370000,
    threePaymentsTotal: 1110000,
    consultingHours: 8,
  },
};

/**
 * Loads PAF pricing settings from localStorage, or returns default baseline
 */
export function getStoredPafPricingSettings(): PafPricingSettings {
  const loaded = loadFromStorage<PafPricingSettings | null>(STORAGE_KEY_PAF_PRICING, null);
  if (!loaded || !loaded.pro || !loaded.base) {
    return DEFAULT_PAF_PRICING_SETTINGS;
  }
  return {
    pro: { ...DEFAULT_PAF_PRICING_SETTINGS.pro, ...loaded.pro },
    base: { ...DEFAULT_PAF_PRICING_SETTINGS.base, ...loaded.base },
    updatedAt: loaded.updatedAt,
  };
}

/**
 * Saves PAF pricing settings to localStorage and notifies listeners
 */
export function saveStoredPafPricingSettings(settings: PafPricingSettings): void {
  saveToStorage(STORAGE_KEY_PAF_PRICING, settings);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('paf-pricing-updated', { detail: settings }));
  }
}

/**
 * Syncs settings to Firestore under `settings/paf_pricing`
 */
export async function savePafPricingToFirestore(settings: PafPricingSettings): Promise<void> {
  try {
    const ref = doc(db, 'settings', 'paf_pricing');
    await setDoc(ref, {
      ...settings,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Error saving PAF pricing to Firestore:', err);
  }
}

/**
 * Subscribes to real-time updates for PAF pricing in Firestore
 */
export function subscribePafPricing(
  onUpdate: (settings: PafPricingSettings) => void
): () => void {
  const ref = doc(db, 'settings', 'paf_pricing');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as PafPricingSettings;
        if (data.pro && data.base) {
          const merged: PafPricingSettings = {
            pro: { ...DEFAULT_PAF_PRICING_SETTINGS.pro, ...data.pro },
            base: { ...DEFAULT_PAF_PRICING_SETTINGS.base, ...data.base },
            updatedAt: data.updatedAt,
          };
          saveStoredPafPricingSettings(merged);
          onUpdate(merged);
        }
      }
    },
    (err) => {
      console.warn('Firestore subscription note for PAF pricing:', err);
    }
  );
}

export interface ComputedPafOption {
  id: '1_pago' | '2_pagos' | '3_pagos';
  name: string;
  installments: number;
  installmentAmount: number;
  totalAmount: number;
  currency: 'ARS' | 'USD';
  badge?: string;
  description: string;
}

/**
 * Resolves the 3 plans (1 pago, 2 pagos, 3 pagos) for a given tier based on user-configured pricing
 */
export function getComputedPafPlans(
  tier: 'paf_pro' | 'paf_base',
  customSettings?: PafPricingSettings
): ComputedPafOption[] {
  const settings = customSettings || getStoredPafPricingSettings();
  const config = tier === 'paf_pro' ? settings.pro : settings.base;
  const isPro = tier === 'paf_pro';
  const cur = config.currency || 'ARS';
  const prefix = cur === 'USD' ? 'US$' : '$';

  const diff2 = Math.max(0, config.twoPaymentsTotal - config.upfrontPrice);
  const diff3 = Math.max(0, config.threePaymentsTotal - config.upfrontPrice);

  return [
    {
      id: '1_pago',
      name: '1 Pago Único (Upfront)',
      installments: 1,
      installmentAmount: config.upfrontPrice,
      totalAmount: config.upfrontPrice,
      currency: cur,
      badge: isPro ? '⭐ Máximo Ahorro' : 'Contado',
      description: `Pago 100% anticipado al inicio (${prefix} ${config.upfrontPrice.toLocaleString('es-AR')}).`,
    },
    {
      id: '2_pagos',
      name: 'Plan 2 Pagos',
      installments: 2,
      installmentAmount: config.twoPaymentsInstallment,
      totalAmount: config.twoPaymentsTotal,
      currency: cur,
      badge: diff2 > 0 ? `+${prefix}${diff2.toLocaleString('es-AR')} recargo` : undefined,
      description: `2 cuotas de ${prefix} ${config.twoPaymentsInstallment.toLocaleString('es-AR')} (Total: ${prefix} ${config.twoPaymentsTotal.toLocaleString('es-AR')}).`,
    },
    {
      id: '3_pagos',
      name: 'Plan 3 Pagos',
      installments: 3,
      installmentAmount: config.threePaymentsInstallment,
      totalAmount: config.threePaymentsTotal,
      currency: cur,
      badge: diff3 > 0 ? `+${prefix}${diff3.toLocaleString('es-AR')} recargo` : undefined,
      description: `3 cuotas de ${prefix} ${config.threePaymentsInstallment.toLocaleString('es-AR')} mensuales (Total: ${prefix} ${config.threePaymentsTotal.toLocaleString('es-AR')}).`,
    },
  ];
}
