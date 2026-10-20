import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clapperboard, Image as ImageIcon, Images } from 'lucide-react';
import { ContentPiece, ContentSupport, StatusStage, monthGrid, monthLabel, pieceTitle, shiftMonth, statusStage } from '../content/model';
import { AssetImg } from '../content/AssetImg';

/**
 * CALENDARIO DE CONTENIDO
 * El mes completo: en cada día, la pieza que se publica con su portada (la slide 01)
 * o el ícono del formato si todavía no tiene imagen.
 */

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const DOT: Record<StatusStage, string> = {
  idea: 'bg-zinc-400',
  guion: 'bg-sky-400',
  produccion: 'bg-violet-400',
  revisar: 'bg-amber-400',
  listo: 'bg-blue-400',
  publicado: 'bg-emerald-400',
};

const Icon: React.FC<{ s: ContentSupport; className?: string }> = ({ s, className = 'w-4 h-4' }) =>
  s === 'reel' ? <Clapperboard className={className} aria-hidden /> : s === 'carrusel' ? <Images className={className} aria-hidden /> : <ImageIcon className={className} aria-hidden />;

export const ContentCalendar: React.FC<{ pieces: ContentPiece[]; today: string; onOpen: (id: string) => void }> = ({ pieces, today, onOpen }) => {
  const [month, setMonth] = useState(today.slice(0, 7));
  const days = useMemo(() => monthGrid(month), [month]);
  const byDay = useMemo(() => {
    const m = new Map<string, ContentPiece[]>();
    pieces.forEach((p) => m.set(p.date, [...(m.get(p.date) || []), p]));
    m.forEach((list) => list.sort((a, b) => (a.number || 0) - (b.number || 0)));
    return m;
  }, [pieces]);
  const inMonth = pieces.filter((p) => p.date.startsWith(month)).length;

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 sm:p-3 space-y-2">
      <header className="flex items-center gap-2 px-1">
        <h2 className="text-[16px] font-bold text-[var(--text-primary)]">{monthLabel(month)}</h2>
        <span className="text-[12px] text-[var(--text-tertiary)]">
          {inMonth} {inMonth === 1 ? 'pieza' : 'piezas'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {month !== today.slice(0, 7) && (
            <button type="button" onClick={() => setMonth(today.slice(0, 7))} className="px-2.5 py-1 rounded-full text-[12px] font-semibold text-[var(--accent)] hover:bg-[var(--bg-surface-muted)]">
              Hoy
            </button>
          )}
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="p-1.5 rounded-full hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]" aria-label="Mes anterior">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} className="p-1.5 rounded-full hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]" aria-label="Mes siguiente">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] pb-0.5">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const list = byDay.get(d) || [];
          const out = !d.startsWith(month);
          const isToday = d === today;
          return (
            <div
              key={d}
              className={`min-w-0 rounded-lg p-0.5 sm:p-1 flex flex-col gap-1 min-h-[64px] sm:min-h-[132px] ${
                isToday ? 'bg-[var(--accent)]/10 ring-1 ring-[var(--accent)]/60' : 'bg-[var(--bg-app)]'
              } ${out ? 'opacity-40' : ''}`}
            >
              <span className={`text-[11px] sm:text-[12px] font-semibold px-0.5 ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>{Number(d.slice(8, 10))}</span>
              {list.map((p) => {
                const cover = p.slides[0]?.thumb;
                const stage = statusStage(p.status);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onOpen(p.id)}
                    title={`${pieceTitle(p)} · ${p.status}`}
                    className="group text-left min-w-0 rounded-md overflow-hidden border border-[var(--border-subtle)] hover:border-[var(--accent)] transition bg-[var(--bg-surface)]"
                  >
                    <span className="relative block aspect-[4/5] bg-[var(--bg-surface-muted)]">
                      {cover ? (
                        <AssetImg src={cover} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1 text-[var(--text-secondary)]">
                          <Icon s={p.support} className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span className="hidden sm:block text-[10px] leading-tight text-center line-clamp-3">{pieceTitle(p)}</span>
                        </span>
                      )}
                      {cover && (
                        <span className="absolute top-0.5 left-0.5 p-0.5 rounded bg-black/60 text-white">
                          <Icon s={p.support} className="w-3 h-3" />
                        </span>
                      )}
                      {cover && p.slides.length > 1 && (
                        <span className="hidden sm:block absolute bottom-0.5 left-0.5 px-1 rounded bg-black/60 text-white text-[10px] font-bold">{p.slides.length}</span>
                      )}
                      <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ring-1 ring-black/40 ${DOT[stage]}`} aria-label={p.status} />
                    </span>
                    {cover && <span className="hidden sm:block px-1 py-0.5 text-[10px] leading-tight text-[var(--text-primary)] truncate">{pieceTitle(p)}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <footer className="flex flex-wrap gap-x-3 gap-y-1 px-1 pt-1 text-[11px] text-[var(--text-tertiary)]">
        {(
          [
            ['guion', 'Guion'],
            ['produccion', 'En producción'],
            ['revisar', 'Para revisar'],
            ['listo', 'Lista'],
            ['publicado', 'Publicada'],
          ] as [StatusStage, string][]
        ).map(([k, l]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${DOT[k]}`} /> {l}
          </span>
        ))}
      </footer>
    </section>
  );
};
