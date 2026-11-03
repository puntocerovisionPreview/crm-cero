import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Check, Copy, ExternalLink, Eye, Loader2, Package, Trash2, Undo2 } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { newItemId } from '../panels/model';
import {
  APPROVAL_CHANNELS, CLIENTE_ID_RE, PAF_PORTAL_LINK_KEYS, PAF_PORTAL_LINK_LABEL, PAF_TASK_STATE_LABEL, PRESENCIA_HITOS,
  approveTask, draftAccesos, emptyPortalDraft, nextMeeting, normalizeEmails, portalDirty, portalFromProject, portalGoals, reopenTask, safeHttpsUrl, whatsappDigits,
  missingTemplateTasks, PAF_STAGE_TEMPLATES, suggestedChannel, type PafDelivery, type PafPedidoAlta, type PafPortalDoc, type PafPortalDraft, type PafTask, type PafTaskState,
} from '../portal/model';
import { publishPafPortal, publishPortalExtras, republishIfPublished, savePafConfig, subscribePafConfig, subscribePafPortal, subscribePedidoDeProyecto, unpublishPafPortal } from '../portal/store';
import { subscribePanelOfProject } from '../panels/store';
import type { ClientPanel } from '../panels/model';
import { SegmentedControl } from '../ui';
import { hapticFeedback } from '../utils/haptics';
import { PafAltaCard } from './PafAltaCard';
import { PafReunionCard } from './PafReunionCard';
import { PafWeekGoals } from './PafWeekGoals';
import { PafMeetingSummaries } from './PafMeetingSummaries';
import { PafAnnouncements } from './PafAnnouncements';

const input = 'w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';
const STATE_STYLE: Record<PafTaskState, string> = {
  borrador: 'bg-zinc-800 text-zinc-400',
  habilitada: 'bg-sky-500/15 text-sky-300',
  enviada: 'bg-amber-400/15 text-amber-300',
  aprobada: 'bg-emerald-500/15 text-emerald-300',
};

type Tab = 'hoy' | 'tareas' | 'config';
type Props = {
  project: Project;
  meetings: AgendaMeeting[];
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onAddMeeting: (meeting: Omit<AgendaMeeting, 'id' | 'createdAt'>) => void;
  /** Alta con Tally (solo PAF) */
  showAlta?: boolean;
};

/**
 * PANEL DEL ESTUDIO (ficha PAF). Encabezado fijo con estado, etapa y accesos; debajo:
 * - Hoy: foco de la semana, tareas para revisar, próxima reunión y entregas.
 * - Tareas: la lista completa.
 * - Configuración: alta, acceso, enlaces y, al final, despublicar.
 * Etapa, foco, correos y enlaces se guardan solos en la ficha; si difieren de lo que ve
 * el estudio, el encabezado avisa "Hay cambios sin publicar". Tareas y entregas se publican solas.
 */
type Adding = null | 'anuncio' | 'tarea' | 'acceso' | 'entrega' | 'reunion' | 'acuerdo';
const ADD_OPTIONS: { id: Exclude<Adding, null | 'acuerdo'>; label: string }[] = [
  { id: 'anuncio', label: 'Anuncio' },
  { id: 'tarea', label: 'Tarea' },
  { id: 'acceso', label: 'Acceso' },
  { id: 'entrega', label: 'Entrega' },
  { id: 'reunion', label: 'Reunión' },
];

/**
 * "LO QUE VE EL CLIENTE": un espejo editable de su portal, en el mismo orden que lo ve él:
 * avance, anuncios, esta semana, tareas, próxima reunión y lo que acordamos, entregas y archivos.
 * Cada sección aparece solo si tiene algo (o si la estás agregando). Todo se publica solo.
 * Los ajustes (alta, correos, WhatsApp, despublicar) quedan plegados abajo.
 */
export const PafAdminPanel: React.FC<Props> = ({ project, meetings, onUpdateProject, onAddMeeting, showAlta = true }) => {
  const [adding, setAdding] = useState<Adding>(null);
  const [editWeek, setEditWeek] = useState(false);
  const portal = usePortalDraft(project, meetings, onUpdateProject);
  const work = usePafWork(project, meetings, onUpdateProject);
  const toReview = work.tasks.filter((t) => t.estado === 'enviada');
  const accesos = draftAccesos(portal.draft);
  const today = new Date().toLocaleDateString('en-CA');
  const next = nextMeeting(meetings, project.id, today);
  const resumenes = project.pafResumenes || [];
  const hasWeek = !!portal.draft.resumen.trim();
  const empty = !(project.pafAnuncios || []).length && !work.tasks.length && !accesos.length && !work.deliveries.length && !next && !hasWeek;
  const toggle = (id: Exclude<Adding, null>) => setAdding((a) => (a === id ? null : id));
  const done = () => setAdding(null);

  return (
    <div className="space-y-5">
      <PanelHeader portal={portal} studio={project.clientName} />

      {/* Avance: etapa y si el cliente lo ve, en una línea */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">Avance</span>
        <select aria-label="Etapa" className="rounded-lg bg-zinc-950 border border-zinc-800 px-2 py-1 text-xs text-zinc-100" value={portal.draft.hito} onChange={(e) => portal.set({ hito: Number(e.target.value) })}>
          {PRESENCIA_HITOS.map((t, i) => <option key={t} value={i + 1}>{i + 1}. {t}</option>)}
        </select>
        <label className="ml-auto inline-flex items-center gap-1.5 text-zinc-400">
          <input type="checkbox" checked={portal.draft.mostrarAvance !== false} onChange={(e) => portal.set({ mostrarAvance: e.target.checked })} />
          Mostrar avance
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Agregar al portal">
        {ADD_OPTIONS.map((o) => (
          <button key={o.id} type="button" onClick={() => toggle(o.id)} aria-pressed={adding === o.id}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${adding === o.id ? 'border-zinc-100 bg-zinc-100 text-zinc-950' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}>
            + {o.label}
          </button>
        ))}
      </div>

      {toReview.length > 0 && (
        <Block title={`Para revisar (${toReview.length})`} hint="El cliente avisó que las terminó. Aprobá o volvé a habilitar.">
          <TaskList tasks={toReview} work={work} />
        </Block>
      )}

      {empty && !adding && <p className="rounded-xl border border-dashed border-zinc-700 p-4 text-center text-xs text-zinc-500">El cliente todavía no ve nada. Empezá con “+ Anuncio” o “+ Tarea”.</p>}

      {((project.pafAnuncios || []).length > 0 || adding === 'anuncio') && (
        <PafAnnouncements project={project} meetings={meetings} onUpdateProject={onUpdateProject} showForm={adding === 'anuncio'} onDone={done} />
      )}

      {/* Esta semana: una línea si no hay nada; se abre para editar */}
      <Block title="Esta semana" badge={!editWeek && <button type="button" onClick={() => setEditWeek(true)} className="ml-auto text-[11px] font-normal text-zinc-400 hover:text-zinc-200">{hasWeek ? 'Editar' : 'Agregar foco u objetivos'}</button>}>
        {editWeek ? (
          <div className="space-y-2">
            <textarea className={input} rows={2} value={portal.draft.resumen} placeholder="Foco de la semana (lo lee arriba de todo)" onChange={(e) => portal.set({ resumen: e.target.value })} />
            <PafWeekGoals project={project} publishedId={portal.published?.clienteId} />
            <button type="button" onClick={() => setEditWeek(false)} className="text-[11px] text-zinc-400 hover:text-zinc-200">Listo</button>
          </div>
        ) : hasWeek ? <p className="text-xs text-zinc-300 whitespace-pre-line line-clamp-2">{portal.draft.resumen}</p> : null}
      </Block>

      {(work.tasks.length > 0 || adding === 'tarea') && (
        <Block title="Lo que necesitamos de vos" hint="Tareas del cliente. Las ocultas no las ve hasta que tocás Habilitar.">
          {adding === 'tarea' && <AddTask work={work} onDone={done} />}
          {work.tasks.length > 0 && <TaskList tasks={work.tasks.filter((t) => t.estado !== 'enviada')} work={work} />}
        </Block>
      )}

      {(next || adding === 'reunion' || resumenes.length > 0 || adding === 'acuerdo') && (
        <Block title="Próxima reunión" badge={adding !== 'acuerdo' && <button type="button" onClick={() => setAdding('acuerdo')} className="ml-auto text-[11px] font-normal text-zinc-400 hover:text-zinc-200">Anotar lo que acordamos</button>}>
          {next ? <p className="text-xs text-zinc-200">{next.fecha}{next.hora ? ` · ${next.hora} hs` : ''}</p> : !adding && <p className="text-xs text-zinc-500">Sin reunión agendada.</p>}
          {adding === 'reunion' && <PafReunionCard project={project} meetings={meetings} onAddMeeting={(m) => { onAddMeeting(m); done(); }} />}
          {(resumenes.length > 0 || adding === 'acuerdo') && <PafMeetingSummaries project={project} meetings={meetings} onUpdateProject={onUpdateProject} showForm={adding === 'acuerdo'} onDone={done} />}
        </Block>
      )}

      {(work.deliveries.length > 0 || adding === 'entrega') && <Deliveries work={work} showForm={adding === 'entrega'} onDone={done} />}

      {(accesos.length > 0 || adding === 'acceso') && (
        <Block title="Archivos" hint="Accesos directos: nombre y link (solo https). La carpeta interna y la ficha se bloquean solas.">
          <AccessEditor items={accesos} startAdding={adding === 'acceso'} onChange={(list) => { portal.set({ accesos: list }); }} />
        </Block>
      )}

      <details className="group rounded-xl border border-zinc-800">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200">Ajustes del portal</summary>
        <div className="space-y-5 border-t border-zinc-800 p-3">
          {showAlta && <PafAltaCard project={project} onUpdateProject={onUpdateProject} />}
          <Block title="Quién puede entrar" hint="Solo estos correos, con su cuenta de Google. El del alta se agrega solo.">
            <label className="block text-[11px] text-zinc-400">ID del cliente
              <input className={`${input} font-mono`} value={portal.clienteId} disabled={!!portal.published} placeholder="PAF-002" onChange={(e) => portal.setClienteId(e.target.value.toUpperCase())} />
            </label>
            <label className="block text-[11px] text-zinc-400 mt-2">Correos autorizados
              <input className={input} value={portal.emailsText} placeholder="estudio@gmail.com, socia@gmail.com" onChange={(e) => portal.setEmailsText(e.target.value)} />
            </label>
          </Block>
          <Block title="Tu WhatsApp" hint="Para el botón «Hablar con Juan». Es uno solo para todos los clientes.">
            <WhatsappField value={portal.whatsapp} onSave={portal.saveWhatsapp} />
          </Block>
          {portal.published && (
            <div className="rounded-xl border border-rose-500/20 p-3 flex items-center gap-3">
              <p className="flex-1 text-[11px] text-zinc-400">Despublicar: el cliente deja de ver su portal.</p>
              <button type="button" onClick={portal.unpublish} disabled={portal.busy} className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/10">Despublicar</button>
            </div>
          )}
        </div>
      </details>
    </div>
  );
};

// ---------- Encabezado ----------

function PanelHeader({ portal, studio }: { portal: ReturnType<typeof usePortalDraft>; studio: string }) {
  const { published } = portal;
  const status = !published ? { text: 'Sin publicar', dot: 'bg-zinc-500' }
    : { text: `Publicado · ${new Date(published.actualizadoEn).toLocaleDateString('es-AR')}`, dot: 'bg-emerald-500' };
  const viewUrl = published ? `/portal?ver=${encodeURIComponent(published.clienteId)}` : '';

  return (
    <div className="rounded-xl border border-zinc-800 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${status.dot}`} aria-hidden />
        <span className="flex-1 text-xs font-semibold text-zinc-100">{status.text}</span>
        {published && <span className="text-[10px] font-mono text-zinc-500">{published.clienteId}</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {!published && (
          <button type="button" onClick={portal.publish} disabled={portal.busy} className="btn-solid-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
            {portal.busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Publicar portal
          </button>
        )}
        {published && (
          <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 text-xs font-bold" title={`Así ve ${studio} su portal (solo lectura)`}>
            <Eye className="w-3.5 h-3.5" /> Ver como cliente
          </a>
        )}
        <button type="button" onClick={portal.copyLink} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 text-xs font-bold">
          <Copy className="w-3.5 h-3.5" /> Copiar enlace
        </button>
      </div>
      {portal.errors.length > 0 && <ul role="alert" className="text-[11px] text-rose-300 space-y-0.5">{portal.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      {portal.notice && <p role="status" className="text-[11px] text-emerald-300">{portal.notice}</p>}
    </div>
  );
}

function Block({ title, hint, badge, children }: { title: string; hint?: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-zinc-100">{title}{badge}</h3>
        {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

// ---------- Borrador del portal (se guarda solo) ----------

function usePortalDraft(project: Project, meetings: AgendaMeeting[], onUpdateProject: Props['onUpdateProject']) {
  const [clienteId, setClienteId] = useState(project.pafClienteId || '');
  const [draft, setDraft] = useState<PafPortalDraft>(() => project.pafPortal || emptyPortalDraft(project.clientEmail));
  const [emailsText, setEmailsText] = useState((project.pafPortal?.emails || draft.emails).join(', '));
  const [published, setPublished] = useState<PafPortalDoc | null | undefined>(undefined);
  const [pedido, setPedido] = useState<PafPedidoAlta | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');

  const savedId = project.pafClienteId && CLIENTE_ID_RE.test(project.pafClienteId) ? project.pafClienteId : '';
  useEffect(() => {
    if (!savedId) { setPublished(null); return; }
    return subscribePafPortal(savedId, setPublished);
  }, [savedId]);
  useEffect(() => subscribePedidoDeProyecto(project.id, setPedido), [project.id]);
  // Para publicar junto: objetivos de la semana (panel del estudio) y tu WhatsApp
  const [panel, setPanel] = useState<ClientPanel | null>(null);
  const [config, setConfig] = useState<{ whatsapp?: string }>({});
  useEffect(() => subscribePanelOfProject(project.id, setPanel), [project.id]);
  useEffect(() => subscribePafConfig(setConfig), []);

  // El ID que asigna el alta llega después: si todavía no se publicó, lo toma
  useEffect(() => {
    if (project.pafClienteId && !published) setClienteId(project.pafClienteId);
  }, [project.pafClienteId, published]);

  // El correo del alta (con el que se comparte la carpeta) es el que entra al portal
  const altaEmail = pedido?.email;
  useEffect(() => {
    if (altaEmail) setEmailsText((t) => (normalizeEmails(t).includes(altaEmail.toLowerCase()) ? t : [t.trim(), altaEmail].filter(Boolean).join(', ')));
  }, [altaEmail]);

  // La carpeta del estudio que pegás en el alta pasa a "Tu carpeta" si está vacía
  const sharedFolder = project.pafDrive?.carpetaCompartida;
  useEffect(() => {
    if (sharedFolder) setDraft((d) => (d.enlaces.carpeta ? d : { ...d, enlaces: { ...d.enlaces, carpeta: sharedFolder } }));
  }, [sharedFolder]);

  // Guardado automático en la ficha (no publica)
  const current = useMemo(() => ({ ...draft, emails: normalizeEmails(emailsText) }), [draft, emailsText]);
  // Solo guarda si algo cambió de verdad (abrir la ficha no escribe nada)
  const snapshot = (d: PafPortalDraft) => JSON.stringify([d.emails, d.hito, d.resumen, d.enlaces, d.accesos ?? null, d.mostrarAvance ?? null]);
  const lastSaved = useRef(snapshot(current));
  useEffect(() => {
    const snap = snapshot(current);
    if (snap === lastSaved.current) return;
    const t = setTimeout(() => {
      lastSaved.current = snap;
      onUpdateProject(project.id, { pafPortal: { ...current, publishedAt: project.pafPortal?.publishedAt } });
      // Si el portal ya está publicado, el cambio se publica solo (sin "Publicar cambios")
      if (published) {
        const r = portalFromProject(project, meetings, current, clienteId, new Date(), privados);
        if ('errors' in r) setErrors(r.errors);
        else { setErrors([]); publishPafPortal(r.doc).catch(() => setErrors(['Se guardó, pero no se pudo actualizar el portal. Reintentá.'])); }
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Si cambia la próxima reunión en la agenda, el portal publicado se actualiza solo
  const today = new Date().toLocaleDateString('en-CA');
  const nextKey = JSON.stringify(nextMeeting(meetings, project.id, today));
  useEffect(() => {
    if (!published || !project.pafPortal?.publishedAt || JSON.stringify(published.proximaReunion ?? null) === nextKey) return;
    const r = portalFromProject(project, meetings);
    if ('doc' in r) publishPafPortal(r.doc).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextKey, published?.proximaReunion]);

  const privados = [pedido?.alta?.carpetaInterna, pedido?.alta?.ficha];
  const set = (patch: Partial<PafPortalDraft>) => { setDraft((d) => ({ ...d, ...patch })); setNotice(''); };

  const publish = async () => {
    hapticFeedback.light();
    const result = portalFromProject(project, meetings, current, clienteId, new Date(), privados);
    if ('errors' in result) { setErrors(result.errors); return; }
    setBusy(true); setErrors([]); setNotice('');
    try {
      await publishPafPortal(result.doc);
      await publishPortalExtras(result.doc.clienteId, { objetivos: portalGoals(panel?.goals), contacto: { whatsapp: config.whatsapp || '' } });
      onUpdateProject(project.id, { pafClienteId: result.doc.clienteId, pafPortal: { ...current, publishedAt: result.doc.actualizadoEn } });
      setNotice(published ? 'Cambios publicados.' : 'Publicado. Copiá el enlace y pasáselo por tu canal.');
    } catch {
      setErrors(['No se pudo publicar. Revisá la conexión y reintentá.']);
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    if (!savedId || !window.confirm(`¿Despublicar el portal de ${project.clientName}? El estudio deja de verlo.`)) return;
    setBusy(true); setErrors([]); setNotice('');
    try {
      await unpublishPafPortal(savedId);
      // Sin fecha de publicación: los cambios de tareas ya no lo vuelven a publicar
      onUpdateProject(project.id, { pafPortal: { ...current, publishedAt: undefined } });
      setNotice('Portal despublicado.');
    } catch {
      setErrors(['No se pudo despublicar. Reintentá.']);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/portal`;
    try { await navigator.clipboard.writeText(url); setNotice('Enlace copiado. Pasáselo por tu canal.'); } catch { setNotice(url); }
  };

  return {
    draft, set, emailsText, setEmailsText, clienteId, setClienteId, published,
    dirty: portalDirty(current, published), busy, errors, notice, publish, unpublish, copyLink,
    whatsapp: config.whatsapp || '',
    saveWhatsapp: async (raw: string) => {
      const whatsapp = whatsappDigits(raw);
      if (raw.trim() && whatsapp.length < 10) { setErrors(['El WhatsApp tiene que tener código de área (ej. 11 2345 6789).']); return; }
      setErrors([]);
      await savePafConfig({ whatsapp });
      if (published) await publishPortalExtras(published.clienteId, { contacto: { whatsapp } });
      setNotice(whatsapp ? 'WhatsApp guardado: aparece en el portal de cada estudio cuando se publica.' : 'WhatsApp quitado.');
    },
  };
}

// ---------- Tareas y entregas ----------

function usePafWork(project: Project, meetings: AgendaMeeting[], onUpdateProject: Props['onUpdateProject']) {
  const tasks = project.pafTareas || [];
  const deliveries = project.pafEntregas || [];
  const [error, setError] = useState('');

  const save = (updates: Pick<Project, 'pafTareas'> | Pick<Project, 'pafEntregas'>) => {
    setError('');
    onUpdateProject(project.id, updates);
    republishIfPublished({ ...project, ...updates }, meetings).catch(() => setError('Se guardó en la ficha, pero no se pudo actualizar el portal. Reintentá.'));
  };
  const saveTasks = (pafTareas: PafTask[]) => save({ pafTareas });
  const saveDeliveries = (pafEntregas: PafDelivery[]) => save({ pafEntregas });
  const update = (id: string, fn: (t: PafTask) => PafTask) => saveTasks(tasks.map((t) => (t.id === id ? fn(t) : t)));

  return {
    tasks, deliveries, error, saveDeliveries,
    channel: suggestedChannel(tasks),
    enable: (id: string) => update(id, (t) => ({ ...t, estado: 'habilitada', habilitadaEn: new Date().toISOString(), motivo: undefined })),
    hide: (id: string) => update(id, (t) => ({ ...t, estado: 'borrador' })),
    approve: (id: string, canal: string) => update(id, (t) => approveTask(t, canal)),
    reopen: (id: string, motivo: string) => update(id, (t) => reopenTask(t, motivo)),
    remove: (id: string) => saveTasks(tasks.filter((t) => t.id !== id)),
    add: (t: Omit<PafTask, 'id' | 'estado'>, visible = false) => saveTasks([...tasks, { ...t, id: newItemId(), estado: visible ? 'habilitada' : 'borrador', ...(visible ? { habilitadaEn: new Date().toISOString() } : {}) }]),
    /** Varias de una (plantilla de la etapa): ocultas o ya habilitadas */
    addMany: (list: Omit<PafTask, 'id' | 'estado'>[], enable: boolean) => {
      const now = new Date().toISOString();
      saveTasks([...tasks, ...list.map((t) => ({ ...t, id: newItemId(), estado: (enable ? 'habilitada' : 'borrador') as PafTaskState, ...(enable ? { habilitadaEn: now } : {}) }))]);
    },
  };
}
type Work = ReturnType<typeof usePafWork>;

function TaskList({ tasks, work }: { tasks: PafTask[]; work: Work }) {
  return <ul className="space-y-1.5">{tasks.map((t) => <TaskItem key={t.id} t={t} work={work} />)}</ul>;
}

function TaskItem({ t, work }: { t: PafTask; work: Work }) {
  const [canal, setCanal] = useState(work.channel);
  const [reopening, setReopening] = useState(false);
  const [motivo, setMotivo] = useState('');
  const canApprove = t.estado === 'habilitada' || t.estado === 'enviada';
  const canReopen = t.estado === 'enviada' || t.estado === 'aprobada';

  return (
    <li className="rounded-lg border border-zinc-800 p-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <span className="flex-1 min-w-0 text-xs text-zinc-100">
          <span className="font-semibold">{t.titulo}</span>{t.fecha && <span className="text-zinc-500"> · {t.fecha}</span>}
          {t.detalle && <span className="block text-[11px] text-zinc-400">{t.detalle}</span>}
          {t.link && <a href={t.link} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-sky-300 truncate">{t.link}</a>}
          {t.pideArchivos && <span className="block text-[10px] text-zinc-500">Pide archivos · link a Materiales</span>}
          {t.motivo && t.estado === 'habilitada' && <span className="block text-[10px] text-sky-300">Reabierta: {t.motivo}</span>}
          {t.aprobacion && <span className="block text-[10px] text-emerald-400">Aprobada el {t.aprobacion.fecha.slice(0, 10)} por {t.aprobacion.canal}</span>}
          {t.estado === 'enviada' && t.avisoEn && <span className="block text-[10px] text-amber-300">Avisó que terminó el {t.avisoEn.slice(0, 10)}</span>}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATE_STYLE[t.estado]}`}>{PAF_TASK_STATE_LABEL[t.estado]}</span>
      </div>

      {reopening ? (
        <div className="space-y-1.5">
          <input autoFocus className={input} maxLength={140} value={motivo} placeholder="Motivo corto (lo ve el estudio). Ej: faltan las fotos de la obra Belgrano" onChange={(e) => setMotivo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && motivo.trim() && (work.reopen(t.id, motivo), setReopening(false))} />
          <div className="flex gap-2">
            <button type="button" disabled={!motivo.trim()} onClick={() => { work.reopen(t.id, motivo); setReopening(false); setMotivo(''); }} className="rounded-lg bg-sky-500/15 text-sky-300 px-2 py-1 text-[11px] font-bold disabled:opacity-50">Volver a habilitar</button>
            <button type="button" onClick={() => setReopening(false)} className="text-[11px] text-zinc-400">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
          {t.estado === 'borrador' && <button type="button" onClick={() => work.enable(t.id)} className="rounded-lg bg-sky-500/15 text-sky-300 px-2 py-1">Habilitar</button>}
          {t.estado === 'habilitada' && <button type="button" onClick={() => work.hide(t.id)} className="rounded-lg bg-zinc-800 text-zinc-300 px-2 py-1">Ocultar</button>}
          {canApprove && (
            <span className="inline-flex items-center rounded-lg overflow-hidden border border-emerald-500/30">
              <button type="button" onClick={() => { hapticFeedback.success(); work.approve(t.id, canal); }} className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-300 px-2 py-1"><Check className="w-3 h-3" />Aprobar</button>
              <select aria-label="Canal de la aprobación" value={canal} onChange={(e) => setCanal(e.target.value)} className="bg-transparent text-emerald-300 text-[11px] px-1 py-1 border-l border-emerald-500/30">
                {APPROVAL_CHANNELS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </span>
          )}
          {canReopen && <button type="button" onClick={() => setReopening(true)} className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 text-zinc-300 px-2 py-1"><Undo2 className="w-3 h-3" />Volver a habilitar</button>}
          <button type="button" aria-label={`Borrar ${t.titulo}`} onClick={() => window.confirm(`¿Borrar la tarea "${t.titulo}"?`) && work.remove(t.id)} className="ml-auto text-zinc-500 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </li>
  );
}

function AddTask({ work, onDone }: { work: Work; onDone?: () => void }) {
  const [f, setF] = useState({ titulo: '', link: '', detalle: '', fecha: '' });
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const add = () => {
    if (!f.titulo.trim()) return;
    const link = f.link.trim() ? safeHttpsUrl(f.link) : null;
    if (f.link.trim() && !link) { setError('El link tiene que empezar con https://'); return; }
    setError('');
    hapticFeedback.light();
    work.add({ titulo: f.titulo.trim(), ...(link ? { link } : {}), ...(f.detalle.trim() ? { detalle: f.detalle.trim() } : {}), ...(f.fecha ? { fecha: f.fecha } : {}) }, visible);
    setF({ titulo: '', link: '', detalle: '', fecha: '' });
    onDone?.();
  };
  return (
    <div className="space-y-1.5 pt-2 border-t border-zinc-800">
      <input className={input} value={f.titulo} placeholder="Nueva tarea para el estudio" onChange={(e) => setF({ ...f, titulo: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} />
      <input className={input} value={f.link} placeholder="Link (opcional, https://)" onChange={(e) => setF({ ...f, link: e.target.value })} />
      <div className="flex gap-1.5">
        <input className={input} value={f.detalle} placeholder="Nota (opcional)" onChange={(e) => setF({ ...f, detalle: e.target.value })} />
        <input className={`${input} w-36`} type="date" aria-label="Fecha (opcional)" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
      </div>
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
      <button type="button" onClick={add} className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 text-[11px] font-bold">{visible ? 'Agregar y publicar' : 'Agregar (oculta)'}</button>
      <label className="ml-2 inline-flex items-center gap-1.5 text-[11px] text-zinc-400"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />Que el cliente la vea ya</label>
      {work.error && <p role="alert" className="text-[11px] text-rose-300">{work.error}</p>}
    </div>
  );
}

function Deliveries({ work, showForm = true, onDone }: { work: Work; showForm?: boolean; onDone?: () => void }) {
  const [f, setF] = useState({ titulo: '', enlace: '', fecha: '' });
  const [error, setError] = useState('');
  const add = () => {
    if (!f.titulo.trim()) return;
    const enlace = f.enlace.trim() ? safeHttpsUrl(f.enlace) : null;
    if (f.enlace.trim() && !enlace) { setError('El enlace tiene que empezar con https://'); return; }
    setError('');
    work.saveDeliveries([...work.deliveries, { id: newItemId(), titulo: f.titulo.trim(), publicada: false, ...(enlace ? { enlace } : {}), ...(f.fecha ? { fecha: f.fecha } : {}) }]);
    setF({ titulo: '', enlace: '', fecha: '' });
    onDone?.();
  };
  return (
    <Block title="Entregas" hint="Nacen ocultas: marcá «La ve el estudio» cuando la quieras mostrar.">
      {work.deliveries.length > 0 && (
        <ul className="space-y-1.5">
          {work.deliveries.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 p-2 text-xs">
              <Package className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="flex-1 min-w-0 truncate">{d.enlace ? <a href={d.enlace} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">{d.titulo}<ExternalLink className="w-3 h-3" /></a> : d.titulo}{d.fecha && <span className="text-zinc-500"> · {d.fecha}</span>}</span>
              <label className="flex items-center gap-1 text-[10px] text-zinc-400"><input type="checkbox" checked={d.publicada} onChange={(e) => work.saveDeliveries(work.deliveries.map((x) => (x.id === d.id ? { ...x, publicada: e.target.checked } : x)))} />La ve el estudio</label>
              <button type="button" aria-label={`Borrar ${d.titulo}`} onClick={() => window.confirm(`¿Borrar la entrega "${d.titulo}"?`) && work.saveDeliveries(work.deliveries.filter((x) => x.id !== d.id))} className="text-zinc-500 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      {showForm && <div className="space-y-1.5">
        <input className={input} value={f.titulo} placeholder="Nueva entrega (ej. Guía de mensaje)" onChange={(e) => setF({ ...f, titulo: e.target.value })} />
        <div className="flex gap-1.5">
          <input className={input} value={f.enlace} placeholder="Enlace de Drive (https://)" onChange={(e) => setF({ ...f, enlace: e.target.value })} />
          <input className={`${input} w-36`} type="date" aria-label="Fecha de la entrega" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </div>
        <button type="button" onClick={add} className="btn-solid-primary px-3 py-1.5 text-xs">Agregar entrega</button>
      </div>}
      {(error || work.error) && <p role="alert" className="text-[11px] text-rose-300">{error || work.error}</p>}
    </Block>
  );
}

function WhatsappField({ value, onSave }: { value: string; onSave: (raw: string) => Promise<void> }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="flex gap-1.5">
      <input className={input} inputMode="tel" value={v} placeholder="11 2345 6789" onChange={(e) => setV(e.target.value)} />
      <button type="button" onClick={() => onSave(v).catch(() => undefined)} disabled={v === value} className="shrink-0 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 text-[11px] font-bold disabled:opacity-50">Guardar</button>
    </div>
  );
}
/**
 * Plantilla de la etapa: tareas sugeridas que todavía no están (por título).
 * En Hoy aparece al cambiar de etapa; "Ahora no" la oculta para esa etapa en este dispositivo.
 */
function StageTemplate({ project, hito, work, onMeeting, always }: { project: Project; hito: number; work: Work; onMeeting: (title: string) => void; always?: boolean }) {
  const key = `paf_plantilla_${project.id}_${hito}`;
  const missing = missingTemplateTasks(hito, work.tasks);
  const reunion = PAF_STAGE_TEMPLATES[hito]?.reunion;
  const [picked, setPicked] = useState<Set<string>>(() => new Set(missing.map((t) => t.titulo)));
  const [hidden, setHidden] = useState(() => { try { return !always && !!localStorage.getItem(key); } catch { return false; } });
  const [open, setOpen] = useState(!always);
  useEffect(() => {
    setPicked(new Set(missingTemplateTasks(hito, work.tasks).map((t) => t.titulo)));
    try { setHidden(!always && !!localStorage.getItem(key)); } catch { /* sin almacenamiento */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hito]);

  if (hidden || (!missing.length && !reunion)) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem(key, '1'); } catch { /* sin almacenamiento */ } };
  const add = (enable: boolean) => {
    const list = missing.filter((t) => picked.has(t.titulo));
    if (!list.length) return;
    hapticFeedback.light();
    work.addMany(list, enable);
  };

  if (always && !open) {
    return missing.length ? <button type="button" onClick={() => setOpen(true)} className="text-[11px] font-bold text-sky-300">+ Tareas sugeridas para la etapa {hito} ({missing.length})</button> : null;
  }

  return (
    <section className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 space-y-2">
      <div>
        <h3 className="text-xs font-bold text-zinc-100">Etapa {hito} · {PRESENCIA_HITOS[hito - 1]}: sugerencias</h3>
        <p className="text-[11px] text-zinc-500">Elegí cuáles sumar. Las podés editar o borrar después.</p>
      </div>
      {missing.length > 0 && (
        <ul className="space-y-1">
          {missing.map((t) => (
            <li key={t.titulo}>
              <label className="flex items-start gap-2 text-xs text-zinc-200">
                <input type="checkbox" className="mt-0.5" checked={picked.has(t.titulo)} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(t.titulo); else n.delete(t.titulo); return n; })} />
                <span>{t.titulo}{t.pideArchivos && <span className="text-zinc-500"> · pide archivos</span>}{t.detalle && <span className="block text-[11px] text-zinc-500">{t.detalle}</span>}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
        {missing.length > 0 && <button type="button" onClick={() => add(true)} className="rounded-lg bg-sky-500/15 text-sky-300 px-2 py-1">Agregar y habilitar</button>}
        {missing.length > 0 && <button type="button" onClick={() => add(false)} className="rounded-lg bg-zinc-800 text-zinc-300 px-2 py-1">Agregar ocultas</button>}
        {reunion && <button type="button" onClick={() => onMeeting(reunion)} className="rounded-lg bg-emerald-500/15 text-emerald-300 px-2 py-1">Agendar {reunion.toLowerCase()}</button>}
        <button type="button" onClick={always ? () => setOpen(false) : dismiss} className="ml-auto text-zinc-500 font-normal">{always ? 'Cerrar' : 'Ahora no'}</button>
      </div>
    </section>
  );
}
/** Editor de accesos directos: nombre y link, ordenar, sumar y borrar */
function AccessEditor({ items, onChange, startAdding }: { items: { id: string; nombre: string; url: string }[]; onChange: (items: { id: string; nombre: string; url: string }[]) => void; startAdding?: boolean }) {
  // Al tocar "+ Acceso" arriba aparece una fila vacía para completar
  useEffect(() => { if (startAdding && !items.some((a) => !a.nombre && !a.url)) onChange([...items, { id: newItemId(), nombre: '', url: '' }]); }, [startAdding]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (id: string, patch: Partial<{ nombre: string; url: string }>) => onChange(items.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-1.5">
      {items.map((a, i) => (
        <div key={a.id} className="flex items-center gap-1.5">
          <input className={`${input} basis-2/5`} value={a.nombre} placeholder="Nombre" aria-label="Nombre del acceso" onChange={(e) => set(a.id, { nombre: e.target.value })} />
          <input className={input} value={a.url} placeholder="https://" aria-label={`Link de ${a.nombre || 'acceso'}`} onChange={(e) => set(a.id, { url: e.target.value })} />
          <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="text-zinc-500 hover:text-zinc-200 disabled:opacity-30">↑</button>
          <button type="button" aria-label="Bajar" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="text-zinc-500 hover:text-zinc-200 disabled:opacity-30">↓</button>
          <button type="button" aria-label={`Borrar ${a.nombre || 'acceso'}`} onClick={() => onChange(items.filter((x) => x.id !== a.id))} className="text-zinc-500 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { id: newItemId(), nombre: '', url: '' }])} className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 text-[11px] font-bold">+ Agregar acceso</button>
    </div>
  );
}
