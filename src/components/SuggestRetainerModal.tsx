import React, { useState } from 'react';
import { ModalPortal } from './ModalPortal';
import { Project, RecurringIncomePlan } from '../types';
import { X, Sparkles, Check, Repeat, DollarSign, Calendar } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { playItemCreated } from '../utils/sound';
import { getTodayString } from '../utils/storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onSaveRecurring: (plan: Omit<RecurringIncomePlan, 'id' | 'createdAt'>) => void;
}

export const SuggestRetainerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  project,
  onSaveRecurring,
}) => {
  const isUSD = project.estimatedCurrency === 'USD';
  const [amount, setAmount] = useState<string>(isUSD ? '50' : '65000');
  const [currency, setCurrency] = useState<'USD' | 'ARS'>(project.estimatedCurrency || 'USD');
  const [title, setTitle] = useState(`Mantenimiento Web & Hosting: ${project.clientName}`);
  const [billingDay, setBillingDay] = useState<'01' | '10' | '15'>('01');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    hapticFeedback.success();
    playItemCreated();

    const today = getTodayString();
    const [y, m] = today.split('-');
    const nextDueDate = `${y}-${m}-${billingDay}`;

    onSaveRecurring({
      title: title.trim() || `Mantenimiento Web: ${project.clientName}`,
      amount: Number(amount),
      currency,
      frequency: 'mensual',
      startDate: today,
      nextDueDate,
      active: true,
      projectId: project.id,
      clientName: project.clientName,
      notes: 'Activado al entregar el proyecto web',
    });

    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
        <div 
          className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-auto text-zinc-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
                ¡Proyecto Web Entregado!
              </span>
              <h3 className="text-base font-bold text-[var(--text-primary)] font-heading">
                ¿Activar Retainer / Mantenimiento?
              </h3>
            </div>
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
            Podés cobrar un abono mensual recurrente a <strong className="text-[var(--text-primary)]">{project.clientName}</strong> por hosting, cambios menores y soporte técnico. Esto genera previsibilidad de ingresos mes a mes.
          </p>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--text-primary)]">
              Concepto del abono
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--text-primary)]">
                Monto mensual
              </label>
              <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'USD' | 'ARS')}
                  className="px-2.5 bg-[var(--bg-surface-muted)] border-r border-[var(--border-subtle)] font-mono font-bold text-xs text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
                <input
                  type="number"
                  min="0"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-2.5 py-2 font-mono text-xs font-bold text-[var(--text-primary)] bg-transparent focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--text-primary)] flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[var(--text-secondary)]" />
                <span>Día de cobro</span>
              </label>
              <select
                value={billingDay}
                onChange={(e) => setBillingDay(e.target.value as any)}
                className="w-full px-2.5 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none"
              >
                <option value="01">Día 1 de cada mes</option>
                <option value="10">Día 10 de cada mes</option>
                <option value="15">Día 15 de cada mes</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] font-medium text-xs transition cursor-pointer"
            >
              No por ahora
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl btn-solid-primary font-semibold text-xs flex items-center gap-1.5 shadow-md active:scale-98 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Activar Retainer Mensual</span>
            </button>
          </div>
        </form>
        </div>
      </div>
    </ModalPortal>
  );
};
