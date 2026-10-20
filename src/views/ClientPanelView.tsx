import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Circle, Clapperboard, Copy, Image as ImageIcon, Images, Loader2, Pencil, ThumbsUp } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { AssetImg } from '../content/AssetImg';
import { PANEL_STATE_LABEL, PanelPiece, PanelSnapshot, PanelTask, byTask } from '../panels/model';
import { sendClientAction, subscribePanelSnapshot } from '../panels/store';
import { todayLocal } from '../utils/dates';

/**
 * PANEL DEL CLIENTE (página pública /panel/{token})
 * Sin login: objetivos de la semana, sus tareas (las marca él) y el contenido para aprobar.
 * Lo que toca lo registra el servidor y te llega el aviso.
 */

const dm = (d?: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');
const dayName = (d: string) => {
  const wd = new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long' });
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${dm(d)}`;
};

export const ClientPanelView: React.FC<{ token: string }> = ({ token }) => {
  const [data, setData] = useState<PanelSnapshot | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  useEffect(() => {
    document.title = 'Mi panel · .Cero';
    return subscribePanelSnapshot(
      token,
      (snap) => {
        setData(snap);
        setState(snap ? 'ready' : 'missing');
      },
      () => setState('error')
    );
  }, [token]);

  if (state === 'loading') {
    return (
      <Shell>
        <div className="flex justify-center py-24 text-zinc-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </Shell>
    );
  }
  if (state !== 'ready' || !data) {
    return (
      <Shell>
        <div className="text-center py-20 space-y-2">
          <p className="text-zinc-200 font-semibold">{state === 'error' ? 'No pudimos cargar tu panel' : 'Este link no está disponible'}</p>
          <p className="text-sm text-zinc-500">{state === 'error' ? 'Revisá tu conexión y volvé a intentar.' : 'Pedí un link nuevo por WhatsApp.'}</p>
        </div>
      </Shell>
    );
  }

  const goalsDone = data.goals.filter((g) => g.done).length;
  const pending = data.pieces.filter((p) => p.state === 'para_aprobar');
  const reviewed = data.pieces.filter((p) => p.state !== 'para_aprobar');

  return (
    <Shell>
      <header className="space-y-1">
        <p className="text-sm text-zinc-400">Hola,</p>
        <h1 className="text-2xl font-bold tracking-tight">{data.clientName}</h1>
        {data.note && <p className="text-[15px] text-zinc-300 bg-zinc-900/70 border border-zinc-800 rounded-2xl px-4 py-3 mt-2 whitespace-pre-line">{data.note}</p>}
      </header>

      {data.goals.length > 0 && (
        <Card title={`Objetivos de la semana del ${dm(data.weekStart)}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-[#FF5D1D] transition-all" style={{ width: `${(goalsDone / data.goals.length) * 100}%` }} />
            </div>
            <span className="text-sm text-zinc-400 tabular-nums">
              {goalsDone}/{data.goals.length}
            </span>
          </div>
          <ul className="space-y-2">
            {data.goals.map((g) => (
              <li key={g.id} className="flex items-start gap-2.5 text-[15px]">
                {g.done ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <Circle className="w-5 h-5 text-zinc-600 shrink-0" />}
                <span className={g.done ? 'text-zinc-500 line-through' : 'text-zinc-100'}>{g.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.tasks.length > 0 && (
        <Card title="Lo que te toca">
          <ul className="space-y-2">
            {[...data.tasks].sort(byTask).map((t) => (
              <TaskItem key={t.id} token={token} t={t} />
            ))}
          </ul>
        </Card>
      )}

      {pending.length > 0 && (
        <Card title={`Para aprobar (${pending.length})`}>
          <div className="space-y-6">
            {pending.map((p) => (
              <PieceItem key={p.id} token={token} p={p} />
            ))}
          </div>
        </Card>
      )}

      {reviewed.length > 0 && (
        <Card title="Ya revisadas">
          <div className="space-y-6">
            {reviewed.map((p) => (
              <PieceItem key={p.id} token={token} p={p} />
            ))}
          </div>
        </Card>
      )}

      {!data.goals.length && !data.tasks.length && !data.pieces.length && (
        <p className="text-center text-zinc-500 py-10">Todavía no hay nada cargado. Pronto vas a ver acá tus objetivos, tareas y contenido.</p>
      )}

      <p className="text-center text-[12px] text-zinc-600 pt-4">Actualizado el {dm(data.updatedAt.slice(0, 10))}</p>
    </Shell>
  );
};

// ---------------- Tarea ----------------

const TaskItem: React.FC<{ token: string; t: PanelTask }> = ({ token, t }) => {
  const [done, setDone] = useState(t.done);
  const [busy, setBusy] = useState(false);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState(t.clientNote || '');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setDone(t.done), [t.done]);
  const late = !done && t.date && t.date < todayLocal();

  const send = async (nextDone: boolean, withNote?: string) => {
    setBusy(true);
    setErr(null);
    const prev = done;
    setDone(nextDone);
    try {
      await sendClientAction(token, { type: 'tarea', taskId: t.id, done: nextDone, note: withNote });
      setNoting(false);
    } catch (e) {
      setDone(prev);
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`rounded-xl border px-3 py-2.5 ${late ? 'border-rose-500/40 bg-rose-500/5' : 'border-zinc-800 bg-zinc-950/40'}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => send(!done, note.trim() || undefined)}
          className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition ${done ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-500'}`}
          aria-label={done ? `Desmarcar: ${t.title}` : `Marcar como hecha: ${t.title}`}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : done && <Check className="w-4 h-4 text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-[15px] ${done ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>{t.title}</p>
          {(t.date || t.detail) && (
            <p className={`text-[13px] ${late ? 'text-rose-300' : 'text-zinc-400'}`}>
              {t.date ? `${late ? 'Era para el' : 'Para el'} ${dm(t.date)}` : ''}
              {t.date && t.detail ? ' · ' : ''}
              {t.detail}
            </p>
          )}
          {!noting && (
            <button type="button" onClick={() => setNoting(true)} className="mt-1 text-[12px] text-zinc-500 underline">
              {t.clientNote ? `Tu nota: ${t.clientNote}` : 'Dejar una nota'}
            </button>
          )}
          {noting && (
            <div className="mt-2 space-y-2">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ej: Te mandé las fotos por mail" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-base text-zinc-100 focus:outline-none focus:border-[#FF5D1D]" />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setNoting(false)} className="px-3 py-1.5 text-sm text-zinc-400">
                  Cancelar
                </button>
                <button type="button" disabled={busy || !note.trim()} onClick={() => send(true, note.trim())} className="px-3 py-1.5 rounded-lg bg-[#FF5D1D] text-white text-sm font-semibold disabled:opacity-40">
                  Enviar y marcar hecha
                </button>
              </div>
            </div>
          )}
          {err && <p className="text-[12px] text-rose-300 mt-1">{err}</p>}
        </div>
      </div>
    </li>
  );
};

// ---------------- Pieza para aprobar ----------------

const SupportIcon: React.FC<{ s: PanelPiece['support'] }> = ({ s }) =>
  s === 'reel' ? <Clapperboard className="w-4 h-4" /> : s === 'carrusel' ? <Images className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />;

const PieceItem: React.FC<{ token: string; p: PanelPiece }> = ({ token, p }) => {
  const [i, setI] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'idle' | 'cambios'>('idle');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const decide = async (decision: 'aprobar' | 'cambios') => {
    setBusy(true);
    setErr(null);
    try {
      await sendClientAction(token, { type: 'pieza', pieceId: p.id, decision, comment: decision === 'cambios' ? comment.trim() : undefined });
      setMode('idle');
      setComment('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tone =
    p.state === 'aprobada' ? 'text-emerald-300' : p.state === 'cambios' ? 'text-rose-300' : p.state === 'publicada' ? 'text-sky-300' : 'text-amber-300';

  return (
    <article className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-zinc-200">{dayName(p.date)}</span>
        <span className="inline-flex items-center gap-1 text-zinc-500">
          <SupportIcon s={p.support} /> {p.support === 'estatico' ? 'Estático' : p.support === 'reel' ? 'Reel' : 'Carrusel'}
        </span>
        <span className={`ml-auto text-[12px] font-semibold ${tone}`}>{PANEL_STATE_LABEL[p.state]}</span>
      </div>
      <h3 className="text-lg font-bold leading-snug">{p.title}</h3>

      {p.slides.length > 0 && (
        <div className="space-y-2">
          <div
            ref={strip}
            className="flex overflow-x-auto snap-x snap-mandatory rounded-xl [scrollbar-width:none]"
            onScroll={(e) => {
              const el = e.currentTarget;
              setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
            }}
          >
            {p.slides.map((s, k) => (
              <div key={k} className="shrink-0 w-full snap-center aspect-[4/5] bg-zinc-900">
                <AssetImg src={s.display} alt={`Slide ${k + 1}`} className="w-full h-full object-contain" />
              </div>
            ))}
          </div>
          {p.slides.length > 1 && (
            <div className="flex items-center justify-center gap-1.5">
              {p.slides.map((_, k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => strip.current?.scrollTo({ left: k * strip.current.clientWidth, behavior: 'smooth' })}
                  className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-[#FF5D1D]' : 'w-1.5 bg-zinc-600'}`}
                  aria-label={`Ir a la slide ${k + 1}`}
                />
              ))}
              <span className="ml-2 text-[12px] text-zinc-500 tabular-nums">
                {i + 1}/{p.slides.length}
              </span>
            </div>
          )}
        </div>
      )}

      {p.caption && (
        <div className="rounded-xl bg-zinc-950/60 border border-zinc-800 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] uppercase tracking-wide text-zinc-500 font-semibold">Descripción</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(p.caption!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* sin portapapeles */
                }
              }}
              className="text-[12px] text-zinc-400 inline-flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copiada' : 'Copiar'}
            </button>
          </div>
          <p className="text-[14px] text-zinc-200 whitespace-pre-line leading-relaxed">{p.caption}</p>
        </div>
      )}

      {p.clientComment && <p className="text-[13px] text-zinc-400">Tu comentario: "{p.clientComment}"</p>}

      {p.state !== 'publicada' && mode === 'idle' && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy || p.state === 'aprobada'} onClick={() => decide('aprobar')} className="h-11 rounded-xl bg-emerald-500 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />} {p.state === 'aprobada' ? 'Aprobada' : 'Aprobar'}
          </button>
          <button type="button" disabled={busy} onClick={() => setMode('cambios')} className="h-11 rounded-xl border border-zinc-700 text-zinc-100 font-semibold inline-flex items-center justify-center gap-2">
            <Pencil className="w-4 h-4" /> Pedir cambios
          </button>
        </div>
      )}
      {mode === 'cambios' && (
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            autoFocus
            placeholder="¿Qué cambiarías? Ej: en la slide 3 poner la foto de la cocina"
            className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-base text-zinc-100 focus:outline-none focus:border-[#FF5D1D]"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setMode('idle')} className="px-3 py-2 text-sm text-zinc-400">
              Cancelar
            </button>
            <button type="button" disabled={busy || !comment.trim()} onClick={() => decide('cambios')} className="px-4 py-2 rounded-xl bg-[#FF5D1D] text-white text-sm font-semibold disabled:opacity-40">
              {busy ? 'Enviando…' : 'Enviar cambios'}
            </button>
          </div>
        </div>
      )}
      {err && <p className="text-[13px] text-rose-300">{err}</p>}
    </article>
  );
};

// ---------------- Marco ----------------

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#0B0F17] text-zinc-100">
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      <BrandLogo size="sm" className="mb-2" />
      {children}
    </div>
  </div>
);

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">{title}</h2>
    {children}
  </section>
);
