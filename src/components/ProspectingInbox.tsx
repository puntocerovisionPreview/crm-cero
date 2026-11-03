import React, { useMemo, useState } from 'react';
import { Check, ChevronRight, Moon, Phone, Zap } from 'lucide-react';
import { Prospect, ProspectingSettings } from '../types';
import { ProspectAction, QueueItem } from '../prospecting/core';
import { BoardColumn, ClosedColumn, nextMove } from '../prospecting/board';
import { Sheet } from './Sheet';
import { ProspectCard, Send } from './ProspectBoard';
import { ProspectChatLinks } from './ProspectChatLinks';

/**
 * HOY EN PROSPECCIÓN, DE A UNA COSA
 * - "Ahora": la próxima tarjeta en grande (un botón: Enviar por WhatsApp, que ya la marca).
 * - Listas cortas: Te toca · Seguimientos · Nuevos (y Llamadas si hay hoy).
 * - "¿Quién te respondió?": de a uno, con un toque por persona.
 */

type Act = (p: Prospect, a: ProspectAction, note?: string) => unknown;

const TINT = '#34C759';
const btnBase = 'rounded-[12px] font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-40 cursor-pointer';
const bigPrimary = `${btnBase} h-12 px-5 text-[15px] bg-[var(--text-primary)] text-[var(--bg-app)]`;
const ghost = `${btnBase} h-10 px-3.5 text-[13px] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]`;

const ago = (d?: string, today?: string) => {
  if (!d || !today) return '';
  const n = Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`;
};

/** Las respuestas del día, de a una: "¿Te respondió X?". */
const AnswerOneByOne: React.FC<{ people: Prospect[]; today: string; onAct: Act; onClose: () => void }> = ({ people, today, onAct, onClose }) => {
  const [total] = useState(people.length);
  const [busy, setBusy] = useState(false);
  const p = people[0];
  const done = total - people.length;
  const run = async (a: ProspectAction, note?: string) => {
    setBusy(true);
    try {
      await onAct(p, a, note);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet onClose={onClose} label="Anotar quién respondió">
      <div className="p-5 space-y-5">
        {!p ? (
          <div className="text-center space-y-3 py-4">
            <Check className="w-10 h-10 mx-auto" style={{ color: TINT }} />
            <p className="text-[17px] font-semibold text-[var(--text-primary)]">Listo, todo anotado.</p>
            <button type="button" onClick={onClose} className={`${bigPrimary} w-full`}>
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-[13px] text-[var(--text-secondary)] tabular-nums">
                {done + 1} de {total}
              </p>
              <div className="h-1.5 rounded-full bg-[var(--bg-surface-muted)] overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${(done / Math.max(1, total)) * 100}%`, backgroundColor: TINT }} />
              </div>
            </div>
            <div>
              <p className="text-[15px] text-[var(--text-secondary)]">Le escribiste {p.lastContactAt ? ago(p.lastContactAt, today) : 'hace poco'} a</p>
              <p className="text-[22px] font-bold tracking-tight text-[var(--text-primary)]">{p.studio || p.name}</p>
              {p.whatsapp && <p className="text-[13px] text-[var(--text-tertiary)] tabular-nums">{p.whatsapp}</p>}
            </div>
            <ProspectChatLinks p={p} size="lg" />
            <p className="text-[17px] text-[var(--text-primary)]">¿Te respondió?</p>
            <div className="grid gap-2">
              <button type="button" disabled={busy} onClick={() => run('they_replied')} className={`${btnBase} h-12 text-[15px] text-white`} style={{ backgroundColor: TINT }}>
                Sí, me respondió
              </button>
              <button type="button" disabled={busy} onClick={() => run('no_reply')} className={bigPrimary}>
                No respondió
              </button>
              <button type="button" disabled={busy} onClick={() => run('lost', 'No le interesa')} className={ghost}>
                Me dijo que no le interesa
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
};

type Lane = 'toca' | 'seguir' | 'nuevos' | 'llamadas';
const LANES: { id: Lane; label: string; empty: string }[] = [
  { id: 'toca', label: 'Te toca', empty: 'Nadie esperando tu respuesta.' },
  { id: 'seguir', label: 'Seguimientos', empty: 'No hay seguimientos para hoy.' },
  { id: 'nuevos', label: 'Nuevos', empty: 'No quedan primeros mensajes para hoy.' },
  { id: 'llamadas', label: 'Llamadas', empty: 'No tenés llamadas hoy.' },
];

export const ProspectingInbox: React.FC<{
  queue: QueueItem[];
  toClose: Prospect[];
  isEvening: boolean;
  settings: ProspectingSettings;
  today: string;
  onSend: Send;
  onMove: (p: Prospect, to: BoardColumn | ClosedColumn) => void;
  onCall: (p: Prospect) => void;
  onDetail: (p: Prospect) => void;
  onBurst?: () => void;
  tomorrowCalls: Prospect[];
  footer?: React.ReactNode;
}> = ({ queue, toClose, isEvening, settings, today, onSend, onMove, onCall, onDetail, onBurst, tomorrowCalls, footer }) => {
  const [later, setLater] = useState<string[]>([]);
  const [lane, setLane] = useState<Lane | null>(null);
  const [answering, setAnswering] = useState(false);

  // Cada uno de hoy con lo que hay que hacer, en el orden de prioridad de la cola
  const items = useMemo(
    () =>
      queue.map((i) => {
        const m = nextMove(i.prospect, today, settings);
        const laneOf: Lane = i.kind === 'llamada_hoy' ? 'llamadas' : m.send === 'first_contact' ? 'nuevos' : m.send === 'follow_up' ? 'seguir' : 'toca';
        return { p: i.prospect, m, lane: laneOf };
      }),
    [queue, today, settings]
  );
  const actionable = items.filter((x) => x.lane !== 'llamadas');
  const ordered = [...actionable.filter((x) => !later.includes(x.p.id)), ...actionable.filter((x) => later.includes(x.p.id))];
  const now = ordered[0];
  const counts = Object.fromEntries(LANES.map((l) => [l.id, items.filter((x) => x.lane === l.id).length])) as Record<Lane, number>;
  const activeLane = lane || (LANES.find((l) => l.id !== 'llamadas' && counts[l.id] > 0)?.id ?? 'toca');
  // La de "Ahora" ya está arriba: no se repite en la lista
  const laneItems = items.filter((x) => x.lane === activeLane && x.p.id !== now?.p.id);
  const calls = items.filter((x) => x.lane === 'llamadas');

  return (
    <div className="space-y-4">
      {toClose.length > 0 && (
        <button
          type="button"
          onClick={() => setAnswering(true)}
          className={`card-swiss w-full p-4 flex items-center gap-3 text-left cursor-pointer ${isEvening ? 'border-[#5856D6]/60' : ''}`}
        >
          <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: '#5856D6' }}>
            <Moon className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold text-[var(--text-primary)]">¿Quién te respondió? {toClose.length} sin anotar</span>
            <span className="block text-[13px] text-[var(--text-secondary)]">Te pregunto de a uno, un toque por persona.</span>
          </span>
          <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
        </button>
      )}

      {calls.map(({ p, m }) => (
        <button key={p.id} type="button" onClick={() => onDetail(p)} className="card-swiss w-full p-4 flex items-center gap-3 text-left cursor-pointer" style={{ borderColor: '#0A84FF55' }}>
          <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white" style={{ backgroundColor: '#0A84FF' }}>
            <Phone className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold text-[var(--text-primary)]">{m.title}</span>
            <span className="block text-[13px] text-[var(--text-secondary)] truncate">{p.studio || p.name} · tocá para ver su ficha y prepararla</span>
          </span>
          <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
        </button>
      ))}

      {now ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-1 text-[12px] text-[var(--text-secondary)]">
            <span className="font-semibold" style={{ color: TINT }}>
              Ahora
            </span>
            <span className="tabular-nums">1 de {actionable.length} para hoy</span>
            <span className="flex-1" />
            <button type="button" onClick={() => setLater((l) => [...l.filter((x) => x !== now.p.id), now.p.id])} className="font-medium hover:text-[var(--text-primary)] cursor-pointer">
              Pasar al siguiente
            </button>
            {onBurst && (
              <button type="button" onClick={onBurst} className="flex items-center gap-1 font-medium hover:text-[var(--text-primary)] cursor-pointer">
                <Zap className="w-3.5 h-3.5" /> Ráfaga
              </button>
            )}
          </div>
          <ProspectCard key={now.p.id + now.m.title} prospect={now.p} settings={settings} today={today} onSend={onSend} onMove={onMove} onCall={onCall} onDetail={onDetail} big />
        </div>
      ) : (
        <section className="card-swiss p-6 text-center space-y-1">
          <Check className="w-8 h-8 mx-auto" style={{ color: TINT }} />
          <p className="text-[17px] font-semibold text-[var(--text-primary)]">Terminaste lo de hoy.</p>
          <p className="text-[14px] text-[var(--text-secondary)]">Si querés seguir, sumá contactos nuevos abajo.</p>
        </section>
      )}

      {actionable.length > 1 && (
        <section className="space-y-3" aria-label="Todo lo de hoy">
          <div role="tablist" className="flex gap-1 p-1 rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-x-auto no-scrollbar">
            {LANES.filter((l) => l.id !== 'llamadas').map((l) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={activeLane === l.id}
                onClick={() => setLane(l.id)}
                className={`flex-1 min-w-[96px] h-10 rounded-[9px] text-[14px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  activeLane === l.id ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'
                }`}
              >
                {l.label}
                <span
                  className="min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums flex items-center justify-center"
                  style={counts[l.id] ? { backgroundColor: l.id === 'toca' ? TINT : 'var(--text-primary)', color: l.id === 'toca' ? '#fff' : 'var(--bg-app)' } : { color: 'var(--text-tertiary)' }}
                >
                  {counts[l.id]}
                </span>
              </button>
            ))}
          </div>
          {laneItems.length === 0 ? (
            <p className="text-[14px] text-[var(--text-secondary)] px-1">{counts[activeLane] ? 'Solo queda la de arriba.' : LANES.find((l) => l.id === activeLane)!.empty}</p>
          ) : (
            <div className="space-y-2">
              {laneItems.map(({ p }) => (
                <ProspectCard key={p.id} prospect={p} settings={settings} today={today} onSend={onSend} onMove={onMove} onCall={onCall} onDetail={onDetail} />
              ))}
            </div>
          )}
        </section>
      )}

      {tomorrowCalls.length > 0 && (
        <section className="card-swiss p-4 space-y-1.5">
          <p className="text-[13px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
            <Phone className="w-4 h-4" /> Mañana
          </p>
          {tomorrowCalls.map((p) => (
            <p key={p.id} className="text-[15px] text-[var(--text-primary)]">
              <span className="tabular-nums text-[var(--text-secondary)]">{p.callTime || 'sin hora'}</span> · llamada con {p.studio || p.name}
            </p>
          ))}
        </section>
      )}

      {footer}

      {answering && <AnswerOneByOne people={toClose} today={today} onAct={onSend} onClose={() => setAnswering(false)} />}
    </div>
  );
};
