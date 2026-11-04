import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Route, CalendarDays, FileText, Star, CalendarPlus, Check, CircleAlert, Copy, ExternalLink, Eye, FolderOpen, Home, ImagePlus, Link2, ListChecks, Loader2, Megaphone, MessageCircle, NotebookPen, Package, Palette, Radio, Settings2, Smartphone, Target, Trash2, Undo2 } from 'lucide-react';
import { shrinkLogo } from '../utils/logoImage';
import { AgendaMeeting, Project } from '../types';
import { newItemId } from '../panels/model';
import {
  APPROVAL_CHANNELS, CLIENTE_ID_RE, PAF_PORTAL_LINK_KEYS, PAF_PORTAL_LINK_LABEL, PAF_TASK_STATE_LABEL, PRESENCIA_HITOS,
  accessHost, accessIssue, accesosDelAlta, approveTask, hitosDe, PAF_DELIVERY_STATE_LABEL, PAF_RESPONSABLE_LABEL, defaultAccessName, normalizeLinkInput, draftAccesos, emptyPortalDraft, nextMeeting, normalizeEmails, portalDirty, portalFromProject, portalGoals, reopenTask, safeHttpsUrl, whatsappDigits,
  missingTemplateTasks, PAF_STAGE_TEMPLATES, suggestedChannel, type PafDelivery, type PafDeliveryState, type PafPedidoAlta, type PafResponsable, type PafPortalDoc, type PafPortalDraft, type PafTask, type PafTaskState,
} from '../portal/model';
import { publishPafPortal, publishPortalExtras, republishIfPublished, savePafConfig, subscribePafConfig, subscribePafPortal, subscribePedidoDeProyecto, suggestNextWebClienteId, unpublishPafPortal } from '../portal/store';
import { AccessIcon } from './AccessIcon';
import { MENSAJES, hoyAcordamos, mensaje, recordatorioPendientes, type MensajeId } from '../portal/mensajes';
import { subscribePanelOfProject } from '../panels/store';
import type { ClientPanel } from '../panels/model';
import { SegmentedControl } from '../ui';
import { hapticFeedback } from '../utils/haptics';
import { PafAltaCard } from './PafAltaCard';
import { PafMeetingsSection } from './PafMeetingsSection';
import { PafWeekGoals } from './PafWeekGoals';
import { PafAnnouncements } from './PafAnnouncements';
import { PafHitosCard, confirmarHito } from './PafHitosCard';
import { PafPlanSection } from './PafPlanSection';
import { conHistorial } from '../portal/historial';
import { ETAPAS, temaPorId, type TemaPlantilla } from '../portal/presencia';
import { PafReportes } from './PafReportes';
import { NumerosEditor, PortalLinksEditor, PortalSectionsToggles } from './PafPortalSettings';

// El portal tal cual lo ve el cliente (se carga solo al abrir la vista previa)
const PortalPreviewScreen = lazy(() => import('../views/PafPortalView').then((m) => ({ default: m.PortalPreviewScreen })));

const input = 'w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';
const STATE_STYLE: Record<PafTaskState, string> = {
  borrador: 'bg-zinc-800 text-zinc-400',
  habilitada: 'bg-sky-500/15 text-sky-300',
  enviada: 'bg-amber-400/15 text-amber-300',
  aprobada: 'bg-emerald-500/15 text-emerald-300',
};

type Props = {
  project: Project;
  meetings: AgendaMeeting[];
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onAddMeeting: (meeting: Omit<AgendaMeeting, 'id' | 'createdAt'>) => void;
  onUpdateMeeting?: (id: string, updates: Partial<AgendaMeeting>) => void;
  onToggleMeeting?: (id: string) => void;
  onDeleteMeeting?: (id: string) => void;
  /** Alta con Tally (solo PAF) */
  showAlta?: boolean;
};

type Section = 'plan' | 'inicio' | 'tareas' | 'reuniones' | 'entregas' | 'archivos' | 'ajustes';
type Adding = null | 'anuncio' | 'tarea' | 'acceso' | 'entrega' | 'reunion' | 'acuerdo' | 'semana' | 'reporte';

/** Acciones rápidas: cada una abre su sección con el formulario listo */
const QUICK: { id: Exclude<Adding, null>; label: string; hint: string; icon: React.ElementType; section: Section }[] = [
  { id: 'anuncio', label: 'Anuncio', hint: 'Lo primero que lee', icon: Megaphone, section: 'inicio' },
  { id: 'tarea', label: 'Tarea', hint: 'Algo que tiene que hacer', icon: ListChecks, section: 'tareas' },
  { id: 'reunion', label: 'Reunión', hint: 'Va a tu Calendar', icon: CalendarPlus, section: 'reuniones' },
  { id: 'acuerdo', label: 'Acuerdos', hint: 'Lo que hablamos', icon: NotebookPen, section: 'reuniones' },
  { id: 'entrega', label: 'Entrega', hint: 'Algo que le mandás', icon: Package, section: 'entregas' },
  { id: 'acceso', label: 'Acceso', hint: 'Drive, Asana, web…', icon: Link2, section: 'archivos' },
  { id: 'semana', label: 'Foco semanal', hint: 'Foco y objetivos', icon: Target, section: 'inicio' },
  { id: 'reporte', label: 'Reporte', hint: 'El del viernes', icon: FileText, section: 'inicio' },
];

const SECTION_INFO: Record<Section, { label: string; icon: React.ElementType; hint: string }> = {
  plan: { label: 'Plan', icon: Route, hint: 'El recorrido de Presencia: temas por hito, checklist y lo que sigue.' },
  inicio: { label: 'Inicio', icon: Home, hint: 'Avance, foco de la semana y anuncios: lo primero que ve.' },
  tareas: { label: 'Tareas', icon: ListChecks, hint: 'Lo que necesitás de tu cliente. Las ocultas no las ve hasta que las habilitás.' },
  reuniones: { label: 'Reuniones', icon: CalendarDays, hint: 'Agendar, mover y anotar acuerdos. Todo pasa a tu Google Calendar.' },
  entregas: { label: 'Entregas', icon: Package, hint: 'Lo que le mandás. Nacen ocultas: las mostrás cuando quieras.' },
  archivos: { label: 'Archivos', icon: FolderOpen, hint: 'Accesos directos con ícono: Drive, calendario de contenido, su web…' },
  ajustes: { label: 'Ajustes', icon: Settings2, hint: 'Qué ve tu cliente, marca, quién entra, tu WhatsApp y el alta.' },
};

/**
 * "LO QUE VE EL CLIENTE", ordenado en secciones: arriba el estado del portal y las acciones
 * rápidas; abajo una sección por vez (Inicio, Tareas, Reuniones, Entregas, Archivos, Ajustes).
 * Todo se guarda solo y, si el portal está publicado, le llega al cliente en segundos.
 */
export const PafAdminPanel: React.FC<Props> = ({ project, meetings, onUpdateProject, onAddMeeting, onUpdateMeeting, onToggleMeeting, onDeleteMeeting, showAlta = true }) => {
  const [section, setSectionState] = useState<Section>(() => {
    try {
      const s = (localStorage.getItem('paf_panel_seccion') as Section) || (showAlta ? 'plan' : 'inicio');
      return s === 'plan' && !showAlta ? 'inicio' : s;
    } catch { return showAlta ? 'plan' : 'inicio'; }
  });
  const setSection = (s: Section) => { setSectionState(s); try { localStorage.setItem('paf_panel_seccion', s); } catch { /* sin almacenamiento */ } };
  const [adding, setAdding] = useState<Adding>(null);
  const [showPreview, setShowPreview] = useState(false);
  // Reunión que propone un tema del plan (título, objetivo y duración ya cargados)
  const [sugerida, setSugerida] = useState<TemaPlantilla | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const portal = usePortalDraft(project, meetings, onUpdateProject, !showAlta);
  const work = usePafWork(project, meetings, onUpdateProject);
  const toReview = work.tasks.filter((t) => t.estado === 'enviada');
  const accesos = draftAccesos(portal.draft);
  const today = new Date().toLocaleDateString('en-CA');
  const upcoming = meetings.filter((m) => m.projectId === project.id && !m.completed && m.date >= today).length;
  const hasWeek = !!portal.draft.resumen.trim();
  const done = () => setAdding(null);

  const quick = (q: (typeof QUICK)[number]) => {
    hapticFeedback.light();
    setSection(q.section);
    setAdding(q.id);
    requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const counts: Partial<Record<Section, number>> = {
    inicio: toReview.length || undefined,
    tareas: work.tasks.filter((t) => t.estado === 'habilitada').length || undefined,
    reuniones: upcoming || undefined,
    entregas: work.deliveries.length || undefined,
    archivos: accesos.length || undefined,
  };
  const info = SECTION_INFO[section];
  const Icon = info.icon;

  return (
    <div className="space-y-4">
      <PanelHeader portal={portal} project={project} studio={project.clientName} phone={project.clientPhone} preview={showPreview} onTogglePreview={() => setShowPreview((v) => !v)} />
      {showPreview && portal.published && <PortalPreview portal={portal.published} />}

      {/* Acciones rápidas: lo que más hacés, a un toque */}
      <div className="grid grid-cols-4 gap-2" role="toolbar" aria-label="Agregar al portal">
        {QUICK.map((q) => {
          const QIcon = q.icon;
          const active = adding === q.id;
          return (
            <button key={q.id} type="button" onClick={() => quick(q)} aria-pressed={active}
              className={`group flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-center transition ${active ? 'border-zinc-100 bg-zinc-100 text-zinc-950' : 'border-zinc-800 bg-zinc-950/40 text-zinc-200 hover:border-zinc-600 hover:bg-white/[0.03]'}`}>
              <QIcon className={`w-4 h-4 ${active ? '' : 'text-zinc-400 group-hover:text-zinc-100'}`} />
              <span className="text-[11px] font-semibold leading-tight">{q.label}</span>
              <span className={`hidden sm:block text-[10px] leading-tight ${active ? 'text-zinc-600' : 'text-zinc-500'}`}>{q.hint}</span>
            </button>
          );
        })}
      </div>

      {/* Secciones del portal */}
      <div ref={sectionRef} className="scroll-mt-24 rounded-2xl border border-zinc-800 overflow-hidden">
        <nav className="grid grid-cols-3 sm:flex sm:overflow-x-auto no-scrollbar border-b border-zinc-800 bg-zinc-950/50" aria-label="Secciones">
          {(Object.keys(SECTION_INFO) as Section[]).filter((s) => s !== 'plan' || showAlta).map((s) => {
            const SIcon = SECTION_INFO[s].icon;
            const on = section === s;
            return (
              <button key={s} type="button" onClick={() => { setSection(s); setAdding(null); }} aria-current={on ? 'page' : undefined}
                className={`relative flex shrink-0 items-center justify-center sm:justify-start gap-1.5 px-3 py-2.5 text-xs font-semibold transition ${on ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
                <SIcon className="w-3.5 h-3.5" />{SECTION_INFO[s].label}
                {counts[s] ? <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${s === 'inicio' ? 'bg-amber-400/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'}`}>{counts[s]}</span> : null}
                {on && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-zinc-100" aria-hidden />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 sm:p-4 space-y-5">
          <p className="flex items-center gap-2 text-[11px] text-zinc-500"><Icon className="w-3.5 h-3.5 shrink-0" />{info.hint}</p>

          {section === 'plan' && (
            <PafPlanSection project={project} meetings={meetings} onUpdateProject={onUpdateProject}
              onAgendar={(t) => { setSugerida(t); setSection('reuniones'); setAdding('reunion'); requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}
              onVer={(s) => setSection(s)}
              onConfirmarHito={(n, evidencia, etapa) => {
                const titulos = hitosDe('presencia', etapa);
                const pafHitos = confirmarHito(project.pafHitos || [], n, evidencia, etapa);
                const updates = { pafHitos, ...conHistorial(project, `Hito confirmado: ${titulos[n - 1]} — ${evidencia}`) };
                onUpdateProject(project.id, updates);
                if (etapa === (project.pafEtapa || 'presencia') && portal.draft.hito <= n && n < titulos.length) portal.set({ hito: n + 1 });
                republishIfPublished({ ...project, ...updates }, meetings).catch(() => undefined);
                hapticFeedback.success();
              }}
              onActivarEtapa={(etapa) => {
                // La etapa empieza porque vos la activás: hito 1 de esa etapa
                const updates = { pafEtapa: etapa, pafEtapasInicio: { ...project.pafEtapasInicio, [etapa]: new Date().toLocaleDateString('en-CA') }, ...conHistorial(project, `Empezó la etapa ${ETAPAS.find((x) => x.id === etapa)!.label}`) };
                onUpdateProject(project.id, updates);
                portal.set({ hito: 1 });
                republishIfPublished({ ...project, ...updates, pafPortal: { ...portal.draft, hito: 1 } }, meetings).catch(() => undefined);
                hapticFeedback.success();
              }} />
          )}

          {section === 'inicio' && (
            <>
              {showAlta && <AltaStatus pedido={portal.pedido} carpeta={project.pafDrive?.carpetaCompartida} />}
              <PafHitosCard project={project} meetings={meetings} hito={portal.draft.hito} mostrarAvance={portal.draft.mostrarAvance !== false}
                onSetHito={(n) => portal.set({ hito: n })} onToggleAvance={(v) => portal.set({ mostrarAvance: v })} onUpdateProject={onUpdateProject} recorrido={showAlta ? 'presencia' : 'web'} etapa={project.pafEtapa || 'presencia'} />

              {toReview.length > 0 && (
                <Card title={`Para revisar (${toReview.length})`} hint="Avisó que las terminó. Aprobá o volvé a habilitar." tone="amber">
                  <TaskList tasks={toReview} work={work} />
                </Card>
              )}

              <Card title="Esta semana" action={adding !== 'semana' && <SmallButton onClick={() => setAdding('semana')}>{hasWeek ? 'Editar' : '+ Foco y objetivos'}</SmallButton>}>
                {adding === 'semana' ? (
                  <div className="space-y-2">
                    <textarea className={input} rows={2} value={portal.draft.resumen} placeholder="Foco de la semana (lo lee arriba de todo)" onChange={(e) => portal.set({ resumen: e.target.value })} />
                    <PafWeekGoals project={project} publishedId={portal.published?.clienteId} />
                    <SmallButton onClick={done}>Listo</SmallButton>
                  </div>
                ) : hasWeek ? <p className="text-xs text-zinc-300 whitespace-pre-line line-clamp-3">{portal.draft.resumen}</p> : <Empty>Sin foco cargado: no se muestra.</Empty>}
              </Card>

              <Card title="Anuncios" hint="Fijá arriba lo importante." action={adding !== 'anuncio' && <SmallButton onClick={() => setAdding('anuncio')}>+ Anuncio</SmallButton>}>
                {(project.pafAnuncios || []).length > 0 || adding === 'anuncio'
                  ? <PafAnnouncements project={project} meetings={meetings} onUpdateProject={onUpdateProject} showForm={adding === 'anuncio'} onDone={done} bare />
                  : <Empty>Sin anuncios.</Empty>}
              </Card>

              <Card title="Tus números" hint="Solo los reales, con fuente y período. El cliente los ve si prendés “Tus números” en Ajustes.">
                <NumerosEditor draft={portal.draft} onChange={portal.set} />
              </Card>

              <Card title="Reporte del viernes" hint="Se arma con lo que cargaste en la semana. Los números los ponés vos." action={adding !== 'reporte' && <SmallButton onClick={() => setAdding('reporte')}>Armar reporte</SmallButton>}>
                <PafReportes project={project} meetings={meetings} onUpdateProject={onUpdateProject} open={adding === 'reporte'} onOpen={(o) => setAdding(o ? 'reporte' : null)} />
              </Card>
            </>
          )}

          {section === 'tareas' && (
            <>
              <Card title="Lo que necesitamos de vos" action={adding !== 'tarea' && <SmallButton onClick={() => setAdding('tarea')}>+ Tarea</SmallButton>}>
                {adding === 'tarea' && <AddTask work={work} onDone={done} />}
                {toReview.length > 0 && <TaskList tasks={toReview} work={work} />}
                {work.tasks.some((t) => t.estado !== 'enviada') ? <TaskList tasks={work.tasks.filter((t) => t.estado !== 'enviada')} work={work} /> : adding !== 'tarea' && <Empty>Sin tareas todavía.</Empty>}
              </Card>
              {showAlta && <p className="text-[11px] text-zinc-500">Las tareas de cada tema del método se cargan desde <button type="button" onClick={() => setSection('plan')} className="font-bold text-zinc-300 hover:text-zinc-100">Plan → Empezar tema</button>.</p>}
            </>
          )}

          {section === 'reuniones' && (
            <PafMeetingsSection project={project} meetings={meetings} onAddMeeting={onAddMeeting} onUpdateMeeting={onUpdateMeeting} onToggleMeeting={onToggleMeeting} onDeleteMeeting={onDeleteMeeting} onUpdateProject={onUpdateProject}
              linkReunion={portal.draft.linkReunion || ''} onLinkReunion={(v) => portal.set({ linkReunion: v })}
              reunionesAcordadas={portal.draft.reunionesAcordadas} onReunionesAcordadas={(n) => portal.set({ reunionesAcordadas: n })}
              scheduling={adding === 'reunion'} onScheduling={(o) => { setAdding(o ? 'reunion' : null); if (!o) setSugerida(null); }} sugerida={sugerida}
              writingSummary={adding === 'acuerdo'} onWritingSummary={(o) => setAdding(o ? 'acuerdo' : null)} />
          )}

          {section === 'entregas' && (
            <Card title="Entregas" action={adding !== 'entrega' && <SmallButton onClick={() => setAdding('entrega')}>+ Entrega</SmallButton>}>
              {work.deliveries.length || adding === 'entrega' ? <Deliveries work={work} showForm={adding === 'entrega'} onDone={done} /> : <Empty>Sin entregas todavía.</Empty>}
            </Card>
          )}

          {section === 'archivos' && (
            <Card title="Accesos" hint="Pegá el link: el https, el nombre y el ícono se completan solos. La carpeta interna y la ficha nunca se publican.">
              <AccessEditor items={accesos} privados={portal.privados} startAdding={adding === 'acceso'} onChange={(list) => { portal.set({ accesos: list }); }} />
            </Card>
          )}
          {section === 'archivos' && (
            <Card title="Bienvenida, contenido y materiales" hint="Botones directos: el cliente no tiene que buscar en Drive.">
              <PortalLinksEditor draft={portal.draft} onChange={portal.set} />
            </Card>
          )}

          {section === 'ajustes' && (
            <>
              <Card title="Qué ve tu cliente" hint="Prendé solo lo que quieras mostrar. Lo apagado no se manda a su portal.">
                <PortalSectionsToggles draft={portal.draft} onChange={portal.set} />
              </Card>
              <BrandBlock portal={portal} studio={project.clientName} />
              <Card title="Quién puede entrar" hint="Solo estos correos, con su cuenta de Google. El del alta se agrega solo.">
                <label className="block text-[11px] text-zinc-400">ID del cliente
                  <input className={`${input} font-mono`} value={portal.clienteId} disabled={!!portal.published} placeholder={showAlta ? 'PAF-002' : 'Se asigna solo al publicar (WEB-001)'} onChange={(e) => portal.setClienteId(e.target.value.toUpperCase())} />
                </label>
                <label className="block text-[11px] text-zinc-400 mt-2">Correos autorizados
                  <input className={input} value={portal.emailsText} placeholder="estudio@gmail.com, socia@gmail.com" onChange={(e) => portal.setEmailsText(e.target.value)} />
                </label>
              </Card>
              <Card title="Tu WhatsApp" hint="Para el botón «Hablar con Juan». Es uno solo para todos los clientes.">
                <WhatsappField value={portal.whatsapp} onSave={portal.saveWhatsapp} />
              </Card>
              {showAlta && <Card title="Alta del estudio"><PafAltaCard project={project} onUpdateProject={onUpdateProject} /></Card>}
              {portal.published && (
                <div className="rounded-xl border border-rose-500/20 p-3 flex items-center gap-3">
                  <p className="flex-1 text-[11px] text-zinc-400">Despublicar: el cliente deja de ver su portal.</p>
                  <button type="button" onClick={portal.unpublish} disabled={portal.busy} className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/10">Despublicar</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <SaveBar portal={portal} />
    </div>
  );
};

/** Bloque de una sección: título, ayuda corta y la acción a la derecha */
function Card({ title, hint, action, tone, children }: { title: string; hint?: string; action?: React.ReactNode; tone?: 'amber'; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border p-3 space-y-2.5 ${tone === 'amber' ? 'border-amber-400/30 bg-amber-400/[0.04]' : 'border-zinc-800 bg-zinc-950/30'}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold text-zinc-100">{title}</h3>
          {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="shrink-0 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-200">{children}</button>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-zinc-500">{children}</p>;
}

// ---------- Guardar y publicar ----------

/** Barra fija abajo: si el cliente ya ve lo último, o qué falta. El botón publica en el momento. */
function SaveBar({ portal }: { portal: ReturnType<typeof usePortalDraft> }) {
  const { published, pending, dirty, busy, errors, savedAt } = portal;
  if (published === undefined) return null;
  const hora = (d: Date) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const last = savedAt || (published ? new Date(published.actualizadoEn) : null);
  const state = errors.length ? { icon: <CircleAlert className="w-4 h-4 text-rose-300" />, text: 'No se publicó: revisá lo que dice arriba' }
    : busy || pending ? { icon: <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />, text: 'Guardando…' }
    : !published ? { icon: <Radio className="w-4 h-4 text-amber-300" />, text: 'Tu cliente todavía no ve nada' }
    : dirty ? { icon: <CircleAlert className="w-4 h-4 text-amber-300" />, text: 'Hay cambios que tu cliente no ve' }
    : { icon: <Check className="w-4 h-4 text-emerald-400" />, text: `Guardado · tu cliente lo ve desde las ${last ? hora(last) : ''}` };
  return (
    <div className="sticky bottom-24 z-10 flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/95 px-3 py-2.5 shadow-lg shadow-black/40 backdrop-blur" role="status">
      {state.icon}
      <span className="flex-1 min-w-0 text-xs text-zinc-200">{state.text}</span>
      <button type="button" onClick={portal.publish} disabled={busy} className="btn-solid-primary shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{published ? 'Guardar y publicar' : 'Publicar portal'}
      </button>
    </div>
  );
}

// ---------- Marca del cliente ----------

function BrandBlock({ portal, studio }: { portal: ReturnType<typeof usePortalDraft>; studio: string }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { logo, marca } = portal.draft;
  const upload = async (file?: File) => {
    if (!file) return;
    setError(''); setLoading(true);
    try {
      const r = await shrinkLogo(file);
      portal.set({ logo: r.dataUrl, ...(r.color && !marca ? { marca: r.color } : {}) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 p-3">
      <button type="button" onClick={() => fileRef.current?.click()} className="relative flex w-14 h-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-zinc-700 bg-white/[0.03] hover:border-zinc-500" aria-label="Subir logo">
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : logo ? <img src={logo} alt={`Logo de ${studio}`} className="max-w-full max-h-full object-contain p-1.5" /> : <ImagePlus className="w-5 h-5 text-zinc-500" />}
      </button>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-100">Marca del cliente</p>
        <p className="text-[11px] text-zinc-500">{logo ? 'Aparece arriba en su portal y en la pestaña.' : 'Subí su logo: se achica solo y le da su identidad al portal.'}</p>
        {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
          <button type="button" onClick={() => fileRef.current?.click()} className="font-bold text-zinc-300 hover:text-zinc-100">{logo ? 'Cambiar logo' : 'Subir logo'}</button>
          {logo && <button type="button" onClick={() => portal.set({ logo: undefined })} className="text-zinc-500 hover:text-rose-300">Quitar</button>}
          <label className="ml-auto inline-flex items-center gap-1.5 text-zinc-400">
            Color
            <input type="color" value={marca || '#a1a1aa'} onChange={(e) => portal.set({ marca: e.target.value })} className="w-6 h-6 cursor-pointer rounded border border-zinc-700 bg-transparent p-0" aria-label="Color de su marca" />
          </label>
          {marca && <button type="button" onClick={() => portal.set({ marca: undefined })} className="text-zinc-500 hover:text-zinc-300">Sin color</button>}
        </div>
      </div>
    </div>
  );
}

/**
 * El portal tal como lo ve el cliente, en vivo, dentro de la ficha. Se dibuja acá mismo con lo
 * publicado (sin marco aparte: así no pide login). El transform hace que el botón fijo de
 * WhatsApp quede dentro del celular y no flotando sobre el CRM.
 */
function PortalPreview({ portal }: { portal: PafPortalDoc }) {
  return (
    <figure className="mx-auto w-full max-w-[400px]">
      <div className="h-[640px] overflow-y-auto overscroll-contain rounded-[28px] border-[6px] border-zinc-800 bg-[var(--bg-app)] shadow-2xl [transform:translateZ(0)]">
        <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-zinc-500" /></div>}>
          <PortalPreviewScreen portal={portal} />
        </Suspense>
      </div>
      <figcaption className="mt-2 text-center text-[11px] text-zinc-500">Así lo ve ahora. Se actualiza solo; los botones no hacen nada acá.</figcaption>
    </figure>
  );
}

// ---------- Encabezado ----------

function PanelHeader({ portal, project, studio, phone, preview, onTogglePreview }: { portal: ReturnType<typeof usePortalDraft>; project: Project; studio: string; phone?: string; preview: boolean; onTogglePreview: () => void }) {
  const { published } = portal;
  const viewUrl = published ? `/portal?ver=${encodeURIComponent(published.clienteId)}` : '';
  const updated = published ? new Date(published.actualizadoEn) : null;
  const when = updated ? (Date.now() - updated.getTime() < 60000 ? 'recién' : updated.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) : '';

  if (published === undefined) return <div className="h-16 rounded-xl border border-zinc-800 animate-pulse" aria-hidden />;

  return (
    <div className={`rounded-xl border p-3 space-y-3 ${published ? 'border-emerald-500/25 bg-emerald-500/[0.04]' : 'border-amber-400/40 bg-amber-400/[0.06]'}`}>
      {published ? (
        <div className="flex items-start gap-2.5">
          <span className="relative mt-1 flex w-2 h-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-zinc-100">En vivo: lo que cargues acá le llega solo</p>
            <p className="text-[11px] text-zinc-400">Última actualización {when} · {published.emailsAutorizados.length} {published.emailsAutorizados.length === 1 ? 'correo puede' : 'correos pueden'} entrar</p>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">{published.clienteId}</span>
        </div>
      ) : (
        <div className="flex items-start gap-2.5">
          <Radio className="mt-0.5 w-4 h-4 shrink-0 text-amber-300" aria-hidden />
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="text-xs font-semibold text-zinc-100">{studio} todavía no ve nada de esto</p>
              <p className="text-[11px] text-zinc-400">Publicá el portal una vez. Desde ahí, cada anuncio, tarea, acceso, entrega o reunión que cargues le aparece solo.</p>
            </div>
            <label className="block text-[11px] text-zinc-400">Correos que pueden entrar (cuenta de Google)
              <input className={input} value={portal.emailsText} placeholder="estudio@gmail.com, socia@gmail.com" onChange={(e) => portal.setEmailsText(e.target.value)} />
            </label>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!published && (
          <button type="button" onClick={portal.publish} disabled={portal.busy} className="btn-solid-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
            {portal.busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Publicar portal ahora
          </button>
        )}
        {published && (
          <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 text-xs font-bold" title={`Así ve ${studio} su portal (solo lectura)`}>
            <Eye className="w-3.5 h-3.5" /> Ver como cliente
          </a>
        )}
        {published && (
          <button type="button" onClick={onTogglePreview} aria-pressed={preview} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${preview ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'}`}>
            <Smartphone className="w-3.5 h-3.5" /> {preview ? 'Cerrar vista previa' : 'Vista previa'}
          </button>
        )}
        {published && phone && whatsappDigits(phone).length >= 10 && <AvisarleMenu project={project} published={published} phone={whatsappDigits(phone)} />}
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

function usePortalDraft(project: Project, meetings: AgendaMeeting[], onUpdateProject: Props['onUpdateProject'], webId = false) {
  const [clienteId, setClienteId] = useState(project.pafClienteId || '');
  const [draft, setDraft] = useState<PafPortalDraft>(() => project.pafPortal || emptyPortalDraft(project.clientEmail));
  const [emailsText, setEmailsText] = useState((project.pafPortal?.emails || draft.emails).join(', '));
  const [published, setPublished] = useState<PafPortalDoc | null | undefined>(undefined);
  const [pedido, setPedido] = useState<PafPedidoAlta | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  // Cambios esperando el guardado automático, y la última vez que el cliente recibió algo
  const [pending, setPending] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

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

  // Cuando el script devuelve las carpetas del alta: quedan guardadas en la ficha y se suman
  // solas a los accesos del portal. Pasa una sola vez (si después sacás un acceso, no vuelve)
  const alta = pedido?.alta;
  useEffect(() => {
    if (!alta?.carpetaCompartida || project.pafDrive?.carpetaCompartida) return;
    onUpdateProject(project.id, { pafDrive: { ...project.pafDrive, carpetaCompartida: alta.carpetaCompartida, ...(alta.carpetaInterna ? { carpetaInterna: alta.carpetaInterna } : {}), ...(alta.ficha ? { ficha: alta.ficha } : {}) } });
    setDraft((d) => {
      const next = accesosDelAlta(draftAccesos(d), alta, newItemId);
      return next ? { ...d, accesos: next } : d;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alta?.carpetaCompartida, alta?.materiales]);

  // Guardado automático en la ficha (no publica)
  const current = useMemo(() => ({ ...draft, emails: normalizeEmails(emailsText) }), [draft, emailsText]);
  // Solo guarda si algo cambió de verdad (abrir la ficha no escribe nada)
  const snapshot = (d: PafPortalDraft) => { const { publishedAt: _p, ...rest } = d; return JSON.stringify(rest); };
  const lastSaved = useRef(snapshot(current));
  useEffect(() => {
    const snap = snapshot(current);
    if (snap === lastSaved.current) { setPending(false); return; }
    setPending(true);
    const t = setTimeout(() => {
      lastSaved.current = snap;
      setPending(false);
      onUpdateProject(project.id, { pafPortal: { ...current, publishedAt: project.pafPortal?.publishedAt } });
      // Si el portal ya está publicado, el cambio se publica solo (sin "Publicar cambios")
      if (published) {
        const r = portalFromProject(project, meetings, current, clienteId, new Date(), privados);
        if ('errors' in r) setErrors(r.errors);
        else { setErrors([]); publishPafPortal(r.doc).then(() => setSavedAt(new Date())).catch(() => setErrors(['Se guardó, pero no se pudo actualizar el portal. Tocá «Guardar y publicar».'])); }
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Si cambia la próxima reunión en la agenda, el portal publicado se actualiza solo
  const today = new Date().toLocaleDateString('en-CA');
  // Lo que sale de la agenda (próxima reunión, la que está por confirmar y cuántas van):
  // si cambia, el portal publicado se actualiza solo
  const agendaDoc = (() => { const r = portalFromProject(project, meetings); return 'doc' in r ? r.doc : null; })();
  const agendaKey = (d: Pick<PafPortalDoc, 'proximaReunion' | 'reunionPorConfirmar' | 'reunionesAcuerdo'> | null | undefined) =>
    JSON.stringify([d?.proximaReunion ?? null, d?.reunionPorConfirmar ?? null, d?.reunionesAcuerdo ?? null]);
  const nextKey = agendaKey(agendaDoc);
  const publishedKey = agendaKey(published);
  useEffect(() => {
    if (!published || !project.pafPortal?.publishedAt || !agendaDoc || publishedKey === nextKey) return;
    publishPafPortal(agendaDoc).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextKey, publishedKey]);

  const privados = [pedido?.alta?.carpetaInterna, pedido?.alta?.ficha];
  const set = (patch: Partial<PafPortalDraft>) => { setDraft((d) => ({ ...d, ...patch })); setNotice(''); };

  const publish = async () => {
    hapticFeedback.light();
    setBusy(true); setErrors([]); setNotice('');
    try {
      // Cliente Web sin ID: se le da el próximo WEB-### (no pasa por el alta de Tally)
      let id = clienteId.trim().toUpperCase();
      if (webId && !CLIENTE_ID_RE.test(id)) { id = await suggestNextWebClienteId(); setClienteId(id); }
      const result = portalFromProject(project, meetings, current, id, new Date(), privados);
      if ('errors' in result) { setErrors(result.errors); return; }
      await publishPafPortal(result.doc);
      await publishPortalExtras(result.doc.clienteId, { objetivos: portalGoals(panel?.goals), contacto: { whatsapp: config.whatsapp || '' } });
      onUpdateProject(project.id, { pafClienteId: result.doc.clienteId, pafPortal: { ...current, publishedAt: result.doc.actualizadoEn } });
      lastSaved.current = snapshot(current); setPending(false); setSavedAt(new Date());
      setNotice(published ? '' : 'Publicado. Copiá el enlace y pasáselo por tu canal.');
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
    pedido, privados, pending, savedAt, dirty: portalDirty(current, published, privados), busy, errors, notice, publish, unpublish, copyLink,
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

  const save = (updates: Partial<Project>, ...historial: string[]) => {
    setError('');
    const all = { ...updates, ...(historial.length ? conHistorial(project, ...historial) : {}) };
    onUpdateProject(project.id, all);
    republishIfPublished({ ...project, ...all }, meetings).catch((e: Error) => setError(e.message));
  };
  const saveTasks = (pafTareas: PafTask[], ...historial: string[]) => save({ pafTareas }, ...historial);
  // Entregas: queda en el historial cuando se muestra o se aprueba
  const saveDeliveries = (pafEntregas: PafDelivery[]) => {
    const notas = pafEntregas.flatMap((d) => {
      const antes = deliveries.find((x) => x.id === d.id);
      const nombre = `${d.titulo}${d.version ? ` ${d.version}` : ''}`;
      return [
        ...(d.publicada && antes && !antes.publicada ? [`Entrega publicada: ${nombre}`] : []),
        ...(d.estado === 'aprobada' && antes && antes.estado !== 'aprobada' ? [`Entrega aprobada: ${nombre}`] : []),
        ...(d.estado === 'ajustes' && antes && antes.estado !== 'ajustes' ? [`Entrega con ajustes: ${nombre}`] : []),
      ];
    });
    save({ pafEntregas }, ...notas);
  };
  const update = (id: string, fn: (t: PafTask) => PafTask, nota?: (t: PafTask) => string) => {
    const t = tasks.find((x) => x.id === id);
    saveTasks(tasks.map((x) => (x.id === id ? fn(x) : x)), ...(t && nota ? [nota(t)] : []));
  };

  return {
    tasks, deliveries, error, saveDeliveries,
    channel: suggestedChannel(tasks),
    enable: (id: string) => update(id, (t) => ({ ...t, estado: 'habilitada', habilitadaEn: new Date().toISOString(), motivo: undefined }), (t) => `Tarea habilitada: ${t.titulo}`),
    hide: (id: string) => update(id, (t) => ({ ...t, estado: 'borrador' })),
    approve: (id: string, canal: string) => update(id, (t) => approveTask(t, canal), (t) => `Tarea completada: ${t.titulo} (confirmada por ${canal})`),
    reopen: (id: string, motivo: string) => update(id, (t) => reopenTask(t, motivo), (t) => `Pidió ajustes en ${t.titulo}: ${motivo}`),
    remove: (id: string) => saveTasks(tasks.filter((t) => t.id !== id)),
    /** Una sola prioritaria: la que va arriba del portal como "Tu próxima acción" */
    togglePrioritaria: (id: string) => saveTasks(tasks.map((t) => ({ ...t, prioritaria: t.id === id ? !t.prioritaria : false }))),
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
          {t.paraQue && <span className="block text-[11px] text-zinc-300"><span className="text-zinc-500">Para qué: </span>{t.paraQue}</span>}
          {t.detalle && <span className="block text-[11px] text-zinc-400">{t.detalle}</span>}
          <span className="block text-[10px] text-zinc-500">Hace: {PAF_RESPONSABLE_LABEL[t.responsable || 'estudio']}{t.tema && <span className="ml-2">· {temaPorId(t.tema).titulo}</span>}{t.prioritaria && <span className="ml-2 text-amber-300">★ Su próxima acción</span>}</span>
          {t.link && <a href={t.link} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-sky-300 truncate">{t.link}</a>}
          {t.pideArchivos && <span className="block text-[10px] text-zinc-500">Pide archivos · link a Materiales</span>}
          {t.motivo && t.estado === 'habilitada' && <span className="block text-[10px] text-sky-300">Reabierta: {t.motivo}</span>}
          {t.aprobacion && <span className="block text-[10px] text-emerald-400">Aprobada el {t.aprobacion.fecha.slice(0, 10)} por {t.aprobacion.canal}</span>}
          {t.estado === 'enviada' && t.avisoEn && <span className="block text-[10px] text-amber-300">Avisó que terminó el {t.avisoEn.slice(0, 10)}</span>}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${t.estado === 'habilitada' && t.motivo ? 'bg-amber-400/15 text-amber-300' : STATE_STYLE[t.estado]}`}>{t.estado === 'habilitada' && t.motivo ? 'Requiere ajustes' : PAF_TASK_STATE_LABEL[t.estado]}</span>
      </div>

      {reopening ? (
        <div className="space-y-1.5">
          <input autoFocus className={input} maxLength={140} value={motivo} placeholder="Qué ajustar (lo ve el estudio). Ej: faltan las fotos de la obra Belgrano" onChange={(e) => setMotivo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && motivo.trim() && (work.reopen(t.id, motivo), setReopening(false))} />
          <div className="flex gap-2">
            <button type="button" disabled={!motivo.trim()} onClick={() => { work.reopen(t.id, motivo); setReopening(false); setMotivo(''); }} className="rounded-lg bg-sky-500/15 text-sky-300 px-2 py-1 text-[11px] font-bold disabled:opacity-50">Pedir ajustes</button>
            <button type="button" onClick={() => setReopening(false)} className="text-[11px] text-zinc-400">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
          {t.estado === 'borrador' && <button type="button" onClick={() => work.enable(t.id)} className="rounded-lg bg-sky-500/15 text-sky-300 px-2 py-1">Habilitar</button>}
          {t.estado === 'habilitada' && <button type="button" onClick={() => work.hide(t.id)} className="rounded-lg bg-zinc-800 text-zinc-300 px-2 py-1">Ocultar</button>}
          {t.estado === 'habilitada' && <button type="button" onClick={() => work.togglePrioritaria(t.id)} title="La que ve arriba de todo como «Tu próxima acción»" className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${t.prioritaria ? 'bg-amber-400/15 text-amber-300' : 'bg-zinc-800 text-zinc-300'}`}><Star className="w-3 h-3" />{t.prioritaria ? 'Prioritaria' : 'Hacer prioritaria'}</button>}
          {canApprove && t.estado === 'enviada' && <span className="text-[10px] font-normal text-zinc-500">Revisala y confirmá:</span>}
          {canApprove && (
            <span className="inline-flex items-center rounded-lg overflow-hidden border border-emerald-500/30">
              <button type="button" onClick={() => { hapticFeedback.success(); work.approve(t.id, canal); }} className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-300 px-2 py-1"><Check className="w-3 h-3" />Completada</button>
              <select aria-label="Canal de la aprobación" value={canal} onChange={(e) => setCanal(e.target.value)} className="bg-transparent text-emerald-300 text-[11px] px-1 py-1 border-l border-emerald-500/30">
                {APPROVAL_CHANNELS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </span>
          )}
          {canReopen && <button type="button" onClick={() => setReopening(true)} className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 text-zinc-300 px-2 py-1"><Undo2 className="w-3 h-3" />Pedir ajustes</button>}
          <button type="button" aria-label={`Borrar ${t.titulo}`} onClick={() => window.confirm(`¿Borrar la tarea "${t.titulo}"?`) && work.remove(t.id)} className="ml-auto text-zinc-500 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </li>
  );
}

function AddTask({ work, onDone }: { work: Work; onDone?: () => void }) {
  const [f, setF] = useState({ titulo: '', link: '', detalle: '', fecha: '', paraQue: '', responsable: 'estudio' as PafResponsable });
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const add = () => {
    if (!f.titulo.trim()) return;
    const link = f.link.trim() ? safeHttpsUrl(f.link) : null;
    if (f.link.trim() && !link) { setError('El link tiene que empezar con https://'); return; }
    setError('');
    hapticFeedback.light();
    work.add({ titulo: f.titulo.trim(), ...(link ? { link } : {}), ...(f.detalle.trim() ? { detalle: f.detalle.trim() } : {}), ...(f.fecha ? { fecha: f.fecha } : {}), ...(f.paraQue.trim() ? { paraQue: f.paraQue.trim() } : {}), ...(f.responsable !== 'estudio' ? { responsable: f.responsable } : {}) }, visible);
    setF({ titulo: '', link: '', detalle: '', fecha: '', paraQue: '', responsable: 'estudio' });
    onDone?.();
  };
  return (
    <div className="space-y-1.5 pt-2 border-t border-zinc-800">
      <input className={input} value={f.titulo} placeholder="Qué tiene que hacer (ej. Completar la hoja Cliente ideal)" onChange={(e) => setF({ ...f, titulo: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} />
      <input className={input} value={f.paraQue} placeholder="Para qué sirve (ej. con esto definimos a quién le hablamos)" onChange={(e) => setF({ ...f, paraQue: e.target.value })} />
      <input className={input} value={f.link} placeholder="Link al archivo exacto (opcional, https://)" onChange={(e) => setF({ ...f, link: e.target.value })} />
      <label className="flex items-center gap-2 text-[11px] text-zinc-400">La hace
        <select className="rounded-lg bg-zinc-950 border border-zinc-800 px-2 py-1 text-xs text-zinc-100" value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value as PafResponsable })}>
          {(Object.keys(PAF_RESPONSABLE_LABEL) as PafResponsable[]).map((r) => <option key={r} value={r}>{PAF_RESPONSABLE_LABEL[r]}</option>)}
        </select>
      </label>
      <div className="flex gap-1.5">
        <input className={input} value={f.detalle} placeholder="Cómo hacerla (opcional)" onChange={(e) => setF({ ...f, detalle: e.target.value })} />
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
  const vacio = { titulo: '', enlace: '', fecha: '', version: '', decision: '', hasta: '', canal: '' };
  const [f, setF] = useState(vacio);
  const [error, setError] = useState('');
  // Control antes de mostrarla (no bloquea: es para no olvidarse)
  const [controlando, setControlando] = useState<string | null>(null);
  const [checks, setChecks] = useState<boolean[]>([]);
  const CONTROL = ['Versión y fecha correctas', 'Arriba está el resumen y qué tiene que decidir', 'Nada interno: sin notas, ficha, Tally ni borradores', 'Plazo y canal para confirmar acordados'];
  const update = (id: string, patch: Partial<PafDelivery>) => work.saveDeliveries(work.deliveries.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const add = () => {
    if (!f.titulo.trim()) return;
    const enlace = f.enlace.trim() ? safeHttpsUrl(f.enlace) : null;
    if (f.enlace.trim() && !enlace) { setError('El enlace tiene que empezar con https://'); return; }
    setError('');
    work.saveDeliveries([...work.deliveries, {
      id: newItemId(), titulo: f.titulo.trim(), publicada: false, estado: 'en_revision',
      ...(enlace ? { enlace } : {}), ...(f.fecha ? { fecha: f.fecha } : {}), ...(f.version.trim() ? { version: f.version.trim() } : {}),
      ...(f.decision.trim() ? { decision: f.decision.trim() } : {}), ...(f.hasta ? { hasta: f.hasta } : {}), ...(f.canal.trim() ? { canal: f.canal.trim() } : {}),
    }]);
    setF(vacio);
    onDone?.();
  };
  return (
    <div className="space-y-2">
      {work.deliveries.length > 0 && (
        <ul className="space-y-1.5">
          {work.deliveries.map((d) => (
            <li key={d.id} className="rounded-lg border border-zinc-800 p-2.5 text-xs space-y-1.5">
              <div className="flex items-start gap-2">
                <Package className="mt-0.5 w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{d.enlace ? <a href={d.enlace} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">{d.titulo}<ExternalLink className="w-3 h-3" /></a> : d.titulo}
                    {d.version && <span className="text-zinc-500"> · {d.version}</span>}{d.fecha && <span className="text-zinc-500"> · {d.fecha}</span>}</span>
                  {d.decision && <span className="block text-[11px] text-zinc-400">Decide: {d.decision}{d.hasta && ` · hasta el ${d.hasta.split('-').reverse().slice(0, 2).join('/')}`}{d.canal && ` · por ${d.canal}`}</span>}
                </span>
                <select aria-label="Estado de la entrega" value={d.estado || 'en_revision'} onChange={(e) => update(d.id, { estado: e.target.value as PafDeliveryState })} className="rounded-md bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                  {(Object.keys(PAF_DELIVERY_STATE_LABEL) as PafDeliveryState[]).map((k) => <option key={k} value={k}>{PAF_DELIVERY_STATE_LABEL[k]}</option>)}
                </select>
                <label className="flex items-center gap-1 text-[10px] text-zinc-400"><input type="checkbox" checked={d.publicada} onChange={(e) => {
                  if (!e.target.checked) { update(d.id, { publicada: false }); return; }
                  setControlando(d.id); setChecks(CONTROL.map(() => false));
                }} />La ve</label>
                <button type="button" aria-label={`Borrar ${d.titulo}`} onClick={() => window.confirm(`¿Borrar la entrega "${d.titulo}"?`) && work.saveDeliveries(work.deliveries.filter((x) => x.id !== d.id))} className="text-zinc-500 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              {controlando === d.id && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.04] p-2 space-y-1">
                  <p className="text-[11px] font-semibold text-zinc-100">Antes de mostrarla</p>
                  {CONTROL.map((c, i) => (
                    <label key={c} className="flex items-center gap-2 text-[11px] text-zinc-300"><input type="checkbox" checked={!!checks[i]} onChange={(e) => setChecks((x) => x.map((v, j) => (j === i ? e.target.checked : v)))} />{c}</label>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { update(d.id, { publicada: true }); setControlando(null); }} className="btn-solid-primary px-2.5 py-1 text-[11px]">{checks.every(Boolean) ? 'Mostrarla' : 'Mostrarla igual'}</button>
                    <button type="button" onClick={() => setControlando(null)} className="text-[11px] text-zinc-400">Cancelar</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {showForm && <div className="space-y-1.5">
        <div className="flex gap-1.5">
          <input className={input} value={f.titulo} placeholder="Nueva entrega (ej. Kit de cliente ideal)" onChange={(e) => setF({ ...f, titulo: e.target.value })} />
          <input className={`${input} w-24`} value={f.version} placeholder="v1" aria-label="Versión" onChange={(e) => setF({ ...f, version: e.target.value })} />
        </div>
        <div className="flex gap-1.5">
          <input className={input} value={f.enlace} placeholder="Enlace de Drive (https://)" onChange={(e) => setF({ ...f, enlace: e.target.value })} />
          <input className={`${input} w-36`} type="date" aria-label="Fecha de la entrega" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </div>
        <input className={input} value={f.decision} placeholder="Qué tiene que decidir o revisar (ej. si este foco representa al estudio)" onChange={(e) => setF({ ...f, decision: e.target.value })} />
        <div className="flex gap-1.5">
          <input className={`${input} w-36`} type="date" aria-label="Hasta cuándo" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
          <input className={input} value={f.canal} placeholder="Dónde lo confirma (mail, Asana, reunión)" onChange={(e) => setF({ ...f, canal: e.target.value })} />
        </div>
        <button type="button" onClick={add} className="btn-solid-primary px-3 py-1.5 text-xs">Agregar entrega</button>
      </div>}
      {(error || work.error) && <p role="alert" className="text-[11px] text-rose-300">{error || work.error}</p>}
    </div>
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
/** Editor de accesos directos: tarjeta con ícono, nombre y link; ordenar, sumar y borrar */
type AccessRow = { id: string; nombre: string; url: string };
function AccessEditor({ items, onChange, startAdding, privados }: { items: AccessRow[]; onChange: (items: AccessRow[]) => void; startAdding?: boolean; privados: (string | undefined)[] }) {
  // Al tocar "+ Acceso" arriba aparece una tarjeta vacía para completar
  useEffect(() => { if (startAdding && !items.some((a) => !a.nombre && !a.url)) onChange([...items, { id: newItemId(), nombre: '', url: '' }]); }, [startAdding]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (id: string, patch: Partial<AccessRow>) => onChange(items.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((a, i) => {
          const issue = accessIssue(a, privados);
          const fixed = normalizeLinkInput(a.url);
          const host = accessHost(fixed);
          return (
            <li key={a.id} className={`group rounded-xl border p-2.5 transition ${issue ? 'border-amber-400/40 bg-amber-400/[0.04]' : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'}`}>
              <div className="flex items-start gap-2.5">
                <span className={`flex w-9 h-9 shrink-0 items-center justify-center rounded-lg ${issue ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-100 text-zinc-950'}`}>
                  <AccessIcon nombre={a.nombre} url={fixed} />
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <input className="w-full bg-transparent text-xs font-semibold text-zinc-100 placeholder:text-zinc-600 outline-none" value={a.nombre} placeholder="Nombre (ej. Calendario de contenido)" aria-label="Nombre del acceso" onChange={(e) => set(a.id, { nombre: e.target.value })} />
                  <input className="w-full bg-transparent text-[11px] text-zinc-400 placeholder:text-zinc-600 outline-none" value={a.url} placeholder="Pegá el link https://" aria-label={`Link de ${a.nombre || 'acceso'}`} onChange={(e) => set(a.id, { url: e.target.value })} />
                  <p className={`text-[10px] ${issue ? 'text-amber-300' : 'text-zinc-500'}`}>{issue || (a.url.trim() ? `${host}${a.nombre.trim() ? '' : ` · se ve como «${defaultAccessName(fixed)}»`}` : 'Pegá el link: el ícono sale solo')}</p>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-zinc-500">
                  <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="hover:text-zinc-200 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button type="button" aria-label="Bajar" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="hover:text-zinc-200 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                  <button type="button" aria-label={`Borrar ${a.nombre || 'acceso'}`} onClick={() => onChange(items.filter((x) => x.id !== a.id))} className="hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={() => onChange([...items, { id: newItemId(), nombre: '', url: '' }])} className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 text-[11px] font-bold">+ Agregar acceso</button>
    </div>
  );
}

/** Estado del alta en una línea: Esperando formulario → Respondió → Carpetas listas */
function AltaStatus({ pedido, carpeta }: { pedido: PafPedidoAlta | null; carpeta?: string }) {
  if (!pedido?.enlaceFormulario) {
    return <p className="text-[11px] text-zinc-500">Alta: todavía sin link de Tally (Ajustes → Alta del estudio).</p>;
  }
  const fallo = pedido.estado === 'error' ? pedido.error : pedido.alta?.error;
  if (fallo) return <p role="alert" className="text-[11px] text-rose-300">Alta con error: {fallo}</p>;
  const respondio = !!pedido.alta?.fechaRespuesta;
  const carpetas = !!(pedido.alta?.carpetaCompartida || carpeta);
  const steps = [
    { label: 'Esperando formulario', done: true, current: !respondio && !carpetas },
    { label: 'Respondió', done: respondio || carpetas, current: respondio && !carpetas },
    { label: 'Carpetas listas', done: carpetas, current: carpetas },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" aria-label="Estado del alta">
      <span className="text-zinc-500">Alta</span>
      {steps.map((st, i) => (
        <li key={st.label} className={`inline-flex items-center gap-1.5 ${st.current ? 'text-zinc-100 font-semibold' : st.done ? 'text-zinc-400' : 'text-zinc-600'}`}>
          {i > 0 && <span aria-hidden className="text-zinc-700">→</span>}
          <span className={`w-1.5 h-1.5 rounded-full ${st.done ? 'bg-emerald-500' : 'bg-zinc-700'}`} aria-hidden />{st.label}
        </li>
      ))}
    </ol>
  );
}
/** Mensaje para avisarle por WhatsApp que tiene novedades (lo manda Juan, nunca el CRM solo) */
function novedades(p: PafPortalDoc, studio: string, origin: string): string {
  const lines: string[] = [];
  const pendientes = (p.tareas || []).filter((t) => t.estado === 'habilitada').length;
  if (p.anuncios?.[0]) lines.push(`• ${p.anuncios[0].titulo || p.anuncios[0].texto.slice(0, 80)}`);
  if (pendientes) lines.push(`• ${pendientes === 1 ? 'Una tarea' : `${pendientes} tareas`} para vos`);
  if (p.proximaReunion) lines.push(`• Nuestra próxima reunión: ${new Date(`${p.proximaReunion.fecha}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}${p.proximaReunion.hora ? ` a las ${p.proximaReunion.hora}` : ''}`);
  if (p.entregas?.length) lines.push(`• Nueva entrega: ${[...p.entregas].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0].titulo}`);
  return [`¡Hola ${studio}! Te dejé novedades en tu portal:`, ...lines, '', `Entrás acá con tu cuenta de Google: ${origin}/portal`].join('\n');
}

/** Avisarle: elegís el mensaje (con tus plantillas), se abre WhatsApp armado y lo mandás vos */
function AvisarleMenu({ project, published, phone }: { project: Project; published: PafPortalDoc; phone: string }) {
  const [open, setOpen] = useState(false);
  const nombre = project.ownerName || project.clientName;
  const portalUrl = `${window.location.origin}/portal`;
  const ultimo = [...(project.pafResumenes || [])].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  const entrega = [...(project.pafEntregas || [])].filter((e) => e.publicada).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0];
  const today = new Date().toLocaleDateString('en-CA');
  const pendientes = (project.pafTareas || []).filter((t) => t.estado === 'habilitada' && (t.responsable || 'estudio') === 'estudio');
  const texto = (id: MensajeId): string => {
    if (id === 'recordatorio') return recordatorioPendientes(nombre, pendientes, portalUrl, today);
    if (id === 'novedades') return novedades(published, project.clientName, window.location.origin);
    if (id === 'hoyAcordamos') {
      const parte = (titulo: string) => (ultimo?.proximosPasos.split(/\n(?=De )/).find((x) => x.startsWith(titulo)) || '').replace(`${titulo}:`, '').trim();
      return hoyAcordamos({ nombre, decisiones: ultimo?.acuerdos || '', deTuLado: parte('De tu lado'), deNuestroLado: parte('De nuestro lado'), proxima: published.proximaReunion });
    }
    return mensaje(id, { nombre, portal: portalUrl, materiales: published.materiales?.proyectos || project.pafDrive?.carpetaCompartida, proxima: published.proximaReunion, entrega });
  };
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 text-xs font-bold">
        <MessageCircle className="w-3.5 h-3.5" /> Avisarle
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <span className="absolute left-0 top-full z-40 mt-1 w-64 rounded-xl border border-zinc-700 bg-zinc-900 p-1 shadow-2xl">
            {MENSAJES.filter((m) => (m.id !== 'hoyAcordamos' || ultimo) && (m.id !== 'recordatorio' || pendientes.length)).map((m) => (
              <a key={m.id} href={`https://wa.me/${phone}?text=${encodeURIComponent(texto(m.id))}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
                className="block rounded-lg px-2.5 py-2 text-xs text-zinc-200 hover:bg-zinc-800">{m.label}</a>
            ))}
            <span className="block px-2.5 py-1.5 text-[10px] text-zinc-500">Se abre WhatsApp con el texto: completá lo que está entre [corchetes] y mandalo vos.</span>
          </span>
        </>
      )}
    </span>
  );
}
