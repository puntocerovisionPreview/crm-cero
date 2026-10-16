import { addDays } from './dates';

export type PafPlanType = 1 | 2 | 3;

export interface PafPlanOption {
  paymentsCount: 1 | 2 | 3;
  installmentAmount: number;
  totalAmount: number;
  currency: 'ARS';
  name: string;
  diffVsSinglePayment: number; // Cuánto más cuesta respecto al pago único
  dueDaysOffsets: number[]; // Días desde inicio (ej: [0, 30, 60])
  note?: string;
}

export interface PricingCatalogPAF {
  referenceBasePrice: number;
  defaultConsultingHours?: number;
  getPlans: (closedOnCall?: boolean) => PafPlanOption[];
}

export const PAF_PRO_CATALOG: PricingCatalogPAF = {
  referenceBasePrice: 1500000,
  defaultConsultingHours: 26,
  getPlans: (closedOnCall = false): PafPlanOption[] => {
    const singlePrice = closedOnCall ? 1100000 : 1300000;
    return [
      {
        paymentsCount: 1,
        installmentAmount: singlePrice,
        totalAmount: singlePrice,
        currency: 'ARS',
        name: '1 Pago',
        diffVsSinglePayment: 0,
        dueDaysOffsets: [0],
        note: closedOnCall ? 'Tarifa bonificada por cierre en llamada' : 'Tarifa regular pago único',
      },
      {
        paymentsCount: 2,
        installmentAmount: 750000,
        totalAmount: 1500000,
        currency: 'ARS',
        name: '2 Pagos',
        diffVsSinglePayment: 1500000 - singlePrice,
        dueDaysOffsets: [0, 30],
      },
      {
        paymentsCount: 3,
        installmentAmount: 550000,
        totalAmount: 1650000,
        currency: 'ARS',
        name: '3 Pagos',
        diffVsSinglePayment: 1650000 - singlePrice,
        dueDaysOffsets: [0, 30, 60],
      },
    ];
  },
};

export const PAF_BASE_CATALOG: PricingCatalogPAF = {
  referenceBasePrice: 800000,
  defaultConsultingHours: undefined,
  getPlans: (): PafPlanOption[] => {
    const singlePrice = 800000;
    return [
      {
        paymentsCount: 1,
        installmentAmount: singlePrice,
        totalAmount: singlePrice,
        currency: 'ARS',
        name: '1 Pago',
        diffVsSinglePayment: 0,
        dueDaysOffsets: [0],
      },
      {
        paymentsCount: 2,
        installmentAmount: 460000,
        totalAmount: 920000,
        currency: 'ARS',
        name: '2 Pagos',
        diffVsSinglePayment: 920000 - singlePrice,
        dueDaysOffsets: [0, 30],
      },
      {
        paymentsCount: 3,
        installmentAmount: 370000,
        totalAmount: 1110000,
        currency: 'ARS',
        name: '3 Pagos',
        diffVsSinglePayment: 1110000 - singlePrice,
        dueDaysOffsets: [0, 30, 60],
      },
    ];
  },
};

export const WEB_CATALOG = {
  defaultCurrency: 'USD' as const,
  defaultPriceUSD: 450,
  defaultPriceARS: 450000,
  getPresets: (total: number, currency: 'USD' | 'ARS') => [
    {
      paymentsCount: 1 as const,
      name: '1 Pago Total (100%)',
      installments: [total],
      dueDaysOffsets: [0],
    },
    {
      paymentsCount: 2 as const,
      name: '2 Pagos (50 / 50)',
      installments: [Math.round(total / 2), Math.round(total / 2)],
      dueDaysOffsets: [0, 30],
    },
    {
      paymentsCount: 3 as const,
      name: '3 Cuotas',
      installments: [
        Math.round(total / 3),
        Math.round(total / 3),
        total - Math.round(total / 3) * 2,
      ],
      dueDaysOffsets: [0, 30, 60],
    },
  ],
};

/**
 * Formateador unificado de dinero para toda la aplicación.
 * Aplica formato estándar es-AR sin decimales para ARS o USD.
 */
export function formatCurrency(amount: number | null | undefined, currency: 'ARS' | 'USD' = 'ARS'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return currency === 'USD' ? 'US$ 0' : '$ 0';
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/**
 * Genera cuotas calculadas a partir de una fecha de inicio y una opción del catálogo.
 */
export function generateInstallmentsFromPlan(
  startDate: string,
  plan: PafPlanOption
): Array<{ id: string; number: number; dueDate: string; amount: number; currency: 'ARS'; paid: boolean }> {
  return plan.dueDaysOffsets.map((offset, idx) => ({
    id: `inst_${crypto.randomUUID()}`,
    number: idx + 1,
    dueDate: addDays(startDate, offset),
    amount: plan.installmentAmount,
    currency: 'ARS',
    paid: false,
  }));
}
