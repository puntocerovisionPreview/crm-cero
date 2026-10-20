import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Clapperboard, Copy, Image as ImageIcon, Images, Loader2 } from 'lucide-react';
import { ContentPiece, ContentSupport, SUPPORT_LABEL, isLate, pieceTitle, statusStage } from '../content/model';
import { readinessNote } from '../content/reminders';
import { setContentStatus } from '../content/store';
import { useContent } from '../content/useContent';
import { AssetImg } from '../content/AssetImg';
import { addDays, todayLocal } from '../utils/dates';

const TINT = '#FF2D55';
const EVENING_HOUR = 18;

/**
 * Contenido dentro de Hoy (y en Inicio): lo mismo que avisa el servidor, a la vista.
 * Durante el día: "Hoy se publica…", con portada, caption para copiar y "Ya la publiqué".
 * Desde las 18: además, "Mañana toca…" y qué falta dejar listo.
 */

const Icon: React.FC<{ s: ContentSupport }> = ({ s }) =>
  s === 'reel' ? <Clapperboard className="w-4 h-4" aria-hidden /> : s === 'carrusel' ? <Images className="w-4 h-4" aria-hidden /> : <ImageIcon className="w-4 h-4" aria-hidden />;

function useHour() {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(t);
  }, []);
  return hour;
}

const Row: React.FC<{ p: ContentPiece; today: boolean; onOpen: () => void }> = ({ p, today, onOpen }) => {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const caption = p.caption || p.script?.caption || '';
  const cover = p.slides[0]?.thumb;
  const ready = statusStage(p.status) === 'listo';
  return (
    <div className="flex items-center gap-3 min-w-0">
      <button type="button" onClick={onOpen} className="shrink-0 w-11 aspect-[4/5] rounded-md overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] flex items-center justify-center text-[var(--text-secondary)]" aria-label={`Abrir ${pieceTitle(p)}`}>
        {cover ? <AssetImg src={cover} className="w-full h-full object-cover" /> : <Icon s={p.support} />}
      </button>
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
        <span className="block text-[14px] font-semibold text-[var(--text-primary)] truncate">{pieceTitle(p)}</span>
        <span className={`block text-[12px] truncate ${ready ? 'text-[var(--text-secondary)]' : 'text-amber-300'}`}>
          {SUPPORT_LABEL[p.support]} · {readinessNote(p)}
        </span>
      </button>
      {today && (
        <span className="flex gap-1.5 shrink-0">
          {caption && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(caption);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                } catch {
                  /* sin portapapeles */
                }
              }}
              className="h-8 px-2.5 rounded-full border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-primary)] inline-flex items-center gap-1 hover:bg-[var(--bg-surface-muted)]"
              title="Copiar caption"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copiado' : 'Caption'}</span>
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await setContentStatus(p.id, 'publicado');
              } finally {
                setSaving(false);
              }
            }}
            className="h-8 px-2.5 rounded-full text-[12px] font-semibold text-white inline-flex items-center gap-1"
            style={{ backgroundColor: TINT }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} <span className="hidden sm:inline">Marcar publicada</span><span className="sm:hidden">Publicada</span>
          </button>
        </span>
      )}
    </div>
  );
};

export const ContentTodayCard: React.FC<{ onNavigate?: (path: string) => void }> = ({ onNavigate }) => {
  const { pieces } = useContent();
  const today = todayLocal();
  const hour = useHour();
  const pending = (p: ContentPiece) => statusStage(p.status) !== 'publicado';
  const { todays, tomorrows, late } = useMemo(() => {
    const all = pieces || [];
    const tomorrow = addDays(today, 1);
    return {
      todays: all.filter((p) => p.date === today && pending(p)),
      tomorrows: hour >= EVENING_HOUR ? all.filter((p) => p.date === tomorrow && pending(p)) : [],
      late: all.filter((p) => isLate(p, today) && p.date >= addDays(today, -7)),
    };
  }, [pieces, today, hour]);

  if (!pieces || (!todays.length && !tomorrows.length && !late.length)) return null;
  const open = (id?: string) => onNavigate?.(id ? `/contenido?pieza=${encodeURIComponent(id)}` : '/contenido');

  return (
    <section className="card-swiss p-3.5 sm:p-4 space-y-3" aria-label="Contenido de hoy">
      {todays.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: TINT }}>
            Hoy se publica
          </p>
          {todays.map((p) => (
            <Row key={p.id} p={p} today onOpen={() => open(p.id)} />
          ))}
        </div>
      )}
      {tomorrows.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Mañana toca</p>
          {tomorrows.map((p) => (
            <Row key={p.id} p={p} today={false} onOpen={() => open(p.id)} />
          ))}
        </div>
      )}
      {late.length > 0 && (
        <button type="button" onClick={() => open(late[0].id)} className="w-full text-left text-[12px] text-amber-300 flex items-center gap-1">
          <span className="flex-1 min-w-0 truncate">
            Sin marcar publicada: {late.map((p) => pieceTitle(p)).join(', ')}
          </span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      )}
    </section>
  );
};
