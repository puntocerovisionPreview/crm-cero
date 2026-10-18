import React, { useState } from 'react';
import { Check, MessageCircle, Plus, Snowflake } from 'lucide-react';
import type { ColdClient } from '../utils/coldClients';
import { whatsappLink } from '../utils/coldClients';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  clients: ColdClient[];
  onOpenClient: (projectId: string) => void;
  onCreateTask: (client: ColdClient) => void;
  onMarkContacted: (client: ColdClient) => void;
}

// Clientes activos que hace rato no tienen contacto (aparece solo si hay alguno)
export const ColdClientsCard: React.FC<Props> = ({ clients, onOpenClient, onCreateTask, onMarkContacted }) => {
  const [showAll, setShowAll] = useState(false);
  if (clients.length === 0) return null;
  const list = showAll ? clients : clients.slice(0, 4);

  return (
    <section className="card-swiss p-5 space-y-3" aria-labelledby="frios-title">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-[10px] bg-[#30B0C7] text-white flex items-center justify-center shrink-0" aria-hidden>
          <Snowflake className="w-[18px] h-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 id="frios-title" className="text-[17px] font-semibold text-[var(--text-primary)] leading-tight">
            {clients.length === 1 ? 'Un cliente sin contacto' : `${clients.length} clientes sin contacto`}
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)]">Un mensaje corto a tiempo evita que la relación se enfríe.</p>
        </div>
      </div>

      <ul className="rounded-[12px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)] overflow-hidden">
        {list.map(c => {
          const wa = whatsappLink(c.project.clientPhone);
          return (
            <li key={c.project.id} className="px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <button type="button" onClick={() => onOpenClient(c.project.id)} className="flex-1 min-w-[140px] text-left cursor-pointer">
                <span className="block text-[15px] font-medium text-[var(--text-primary)] truncate">{c.project.clientName}</span>
                <span className="block text-[12px] text-[var(--text-tertiary)]">
                  Hace {c.daysSince} días{c.hasTask ? ' · ya tenés la tarea' : ''}
                </span>
              </button>
              <div className="flex items-center gap-1.5">
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => hapticFeedback.light()}
                    className="h-8 px-3 rounded-full bg-[#25D366] text-white text-[12px] font-semibold flex items-center gap-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5" aria-hidden />
                    WhatsApp
                  </a>
                )}
                {!c.hasTask && (
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.light();
                      onCreateTask(c);
                    }}
                    className="h-8 px-3 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-primary)] text-[12px] font-medium flex items-center gap-1 cursor-pointer"
                    title="Crear la tarea «Escribirle a…» para hoy"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden />
                    Tarea
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.success();
                    onMarkContacted(c);
                  }}
                  className="h-8 px-3 rounded-full text-[var(--accent)] text-[12px] font-semibold flex items-center gap-1 hover:bg-[var(--bg-surface-muted)] cursor-pointer"
                  title="Marcar que hoy hablaste con este cliente"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden />
                  Ya hablé hoy
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {clients.length > 4 && (
        <button type="button" onClick={() => setShowAll(v => !v)} className="text-[13px] text-[var(--accent)] font-medium cursor-pointer">
          {showAll ? 'Ver menos' : `Ver los ${clients.length}`}
        </button>
      )}
    </section>
  );
};
