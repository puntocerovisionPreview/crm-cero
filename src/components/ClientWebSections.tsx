import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, ExternalLink, Globe, Loader2, Pencil, Plus, ThumbsUp, X } from 'lucide-react';
import { WEB_STAGES, WebMaterial, WebSection, money, stageIndex } from '../panels/web';
import { sendClientAction } from '../panels/store';
import { todayLocal } from '../utils/dates';

/**
 * Lo que ve el cliente de su web: en qué etapa está, la versión de prueba para aprobar
 * o pedir cambios por página, lo que necesitamos de él, los pagos y, ya publicada,
 * el link de su web y un botón para pedir cambios.
 */

const dm = (d?: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');
const field = 'w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-base text-zinc-100 focus:outline-none focus:border-[#FF5D1D]';

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">{title}</h2>
    {children}
  </section>
);

export const ClientWebSections: React.FC<{ token: string; web: WebSection }> = ({ token, web }) => {
  const cur = stageIndex(web.stage);
  const published = web.stage === 'publicada';
  return (
    <>
      {/* Etapas */}
      <Card title="Tu web">
        <div className="flex gap-1 mb-3" aria-hidden>
          {WEB_STAGES.map((s, i) => (
            <div key={s.id} className={`h-1.5 flex-1 rounded-full ${i <= cur ? 'bg-[#FF5D1D]' : 'bg-zinc-800'}`} />
          ))}
        </div>
        <p className="text-[17px] font-bold text-zinc-100 flex items-center gap-2">
          <Globe className="w-5 h-5 text-[#FF5D1D]" /> {WEB_STAGES[cur].label}
          <span className="text-[13px] font-normal text-zinc-500">
            · paso {cur + 1} de {WEB_STAGES.length}
          </span>
        </p>
        <p className="text-sm text-zinc-400 mt-0.5">{WEB_STAGES[cur].client}</p>
        {!published && cur < WEB_STAGES.length - 1 && <p className="text-[13px] text-zinc-500 mt-2">Sigue: {WEB_STAGES[cur + 1].label}</p>}
        {published && web.delivery?.url && (
          <a href={web.delivery.url} target="_blank" rel="noopener noreferrer" className="mt-3 h-11 rounded-xl bg-[#FF5D1D] text-white font-semibold flex items-center justify-center gap-2">
            <ExternalLink className="w-4 h-4" /> Ver mi web
          </a>
        )}
        {web.delivery?.date && <p className="text-[13px] text-zinc-500 mt-2">{published ? 'Entregada' : 'Entrega estimada'}: {dm(web.delivery.date)}</p>}
      </Card>

      {web.preview && !published && <PreviewCard token={token} web={web} />}
      {web.materials.length > 0 && !published && <MaterialsCard token={token} items={web.materials} />}
      {web.payments.length > 0 && (
        <Card title="Pagos">
          <ul className="space-y-2">
            {web.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 text-[15px]">
                {p.paid ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <span className="w-5 h-5 rounded-full border-2 border-zinc-600 shrink-0" />}
                <span className="flex-1 text-zinc-100">{p.label}</span>
                {p.amount ? <span className="text-zinc-400 tabular-nums">{money(p.amount, p.currency)}</span> : null}
                <span className={`text-[12px] font-semibold ${p.paid ? 'text-emerald-300' : 'text-zinc-500'}`}>{p.paid ? 'Pagado' : 'Pendiente'}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {published && <ChangeRequestCard token={token} web={web} />}
    </>
  );
};

// ---------- Versión de prueba ----------

const PreviewCard: React.FC<{ token: string; web: WebSection }> = ({ token, web }) => {
  const p = web.preview!;
  const pages = [...web.pages, 'General'];
  const [mode, setMode] = useState<'idle' | 'cambios'>('idle');
  const [items, setItems] = useState<{ page: string; text: string }[]>([{ page: pages[0], text: '' }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const roundRequests = web.requests.filter((r) => r.kind === 'revision' && r.round === p.round);

  const send = async (decision: 'aprobar' | 'cambios') => {
    setBusy(true);
    setErr(null);
    try {
      await sendClientAction(token, {
        type: 'prueba',
        decision,
        items: decision === 'cambios' ? items.filter((x) => x.text.trim()).map((x) => ({ page: x.page === 'General' ? undefined : x.page, text: x.text.trim() })) : [],
      });
      setMode('idle');
      setItems([{ page: pages[0], text: '' }]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={`Versión de prueba · ronda ${p.round} de ${p.maxRounds}`}>
      <a href={p.url} target="_blank" rel="noopener noreferrer" className="h-11 rounded-xl border border-zinc-700 text-zinc-100 font-semibold flex items-center justify-center gap-2">
        <ExternalLink className="w-4 h-4" /> Abrir la versión de prueba
      </a>

      {p.state === 'aprobada' && <p className="mt-3 text-[15px] text-emerald-300 flex items-center gap-2"><Check className="w-4 h-4" /> Aprobaste esta versión. ¡Gracias!</p>}

      {p.state === 'cambios' && (
        <div className="mt-3 space-y-2">
          <p className="text-[15px] text-zinc-200">Estamos trabajando en tus cambios. Te avisamos cuando esté la próxima versión.</p>
          <ul className="space-y-1">
            {roundRequests.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-[14px]">
                {r.done ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" /> : <span className="w-4 h-4 mt-0.5 rounded-full border-2 border-zinc-600 shrink-0" />}
                <span className={r.done ? 'text-zinc-500 line-through' : 'text-zinc-300'}>
                  {r.page ? <b className="font-semibold">{r.page}: </b> : null}
                  {r.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.state === 'revisar' && mode === 'idle' && (
        <>
          <p className="mt-3 text-[14px] text-zinc-400">Revisala con tiempo, en la compu y en el celular. Después contanos:</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button type="button" disabled={busy} onClick={() => send('aprobar')} className="h-11 rounded-xl bg-emerald-500 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />} Aprobar
            </button>
            <button type="button" disabled={busy} onClick={() => setMode('cambios')} className="h-11 rounded-xl border border-zinc-700 text-zinc-100 font-semibold inline-flex items-center justify-center gap-2">
              <Pencil className="w-4 h-4" /> Pedir cambios
            </button>
          </div>
        </>
      )}

      {p.state === 'revisar' && mode === 'cambios' && (
        <div className="mt-3 space-y-3">
          <p className="text-[14px] text-zinc-400">Un cambio por renglón. Elegí la página y escribí qué cambiarías.</p>
          {items.map((it, i) => (
            <div key={i} className="space-y-1.5 rounded-xl border border-zinc-800 p-2.5">
              <div className="flex items-center gap-2">
                <select value={it.page} onChange={(e) => setItems((arr) => arr.map((x, k) => (k === i ? { ...x, page: e.target.value } : x)))} className={field}>
                  {pages.map((pg) => (
                    <option key={pg} value={pg}>
                      {pg}
                    </option>
                  ))}
                </select>
                {items.length > 1 && (
                  <button type="button" onClick={() => setItems((arr) => arr.filter((_, k) => k !== i))} className="p-2 text-zinc-500" aria-label="Quitar este cambio">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <textarea
                value={it.text}
                onChange={(e) => setItems((arr) => arr.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
                rows={2}
                placeholder="Ej: cambiar la foto de arriba por la de la obra de Villa Allende"
                className={field}
              />
            </div>
          ))}
          <button type="button" onClick={() => setItems((arr) => [...arr, { page: pages[0], text: '' }])} className="text-[14px] text-zinc-300 inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> Agregar otro cambio
          </button>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setMode('idle')} className="px-3 py-2 text-sm text-zinc-400">
              Cancelar
            </button>
            <button type="button" disabled={busy || !items.some((x) => x.text.trim())} onClick={() => send('cambios')} className="px-4 py-2 rounded-xl bg-[#FF5D1D] text-white text-sm font-semibold disabled:opacity-40">
              {busy ? 'Enviando…' : 'Enviar cambios'}
            </button>
          </div>
        </div>
      )}
      {err && <p className="text-[13px] text-rose-300 mt-2">{err}</p>}
    </Card>
  );
};

// ---------- Materiales ----------

const MaterialsCard: React.FC<{ token: string; items: WebMaterial[] }> = ({ token, items }) => {
  const missing = items.filter((m) => !m.done).length;
  return (
    <Card title={missing ? `Lo que necesitamos de vos · faltan ${missing}` : 'Lo que necesitamos de vos · ¡está todo!'}>
      <ul className="space-y-2">
        {[...items].sort((a, b) => Number(a.done) - Number(b.done)).map((m) => (
          <MaterialItem key={m.id} token={token} m={m} />
        ))}
      </ul>
    </Card>
  );
};

const MaterialItem: React.FC<{ token: string; m: WebMaterial }> = ({ token, m }) => {
  const [done, setDone] = useState(m.done);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState(m.link || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setDone(m.done), [m.done]);
  const late = !done && m.date && m.date < todayLocal();

  const send = async (next: boolean) => {
    setBusy(true);
    setErr(null);
    const prev = done;
    setDone(next);
    try {
      await sendClientAction(token, { type: 'material', id: m.id, done: next, link: next ? link.trim() || undefined : undefined });
      setOpen(false);
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
          onClick={() => (done ? send(false) : setOpen((v) => !v))}
          className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-500'}`}
          aria-label={done ? `Desmarcar: ${m.title}` : `Ya lo mandé: ${m.title}`}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : done && <Check className="w-4 h-4 text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-[15px] ${done ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>{m.title}</p>
          {m.date && !done && <p className={`text-[13px] ${late ? 'text-rose-300' : 'text-zinc-400'}`}>{late ? 'Era para el' : 'Para el'} {dm(m.date)}</p>}
          {done && m.link && (
            <a href={m.link} target="_blank" rel="noopener noreferrer" className="text-[12px] text-zinc-500 underline truncate block">
              {m.link}
            </a>
          )}
          {!done && !open && (
            <button type="button" onClick={() => setOpen(true)} className="mt-1 text-[13px] text-[#FF8A5B] font-semibold">
              Ya lo mandé
            </button>
          )}
          {m.driveFolderUrl && <a href={m.driveFolderUrl} target="_blank" rel="noopener noreferrer" className="block mt-2 text-sm text-orange-300 underline">Abrir carpeta y subir archivos</a>}
          {open && !done && (
            <div className="mt-2 space-y-2">
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link de Drive o Dropbox (opcional)" className={field} />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-zinc-400">
                  Cancelar
                </button>
                <button type="button" disabled={busy} onClick={() => send(true)} className="px-3 py-1.5 rounded-lg bg-[#FF5D1D] text-white text-sm font-semibold">
                  Listo, lo mandé
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

// ---------- Después de publicada: pedir cambios ----------

const ChangeRequestCard: React.FC<{ token: string; web: WebSection }> = ({ token, web }) => {
  const pages = [...web.pages, 'General'];
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(pages[0]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mine = web.requests.filter((r) => r.kind === 'cambio').sort((a, b) => b.at.localeCompare(a.at));

  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      await sendClientAction(token, { type: 'pedido', page: page === 'General' ? undefined : page, text: text.trim() });
      setText('');
      setOpen(false);
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Cambios en tu web">
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="w-full h-11 rounded-xl border border-zinc-700 text-zinc-100 font-semibold inline-flex items-center justify-center gap-2">
          <Pencil className="w-4 h-4" /> Pedir un cambio en mi web
        </button>
      )}
      {sent && <p className="mt-2 text-[14px] text-emerald-300">¡Listo! Ya nos llegó tu pedido.</p>}
      {open && (
        <div className="space-y-2">
          <select value={page} onChange={(e) => setPage(e.target.value)} className={field}>
            {pages.map((pg) => (
              <option key={pg} value={pg}>
                {pg}
              </option>
            ))}
          </select>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus placeholder="¿Qué necesitás cambiar? Ej: sumar la obra nueva en Proyectos" className={field} />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-zinc-400">
              Cancelar
            </button>
            <button type="button" disabled={busy || !text.trim()} onClick={send} className="px-4 py-2 rounded-xl bg-[#FF5D1D] text-white text-sm font-semibold disabled:opacity-40">
              {busy ? 'Enviando…' : 'Enviar pedido'}
            </button>
          </div>
        </div>
      )}
      {err && <p className="text-[13px] text-rose-300 mt-2">{err}</p>}
      {mine.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {mine.slice(0, 10).map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-[14px]">
              {r.done ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" /> : <span className="w-4 h-4 mt-0.5 rounded-full border-2 border-zinc-600 shrink-0" />}
              <span className="flex-1 text-zinc-300">
                {r.page ? <b className="font-semibold">{r.page}: </b> : null}
                {r.text}
              </span>
              <span className={`text-[12px] shrink-0 ${r.done ? 'text-emerald-300' : 'text-zinc-500'}`}>{r.done ? 'Hecho' : 'Pendiente'}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
