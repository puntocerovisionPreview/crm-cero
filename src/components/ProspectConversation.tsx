import React, { useState } from 'react';
import { History, MessageSquareReply, StickyNote } from 'lucide-react';
import { Prospect } from '../types';
import { DIFUSION_LABELS, ProspectAction } from '../prospecting/core';

/**
 * Piezas de la conversación con un prospecto, iguales en Hoy, en la lista y en el inicio del día:
 * - "Me respondió" (en cualquier etapa) con lo que te dijo.
 * - Aviso "Te escribió: …" cuando te toca a vos.
 * - Historial de lo que te dijo y lo que le mandaste, y notas rápidas.
 * - Ficha para preparar la llamada.
 */

type Act = (p: Prospect, a: ProspectAction, note?: string) => unknown;

const btn = 'px-3 py-1.5 rounded-[var(--radius-control)] text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-40';
const ghost = `${btn} border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]`;
const primary = `${btn} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-strong)]`;
const input =
  'flex-1 min-w-0 px-3 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]';

const dayMonth = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

/** Botón "Me respondió": pregunta qué te dijo (opcional) y pasa el turno a vos. */
export const ReplyButton: React.FC<{ prospect: Prospect; onAct: Act; label?: string }> = ({ prospect: p, onAct, label = 'Me respondió' }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!open) {
    return (
      <button type="button" className={ghost} onClick={() => setOpen(true)} title="Te escribió: pasa a 'Te toca'">
        <MessageSquareReply className="w-3.5 h-3.5 text-emerald-400" /> {label}
      </button>
    );
  }
  const save = () => {
    onAct(p, 'they_replied', text.trim() || undefined);
    setOpen(false);
    setText('');
  };
  return (
    <form
      className="w-full flex gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="¿Qué te dijo? (opcional)" aria-label="Qué te dijo" className={input} />
      <button type="submit" className={primary}>
        Guardar
      </button>
      <button type="button" className={ghost} onClick={() => setOpen(false)}>
        ✕
      </button>
    </form>
  );
};

/** Te escribió y te toca contestar. */
export const AwaitingBanner: React.FC<{ prospect: Prospect }> = ({ prospect: p }) => {
  if (!p.awaitingMe) return null;
  return (
    <div className="p-2.5 rounded-[var(--radius-control)] bg-emerald-500/10 border border-emerald-500/30 text-xs">
      <p className="font-semibold text-emerald-400">Te escribió{p.lastReplyAt ? ` el ${dayMonth(p.lastReplyAt)}` : ''}: te toca contestar</p>
      {p.lastReplyNote && <p className="text-[var(--text-primary)] mt-0.5">«{p.lastReplyNote}»</p>}
    </div>
  );
};

/** Historial de la conversación + nota rápida. */
export const ConversationLog: React.FC<{ prospect: Prospect; onAct: Act }> = ({ prospect: p, onAct }) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const log = [...(p.log || [])].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="space-y-1.5">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-[11px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center gap-1">
        <History className="w-3.5 h-3.5" /> {open ? 'Ocultar historial' : `Historial${log.length ? ` (${log.length})` : ''}`}
      </button>
      {open && (
        <div className="space-y-2 p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)]">
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              onAct(p, 'note', note.trim());
              setNote('');
            }}
          >
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anotar algo de la conversación" aria-label="Nota" className={input} />
            <button type="submit" className={ghost} disabled={!note.trim()}>
              <StickyNote className="w-3.5 h-3.5" /> Anotar
            </button>
          </form>
          {log.length === 0 ? (
            <p className="text-[11px] text-[var(--text-tertiary)]">Todavía no hay historial. Desde ahora, cada paso queda anotado acá.</p>
          ) : (
            <ol className="space-y-1">
              {log.slice(0, 15).map((e, i) => (
                <li key={i} className="flex gap-2 text-[11px]">
                  <span className="text-[var(--text-tertiary)] tabular-nums shrink-0">{dayMonth(e.at)}</span>
                  <span className={e.dir === 'in' ? 'text-emerald-400' : e.dir === 'nota' ? 'text-amber-400' : 'text-[var(--text-secondary)]'}>
                    {e.dir === 'in' ? '← ' : e.dir === 'out' ? '→ ' : '✎ '}
                    {e.text}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
};

/** Lo que conviene tener a mano antes de la llamada. */
export const CallPrep: React.FC<{ prospect: Prospect }> = ({ prospect: p }) => {
  const lines = [
    p.audit ? `Auditoría ${p.audit.total}/30 (${p.audit.nivel}): presencia ${p.audit.presencia}, adquisición ${p.audit.adquisicion}, funnel ${p.audit.funnel}.` : 'Todavía no completó la auditoría.',
    p.audit?.dolorCaptacion ? `Su dolor principal: ${p.audit.dolorCaptacion}.` : '',
    p.audit?.proyectosActivos ? `Proyectos activos: ${p.audit.proyectosActivos}.` : '',
    p.difusion ? `Hoy consigue clientes por: ${DIFUSION_LABELS[p.difusion]}.` : '',
    p.lastReplyNote ? `Lo último que te dijo: «${p.lastReplyNote}».` : '',
    p.notes ? `Tus notas: ${p.notes}` : '',
    p.videoUrl ? `Video que le mandaste: ${p.videoUrl}` : '',
  ].filter(Boolean);
  return (
    <div className="p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs space-y-0.5">
      <p className="font-semibold text-[var(--text-primary)]">Para preparar la llamada</p>
      {lines.map((l, i) => (
        <p key={i} className="text-[var(--text-secondary)] break-words">
          {l}
        </p>
      ))}
    </div>
  );
};
