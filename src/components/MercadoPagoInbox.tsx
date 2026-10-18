import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2, RefreshCw, Wallet } from 'lucide-react';
import { MercadoPagoIncomingPayment } from '../types';
import { getAuthHeaders } from '../utils/authAccess';

interface Props {
  pending: MercadoPagoIncomingPayment[];
  privacyMode?: boolean;
  /** Te pagaron: abre el registro (cliente, ingreso suelto o personal) */
  onRegister: (payment: MercadoPagoIncomingPayment) => void;
  /** Pagaste vos: lo anota como gasto del estudio o personal */
  onRegisterSent: (payment: MercadoPagoIncomingPayment, kind: 'estudio' | 'personal') => void;
  onIgnore: (payment: MercadoPagoIncomingPayment) => void;
}

// "17 oct · 14:32" (o solo la fecha si el pago es viejo y no guardó la hora)
const when = (p: MercadoPagoIncomingPayment) => {
  const d = new Date(p.dateTime || `${p.dateCreated}T12:00:00`);
  if (Number.isNaN(d.getTime())) return p.dateCreated;
  const day = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');
  return p.dateTime ? `${day} · ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : day;
};

const money = (n: number, c: string, privacy?: boolean) =>
  privacy ? '••••' : `${c === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`;

export const isSentPayment = (p: MercadoPagoIncomingPayment) => p.direction === 'enviado';

// Pagos de Mercado Pago sin registrar, separados en "Te pagaron" y "Pagaste vos" (aparece solo si hay alguno)
export const MercadoPagoInbox: React.FC<Props> = ({ pending, privacyMode, onRegister, onRegisterSent, onIgnore }) => {
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const received = pending.filter((p) => !isSentPayment(p));
  const sent = pending.filter(isSentPayment);

  const syncNow = async () => {
    setSyncing(true);
    setNote(null);
    try {
      const res = await fetch('/api/mercadopago/sync', { method: 'POST', headers: { ...(await getAuthHeaders()) } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      if (Array.isArray(data.payments) && data.payments.length > 0) {
        const { saveMpIncomingPayments } = await import('../utils/firestoreService');
        await saveMpIncomingPayments(data.payments);
      }
      const r = Number(data.recibidos) || 0;
      const e = Number(data.enviados) || 0;
      setNote(
        r || e
          ? [r ? `${r} ${r === 1 ? 'cobro nuevo' : 'cobros nuevos'}` : '', e ? `${e} ${e === 1 ? 'pago tuyo' : 'pagos tuyos'}` : ''].filter(Boolean).join(' y ') + '.'
          : 'No hay pagos nuevos.'
      );
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  if (pending.length === 0) return null;

  const summary = [
    received.length ? `${received.length} ${received.length === 1 ? 'cobro' : 'cobros'} para registrar` : '',
    sent.length ? `${sent.length} ${sent.length === 1 ? 'pago tuyo' : 'pagos tuyos'}` : '',
  ].filter(Boolean).join(' · ');

  return (
    <section className="mb-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] p-4 space-y-3" aria-labelledby="mp-inbox-title">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-[#009EE3]/12 text-[#009EE3] flex items-center justify-center shrink-0">
          <Wallet className="w-[18px] h-[18px]" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <h2 id="mp-inbox-title" className="text-[17px] font-semibold text-[var(--text-primary)] leading-tight">
            Mercado Pago
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)]">{summary}</p>
        </div>
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] disabled:opacity-50"
          aria-label="Buscar pagos nuevos en Mercado Pago"
          title="Buscar pagos nuevos"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <RefreshCw className="w-4 h-4" aria-hidden />}
        </button>
      </div>

      {received.length > 0 && (
        <div>
          <h3 className="px-1 pb-1.5 text-[13px] font-medium text-[var(--text-secondary)]">Te pagaron</h3>
          <ul className="rounded-[12px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)] overflow-hidden">
            {received.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-8 h-8 rounded-full bg-[var(--semantic-green-subtle)] text-[var(--semantic-green)] flex items-center justify-center shrink-0" aria-hidden>
                  <ArrowDownLeft className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[var(--semantic-green)] tabular-nums">
                    +{money(p.amount, p.currency, privacyMode)}
                    <span className="font-normal text-[var(--text-secondary)]"> de {p.payerName || p.payerEmail || 'pagador sin nombre'}</span>
                  </p>
                  <p className="text-[12px] text-[var(--text-tertiary)] truncate">
                    {when(p)}
                    {p.suggestion ? ` · ¿de ${p.suggestion.clientName}?` : p.description ? ` · ${p.description}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRegister(p)}
                  className="h-8 px-3.5 rounded-full bg-[var(--accent)] text-white text-[13px] font-semibold shrink-0"
                >
                  Registrar
                </button>
              </li>
            ))}
          </ul>
          {received.length > 5 && <p className="px-1 pt-1 text-[12px] text-[var(--text-tertiary)]">Y {received.length - 5} más.</p>}
        </div>
      )}

      {sent.length > 0 && (
        <div>
          <h3 className="px-1 pb-1.5 text-[13px] font-medium text-[var(--text-secondary)]">Pagaste vos</h3>
          <ul className="rounded-[12px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)] overflow-hidden">
            {sent.slice(0, 5).map((p) => (
              <li key={p.id} className="px-3 py-2.5 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[var(--semantic-red-subtle)] text-[var(--semantic-red)] flex items-center justify-center shrink-0" aria-hidden>
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--text-primary)] tabular-nums">
                      −{money(p.amount, p.currency, privacyMode)}
                      <span className="font-normal text-[var(--text-secondary)]"> · {p.description || 'pago con Mercado Pago'}</span>
                    </p>
                    <p className="text-[12px] text-[var(--text-tertiary)]">{when(p)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-11">
                  <button type="button" onClick={() => onRegisterSent(p, 'estudio')} className="h-7 px-3 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-primary)] text-[12px] font-medium">
                    Gasto del estudio
                  </button>
                  <button type="button" onClick={() => onRegisterSent(p, 'personal')} className="h-7 px-3 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-primary)] text-[12px] font-medium">
                    Gasto personal
                  </button>
                  <button type="button" onClick={() => onIgnore(p)} className="h-7 px-3 rounded-full text-[var(--text-secondary)] text-[12px] font-medium hover:bg-[var(--bg-surface-muted)]">
                    Ignorar
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {sent.length > 5 && <p className="px-1 pt-1 text-[12px] text-[var(--text-tertiary)]">Y {sent.length - 5} más.</p>}
        </div>
      )}

      <p role="status" aria-live="polite" className="text-[12px] text-[var(--text-secondary)] empty:hidden">
        {note || ''}
      </p>
    </section>
  );
};
