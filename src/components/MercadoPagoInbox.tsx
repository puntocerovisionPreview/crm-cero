import React, { useState } from 'react';
import { Loader2, RefreshCw, Wallet } from 'lucide-react';
import { MercadoPagoIncomingPayment } from '../types';
import { getAuthHeaders } from '../utils/authAccess';

interface Props {
  pending: MercadoPagoIncomingPayment[];
  privacyMode?: boolean;
  onRegister: (payment: MercadoPagoIncomingPayment) => void;
}

const money = (n: number, c: string, privacy?: boolean) =>
  privacy ? '••••' : `${c === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`;

// Pagos que entraron por Mercado Pago y todavía no registraste (aparece solo si hay alguno)
export const MercadoPagoInbox: React.FC<Props> = ({ pending, privacyMode, onRegister }) => {
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const syncNow = async () => {
    setSyncing(true);
    setNote(null);
    try {
      const res = await fetch('/api/mercadopago/sync', { method: 'POST', headers: { ...(await getAuthHeaders()) } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setNote(data.nuevos ? `Encontré ${data.nuevos} ${data.nuevos === 1 ? 'pago nuevo' : 'pagos nuevos'}.` : 'No hay pagos nuevos.');
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  if (pending.length === 0) return null;

  return (
    <section className="mb-4 rounded-[var(--radius-card)] border border-sky-500/30 bg-[var(--bg-surface)] p-4 space-y-3" aria-labelledby="mp-inbox-title">
      <div className="flex items-center gap-3">
        <Wallet className="w-5 h-5 text-sky-400 shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <h2 id="mp-inbox-title" className="text-base font-semibold text-[var(--text-primary)]">
            {pending.length === 1 ? 'Un pago de Mercado Pago para registrar' : `${pending.length} pagos de Mercado Pago para registrar`}
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">Confirmá a qué corresponde cada uno y queda en el cliente, en Dinero y en tu cuenta.</p>
        </div>
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing}
          className="p-2 rounded-[var(--radius-control)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] disabled:opacity-50"
          aria-label="Buscar pagos nuevos en Mercado Pago"
          title="Buscar pagos nuevos"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <RefreshCw className="w-4 h-4" aria-hidden />}
        </button>
      </div>

      <ul className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-control)] border border-[var(--border-subtle)]">
        {pending.slice(0, 5).map((p) => (
          <li key={p.id} className="flex items-center gap-3 p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                {money(p.amount, p.currency, privacyMode)}
                <span className="font-normal text-[var(--text-secondary)]"> de {p.payerName || p.payerEmail || 'pagador sin nombre'}</span>
              </p>
              <p className="text-xs text-[var(--text-tertiary)] truncate">
                {p.dateCreated}
                {p.suggestion ? ` — ¿de ${p.suggestion.clientName}? (${p.suggestion.reason})` : p.description ? ` — ${p.description}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRegister(p)}
              className="px-3 py-1.5 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold shrink-0"
            >
              Registrar
            </button>
          </li>
        ))}
      </ul>
      {pending.length > 5 && <p className="text-xs text-[var(--text-tertiary)]">Y {pending.length - 5} más.</p>}
      <p role="status" aria-live="polite" className="text-xs text-[var(--text-secondary)] empty:hidden">
        {note || ''}
      </p>
    </section>
  );
};
