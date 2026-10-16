import React, { useState } from 'react';
import { StudioPaymentSettings } from '../types';
import { X, Check, CreditCard, Building2, Link2, ShieldCheck, Sparkles } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { playItemCreated } from '../utils/sound';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: StudioPaymentSettings;
  onSave: (settings: StudioPaymentSettings) => void;
}

export const StudioPaymentSettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [accountHolder, setAccountHolder] = useState(settings.accountHolder || '');
  const [aliasArs, setAliasArs] = useState(settings.aliasArs || '');
  const [cbuArs, setCbuArs] = useState(settings.cbuArs || '');
  const [aliasUsd, setAliasUsd] = useState(settings.aliasUsd || '');
  const [cbuUsd, setCbuUsd] = useState(settings.cbuUsd || '');
  const [paymentLink, setPaymentLink] = useState(settings.paymentLink || '');
  const [usdtAddress, setUsdtAddress] = useState(settings.usdtAddress || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    hapticFeedback.success();
    playItemCreated();

    onSave({
      ...settings,
      accountHolder: accountHolder.trim() || undefined,
      aliasArs: aliasArs.trim() || undefined,
      cbuArs: cbuArs.trim() || undefined,
      aliasUsd: aliasUsd.trim() || undefined,
      cbuUsd: cbuUsd.trim() || undefined,
      paymentLink: paymentLink.trim() || undefined,
      usdtAddress: usdtAddress.trim() || undefined,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="w-full max-w-md bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
              Cobranzas & WhatsApp
            </span>
            <h3 className="text-base font-bold text-[var(--text-primary)] font-heading">
              Datos de Cobro del Estudio
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
          <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">
            Estos datos se incluirán automáticamente en el mensaje de cobro por WhatsApp para que los clientes puedan transferirte sin demoras.
          </p>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-primary)]">
              Nombre del Titular / Razón Social
            </label>
            <input
              type="text"
              placeholder="Ej. Juan Pérez"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
            />
          </div>

          {/* Pesos ARS */}
          <div className="p-3 rounded-xl bg-[var(--bg-surface-muted)]/60 border border-[var(--border-subtle)] space-y-2.5">
            <div className="font-bold text-[var(--text-primary)] text-[11px] flex items-center gap-1.5">
              <span>🇦🇷 Cobros en Pesos (ARS)</span>
            </div>

            <div className="space-y-1">
              <label className="text-[10.5px] font-medium text-[var(--text-secondary)]">Alias ARS</label>
              <input
                type="text"
                placeholder="Ej. punto.cero.mp"
                value={aliasArs}
                onChange={(e) => setAliasArs(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10.5px] font-medium text-[var(--text-secondary)]">CBU / CVU ARS</label>
              <input
                type="text"
                placeholder="00000031000..."
                value={cbuArs}
                onChange={(e) => setCbuArs(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>

          {/* Dólares USD */}
          <div className="p-3 rounded-xl bg-[var(--bg-surface-muted)]/60 border border-[var(--border-subtle)] space-y-2.5">
            <div className="font-bold text-[var(--text-primary)] text-[11px] flex items-center gap-1.5">
              <span>🇺🇸 Cobros en Dólares (USD / Cripto)</span>
            </div>

            <div className="space-y-1">
              <label className="text-[10.5px] font-medium text-[var(--text-secondary)]">Alias / Cuenta USD</label>
              <input
                type="text"
                placeholder="Ej. punto.cero.usd"
                value={aliasUsd}
                onChange={(e) => setAliasUsd(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10.5px] font-medium text-[var(--text-secondary)]">CBU USD / Swift / IBAN</label>
              <input
                type="text"
                placeholder="CBU en dólares o cuenta del exterior"
                value={cbuUsd}
                onChange={(e) => setCbuUsd(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10.5px] font-medium text-[var(--text-secondary)]">Billetera USDT (TRC20 / Polygon)</label>
              <input
                type="text"
                placeholder="Dirección USDT opcional"
                value={usdtAddress}
                onChange={(e) => setUsdtAddress(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-[11px] text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>

          {/* Link de pago */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-primary)]">
              Link de cobro directo (MercadoPago / Stripe / Lemon)
            </label>
            <input
              type="url"
              placeholder="https://mpago.la/..."
              value={paymentLink}
              onChange={(e) => setPaymentLink(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] font-medium text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl btn-solid-primary font-semibold text-xs flex items-center gap-1.5 shadow-md active:scale-98 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Datos</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
