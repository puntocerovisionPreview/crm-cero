import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
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
  renderTemplate,
  templateFor,
  ProspectAction,
} from '../prospecting/core';
import { deleteProspect, recordProspectAction, saveProspectingSettings, saveProspects, updateProspect } from '../prospecting/store';
import { useProspecting } from '../prospecting/useProspecting';
import { usePool, useWeeklyAutoBatch } from '../prospecting/usePool';
import { takeFromPool } from '../prospecting/poolStore';
import { ReservaPanel } from '../components/ReservaPanel';
import { CONV_STEP_LABELS, DIFUSION_LABELS } from '../prospecting/core';
import { DifusionKey } from '../types';
import { buildWebSnippet } from '../prospecting/webSnippet';
import { formatWhatsAppUrl } from '../utils/contact';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { parseLocalDate } from '../utils/dates';

type Tab = 'hoy' | 'prospectos' | 'reserva' | 'cargar' | 'metricas' | 'mensajes';

interface Props {
  projects: Project[];
  onAddProject?: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  initialTab?: Tab;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
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
  const { prospects, events, settings, settingsLoaded, today, hour, loadError } = useProspecting();
  const [tab, setTab] = useState<Tab>(initialTab);
  const list = prospects || [];
  const pool = usePool();
  const [poolNotice, setPoolNotice] = useState<string | null>(null);
  useWeeklyAutoBatch(settings, settingsLoaded, today, (n) => {
    setPoolNotice(`Empezó la semana: pasaron ${n} contactos nuevos de la reserva, repartidos en los días hábiles.`);
    pool.refresh();
  });

  // "Sumar más hoy": toma de la reserva y los deja para hoy (la reserva se va restando)
  const addMoreToday = async (n: number) => {
    hapticFeedback.medium();
    const added = await takeFromPool(n, settings, today, { perDay: n }).catch(() => 0);
    setPoolNotice(added ? `Sumaste ${added} ${added === 1 ? 'contacto' : 'contactos'} más para hoy.` : 'No quedan contactos en la reserva con tus filtros.');
    pool.refresh();
  };

  const queue = useMemo(() => buildDailyQueue(list, today, settings), [list, today, settings]);
  const toClose = useMemo(() => pendingDayClose(list, today), [list, today]);
  const monthKey = today.slice(0, 7);
  const weeks = useMemo(() => computeMonthMetrics(events, monthKey), [events, monthKey]);
  const thisWeek = weeks.find((w) => today >= w.start && today <= w.end);

  const act = async (p: Prospect, action: ProspectAction, note?: string) => {
    hapticFeedback.medium();
    if (action !== 'no_reply' && action !== 'lost') playTaskDone();
    try {
      await recordProspectAction(p, action, today, settings, note);
    } catch (err) {
      console.warn('No se pudo registrar la acción:', err);
    }
  };

  return (
    <div className="space-y-4 pb-24 max-w-4xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Prospección</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {thisWeek
            ? `Esta semana: ${thisWeek.conversacionesOut} conversaciones, ${thisWeek.seguimientos} seguimientos, ${thisWeek.respuestas} respuestas y ${thisWeek.autoAuditorias} auditorías.`
            : 'Tu lista de contactos en frío, día por día.'}
        </p>
      </header>

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

      {prospects !== null && tab === 'hoy' && (
        <TodayPanel
          poolAvailable={pool.availableCount}
          onAddMore={addMoreToday}
          queue={queue.items}
          overflow={queue.overflow}
          toClose={toClose}
          showClose={hour >= settings.closeHour || toClose.length > 0}
          settings={settings}
          onAct={act}
          onGoLoad={() => setTab(pool.availableCount > 0 ? 'reserva' : 'cargar')}
          isEvening={hour >= settings.closeHour}
        />
      )}
      {prospects !== null && tab === 'prospectos' && (
        <ProspectList prospects={list} today={today} settings={settings} onAct={act} onAddProject={onAddProject} />
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
      {prospects !== null && tab === 'metricas' && <MetricsPanel events={events} today={today} prospects={list} />}
      {prospects !== null && tab === 'mensajes' && <SettingsPanel settings={settings} />}
    </div>
  );
};

// ======================= HOY =======================

export const TodayPanel: React.FC<{
  queue: QueueItem[];
  overflow: number;
  toClose: Prospect[];
  showClose: boolean;
  isEvening: boolean;
  settings: ProspectingSettings;
  onAct: (p: Prospect, a: ProspectAction, note?: string) => void;
  onGoLoad?: () => void;
  compact?: boolean;
  poolAvailable?: number;
  onAddMore?: (n: number) => void;
}> = ({ queue, overflow, toClose, showClose, isEvening, settings, onAct, onGoLoad, compact, poolAvailable = 0, onAddMore }) => (
  <div className="space-y-4">
    {showClose && toClose.length > 0 && (
      <section className={`${card} p-4 space-y-3 ${isEvening ? 'border-[var(--accent)]/50' : ''}`}>
        <div className="flex items-start gap-2">
          <Moon className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Cierre del día: ¿qué pasó?</h2>
            <p className="text-xs text-[var(--text-secondary)]">Les escribiste hoy. Un toque por persona y la app agenda lo que sigue.</p>
          </div>
        </div>
        <ul className="space-y-2">
          {toClose.map((p) => (
            <li key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-app)]">
              <span className="flex-1 min-w-0 text-sm font-medium text-[var(--text-primary)] truncate">
                {p.name}
                {p.studio && p.studio !== p.name ? <span className="text-[var(--text-tertiary)]"> — {p.studio}</span> : null}
              </span>
              <div className="flex gap-1.5 shrink-0">
                <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'reply')}>
                  Respondió
                </button>
                <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'no_reply')}>
                  No respondió
                </button>
                <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'lost', 'No le interesa')}>
                  No le interesa
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    )}

    {queue.length === 0 ? (
      <section className={`${card} p-6 text-center space-y-2`}>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Nada pendiente de prospección por hoy.</p>
        {onGoLoad && (
          <>
            <p className="text-xs text-[var(--text-secondary)]">Cargá la tanda de la semana y la app reparte los primeros mensajes.</p>
            <button type="button" className={`${btnPrimary} mx-auto`} onClick={onGoLoad}>
              <Upload className="w-4 h-4" /> Cargar tanda
            </button>
          </>
        )}
      </section>
    ) : (
      <ul className="space-y-2">
        {queue.map((item) => (
          <QueueCard key={item.prospect.id} item={item} settings={settings} onAct={onAct} compact={compact} />
        ))}
      </ul>
    )}
    {overflow > 0 && (
      <p className="text-xs text-[var(--text-tertiary)]">
        {overflow} {overflow === 1 ? 'acción más queda' : 'acciones más quedan'} para mañana (tope diario: {settings.dailyCap}).
      </p>
    )}

    {onAddMore && poolAvailable > 0 && !queue.some((i) => i.kind === 'primer') && (
      <section className={`${card} p-4 flex flex-col sm:flex-row sm:items-center gap-3`}>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Ya no te quedan primeros mensajes para hoy. ¿Sumar más?</p>
          <p className="text-xs text-[var(--text-secondary)]">
            Quedan {poolAvailable.toLocaleString('es-AR')} contactos en la reserva. Se toman los mejores y se descuentan de la base.
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {[2, 5, 10].map((n) => (
            <button key={n} type="button" className={`${n === 2 ? btnPrimary : btnGhost} py-1.5 text-xs`} onClick={() => onAddMore(Math.min(n, poolAvailable))}>
              +{n}
            </button>
          ))}
        </div>
      </section>
    )}
  </div>
);

const QueueCard: React.FC<{ item: QueueItem; settings: ProspectingSettings; onAct: (p: Prospect, a: ProspectAction, n?: string) => void; compact?: boolean }> = ({
  item,
  settings,
  onAct,
  compact,
}) => {
  const p = item.prospect;
  const [open, setOpen] = useState(
    !compact && item.kind !== 'video' && !(item.kind === 'responder' && ['esperando_respuesta', 'esperando_acuerdo'].includes(item.prospect.convStep || ''))
  );
  const [copied, setCopied] = useState(false);
  const message = renderTemplate(templateFor(item, settings), p);
  const ig = normalizeInstagram(p.instagram);

  const copy = () => {
    navigator.clipboard?.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const step = p.convStep || 'pregunta';
  const waiting = item.kind === 'responder' && (step === 'esperando_respuesta' || step === 'esperando_acuerdo');
  const label =
    item.kind === 'seguimiento'
      ? `${QUEUE_LABELS.seguimiento} ${Math.min((p.followUps || 0) + 1, settings.maxFollowUps)} de ${settings.maxFollowUps}`
      : item.kind === 'responder'
      ? `Conversación: ${CONV_STEP_LABELS[step]}`
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

      {item.kind === 'responder' && <ScriptSteps step={step} difusion={p.difusion} />}

      {open && (
        <div className="space-y-1">
          {waiting && <p className="text-[11px] text-[var(--text-tertiary)]">Ya enviado:</p>}
          <p className="text-sm whitespace-pre-wrap text-[var(--text-secondary)] p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)]">{message}</p>
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
          <a href={formatWhatsAppUrl(p.whatsapp, message)} target="_blank" rel="noopener noreferrer" className={`${btnGhost} py-1.5 text-xs`}>
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
        <button type="button" onClick={copy} className={`${btnGhost} py-1.5 text-xs`}>
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>

        <span className="flex-1" />

        {item.kind === 'primer' && (
          <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'first_contact')}>
            <Check className="w-3.5 h-3.5" /> Mensaje enviado
          </button>
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
        {item.kind === 'responder' && (
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
            {waiting && (
              <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'snooze')} title="Ocultarlo hasta mañana">
                Sigue mañana
              </button>
            )}
            <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'call')}>
              Agendamos llamada
            </button>
            <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'lost', 'No le interesa')}>
              No le interesa
            </button>
          </>
        )}
        {item.kind === 'video' && (
          <button type="button" className={`${btnPrimary} py-1.5 text-xs`} onClick={() => onAct(p, 'video_sent')}>
            <Video className="w-3.5 h-3.5" /> Video enviado
          </button>
        )}
      </div>
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
}> = ({ prospects, today, onAct, onAddProject }) => {
  const [filter, setFilter] = useState<'activos' | ProspectStage>('activos');
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    prospects.forEach((p) => (c[p.stage] = (c[p.stage] || 0) + 1));
    return c;
  }, [prospects]);

  const shown = prospects
    .filter((p) => (filter === 'activos' ? !['cliente', 'descartado'].includes(p.stage) : p.stage === filter))
    .filter((p) => !q.trim() || `${p.name} ${p.studio || ''} ${p.city || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || Number(isHot(b)) - Number(isHot(a)) || a.name.localeCompare(b.name));

  const convert = async (p: Prospect) => {
    if (!onAddProject) return;
    onAddProject({
      clientName: p.studio || p.name,
      ownerName: p.name,
      status: 'En curso',
      notes: [
        `Vino de prospección (${p.source || 'en frío'}).`,
        p.audit ? `Auto auditoría: ${p.audit.total}/30, nivel ${p.audit.nivel}. Dolor: ${p.audit.dolorCaptacion || '—'}.` : '',
        p.notes || '',
      ]
        .filter(Boolean)
        .join('\n'),
      archived: false,
      clientPhone: p.whatsapp,
      instagramUrl: p.instagram ? `https://instagram.com/${normalizeInstagram(p.instagram)}` : undefined,
      projectType: 'paf_pro',
      serviceType: 'paf',
      rubro: p.audit?.dedicacion,
      lastContactDate: today,
    } as any);
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
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {STAGE_LABELS[p.stage]}
                    {p.stage === 'nuevo' && p.plannedFirstContact ? ` — primer mensaje el ${shortDate(p.plannedFirstContact)}` : ''}
                    {['contactado', 'auditoria_enviada', 'video_enviado'].includes(p.stage) && p.nextActionDate ? ` — sigue el ${shortDate(p.nextActionDate)}` : ''}
                    {p.audit ? ` — ${p.audit.total}/30` : ''}
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
                    {['nuevo', 'contactado', 'auditoria_enviada', 'video_enviado'].includes(p.stage) && (
                      <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'reply')}>
                        Respondió
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
                        <button type="button" className={`${btnGhost} py-1.5 text-xs`} onClick={() => onAct(p, 'call')}>
                          Llamada agendada
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
                    {p.stage === 'descartado' && (
                      <button
                        type="button"
                        className={`${btnGhost} py-1.5 text-xs`}
                        onClick={() => updateProspect(p.id, { stage: 'contactado', nextActionDate: today, followUps: 0 })}
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
  const dates = distributeFirstContacts(count, today, perDay);

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

const MetricsPanel: React.FC<{ events: import('../types').ProspectEvent[]; today: string; prospects: Prospect[] }> = ({ events, today, prospects }) => {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <input type="month" value={monthKey} onChange={(e) => e.target.value && setMonthKey(e.target.value)} className={`${input} w-auto`} aria-label="Mes" />
        <span className="flex-1" />
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

  const numberField = (label: string, key: 'followUpDays' | 'maxFollowUps' | 'dailyCap' | 'firstContactsPerDay' | 'closeHour', min: number, max: number) => (
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
        </div>
      </section>

      <section className={`${card} p-4 space-y-3`}>
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Mensajes</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Se completan solos: <code>{'{saludo}'}</code> (su @ de Instagram o el nombre del estudio), <code>{'{nombre}'}</code> (primer nombre), <code>{'{estudio}'}</code> y <code>{'{link}'}</code> (su link personal de auditoría).
          </p>
        </div>
        {tpl('Primer mensaje', draft.templates.first, (v) => setDraft({ ...draft, templates: { ...draft.templates, first: v } }))}
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
      </section>

      <button type="button" className={btnPrimary} onClick={save}>
        {saved ? <Check className="w-4 h-4" /> : null} {saved ? 'Guardado' : 'Guardar cambios'}
      </button>

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
