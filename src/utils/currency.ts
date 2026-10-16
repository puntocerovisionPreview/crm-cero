import { useEffect, useState } from 'react';

// Valor de respaldo único si no hay cotización automática ni manual
// (antes había 1200 y 1250 repartidos por la app).
export const DEFAULT_USD_RATE = 1250;

export type UsdRateSource = 'blue' | 'mep' | 'oficial' | 'manual';

export const USD_RATE_SOURCE_LABELS: Record<UsdRateSource, string> = {
  blue: 'Dólar blue (automático)',
  mep: 'Dólar MEP (automático)',
  oficial: 'Dólar oficial (automático)',
  manual: 'Manual',
};

export interface UsdRates {
  blue?: number;
  mep?: number;
  oficial?: number;
  updatedAt?: string;
}

const CACHE_KEY = 'cero_usd_rates_cache';

function readCache(): UsdRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Cotizaciones del día (precio de compra: lo que recibís al vender dólares).
// Se piden al servidor (/api/dolar), que cachea dolarapi.com; si falla, queda la última conocida.
export function useUsdRates(): UsdRates | null {
  const [rates, setRates] = useState<UsdRates | null>(() => readCache());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/dolar');
        if (!res.ok) return;
        const data: UsdRates = await res.json();
        if (cancelled || !data.blue) return;
        setRates(data);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch {}
      } catch {
        // sin conexión: se usa la última cotización guardada
      }
    };
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return rates;
}

export function resolveUsdRate(source: UsdRateSource | undefined, rates: UsdRates | null, manualRate?: number): number {
  const effectiveSource = source || 'blue';
  if (effectiveSource !== 'manual') {
    const auto = rates?.[effectiveSource];
    if (auto && auto > 0) return auto;
  }
  return manualRate && manualRate > 0 ? manualRate : DEFAULT_USD_RATE;
}
