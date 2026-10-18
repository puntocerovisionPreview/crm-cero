import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { IncomeRecord, Project } from '../types';
import { getCollectedEntries, monthMatcher } from '../utils/ledger';
import { money, weeklyCollections } from '../utils/periodic';
import { getAuthHeaders } from '../utils/authAccess';
import { ThinLineChart } from './ThinLineChart';

interface Props {
  projects: Project[];
  incomes: IncomeRecord[];
  today: string;
  privacyMode?: boolean;
  onOpen: () => void;
}

interface Balance {
  available: number;
  currency: 'ARS' | 'USD';
}

const MONTHS = 6;

const monthKeys = (today: string) => {
  const [y, m] = today.split('-').map(Number);
  return Array.from({ length: MONTHS }, (_, i) => {
    const d = new Date(y, m - 1 - (MONTHS - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
};

const shortMonth = (key: string) => new Date(`${key}-15T12:00:00`).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');

const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');

// Dinero en el Inicio, en una sola tarjeta: saldo de Mercado Pago, último cobro
// y la línea de lo cobrado en los últimos meses. El detalle vive en /dinero.
export const HomeMoneyCard: React.FC<Props> = ({ projects, incomes, today, privacyMode, onOpen }) => {
  const [balance, setBalance] = useState<Balance | null | 'error'>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/mercadopago/balance', { headers: { ...(await getAuthHeaders()) } });
        if (!res.ok) throw new Error(String(res.status));
        const b = await res.json();
        if (alive) setBalance({ available: Number(b.available) || 0, currency: b.currency === 'USD' ? 'USD' : 'ARS' });
      } catch {
        if (alive) setBalance('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const { lastPayment, series, dueCount, dueTotal } = useMemo(() => {
    const keys = monthKeys(today);
    const all = getCollectedEntries(incomes, projects, d => Boolean(d && d <= today && d.slice(0, 7) >= keys[0]));
    const lastPayment = [...getCollectedEntries(incomes, projects, d => Boolean(d && d <= today))]
      .filter(e => e.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const series = keys.map(k => ({
      label: shortMonth(k),
      value: all.filter(e => e.currency === 'ARS' && monthMatcher(k)(e.date)).reduce((s, e) => s + e.amount, 0),
    }));
    const due = weeklyCollections(projects, incomes, today).filter(i => i.currency === 'ARS');
    return { lastPayment, series, dueCount: due.length, dueTotal: due.reduce((s, i) => s + i.amount, 0) };
  }, [projects, incomes, today]);

  const hide = (s: string) => (privacyMode ? '••••' : s);
  const compact = (n: number) => (privacyMode ? '••••' : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M` : `$${Math.round(n / 1000)}k`);

  return (
    <section className="card-swiss p-5 grid grid-cols-1 md:grid-cols-[1fr_1.1fr] gap-5" aria-labelledby="home-dinero-title">
      <div className="flex flex-col gap-4 min-w-0">
        <button type="button" onClick={onOpen} className="flex items-center gap-1 text-left cursor-pointer group">
          <h2 id="home-dinero-title" className="text-[22px] font-light tracking-tight text-[var(--text-primary)] leading-tight">
            Dinero
          </h2>
          <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition-transform" aria-hidden />
        </button>

        <dl className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <dt className="text-[12px] text-[var(--text-tertiary)]">En Mercado Pago</dt>
            <dd className="text-[26px] font-light tracking-tight tabular-nums text-[var(--text-primary)] leading-tight truncate">
              {balance === null ? '…' : balance === 'error' ? '—' : hide(money(balance.available, balance.currency))}
            </dd>
            {balance === 'error' && <dd className="text-[12px] text-[var(--text-tertiary)]">Saldo no disponible</dd>}
          </div>
          <div className="min-w-0">
            <dt className="text-[12px] text-[var(--text-tertiary)]">Último cobro</dt>
            {lastPayment ? (
              <>
                <dd className="text-[26px] font-light tracking-tight tabular-nums text-[var(--semantic-green)] leading-tight truncate">
                  +{hide(money(lastPayment.amount, lastPayment.currency))}
                </dd>
                <dd className="text-[12px] text-[var(--text-secondary)] truncate">
                  {lastPayment.clientName || lastPayment.title} · {shortDate(lastPayment.date)}
                </dd>
              </>
            ) : (
              <dd className="text-[15px] text-[var(--text-secondary)]">Sin cobros todavía</dd>
            )}
          </div>
        </dl>

        {dueCount > 0 && (
          <button
            type="button"
            onClick={onOpen}
            className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)] text-[13px] text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] transition-colors"
          >
            <span>
              {dueCount} {dueCount === 1 ? 'cuota' : 'cuotas'} por cobrar esta semana
            </span>
            <span className="tabular-nums text-[var(--text-primary)]">{hide(money(dueTotal, 'ARS'))}</span>
          </button>
        )}
      </div>

      <div className="flex flex-col justify-end min-w-0">
        <p className="text-[12px] text-[var(--text-tertiary)] mb-1">Cobrado por mes</p>
        <ThinLineChart points={series} format={compact} title="Cobrado por mes en pesos, últimos 6 meses" height={110} />
        <div className="flex justify-between mt-1.5 text-[11px] text-[var(--text-tertiary)] tabular-nums" aria-hidden>
          {series.map(p => (
            <span key={p.label}>{p.label}</span>
          ))}
        </div>
      </div>
    </section>
  );
};
