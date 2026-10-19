import React, { useMemo, useState } from 'react';
import { Check, ChevronRight, ClipboardCopy, Instagram, MessageCircle, Moon, MoreHorizontal, Phone, SkipForward, Zap } from 'lucide-react';
import { Prospect, ProspectingSettings, DifusionKey } from '../types';
import { DIFUSION_LABELS, ProspectAction, QueueItem, normalizeInstagram, renderTemplate, templateFor } from '../prospecting/core';
import { formatWhatsAppUrl } from '../utils/contact';
import { Sheet } from './Sheet';
import { LocalTimeBadge, PersonalLineButton } from './ProspectingDayStart';
import { CallPrep, ReplyButton } from './ProspectConversation';

/**
 * PROSPECCIÓN, DE A UNA COSA
 * - "Ahora": la próxima acción, explicada en una frase, con el mensaje listo y un botón.
 *   Al tocarlo aparece la siguiente.
 * - Listas cortas por tipo (Contestar, Seguimientos, Nuevos, Llamadas): una línea por persona;
 *   tocándola se abre todo el detalle.
 * - Anotar las respuestas del día de a una: "¿Te respondió X?".
 */

type Act = (p: Prospect, a: ProspectAction, note?: string) => unknown;

const TINT = '#34C759';
const btnBase = 'rounded-[12px] font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-40 cursor-pointer';
const bigPrimary = `${btnBase} h-12 px-5 text-[15px] bg-[var(--text-primary)] text-[var(--bg-app)]`;
const ghost = `${btnBase} h-10 px-3.5 text-[13px] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]`;
const chip = `${btnBase} h-10 px-3 text-[13px] bg-[var(--bg-surface-muted)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)]`;

// El camino, en 6 paradas que se entienden de un vistazo
const JOURNEY = ['Primer mensaje', 'Respuesta', 'Conversación', 'Auditoría', 'Video', 'Llamada'];

function journeyIndex(p: Prospect): number {
  switch (p.stage) {
    case 'nuevo':
    case 'contactado':
      return 0;
    case 'respondio':
      return !p.convStep || p.convStep === 'pregunta' ? 1 : 2;
    case 'auditoria_enviada':
    case 'auditoria_completada':
      return 3;
    case 'video_enviado':
      return 4;
    default:
      return 5;
  }
}

const ago = (d?: string, today?: string) => {
  if (!d || !today) return '';
  const n = Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
  return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`;
};

interface Plan {
  why: string; // qué pasa, en una frase
  doNow: string; // qué hacer
  message: string;
  primary?: { label: string; action: ProspectAction; note?: string };
  choices?: { label: string; action: ProspectAction; note?: string }[];
  reply: boolean; // mostrar "Me respondió"
  needsDetail?: boolean; // hay cosas que se hacen en el detalle (video, llamada)
}

/** Qué hacer con este prospecto, en lenguaje simple. */
export function planFor(item: QueueItem, settings: ProspectingSettings, today: string): Plan {
  const p = item.prospect;
  const message = renderTemplate(templateFor(item, settings), p, settings);
  const step = p.convStep || 'pregunta';
  const said = p.lastReplyNote ? ` Te dijo: «${p.lastReplyNote}».` : '';
  switch (item.kind) {
    case 'primer':
      return {
        why: p.secondChance ? 'Le escribiste hace 3 meses y no respondió. Segunda oportunidad.' : 'Todavía no le escribiste.',
        doNow: 'Mandale el primer mensaje.',
        message,
        primary: { label: 'Listo, se lo mandé', action: 'first_contact' },
        reply: false,
      };
    case 'seguimiento': {
      const n = Math.min((p.followUps || 0) + 1, settings.maxFollowUps);
      const what =
        p.stage === 'auditoria_enviada'
          ? 'Le pasaste el link de la auditoría y no la completó.'
          : p.stage === 'video_enviado'
          ? 'Le mandaste el video y no agendó la llamada.'
          : p.stage === 'respondio'
          ? step === 'esperando_acuerdo'
            ? 'Le mandaste la empatía y no contestó.'
            : 'Le hiciste la pregunta y no contestó.'
          : 'Le mandaste el primer mensaje y no respondió.';
      if (item.suggestDiscard) {
        return {
          why: `${what} Ya le mandaste ${p.followUps} seguimientos.`,
          doNow: 'Conviene darlo por perdido (vuelve en 90 días con otro mensaje).',
          message: '',
          primary: { label: 'Dar por perdido', action: 'lost', note: 'Sin respuesta tras los seguimientos' },
          choices: [{ label: 'Mandarle uno más', action: 'follow_up' }],
          reply: true,
        };
      }
      return {
        why: `${what} Le escribiste ${ago(p.lastContactAt, today)}.`,
        doNow: `Mandale un recordatorio (${n} de ${settings.maxFollowUps}).`,
        message,
        primary: { label: 'Listo, se lo mandé', action: 'follow_up' },
        reply: true,
      };
    }
    case 'responder':
      if (p.awaitingMe && p.stage !== 'respondio') {
        return {
          why: `Te escribió ${ago(p.lastReplyAt, today)}.${said}`,
          doNow: 'Contestale por WhatsApp y marcalo.',
          message: '',
          primary: { label: 'Listo, le contesté', action: 'i_replied' },
          reply: false,
          needsDetail: true,
        };
      }
      if (step === 'pregunta')
        return {
          why: `Te respondió el primer mensaje.${said}`,
          doNow: 'Hacele la pregunta.',
          message,
          primary: { label: 'Listo, se la hice', action: 'conv_question_sent' },
          reply: false,
        };
      if (step === 'esperando_respuesta')
        return {
          why: `Te respondió la pregunta.${said}`,
          doNow: '¿Cómo consigue clientes hoy? Tocá lo que te dijo y te armo la respuesta.',
          message: '',
          choices: (Object.keys(DIFUSION_LABELS) as DifusionKey[]).map((k) => ({ label: DIFUSION_LABELS[k], action: `conv_answer:${k}` as ProspectAction })),
          reply: false,
        };
      if (step === 'empatia')
        return {
          why: `Te contó que consigue clientes por ${DIFUSION_LABELS[p.difusion || 'otro'].toLowerCase()}.`,
          doNow: 'Mandale este mensaje para ponerte en su lugar.',
          message,
          primary: { label: 'Listo, se lo mandé', action: 'conv_empathy_sent' },
          reply: false,
        };
      if (step === 'esperando_acuerdo')
        return {
          why: `Te respondió la empatía.${said}`,
          doNow: '¿Coincidió con lo que le dijiste?',
          message: '',
          choices: [
            { label: 'Sí, coincidió', action: 'conv_agreed' },
            { label: 'No le interesa', action: 'lost', note: 'No le interesa' },
          ],
          reply: false,
        };
      return {
        why: 'Coincidió con lo que le dijiste.',
        doNow: 'Mandale el diagnóstico gratis (va con su link).',
        message,
        primary: { label: 'Listo, le pasé el link', action: 'audit_sent' },
        reply: false,
      };
    case 'video':
      return {
        why: `Completó la auditoría (${p.audit?.total ?? '—'}/30).`,
        doNow: 'Grabale el video y mandáselo. En el detalle tenés el guion con IA.',
        message,
        primary: { label: 'Listo, le mandé el video', action: 'video_sent' },
        reply: false,
        needsDetail: true,
      };
    case 'llamada_hoy':
      return {
        why: `Tenés llamada hoy${p.callTime ? ` a las ${p.callTime}` : ''}.`,
        doNow: 'Preparala con lo que sabés de él.',
        message: '',
        reply: false,
        needsDetail: true,
      };
    case 'llamada':
      return {
        why: `Tuviste la llamada ${ago(p.callDate, today)}.`,
        doNow: '¿Cómo salió?',
        message: '',
        choices: [
          { label: 'Le mandé la propuesta', action: 'proposal_sent' },
          { label: 'Es cliente', action: 'won' },
          { label: 'No se dio', action: 'lost', note: 'No se dio en la llamada' },
        ],
        reply: false,
        needsDetail: true,
      };
    case 'propuesta':
      return {
        why: `Le mandaste la propuesta ${ago(p.proposalSentAt, today)}.`,
        doNow: 'Preguntale si la pudo ver.',
        message,
        primary: { label: 'Listo, se lo mandé', action: 'follow_up' },
        choices: [{ label: 'Aceptó: es cliente', action: 'won' }],
        reply: true,
      };
  }
}

const Journey: React.FC<{ index: number }> = ({ index }) => (
  <div className="flex items-center gap-1.5" aria-label={`Paso ${index + 1} de ${JOURNEY.length}: ${JOURNEY[index]}`}>
    {JOURNEY.map((label, i) => (
      <span
        key={label}
        title={label}
        className="h-1.5 rounded-full transition-all"
        style={{ width: i === index ? 22 : 10, backgroundColor: i < index ? 'var(--text-tertiary)' : i === index ? TINT : 'var(--bg-surface-muted)' }}
      />
    ))}
    <span className="text-[12px] text-[var(--text-secondary)] ml-1">{JOURNEY[index]}</span>
  </div>
);

/** La tarjeta grande: una sola cosa para hacer ahora. */
const NowCard: React.FC<{
  item: QueueItem;
  position: number;
  total: number;
  settings: ProspectingSettings;
  today: string;
  onAct: Act;
  onLater: () => void;
  onDetail: () => void;
  onBurst?: () => void;
}> = ({ item, position, total, settings, today, onAct, onLater, onDetail, onBurst }) => {
  const p = item.prospect;
  const plan = planFor(item, settings, today);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const ig = normalizeInstagram(p.instagram);
  const copy = () =>
    navigator.clipboard?.writeText(plan.message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  const run = async (action: ProspectAction, note?: string) => {
    setBusy(true);
    try {
      await onAct(p, action, note);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card-swiss p-5 sm:p-6 space-y-4" aria-label="Lo próximo para hacer" style={{ borderColor: `${TINT}55` }}>
      <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
        <span className="font-semibold" style={{ color: TINT }}>
          Ahora
        </span>
        <span className="tabular-nums">
          {position} de {total} para hoy
        </span>
        <span className="flex-1" />
        {onBurst && (
          <button type="button" onClick={onBurst} className="flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
            <Zap className="w-3.5 h-3.5" /> Modo ráfaga
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="text-[24px] leading-tight font-bold tracking-tight text-[var(--text-primary)]">{p.studio || p.name}</h2>
          <LocalTimeBadge item={item} />
        </div>
        <Journey index={journeyIndex(p)} />
      </div>

      <div className="space-y-1">
        <p className="text-[15px] text-[var(--text-secondary)]">{plan.why}</p>
        <p className="text-[17px] font-semibold text-[var(--text-primary)]">{plan.doNow}</p>
      </div>

      {item.kind === 'llamada_hoy' && <CallPrep prospect={p} />}

      {plan.message && (
        <div className="space-y-2">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-[var(--text-primary)] p-3.5 rounded-[12px] bg-[var(--bg-app)] border border-[var(--border-subtle)]">{plan.message}</p>
          {item.kind === 'primer' && !p.secondChance && <PersonalLineButton prospect={p} small />}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {p.whatsapp && (
          <a
            href={formatWhatsAppUrl(p.whatsapp, plan.message || undefined)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btnBase} h-12 px-5 text-[15px] text-white`}
            style={{ backgroundColor: TINT }}
          >
            <MessageCircle className="w-5 h-5" /> {plan.message ? 'Abrir WhatsApp con el mensaje' : 'Abrir WhatsApp'}
          </a>
        )}
        {plan.primary && (
          <button type="button" disabled={busy} onClick={() => run(plan.primary!.action, plan.primary!.note)} className={bigPrimary}>
            <Check className="w-5 h-5" /> {plan.primary.label}
          </button>
        )}
      </div>

      {plan.choices && (
        <div className="flex flex-wrap gap-2">
          {plan.choices.map((c) => (
            <button key={c.label} type="button" disabled={busy} onClick={() => run(c.action, c.note)} className={chip}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border-subtle)]">
        <span className="pt-2 flex flex-wrap gap-2 w-full">
          {plan.reply && <ReplyButton prospect={p} onAct={onAct} />}
          {plan.message && (
            <button type="button" onClick={copy} className={ghost}>
              <ClipboardCopy className="w-4 h-4" /> {copied ? 'Copiado' : 'Copiar'}
            </button>
          )}
          {ig && (
            <a href={`https://instagram.com/${ig}`} target="_blank" rel="noopener noreferrer" onClick={copy} className={ghost}>
              <Instagram className="w-4 h-4" /> Instagram
            </a>
          )}
          <span className="flex-1" />
          <button type="button" onClick={onLater} className={ghost} title="Pasar al siguiente (vuelve a aparecer después)">
            <SkipForward className="w-4 h-4" /> Después
          </button>
          <button type="button" onClick={onDetail} className={plan.needsDetail ? `${ghost} border-[var(--text-primary)]` : ghost}>
            <MoreHorizontal className="w-4 h-4" /> {plan.needsDetail ? 'Abrir detalle' : 'Más opciones'}
          </button>
        </span>
      </div>
    </section>
  );
};

type Lane = 'contestar' | 'seguir' | 'nuevos' | 'llamadas';
const LANES: { id: Lane; label: string; kinds: QueueItem['kind'][]; empty: string }[] = [
  { id: 'contestar', label: 'Contestar', kinds: ['responder', 'video', 'llamada'], empty: 'Nadie esperando tu respuesta.' },
  { id: 'seguir', label: 'Seguimientos', kinds: ['seguimiento', 'propuesta'], empty: 'No hay seguimientos para hoy.' },
  { id: 'nuevos', label: 'Nuevos', kinds: ['primer'], empty: 'No quedan primeros mensajes para hoy.' },
  { id: 'llamadas', label: 'Llamadas', kinds: ['llamada_hoy'], empty: 'No tenés llamadas hoy.' },
];

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
              <p className="text-[17px] text-[var(--text-primary)] mt-2">¿Te respondió?</p>
            </div>
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

export const ProspectingInbox: React.FC<{
  queue: QueueItem[];
  toClose: Prospect[];
  isEvening: boolean;
  settings: ProspectingSettings;
  today: string;
  onAct: Act;
  renderDetail: (item: QueueItem) => React.ReactNode;
  onBurst?: () => void;
  tomorrowCalls: Prospect[];
  footer?: React.ReactNode;
}> = ({ queue, toClose, isEvening, settings, today, onAct, renderDetail, onBurst, tomorrowCalls, footer }) => {
  const [later, setLater] = useState<string[]>([]);
  const [lane, setLane] = useState<Lane | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);

  // La próxima: en orden de prioridad, salteando lo que dejaste para "después";
  // las llamadas solo pasan adelante cuando falta menos de 1 hora
  const ordered = useMemo(() => {
    const soon = (i: QueueItem) => {
      if (i.kind !== 'llamada_hoy' || !i.prospect.callTime) return false;
      const [h, m] = i.prospect.callTime.split(':').map(Number);
      const now = new Date();
      return h * 60 + m - (now.getHours() * 60 + now.getMinutes()) <= 60;
    };
    const rest = queue.filter((i) => i.kind !== 'llamada_hoy' || soon(i));
    const a = rest.filter((i) => !later.includes(i.prospect.id));
    const b = rest.filter((i) => later.includes(i.prospect.id));
    return [...a, ...b];
  }, [queue, later]);
  const now = ordered[0];
  const counts = Object.fromEntries(LANES.map((l) => [l.id, queue.filter((i) => l.kinds.includes(i.kind)).length])) as Record<Lane, number>;
  const activeLane = lane || (LANES.find((l) => counts[l.id] > 0)?.id ?? 'contestar');
  const laneItems = queue.filter((i) => LANES.find((l) => l.id === activeLane)!.kinds.includes(i.kind));
  const detail = queue.find((i) => i.prospect.id === detailId);

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
            <span className="block text-[15px] font-semibold text-[var(--text-primary)]">
              ¿Quién te respondió? {toClose.length} sin anotar
            </span>
            <span className="block text-[13px] text-[var(--text-secondary)]">Te pregunto de a uno, un toque por persona.</span>
          </span>
          <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
        </button>
      )}

      {now ? (
        <NowCard
          key={now.prospect.id + now.kind}
          item={now}
          position={1}
          total={queue.length}
          settings={settings}
          today={today}
          onAct={onAct}
          onLater={() => setLater((l) => [...l.filter((x) => x !== now.prospect.id), now.prospect.id])}
          onDetail={() => setDetailId(now.prospect.id)}
          onBurst={onBurst}
        />
      ) : (
        <section className="card-swiss p-6 text-center space-y-1">
          <Check className="w-8 h-8 mx-auto" style={{ color: TINT }} />
          <p className="text-[17px] font-semibold text-[var(--text-primary)]">Terminaste lo de hoy.</p>
          <p className="text-[14px] text-[var(--text-secondary)]">Si querés seguir, sumá contactos nuevos abajo.</p>
        </section>
      )}

      {queue.length > 0 && (
        <section className="space-y-3" aria-label="Todo lo de hoy">
          <div role="tablist" className="flex gap-1 p-1 rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-x-auto no-scrollbar">
            {LANES.map((l) => (
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
                  style={counts[l.id] ? { backgroundColor: l.id === 'contestar' ? TINT : 'var(--text-primary)', color: l.id === 'contestar' ? '#fff' : 'var(--bg-app)' } : { color: 'var(--text-tertiary)' }}
                >
                  {counts[l.id]}
                </span>
              </button>
            ))}
          </div>

          {laneItems.length === 0 ? (
            <p className="text-[14px] text-[var(--text-secondary)] px-1">{LANES.find((l) => l.id === activeLane)!.empty}</p>
          ) : (
            <ul className="card-swiss divide-y divide-[var(--border-subtle)] overflow-hidden">
              {laneItems.map((i) => {
                const plan = planFor(i, settings, today);
                const isNow = now?.prospect.id === i.prospect.id;
                return (
                  <li key={i.prospect.id}>
                    <button type="button" onClick={() => setDetailId(i.prospect.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-[var(--bg-surface-muted)]/50">
                      <span
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[14px] font-bold"
                        style={i.prospect.awaitingMe ? { backgroundColor: TINT, color: '#fff' } : { backgroundColor: 'var(--bg-surface-muted)', color: 'var(--text-secondary)' }}
                        aria-hidden
                      >
                        {i.kind === 'llamada_hoy' ? <Phone className="w-4 h-4" /> : (i.prospect.studio || i.prospect.name).trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-medium text-[var(--text-primary)] truncate">
                          {i.prospect.studio || i.prospect.name}
                          {isNow && <span className="ml-2 text-[11px] font-semibold" style={{ color: TINT }}>ahora</span>}
                        </span>
                        <span className="block text-[13px] text-[var(--text-secondary)] truncate">{plan.doNow}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
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

      {detail && (
        <Sheet onClose={() => setDetailId(null)} label={`Detalle de ${detail.prospect.studio || detail.prospect.name}`}>
          <div className="p-3 sm:p-4">
            <ul>{renderDetail(detail)}</ul>
          </div>
        </Sheet>
      )}
      {answering && <AnswerOneByOne people={toClose} today={today} onAct={onAct} onClose={() => setAnswering(false)} />}
    </div>
  );
};
