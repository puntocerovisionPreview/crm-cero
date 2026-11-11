import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import { Prospect } from '../types';
import { ProspectAction, normalizeInstagram } from '../prospecting/core';
import { BOARD_COLUMNS, BoardColumn, ClosedColumn, columnOf } from '../prospecting/board';
import { findProspects, recentlyContacted } from '../prospecting/find';
import { ReplyButton } from './ProspectConversation';
import { ProspectChatLinks } from './ProspectChatLinks';

/**
 * "¿QUIÉN TE CONTESTÓ?"
 * Te llega un mensaje por WhatsApp o Instagram: lo buscás acá por nombre, teléfono o @,
 * marcás "Me respondió" y pasa solo a la etapa que sigue. Está arriba en toda Prospección.
 */

type Act = (p: Prospect, a: ProspectAction, note?: string) => unknown;

const COL_LABEL: Record<BoardColumn | ClosedColumn, string> = {
  ...(Object.fromEntries(BOARD_COLUMNS.map((c) => [c.id, c.label])) as Record<BoardColumn, string>),
  cliente: 'Cliente',
  perdido: 'Perdido',
};

const ago = (d: string | undefined, today: string) => {
  if (!d) return '';
  const n = Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`;
};

export const ProspectFinder: React.FC<{
  prospects: Prospect[];
  today: string;
  onAct: Act;
  onMove: (p: Prospect, to: BoardColumn | ClosedColumn) => void;
  onDetail: (p: Prospect) => void;
}> = ({ prospects, today, onAct, onMove, onDetail }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const searching = q.trim().length > 0;
  const results = useMemo(() => (searching ? findProspects(prospects, q, 6) : recentlyContacted(prospects, 5)), [prospects, q, searching]);

  // Cerrar al tocar afuera o con Escape; "/" lleva al buscador
  useEffect(() => {
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      const el = e.target as HTMLElement | null;
      if (e.key === '/' && el && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, []);

  return (
    <div ref={box} className="relative">
      <label className="flex items-center gap-2.5 h-12 px-4 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] focus-within:border-[var(--border-strong)] transition-colors">
        <Search className="w-[18px] h-[18px] shrink-0 text-[var(--text-tertiary)]" aria-hidden />
        <input
          ref={input}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="¿Quién te contestó? Buscá por nombre, estudio, teléfono o @"
          aria-label="Buscar un prospecto por nombre, estudio, teléfono o Instagram"
          className="flex-1 min-w-0 bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
        />
        {q && (
          <button type="button" onClick={() => { setQ(''); input.current?.focus(); }} aria-label="Borrar la búsqueda" className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-muted)] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}
      </label>

      {open && (searching || results.length > 0) && (
        <div className="absolute left-0 right-0 top-[52px] z-40 max-h-[70vh] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-float)] p-2">
          <p className="px-2 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            {searching ? (results.length ? 'Coincidencias' : 'Nadie con ese nombre, teléfono o @') : 'Los últimos a los que les escribiste'}
          </p>
          <ul className="space-y-1.5">
            {results.map((p) => {
              const col = columnOf(p);
              const ig = p.instagram ? normalizeInstagram(p.instagram) : '';
              const closed = col === 'cliente' || col === 'perdido';
              return (
                <li key={p.id} className="rounded-[12px] border border-[var(--border-subtle)] p-3 space-y-2.5">
                  <button type="button" onClick={() => { setOpen(false); onDetail(p); }} className="w-full flex items-start gap-2 text-left cursor-pointer group">
                    <span className="flex-1 min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate">{p.studio || p.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.awaitingMe ? 'bg-[#34C759]/15 text-[#34C759]' : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]'}`}>
                          {p.awaitingMe ? 'Te toca contestar' : COL_LABEL[col]}
                        </span>
                      </span>
                      <span className="block text-[12px] text-[var(--text-secondary)] truncate">
                        {[p.studio ? p.name : '', p.whatsapp, ig ? `@${ig}` : '', p.city].filter(Boolean).join(' · ')}
                      </span>
                      <span className="block text-[12px] text-[var(--text-tertiary)] truncate">
                        {p.lastReplyNote ? `Te dijo: “${p.lastReplyNote}”` : p.lastContactAt ? `Le escribiste ${ago(p.lastContactAt, today)}` : 'Todavía no le escribiste'}
                      </span>
                    </span>
                    <ChevronRight className="mt-1 w-4 h-4 shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" aria-hidden />
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    {!closed && !p.awaitingMe && <ReplyButton prospect={p} onAct={onAct} />}
                    <ProspectChatLinks p={p} />
                    <label className="ml-auto flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]">
                      Mover a
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) onMove(p, e.target.value as BoardColumn | ClosedColumn); }}
                        aria-label={`Mover a ${p.studio || p.name} a otra etapa`}
                        className="h-8 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-app)] px-2 text-[12px] text-[var(--text-primary)] cursor-pointer"
                      >
                        <option value="">Elegir…</option>
                        {(Object.keys(COL_LABEL) as (BoardColumn | ClosedColumn)[]).filter((c) => c !== col).map((c) => <option key={c} value={c}>{COL_LABEL[c]}</option>)}
                      </select>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
          {!searching && <p className="px-2 pt-2 text-[11px] text-[var(--text-tertiary)]">Escribí para buscar entre todos. Con “/” volvés acá desde el teclado.</p>}
        </div>
      )}
    </div>
  );
};
