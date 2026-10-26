import React, { useState } from 'react';
import { Check, ExternalLink, Globe, Plus, Send, X } from 'lucide-react';
import { ClientPanel, newItemId } from '../panels/model';
import { driveApi } from '../automation/driveApi';
import { WEB_STAGES, WebSection, money, requestsByPage, sendPreview, stageIndex } from '../panels/web';

/**
 * Tu lado del panel web: etapa, versión de prueba (link de previsualización), cambios pedidos,
 * páginas, materiales que necesitás, pagos y entrega.
 */

const btn = 'px-3 py-2 rounded-[var(--radius-control)] text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40';
const btnPrimary = `${btn} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-strong)]`;
const btnGhost = `${btn} border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]`;
const card = 'rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]';
const input =
  'w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-base sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]';
const dm = (d?: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');
/** " el 20/10" si hay fecha (ISO), si no nada */
const on = (iso: string | undefined, before: string, after = '') => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${before}${dm(iso.slice(0, 10))}${after}` : '');

export const PanelWebEditor: React.FC<{ panel: ClientPanel; save: (p: ClientPanel) => Promise<void> }> = ({ panel, save }) => {
  const w = panel.web!;
  const [automationNotice, setAutomationNotice] = useState('');
  const set = async (next: WebSection) => {
    await save({ ...panel, web: next });
    if (next.stage === 'publicada' && w.stage !== 'publicada' && panel.projectId) {
      try {
        await driveApi(`/api/web-automation/${panel.projectId}/published`, {});
        setAutomationNotice('Revisá la ficha del proyecto para elegir y confirmar los archivos finales de Entregables.');
      } catch { setAutomationNotice('La web quedó publicada. El seguimiento se retomará en la próxima ejecución automática.'); }
    }
  };

  return (
    <section className={`${card} p-4 space-y-5`}>
      {automationNotice && <p role="status" className="text-sm text-[var(--accent)]">{automationNotice}</p>}
      <div className="flex items-center gap-2">
        <h2 className="flex-1 flex items-center gap-2 text-[15px] font-bold text-[var(--text-primary)]">
          <Globe className="w-4 h-4 text-[var(--accent)]" /> Desarrollo web
        </h2>
        <button
          type="button"
          onClick={() => window.confirm('¿Quitar la parte web de este panel? Se borran etapas, materiales, pedidos y pagos.') && save({ ...panel, web: undefined })}
          className="text-[12px] text-[var(--text-tertiary)] hover:text-rose-300"
        >
          Quitar
        </button>
      </div>

      {/* Etapa */}
      <div className="space-y-2">
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">Etapa</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {WEB_STAGES.map((s, i) => {
            const cur = stageIndex(w.stage);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => set({ ...w, stage: s.id })}
                className={`px-2 py-2 rounded-lg text-[12px] font-semibold border transition ${
                  i === cur
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] border-transparent'
                    : i < cur
                      ? 'border-emerald-500/30 text-emerald-300'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {i < cur ? '✓ ' : ''}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <PreviewBlock w={w} set={set} />
      <RequestsBlock w={w} set={set} />
      <PagesBlock w={w} set={set} />
      <MaterialsBlock w={w} set={set} />
      <PaymentsBlock w={w} set={set} />
      <DeliveryBlock w={w} set={set} />
    </section>
  );
};

type Block = React.FC<{ w: WebSection; set: (w: WebSection) => Promise<void> }>;

const Title: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div className="flex items-center gap-2">
    <p className="flex-1 text-[13px] font-semibold text-[var(--text-primary)]">{children}</p>
    {right}
  </div>
);

const PreviewBlock: Block = ({ w, set }) => {
  const [url, setUrl] = useState(w.preview?.url || '');
  const [rounds, setRounds] = useState(w.preview?.maxRounds || 2);
  const p = w.preview;
  const nextRound = !p ? 1 : p.state === 'cambios' ? p.round + 1 : p.round;
  const stateText = !p
    ? null
    : p.state === 'revisar'
      ? { t: `Ronda ${p.round} de ${p.maxRounds} · esperando que la revise${on(p.sentAt, ' (enviada el ', ')')}`, c: 'text-amber-300' }
      : p.state === 'aprobada'
        ? { t: `Ronda ${p.round} · aprobada${on(p.reviewedAt, ' el ')}`, c: 'text-emerald-300' }
        : { t: `Ronda ${p.round} · pidió cambios${on(p.reviewedAt, ' el ')}`, c: 'text-rose-300' };
  const overRounds = nextRound > rounds;
  return (
    <div className="space-y-2">
      <Title>Versión de prueba</Title>
      {stateText && <p className={`text-[13px] ${stateText.c}`}>{stateText.t}</p>}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link de previsualización (ej: https://prueba.tuweb.com)" className={input} />
        <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)] whitespace-nowrap">
          Rondas incluidas
          <input type="number" min={1} max={9} value={rounds} onChange={(e) => setRounds(Math.max(1, Number(e.target.value) || 1))} className={`${input} w-16`} />
        </label>
      </div>
      {overRounds && <p className="text-[12px] text-amber-300">Esta sería la ronda {nextRound}: ya pasó las {rounds} incluidas.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={!/^https?:\/\/\S+\.\S+/.test(url.trim())} onClick={() => set(sendPreview(w, url, rounds))}>
          <Send className="w-4 h-4" /> {p && p.state === 'revisar' && p.url === url.trim() ? 'Actualizar' : `Mandar para revisar (ronda ${nextRound})`}
        </button>
        {p?.url && (
          <a href={p.url} target="_blank" rel="noopener noreferrer" className={btnGhost}>
            <ExternalLink className="w-4 h-4" /> Abrir
          </a>
        )}
      </div>
    </div>
  );
};

const RequestsBlock: Block = ({ w, set }) => {
  const [showDone, setShowDone] = useState(false);
  const open = w.requests.filter((r) => !r.done);
  const done = w.requests.filter((r) => r.done);
  if (!w.requests.length) return null;
  const toggle = (id: string, v: boolean) =>
    set({ ...w, requests: w.requests.map((r) => (r.id === id ? { ...r, done: v, doneAt: v ? new Date().toISOString() : undefined } : r)) });
  const list = showDone ? [...open, ...done] : open;
  return (
    <div className="space-y-2">
      <Title
        right={
          done.length > 0 && (
            <button type="button" onClick={() => setShowDone((v) => !v)} className="text-[12px] text-[var(--text-secondary)] underline">
              {showDone ? 'Ocultar hechos' : `Ver hechos (${done.length})`}
            </button>
          )
        }
      >
        Cambios pedidos {open.length ? `· ${open.length} ${open.length === 1 ? 'pendiente' : 'pendientes'}` : '· todo hecho'}
      </Title>
      {requestsByPage(list).map((g) => (
        <div key={g.page} className="rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] p-3 space-y-1.5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">{g.page}</p>
          {g.items.map((r) => (
            <label key={r.id} className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={r.done} onChange={(e) => toggle(r.id, e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--accent)] shrink-0" />
              <span className="flex-1 min-w-0">
                <span className={`block text-sm ${r.done ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>{r.text}</span>
                <span className="block text-[11px] text-[var(--text-tertiary)]">
                  {r.kind === 'revision' ? `Ronda ${r.round}` : 'Después de publicada'} · {dm(r.at.slice(0, 10))}
                </span>
              </span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
};

const PagesBlock: Block = ({ w, set }) => {
  const [name, setName] = useState('');
  const add = () => {
    const n = name.trim();
    if (!n || w.pages.includes(n)) return;
    set({ ...w, pages: [...w.pages, n] });
    setName('');
  };
  return (
    <div className="space-y-2">
      <Title>Páginas (el cliente elige sobre cuál pide cambios)</Title>
      <div className="flex flex-wrap gap-1.5">
        {w.pages.map((p) => (
          <span key={p} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-[var(--bg-surface-muted)] text-[12px] text-[var(--text-primary)]">
            {p}
            <button type="button" onClick={() => set({ ...w, pages: w.pages.filter((x) => x !== p) })} className="p-0.5 rounded-full hover:bg-black/20" aria-label={`Quitar ${p}`}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Agregar página (ej: Nosotros)" className={input} />
        <button type="button" className={btnGhost} onClick={add} disabled={!name.trim()}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const MaterialsBlock: Block = ({ w, set }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const add = () => {
    if (!title.trim()) return;
    set({ ...w, materials: [...w.materials, { id: newItemId(), title: title.trim(), date: date || undefined, done: false }] });
    setTitle('');
    setDate('');
  };
  const missing = w.materials.filter((m) => !m.done).length;
  return (
    <div className="space-y-2">
      <Title>Lo que necesitás del cliente {w.materials.length ? `· ${missing ? `faltan ${missing}` : 'está todo'}` : ''}</Title>
      <ul className="space-y-1.5">
        {w.materials.map((m) => (
          <li key={m.id} className="flex items-start gap-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] px-3 py-2">
            <input
              type="checkbox"
              checked={m.done}
              onChange={(e) => set({ ...w, materials: w.materials.map((x) => (x.id === m.id ? { ...x, done: e.target.checked, doneAt: e.target.checked ? new Date().toISOString() : undefined } : x)) })}
              className="mt-0.5 w-4 h-4 accent-[var(--accent)] shrink-0"
              aria-label={`Recibido: ${m.title}`}
            />
            <span className="flex-1 min-w-0">
              <span className={`block text-sm ${m.done ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]'}`}>{m.title}</span>
              {m.date && <span className="block text-[11px] text-[var(--text-tertiary)]">Para el {dm(m.date)}</span>}
              {m.link && (
                <a href={m.link} target="_blank" rel="noopener noreferrer" className="block text-[12px] text-sky-300 truncate underline">
                  {m.link}
                </a>
              )}
            </span>
            <button type="button" onClick={() => set({ ...w, materials: w.materials.filter((x) => x.id !== m.id) })} className="p-1 text-[var(--text-tertiary)] hover:text-rose-300" aria-label="Quitar">
              <X className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Ej: Fotos del equipo" className={input} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} sm:w-44`} aria-label="Para cuándo (opcional)" />
        <button type="button" className={btnGhost} onClick={add} disabled={!title.trim()}>
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>
    </div>
  );
};

const PaymentsBlock: Block = ({ w, set }) => {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const add = () => {
    if (!label.trim()) return;
    const n = Number(amount.replace(/[^\d.]/g, ''));
    set({ ...w, payments: [...w.payments, { id: newItemId(), label: label.trim(), amount: n > 0 ? n : undefined, currency, paid: false }] });
    setLabel('');
    setAmount('');
  };
  return (
    <div className="space-y-2">
      <Title>Pagos (lo ve el cliente)</Title>
      <ul className="space-y-1.5">
        {w.payments.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] px-3 py-2">
            <span className="flex-1 min-w-0 text-sm text-[var(--text-primary)] truncate">
              {p.label}
              {p.amount ? <span className="text-[var(--text-secondary)]"> · {money(p.amount, p.currency)}</span> : null}
            </span>
            <button
              type="button"
              onClick={() => set({ ...w, payments: w.payments.map((x) => (x.id === p.id ? { ...x, paid: !x.paid, paidAt: !x.paid ? new Date().toISOString() : undefined } : x)) })}
              className={`px-2.5 py-1 rounded-full text-[12px] font-semibold border ${p.paid ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'}`}
            >
              {p.paid ? (
                <>
                  <Check className="w-3 h-3 inline" /> Pagado
                </>
              ) : (
                'Pendiente'
              )}
            </button>
            <button type="button" onClick={() => set({ ...w, payments: w.payments.filter((x) => x.id !== p.id) })} className="p-1 text-[var(--text-tertiary)] hover:text-rose-300" aria-label="Quitar pago">
              <X className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 grid-cols-[1fr_auto] sm:grid-cols-[1fr_8rem_5rem_auto]">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: Seña 50%" className={`${input} col-span-2 sm:col-span-1`} />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="Monto" className={input} />
        <select value={currency} onChange={(e) => setCurrency(e.target.value as 'ARS' | 'USD')} className={input}>
          <option value="ARS">$</option>
          <option value="USD">US$</option>
        </select>
        <button type="button" className={`${btnGhost} col-span-2 sm:col-span-1`} onClick={add} disabled={!label.trim()}>
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>
    </div>
  );
};

const DeliveryBlock: Block = ({ w, set }) => (
  <div className="space-y-2">
    <Title>Entrega</Title>
    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <input
        defaultValue={w.delivery?.url || ''}
        placeholder="Link de la web publicada"
        onBlur={(e) => e.target.value.trim() !== (w.delivery?.url || '') && set({ ...w, delivery: { ...w.delivery, url: e.target.value.trim() || undefined } })}
        className={input}
      />
      <input
        type="date"
        defaultValue={w.delivery?.date || ''}
        onChange={(e) => set({ ...w, delivery: { ...w.delivery, date: e.target.value || undefined } })}
        className={`${input} sm:w-44`}
        aria-label="Fecha de entrega"
      />
    </div>
    <p className="text-[12px] text-[var(--text-tertiary)]">Cuando la marques como Publicada, el cliente ve el link y un botón para pedirte cambios.</p>
  </div>
);
