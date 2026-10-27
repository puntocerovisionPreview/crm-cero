import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Loader2,
  Phone,
  Sparkles,

  Zap,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Download,
  Flame,
  Instagram,
  MessageCircle,
  Moon,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { Project, Prospect, ProspectStage, ProspectingSettings } from '../types';
import {
  QUEUE_LABELS,
  QueueItem,
  STAGE_LABELS,
  auditLinkFor,
  buildDailyQueue,
  computeMonthMetrics,
  distributeFirstContacts,
  findDuplicate,
  isHot,
  metricsToCsv,
  newProspectFromRow,
  normalizeInstagram,
  parsePastedProspects,
  pendingDayClose,
  pendingOutcomes,
  callsOn,
  turnOf,
  funnelStepOf,
  FUNNEL_STEPS,
  Turn,
  renderTemplate,
  templateFor,
  breakdownBy,
  lostReasons,
  scoreTier,
  weeklyReportText,
  ProspectAction,
} from '../prospecting/core';
import { COUNTRY_NAMES } from '../prospecting/pool';
import { friendlyError, generateVideoScript, markDayStarted, useAddMore, usePoolTakeOptions, useRecycle } from '../prospecting/actions';
import { BurstMode, DayStartFlow, LocalTimeBadge, PersonalLineButton, PersonalizeAllButton } from '../components/ProspectingDayStart';
import { AwaitingBanner, CallPrep, ConversationLog, ReplyButton } from '../components/ProspectConversation';
import { ProspectingPulsePanel, usePulse } from '../components/ProspectingVisuals';
import { ProspectingDailyDesk } from '../components/ProspectingDailyDesk';
import { ProspectingInbox } from '../components/ProspectingInbox';
import { AddMoreRow } from '../components/ProspectingDayStart';
import { deleteProspect, moveProspect, recordProspectAction, recordWithUndo, saveProspectingSettings, saveProspects, updateProspect } from '../prospecting/store';
import { BOARD_COLUMNS, BoardColumn, ClosedColumn, moveUpdates } from '../prospecting/board';
import { ProspectBoard, UndoToast, sendLabel } from '../components/ProspectBoard';
import { Sheet } from '../components/Sheet';
import { useProspecting } from '../prospecting/useProspecting';
import { usePool, useWeeklyAutoBatch } from '../prospecting/usePool';
import { ReservaPanel } from '../components/ReservaPanel';
import { CONV_STEP_LABELS, DIFUSION_LABELS } from '../prospecting/core';
import { DifusionKey } from '../types';
import { buildWebSnippet } from '../prospecting/webSnippet';
import { formatWhatsAppUrl } from '../utils/contact';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { addDays, parseLocalDate, todayLocal } from '../utils/dates';
import { saveMeetingToFirestore, saveTaskToFirestore } from '../utils/firestoreService';
import { PrepTask, prepDateFor, prepDayLabel, prepTaskId, suggestedPrepTasks } from '../prospecting/callPrep';
import { callMeetingFor } from '../prospecting/core';
import { prospectToProject } from '../prospecting/convert';

type Tab = 'hoy' | 'embudo' | 'prospectos' | 'reserva' | 'cargar' | 'metricas' | 'mensajes';

interface Props {
  projects: Project[];
  onAddProject?: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  initialTab?: Tab;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'embudo', label: 'Tablero' },
  { id: 'prospectos', label: 'Prospectos' },
  { id: 'reserva', label: 'Reserva' },
  { id: 'cargar', label: 'Cargar a mano' },
  { id: 'metricas', label: 'Métricas' },
  { id: 'mensajes', label: 'Mensajes' },
];

const btn = 'px-3 py-2 rounded-[var(--radius-control)] text-sm font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-40';
const btnPrimary = `${btn} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-strong)]`;
const btnGhost = `${btn} border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]`;
const card = 'rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]';
const input =
  'w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]';

function shortDate(d?: string): string {
  if (!d) return '';
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

export const ProspectingView: React.FC<Props> = ({ projects, onAddProject, initialTab = 'hoy' }) => {
  const { prospects, events, eventsLoaded, eventsError, settings, settingsLoaded, today, hour, loadError } = useProspecting();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [funnelFrom, setFunnelFrom] = useState<string | null>(null);
  const list = prospects || [];
  const pool = usePool();
  const [poolNotice, setPoolNotice] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const takeOpts = usePoolTakeOptions(list, events);
  useWeeklyAutoBatch(settings, settingsLoaded, today, takeOpts, (n) => {
    setPoolNotice(`Empezó la semana: pasaron ${n} contactos nuevos de la reserva, repartidos en tus días de trabajo.`);
    pool.refresh();
  });
  const [recycled, setRecycled] = useState<string | null>(null);
  useRecycle(prospects, today, (n) => setRecycled(`Volvieron ${n} ${n === 1 ? 'contacto' : 'contactos'} que no respondieron hace 90 días: les toca el mensaje de segunda chance.`));

  // "Sumar más hoy": toma de la reserva y los deja para HOY (también sábado o domingo)
  const more = useAddMore(settings, today, takeOpts, pool.refresh);

  const queue = useMemo(() => buildDailyQueue(list, today, settings), [list, today, settings]);
  const toClose = useMemo(() => pendingDayClose(list, today), [list, today]);
  const pending = useMemo(() => pendingOutcomes(list, today), [list, today]);
  const monthKey = today.slice(0, 7);
  const weeks = useMemo(() => computeMonthMetrics(events, monthKey), [events, monthKey]);
  const thisWeek = weeks.find((w) => today >= w.start && today <= w.end);

  // El inicio guiado es opcional: no tapa el seguimiento diario al entrar.
  const [dayStartOpen, setDayStartOpen] = useState(false);
  const [burstOpen, setBurstOpen] = useState(false);
  const finishDayStart = () => {
    setDayStartOpen(false);
    markDayStarted(today).catch((err) => console.warn('Inicio del día:', err));
  };

  const act = async (p: Prospect, action: ProspectAction, note?: string) => {
    hapticFeedback.medium();
    if (!['no_reply', 'lost', 'do_not_contact', 'snooze'].includes(action)) playTaskDone();
    try {
      await recordProspectAction(p, action, today, settings, note);
      setActError(null);
    } catch (err) {
      setActError(`No se guardó lo de ${p.studio || p.name}: ${friendlyError(err)}`);
      throw err;
    }
  };
  const actSafe = (p: Prospect, action: ProspectAction, note?: string) => act(p, action, note).catch(() => undefined);

  // El operador confirma el envío al volver del chat; se ofrece Deshacer.
  const [undo, setUndo] = useState<{ text: string; run: () => Promise<void> } | null>(null);
  const [callFor, setCallFor] = useState<Prospect | null>(null);
  const [detailFor, setDetailFor] = useState<Prospect | null>(null);
  const sendLocks = useRef(new Set<string>());
  const send = async (p: Prospect, action: ProspectAction, note?: string) => {
    if (sendLocks.current.has(p.id)) return false;
    sendLocks.current.add(p.id);
    hapticFeedback.medium();
    if (!['no_reply', 'lost', 'do_not_contact', 'snooze', 'they_replied'].includes(action)) playTaskDone();
    try {
      const run = await recordWithUndo(p, action, today, settings, note);
      const what =
        action === 'they_replied' ? 'respondió' : action === 'lost' ? 'descartado' : action === 'do_not_contact' ? 'no contactar' : action === 'no_reply' ? 'no respondió' : sendLabel(action);
      setUndo({ text: `${p.studio || p.name}: ${what}`, run });
      setActError(null);
      return true;
    } catch (err) {
      setActError(`No se guardó lo de ${p.studio || p.name}: ${friendlyError(err)}`);
      return false;
    } finally { sendLocks.current.delete(p.id); }
  };
  const moveTo = async (p: Prospect, to: BoardColumn | ClosedColumn) => {
    const updates = moveUpdates(p, to, today, settings);
    const label = BOARD_COLUMNS.find((c) => c.id === to)?.label || (to === 'cliente' ? 'Cliente' : 'Perdido');
    const before: Partial<Prospect> = {};
    (Object.keys(updates) as (keyof Prospect)[]).forEach((k) => ((before as any)[k] = p[k]));
    try {
      await moveProspect(p, updates, label);
      setUndo({ text: `${p.studio || p.name} → ${label}`, run: () => updateProspect(p.id, before) });
    } catch (err) {
      setActError(`No se pudo mover: ${friendlyError(err)}`);
    }
  };
  // De la ruta de arriba a la columna del tablero
  const stepToColumn = (step: string | null): BoardColumn | null => {
    if (!step) return null;
    if (step === 'primer') return 'esperando';
    if (['respondio', 'pregunta', 'difusion', 'empatia', 'speech'].includes(step)) return 'conversando';
    if (['link', 'auditoria', 'video'].includes(step)) return 'auditoria';
    if (['llamada', 'propuesta', 'cliente'].includes(step)) return 'llamada';
    return null;
  };
  const goal = settings.weeklyGoal || 0;
  const pulse = usePulse(list, events, today, settings);

  return (
    <div className={`space-y-4 pb-24 ${tab === 'embudo' ? 'max-w-none' : 'max-w-4xl'}`}>
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Prospección</h1>
        {prospects !== null && tab !== 'hoy' && (
          <ProspectingPulsePanel
            pulse={pulse}
            today={today}
            weekDone={thisWeek?.conversacionesOut || 0}
            goal={goal}
            onStation={(from) => {
              setFunnelFrom(from);
              setTab('embudo');
            }}
            onCall={() => setTab('hoy')}
          />
        )}
      </header>

      {dayStartOpen && prospects !== null && !burstOpen && (
        <DayStartFlow
          pending={pending}
          queue={queue.items}
          overflow={queue.overflow}
          poolAvailable={pool.availableCount}
          addMore={more}
          onAct={act}
          recycledNotice={recycled}
          onBurst={() => {
            finishDayStart();
            setBurstOpen(true);
          }}
          onFinish={finishDayStart}
        />
      )}
      {burstOpen && prospects !== null && (
        <BurstMode queue={queue.items} prospects={list} settings={settings} today={today} onAct={act} onClose={() => setBurstOpen(false)} poolAvailable={pool.availableCount} addMore={more} />
      )}

      <div className="flex gap-1 overflow-x-auto no-scrollbar p-1 rounded-[var(--radius-control)] bg-[var(--bg-surface)] border border-[var(--border-subtle)]" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-[8px] text-sm font-medium shrink-0 transition ${
              tab === t.id ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t.label}
            {t.id === 'hoy' && queue.items.length > 0 && (
              <span className="ml-1.5 text-xs tabular-nums text-[var(--accent)]">{queue.items.length}</span>
            )}
          </button>
        ))}
      </div>

      {prospects === null && !loadError && <p className="text-sm text-[var(--text-tertiary)]">Cargando…</p>}
      {prospects === null && loadError && (
        <p className="text-sm text-red-400">No se pudieron cargar los prospectos. Revisá tu conexión y que hayas entrado con tu cuenta de Google.</p>
      )}

      {poolNotice && <p className="text-sm text-[var(--text-primary)] p-3 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)]">{poolNotice}</p>}
      {recycled && !dayStartOpen && <p className="text-sm text-[var(--text-primary)] p-3 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)]">{recycled}</p>}
      {actError && (
        <p className="text-sm text-red-400 p-3 rounded-[var(--radius-control)] bg-red-500/10 flex items-center gap-2" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0" /> {actError}
        </p>
      )}

      {prospects !== null && tab === 'hoy' && (
        <ProspectingDailyDesk prospects={list} events={events} today={today} pendingCount={queue.items.length} overflow={queue.overflow} loading={!eventsLoaded} error={eventsError} onAct={act} onDetail={setDetailFor}>
        <ProspectingInbox
          queue={queue.items}
          // Hoy y días anteriores se revisan en listas distintas.
          toClose={toClose}
          previousPending={pending}
          isEvening={hour >= settings.closeHour}
          settings={settings}
          today={today}
          onSend={send}
          onMove={moveTo}
          onCall={setCallFor}
          onDetail={setDetailFor}
          onBurst={() => setBurstOpen(true)}
          tomorrowCalls={callsOn(list, addDays(today, 1))}
          footer={
            <section className="card-swiss p-4">
              <AddMoreRow poolAvailable={pool.availableCount} addMore={more.addMore} busy={more.busy} message={more.message} />
              <button type="button" className="mt-3 text-xs text-[var(--text-secondary)] underline" onClick={() => setDayStartOpen(true)}>Abrir inicio guiado</button>
            </section>
          }
        />
        </ProspectingDailyDesk>
      )}
      {prospects !== null && tab === 'embudo' && (
        <ProspectBoard
          prospects={list.filter((p) => !p.doNotContact)}
          settings={settings}
          today={today}
          onSend={send}
          onMove={moveTo}
          onCall={setCallFor}
          onDetail={setDetailFor}
          initialColumn={stepToColumn(funnelFrom)}
        />
      )}
      {undo && <UndoToast text={undo.text} onUndo={() => { undo.run().catch(() => undefined); setUndo(null); }} onDone={() => setUndo(null)} />}
      {callFor && (
        <Sheet onClose={() => setCallFor(null)} label={`Llamada con ${callFor.studio || callFor.name}`}>
          <div className="p-4">
            <CallScheduler prospect={callFor} onAct={(p, a, n) => send(p, a, n)} onClose={() => setCallFor(null)} />
          </div>
        </Sheet>
      )}
      {detailFor && (() => {
        const live = list.find((x) => x.id === detailFor.id) || detailFor;
        const kindGuess: QueueItem['kind'] =
          live.stage === 'nuevo' ? 'primer' : live.stage === 'respondio' ? 'responder' : live.stage === 'auditoria_completada' ? 'video' : live.stage === 'llamada' ? (live.proposalSentAt ? 'propuesta' : live.callDate === today ? 'llamada_hoy' : 'llamada') : 'seguimiento';
        const item = queue.items.find((i) => i.prospect.id === live.id) || { prospect: live, kind: kindGuess, overdueDays: 0, suggestDiscard: false, hot: isHot(live) };
        return (
          <Sheet onClose={() => setDetailFor(null)} label={`Detalle de ${live.studio || live.name}`}>
            <div className="p-3 sm:p-4 space-y-3">
              <ul>
                <QueueCard item={{ ...item, prospect: live }} settings={settings} onAct={actSafe} />
              </ul>
              <label className="block space-y-1 px-1">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Notas</span>
                <textarea
                  defaultValue={live.notes || ''}
                  rows={2}
                  onBlur={(e) => e.target.value !== (live.notes || '') && updateProspect(live.id, { notes: e.target.value })}
                  className={`${input} resize-none`}
                />
              </label>
            </div>
          </Sheet>
        );
      })()}
      {prospects !== null && tab === 'prospectos' && (
        <ProspectList prospects={list} today={today} settings={settings} onAct={actSafe} onAddProject={onAddProject} />
      )}
      {prospects !== null && tab === 'cargar' && (
        <ImportPanel prospects={list} projects={projects} today={today} settings={settings} onDone={() => setTab('hoy')} />
      )}
      {prospects !== null && tab === 'reserva' && (
        <ReservaPanel
          available={pool.available}
          takenCount={pool.takenCount}
          loading={pool.docs === null && !pool.error}
          prospects={list}
          projects={projects}
          settings={settings}
          today={today}
          onChanged={pool.refresh}
        />
      )}
      {prospects !== null && tab === 'metricas' && <MetricsPanel events={events} today={today} prospects={list} settings={settings} />}
      {prospects !== null && tab === 'mensajes' && <SettingsPanel settings={settings} />}
    </div>
  );
};

// ======================= HOY =======================

const QueueCard: React.FC<{ item: QueueItem; settings: ProspectingSettings; onAct: (p: Prospect, a: ProspectAction, n?: string) => void; compact?: boolean }> = ({
  item,
  settings,
  onAct,
  compact,
}) => {
  const p = item.prospect;
  const [open, setOpen] = useState(
    !compact && item.kind !== 'video' && item.kind !== 'llamada_hoy' && !(item.kind === 'responder' && !item.prospect.awaitingMe && ['esperando_respuesta', 'esperando_acuerdo'].includes(item.prospect.convStep || ''))
  );
  const [copied, setCopied] = useState(false);
  const [callPicker, setCallPicker] = useState(false);
  const [lostPicker, setLostPicker] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [scriptErr, setScriptErr] = useState<string | null>(null);
  const message = renderTemplate(templateFor(item, settings), p, settings);
  const ig = normalizeInstagram(p.instagram);
  const igFirst = item.kind === 'seguimiento' && !!ig && (p.followUps || 0) >= 1;

  const makeScript = async () => {
    setScriptBusy(true);
    setScriptErr(null);
    try {
      setScript(await generateVideoScript(p));
    } catch (e) {
      setScriptErr(friendlyError(e));
    } finally {
      setScriptBusy(false);
    }
  };

  const copy = () => {
    navigator.clipboard?.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const step = p.convStep || 'pregunta';
  const waiting = item.kind === 'responder' && (step === 'esperando_respuesta' || step === 'esperando_acuerdo');
  // Te escribió fuera del guion (después del link, del video o de la propuesta)
  const offScript = item.kind === 'responder' && !!p.awaitingMe && p.stage !== 'respondio';
  const nth = `${Math.min((p.followUps || 0) + 1, settings.maxFollowUps)} de ${settings.maxFollowUps}`;
  const followLabel =
    p.stage === 'respondio'
      ? step === 'esperando_acuerdo'
        ? `No contestó después de la empatía · seguimiento ${nth}`
        : `No contestó la pregunta · seguimiento ${nth}`
      : p.stage === 'auditoria_enviada'
      ? `No completó la auditoría · recordatorio ${nth}`
      : p.stage === 'video_enviado'
      ? `Vio el video y no agendó · seguimiento ${nth}`
      : `Sin respuesta al primer mensaje · seguimiento ${nth}`;
  const label =
    item.kind === 'seguimiento'
      ? followLabel
      : offScript
      ? `Te escribió (${STAGE_LABELS[p.stage].toLowerCase()})`
      : item.kind === 'responder'
      ? `${p.awaitingMe ? 'Te respondió · ' : ''}${CONV_STEP_LABELS[step]}`
      : item.kind === 'llamada_hoy'
      ? `Llamada hoy${p.callTime ? ` a las ${p.callTime}` : ' (sin hora)'}`
      : item.kind === 'primer' && p.secondChance
      ? 'Segunda chance (pasaron 90 días)'
      : QUEUE_LABELS[item.kind];

  return (
    <li className={`${card} p-3.5 space-y-3`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--accent)] flex items-center gap-1.5 flex-wrap">
            {item.kind === 'video' && <Video className="w-3.5 h-3.5" />}
            {label}
            {item.overdueDays > 0 && <span className="text-amber-400">— atrasado {item.overdueDays} {item.overdueDays === 1 ? 'día' : 'días'}</span>}
            {item.hot && (
              <span className="text-amber-400 flex items-center gap-0.5">
                <Flame className="w-3.5 h-3.5" /> caliente
              </span>
            )}
            <LocalTimeBadge item={item} />
          </p>
          <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
            {p.name}
            {p.studio && p.studio !== p.name ? <span className="font-normal text-[var(--text-secondary)]"> — {p.studio}</span> : null}
          </p>
          {p.audit && (
            <p className="text-xs text-[var(--text-secondary)]">
              Auditoría {p.audit.total}/30 ({p.audit.nivel}) — P {p.audit.presencia}, A {p.audit.adquisicion}, F {p.audit.funnel}
              {p.audit.dolorCaptacion ? ` — Dolor: ${p.audit.dolorCaptacion}` : ''}
              {item.kind === 'video' && p.videoDueDate ? ` — Video hasta el ${shortDate(p.videoDueDate)}` : ''}
            </p>
          )}
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" aria-expanded={open} title="Ver mensaje">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AwaitingBanner prospect={p} />
      {item.kind === 'llamada_hoy' && <CallPrep prospect={p} />}
      {item.kind === 'responder' && !offScript && <ScriptSteps step={step} difusion={p.difusion} />}

      {open && message && (
        <div className="space-y-1">
          {waiting && <p className="text-[11px] text-[var(--text-tertiary)]">Ya enviado:</p>}
          <p className="text-sm whitespace-pre-wrap text-[var(--text-secondary)] p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)]">{message}</p>
        </div>
      )}
      {item.kind === 'primer' && !p.secondChance && open && settings.templates.first.includes('{personal}') && <PersonalLineButton prospect={p} small />}
      {igFirst && <p className="text-xs text-amber-400">Por WhatsApp no contestó: probá esta vez por Instagram.</p>}

      {item.kind === 'video' && (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <input
              defaultValue={p.videoUrl || ''}
              placeholder="Pegá el link del video (Loom, YouTube, Drive)"
              onBlur={(e) => e.target.value.trim() !== (p.videoUrl || '') && updateProspect(p.id, { videoUrl: e.target.value.trim() || undefined })}
              className={`${input} text-xs`}
              aria-label="Link del video"
            />
            <button type="button" className={`${btnGhost} py-1.5 text-xs shrink-0`} onClick={makeScript} disabled={scriptBusy} title="Guion de 60-90 segundos según sus respuestas">
              {scriptBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />} Guion con IA
            </button>
          </div>
          {scriptErr && <p className="text-xs text-red-400">{scriptErr}</p>}
          {script && (
            <div className="space-y-1">
              <p className="text-xs whitespace-pre-wrap text-[var(--text-secondary)] p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)] max-h-64 overflow-y-auto">{script}</p>
              <button type="button" className={`${btnGhost} py-1 text-xs`} onClick={() => navigator.clipboard?.writeText(script)}>
                <ClipboardCopy className="w-3.5 h-3.5" /> Copiar guion
              </button>
            </div>
          )}
        </div>
      )}

      {callPicker && <CallScheduler prospect={p} onAct={onAct} onClose={() => setCallPicker(false)} />}
      {lostPicker && (
        <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-[var(--radius-control)] bg-[var(--bg-app)]">
          <span className="text-xs text-[var(--text-secondary)] w-full">¿Por qué no se dio?</span>
          {LOST_REASONS.map((r) => (
            <button key={r} type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'lost', r)}>
              {r}
            </button>
          ))}
          <button type="button" className="text-xs text-[var(--text-tertiary)] underline px-1" onClick={() => setLostPicker(false)}>
            Cancelar
          </button>
        </div>
      )}

      {item.kind === 'responder' && step === 'esperando_respuesta' && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[var(--text-primary)]">¿Qué te respondió?</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(DIFUSION_LABELS) as DifusionKey[]).map((k) => (
              <button key={k} type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, `conv_answer:${k}` as ProspectAction)}>
                {DIFUSION_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {p.whatsapp && (
          <a href={formatWhatsAppUrl(p.whatsapp, message || undefined)} target="_blank" rel="noopener noreferrer" className={`${btnGhost} py-1.5 text-xs`}>
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp
          </a>
        )}
        {ig && (
          <a
            href={`https://instagram.com/${ig}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={copy}
            className={`${btnGhost} py-1.5 text-xs`}
            title="Abre el perfil y copia el mensaje para pegarlo en el chat"
          >
            <Instagram className="w-3.5 h-3.5" /> Instagram
          </a>
        )}
        {message && (
          <button type="button" onClick={copy} className={`${btnGhost} py-1.5 text-xs`}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        )}

        <span className="flex-1" />

        {item.kind === 'primer' && (
          <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'first_contact')}>
            <Check className="w-3.5 h-3.5" /> Mensaje enviado
          </button>
        )}
        {(item.kind === 'seguimiento' || item.kind === 'propuesta') && <ReplyButton prospect={p} onAct={onAct} />}
        {item.kind === 'llamada_hoy' && (
          <button type="button" className={`${p.callTime ? btnGhost : btnPrimary} py-1.5 text-xs`} onClick={() => setCallPicker(true)}>
            <Phone className="w-3.5 h-3.5" /> {p.callTime ? 'Cambiar horario' : 'Ponerle hora'}
          </button>
        )}
        {offScript && (
          <>
            <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'i_replied')}>
              <Check className="w-3.5 h-3.5" /> Le contesté
            </button>
            {p.stage === 'auditoria_enviada' && (
              <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'audit_completed')}>
                Completó la auditoría
              </button>
            )}
            {(p.stage === 'video_enviado' || p.stage === 'auditoria_enviada' || p.stage === 'contactado') && (
              <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => setCallPicker(true)}>
                <Phone className="w-3.5 h-3.5" /> Agendamos llamada
              </button>
            )}
            {p.stage === 'llamada' && (
              <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'won')}>
                Aceptó: es cliente
              </button>
            )}
            <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'lost', 'No le interesa')}>
              No le interesa
            </button>
          </>
        )}
        {item.kind === 'seguimiento' &&
          (item.suggestDiscard ? (
            <>
              <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'follow_up')}>
                Uno más
              </button>
              <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'lost', 'Sin respuesta tras los seguimientos')}>
                Descartar
              </button>
            </>
          ) : (
            <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'follow_up')}>
              <Check className="w-3.5 h-3.5" /> Seguimiento enviado
            </button>
          ))}
        {item.kind === 'responder' && !offScript && (
          <>
            {step === 'pregunta' && (
              <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'conv_question_sent')}>
                <Check className="w-3.5 h-3.5" /> Pregunta enviada
              </button>
            )}
            {step === 'empatia' && (
              <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'conv_empathy_sent')}>
                <Check className="w-3.5 h-3.5" /> Mensaje enviado
              </button>
            )}
            {step === 'esperando_acuerdo' && (
              <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'conv_agreed')}>
                Coincidió: pasar al speech
              </button>
            )}
            {step === 'speech' && (
              <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'audit_sent')}>
                <Check className="w-3.5 h-3.5" /> Le pasé la auditoría
              </button>
            )}
            {waiting && !p.awaitingMe && (
              <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'snooze')} title="Ocultarlo hasta mañana">
                Sigue mañana
              </button>
            )}
            <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => setCallPicker(true)}>
              <Phone className="w-3.5 h-3.5" /> Agendamos llamada
            </button>
            <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'lost', 'No le interesa')}>
              No le interesa
            </button>
            <button type="button" className={`${btnGhost} py-1.5 text-xs text-red-400`} onClick={() => onAct(p, 'do_not_contact')} title="No vuelve a aparecer nunca, ni en futuras cargas">
              <Ban className="w-3.5 h-3.5" /> No contactar
            </button>
          </>
        )}
        {item.kind === 'video' && (
          <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'video_sent')}>
            <Video className="w-3.5 h-3.5" /> Video enviado
          </button>
        )}
        {item.kind === 'seguimiento' && p.stage === 'video_enviado' && (
          <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => setCallPicker(true)}>
            <Phone className="w-3.5 h-3.5" /> Agendó la llamada
          </button>
        )}
        {item.kind === 'llamada' && (
          <>
            <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'proposal_sent')}>
              Le mandé la propuesta
            </button>
            <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'won')}>
              Cerrado: es cliente
            </button>
            <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => setCallPicker(true)}>
              Todavía no fue: cambiar fecha
            </button>
            <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => setLostPicker(true)}>
              No se dio
            </button>
          </>
        )}
        {item.kind === 'propuesta' && (
          <>
            <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'follow_up')}>
              <Check className="w-3.5 h-3.5" /> Seguimiento enviado
            </button>
            <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'won')}>
              Aceptó: es cliente
            </button>
            <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => setLostPicker(true)}>
              No se dio
            </button>
          </>
        )}
      </div>
      {!compact && <ConversationLog prospect={p} onAct={onAct} />}
    </li>
  );
};

// ======================= PROSPECTOS =======================

const STAGE_ORDER: ProspectStage[] = ['auditoria_completada', 'respondio', 'video_enviado', 'llamada', 'auditoria_enviada', 'contactado', 'nuevo', 'cliente', 'descartado'];

const ProspectList: React.FC<{
  prospects: Prospect[];
  today: string;
  settings: ProspectingSettings;
  onAct: (p: Prospect, a: ProspectAction, n?: string) => void;
  onAddProject?: Props['onAddProject'];
}> = ({ prospects, today, settings, onAct, onAddProject }) => {
  const [filter, setFilter] = useState<'activos' | ProspectStage>('activos');
  const [turnFilter, setTurnFilter] = useState<Turn | 'todos'>('todos');
  const [callFor, setCallFor] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    prospects.forEach((p) => (c[p.stage] = (c[p.stage] || 0) + 1));
    return c;
  }, [prospects]);

  const turnCount = (t: Turn) => prospects.filter((p) => turnOf(p, today, settings).turn === t).length;
  const shown = prospects
    .filter((p) => (filter === 'activos' ? !['cliente', 'descartado'].includes(p.stage) : p.stage === filter))
    .filter((p) => turnFilter === 'todos' || turnOf(p, today, settings).turn === turnFilter)
    .filter((p) => !q.trim() || `${p.name} ${p.studio || ''} ${p.city || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || Number(isHot(b)) - Number(isHot(a)) || a.name.localeCompare(b.name));

  const convert = async (p: Prospect) => {
    if (!onAddProject) return;
    onAddProject(prospectToProject(p, today));
    await onAct(p, 'won');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(['activos', ...STAGE_ORDER] as const).map((s) => {
          const n = s === 'activos' ? prospects.filter((p) => !['cliente', 'descartado'].includes(p.stage)).length : counts[s] || 0;
          if (s !== 'activos' && n === 0) return null;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                filter === s ? 'bg-[var(--accent)] text-[var(--on-accent)] border-transparent' : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {s === 'activos' ? 'En curso' : STAGE_LABELS[s]} <span className="tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="A quién le toca">
        {(
          [
            ['todos', 'Todos'],
            ['mio', 'Te toca'],
            ['suyo', 'Esperando su respuesta'],
            ['perdido', 'Sin respuesta'],
            ['llamada', 'Llamadas agendadas'],
          ] as [Turn | 'todos', string][]
        ).map(([k, label]) => {
          const n = k === 'todos' ? null : turnCount(k as Turn);
          if (n === 0 && k !== turnFilter) return null;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTurnFilter(k)}
              aria-pressed={turnFilter === k}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                turnFilter === k ? 'bg-[var(--text-primary)] text-[var(--bg-app)] border-transparent' : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {label} {n !== null && <span className="tabular-nums">{n}</span>}
            </button>
          );
        })}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, estudio o ciudad" className={input} />

      {shown.length === 0 && <p className="text-sm text-[var(--text-tertiary)] p-4">No hay prospectos en este filtro.</p>}

      <ul className="space-y-2">
        {shown.map((p) => {
          const open = openId === p.id;
          return (
            <li key={p.id} className={card}>
              <button type="button" onClick={() => setOpenId(open ? null : p.id)} className="w-full flex items-center gap-3 p-3 text-left" aria-expanded={open}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {p.name}
                    {p.studio && p.studio !== p.name ? <span className="font-normal text-[var(--text-secondary)]"> — {p.studio}</span> : null}
                  </p>
                  <TurnBadge info={turnOf(p, today, settings)} />
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {FUNNEL_STEPS.find((s) => s.id === funnelStepOf(p))?.label || STAGE_LABELS[p.stage]}
                    {p.stage === 'nuevo' && p.plannedFirstContact ? ` — primer mensaje el ${shortDate(p.plannedFirstContact)}` : ''}
                    {['contactado', 'auditoria_enviada', 'video_enviado'].includes(p.stage) && p.nextActionDate ? ` — sigue el ${shortDate(p.nextActionDate)}` : ''}
                    {p.audit ? ` — ${p.audit.total}/30` : ''}
                    {p.stage === 'llamada' && p.callDate ? ` — llamada el ${shortDate(p.callDate)}${p.callTime ? ` a las ${p.callTime}` : ''}` : ''}
                    {p.stage === 'llamada' && p.proposalSentAt ? ` — propuesta enviada el ${shortDate(p.proposalSentAt)}` : ''}
                    {p.stage === 'descartado' && p.lostReason ? ` — ${p.lostReason}` : ''}
                    {p.stage === 'descartado' && p.recycleAfter ? ` — vuelve el ${shortDate(p.recycleAfter)}` : ''}
                  </p>
                </div>
                {isHot(p) && <Flame className="w-4 h-4 text-amber-400 shrink-0" aria-label="Caliente" />}
                {open ? <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />}
              </button>
              {open && (
                <div className="px-3 pb-3 pt-1 space-y-3 border-t border-[var(--border-subtle)]">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-2">
                    {p.whatsapp && (<><dt className="text-[var(--text-tertiary)]">WhatsApp</dt><dd className="text-[var(--text-primary)]">{p.whatsapp}</dd></>)}
                    {p.instagram && (<><dt className="text-[var(--text-tertiary)]">Instagram</dt><dd className="text-[var(--text-primary)]">@{normalizeInstagram(p.instagram)}</dd></>)}
                    {p.email && (<><dt className="text-[var(--text-tertiary)]">Email</dt><dd className="text-[var(--text-primary)] truncate">{p.email}</dd></>)}
                    {p.city && (<><dt className="text-[var(--text-tertiary)]">Ciudad</dt><dd className="text-[var(--text-primary)]">{p.city}</dd></>)}
                    {p.source && (<><dt className="text-[var(--text-tertiary)]">Origen</dt><dd className="text-[var(--text-primary)]">{p.source}</dd></>)}
                  </dl>

                  {p.audit && (
                    <div className="p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-app)] text-xs space-y-1">
                      <p className="font-semibold text-[var(--text-primary)]">
                        Auto auditoría: {p.audit.total}/30 — nivel {p.audit.nivel}
                      </p>
                      <p className="text-[var(--text-secondary)]">
                        Presencia {p.audit.presencia}/10, Adquisición {p.audit.adquisicion}/10, Funnel {p.audit.funnel}/10.
                      </p>
                      <p className="text-[var(--text-secondary)]">
                        {[p.audit.dedicacion, p.audit.tamanioEquipo, p.audit.proyectosActivos, p.audit.origenClientes && `Clientes por ${p.audit.origenClientes}`, p.audit.inversionPrevia]
                          .filter(Boolean)
                          .join(' — ')}
                      </p>
                      {p.audit.dolorCaptacion && <p className="text-[var(--text-secondary)]">Principal dolor: {p.audit.dolorCaptacion}</p>}
                      {p.audit.observaciones && <p className="text-[var(--text-secondary)]">Pidió revisar: {p.audit.observaciones}</p>}
                    </div>
                  )}

                  <AwaitingBanner prospect={p} />
                  {callFor === p.id && <CallScheduler prospect={p} onAct={onAct} onClose={() => setCallFor(null)} />}

                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Notas</span>
                    <textarea
                      defaultValue={p.notes || ''}
                      rows={2}
                      onBlur={(e) => e.target.value !== (p.notes || '') && updateProspect(p.id, { notes: e.target.value })}
                      className={`${input} resize-none`}
                    />
                  </label>

                  <div className="flex flex-wrap gap-1.5">
                    {!['nuevo', 'cliente', 'descartado'].includes(p.stage) && !p.awaitingMe && <ReplyButton prospect={p} onAct={onAct} />}
                    {p.awaitingMe && (
                      <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'i_replied')}>
                        <Check className="w-3.5 h-3.5" /> Le contesté
                      </button>
                    )}
                    {p.stage !== 'auditoria_completada' && !p.audit && !['cliente', 'descartado'].includes(p.stage) && (
                      <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'audit_completed')}>
                        Completó la auditoría
                      </button>
                    )}
                    <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => navigator.clipboard?.writeText(auditLinkFor(p))}>
                      Copiar su link de auditoría
                    </button>
                    {!['cliente', 'descartado'].includes(p.stage) && (
                      <>
                        <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => setCallFor(p.id)}>
                          <Phone className="w-3.5 h-3.5" /> {p.stage === 'llamada' && p.callDate ? 'Cambiar día de la llamada' : 'Agendar llamada'}
                        </button>
                        {onAddProject && (
                          <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => convert(p)}>
                            Pasar a cliente
                          </button>
                        )}
                        <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'lost', 'Descartado a mano')}>
                          Descartar
                        </button>
                      </>
                    )}
                    {!p.doNotContact && (
                      <button type="button" className={`${btnGhost} py-1.5 text-xs text-red-400`} onClick={() => onAct(p, 'do_not_contact')} title="No vuelve a aparecer, ni en futuras cargas de la reserva">
                        <Ban className="w-3.5 h-3.5" /> No contactar más
                      </button>
                    )}
                    {p.stage === 'descartado' && (
                      <button
                        type="button"
                        className={`${btnGhost} py-1.5 text-xs`}
                        onClick={() => updateProspect(p.id, { stage: 'contactado', nextActionDate: today, followUps: 0, doNotContact: undefined, recycleAfter: undefined })}
                      >
                        Reactivar
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${btnGhost} py-1.5 text-xs text-red-400`}
                      onClick={() => {
                        if (window.confirm(`¿Borrar a ${p.name}? Sus acciones pasadas siguen contando en las métricas.`)) deleteProspect(p.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Borrar
                    </button>
                  </div>
                  <ConversationLog prospect={p} onAct={onAct} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// ======================= CARGAR TANDA =======================

const ImportPanel: React.FC<{ prospects: Prospect[]; projects: Project[]; today: string; settings: ProspectingSettings; onDone: () => void }> = ({
  prospects,
  projects,
  today,
  settings,
  onDone,
}) => {
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [perDay, setPerDay] = useState(settings.firstContactsPerDay);
  const [skip, setSkip] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const rows = useMemo(() => parsePastedProspects(text), [text]);
  const dups = useMemo(() => rows.map((r) => findDuplicate(r, prospects, projects)), [rows, prospects, projects]);
  const included = rows.map((_, i) => (skip[i] !== undefined ? !skip[i] : !dups[i]));
  const count = included.filter(Boolean).length;
  const dates = distributeFirstContacts(count, today, perDay, settings.workDays);

  const save = async () => {
    setSaving(true);
    try {
      let k = 0;
      const items = rows
        .map((r, i) => (included[i] ? newProspectFromRow({ ...r, source: r.source || source || undefined }, dates[k++], today) : null))
        .filter((x): x is Prospect => Boolean(x));
      await saveProspects(items);
      setDone(items.length);
      setText('');
      setSkip({});
    } finally {
      setSaving(false);
    }
  };

  const dayName = (d: string) => ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][parseLocalDate(d).getDay()];

  return (
    <div className="space-y-4">
      {done !== null && (
        <div className={`${card} p-4 flex items-center justify-between gap-3`}>
          <p className="text-sm text-[var(--text-primary)]">
            Listo: cargaste {done} {done === 1 ? 'prospecto' : 'prospectos'}. Los primeros mensajes ya están repartidos en la semana.
          </p>
          <button type="button" className={btnPrimary} onClick={onDone}>
            Ver hoy
          </button>
        </div>
      )}

      <section className={`${card} p-4 space-y-3`}>
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Pegá la tanda de la semana</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Copiá las filas desde Excel o Google Sheets y pegalas acá. Si la primera fila tiene títulos (Nombre, Estudio, Instagram, WhatsApp, Ciudad) se usan; si no, la app reconoce @usuarios, emails y teléfonos.
          </p>
        </div>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDone(null);
          }}
          rows={6}
          placeholder={'Nombre\tEstudio\tInstagram\tWhatsApp\tCiudad\nLaura Pérez\tEstudio LP\t@estudiolp\t+54 9 351 555 1234\tCórdoba'}
          className={`${input} font-mono text-xs`}
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">De dónde salieron (opcional)</span>
            <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Instagram, Google Maps, colegio de arquitectos…" className={input} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Primeros mensajes por día</span>
            <input type="number" min={1} max={20} value={perDay} onChange={(e) => setPerDay(Math.max(1, parseInt(e.target.value, 10) || 1))} className={input} />
          </label>
        </div>
      </section>

      {rows.length > 0 && (
        <section className={`${card} p-4 space-y-3`}>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Vista previa ({count} de {rows.length})</h3>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {rows.map((r, i) => {
              let k = -1;
              for (let j = 0; j <= i; j++) if (included[j]) k++;
              return (
                <li key={i} className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={included[i]}
                    onChange={(e) => setSkip((s) => ({ ...s, [i]: !e.target.checked }))}
                    aria-label={`Incluir a ${r.name}`}
                    className="w-4 h-4 accent-[var(--accent)]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {r.name}
                      {r.studio ? <span className="text-[var(--text-secondary)] font-normal"> — {r.studio}</span> : null}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                      {[r.instagram && `@${normalizeInstagram(r.instagram)}`, r.whatsapp, r.email, r.city].filter(Boolean).join(' — ') || 'Sin datos de contacto'}
                    </p>
                    {dups[i] && (
                      <p className="text-xs text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {dups[i]!.label}
                      </p>
                    )}
                  </div>
                  {included[i] && <span className="text-xs text-[var(--text-secondary)] shrink-0 tabular-nums">{dayName(dates[k])} {shortDate(dates[k])}</span>}
                </li>
              );
            })}
          </ul>
          <button type="button" disabled={count === 0 || saving} className={btnPrimary} onClick={save}>
            <Upload className="w-4 h-4" /> {saving ? 'Cargando…' : `Cargar ${count} ${count === 1 ? 'prospecto' : 'prospectos'}`}
          </button>
        </section>
      )}
    </div>
  );
};

// ======================= MÉTRICAS =======================

const MetricsPanel: React.FC<{ events: import('../types').ProspectEvent[]; today: string; prospects: Prospect[]; settings: ProspectingSettings }> = ({
  events,
  today,
  prospects,
  settings,
}) => {
  const [reportCopied, setReportCopied] = useState(false);
  const byCountry = useMemo(() => breakdownBy(prospects, events, (p) => p.country), [prospects, events]);
  const bySegment = useMemo(() => breakdownBy(prospects, events, (p) => p.segment), [prospects, events]);
  const byTier = useMemo(() => breakdownBy(prospects, events, (p) => scoreTier(p.score)), [prospects, events]);
  const variantOf = useMemo(() => {
    const m = new Map<string, 'A' | 'B'>();
    events.forEach((e) => e.type === 'first_contact' && e.variant && m.set(e.prospectId, e.variant));
    return m;
  }, [events]);
  const byVariant = useMemo(() => breakdownBy(prospects, events, (p) => variantOf.get(p.id) || p.variant), [prospects, events, variantOf]);
  const reasons = useMemo(() => lostReasons(prospects), [prospects]);
  const difusion = useMemo(() => {
    const m: Partial<Record<DifusionKey, number>> = {};
    prospects.forEach((p) => p.difusion && (m[p.difusion] = (m[p.difusion] || 0) + 1));
    return (Object.entries(m) as [DifusionKey, number][]).sort((a, b) => b[1] - a[1]);
  }, [prospects]);
  const difusionTotal = difusion.reduce((s, [, n]) => s + n, 0);
  const [monthKey, setMonthKey] = useState(today.slice(0, 7));
  const weeks = useMemo(() => computeMonthMetrics(events, monthKey), [events, monthKey]);
  const total = (k: 'conversacionesOut' | 'seguimientos' | 'respuestas' | 'autoAuditorias') => weeks.reduce((s, w) => s + w[k], 0);
  const out = total('conversacionesOut');
  const resp = total('respuestas');
  const aud = total('autoAuditorias');
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');

  const exportCsv = () => {
    const blob = new Blob([metricsToCsv(weeks)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prospeccion-${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rows: [string, 'conversacionesOut' | 'seguimientos' | 'respuestas' | 'autoAuditorias'][] = [
    ['Conversaciones OUT', 'conversacionesOut'],
    ['Seguimientos', 'seguimientos'],
    ['Respuestas', 'respuestas'],
    ['Auto Auditorías', 'autoAuditorias'],
  ];

  const currentWeek = weeks.find((w) => today >= w.start && today <= w.end) || weeks[weeks.length - 1];
  const copyReport = () => {
    if (!currentWeek) return;
    navigator.clipboard?.writeText(weeklyReportText(currentWeek, settings.weeklyGoal)).then(() => {
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 1500);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <input type="month" value={monthKey} onChange={(e) => e.target.value && setMonthKey(e.target.value)} className={`${input} w-auto`} aria-label="Mes" />
        <span className="flex-1" />
        <button type="button" className={btnGhost} onClick={copyReport} disabled={!currentWeek} title="Texto listo para mandarle a tu mentor por WhatsApp">
          {reportCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <ClipboardCopy className="w-4 h-4" />} {reportCopied ? 'Copiado' : 'Reporte para el mentor'}
        </button>
        <button type="button" className={btnGhost} onClick={exportCsv}>
          <Download className="w-4 h-4" /> Exportar a Excel
        </button>
      </div>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th className="text-left p-3 font-semibold text-[var(--text-secondary)]">Métrica</th>
              {weeks.map((w) => (
                <th key={w.start} className="p-3 text-center font-semibold text-[var(--text-secondary)] whitespace-nowrap">
                  {w.label}
                  <span className="block text-[11px] font-normal text-[var(--text-tertiary)]">{w.range}</span>
                </th>
              ))}
              <th className="p-3 text-center font-semibold text-[var(--text-primary)]">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, key]) => (
              <tr key={key} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="p-3 font-medium text-[var(--text-primary)] whitespace-nowrap">{label}</td>
                {weeks.map((w) => (
                  <td key={w.start} className={`p-3 text-center tabular-nums ${today >= w.start && today <= w.end ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                    {w[key]}
                  </td>
                ))}
                <td className="p-3 text-center tabular-nums font-semibold text-[var(--text-primary)]">{total(key)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {difusion.length > 0 && (
        <div className={`${card} p-4 space-y-2`}>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Cómo difunden su trabajo (lo que te respondieron)</p>
          <ul className="space-y-1.5">
            {difusion.map(([k, n]) => (
              <li key={k} className="flex items-center gap-3 text-sm">
                <span className="w-44 shrink-0 text-[var(--text-secondary)]">{DIFUSION_LABELS[k]}</span>
                <span className="flex-1 h-2 rounded-full bg-[var(--bg-surface-muted)] overflow-hidden">
                  <span className="block h-full bg-[var(--accent)]" style={{ width: `${Math.round((n / difusionTotal) * 100)}%` }} />
                </span>
                <span className="w-8 text-right tabular-nums text-[var(--text-primary)]">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <BreakdownCard title="Respuesta por país" rows={byCountry} label={(k) => COUNTRY_NAMES[k] || k} />
        <BreakdownCard title="Respuesta por rubro" rows={bySegment} label={(k) => k.charAt(0).toUpperCase() + k.slice(1)} />
        <BreakdownCard title="Respuesta por prioridad" rows={byTier} label={(k) => `Prioridad ${k}`} />
        {byVariant.length > 1 && <BreakdownCard title="Primer mensaje: versión A vs B" rows={byVariant} label={(k) => `Versión ${k}`} />}
        {reasons.length > 0 && (
          <div className={`${card} p-4 space-y-2`}>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Por qué se perdieron</p>
            <ul className="space-y-1">
              {reasons.slice(0, 8).map((r) => (
                <li key={r.reason} className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">{r.reason}</span>
                  <span className="tabular-nums text-[var(--text-primary)]">{r.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="text-xs text-[var(--text-tertiary)]">
        Los países que responden más que el promedio (con al menos 8 contactados) suben solos en la reserva cuando sumás contactos.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className={`${card} p-4`}>
          <p className="text-xs text-[var(--text-secondary)]">Tasa de respuesta</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{pct(resp, out)}</p>
          <p className="text-xs text-[var(--text-tertiary)]">{resp} respuestas de {out} conversaciones iniciadas</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-xs text-[var(--text-secondary)]">De respuesta a auditoría</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{pct(aud, resp)}</p>
          <p className="text-xs text-[var(--text-tertiary)]">{aud} auditorías de {resp} que respondieron</p>
        </div>
      </div>
    </div>
  );
};

// ======================= MENSAJES Y AJUSTES =======================

const SettingsPanel: React.FC<{ settings: ProspectingSettings }> = ({ settings }) => {
  const [draft, setDraft] = useState<ProspectingSettings>(settings);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const snippet = buildWebSnippet(typeof window !== 'undefined' ? window.location.origin : '');

  const save = async () => {
    await saveProspectingSettings(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const numberField = (label: string, key: 'followUpDays' | 'maxFollowUps' | 'dailyCap' | 'firstContactsPerDay' | 'closeHour' | 'weeklyGoal', min: number, max: number) => (
    <label className="space-y-1">
      <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: Math.min(max, Math.max(min, parseInt(e.target.value, 10) || min)) })}
        className={input}
      />
    </label>
  );

  const tpl = (label: string, value: string, onChange: (v: string) => void) => (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={`${input} resize-y`} />
    </label>
  );

  return (
    <div className="space-y-4">
      <section className={`${card} p-4 space-y-3`}>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Ritmo</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {numberField('Días entre seguimientos', 'followUpDays', 1, 14)}
          {numberField('Seguimientos máximos', 'maxFollowUps', 1, 6)}
          {numberField('Tope de acciones por día', 'dailyCap', 1, 40)}
          {numberField('Primeros mensajes por día', 'firstContactsPerDay', 1, 20)}
          {numberField('Cierre del día desde las (hora)', 'closeHour', 12, 23)}
          {numberField('Meta semanal de conversaciones', 'weeklyGoal', 0, 300)}
        </div>
        <div className="space-y-1">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Días en que prospectás (la tanda semanal se reparte en estos)</span>
          <div className="flex gap-1.5 flex-wrap">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d, i) => {
              const on = draft.workDays.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    const next = on ? draft.workDays.filter((x) => x !== i) : [...draft.workDays, i].sort();
                    if (next.length) setDraft({ ...draft, workDays: next });
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border ${on ? 'bg-[var(--accent)] text-[var(--on-accent)] border-transparent' : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Tu link para agendar llamadas (Google Calendar, Calendly, Cal.com)</span>
          <input value={draft.bookingUrl} onChange={(e) => setDraft({ ...draft, bookingUrl: e.target.value.trim() })} placeholder="https://calendar.app.google/…" className={input} />
        </label>
      </section>

      <section className={`${card} p-4 space-y-3`}>
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Mensajes</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Se completan solos: <code>{'{saludo}'}</code> (su @ de Instagram o el nombre del estudio), <code>{'{nombre}'}</code> (primer nombre), <code>{'{estudio}'}</code>,{' '}
            <code>{'{link}'}</code> (su link personal de auditoría), <code>{'{personal}'}</code> (la frase con IA sobre su estudio; si no hay, una genérica),{' '}
            <code>{'{video}'}</code> (link del video) y <code>{'{agenda}'}</code> (tu link para agendar).
          </p>
        </div>
        <div className="space-y-2 p-3 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Primer mensaje: versiones que se reparten</p>
          <p className="text-xs text-[var(--text-secondary)]">
            Cada prospecto recibe una de estas versiones (siempre la misma), así no le llega a todos el mismo texto. Usá <code>{'{saludoHora}'}</code> (buen día / buenas tardes según
            la hora en su país), <code>{'{rubro}'}</code>, <code>{'{ciudad}'}</code> y <code>{'{personal}'}</code> (frase con IA sobre su estudio o, si no hay, una apertura distinta
            para cada uno).
          </p>
          {draft.templates.firstVariants.map((v, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-xs text-[var(--text-tertiary)] tabular-nums pt-2 w-4">{i + 1}</span>
              <textarea
                value={v}
                onChange={(e) => {
                  const firstVariants = [...draft.templates.firstVariants];
                  firstVariants[i] = e.target.value;
                  setDraft({ ...draft, templates: { ...draft.templates, firstVariants } });
                }}
                rows={3}
                className={`${input} resize-y`}
                aria-label={`Versión ${i + 1} del primer mensaje`}
              />
              <button
                type="button"
                aria-label="Quitar versión"
                disabled={draft.templates.firstVariants.length <= 1}
                onClick={() => setDraft({ ...draft, templates: { ...draft.templates, firstVariants: draft.templates.firstVariants.filter((_, j) => j !== i) } })}
                className="p-2 text-[var(--text-tertiary)] hover:text-red-400 disabled:opacity-30"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={`${btnGhost} text-xs`}
            onClick={() => setDraft({ ...draft, templates: { ...draft.templates, firstVariants: [...draft.templates.firstVariants, ''] } })}
          >
            + Agregar versión
          </button>
        </div>
        {tpl('Tu primer mensaje propio (si lo cambiás, entra también en la rotación)', draft.templates.first, (v) => setDraft({ ...draft, templates: { ...draft.templates, first: v } }))}
        {tpl('Primer mensaje versión B (opcional: si lo completás, la mitad recibe esta y en Métricas ves cuál responde más)', draft.templates.firstB, (v) =>
          setDraft({ ...draft, templates: { ...draft.templates, firstB: v } })
        )}
        {tpl('Segunda chance (a los 90 días, a quien nunca respondió)', draft.templates.secondChance, (v) => setDraft({ ...draft, templates: { ...draft.templates, secondChance: v } }))}
        <h3 className="text-sm font-semibold text-[var(--text-primary)] pt-2">Seguimiento según la etapa</h3>
        {tpl('No contestó la pregunta', draft.templates.followUpQuestion, (v) => setDraft({ ...draft, templates: { ...draft.templates, followUpQuestion: v } }))}
        {tpl('No contestó después de la empatía', draft.templates.followUpAgree, (v) => setDraft({ ...draft, templates: { ...draft.templates, followUpAgree: v } }))}
        {tpl('Le pasaste el link y no completó la auditoría', draft.templates.followUpAudit, (v) => setDraft({ ...draft, templates: { ...draft.templates, followUpAudit: v } }))}
        {draft.templates.followUp.map((f, i) =>
          tpl(`Seguimiento ${i + 1}`, f, (v) => {
            const followUp = [...draft.templates.followUp];
            followUp[i] = v;
            setDraft({ ...draft, templates: { ...draft.templates, followUp } });
          })
        )}
        <h3 className="text-sm font-semibold text-[var(--text-primary)] pt-2">Guion cuando responde</h3>
        {tpl('1. La pregunta', draft.templates.question, (v) => setDraft({ ...draft, templates: { ...draft.templates, question: v } }))}
        {(Object.keys(DIFUSION_LABELS) as DifusionKey[]).map((k) =>
          tpl(`2. Empatía si responde: ${DIFUSION_LABELS[k]}`, draft.templates.empathy[k], (v) =>
            setDraft({ ...draft, templates: { ...draft.templates, empathy: { ...draft.templates.empathy, [k]: v } } })
          )
        )}
        {tpl('3. Speech (caballo de Troya) + link de auditoría', draft.templates.speech, (v) => setDraft({ ...draft, templates: { ...draft.templates, speech: v, audit: v } }))}
        {tpl('Video de la auditoría', draft.templates.video, (v) => setDraft({ ...draft, templates: { ...draft.templates, video: v } }))}
        {tpl('Después del video: invitar a agendar la llamada', draft.templates.booking, (v) => setDraft({ ...draft, templates: { ...draft.templates, booking: v } }))}
        {tpl('Seguimiento de la propuesta', draft.templates.proposal, (v) => setDraft({ ...draft, templates: { ...draft.templates, proposal: v } }))}
      </section>

      <button type="button" className={btnPrimary} onClick={save}>
        {saved ? <Check className="w-4 h-4" /> : null} {saved ? 'Guardado' : 'Guardar cambios'}
      </button>

      <CalendlyConnect onUseLink={(url) => setDraft((d) => ({ ...d, bookingUrl: d.bookingUrl || url }))} />

      <section className={`${card} p-4 space-y-3`}>
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Conectar tu formulario de auditoría</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            En el archivo de somospuntocero.online/auditoria, dentro de <code>form.addEventListener('submit', …)</code>, pegá esto justo después del bucle que agrega
            las respuestas <code>q1</code> a <code>q15</code> y antes de <code>function advanceToResults()</code>. Ya tiene la dirección de tu CRM.
          </p>
        </div>
        <pre className="text-[11px] leading-relaxed p-3 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)] overflow-x-auto text-[var(--text-primary)]">{snippet}</pre>
        <button
          type="button"
          className={btnGhost}
          onClick={() =>
            navigator.clipboard?.writeText(snippet).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <ClipboardCopy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar fragmento'}
        </button>
      </section>
    </div>
  );
};

// Pasos del guion de conversación, para ver en qué punto está con cada persona
const SCRIPT_STEPS: { id: import('../types').ConvStep; label: string }[] = [
  { id: 'pregunta', label: 'Pregunta' },
  { id: 'esperando_respuesta', label: 'Su respuesta' },
  { id: 'empatia', label: 'Empatía' },
  { id: 'esperando_acuerdo', label: 'Coincide' },
  { id: 'speech', label: 'Speech + link' },
];

const ScriptSteps: React.FC<{ step: import('../types').ConvStep; difusion?: DifusionKey }> = ({ step, difusion }) => {
  const idx = SCRIPT_STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="flex items-center gap-1 overflow-x-auto no-scrollbar" aria-label="Pasos del guion">
      {SCRIPT_STEPS.map((s, i) => (
        <li key={s.id} className="flex items-center gap-1 shrink-0">
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
              i < idx ? 'bg-emerald-500/15 text-emerald-400' : i === idx ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--bg-surface-muted)] text-[var(--text-tertiary)]'
            }`}
            aria-current={i === idx ? 'step' : undefined}
          >
            {s.label}
            {s.id === 'esperando_respuesta' && difusion && i < idx ? `: ${DIFUSION_LABELS[difusion]}` : ''}
          </span>
          {i < SCRIPT_STEPS.length - 1 && <span className="text-[var(--text-tertiary)] text-[11px]">›</span>}
        </li>
      ))}
    </ol>
  );
};

const LOST_REASONS = ['Precio', 'No es el momento', 'Eligió a otro', 'Dejó de responder', 'No era lo que buscaba'];

const BreakdownCard: React.FC<{ title: string; rows: { key: string; contacted: number; replied: number }[]; label: (k: string) => string }> = ({ title, rows, label }) => {
  if (rows.length === 0) return null;
  return (
    <div className={`${card} p-4 space-y-2`}>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      <ul className="space-y-1.5">
        {rows.slice(0, 8).map((r) => {
          const pct = r.contacted ? Math.round((r.replied / r.contacted) * 100) : 0;
          return (
            <li key={r.key} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 truncate text-[var(--text-secondary)]">{label(r.key)}</span>
              <span className="flex-1 h-2 rounded-full bg-[var(--bg-surface-muted)] overflow-hidden">
                <span className="block h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-20 text-right tabular-nums text-xs text-[var(--text-primary)]">
                {pct}% <span className="text-[var(--text-tertiary)]">de {r.contacted}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/**
 * Agendar la llamada: día, hora y duración. Además de cambiar la etapa, la crea en tu
 * agenda (y en Google Calendar si está conectado) con recordatorio 15 minutos antes.
 * Si la reprogramás, se actualiza la misma reunión.
 */
const CallScheduler: React.FC<{ prospect: Prospect; onAct: (p: Prospect, a: ProspectAction, n?: string) => unknown; onClose: () => void }> = ({ prospect: p, onAct, onClose }) => {
  const today = todayLocal();
  const [date, setDate] = useState(p.callDate && p.callDate >= today ? p.callDate : addDays(today, 1));
  const [time, setTime] = useState(p.callTime || '11:00');
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Preparación: tareas para el día anterior (o hoy, si la llamada es mañana u hoy)
  const [prep, setPrep] = useState<PrepTask[]>(() => suggestedPrepTasks(p));
  const [extra, setExtra] = useState('');
  const prepDate = date ? prepDateFor(date, today) : today;

  const save = async () => {
    if (!date || !time) return setErr('Elegí el día y la hora.');
    setBusy(true);
    setErr(null);
    try {
      await saveMeetingToFirestore(callMeetingFor(p, date, time, minutes, today) as any);
      const chosen = [...prep.filter((t) => t.on), ...(extra.trim() ? [{ key: 'propia', title: extra.trim(), on: true }] : [])];
      await Promise.all(
        chosen.map((t) =>
          saveTaskToFirestore({
            id: prepTaskId(p.id, t.key),
            title: t.title,
            date: prepDate,
            completed: false,
            createdAt: today,
            priority: 'alta',
            projectName: p.studio || p.name,
            notes: `Para la llamada del ${date.slice(8, 10)}/${date.slice(5, 7)} a las ${time}.`,
          } as any)
        )
      );
      await onAct(p, 'call', `${date} ${time}`);
      onClose();
    } catch (e) {
      setErr(`No se pudo agendar: ${friendlyError(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 p-3 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)]">
      <p className="text-xs font-semibold text-[var(--text-primary)]">¿Cuándo es la llamada con {p.studio || p.name}? (hora de Argentina)</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className={`${input} w-auto text-xs py-1.5`} aria-label="Día de la llamada" />
        <input type="time" value={time} step={900} onChange={(e) => setTime(e.target.value)} className={`${input} w-auto text-xs py-1.5`} aria-label="Hora de la llamada" />
        <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={`${input} w-auto text-xs py-1.5`} aria-label="Duración">
          {[20, 30, 45, 60].map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5 pt-1">
        <p className="text-xs font-semibold text-[var(--text-primary)]">Para prepararla, ¿qué agendo para {prepDayLabel(prepDate, today)}?</p>
        <ul className="space-y-1">
          {prep.map((t, i) => (
            <li key={t.key}>
              <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={t.on}
                  onChange={(e) => setPrep((arr) => arr.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))}
                  className="mt-0.5 w-4 h-4 accent-[var(--accent)] shrink-0"
                />
                <span className={t.on ? 'text-[var(--text-primary)]' : ''}>{t.title}</span>
              </label>
            </li>
          ))}
        </ul>
        <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Otra tarea (opcional)" aria-label="Otra tarea de preparación" className={`${input} text-xs py-1.5`} />
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex gap-1.5">
        <button type="button" disabled={busy} className={`${btnPrimary} py-1.5 text-xs`} onClick={save}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Agendar llamada
          {prep.some((t) => t.on) || extra.trim() ? ` y ${prep.filter((t) => t.on).length + (extra.trim() ? 1 : 0)} tareas` : ''}
        </button>
        <button type="button" disabled={busy} className={`${btnGhost} py-1.5 text-xs`} onClick={onClose}>
          Cancelar
        </button>
      </div>
      <p className="text-[11px] text-[var(--text-tertiary)]">La llamada queda en tu Agenda con aviso 1 hora antes (y en Google Calendar si está conectado). Las tareas aparecen en Hoy ese día.</p>
    </div>
  );
};

/** Conectar Calendly: las reservas entran solas a la Agenda y pasan al prospecto a "Llamada". */
const CalendlyConnect: React.FC<{ onUseLink: (url: string) => void }> = ({ onUseLink }) => {
  const [status, setStatus] = useState<{ tokenConfigured: boolean; connected: boolean; connectedAt: string | null; schedulingUrl: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      const { getAuthHeaders } = await import('../utils/authAccess');
      const r = await fetch('/api/calendly/status', { headers: await getAuthHeaders() });
      if (r.ok) setStatus(await r.json());
    } catch {
      /* sin conexión: se muestra igual la explicación */
    }
  };
  useEffect(() => {
    load();
  }, []);

  const connect = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { getAuthHeaders } = await import('../utils/authAccess');
      const r = await fetch('/api/calendly/connect', { method: 'POST', headers: await getAuthHeaders() });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
      if (data.schedulingUrl) onUseLink(data.schedulingUrl);
      const n = data.sync?.imported || 0;
      setMsg({
        kind: 'ok',
        text: `Calendly conectado. ${n ? `Traje ${n} ${n === 1 ? 'reserva que ya tenías' : 'reservas que ya tenías'} a tu Agenda. ` : ''}Las próximas van a aparecer solas.`,
      });
      load();
    } catch (e) {
      setMsg({ kind: 'error', text: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { getAuthHeaders } = await import('../utils/authAccess');
      const r = await fetch('/api/calendly/sync', { method: 'POST', headers: await getAuthHeaders() });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `Error ${r.status}`);
      setMsg({
        kind: 'ok',
        text: data.imported
          ? `Listo: ${data.imported} ${data.imported === 1 ? 'reserva nueva' : 'reservas nuevas'} en tu Agenda (${data.matched} de prospectos).`
          : 'No había reservas nuevas: tu Agenda ya está al día.',
      });
    } catch (e) {
      setMsg({ kind: 'error', text: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${card} p-4 space-y-3`}>
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Calendly</h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Cuando alguien reserva, la llamada entra sola a tu Agenda (con recordatorio) y el prospecto pasa a "Llamada". Si cancela, vuelve a "Respondió". Poné tu link de
          Calendly arriba en "Tu link para agendar": la app le agrega el código de cada prospecto para reconocerlo.
        </p>
      </div>
      {status?.connected ? (
        <p className="text-sm text-emerald-400 flex items-center gap-1.5">
          <Check className="w-4 h-4" /> Conectado{status.connectedAt ? ` desde el ${shortDate(status.connectedAt.slice(0, 10))}` : ''}
        </p>
      ) : status && !status.tokenConfigured ? (
        <ol className="text-xs text-[var(--text-secondary)] list-decimal pl-4 space-y-1">
          <li>En Calendly: Integraciones → API y webhooks → generá un token personal (hace falta plan Standard o superior).</li>
          <li>
            En AI Studio: Secrets → agregá <code>CALENDLY_TOKEN</code> con ese token y volvé a publicar.
          </li>
          <li>Volvé acá y tocá "Conectar Calendly".</li>
        </ol>
      ) : null}
      <button type="button" className={status?.connected ? btnGhost : btnPrimary} disabled={busy || (status !== null && !status.tokenConfigured)} onClick={connect}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {status?.connected ? 'Reconectar' : 'Conectar Calendly'}
      </button>
      {status?.connected && (
        <button type="button" className={btnGhost} disabled={busy} onClick={syncNow}>
          Traer reservas ya agendadas
        </button>
      )}
      {msg && <p className={`text-xs ${msg.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
    </section>
  );
};

// ======================= A QUIÉN LE TOCA =======================

const TURN_STYLE: Record<Turn, string> = {
  mio: 'bg-emerald-500/15 text-emerald-400',
  suyo: 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]',
  perdido: 'bg-amber-500/15 text-amber-400',
  llamada: 'bg-sky-500/15 text-sky-400',
  sin_contactar: 'bg-[var(--bg-surface-muted)] text-[var(--text-tertiary)]',
  cerrado: 'bg-[var(--bg-surface-muted)] text-[var(--text-tertiary)]',
};

const TurnBadge: React.FC<{ info: { turn: Turn; label: string } }> = ({ info }) =>
  info.turn === 'cerrado' ? null : <span className={`inline-block mt-0.5 mb-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${TURN_STYLE[info.turn]}`}>{info.label}</span>;
