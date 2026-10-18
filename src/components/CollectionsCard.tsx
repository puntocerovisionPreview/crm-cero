import React, { useMemo, useState } from 'react';
import { Banknote, MessageCircle } from 'lucide-react';
import { IncomeRecord, Project, StudioPaymentSettings } from '../types';
import { collectionMessage, money, weeklyCollections } from '../utils/periodic';
import { whatsappLink } from '../utils/coldClients';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  projects: Project[];
  incomes: IncomeRecord[];
  today: string;
  settings?: StudioPaymentSettings;
  privacyMode?: boolean;
  onRegisterPayment: (projectId: string) => void;
}

const when = (dueDate: string, today: string, daysLate: number) => {
  if (daysLate > 0) return `venció hace ${daysLate} ${daysLate === 1 ? 'día' : 'días'}`;
  if (dueDate === today) return 'vence hoy';
  return `vence el ${new Date(`${dueDate}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}`;
};

// Cobranza de la semana: lo que vence en 7 días (y lo vencido), con el WhatsApp ya armado
export const CollectionsCard: React.FC<Props> = ({ projects, incomes, today, settings, privacyMode, onRegisterPayment }) => {
  const items = useMemo(() => weeklyCollections(projects, incomes, today), [projects, incomes, today]);
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0) return null;

  const totals = { ARS: 0, USD: 0 } as Record<'ARS' | 'USD', number>;
  items.forEach(i => (totals[i.currency] += i.amount));
  const list = showAll ? items : items.slice(0, 5);

  return (
    <section className="card-swiss p-5 space-y-3" aria-labelledby="cobranza-title">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-[10px] bg-[#34C759] text-white flex items-center justify-center shrink-0" aria-hidden>
          <Banknote className="w-[18px] h-[18px]" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 id="cobranza-title" className="text-[17px] font-semibold text-[var(--text-primary)] leading-tight">Cobranza de la semana</h2>
          <p className="text-[13px] text-[var(--text-secondary)] tabular-nums">
            {privacyMode ? '••••' : [totals.ARS ? money(totals.ARS, 'ARS') : '', totals.USD ? money(totals.USD, 'USD') : ''].filter(Boolean).join(' + ')} por cobrar en {items.length}{' '}
            {items.length === 1 ? 'cuota' : 'cuotas'}
          </p>
        </div>
      </div>

      <ul className="rounded-[12px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)] overflow-hidden">
        {list.map(item => {
          const wa = whatsappLink(item.phone);
          return (
            <li key={item.key} className="px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex-1 min-w-[150px]">
                <p className="text-[15px] text-[var(--text-primary)] truncate">
                  {item.clientName}
                  <span className="ml-1.5 font-semibold tabular-nums">{privacyMode ? '••••' : money(item.amount, item.currency)}</span>
                </p>
                <p className={`text-[12px] ${item.daysLate > 0 ? 'text-[var(--semantic-red)] font-medium' : 'text-[var(--text-tertiary)]'}`}>
                  {item.title} · {when(item.dueDate, today, item.daysLate)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {wa && (
                  <a
                    href={`${wa}?text=${encodeURIComponent(collectionMessage(item, settings))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => hapticFeedback.light()}
                    className="h-8 px-3 rounded-full bg-[#25D366] text-white text-[12px] font-semibold flex items-center gap-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5" aria-hidden />
                    Recordar
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onRegisterPayment(item.projectId)}
                  className="h-8 px-3 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-primary)] text-[12px] font-medium cursor-pointer"
                >
                  Cobrado
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > 5 && (
        <button type="button" onClick={() => setShowAll(v => !v)} className="text-[13px] text-[var(--accent)] font-medium cursor-pointer">
          {showAll ? 'Ver menos' : `Ver las ${items.length}`}
        </button>
      )}
    </section>
  );
};
