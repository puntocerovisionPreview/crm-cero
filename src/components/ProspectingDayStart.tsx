import React, { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardCopy, Instagram, Loader2, MessageCircle, SkipForward, Sparkles, Sun, X, Zap } from 'lucide-react';
import { Prospect, ProspectingSettings } from '../types';
import { FUNNEL_STEPS, QUEUE_LABELS, QueueItem, funnelStepOf, normalizeInstagram, renderTemplate, templateFor, variantFor, ProspectAction } from '../prospecting/core';
import { COUNTRY_NAMES } from '../prospecting/pool';
import { generatePersonalLine, friendlyError } from '../prospecting/actions';
import { formatWhatsAppUrl } from '../utils/contact';

const btn = 'px-3 py-2 rounded-[var(--radius-control)] text-sm font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40';
const btnPrimary = `${btn} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-strong)]`;
const btnGhost = `${btn} border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]`;
const card = 'rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]';

type Act = (p: Prospect, a: ProspectAction, note?: string) => Promise<void> | void;

/** Hora en su país, con color según si es buen momento para escribir. */
export const LocalTimeBadge: React.FC<{ item: QueueItem }> = ({ item }) => {
  const t = item.localTime;
  if (!t) return null;
  const color = t.quality === 'bueno' ? 'text-emerald-400' : t.quality === 'regular' ? 'text-amber-400' : 'text-red-400';
  const country = item.prospect.country ? COUNTRY_NAMES[item.prospect.country] || item.prospect.country : '';
  return (
    <span className={`text-[11px] font-medium tabular-nums ${color}`} title={t.quality === 'malo' ? 'Fuera de horario laboral en su país' : 'Hora en su país'}>
      {t.label} en {country}
      {t.quality === 'malo' ? ' (mejor más tarde)' : ''}
    </span>
  );
};

/** Botón "Frase con IA": lee su web y personaliza el primer mensaje. */
export const PersonalLineButton: React.FC<{ prospect: Prospect; small?: boolean }> = ({ prospect, small }) => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      await generatePersonalLine(prospect);
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={run} disabled={busy} className={`${btnGhost} ${small ? 'py-1.5 text-xs' : ''}`} title="Lee su web y escribe una frase a medida">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />}
        {busy ? 'Leyendo su web…' : prospect.personalLine ? 'Otra frase' : 'Frase con IA'}
      </button>
      {err && <span className="text-[11px] text-red-400 mt-1">{err}</span>}
    </span>
  );
};

const AddMoreRow: React.FC<{ poolAvailable: number; addMore: (n: number) => void; busy: boolean; message: { kind: 'ok' | 'error'; text: string } | null }> = ({
  poolAvailable,
  addMore: onAddMore,
  busy,
  message,
}) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-[var(--text-secondary)] flex-1 min-w-[10rem]">
        {poolAvailable > 0 ? `¿Sumar más? Quedan ${poolAvailable.toLocaleString('es-AR')} en la reserva.` : 'La reserva está vacía: subí el CSV en la pestaña Reserva.'}
      </span>
      {poolAvailable > 0 &&
        [2, 5, 10].map((n) => (
          <button key={n} type="button" disabled={busy} className={`${n === 5 ? btnPrimary : btnGhost} py-1.5 text-xs min-w-[3rem]`} onClick={() => onAddMore(Math.min(n, poolAvailable))}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `+${n}`}
          </button>
        ))}
    </div>
    {message && <p className={`text-xs ${message.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{message.text}</p>}
  </div>
);

// ======================= INICIO DEL DÍA =======================

/**
 * Lo primero del día, antes del panel:
 * 1) ¿Qué pasó con los que les escribiste y no anotaste? (de días anteriores)
 * 2) A quién escribirle hoy (+ sumar más de la reserva) → modo ráfaga o panel.
 */
export const DayStartFlow: React.FC<{
  pending: Prospect[];
  queue: QueueItem[];
  overflow: number;
  poolAvailable: number;
  addMore: { addMore: (n: number) => void; busy: boolean; message: { kind: 'ok' | 'error'; text: string } | null };
  onAct: Act;
  onBurst: () => void;
  onFinish: () => void;
  recycledNotice?: string | null;
}> = ({ pending, queue, overflow, poolAvailable, addMore, onAct, onBurst, onFinish, recycledNotice }) => {
  const [step, setStep] = useState<1 | 2>(pending.length > 0 ? 1 : 2);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toWrite = queue.filter((i) => i.kind === 'primer' || i.kind === 'seguimiento');
  const urgent = queue.filter((i) => i.kind !== 'primer' && i.kind !== 'seguimiento');

  const outcome = async (p: Prospect, a: ProspectAction, note?: string) => {
    setBusyId(p.id);
    try {
      await onAct(p, a, note);
    } finally {
      setBusyId(null);
    }
  };

  const hello = new Date().getHours() < 13 ? 'Buen día' : new Date().getHours() < 20 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-app)] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Inicio del día de prospección">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-start gap-3">
          <Sun className="w-6 h-6 text-[var(--accent)] shrink-0 mt-1" />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{hello}. Arranquemos la prospección</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Paso {step} de 2: {step === 1 ? 'qué pasó con los mensajes que quedaron sin anotar' : 'a quién escribirle hoy'}
            </p>
          </div>
          <button type="button" onClick={onFinish} className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" aria-label="Ir directo al panel" title="Ir directo al panel">
            <X className="w-5 h-5" />
          </button>
        </div>

        {recycledNotice && <p className="text-sm p-3 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] text-[var(--text-primary)]">{recycledNotice}</p>}

        {step === 1 && (
          <section className="space-y-3">
            {pending.length === 0 ? (
              <div className={`${card} p-5 text-center space-y-1`}>
                <Check className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Todo anotado. Vamos a lo de hoy.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-[var(--text-primary)]">
                  A {pending.length === 1 ? 'esta persona le escribiste' : `estas ${pending.length} personas les escribiste`} y no anotaste si respondió. Revisá WhatsApp y marcá:
                </p>
                <ul className="space-y-2">
                  {pending.map((p) => (
                    <li key={p.id} className={`${card} p-3 space-y-2`}>
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {p.name}
                        {p.studio && p.studio !== p.name ? <span className="font-normal text-[var(--text-secondary)]"> — {p.studio}</span> : null}
                        <span className="font-normal text-[var(--text-tertiary)] text-xs">
                          {' '}· {FUNNEL_STEPS.find((s) => s.id === funnelStepOf(p))?.label.toLowerCase() || 'le escribiste'} · último mensaje el {p.lastContactAt?.slice(8, 10)}/{p.lastContactAt?.slice(5, 7)}
                        </span>
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <button type="button" disabled={busyId === p.id} className={`${btnPrimary} py-1.5 text-xs`} onClick={() => outcome(p, 'they_replied')}>
                          Respondió
                        </button>
                        <button type="button" disabled={busyId === p.id} className={`${btnGhost} py-1.5 text-xs`} onClick={() => outcome(p, 'no_reply')}>
                          No respondió
                        </button>
                        <button type="button" disabled={busyId === p.id} className={`${btnGhost} py-1.5 text-xs`} onClick={() => outcome(p, 'lost', 'No le interesa')}>
                          No le interesa
                        </button>
                        <button type="button" disabled={busyId === p.id} className={`${btnGhost} py-1.5 text-xs text-red-400`} onClick={() => outcome(p, 'do_not_contact')}>
                          No contactar más
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button type="button" className={`${pending.length === 0 ? btnPrimary : btnGhost} w-full`} onClick={() => setStep(2)}>
              {pending.length === 0 ? 'Siguiente: contactos de hoy' : 'Lo marco después — seguir'}
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            {urgent.length > 0 && (
              <div className={`${card} p-4 space-y-2 border-[var(--accent)]/50`}>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Primero lo urgente ({urgent.length})</p>
                <ul className="space-y-1">
                  {urgent.map((i) => (
                    <li key={i.prospect.id} className="text-sm text-[var(--text-secondary)] flex gap-2">
                      <span className="text-[var(--accent)] font-medium shrink-0">{i.kind === 'llamada_hoy' ? `Llamada ${i.prospect.callTime ? `a las ${i.prospect.callTime}` : 'hoy (sin hora)'}` : QUEUE_LABELS[i.kind]}:</span>
                      <span className="truncate">{i.prospect.studio || i.prospect.name}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-[var(--text-tertiary)]">Están arriba de todo en el panel.</p>
              </div>
            )}

            <div className={`${card} p-4 space-y-3`}>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Para escribir hoy: {toWrite.length} {toWrite.length === 1 ? 'contacto' : 'contactos'}
                {overflow > 0 && <span className="font-normal text-[var(--text-tertiary)]"> (+{overflow} quedan para mañana)</span>}
              </p>
              {toWrite.length > 0 ? (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {toWrite.slice(0, 12).map((i) => (
                    <li key={i.prospect.id} className="py-2 flex items-center gap-2">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-[var(--text-primary)] truncate">{i.prospect.studio || i.prospect.name}</span>
                        <span className="block text-[11px] text-[var(--text-tertiary)]">
                          {i.kind === 'primer' ? (i.prospect.secondChance ? 'Segunda chance' : 'Primer mensaje') : `Seguimiento ${(i.prospect.followUps || 0) + 1}`}
                        </span>
                      </span>
                      <LocalTimeBadge item={i} />
                    </li>
                  ))}
                  {toWrite.length > 12 && <li className="py-2 text-xs text-[var(--text-tertiary)]">y {toWrite.length - 12} más…</li>}
                </ul>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">No tenés mensajes agendados para hoy. Sumá contactos de la reserva:</p>
              )}
              <AddMoreRow poolAvailable={poolAvailable} {...addMore} />
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              <button type="button" disabled={toWrite.length === 0} className={`${btnPrimary} py-3`} onClick={onBurst}>
                <Zap className="w-4 h-4" /> Modo ráfaga ({toWrite.length})
              </button>
              <button type="button" className={`${btnGhost} py-3`} onClick={onFinish}>
                Ver el panel completo
              </button>
            </div>
            {pending.length > 0 && (
              <button type="button" className="text-xs text-[var(--text-tertiary)] underline" onClick={() => setStep(1)}>
                Volver a los {pending.length} sin anotar
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

// ======================= MODO RÁFAGA =======================

/**
 * Uno por uno, a pantalla completa: mensaje listo → WhatsApp → "Enviado" → el siguiente.
 * Toma una foto de la lista al empezar (así no salta mientras se actualiza).
 */
export const BurstMode: React.FC<{
  queue: QueueItem[];
  prospects: Prospect[];
  settings: ProspectingSettings;
  today: string;
  onAct: Act;
  onClose: () => void;
  poolAvailable: number;
  addMore: { addMore: (n: number) => void; busy: boolean; message: { kind: 'ok' | 'error'; text: string } | null };
}> = ({ queue, prospects, settings, today, onAct, onClose, poolAvailable, addMore }) => {
  const [ids, setIds] = useState<string[]>(() => queue.filter((i) => i.kind === 'primer' || i.kind === 'seguimiento').map((i) => i.prospect.id));
  const [idx, setIdx] = useState(0);
  const [sent, setSent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Si sumás más desde la ráfaga, los nuevos se agregan al final solos
  const extraKey = queue
    .filter((i) => i.kind === 'primer' && i.prospect.pulledOn === today && !ids.includes(i.prospect.id))
    .map((i) => i.prospect.id)
    .join(',');
  useEffect(() => {
    if (extraKey) setIds((cur) => [...cur, ...extraKey.split(',').filter((x) => !cur.includes(x))]);
  }, [extraKey]);

  const byId = useMemo(() => new Map(prospects.map((p) => [p.id, p])), [prospects]);
  const snapshot = useMemo(() => new Map(queue.map((i) => [i.prospect.id, i])), [queue]);
  // los que ya enviaste salen de la cola en vivo: se guarda cómo eran para no perder el lugar
  const [frozen, setFrozen] = useState(() => new Map(queue.map((i) => [i.prospect.id, i])));
  useEffect(() => {
    const missing = queue.filter((i) => !frozen.has(i.prospect.id));
    if (missing.length) setFrozen((m) => new Map([...m, ...missing.map((i) => [i.prospect.id, i] as const)]));
  }, [queue, frozen]);
  const id = ids[idx];
  const base = id ? snapshot.get(id) || frozen.get(id) : undefined;
  const p = id ? byId.get(id) || base?.prospect : undefined;
  const item: QueueItem | undefined = base && p ? { ...base, prospect: p } : undefined;

  if (!item || !p) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--bg-app)] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Modo ráfaga terminado">
        <div className="max-w-xl mx-auto px-4 py-10 space-y-5 text-center">
          <Check className="w-10 h-10 text-emerald-400 mx-auto" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Ráfaga terminada: {sent} {sent === 1 ? 'mensaje enviado' : 'mensajes enviados'}</h1>
          <p className="text-sm text-[var(--text-secondary)]">Esta noche la app te pregunta quién respondió.</p>
          <div className={`${card} p-4 text-left`}>
            <AddMoreRow poolAvailable={poolAvailable} {...addMore} />
          </div>
          <button type="button" className={`${btnGhost} w-full py-3`} onClick={onClose}>
            Volver al panel
          </button>
        </div>
      </div>
    );
  }

  const message = renderTemplate(templateFor(item, settings), p, settings);
  const ig = normalizeInstagram(p.instagram);
  const igFirst = item.kind === 'seguimiento' && !!ig && (p.followUps || 0) >= 1;

  const copy = () =>
    navigator.clipboard?.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });

  const next = () => {
    setErr(null);
    setCopied(false);
    setIdx((i) => i + 1);
  };

  const done = async (action: ProspectAction, note?: string) => {
    setBusy(true);
    setErr(null);
    try {
      await onAct(p, action, note);
      if (action === 'first_contact' || action === 'follow_up') setSent((n) => n + 1);
      next();
    } catch (e) {
      setErr(`No se guardó: ${friendlyError(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-app)] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Modo ráfaga">
      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-[var(--accent)]" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
              {idx + 1} de {ids.length} · {sent} enviados
            </p>
            <div className="h-1.5 rounded-full bg-[var(--bg-surface-muted)] overflow-hidden mt-1">
              <div className="h-full bg-[var(--accent)] transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset]" style={{ width: `${Math.round((idx / Math.max(1, ids.length)) * 100)}%` }} />
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" aria-label="Salir del modo ráfaga">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`${card} p-4 space-y-3`}>
          <div>
            <p className="text-xs font-semibold text-[var(--accent)]">
              {item.kind === 'primer' ? (p.secondChance ? 'Segunda chance (90 días después)' : 'Primer mensaje') : `Seguimiento ${Math.min((p.followUps || 0) + 1, settings.maxFollowUps)} de ${settings.maxFollowUps}`}
              {item.kind === 'primer' && !p.secondChance && settings.templates.firstB?.trim() ? ` · versión ${variantFor(p, settings)}` : ''}
            </p>
            <p className="text-lg font-bold text-[var(--text-primary)]">{p.studio || p.name}</p>
            <p className="text-xs text-[var(--text-tertiary)] flex gap-2 flex-wrap">
              {[p.city, p.segment].filter(Boolean).join(' · ')}
              <LocalTimeBadge item={item} />
            </p>
          </div>
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-[var(--text-primary)] p-3 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)]">{message}</p>
          {item.kind === 'primer' && !p.secondChance && settings.templates.first.includes('{personal}') && (
            <div className="flex items-center gap-2 flex-wrap">
              <PersonalLineButton prospect={p} small />
              {!p.website && <span className="text-[11px] text-[var(--text-tertiary)]">Sin web: la IA usa nombre, rubro y ciudad.</span>}
            </div>
          )}
          {igFirst && <p className="text-xs text-amber-400">Por WhatsApp no contestó: probá esta vez por Instagram.</p>}
        </div>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <div className="grid grid-cols-2 gap-2">
          {p.whatsapp && (
            <a href={formatWhatsAppUrl(p.whatsapp, message)} target="_blank" rel="noopener noreferrer" className={`${igFirst ? btnGhost : btnPrimary} py-3`}>
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          )}
          {ig && (
            <a href={`https://instagram.com/${ig}`} target="_blank" rel="noopener noreferrer" onClick={copy} className={`${igFirst ? btnPrimary : btnGhost} py-3`} title="Abre el perfil y copia el mensaje">
              <Instagram className="w-4 h-4" /> Instagram
            </a>
          )}
          <button type="button" onClick={copy} className={`${btnGhost} py-3`}>
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <ClipboardCopy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        <button
          type="button"
          disabled={busy}
          className={`${btnPrimary} w-full py-3.5 text-base`}
          onClick={() => done(item.kind === 'primer' ? 'first_contact' : 'follow_up')}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Enviado — siguiente
        </button>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" disabled={busy} className={`${btnGhost} py-2 text-xs`} onClick={next}>
            <SkipForward className="w-3.5 h-3.5" /> Saltar
          </button>
          <button type="button" disabled={busy} className={`${btnGhost} py-2 text-xs`} onClick={() => done('lost', 'Sin WhatsApp')}>
            No tiene WhatsApp
          </button>
          {item.suggestDiscard ? (
            <button type="button" disabled={busy} className={`${btnGhost} py-2 text-xs`} onClick={() => done('lost', 'Sin respuesta tras los seguimientos')}>
              Descartar
            </button>
          ) : (
            <button type="button" disabled={busy} className={`${btnGhost} py-2 text-xs`} onClick={() => done('snooze')}>
              Mañana
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/** Personaliza con IA (lee su web) todos los primeros mensajes pendientes, uno por uno. */
export const PersonalizeAllButton: React.FC<{ prospects: Prospect[] }> = ({ prospects }) => {
  const todo = prospects.filter((p) => !p.personalLine && !p.secondChance);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  if (!todo.length && !busy) return null;
  const run = async () => {
    setBusy(true);
    setErr(null);
    setDone(0);
    let fails = 0;
    for (const p of todo) {
      try {
        await generatePersonalLine(p);
      } catch (e) {
        fails++;
        if (fails === 1) setErr(friendlyError(e));
        if (fails >= 3) break;
      }
      setDone((n) => n + 1);
    }
    setBusy(false);
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button type="button" onClick={run} disabled={busy} className={`${btnGhost} py-1.5 text-xs`}>
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />}
        {busy ? `Personalizando ${done} de ${todo.length}…` : `Personalizar con IA ${todo.length === 1 ? 'el primer mensaje' : `los ${todo.length} primeros mensajes`}`}
      </button>
      <span className="text-[11px] text-[var(--text-tertiary)]">Lee su web y escribe una frase sobre su estudio.</span>
      {err && <span className="text-[11px] text-red-400 w-full">{err}</span>}
    </div>
  );
};
