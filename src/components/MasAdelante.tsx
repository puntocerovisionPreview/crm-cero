import React, { useState } from 'react';
import { CalendarClock, X } from 'lucide-react';
import type { Prospect } from '../types';
import type { ProspectAction } from '../prospecting/core';
import { addDays } from '../utils/dates';

const btn = 'inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40';
const ghost = `${btn} border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]`;
const primary = `${btn} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-strong)]`;
const field = 'w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-base sm:text-sm text-[var(--text-primary)]';
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/**
 * "Empieza más adelante": te dijo que le interesa pero arranca en otro momento.
 * Elegís cuándo retomar (y por qué); sale de tu lista y ese día vuelve sola.
 */
export function MasAdelanteButton({ prospect: p, today, onAct, label = 'Empieza más adelante', startOpen = false, onCerrar }: {
  prospect: Prospect; today: string; label?: string;
  onAct: (p: Prospect, a: ProspectAction, note?: string) => unknown;
  /** Abierto de entrada (cuando se elige desde un menú) y qué hacer al cerrarlo */
  startOpen?: boolean; onCerrar?: () => void;
}) {
  const [open, setOpenState] = useState(startOpen);
  const setOpen = (v: boolean) => { setOpenState(v); if (!v) onCerrar?.(); };
  const [fecha, setFecha] = useState(p.retomar?.fecha && p.retomar.fecha > today ? p.retomar.fecha : addDays(today, 30));
  const [motivo, setMotivo] = useState(p.retomar?.motivo || '');
  const atajos = [{ l: '2 semanas', d: 14 }, { l: '1 mes', d: 30 }, { l: '3 meses', d: 90 }, { l: '6 meses', d: 180 }];

  if (!open) {
    return (
      <button type="button" className={ghost} onClick={() => setOpen(true)} title="Le interesa pero arranca en otro momento: sale de tu lista y vuelve sola en la fecha que elijas">
        <CalendarClock className="h-3.5 w-3.5" /> {label}
      </button>
    );
  }
  return (
    <div className="w-full rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-2.5" role="group" aria-label="Empieza más adelante">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text-primary)]">¿Cuándo lo retomás?</p>
        <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)} className="rounded-full p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)]"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {atajos.map((a) => {
          const d = addDays(today, a.d);
          return (
            <button key={a.l} type="button" onClick={() => setFecha(d)}
              className={`rounded-full border px-3 py-1 text-xs ${fecha === d ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'}`}>
              {a.l}
            </button>
          );
        })}
      </div>
      <label className="block text-xs text-[var(--text-secondary)]">Fecha para retomar
        <input type="date" className={field} value={fecha} min={addDays(today, 1)} onChange={(e) => setFecha(e.target.value)} />
      </label>
      <label className="block text-xs text-[var(--text-secondary)]">Qué te dijo (opcional)
        <input className={field} value={motivo} maxLength={200} placeholder="Ej.: arrancan cuando terminen la obra en marzo" onChange={(e) => setMotivo(e.target.value)} />
      </label>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--text-tertiary)]">Vuelve a tu lista el {fecha ? ddmm(fecha) : '—'}</span>
        <button type="button" className={primary} disabled={!fecha || fecha <= today}
          onClick={() => { onAct(p, 'later', `${fecha}|${motivo.trim()}`); setOpen(false); }}>
          Guardar
        </button>
      </div>
    </div>
  );
}

/** Los que empiezan más adelante: tu cartera futura, del más próximo al más lejano */
export function MasAdelanteLista({ prospects, today, onAct }: {
  prospects: Prospect[]; today: string;
  onAct: (p: Prospect, a: ProspectAction, note?: string) => unknown;
}) {
  const [verTodos, setVerTodos] = useState(false);
  if (!prospects.length) return null;
  const lista = verTodos ? prospects : prospects.slice(0, 5);
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3" aria-label="Empiezan más adelante">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]"><CalendarClock className="h-4 w-4 text-[var(--accent)]" /> Empiezan más adelante</h2>
        <span className="text-xs text-[var(--text-tertiary)]">{prospects.length} {prospects.length === 1 ? 'estudio' : 'estudios'} · vuelven solos a tu lista en su fecha</span>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {lista.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-[var(--text-primary)]">{ddmm(p.retomar!.fecha)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-[var(--text-primary)]">{p.studio || p.name}</span>
              {p.retomar!.motivo && <span className="block truncate text-xs text-[var(--text-tertiary)]">{p.retomar!.motivo}</span>}
            </span>
            {p.retomar!.fecha > today && (
              <button type="button" className={ghost} onClick={() => onAct(p, 'later', `${today}|${p.retomar!.motivo || ''}`)} title="Que aparezca hoy en tu lista">
                Retomar hoy
              </button>
            )}
          </li>
        ))}
      </ul>
      {prospects.length > 5 && (
        <button type="button" onClick={() => setVerTodos((v) => !v)} className="text-xs font-medium text-[var(--text-secondary)] underline underline-offset-4">
          {verTodos ? 'Ver menos' : `Ver los ${prospects.length}`}
        </button>
      )}
    </section>
  );
}
