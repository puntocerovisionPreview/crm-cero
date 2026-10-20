import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Images,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import {
  ContentPiece,
  ContentSupport,
  STAGE_LABEL,
  STAGE_TONE,
  STATUS_OPTIONS,
  SUPPORT_LABEL,
  groupByWeek,
  isLate,
  nextToPublish,
  pieceTitle,
  sanitizeScriptHtml,
  shortDay,
  statusStage,
} from '../content/model';
import { ImportProgress, ImportResult, importCalendar, setContentStatus } from '../content/store';
import { useContent } from '../content/useContent';
import { startOfWeekMonday, todayLocal } from '../utils/dates';

/**
 * CONTENIDO
 * Tu calendario de publicaciones por semana: cada pieza con sus slides (tira y visor grande),
 * caption, guion, recursos por palabra clave y estado.
 */

const btn = 'px-3 py-2 rounded-[var(--radius-control)] text-sm font-semibold inline-flex items-center gap-1.5 transition active:scale-95 disabled:opacity-40';
const btnPrimary = `${btn} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-strong)]`;
const btnGhost = `${btn} border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]`;
const card = 'rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]';

type Filter = 'todo' | ContentSupport;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todo', label: 'Todo' },
  { id: 'carrusel', label: 'Carruseles' },
  { id: 'reel', label: 'Reels' },
  { id: 'estatico', label: 'Estáticos' },
];

const SupportIcon: React.FC<{ s: ContentSupport; className?: string }> = ({ s, className = 'w-3.5 h-3.5' }) =>
  s === 'reel' ? <Clapperboard className={className} aria-hidden /> : s === 'carrusel' ? <Images className={className} aria-hidden /> : <ImageIcon className={className} aria-hidden />;

const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const st = statusStage(status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${STAGE_TONE[st]}`} title={status}>
      {STAGE_LABEL[st]}
    </span>
  );
};

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {
      /* sin portapapeles */
    }
  };
  return { copied, copy };
}

async function downloadFile(url: string, name: string) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error();
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

// ---------------- Pantalla ----------------

export const ContentView: React.FC = () => {
  const { pieces, error } = useContent();
  const today = todayLocal();
  const [filter, setFilter] = useState<Filter>('todo');
  const [openId, setOpenId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ id: string; index: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const thisWeekRef = useRef<HTMLDivElement | null>(null);

  const all = pieces || [];
  const shown = useMemo(() => (filter === 'todo' ? all : all.filter((p) => p.support === filter)), [all, filter]);
  const weeks = useMemo(() => groupByWeek(shown), [shown]);
  const thisWeek = startOfWeekMonday(today);
  // "Ir a hoy": esta semana, o la próxima que tenga piezas
  const anchorWeek = (weeks.find((w) => w.start >= thisWeek) || weeks[weeks.length - 1])?.start;
  const next = useMemo(() => nextToPublish(all, today), [all, today]);
  const late = useMemo(() => all.filter((p) => isLate(p, today)), [all, today]);
  const published = all.filter((p) => statusStage(p.status) === 'publicado').length;
  const toReview = all.filter((p) => statusStage(p.status) === 'revisar').length;
  const open = all.find((p) => p.id === openId) || null;
  const viewing = viewer ? all.find((p) => p.id === viewer.id) || null : null;

  // Al entrar, la semana actual a la vista
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || !pieces?.length) return;
    scrolled.current = true;
    requestAnimationFrame(() => thisWeekRef.current?.scrollIntoView({ block: 'start' }));
  }, [pieces]);

  if (pieces === null && !error) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] p-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando tu contenido…
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 pb-24">
      {error && (
        <div className="px-3.5 py-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[13px]">No se pudo leer el contenido: {error}</div>
      )}

      {all.length === 0 ? (
        <EmptyState onImport={() => setImporting(true)} />
      ) : (
        <>
          {/* Resumen */}
          <section className={`${card} p-4 flex flex-col md:flex-row md:items-center gap-3`}>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] uppercase tracking-wide text-[var(--text-tertiary)] font-semibold">
                {all[0]?.calendar || 'Calendario'}
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {all.length} piezas · {published} {published === 1 ? 'publicada' : 'publicadas'}
                {toReview ? ` · ${toReview} para revisar` : ''}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-surface-muted)] overflow-hidden" aria-hidden>
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((published / all.length) * 100)}%` }} />
              </div>
            </div>
            {next && (
              <button
                type="button"
                onClick={() => setOpenId(next.id)}
                className="md:w-80 text-left rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2.5 hover:border-[var(--accent)] transition"
              >
                <span className="block text-[11px] font-semibold text-[var(--accent)]">
                  {next.date === today ? 'Hoy se publica' : `Próxima · ${shortDay(next.date)}`}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                  <SupportIcon s={next.support} />
                  <span className="truncate">{pieceTitle(next)}</span>
                </span>
              </button>
            )}
          </section>

          {late.length > 0 && (
            <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[13px]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
              <span>
                {late.length === 1 ? '1 pieza ya pasó su día' : `${late.length} piezas ya pasaron su día`} sin marcarse como publicada. Si ya salieron, abrilas y cambiá el estado.
              </span>
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 p-1 rounded-full bg-[var(--bg-surface-muted)] overflow-x-auto max-w-full">
              {FILTERS.map((f) => {
                const n = f.id === 'todo' ? all.length : all.filter((p) => p.support === f.id).length;
                if (f.id !== 'todo' && n === 0) return null;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition ${
                      filter === f.id ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {f.label} <span className="text-[var(--text-tertiary)] font-medium">{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 ml-auto">
              <button type="button" className={btnGhost} onClick={() => thisWeekRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Ir a hoy
              </button>
              <button type="button" className={btnGhost} onClick={() => setImporting(true)}>
                <Upload className="w-4 h-4" /> Importar
              </button>
            </div>
          </div>

          {/* Semanas */}
          {weeks.map((w) => {
            const current = w.start === thisWeek;
            return (
              <section key={w.start} ref={w.start === anchorWeek ? thisWeekRef : undefined} className="scroll-mt-4 space-y-2">
                <h2 className="flex items-baseline gap-2 px-1">
                  <span className={`text-[15px] font-bold ${current ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                    {current ? 'Esta semana' : `Semana del ${w.start.slice(8, 10)}/${w.start.slice(5, 7)}`}
                  </span>
                  <span className="text-[12px] text-[var(--text-tertiary)]">
                    {w.start.slice(8, 10)}/{w.start.slice(5, 7)} al {w.end.slice(8, 10)}/{w.end.slice(5, 7)} · {w.pieces.length} {w.pieces.length === 1 ? 'pieza' : 'piezas'}
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {w.pieces.map((p) => (
                    <PieceCard key={p.id} p={p} today={today} onOpen={() => setOpenId(p.id)} onSlide={(index) => setViewer({ id: p.id, index })} />
                  ))}
                </div>
              </section>
            );
          })}
          {weeks.length === 0 && <p className="text-sm text-[var(--text-secondary)] px-1">No hay piezas de este tipo.</p>}
        </>
      )}

      {open && <PieceSheet p={open} today={today} onClose={() => setOpenId(null)} onSlide={(index) => setViewer({ id: open.id, index })} />}
      {viewing && viewer && <SlideViewer p={viewing} start={viewer.index} onClose={() => setViewer(null)} />}
      {importing && <ImportPanel onClose={() => setImporting(false)} hasData={all.length > 0} />}
    </div>
  );
};

// ---------------- Tarjeta de una pieza ----------------

const PieceCard: React.FC<{ p: ContentPiece; today: string; onOpen: () => void; onSlide: (i: number) => void }> = ({ p, today, onOpen, onSlide }) => {
  const isToday = p.date === today;
  const late = isLate(p, today);
  const MAX = 6;
  return (
    <article
      className={`${card} p-3 flex flex-col gap-2 min-w-0 cursor-pointer hover:border-[var(--border-strong)] transition ${isToday ? 'ring-2 ring-[var(--accent)]/60' : ''}`}
      onClick={onOpen}
    >
      <div className="flex items-center gap-2 text-[12px]">
        <span className={`font-bold ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{isToday ? 'Hoy' : shortDay(p.date)}</span>
        <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
          <SupportIcon s={p.support} /> {SUPPORT_LABEL[p.support]}
        </span>
        {late && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Ya pasó su día" />}
        <span className="ml-auto">
          <StatusChip status={p.status} />
        </span>
      </div>
      <button type="button" className="text-left text-[15px] font-semibold leading-snug text-[var(--text-primary)] line-clamp-2" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
        {pieceTitle(p)}
      </button>
      {p.slides.length > 0 ? (
        <div className="flex gap-1.5 overflow-x-auto snap-x pb-0.5 -mx-0.5 px-0.5" onClick={(e) => e.stopPropagation()}>
          {p.slides.slice(0, MAX).map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSlide(i)}
              className="relative shrink-0 snap-start w-14 aspect-[4/5] rounded-md overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] hover:border-[var(--accent)] transition"
              aria-label={`Ver slide ${i + 1}`}
            >
              <img src={s.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
              {i === MAX - 1 && p.slides.length > MAX && (
                <span className="absolute inset-0 bg-black/60 text-white text-xs font-bold flex items-center justify-center">+{p.slides.length - MAX}</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        p.idea && <p className="text-[13px] text-[var(--text-secondary)] line-clamp-2">{p.idea}</p>
      )}
      <div className="flex flex-wrap gap-1.5 text-[11px] text-[var(--text-tertiary)] mt-auto">
        {p.pillar && <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-muted)]">{p.pillar}</span>}
        {p.script && <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-muted)]">Guion</span>}
        {p.resources.map((r) => (
          <span key={r.word} className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-muted)] font-semibold">{r.word}</span>
        ))}
      </div>
    </article>
  );
};

// ---------------- Ficha completa ----------------

const PieceSheet: React.FC<{ p: ContentPiece; today: string; onClose: () => void; onSlide: (i: number) => void }> = ({ p, today, onClose, onSlide }) => {
  const { copied, copy } = useCopy();
  const [saving, setSaving] = useState(false);
  const scriptHtml = useMemo(() => (p.script?.html ? sanitizeScriptHtml(p.script.html) : ''), [p.script?.html]);
  const caption = p.caption || p.script?.caption || '';
  const options = STATUS_OPTIONS.includes(p.status) ? STATUS_OPTIONS : [p.status, ...STATUS_OPTIONS];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const changeStatus = async (status: string) => {
    setSaving(true);
    try {
      await setContentStatus(p.id, status);
    } finally {
      setSaving(false);
    }
  };

  const meta = [
    ['Pilar', p.pillar],
    ['Dolor', p.pain],
    ['Formato', p.format],
    ['CTA', p.cta],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/50" onClick={onClose} role="dialog" aria-modal="true" aria-label={pieceTitle(p)}>
      <div className="w-full md:max-w-xl h-full overflow-y-auto bg-[var(--bg-app)] border-l border-[var(--border-subtle)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="sticky top-0 z-10 bg-[var(--bg-app)]/95 backdrop-blur border-b border-[var(--border-subtle)] px-4 py-3 flex items-center gap-2">
          <span className="text-[13px] font-bold text-[var(--text-primary)]">{p.date === today ? 'Hoy' : shortDay(p.date)}</span>
          <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text-secondary)]">
            <SupportIcon s={p.support} /> {SUPPORT_LABEL[p.support]}
          </span>
          <button type="button" onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-4 space-y-5">
          <div className="space-y-2">
            <h2 className="text-xl font-bold leading-tight text-[var(--text-primary)]">{pieceTitle(p)}</h2>
            {p.idea && p.idea !== pieceTitle(p) && <p className="text-sm text-[var(--text-secondary)]">{p.idea}</p>}
            <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
              Estado
              <select
                value={p.status}
                disabled={saving}
                onChange={(e) => changeStatus(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-base sm:text-sm"
              >
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            </label>
          </div>

          {meta.length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {meta.map(([k, v]) => (
                <div key={k} className={`${card} px-3 py-2`}>
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] font-semibold">{k}</dt>
                  <dd className="text-[13px] text-[var(--text-primary)]">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {p.slides.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Slides ({p.slides.length})</h3>
                <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onSlide(0)}>
                  Ver en grande
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {p.slides.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSlide(i)}
                    className="relative aspect-[4/5] rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] hover:border-[var(--accent)] transition"
                    aria-label={`Ver slide ${i + 1}`}
                  >
                    <img src={s.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-1 text-[10px] font-bold px-1.5 rounded bg-black/60 text-white">{i + 1}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {caption && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Caption</h3>
                <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => copy('caption', caption)}>
                  {copied === 'caption' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied === 'caption' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <p className={`${card} p-3 text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--text-primary)]`}>{caption}</p>
            </section>
          )}

          {p.script && (
            <section className="space-y-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Guion{p.script.title && p.script.title !== pieceTitle(p) ? `: ${p.script.title}` : ''}</h3>
              {(p.script.format || p.script.what) && (
                <div className={`${card} p-3 space-y-1 text-[13px]`}>
                  {p.script.format && <p className="text-[var(--text-secondary)]">{p.script.format}</p>}
                  {p.script.what && <p className="text-[var(--text-primary)]">{p.script.what}</p>}
                </div>
              )}
              {scriptHtml && (
                <div
                  className={`${card} p-3 text-[13px] leading-relaxed text-[var(--text-primary)] [&_h3]:font-bold [&_h4]:font-bold [&_h4]:mt-3 [&_h4:first-child]:mt-0 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5 [&_p]:my-1`}
                  dangerouslySetInnerHTML={{ __html: scriptHtml }}
                />
              )}
              {p.script.text && (
                <div className="space-y-1">
                  <div className="flex justify-end">
                    <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => copy('texto', p.script!.text!)}>
                      {copied === 'texto' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied === 'texto' ? 'Copiado' : 'Copiar guion'}
                    </button>
                  </div>
                  <pre className={`${card} p-3 text-[13px] leading-relaxed whitespace-pre-wrap font-sans text-[var(--text-primary)]`}>{p.script.text}</pre>
                </div>
              )}
            </section>
          )}

          {p.resources.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Recursos por palabra clave</h3>
              {p.resources.map((r) =>
                r.url ? (
                <a
                  key={r.word}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${card} p-3 flex items-center gap-3 hover:border-[var(--accent)] transition`}
                >
                  <FileText className="w-5 h-5 text-[var(--accent)] shrink-0" aria-hidden />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px] font-bold text-[var(--text-primary)]">Si comentan {r.word}</span>
                    <span className="block text-[12px] text-[var(--text-secondary)] truncate">{r.name}</span>
                  </span>
                  <span className="text-[12px] font-semibold text-[var(--accent)]">Abrir PDF</span>
                </a>
                ) : (
                  <div key={r.word} className={`${card} p-3 flex items-center gap-3`}>
                    <FileText className="w-5 h-5 text-[var(--text-tertiary)] shrink-0" aria-hidden />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12px] font-bold text-[var(--text-primary)]">Si comentan {r.word}</span>
                      <span className="block text-[12px] text-[var(--text-secondary)] truncate">{r.name}</span>
                    </span>
                    <span className="text-[12px] text-[var(--text-tertiary)]">Sin PDF</span>
                  </div>
                )
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------- Visor de slides ----------------

const SlideViewer: React.FC<{ p: ContentPiece; start: number; onClose: () => void }> = ({ p, start, onClose }) => {
  const [i, setI] = useState(Math.min(start, p.slides.length - 1));
  const [busy, setBusy] = useState(false);
  const touch = useRef<number | null>(null);
  const n = p.slides.length;
  const go = (d: number) => setI((x) => Math.max(0, Math.min(n - 1, x + d)));
  const slide = p.slides[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, onClose]);

  // La siguiente ya cargada, para pasar sin espera
  useEffect(() => {
    const nx = p.slides[i + 1];
    if (nx) new Image().src = nx.display;
  }, [i, p.slides]);

  if (!slide) return null;
  const nn = (k: number) => String(k + 1).padStart(2, '0');
  const ext = (u: string) => (u.includes('.png') ? 'png' : 'jpg');

  const downloadAll = async () => {
    setBusy(true);
    for (let k = 0; k < n; k++) await downloadFile(p.slides[k].full, `${p.id}-${nn(k)}.${ext(p.slides[k].full)}`);
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/95 flex flex-col" role="dialog" aria-modal="true" aria-label={`Slides de ${pieceTitle(p)}`}>
      <header className="flex items-center gap-2 px-3 py-2 text-white">
        <span className="text-sm font-semibold truncate flex-1 min-w-0">{pieceTitle(p)}</span>
        <span className="text-sm tabular-nums text-white/70">
          {i + 1} / {n}
        </span>
        <button
          type="button"
          onClick={() => downloadFile(slide.full, `${p.id}-${nn(i)}.${ext(slide.full)}`)}
          className="p-2 rounded-full hover:bg-white/10"
          aria-label="Descargar esta slide en alta"
          title="Descargar esta en alta"
        >
          <Download className="w-5 h-5" />
        </button>
        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Cerrar">
          <X className="w-5 h-5" />
        </button>
      </header>

      <div
        className="relative flex-1 min-h-0 flex items-center justify-center px-2 select-none"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current == null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <img key={slide.display} src={slide.display} alt={`Slide ${i + 1}`} className="max-h-full max-w-full object-contain rounded-md shadow-2xl" />
        {i > 0 && (
          <button type="button" onClick={() => go(-1)} className="absolute left-2 md:left-6 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white" aria-label="Anterior">
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {i < n - 1 && (
          <button type="button" onClick={() => go(1)} className="absolute right-2 md:right-6 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white" aria-label="Siguiente">
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      <footer className="px-3 py-3 flex items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto flex-1 min-w-0 justify-start md:justify-center">
          {p.slides.map((s, k) => (
            <button
              key={k}
              type="button"
              onClick={() => setI(k)}
              className={`shrink-0 w-10 aspect-[4/5] rounded overflow-hidden border-2 transition ${k === i ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}
              aria-label={`Ir a la slide ${k + 1}`}
            >
              <img src={s.thumb} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        {n > 1 && (
          <button type="button" disabled={busy} onClick={downloadAll} className="shrink-0 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Todas
          </button>
        )}
      </footer>
    </div>
  );
};

// ---------------- Sin contenido todavía ----------------

const EmptyState: React.FC<{ onImport: () => void }> = ({ onImport }) => (
  <section className={`${card} p-6 md:p-8 text-center space-y-3`}>
    <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center">
      <Images className="w-6 h-6" aria-hidden />
    </div>
    <h2 className="text-lg font-bold text-[var(--text-primary)]">Tu calendario de contenido</h2>
    <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
      Importá el calendario (el .json) y el .zip con las slides y los PDF: vas a ver cada semana con sus carruseles, reels, captions y guiones.
    </p>
    <button type="button" className={btnPrimary} onClick={onImport}>
      <Upload className="w-4 h-4" /> Importar calendario
    </button>
  </section>
);

// ---------------- Importar ----------------

const ImportPanel: React.FC<{ onClose: () => void; hasData: boolean }> = ({ onClose, hasData }) => {
  const [json, setJson] = useState<File | null>(null);
  const [zip, setZip] = useState<File | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const running = !!progress && !result && !err;

  const start = async () => {
    if (!json) return setErr('Elegí el archivo .json del calendario.');
    setErr(null);
    setResult(null);
    setProgress({ done: 0, total: 1, label: 'Empezando…' });
    try {
      const text = await json.text();
      setResult(await importCalendar(text, zip, setProgress));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;
  const fileBox = 'block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:px-3 file:py-1.5 file:rounded-full file:border-0 file:bg-[var(--bg-surface-muted)] file:text-[var(--text-primary)] file:font-semibold';

  return (
    <div className="fixed inset-0 z-[85] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !running && onClose()} role="dialog" aria-modal="true" aria-label="Importar calendario">
      <div className="w-full sm:max-w-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Importar calendario</h2>
          {!running && (
            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]" aria-label="Cerrar">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {!result && (
          <>
            <p className="text-[13px] text-[var(--text-secondary)]">
              El <b>.json</b> trae las piezas (fechas, captions, guiones). El <b>.zip</b> trae las imágenes y los PDF, en carpetas <code>c/</code> (slides en alta),{' '}
              <code>m/</code> (miniaturas) y <code>r/</code> (recursos). Sin el .zip se importan solo los textos.
              {hasData && ' Las piezas que ya tenés se actualizan; el estado que cambiaste acá se respeta.'}
            </p>
            <label className="block space-y-1">
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">Calendario (.json)</span>
              <input type="file" accept=".json,application/json" disabled={running} onChange={(e) => setJson(e.target.files?.[0] || null)} className={fileBox} />
            </label>
            <label className="block space-y-1">
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">Imágenes y PDF (.zip, opcional)</span>
              <input type="file" accept=".zip,application/zip" disabled={running} onChange={(e) => setZip(e.target.files?.[0] || null)} className={fileBox} />
              {zip && <span className="block text-[12px] text-[var(--text-tertiary)]">{(zip.size / 1024 / 1024).toFixed(0)} MB</span>}
            </label>
          </>
        )}

        {progress && !result && !err && (
          <div className="space-y-1.5" aria-live="polite">
            <div className="h-2 rounded-full bg-[var(--bg-surface-muted)] overflow-hidden">
              <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[12px] text-[var(--text-secondary)] flex justify-between gap-2">
              <span className="truncate">{progress.label}</span>
              <span className="tabular-nums shrink-0">
                {progress.done}/{progress.total}
              </span>
            </p>
            <p className="text-[12px] text-[var(--text-tertiary)]">No cierres esta pantalla hasta que termine.</p>
          </div>
        )}

        {err && <p className="text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{err}</p>}

        {result && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-emerald-300">
              <Check className="w-5 h-5" /> Listo: {result.pieces} piezas y {result.files} archivos.
            </p>
            {result.failed.length > 0 && (
              <details className="text-[12px] text-amber-200">
                <summary>{result.failed.length} archivos no se pudieron subir (podés importar de nuevo: no se duplica nada)</summary>
                <ul className="mt-1 space-y-0.5 list-disc pl-5">
                  {result.failed.slice(0, 20).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {result ? (
            <button type="button" className={btnPrimary} onClick={onClose}>
              Ver mi contenido
            </button>
          ) : (
            <button type="button" className={btnPrimary} disabled={running || !json} onClick={start}>
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {running ? 'Importando…' : 'Importar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
