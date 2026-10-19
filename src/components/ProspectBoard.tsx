import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, ClipboardCopy, MessageCircle, MoreHorizontal, Phone, Undo2, Video } from 'lucide-react';
import { Prospect, ProspectingSettings } from '../types';
import { ProspectAction, normalizeInstagram } from '../prospecting/core';
import { BOARD_COLUMNS, BoardColumn, ClosedColumn, NextMove, columnOf, nextMove, turnTone } from '../prospecting/board';
import { formatWhatsAppUrl } from '../utils/contact';
import { updateProspect } from '../prospecting/store';
import { ReplyButton } from './ProspectConversation';
import { PersonalLineButton } from './ProspectingDayStart';

/**
 * LA TARJETA DE UN PROSPECTO (igual en Hoy y en el tablero)
 * Una cosa para hacer, un botón. "Enviar por WhatsApp" abre el chat con el mensaje y ya lo
 * marca como enviado (con Deshacer). "Respondió" es lo único que avisás a mano.
 */

export type Send = (p: Prospect, action: ProspectAction, note?: string, label?: string) => unknown;

const TINT = '#34C759';
const TONE: Record<'mio' | 'suyo' | 'frio', { color: string; label: string }> = {
  mio: { color: TINT, label: 'Te toca' },
  suyo: { color: 'var(--text-tertiary)', label: 'Esperando' },
  frio: { color: '#FF9500', label: 'Sin respuesta' },
};

const btn = 'rounded-[12px] font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-40 cursor-pointer';
const ghost = `${btn} h-9 px-3 text-[13px] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]`;
const chip = `${btn} h-9 px-3 text-[13px] bg-[var(--bg-surface-muted)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)]`;

const SEND_LOG: Partial<Record<ProspectAction, string>> = {
  first_contact: 'primer mensaje enviado',
  follow_up: 'recordatorio enviado',
  conv_question_sent: 'pregunta enviada',
  conv_empathy_sent: 'empatía enviada',
  audit_sent: 'link de la auditoría enviado',
  video_sent: 'video enviado',
  i_replied: 'le contestaste',
};

export function sendLabel(action: ProspectAction): string {
  return SEND_LOG[action] || 'listo';
}

export const ProspectCard: React.FC<{
  prospect: Prospect;
  settings: ProspectingSettings;
  today: string;
  onSend: Send;
  onMove: (p: Prospect, to: BoardColumn | ClosedColumn) => void;
  onCall: (p: Prospect) => void;
  onDetail: (p: Prospect) => void;
  big?: boolean;
  draggable?: boolean;
}> = ({ prospect: p, settings, today, onSend, onMove, onCall, onDetail, big, draggable }) => {
  const move: NextMove = nextMove(p, today, settings);
  const tone = TONE[turnTone(p, move, settings)];
  const [showMsg, setShowMsg] = useState(!!big);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [video, setVideo] = useState(p.videoUrl || '');
  const name = p.studio || p.name;
  const ig = normalizeInstagram(p.instagram);

  const pick = (action: ProspectAction, note?: string) => {
    if (action === 'call') return onCall(p);
    onSend(p, action, note);
  };
  const copyAndMark = () => {
    navigator.clipboard?.writeText(move.message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  const primary = move.send ? (
    p.whatsapp ? (
      <a
        href={formatWhatsAppUrl(p.whatsapp, move.message || undefined)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onSend(p, move.send!)}
        className={`${btn} ${big ? 'h-12 text-[15px] px-5 w-full sm:w-auto' : 'h-9 text-[13px] px-3'} text-white`}
        style={{ backgroundColor: TINT }}
      >
        <MessageCircle className={big ? 'w-5 h-5' : 'w-4 h-4'} /> {move.sendLabel}
      </a>
    ) : (
      <button
        type="button"
        onClick={() => {
          copyAndMark();
          if (ig) window.open(`https://instagram.com/${ig}`, '_blank', 'noopener');
          onSend(p, move.send!);
        }}
        className={`${btn} ${big ? 'h-12 text-[15px] px-5' : 'h-9 text-[13px] px-3'} text-white`}
        style={{ backgroundColor: TINT }}
      >
        <ClipboardCopy className="w-4 h-4" /> {ig ? 'Copiar y abrir Instagram' : 'Copiar mensaje'}
      </button>
    )
  ) : null;

  return (
    <article
      className={`card-swiss ${big ? 'p-5 sm:p-6 space-y-4' : 'p-3 space-y-2.5'} relative`}
      style={big ? { borderColor: `${TINT}55` } : undefined}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/prospect', p.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <header className="flex items-start gap-2">
        <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tone.color }} title={tone.label} />
        <button type="button" onClick={() => onDetail(p)} className="flex-1 min-w-0 text-left cursor-pointer">
          <span className={`block ${big ? 'text-[22px]' : 'text-[14px]'} font-bold tracking-tight text-[var(--text-primary)] truncate`}>{name}</span>
          <span className={`block ${big ? 'text-[14px]' : 'text-[12px]'} text-[var(--text-secondary)] ${big ? '' : 'line-clamp-2'}`}>{move.why}</span>
        </button>
        <span className="relative shrink-0">
          <button type="button" onClick={() => setMenu((v) => !v)} aria-label="Más opciones" className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-muted)] cursor-pointer">
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menu && (
            <>
              <span className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-9 z-40 w-56 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-float)] p-1 text-[13px]">
                <button type="button" className="w-full text-left px-3 py-2 rounded-[8px] hover:bg-[var(--bg-surface-muted)]" onClick={() => { setMenu(false); onDetail(p); }}>
                  Ver todo (historial, notas, auditoría)
                </button>
                <p className="px-3 pt-2 pb-1 text-[11px] text-[var(--text-tertiary)]">Mover a</p>
                {BOARD_COLUMNS.filter((c) => c.id !== columnOf(p)).map((c) => (
                  <button key={c.id} type="button" className="w-full text-left px-3 py-1.5 rounded-[8px] hover:bg-[var(--bg-surface-muted)]" onClick={() => { setMenu(false); onMove(p, c.id); }}>
                    {c.label}
                  </button>
                ))}
                <button type="button" className="w-full text-left px-3 py-1.5 rounded-[8px] hover:bg-[var(--bg-surface-muted)]" onClick={() => { setMenu(false); onMove(p, 'cliente'); }}>
                  Cliente
                </button>
                <div className="my-1 border-t border-[var(--border-subtle)]" />
                <button type="button" className="w-full text-left px-3 py-2 rounded-[8px] hover:bg-[var(--bg-surface-muted)]" onClick={() => { setMenu(false); onSend(p, 'lost', 'No le interesa'); }}>
                  No le interesa
                </button>
                <button type="button" className="w-full text-left px-3 py-2 rounded-[8px] hover:bg-[var(--bg-surface-muted)] text-red-400" onClick={() => { setMenu(false); onSend(p, 'do_not_contact'); }}>
                  No contactar nunca más
                </button>
              </div>
            </>
          )}
        </span>
      </header>

      <p className={`${big ? 'text-[17px]' : 'text-[13px]'} font-semibold text-[var(--text-primary)]`}>{move.title}</p>

      {move.message && (
        big || showMsg ? (
          <div className="space-y-2">
            <p className={`${big ? 'text-[15px] p-3.5' : 'text-[13px] p-2.5'} leading-relaxed whitespace-pre-wrap text-[var(--text-primary)] rounded-[12px] bg-[var(--bg-app)] border border-[var(--border-subtle)]`}>{move.message}</p>
            {move.send === 'first_contact' && !p.secondChance && <PersonalLineButton prospect={p} small />}
          </div>
        ) : null
      )}

      {move.need === 'video' && (
        <div className="flex gap-2">
          <input
            value={video}
            onChange={(e) => setVideo(e.target.value)}
            placeholder="Pegá el link del video (Loom, YouTube, Drive)"
            aria-label="Link del video"
            className="flex-1 min-w-0 h-9 px-3 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-[13px] text-[var(--text-primary)]"
          />
          <button type="button" disabled={!video.trim()} onClick={() => updateProspect(p.id, { videoUrl: video.trim() })} className={chip}>
            <Video className="w-4 h-4" /> Guardar
          </button>
        </div>
      )}

      <div className={`flex flex-wrap items-center gap-2 ${big ? 'pt-1' : ''}`}>
        {primary}
        {move.need === 'call_time' && (
          <button type="button" onClick={() => onCall(p)} className={`${btn} ${big ? 'h-12 text-[15px] px-5' : 'h-9 text-[13px] px-3'} text-white`} style={{ backgroundColor: '#0A84FF' }}>
            <Phone className="w-4 h-4" /> Ponerle día y hora
          </button>
        )}
        {move.choose?.map((c) => (
          <button key={c.label} type="button" onClick={() => pick(c.action, c.note)} className={chip}>
            {c.label}
          </button>
        ))}
        {move.canReply && <ReplyButton prospect={p} onAct={(pp, a, n) => onSend(pp, a, n)} label="Respondió" />}
        {!big && move.message && (
          <button type="button" onClick={() => setShowMsg((v) => !v)} className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center gap-0.5 cursor-pointer">
            {showMsg ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} {showMsg ? 'Ocultar' : 'Ver'} mensaje
          </button>
        )}
        {big && move.message && (
          <button type="button" onClick={copyAndMark} className={ghost}>
            <ClipboardCopy className="w-4 h-4" /> {copied ? 'Copiado' : 'Copiar'}
          </button>
        )}
      </div>
    </article>
  );
};

/** Tablero: 5 columnas en la compu (arrastrás para mover), una por vez en el celular. */
export const ProspectBoard: React.FC<{
  prospects: Prospect[];
  settings: ProspectingSettings;
  today: string;
  onSend: Send;
  onMove: (p: Prospect, to: BoardColumn | ClosedColumn) => void;
  onCall: (p: Prospect) => void;
  onDetail: (p: Prospect) => void;
  initialColumn?: BoardColumn | null;
}> = ({ prospects, settings, today, onSend, onMove, onCall, onDetail, initialColumn }) => {
  const [mobileCol, setMobileCol] = useState<BoardColumn>(initialColumn || 'conversando');
  const [over, setOver] = useState<BoardColumn | null>(null);
  useEffect(() => {
    if (initialColumn) setMobileCol(initialColumn);
  }, [initialColumn]);

  const byCol = useMemo(() => {
    const m: Record<string, Prospect[]> = {};
    prospects.forEach((p) => {
      const c = columnOf(p);
      (m[c] = m[c] || []).push(p);
    });
    // Dentro de cada columna: primero a quien le toca, después los que esperan hace más
    const rank = (p: Prospect) => {
      const mv = nextMove(p, today, settings);
      return mv.waiting ? 2 : mv.send === 'follow_up' ? 1 : 0;
    };
    Object.values(m).forEach((list) => list.sort((a, b) => rank(a) - rank(b) || (a.lastContactAt || '').localeCompare(b.lastContactAt || '')));
    return m;
  }, [prospects, today, settings]);

  // "Te toca" de cada columna (en Por escribir, solo los de hoy)
  const mineIn = (c: BoardColumn) =>
    (byCol[c] || []).filter((p) => (c !== 'por_escribir' || (p.plannedFirstContact || p.createdAt) <= today) && turnTone(p, nextMove(p, today, settings), settings) === 'mio').length;

  const renderColumn = (id: BoardColumn) => {
    const all = byCol[id] || [];
    // "Por escribir": solo los de hoy; los agendados para otros días quedan como número
    const later = id === 'por_escribir' ? all.filter((p) => (p.plannedFirstContact || p.createdAt) > today) : [];
    const items = id === 'por_escribir' ? all.filter((p) => (p.plannedFirstContact || p.createdAt) <= today).slice(0, 12) : all;
    const col = BOARD_COLUMNS.find((c) => c.id === id)!;
    return (
      <section
        key={id}
        className={`rounded-[16px] p-2 space-y-2 transition-colors ${over === id ? 'bg-[var(--bg-surface-muted)]' : 'bg-[var(--bg-surface)]/40'}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(id);
        }}
        onDragLeave={() => setOver((o) => (o === id ? null : o))}
        onDrop={(e) => {
          e.preventDefault();
          setOver(null);
          const pid = e.dataTransfer.getData('text/prospect');
          const p = prospects.find((x) => x.id === pid);
          if (p && columnOf(p) !== id) onMove(p, id);
        }}
        aria-label={col.label}
      >
        <header className="px-1.5 pt-1">
          <p className="text-[14px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            {col.label}
            <span className="text-[12px] tabular-nums text-[var(--text-tertiary)]">{items.length}</span>
            {mineIn(id) > 0 && (
              <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: TINT }} title="Te toca">
                {mineIn(id)}
              </span>
            )}
          </p>
          <p className="text-[11px] text-[var(--text-tertiary)]">{col.hint}</p>
        </header>
        {items.length === 0 ? (
          <p className="text-[12px] text-[var(--text-tertiary)] px-1.5 py-4 text-center">Nadie acá.</p>
        ) : (
          items.slice(0, 60).map((p) => (
            <ProspectCard key={p.id} prospect={p} settings={settings} today={today} onSend={onSend} onMove={onMove} onCall={onCall} onDetail={onDetail} draggable />
          ))
        )}
        {items.length > 60 && <p className="text-[11px] text-[var(--text-tertiary)] px-1.5">y {items.length - 60} más (buscalos en Prospectos)</p>}
        {id === 'por_escribir' && all.length - later.length > items.length && (
          <p className="text-[11px] text-[var(--text-tertiary)] px-1.5">y {all.length - later.length - items.length} más para hoy</p>
        )}
        {later.length > 0 && <p className="text-[11px] text-[var(--text-tertiary)] px-1.5">{later.length} agendados para los próximos días</p>}
      </section>
    );
  };

  const closed = { cliente: (byCol.cliente || []).length, perdido: (byCol.perdido || []).length };

  return (
    <div className="space-y-3">
      {/* Celular: elegís la columna */}
      <div className="md:hidden flex gap-1.5 overflow-x-auto no-scrollbar">
        {BOARD_COLUMNS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setMobileCol(c.id)}
            aria-pressed={mobileCol === c.id}
            className={`h-9 px-3 rounded-full text-[13px] font-medium flex items-center gap-1.5 border ${
              mobileCol === c.id ? 'bg-[var(--text-primary)] text-[var(--bg-app)] border-transparent' : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
            }`}
          >
            {c.label}
            <span className="tabular-nums opacity-70">{(byCol[c.id] || []).length}</span>
            {mineIn(c.id) > 0 && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TINT }} />}
          </button>
        ))}
      </div>
      <div className="md:hidden">
        {renderColumn(mobileCol)}
      </div>

      {/* Compu: las 5 columnas, arrastrás para mover */}
      <div className="hidden md:block overflow-x-auto pb-2 -mx-1 px-1">
        <div className="grid gap-2 items-start" style={{ gridTemplateColumns: 'repeat(5, minmax(250px, 1fr))' }}>
        {BOARD_COLUMNS.map((c) => renderColumn(c.id))}
        </div>
      </div>

      <p className="text-[12px] text-[var(--text-tertiary)] px-1">
        {closed.cliente} {closed.cliente === 1 ? 'cliente' : 'clientes'} · {closed.perdido} {closed.perdido === 1 ? 'perdido' : 'perdidos'} (están en Prospectos).
        <span className="hidden md:inline"> Arrastrá una tarjeta a otra columna para corregir dónde está.</span>
      </p>
    </div>
  );
};

/** "Marcado: …  Deshacer" durante unos segundos. */
export const UndoToast: React.FC<{ text: string; onUndo: () => void; onDone: () => void }> = ({ text, onUndo, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 6000);
    return () => clearTimeout(t);
  }, [text, onDone]);
  return (
    <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 z-[60] flex items-center gap-3 pl-4 pr-2 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-app)] shadow-[var(--shadow-float)] max-w-[92vw]">
      <Check className="w-4 h-4 shrink-0" />
      <span className="text-[13px] truncate">{text}</span>
      <button type="button" onClick={onUndo} className="h-8 px-3 rounded-full text-[13px] font-semibold flex items-center gap-1 cursor-pointer" style={{ backgroundColor: 'rgba(127,127,127,.25)' }}>
        <Undo2 className="w-3.5 h-3.5" /> Deshacer
      </button>
    </div>
  );
};
