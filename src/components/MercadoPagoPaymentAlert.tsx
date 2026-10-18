import React, { useEffect, useRef } from 'react';
import { ArrowDownLeft } from 'lucide-react';
import { MercadoPagoIncomingPayment } from '../types';

interface Props {
  payment: MercadoPagoIncomingPayment | null;
  /** Cuántos cobros nuevos más hay esperando detrás de este */
  remaining: number;
  privacyMode?: boolean;
  onRegister: (payment: MercadoPagoIncomingPayment) => void;
  onLater: (payment: MercadoPagoIncomingPayment) => void;
}

const money = (n: number, c: string, privacy?: boolean) =>
  privacy ? '••••' : `${c === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`;

// Aviso en pantalla apenas entra un cobro de Mercado Pago (estilo alerta de iOS)
export const MercadoPagoPaymentAlert: React.FC<Props> = ({ payment, remaining, privacyMode, onRegister, onLater }) => {
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!payment) return;
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onLater(payment);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [payment, onLater]);

  if (!payment) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/40 backdrop-blur-[2px]" onClick={() => onLater(payment)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mp-alert-title"
        aria-describedby="mp-alert-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[320px] rounded-[22px] overflow-hidden bg-[var(--bg-surface)]/95 backdrop-blur-xl border border-[var(--border-subtle)] shadow-[var(--shadow-float)] text-center t-modal-enter"
      >
        <div className="px-5 pt-6 pb-4">
          <span className="mx-auto w-14 h-14 rounded-full bg-[var(--semantic-green-subtle)] text-[var(--semantic-green)] flex items-center justify-center" aria-hidden>
            <ArrowDownLeft className="w-7 h-7" strokeWidth={2.25} />
          </span>
          <p id="mp-alert-title" className="mt-3 text-[15px] font-semibold text-[var(--text-secondary)]">
            Te entró un pago
          </p>
          <p className="text-[34px] leading-tight font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
            {money(payment.amount, payment.currency, privacyMode)}
          </p>
          <p id="mp-alert-desc" className="mt-1 text-[14px] text-[var(--text-secondary)]">
            {payment.payerName || payment.payerEmail ? `De ${payment.payerName || payment.payerEmail}` : 'Por Mercado Pago'}
            {payment.description ? ` · ${payment.description}` : ''}
          </p>
          {payment.suggestion && (
            <p className="mt-3 text-[13px] text-[var(--text-primary)] bg-[var(--bg-surface-elevated)] rounded-[12px] px-3 py-2">
              ¿Es de <strong>{payment.suggestion.clientName}</strong>?
              <span className="block text-[12px] text-[var(--text-tertiary)]">{payment.suggestion.reason}</span>
            </p>
          )}
          {remaining > 0 && (
            <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">
              Y {remaining} {remaining === 1 ? 'cobro nuevo más' : 'cobros nuevos más'}
            </p>
          )}
        </div>
        <div className="border-t border-[var(--border-subtle)] grid grid-cols-2 divide-x divide-[var(--border-subtle)]">
          <button type="button" onClick={() => onLater(payment)} className="h-12 text-[16px] text-[var(--accent)] hover:bg-[var(--bg-surface-muted)]/50">
            Más tarde
          </button>
          <button ref={primaryRef} type="button" onClick={() => onRegister(payment)} className="h-12 text-[16px] font-semibold text-[var(--accent)] hover:bg-[var(--bg-surface-muted)]/50">
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
};
