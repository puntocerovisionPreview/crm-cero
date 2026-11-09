import React, { useEffect, useLayoutEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ArrowRight, ArrowUpRight, CalendarPlus, Check, ChevronDown, Folder, Home, LayoutList, ListChecks, Loader2, Megaphone, Route, MessageCircle, Package, Paperclip, Video,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { EmptyState, SegmentedControl } from '../ui';
import { auth } from '../firebaseAuth';
import { isAllowedUser, signInWithGoogle, signOutUser } from '../utils/authAccess';
import { formatDisplayDate } from '../utils/projectTimeline';
import { AccessIcon } from '../components/AccessIcon';
import { ETAPAS, type Etapa } from '../portal/presencia';
import { MATERIALES, PAF_DELIVERY_STATE_LABEL, PAF_RESPONSABLE_LABEL, hitoInfoDe, hitosDe, seccionesVisibles, type Recorrido } from '../portal/model';
import { PAF_PORTAL_LINK_KEYS, PAF_PORTAL_LINK_LABEL, PRESENCIA_HITOS, accessHost, accessesFromEnlaces, calendarLink, isOverdue, portalItemKeys, type PafAviso, type PafPortalDoc, type PafPortalLinkKey } from '../portal/model';
import { sendTaskDone, sendVisita, subscribeAvisos, subscribeMyPafPortals, subscribePafPortal } from '../portal/store';

/**
 * /portal: el estudio entra con su cuenta de Google (el mismo correo con el que se
 * compartió su carpeta) y ve solo su paf_portal. Las reglas de Firestore hacen el control.
 * Usa los colores y componentes del CRM (claro u oscuro según el dispositivo).
 * En desarrollo, /portal?demo muestra un ejemplo sin login para revisar el diseño.
 */

type Tab = 'inicio' | 'recorrido' | 'tareas' | 'entregas' | 'archivos';
type PortalTask = PafPortalDoc['tareas'][number];

const LINK_HINT: Record<PafPortalLinkKey, string> = {
  carpeta: 'Todo lo del programa, en tu Drive',
  materiales: 'Proyectos, fotos, logo y registro de obra',
  resultados: 'Lo que te entregamos',
  web: 'Tu sitio',
  asana: 'Qué se publica y cuándo',
};

/** Las partes de su carpeta que no son enlaces fijos */
const PARTE_HINT: Record<string, string> = { 'Para completar': 'Los Excel y lo que te pedimos completar' };

const DEMO: PafPortalDoc = {
  clienteId: 'PAF-DEMO',
  estudio: 'Estudio Ejemplo Arquitectura',
  emailsAutorizados: ['demo@example.com'],
  hitoVisible: 2,
  resumenVisible: 'Esta semana cerramos el foco del estudio: a quién le hablamos y qué proyectos queremos atraer. Con eso arrancamos el mensaje.',
  enlaces: {},
  accesos: [
    { nombre: 'Tu carpeta', url: 'https://drive.google.com/' },
    { nombre: 'Materiales', url: 'https://drive.google.com/' },
    { nombre: 'Contenido en Asana', url: 'https://app.asana.com/' },
    { nombre: 'Tu web (versión de prueba)', url: 'https://example.com/' },
  ],
  anuncios: [
    { id: 'a1', titulo: 'Ya está el borrador de tu web', texto: 'Miralo con calma y anotá lo que cambiarías. Lo vemos el martes.', link: 'https://example.com/', fijado: true, fecha: '2026-11-03' },
  ],
  mostrarAvance: true,
  linkReunion: 'https://meet.google.com/',
  hitosCompletados: [1],
  etapa: 'presencia',
  etapas: ['presencia', 'adquisicion', 'conversion'],
  enMarcha: [{ texto: 'Preparando: Informe de diagnóstico y metas', quien: 'cero' }, { texto: 'La propuesta de contenido del jueves', quien: 'cm' }],
  numeros: [{ label: 'Seguidores', valor: '1.240', fuente: 'Instagram, hoy' }, { label: 'Publicaciones del mes', valor: '9', fuente: 'Instagram, últimos 30 días' }],
  reportes: [{ id: 'rp', desde: '2026-10-27', hasta: '2026-11-02', hicimos: '- Reunión de arranque\n- Excel de cliente ideal explicado', aprobaste: '- Formulario de arranque', falta: '- Completar el Excel', viene: '- Devolución del kit', numeros: '' }],
  secciones: { novedades: true, proximaAccion: true, enMarcha: true, tuMes: true, numeros: true, recorrido: true, anuncios: true, semana: true, tareas: true, reuniones: true, reunionesAcuerdo: true, acuerdos: true, entregas: true, reportes: true, materiales: true, contenido: true, cicloCM: true, accesos: true },
  gestionContenido: 'https://app.asana.com/',
  materiales: { proyectos: 'https://drive.google.com/', equipo: 'https://drive.google.com/', referencias: 'https://drive.google.com/', registro: 'https://drive.google.com/' },
  reunionesAcuerdo: { total: 8, hechas: 3 },
  tareas: [
    { id: 'd1', titulo: 'Completar el formulario de arranque', estado: 'aprobada', aprobadaEl: '2026-10-28' },
    { id: 'd2', titulo: 'Subir 10 fotos de obras terminadas', paraQue: 'Con esto armamos las primeras publicaciones de tu portfolio.', detalle: 'Las de mejor calidad que tengas, sin editar.', link: 'https://drive.google.com/', fecha: '2026-11-06', estado: 'habilitada', prioritaria: true },
    { id: 'd3', titulo: 'Elegir 3 proyectos que te representen', detalle: 'Los que te gustaría hacer más seguido.', fecha: '2026-11-01', estado: 'habilitada', motivo: 'Sumá uno de vivienda, así comparamos.' },
    { id: 'd4', titulo: 'Revisar la propuesta de foco', estado: 'enviada' },
  ],
  tareasHabilitadas: ['d2', 'd3'],
  entregas: [
    { id: 'e1', titulo: 'Diagnóstico inicial del estudio', fecha: '2026-10-30', enlace: 'https://drive.google.com/' },
    { id: 'e2', titulo: 'Propuesta de foco', version: 'v2', fecha: '2026-11-04', enlace: 'https://drive.google.com/', estado: 'en_revision', decision: 'si este foco representa a tu estudio', hasta: '2026-11-07', canal: 'mail' },
  ],
  proximaReunion: { fecha: '2026-11-10', hora: '10:30', objetivo: 'Revisar la propuesta de mensaje', preparar: 'Qué obras te gustaría mostrar primero', conCM: true },
  semana: { actual: 3, total: 12 },
  actualizadoEn: '2026-11-02T20:00:00.000Z',
  objetivos: [
    { texto: 'Cerrar a quién le hablamos', hecho: true, quien: 'cero' },
    { texto: 'Borrador del mensaje principal', hecho: false, quien: 'cero' },
    { texto: 'Subir las fotos de obra', hecho: false, quien: 'estudio' },
  ],
  contacto: { whatsapp: '5491100000000' },
  reuniones: [{ fecha: '2026-10-30', acuerdos: 'El foco es vivienda unifamiliar en zona norte. El tono: cercano y técnico.', proximosPasos: 'Ustedes: subir fotos de obra. Nosotros: borrador del mensaje para el martes.' }],
};

/** Claro u oscuro según el dispositivo del estudio (el CRM usa las mismas variables) */
function useSystemTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const prev = { dark: root.classList.contains('dark'), light: root.classList.contains('light') };
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    // El portal va siempre en la estética clara de .CERO (fondo claro y tarjetas blancas)
    const apply = () => {
      root.classList.toggle('dark', false);
      root.classList.toggle('light', true);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      root.classList.toggle('dark', prev.dark);
      root.classList.toggle('light', prev.light);
    };
  }, []);
}

export const PafPortalView: React.FC = () => {
  useSystemTheme();
  const params = new URLSearchParams(window.location.search);
  const demo = import.meta.env.DEV && params.has('demo');
  // "Ver como cliente" desde la ficha: solo para Juan, solo lectura
  const previewId = params.get('ver') || '';
  const [preview, setPreview] = useState<PafPortalDoc | null | undefined>(undefined);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [portals, setPortals] = useState<PafPortalDoc[] | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(0);

  // Antes que el portal: así el nombre del estudio (que pone el portal) queda en la pestaña
  useLayoutEffect(() => { document.title = 'Mi portal · Método PAF'; }, []);
  useEffect(() => {
    if (demo) return;
    return onAuthStateChanged(auth, setUser);
  }, [demo]);

  useEffect(() => {
    setPortals(null); setPreview(undefined); setError(''); setSelected(0);
    if (!user?.email || !user.emailVerified) return;
    if (previewId && isAllowedUser(user)) return subscribePafPortal(previewId, setPreview);
    return subscribeMyPafPortals(user.email, setPortals, () => setError('No pudimos cargar tu portal. Revisá tu conexión y volvé a intentar.'));
  }, [user]);

  if (demo) return <PortalScreen portal={DEMO} email="demo@example.com" demo onLogout={() => undefined} />;

  if (previewId && user && isAllowedUser(user)) {
    if (preview === undefined) return <Shell><PortalSkeleton /></Shell>;
    if (!preview) return <Shell><p className="py-24 text-center text-sm text-[var(--text-secondary)]">El portal {previewId} no está publicado.</p></Shell>;
    return <PortalScreen portal={preview} email={user.email!} readOnly onLogout={() => undefined} />;
  }

  const login = async () => {
    setError('');
    try { await signInWithGoogle(); } catch { setError('No se pudo iniciar sesión. Probá de nuevo.'); }
  };

  if (user === undefined || (user && portals === null && !error)) {
    return <Shell><PortalSkeleton /></Shell>;
  }

  if (!user) {
    return (
      <Shell>
        <div className="mx-auto max-w-sm py-16 sm:py-24 text-center">
          <Eyebrow>Método PAF</Eyebrow>
          <h1 className="mt-4 text-4xl sm:text-5xl font-light tracking-tight text-[var(--text-primary)]">Tu portal</h1>
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">Entrá con la cuenta de Google con la que compartimos tu carpeta de Drive.</p>
          <button type="button" onClick={login} className="btn-solid-primary mt-8 w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm">
            <GoogleMark /> Entrar con Google
          </button>
          {error && <p role="alert" className="mt-4 text-sm text-rose-500">{error}</p>}
        </div>
      </Shell>
    );
  }

  if (error || !portals?.length) {
    return (
      <Shell>
        <div className="mx-auto max-w-sm py-16 sm:py-24 text-center">
          <h1 className="text-2xl font-light tracking-tight text-[var(--text-primary)]">{error ? 'No pudimos cargar tu portal' : 'Esta cuenta no tiene un portal'}</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{error || `Entraste como ${user.email}. Usá el correo con el que compartimos tu carpeta, o avisale a tu equipo de .CERO.`}</p>
          <button type="button" onClick={() => signOutUser()} className="mt-6 text-sm text-[var(--text-secondary)] underline underline-offset-4 hover:text-[var(--text-primary)]">Entrar con otra cuenta</button>
        </div>
      </Shell>
    );
  }

  const portal = portals[Math.min(selected, portals.length - 1)];
  return (
    <PortalScreen
      portal={portal}
      email={user.email!}
      onLogout={() => signOutUser()}
      switcher={portals.length > 1 ? (
        <select aria-label="Estudio" value={selected} onChange={(e) => setSelected(Number(e.target.value))} className="rounded-[var(--radius-control)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-primary)]">
          {portals.map((x, i) => <option key={x.clienteId} value={i}>{x.estudio}</option>)}
        </select>
      ) : null}
    />
  );
};

// ---------- Estructura ----------

/** El portal dentro de la ficha de Juan: mismos datos en vivo, solo lectura, sin login ni marco aparte */
export function PortalPreviewScreen({ portal }: { portal: PafPortalDoc }) {
  return <PortalScreen portal={portal} email="vista previa" readOnly embedded onLogout={() => undefined} />;
}

/** Estética aprobada de .CERO: fondo claro, tarjetas blancas, grafito y naranja (el color del estudio lo reemplaza si tiene) */
const CERO_BRAND = {
  '--bg-app': '#F5F6F8',
  '--bg-surface': '#FFFFFF',
  '--text-primary': '#191B20',
  '--solid-contrast-bg': '#191B20',
  '--solid-contrast-text': '#FFFFFF',
  '--marca': '#E77813',
  '--marca-text': '#FFFFFF',
} as const;

function Shell({ children, right, marca, embedded }: { children: React.ReactNode; right?: React.ReactNode; marca?: string | null; embedded?: boolean }) {
  return (
    <div className={`light ${embedded ? 'min-h-full' : 'min-h-screen'} bg-[var(--bg-app)] text-[var(--text-primary)]`} style={{ ...CERO_BRAND, '--marca': marca || CERO_BRAND['--marca'] } as React.CSSProperties}>
      <div className="mx-auto max-w-3xl px-4 sm:px-8 pb-16">
        <div className="flex items-center justify-between gap-3 py-5 sm:py-7"><BrandLogo size="sm" />{right}</div>
        {children}
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--text-tertiary)]">{children}</p>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-swiss ${className}`}>{children}</div>;
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-normal tracking-tight text-[var(--text-primary)]">{title}</h2>
      {hint && <p className="mt-1 text-xs text-[var(--text-tertiary)]">{hint}</p>}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="w-4 h-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

// ---------- Portal ----------

function PortalScreen({ portal: p, email, demo, readOnly, embedded, onLogout, switcher }: { portal: PafPortalDoc; email: string; demo?: boolean; readOnly?: boolean; embedded?: boolean; onLogout: () => void; switcher?: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>('inicio');
  const [avisos, setAvisos] = useState<PafAviso[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (demo) return;
    return subscribeAvisos(p.clienteId, setAvisos);
  }, [p.clienteId, demo]);
  // Le cuenta a Juan que entraste (solo la fecha: así sabe si viste las novedades)
  useEffect(() => {
    if (!demo && !readOnly && !embedded) sendVisita(p.clienteId);
  }, [p.clienteId, demo, readOnly, embedded]);

  const done = async (tareaId: string) => {
    setSending(tareaId); setError('');
    try {
      if (demo) setAvisos((a) => [...a, { id: tareaId, tareaId, email, creadoEn: new Date().toISOString() }]);
      else await sendTaskDone(p.clienteId, tareaId, email);
    } catch {
      setError('No se pudo avisar. Probá de nuevo.');
    } finally {
      setSending(null);
    }
  };

  // Qué secciones eligió mostrar Juan (lo apagado ni siquiera llega)
  const ver = seccionesVisibles(p.secciones);
  const tareas = p.tareas || [];
  const avisada = (t: PortalTask) =>
    t.estado === 'enviada' || (t.estado === 'habilitada' && avisos.some((a) => a.tareaId === t.id && (!t.habilitadaEn || a.creadoEn > t.habilitadaEn)));
  const pendientes = tareas.filter((t) => t.estado === 'habilitada' && !avisada(t))
    .sort((a, b) => Number(!!b.prioritaria) - Number(!!a.prioritaria) || (a.fecha || '9').localeCompare(b.fecha || '9'));
  const enRevision = tareas.filter((t) => t.estado !== 'aprobada' && avisada(t));
  const aprobadas = tareas.filter((t) => t.estado === 'aprobada');
  // "Tu próxima acción": la que marcó Juan o, si no, la más urgente del estudio
  const principal = ver.proximaAccion ? pendientes.find((t) => t.prioritaria) || pendientes.find((t) => (t.responsable || 'estudio') === 'estudio') : undefined;
  const resto = pendientes.filter((t) => t !== principal);
  // Lo que tiene que hacer el estudio (sin lo que hace la CM o .CERO)
  const suyas = pendientes.filter((t) => (t.responsable || 'estudio') === 'estudio');
  // Entregas que esperan una decisión suya (van en "Te toca a vos" con su sello)
  const decisiones = ver.entregas ? (p.entregas || []).filter((d) => d.decision && (d.estado || 'en_revision') === 'en_revision') : [];
  const entregas = p.entregas || [];
  // Accesos libres; los portales publicados antes traen los 5 enlaces fijos
  const accesos = p.accesos ?? accessesFromEnlaces(p.enlaces || {});
  const anuncios = p.anuncios || [];
  const mostrarAvance = p.mostrarAvance !== false;
  // Presencia (PAF) o Web: cada uno tiene sus hitos
  const etapa: Etapa = p.etapa || 'presencia';
  const HITOS = hitosDe(p.recorrido, etapa);
  const hito = Math.min(HITOS.length, Math.max(1, p.hitoVisible || 1));
  const hechos = p.hitosCompletados || [];
  const initial = (email[0] || '?').toUpperCase();
  const objetivos = p.objetivos || [];
  const reuniones = p.reuniones || [];
  const reportes = p.reportes || [];
  const materiales = MATERIALES.filter((m) => p.materiales?.[m.id]);
  const whatsapp = p.contacto?.whatsapp || '';
  const isNew = useNewItems(p, !readOnly && !demo);
  useBrandHead(p, !embedded);

  // Bienvenida solo la primera vez en este dispositivo (no en la vista previa de Juan)
  const welcomeKey = `paf_bienvenida_${p.clienteId}`;
  const [showWelcome, setShowWelcome] = useState(() => {
    if (readOnly) return false;
    try { return !localStorage.getItem(welcomeKey); } catch { return false; }
  });
  const closeWelcome = () => {
    setShowWelcome(false);
    try { localStorage.setItem(welcomeKey, '1'); } catch { /* sin almacenamiento: se vuelve a mostrar */ }
  };

  const taskProps = {
    today: new Date().toLocaleDateString('en-CA'),
    uploadUrl: p.materiales?.proyectos || p.enlaces?.materiales || p.enlaces?.carpeta,
    // Cada tarea sube a su subcarpeta de Materiales (Proyectos, Equipo y marca, Registro de obra…)
    uploadFor: (t: PortalTask) => p.materiales?.[t.carpeta || 'proyectos'] || p.enlaces?.materiales || (p.accesos || []).find((a) => a.nombre === 'Materiales')?.url || p.enlaces?.carpeta,
    sending, readOnly: !!readOnly, onDone: done,
  };
  const verRecorrido = ver.recorrido && mostrarAvance;

  const account = (
    <div className="flex items-center gap-3">
      {switcher}
      <button type="button" onClick={onLogout} title={`Salir (${email})`} className="group inline-flex items-center gap-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
        <span className="hidden sm:inline">Salir</span>
        <span className="w-8 h-8 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)] group-hover:border-[var(--border-strong)]">{initial}</span>
      </button>
    </div>
  );

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'inicio', label: 'Inicio' },
    ...(verRecorrido ? [{ id: 'recorrido' as Tab, label: 'Mi recorrido' }] : []),
    ...(ver.tareas ? [{ id: 'tareas' as Tab, label: 'Tareas', count: pendientes.length || undefined }] : []),
    ...(ver.entregas || ver.acuerdos || ver.reportes ? [{ id: 'entregas' as Tab, label: 'Entregas', count: entregas.length || undefined }] : []),
    ...(ver.accesos || ver.materiales || ver.contenido ? [{ id: 'archivos' as Tab, label: 'Archivos' }] : []),
  ];

  return (
    <Shell right={readOnly ? undefined : account} marca={p.marca} embedded={embedded}>
      {readOnly && !embedded && <p className="mb-6 rounded-[var(--radius-control)] border border-dashed border-[var(--border-strong)] px-4 py-2 text-xs text-[var(--text-secondary)]">Vista previa: así ve {p.estudio} su portal ahora. Es solo lectura: los botones no hacen nada.</p>}
      {demo && <p className="mb-6 rounded-[var(--radius-control)] border border-dashed border-[var(--border-strong)] px-4 py-2 text-xs text-[var(--text-secondary)]">Vista de ejemplo, solo en tu compu: así lo ve un estudio. Los datos son inventados.</p>}

      {/* Encabezado de marca: logo del estudio, saludo y avance por hitos */}
      <header className="pt-1 sm:pt-4">
        <div className="flex items-center gap-4 sm:gap-5">
          {p.logo && (
            <span className="flex w-16 h-16 sm:w-20 sm:h-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white p-2 shadow-sm">
              <img src={p.logo} alt={`Logo de ${p.estudio}`} className="max-w-full max-h-full object-contain" />
            </span>
          )}
          <div className="min-w-0">
            <Eyebrow>Tu espacio con .CERO · {p.recorrido === 'web' ? 'Tu web' : ETAPAS.find((x) => x.id === etapa)!.label}</Eyebrow>
            <h1 className="mt-1.5 text-3xl sm:text-5xl font-light tracking-tight leading-[1.1] text-[var(--text-primary)] break-words">Hola, {p.estudio}.</h1>
          </div>
        </div>
        {/* La semana en una frase: qué trabajamos, qué le toca y cuándo nos vemos */}
        <p className="mt-5 max-w-2xl text-lg sm:text-2xl font-light leading-snug tracking-tight text-[var(--text-primary)]">
          {mostrarAvance && p.recorrido !== 'web' && HITOS[hito - 1] ? <>Ahora estamos en <span className="font-medium">{HITOS[hito - 1].charAt(0).toLowerCase() + HITOS[hito - 1].slice(1)}</span>. </> : null}
          {suyas.length ? <>De tu lado hay {suyas.length === 1 ? 'una sola cosa' : `${suyas.length} cosas`}</> : <>De tu lado no hay nada por ahora</>}
          {ver.reuniones && p.proximaReunion ? <>, y nos vemos <span className="font-medium">{p.proximaReunion.fecha === new Date().toLocaleDateString('en-CA') ? 'hoy' : new Date(`${p.proximaReunion.fecha}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' })}{p.proximaReunion.hora ? ` a las ${p.proximaReunion.hora}` : ''}</span>.</> : '.'}
        </p>
        <nav aria-label="Tu resumen" className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { n: suyas.length, label: suyas.length === 1 ? 'tarea para vos' : 'tareas para vos', go: () => setTab(tabs.some((x) => x.id === 'tareas') ? 'tareas' : 'inicio'), alerta: suyas.some((t) => isOverdue(t, taskProps.today)) },
            { n: ver.reuniones && p.proximaReunion ? 1 : 0, label: ver.reuniones && p.proximaReunion ? `reunión: ${p.proximaReunion.fecha === taskProps.today ? 'hoy' : new Date(`${p.proximaReunion.fecha}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}` : 'reuniones agendadas', go: () => { setTab('inicio'); requestAnimationFrame(() => document.getElementById('hoy')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); } },
            { n: decisiones.length, label: decisiones.length === 1 ? 'entrega para revisar' : 'entregas para revisar', go: () => setTab(tabs.some((x) => x.id === 'entregas') ? 'entregas' : 'inicio'), alerta: decisiones.length > 0 },
            { n: hechos.length, label: `de ${HITOS.length} hitos listos`, go: () => setTab(verRecorrido ? 'recorrido' : 'inicio') },
          ].map((x) => (
            <button key={x.label} type="button" onClick={x.go} className="group rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm">
              <span className={`block text-3xl font-light tabular-nums ${x.alerta ? 'text-[var(--marca)]' : 'text-[var(--text-primary)]'}`}>{x.n}</span>
              <span className="block text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">{x.label}</span>
            </button>
          ))}
        </nav>
        {!readOnly && <button type="button" onClick={() => setShowWelcome(true)} className="mt-3 text-xs text-[var(--text-tertiary)] underline underline-offset-4 hover:text-[var(--text-primary)]">Ver la guía de cómo usar tu portal</button>}
        {mostrarAvance && p.recorrido !== 'web' && <EtapasLine etapas={p.etapas || ['presencia']} actual={etapa} />}
        {mostrarAvance && (
          <button type="button" onClick={() => verRecorrido && setTab('recorrido')} className="mt-5 w-full text-left group">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-[var(--text-secondary)]">
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span>Ahora:</span>
                <span className="font-serif italic text-base text-[var(--text-primary)]">{HITOS[hito - 1]}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]">
                {hechos.length} de {HITOS.length} hitos completados{verRecorrido && <ArrowRight className="w-3.5 h-3.5" />}
              </span>
            </span>
            <HitosBar hito={hito} hechos={hechos} hitos={HITOS} />
          </button>
        )}
      </header>

      {/* Lo nuevo desde la última visita, en una línea: cada parte lleva a su lugar */}
      {!showWelcome && ver.novedades && <SinceLastVisit keys={portalItemKeys(p).filter(isNew)} onGo={(t) => setTab(t)} />}

      {showWelcome && <GuiaInicial onClose={closeWelcome} estudio={p.estudio} pendientes={suyas.length} reunion={ver.reuniones ? p.proximaReunion : undefined} carpeta={p.enlaces?.carpeta || accesos.find((a) => a.nombre === 'Tu carpeta')?.url} bienvenida={p.bienvenida} hasWhatsapp={!!whatsapp} />}

      {/* Pestañas */}
      {tabs.length > 1 && (
        <>
          <nav className="hidden sm:block mt-10 -mx-4 px-4 overflow-x-auto no-scrollbar">
            <SegmentedControl<Tab> value={tab} onChange={setTab} options={tabs} />
          </nav>
          <BottomNav tabs={tabs} tab={tab} onChange={(t) => { setTab(t); window.scrollTo({ top: 0 }); }} />
        </>
      )}

      <main className="mt-6 sm:mt-8 animate-in fade-in duration-200" key={tab}>
        {tab === 'inicio' && (
          <div className="space-y-6 sm:space-y-8">
            {/* 1 · HOY: lo que le toca ahora y la próxima reunión, en un bloque que se distingue de todo */}
            <HoyHero
              principal={principal} taskProps={taskProps} nuevo={principal ? isNew(`t:${principal.id}:${principal.habilitadaEn || ''}`) : false}
              verReunion={ver.reuniones} reunion={p.proximaReunion} porConfirmar={p.reunionPorConfirmar} acuerdo={p.reunionesAcuerdo}
              link={p.linkReunion} estudio={p.estudio} whatsapp={whatsapp}
              trabajando={(p.enMarcha || [])[0]?.texto} enRevision={enRevision.length}
            />
            {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}

            {/* 2 · EN MARCHA: lo de cada lado */}
            {ver.enMarcha ? (
              (resto.length > 0 || decisiones.length > 0 || (p.enMarcha || []).length > 0) && (
                <section className={`grid gap-4 ${(p.enMarcha || []).length ? 'sm:grid-cols-2' : ''}`}>
                  <Card className="p-5">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--marca)]"><span className="w-2 h-2 rounded-full bg-[var(--marca)]" aria-hidden />Te toca a vos</p>
                    {decisiones.length + resto.length ? (
                      <ul className="mt-3 space-y-2.5">
                        {decisiones.map((d) => (
                          <li key={d.id}>
                            <button type="button" onClick={() => setTab('entregas')} className="w-full text-left rounded-[var(--radius-control)] border border-amber-300 bg-amber-50 px-3 py-2.5">
                              <span className="inline-flex rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Decidís vos{d.hasta ? ` · hasta el ${formatDisplayDate(d.hasta, 'short')}` : ''}</span>
                              <span className="mt-1.5 block text-sm font-medium text-[var(--text-primary)]">{d.titulo}{d.version ? ` ${d.version}` : ''}</span>
                              {d.decision && <span className="block text-xs text-[var(--text-secondary)]">{d.decision}</span>}
                            </button>
                          </li>
                        ))}
                        {resto.slice(0, 4).map((t) => (
                          <li key={t.id}>
                            <button type="button" onClick={() => setTab('tareas')} className="flex w-full items-start gap-2.5 text-left">
                              <span className={`mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full ${isOverdue(t, taskProps.today) ? 'bg-rose-500' : 'bg-[var(--marca)]'}`} aria-hidden />
                              <span className="min-w-0">
                                <span className="block text-sm text-[var(--text-primary)]">{t.titulo}</span>
                                {t.fecha && <span className={`block text-xs ${isOverdue(t, taskProps.today) ? 'text-rose-600' : 'text-[var(--text-tertiary)]'}`}>{isOverdue(t, taskProps.today) ? 'Venció el ' : 'Para el '}{formatDisplayDate(t.fecha, 'medium')}</span>}
                              </span>
                            </button>
                          </li>
                        ))}
                        {resto.length > 4 && <li><button type="button" onClick={() => setTab('tareas')} className="text-xs font-medium text-[var(--text-primary)] underline underline-offset-4">Ver las {pendientes.length} tareas</button></li>}
                      </ul>
                    ) : <p className="mt-3 text-sm text-[var(--text-secondary)]">{principal ? 'Solo lo de arriba.' : 'Nada más por ahora.'}</p>}
                  </Card>
                  {(p.enMarcha || []).length > 0 && (
                    <div className="p-1 sm:p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--text-secondary)]">Mientras tanto, nosotros</p>
                      <ul className="mt-3 space-y-2">
                        {(p.enMarcha || []).map((x, i) => <li key={i} className="text-[15px] leading-relaxed text-[var(--text-primary)]">{x.texto}</li>)}
                      </ul>
                    </div>
                  )}
                </section>
              )
            ) : ver.tareas && resto.length > 0 && (
              <section>
                <SectionTitle title="También te toca" hint="Cuando termines, tocá “Terminé”. Lo revisamos y te confirmamos." />
                <ul className="space-y-3">{resto.slice(0, 3).map((t) => <li key={t.id}><PendingTask t={t} {...taskProps} nuevo={isNew(`t:${t.id}:${t.habilitadaEn || ''}`)} /></li>)}</ul>
              </section>
            )}

            {/* 3 · Anuncios: información, más liviana */}
            {anuncios.length > 0 && (
              <ul className="space-y-3" aria-label="Anuncios">
                {anuncios.map((a) => (
                  <li key={a.id} className={`flex gap-3 rounded-[var(--radius-card)] px-4 py-3.5 ${a.fijado ? 'bg-white border border-[var(--border-subtle)]' : 'bg-transparent border border-dashed border-[var(--border-strong)]'}`}>
                    <Megaphone className="mt-0.5 w-4 h-4 shrink-0 text-[var(--marca)]" />
                    <div className="min-w-0">
                      {isNew(`a:${a.id}`) && <NewBadge className="mb-1.5" />}
                      {a.titulo && <p className="text-sm font-medium text-[var(--text-primary)]">{a.titulo}</p>}
                      <p className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">{a.texto}</p>
                      {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-[var(--text-primary)] underline underline-offset-4">Abrir <ArrowUpRight className="w-3.5 h-3.5" /></a>}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* El ritmo del contenido con la CM */}
            {ver.cicloCM && (
              <Card className="p-5 sm:p-6">
                <Eyebrow>El ritmo del contenido</Eyebrow>
                <ol className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    { d: 'Jueves', t: 'Te llega la propuesta de la semana siguiente: imagen, texto y formato.' },
                    { d: 'Hasta el lunes 12 h', t: 'La aprobás o pedís cambios donde lo acordamos.' },
                    { d: 'Toda la semana', t: 'Publicamos lo aprobado. Lo que no llegó, se reprograma con vos.' },
                  ].map((x) => (
                    <li key={x.d} className="rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] p-3">
                      <p className="text-xs font-semibold text-[var(--marca)]">{x.d}</p>
                      <p className="mt-1 text-sm leading-snug text-[var(--text-primary)]">{x.t}</p>
                    </li>
                  ))}
                </ol>
                {ver.contenido && <ContentButton url={p.gestionContenido} className="mt-4" />}
              </Card>
            )}

            {/* Esta semana: foco y objetivos */}
            {ver.semana && (p.resumenVisible || objetivos.length > 0) && (
              <Card className="p-5 sm:p-6">
                <Eyebrow>Esta semana</Eyebrow>
                {p.resumenVisible && <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-primary)] whitespace-pre-line">{p.resumenVisible}</p>}
                {objetivos.length > 0 && (
                  <div className={`grid gap-5 sm:grid-cols-2 ${p.resumenVisible ? 'mt-5 pt-5 border-t border-[var(--border-divider)]' : 'mt-4'}`}>
                    <GoalColumn title="Hace .CERO" items={objetivos.filter((g) => g.quien === 'cero')} />
                    <GoalColumn title="Hace tu estudio" items={objetivos.filter((g) => g.quien === 'estudio')} />
                  </div>
                )}
              </Card>
            )}

            {/* Tus números (los carga Juan, con su fuente) */}
            {(p.numeros || []).length > 0 && (
              <section>
                <Eyebrow>Tus números</Eyebrow>
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(p.numeros || []).map((n, i) => (
                    <li key={i} className="card-swiss p-4">
                      <p className="text-2xl font-light tracking-tight text-[var(--text-primary)] tabular-nums">{n.valor}</p>
                      <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">{n.label}</p>
                      {n.fuente && <p className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">{n.fuente}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Tu mes: lo hecho en el mes, armado con los reportes */}
            {ver.tuMes && reportes.length > 0 && <TuMes reportes={reportes} />}

            {/* 4 · PARA CONSULTAR: lo de referencia, más chico y plegado */}
            {(entregas.length > 0 || reuniones.length > 0 || accesos.length > 0) && (
              <details className="group card-swiss" open={!principal && !resto.length}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Para consultar</span>
                  <span className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">Entregas, acuerdos y accesos<ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" /></span>
                </summary>
                <div className="space-y-6 border-t border-[var(--border-divider)] px-5 pb-5 pt-4">
                  {ver.entregas && entregas.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <Eyebrow>Última entrega</Eyebrow>
                        {entregas.length > 1 && <button type="button" onClick={() => setTab('entregas')} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Ver todas</button>}
                      </div>
                      <DeliveryRow d={latest(entregas)} nuevo={isNew(`e:${latest(entregas).id}`)} />
                    </div>
                  )}
                  {reuniones.length > 0 && (
                    <div>
                      <span className="flex items-center gap-2"><Eyebrow>Lo que acordamos · {formatDisplayDate(reuniones[0].fecha, 'medium')}</Eyebrow>{isNew(`r:${reuniones[0].fecha}`) && <NewBadge />}</span>
                      <MeetingSummary s={reuniones[0]} />
                    </div>
                  )}
                  {accesos.length > 0 && (
                    <div>
                      <Eyebrow>Tus accesos</Eyebrow>
                      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {accesos.slice(0, 4).map((a, i) => (
                          <li key={`${a.url}-${i}`}>
                            <a href={a.url} target="_blank" rel="noopener noreferrer" className="group relative flex h-full items-center gap-2.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] p-3 transition hover:border-[var(--border-strong)]">
                              {isNew(`l:${a.url}`) && <NewBadge className="absolute -right-1 -top-2" />}
                              <AccessIcon nombre={a.nombre} url={a.url} className="w-4 h-4 shrink-0 text-[var(--marca)]" />
                              <span className="text-sm leading-snug text-[var(--text-primary)] break-words">{a.nombre}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                      {ver.contenido && !ver.cicloCM && p.gestionContenido && <ContentButton url={p.gestionContenido} className="mt-3" />}
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        )}

        {tab === 'recorrido' && <Recorrido hito={hito} hechos={hechos} recorrido={p.recorrido} etapa={etapa} etapas={p.etapas || ['presencia']} />}

        {tab === 'tareas' && (
          <div className="space-y-10">
            <section>
              <SectionTitle title="Lo que necesitamos de vos" hint="Cuando termines una, tocá “Terminé”. La revisamos y te confirmamos: avisar no la da por aprobada." />
              {pendientes.length ? (
                <ul className="space-y-3">
                  {pendientes.map((t) => <li key={t.id}><PendingTask t={t} {...taskProps} nuevo={isNew(`t:${t.id}:${t.habilitadaEn || ''}`)} /></li>)}
                </ul>
              ) : <EmptyState icon={<Check className="w-5 h-5" />} title="Nada pendiente" description="Cuando tengamos algo para vos, aparece acá." />}
              {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
            </section>

            {enRevision.length > 0 && (
              <section>
                <SectionTitle title="Recibidas · en revisión" hint="Nos avisaste que las terminaste. Te confirmamos cuando las revisemos." />
                <TaskList items={enRevision} dot="bg-sky-500" />
              </section>
            )}

            {aprobadas.length > 0 && (
              <section>
                <SectionTitle title="Completadas" />
                <TaskList items={aprobadas} dot="bg-emerald-500" muted />
              </section>
            )}
          </div>
        )}

        {tab === 'entregas' && (
          <section className="space-y-10">
            {ver.entregas && (
              <div>
                <SectionTitle title="Entregas" hint="Lo que preparamos para tu estudio y qué necesitamos que decidas." />
                {entregas.length ? (
                  <Card className="px-5 divide-y divide-[var(--border-divider)]">
                    {[...entregas].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map((d) => <DeliveryRow key={d.id} d={d} nuevo={isNew(`e:${d.id}`)} />)}
                  </Card>
                ) : <EmptyState icon={<Package className="w-5 h-5" />} title="Todavía no hay entregas" description="Aparecen acá a medida que las compartimos." />}
              </div>
            )}
            {reportes.length > 0 && (
              <div>
                <SectionTitle title="Reportes" hint="El resumen de cada semana." />
                <ul className="space-y-3">{reportes.map((r) => <li key={r.id}><ReportCard r={r} /></li>)}</ul>
              </div>
            )}
            {reuniones.length > 0 && (
              <div>
                <SectionTitle title="Resúmenes de reunión" hint="Acuerdos y próximos pasos de cada encuentro." />
                <ul className="space-y-3">
                  {reuniones.map((s, i) => (
                    <li key={i}><Card className="p-5"><p className="text-xs text-[var(--text-tertiary)]">{formatDisplayDate(s.fecha, 'medium')}</p><MeetingSummary s={s} /></Card></li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {tab === 'archivos' && (
          <section className="space-y-10">
            {ver.contenido && (
              <div>
                <SectionTitle title="Gestión de contenido" hint="Donde ves y aprobás las publicaciones con la community manager." />
                <ContentButton url={p.gestionContenido} />
              </div>
            )}
            {ver.materiales && materiales.length > 0 && (
              <div>
                <SectionTitle title="Materiales" hint="Subí cada cosa en su lugar. Así no tenés que buscar en Drive." />
                <ul className="grid gap-3 sm:grid-cols-2">
                  {materiales.map((m) => (
                    <li key={m.id}>
                      <a href={p.materiales![m.id]} target="_blank" rel="noopener noreferrer" className="card-swiss group flex h-full flex-col gap-2 p-4 transition hover:-translate-y-0.5">
                        <span className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]"><Folder className="w-4 h-4 text-[var(--marca)]" />{m.label}<ArrowUpRight className="ml-auto w-4 h-4 text-[var(--text-tertiary)]" /></span>
                        <span className="text-xs leading-relaxed text-[var(--text-secondary)]">{m.pedido}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ver.accesos && (
              <div>
                <SectionTitle title="Tus carpetas y enlaces" hint="Se abren en Drive y en las herramientas que usamos juntos." />
                {accesos.length ? (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {accesos.map((a, i) => {
                      // Los 5 accesos de siempre conservan su descripción; el ícono sale de lo que es el link
                      const k = PAF_PORTAL_LINK_KEYS.find((key) => PAF_PORTAL_LINK_LABEL[key] === a.nombre);
                      return (
                        <li key={`${a.url}-${i}`}>
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className="card-swiss group flex items-center gap-4 p-4 transition hover:-translate-y-0.5">
                            <span className="w-10 h-10 shrink-0 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] flex items-center justify-center text-[var(--marca)]"><AccessIcon nombre={a.nombre} url={a.url} className="w-[18px] h-[18px]" /></span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] break-words">{a.nombre}{isNew(`l:${a.url}`) && <NewBadge />}</span>
                              <span className="block text-xs text-[var(--text-tertiary)] truncate">{k ? LINK_HINT[k] : PARTE_HINT[a.nombre] || accessHost(a.url)}</span>
                            </span>
                            <ArrowUpRight className="w-4 h-4 text-[var(--text-tertiary)] transition group-hover:text-[var(--text-primary)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : <EmptyState icon={<Folder className="w-5 h-5" />} title="Tus accesos aparecen acá" description="Carpetas de Drive y todo lo que usamos juntos. Te avisamos cuando estén listos." />}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className={`mt-16 pt-6 mb-20 ${whatsapp ? 'sm:mb-16' : 'sm:mb-0'} border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-tertiary)]`}>
        <BrandLogo size="sm" />
        <span>Actualizado {formatDisplayDate(p.actualizadoEn.slice(0, 10), 'medium')}</span>
      </footer>
      {whatsapp && <WhatsappButton number={whatsapp} studio={p.estudio} />}
    </Shell>
  );
}

// ---------- Piezas ----------

function latest<T extends { fecha?: string }>(items: T[]): T {
  return [...items].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0];
}

function MeetingDate({ fecha, hora, objetivo, preparar, conCM, link, estudio, whatsapp }: { fecha: string; hora?: string; objetivo?: string; preparar?: string; conCM?: boolean; link?: string | null; estudio?: string; whatsapp?: string }) {
  const d = new Date(`${fecha}T12:00:00`);
  const month = d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
  const weekday = d.toLocaleDateString('es-AR', { weekday: 'long' });
  const cuando = `${weekday} ${d.getDate()}${hora ? ` a las ${hora}` : ''}`;
  return (
    <>
    <div className="mt-3 flex items-center gap-4">
      <div className="w-14 shrink-0 rounded-[var(--radius-control)] border border-[var(--border-subtle)] overflow-hidden text-center">
        <p className="bg-[var(--marca)] py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--marca-text)]">{month}</p>
        <p className="py-1.5 text-2xl font-light tracking-tight">{d.getDate()}</p>
      </div>
      <div>
        <p className="text-sm font-medium capitalize text-[var(--text-primary)]">{weekday}</p>
        <p className="text-sm text-[var(--text-secondary)]">{hora ? `${hora} hs · hora de Argentina` : 'Horario a confirmar'}</p>
        <p className="text-xs text-[var(--text-tertiary)]">Con Juan{conCM ? ' y la community manager' : ''}</p>
      </div>
    </div>
    {(objetivo || preparar) && (
      <div className="mt-4 space-y-1.5 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] px-3 py-2.5 text-sm">
        {objetivo && <p className="text-[var(--text-primary)]"><span className="text-[var(--text-tertiary)]">Para qué: </span>{objetivo}</p>}
        {preparar && <p className="text-[var(--text-primary)]"><span className="text-[var(--text-tertiary)]">Traé o pensá: </span>{preparar}</p>}
      </div>
    )}
    {estudio !== undefined && (
      <div className="mt-4 flex flex-wrap gap-2">
        {link && <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--marca)] px-3 py-1.5 text-xs font-medium text-[var(--marca-text)]"><Video className="w-3.5 h-3.5" />Entrar a la reunión</a>}
        <a href={calendarLink({ fecha, hora }, `Reunión .CERO · ${estudio}`, link)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)]"><CalendarPlus className="w-3.5 h-3.5" />Agregar a mi calendario</a>
        {whatsapp && <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola Juan, soy de ${estudio}. ¿Podemos mover la reunión del ${cuando}?`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-1 py-1.5 text-xs text-[var(--text-tertiary)] underline underline-offset-4 hover:text-[var(--text-primary)]">Reprogramar</a>}
      </div>
    )}
    </>
  );
}

function DeliveryRow({ d, nuevo }: { d: PafPortalDoc['entregas'][number]; nuevo?: boolean }) {
  const hasta = d.hasta ? formatDisplayDate(d.hasta, 'medium') : '';
  return (
    <div className="py-4">
      <div className="flex items-start gap-4">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--text-primary)] break-words">
            {d.titulo}{d.version && <span className="text-xs font-normal text-[var(--text-tertiary)]">{d.version}</span>}{nuevo && <NewBadge />}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-[var(--text-tertiary)]">
            {d.fecha && <span>{formatDisplayDate(d.fecha, 'medium')}</span>}
            {d.estado && <span className={d.estado === 'aprobada' ? 'text-emerald-600' : d.estado === 'ajustes' ? 'text-amber-600' : ''}>{PAF_DELIVERY_STATE_LABEL[d.estado]}</span>}
          </span>
        </span>
        {d.enlace && <a href={d.enlace} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)]">Revisar <ArrowUpRight className="w-3.5 h-3.5" /></a>}
      </div>
      {d.decision && d.estado !== 'aprobada' && (
        <p className="mt-3 rounded-[var(--radius-control)] border-l-[3px] border-l-[var(--marca)] bg-[var(--bg-surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)]">
          <span className="text-[var(--text-tertiary)]">Necesitamos que decidas: </span>{d.decision}
          {(hasta || d.canal) && <span className="block text-xs text-[var(--text-secondary)]">{hasta && `Hasta el ${hasta}`}{hasta && d.canal ? ' · ' : ''}{d.canal && `Confirmalo por ${d.canal}`}</span>}
        </p>
      )}
    </div>
  );
}

function TaskList({ items, dot, muted }: { items: PortalTask[]; dot: string; muted?: boolean }) {
  return (
    <ul className="divide-y divide-[var(--border-divider)] border-y border-[var(--border-subtle)]">
      {items.map((t) => (
        <li key={t.id} className="flex items-center gap-3 py-3.5">
          <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${dot}`} />
          <span className={`flex-1 min-w-0 text-sm break-words ${muted ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>{t.titulo}</span>
          {t.aprobadaEl && <span className="shrink-0 text-xs text-[var(--text-tertiary)]">{formatDisplayDate(t.aprobadaEl, 'short')}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Barra del avance: un tramo por hito; lleno si está confirmado, marcado si es el actual */
function HitosBar({ hito, hechos, hitos }: { hito: number; hechos: number[]; hitos: readonly string[] }) {
  return (
    <span className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${hitos.length}, minmax(0, 1fr))` }} aria-hidden>
      {hitos.map((t, i) => (
        <span key={t} className={`block h-1.5 rounded-full ${hechos.includes(i + 1) ? 'bg-[var(--marca)]' : i + 1 === hito ? 'bg-[var(--marca)] opacity-40' : 'bg-[var(--border-strong)]'}`} />
      ))}
    </span>
  );
}

/** MI RECORRIDO: los cinco hitos de Presencia, qué se trabaja en cada uno y cuándo se completa */
function Recorrido({ hito, hechos, recorrido, etapa = 'presencia', etapas = ['presencia'] }: { hito: number; hechos: number[]; recorrido?: Recorrido; etapa?: Etapa; etapas?: Etapa[] }) {
  const HITOS = hitosDe(recorrido, etapa);
  const INFO = hitoInfoDe(recorrido, etapa);
  const idx = etapas.indexOf(etapa);
  return (
    <section>
      <SectionTitle title={recorrido === 'web' ? 'El recorrido de tu web' : `Ahora: ${ETAPAS.find((x) => x.id === etapa)!.label}`} hint={`${hechos.length} de ${HITOS.length} hitos completados. Un hito se completa cuando lo confirmamos juntos, no por la fecha.`} />
      <ol className="relative space-y-3">
        {HITOS.map((titulo, i) => {
          const n = i + 1;
          const state = hechos.includes(n) ? 'done' : n === hito ? 'current' : 'pending';
          return (
            <li key={titulo} aria-current={state === 'current' ? 'step' : undefined}>
              <Card className={`p-5 ${state === 'current' ? 'border-[var(--marca)] shadow-sm' : ''}`}>
                <div className="flex items-start gap-4">
                  <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${state === 'done' ? 'bg-[var(--marca)] text-[var(--marca-text)]' : state === 'current' ? 'border-2 border-[var(--marca)] text-[var(--text-primary)]' : 'border border-[var(--border-strong)] text-[var(--text-tertiary)]'}`}>
                    {state === 'done' ? <Check className="w-4 h-4" /> : n}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-[var(--text-primary)]">
                      {titulo}
                      {state === 'current' && <span className="rounded-full bg-[var(--marca)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--marca-text)]">Estamos acá</span>}
                      {state === 'done' && <span className="text-xs font-normal text-[var(--text-tertiary)]">Completado</span>}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{INFO[i].trabajo}</p>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">Se completa cuando: {INFO[i].seCompleta}</p>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
      {recorrido !== 'web' && etapas.length > 1 && (
        <ol className="mt-8 grid gap-3 sm:grid-cols-2">
          {etapas.filter((e) => e !== etapa).map((e) => {
            const info = ETAPAS.find((x) => x.id === e)!;
            const antes = etapas.indexOf(e) < idx;
            return (
              <li key={e} className={`rounded-[var(--radius-card)] p-4 ${antes ? 'bg-[var(--bg-surface)] border border-[var(--border-subtle)]' : 'border border-dashed border-[var(--border-strong)]'}`}>
                <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">{antes && <Check className="w-4 h-4 text-[var(--marca)]" />}{info.label}<span className="text-xs font-normal text-[var(--text-tertiary)]">{antes ? 'Completada' : 'Próxima etapa'}</span></p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{info.pregunta}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** "Tu próxima acción": la tarea prioritaria, grande, con su explicación y su botón */
function NextAction(props: { t: PortalTask; today: string; uploadUrl?: string; sending: string | null; readOnly: boolean; onDone: (id: string) => void; nuevo?: boolean }) {
  return (
    <div className="rounded-[var(--radius-card)] border-2 border-[var(--marca)] bg-[var(--bg-surface)] shadow-sm">
      <p className="flex items-center gap-2 px-5 pt-4 text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--marca)]">Tu próxima acción</p>
      <PendingTask {...props} bare />
    </div>
  );
}

/** Botón a la app de la CM: sin link configurado, dice "Aún no disponible" y no abre nada */
function ContentButton({ url, className = '' }: { url?: string | null; className?: string }) {
  if (!url) return <span className={`inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-dashed border-[var(--border-strong)] px-4 py-2.5 text-sm text-[var(--text-tertiary)] ${className}`}><LayoutList className="w-4 h-4" />Gestión de contenido · aún no disponible</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--marca)] px-4 py-2.5 text-sm font-medium text-[var(--marca-text)] ${className}`}>
      <LayoutList className="w-4 h-4" />Abrir gestión de contenido<ArrowUpRight className="w-4 h-4" />
    </a>
  );
}

/** Reporte de la semana publicado por Juan */
function ReportCard({ r }: { r: NonNullable<PafPortalDoc['reportes']>[number] }) {
  const [open, setOpen] = useState(false);
  const partes = [
    { t: 'Lo que hicimos', v: r.hicimos }, { t: 'Lo que aprobaste', v: r.aprobaste }, { t: 'Lo que falta de tu lado', v: r.falta },
    { t: 'Lo que viene', v: r.viene }, { t: 'Números', v: r.numeros },
  ].filter((x) => x.v.trim());
  return (
    <Card className="p-5 sm:p-6">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <Eyebrow>Resumen de la semana · {formatDisplayDate(r.desde, 'short')} al {formatDisplayDate(r.hasta, 'short')}</Eyebrow>
        <ChevronDown className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {(open ? partes : partes.slice(0, 1)).map((x) => (
        <div key={x.t} className="mt-3">
          <p className="text-xs font-medium text-[var(--text-tertiary)]">{x.t}</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-line">{x.v}</p>
        </div>
      ))}
    </Card>
  );
}

/** "Desde tu última visita: 1 anuncio, 2 tareas nuevas y 1 entrega" (nada si no hay novedades) */
function SinceLastVisit({ keys, onGo }: { keys: string[]; onGo: (tab: Tab) => void }) {
  const n = (prefix: string) => keys.filter((k) => k.startsWith(prefix)).length;
  const parts: { text: string; tab: Tab }[] = [
    { count: n('a:'), one: '1 anuncio', many: 'anuncios', tab: 'inicio' as Tab },
    { count: n('t:'), one: '1 tarea nueva', many: 'tareas nuevas', tab: 'tareas' as Tab },
    { count: n('e:'), one: '1 entrega', many: 'entregas', tab: 'entregas' as Tab },
    { count: n('l:'), one: '1 acceso', many: 'accesos', tab: 'archivos' as Tab },
    { count: n('r:'), one: '1 resumen de reunión', many: 'resúmenes de reunión', tab: 'inicio' as Tab },
  ].filter((x) => x.count > 0).map((x) => ({ text: x.count === 1 ? x.one : `${x.count} ${x.many}`, tab: x.tab }));
  if (!parts.length) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-secondary)]" role="status">
      <span className="mr-0.5 inline-block w-2 h-2 rounded-full bg-[var(--marca,var(--text-primary))]" aria-hidden />
      <span>Desde tu última visita:</span>
      {parts.map((x, i) => (
        <React.Fragment key={x.text}>
          {i > 0 && <span aria-hidden>{i === parts.length - 1 ? ' y ' : ', '}</span>}
          <button type="button" onClick={() => onGo(x.tab)} className="font-medium text-[var(--text-primary)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--text-primary)]">{x.text}</button>
        </React.Fragment>
      ))}
    </div>
  );
}

/** Etiqueta "Nuevo" para lo que apareció desde la última visita */
function NewBadge({ className = '' }: { className?: string }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full bg-[var(--marca,var(--solid-contrast-bg))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--marca-text,var(--solid-contrast-text))] ${className}`}>Nuevo</span>;
}

/**
 * Lo que el estudio todavía no vio en este dispositivo. La primera visita no marca nada;
 * lo que llega mientras tiene el portal abierto, sí.
 */
function useNewItems(p: PafPortalDoc, enabled: boolean): (key: string) => boolean {
  const storeKey = `paf_visto_${p.clienteId}`;
  const keys = portalItemKeys(p);
  const [seen] = useState<Set<string> | null>(() => {
    if (!enabled) return null;
    try {
      const raw = localStorage.getItem(storeKey);
      return new Set(raw ? (JSON.parse(raw) as string[]) : keys);
    } catch { return null; }
  });
  const joined = keys.join('|');
  useEffect(() => {
    if (!enabled) return;
    try { localStorage.setItem(storeKey, JSON.stringify(keys)); } catch { /* sin almacenamiento */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, enabled, storeKey]);
  return (key) => !!seen && !seen.has(key);
}

/** Pestaña del navegador con el nombre y el logo del estudio */
function useBrandHead(p: PafPortalDoc, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const prevTitle = document.title;
    document.title = `${p.estudio} · Tu portal`;
    const icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const prevIcon = icon?.href;
    if (icon && p.logo) icon.href = p.logo;
    return () => {
      document.title = prevTitle;
      if (icon && prevIcon) icon.href = prevIcon;
    };
  }, [p.estudio, p.logo, enabled]);
}

function PortalSkeleton() {
  const bar = 'rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] animate-pulse';
  return (
    <div role="status" aria-label="Cargando tu portal" className="pt-4 space-y-8">
      <div className="flex items-center gap-4"><div className={`w-16 h-16 ${bar}`} /><div className="flex-1 space-y-2"><div className={`h-3 w-32 ${bar}`} /><div className={`h-9 w-2/3 ${bar}`} /></div></div>
      <div className={`h-1.5 w-full ${bar}`} />
      <div className={`h-10 w-72 ${bar}`} />
      <div className={`h-32 w-full ${bar}`} />
      <div className="grid gap-4 sm:grid-cols-2"><div className={`h-28 ${bar}`} /><div className={`h-28 ${bar}`} /></div>
    </div>
  );
}

/**
 * GUÍA INICIAL: se abre sola la primera vez (y desde "Ver la guía" cuando quiera).
 * Paso a paso, con lo que tiene ahora: cuántas tareas, la próxima reunión y su carpeta.
 */
function GuiaInicial({ onClose, estudio, pendientes, reunion, carpeta, bienvenida, hasWhatsapp }: {
  onClose: () => void; estudio: string; pendientes: number; reunion?: PafPortalDoc['proximaReunion'];
  carpeta?: string | null; bienvenida?: string | null; hasWhatsapp: boolean;
}) {
  const [i, setI] = useState(0);
  const pasos: { titulo: string; texto: React.ReactNode; accion?: React.ReactNode }[] = [
    {
      titulo: `Bienvenido, ${estudio}`,
      texto: <>Este es tu espacio de trabajo con .CERO. Acá tenés lo importante: <b>lo que te toca</b>, <b>cuándo nos vemos</b>, <b>lo que tenés para revisar</b> y <b>tus carpetas</b>. Te lo mostramos en un minuto.</>,
      accion: bienvenida ? <a href={bienvenida} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4">Abrir la bienvenida en PDF <ArrowUpRight className="w-4 h-4" /></a> : null,
    },
    {
      titulo: 'Arriba, tu resumen',
      texto: <>Los números de arriba te dicen cuántas tareas tenés, cuándo nos vemos, qué tenés para revisar y en qué parte del programa estamos. Tocá cualquiera para ir directo.{pendientes ? <> Ahora tenés <b>{pendientes === 1 ? '1 tarea' : `${pendientes} tareas`}</b>.</> : <> Ahora no tenés tareas: te avisamos cuando haya algo.</>}</>,
    },
    {
      titulo: 'Lo que te toca, de a una',
      texto: <>Cuando necesitemos algo de vos aparece acá, con <b>para qué sirve</b> y cómo hacerla. Al terminarla tocá <b>Terminé</b>: nos llega el aviso y te confirmamos. Lo que no aparece acá, no hace falta que lo hagas.</>,
    },
    {
      titulo: 'Tu carpeta de Drive',
      texto: <>Tiene tres partes: <b>Para completar</b> (lo que te pedimos), <b>Materiales</b> (fotos, proyectos y lo que nos pasás) y <b>Resultados</b> (lo que te entregamos). Cuando una tarea pide archivos, el botón te lleva a la carpeta justa.</>,
      accion: carpeta ? <a href={carpeta} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4">Abrir tu carpeta <ArrowUpRight className="w-4 h-4" /></a> : null,
    },
    {
      titulo: 'Nos vemos seguido',
      texto: <>{reunion ? <>Nuestra próxima reunión es el <b>{new Date(`${reunion.fecha}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}{reunion.hora ? ` a las ${reunion.hora}` : ''}</b>. </> : 'Cuando acordemos la próxima reunión, aparece arriba con el link y para qué es. '}Después de cada una te dejamos acá lo que acordamos.{hasWhatsapp ? ' ¿Dudas? Tocá "Hablar con Juan".' : ''}</>,
    },
  ];
  const ultimo = i === pasos.length - 1;
  const paso = pasos[i];
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 p-3 sm:p-6 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label="Guía del portal">
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 sm:p-8 text-[#191B20] shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between">
          <span className="flex gap-1.5" aria-label={`Paso ${i + 1} de ${pasos.length}`}>
            {pasos.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-[var(--marca)]' : k < i ? 'w-1.5 bg-[#191B20]' : 'w-1.5 bg-[#DAD6CE]'}`} />)}
          </span>
          <button type="button" onClick={onClose} className="text-xs text-[#5F6269] hover:text-[#191B20]">Saltar</button>
        </div>
        <h2 className="mt-6 text-2xl font-light tracking-tight">{paso.titulo}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[#3D4047]">{paso.texto}</p>
        {paso.accion && <div className="mt-4">{paso.accion}</div>}
        <div className="mt-8 flex items-center justify-between gap-3">
          {i > 0 ? <button type="button" onClick={() => setI(i - 1)} className="rounded-full px-4 py-2.5 text-sm text-[#5F6269] hover:text-[#191B20]">Atrás</button> : <span />}
          <button type="button" onClick={() => (ultimo ? onClose() : setI(i + 1))} className="rounded-full bg-[var(--marca)] px-6 py-3 text-sm font-medium text-[var(--marca-text)]">{ultimo ? 'Empezar' : 'Siguiente'}</button>
        </div>
      </div>
    </div>
  );
}

function GoalColumn({ title, items }: { title: string; items: { texto: string; hecho: boolean }[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-medium text-[var(--text-tertiary)]">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((g, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={`mt-0.5 w-4 h-4 shrink-0 rounded-full flex items-center justify-center ${g.hecho ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]' : 'border border-[var(--border-strong)]'}`}>{g.hecho && <Check className="w-3 h-3" />}</span>
            <span className={g.hecho ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]'}>{g.texto}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PendingTask({ t, today, uploadUrl, uploadFor, sending, readOnly, onDone, nuevo, bare }: { t: PortalTask; today: string; uploadUrl?: string; uploadFor?: (t: PortalTask) => string | undefined; sending: string | null; readOnly: boolean; onDone: (id: string) => void; nuevo?: boolean; bare?: boolean }) {
  const overdue = isOverdue(t, today);
  const delEstudio = (t.responsable || 'estudio') === 'estudio';
  const body = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {nuevo && <NewBadge className="mb-2" />}
        <p className={`${bare ? 'text-lg' : 'text-[15px]'} font-medium text-[var(--text-primary)] break-words`}>{t.titulo}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-tertiary)]">
          {!delEstudio && <span className="rounded-full bg-[var(--bg-surface-muted)] px-2 py-0.5 text-[var(--text-secondary)]">Lo hace {PAF_RESPONSABLE_LABEL[t.responsable!]}</span>}
          {t.fecha && <span className="inline-flex items-center gap-1.5">{overdue && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden />}{overdue ? `Venció el ${formatDisplayDate(t.fecha, 'medium')}` : `Para el ${formatDisplayDate(t.fecha, 'medium')}`}</span>}
        </p>
        {t.paraQue && <p className="mt-3 text-sm leading-relaxed text-[var(--text-primary)]"><span className="text-[var(--text-tertiary)]">Para qué sirve: </span>{t.paraQue}</p>}
        {t.motivo && <p className="mt-3 rounded-[var(--radius-control)] border-l-[3px] border-l-amber-500 bg-[var(--bg-surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)]"><span className="text-[var(--text-tertiary)]">Requiere ajustes: </span>{t.motivo}</p>}
        {t.detalle && <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">{t.detalle}</p>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {t.link && <a href={t.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] underline underline-offset-4">Abrir <ArrowUpRight className="w-3.5 h-3.5" /></a>}
          {t.pideArchivos && (uploadFor?.(t) || uploadUrl) && (
            <a href={uploadFor?.(t) || uploadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] underline underline-offset-4">
              <Paperclip className="w-3.5 h-3.5" /> Subir a {carpetaLabel(t)} <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
      {delEstudio && (
        <button type="button" onClick={() => onDone(t.id)} disabled={sending === t.id || readOnly} title={readOnly ? 'Vista previa: el botón no hace nada' : 'Avisanos que lo terminaste: lo revisamos y te confirmamos'} className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--marca)] px-4 py-2 text-sm font-medium text-[var(--marca-text)] disabled:opacity-60">
          {sending === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Terminé
        </button>
      )}
    </div>
  );
  return bare ? <div className="px-5 pb-5 pt-2">{body}</div> : <Card className="p-5">{body}</Card>;
}

/** "Materiales › Proyectos": dónde se suben los archivos de la tarea */
function carpetaLabel(t: PortalTask): string {
  const m = MATERIALES.find((x) => x.id === (t.carpeta || 'proyectos'));
  return m ? `Materiales › ${m.label}` : 'Materiales';
}

/** Botón fijo para escribirle a Juan por WhatsApp */
function WhatsappButton({ number, studio }: { number: string; studio: string }) {
  const href = `https://wa.me/${number}?text=${encodeURIComponent(`Hola Juan, te escribo de ${studio}.`)}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="btn-solid-primary fixed z-40 right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-[max(1rem,env(safe-area-inset-bottom))] inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm shadow-lg">
      <MessageCircle className="w-4 h-4" /> Hablar con Juan
    </a>
  );
}
function MeetingSummary({ s }: { s: { acuerdos: string; proximosPasos: string } }) {
  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      {s.acuerdos && <div><p className="text-xs font-medium text-[var(--text-tertiary)]">Acuerdos</p><p className="mt-1 text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-line">{s.acuerdos}</p></div>}
      {s.proximosPasos && <div><p className="text-xs font-medium text-[var(--text-tertiary)]">Próximos pasos</p><p className="mt-1 text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-line">{s.proximosPasos}</p></div>}
    </div>
  );
}

/** HOY: el bloque oscuro de arriba. Lo que le toca ahora (o que no le toca nada) y la próxima reunión. */
function HoyHero({ principal, taskProps, nuevo, verReunion, reunion, porConfirmar, acuerdo, link, estudio, whatsapp, trabajando, enRevision }: {
  principal?: PortalTask; taskProps: { today: string; uploadUrl?: string; uploadFor?: (t: PortalTask) => string | undefined; sending: string | null; readOnly: boolean; onDone: (id: string) => void }; nuevo: boolean;
  verReunion: boolean; reunion: PafPortalDoc['proximaReunion']; porConfirmar?: PafPortalDoc['reunionPorConfirmar']; acuerdo?: PafPortalDoc['reunionesAcuerdo'];
  link?: string | null; estudio: string; whatsapp: string; trabajando?: string; enRevision: number;
}) {
  const t = principal;
  const vencida = t ? isOverdue(t, taskProps.today) : false;
  const conReunion = verReunion && (reunion || porConfirmar);
  return (
    <section id="hoy" className="scroll-mt-6 overflow-hidden rounded-[28px] bg-white text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]">
      <div className={`grid ${conReunion ? 'sm:grid-cols-[1.4fr_1fr]' : ''}`}>
        <div className="p-5 sm:p-7">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.2em] text-[var(--marca)]">Te toca a vos{t?.fecha ? ` · ${isOverdue(t, taskProps.today) ? "venció el" : "para el"} ${formatDisplayDate(t.fecha, "medium")}` : ""}{nuevo && <span className="rounded-full bg-[var(--marca)] px-2 py-0.5 text-[9px] tracking-wide text-white">Nuevo</span>}</p>
          {t ? (
            <>
              <h2 className="mt-3 text-2xl sm:text-[32px] font-normal leading-tight tracking-tight break-words">{t.titulo}</h2>
              {t.paraQue && <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-secondary)]"><span className="font-medium text-[var(--text-primary)]">Para qué sirve: </span>{t.paraQue}</p>}
              {t.motivo && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><span className="text-amber-700">Requiere ajustes: </span>{t.motivo}</p>}
              {t.detalle && <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">{t.detalle}</p>}
              {vencida && <p className="mt-3 text-xs text-rose-600">Se pasó la fecha: si necesitás más tiempo, avisanos.</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => taskProps.onDone(t.id)} disabled={taskProps.sending === t.id || taskProps.readOnly} title={taskProps.readOnly ? 'Vista previa: el botón no hace nada' : 'Avisanos que lo terminaste: lo revisamos y te confirmamos'}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--marca)] px-6 py-3 text-[15px] font-medium text-[var(--marca-text)] disabled:opacity-60">
                  {taskProps.sending === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Terminé
                </button>
                {t.link && <a href={t.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-5 py-3 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]">Abrir <ArrowUpRight className="w-4 h-4" /></a>}
                {t.pideArchivos && (taskProps.uploadFor?.(t) || taskProps.uploadUrl) && <a href={taskProps.uploadFor?.(t) || taskProps.uploadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-5 py-3 text-[15px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]"><Paperclip className="w-4 h-4" />Subir a {carpetaLabel(t)}</a>}
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-3 text-2xl sm:text-[32px] font-light leading-tight tracking-tight">Nada de tu lado por ahora.</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-secondary)]">
                {enRevision ? `Estamos revisando ${enRevision === 1 ? 'lo que nos mandaste' : `${enRevision} cosas que nos mandaste`}. ` : ''}
                {trabajando ? `Estamos con: ${trabajando.replace(/^Preparando: /, 'preparando ')}.` : 'Te avisamos acá cuando haya algo para vos.'}
              </p>
            </>
          )}
        </div>
        {conReunion && (
          <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-5 sm:border-l sm:border-t-0 sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[var(--text-tertiary)]">Nos vemos</p>
            {reunion ? (
              <>
                <div className="mt-3 flex items-center gap-3">
                  <div className="w-14 shrink-0 overflow-hidden rounded-xl bg-white text-center text-[#191B20] border border-[var(--border-subtle)]">
                    <p className="bg-[var(--marca)] py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">{new Date(`${reunion.fecha}T12:00:00`).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</p>
                    <p className="py-1 text-2xl font-light">{new Date(`${reunion.fecha}T12:00:00`).getDate()}</p>
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="font-medium capitalize">{new Date(`${reunion.fecha}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long' })}</p>
                    <p className="text-[var(--text-secondary)]">{reunion.hora ? `${reunion.hora} hs · Argentina` : 'Horario a confirmar'}</p>
                  </div>
                </div>
                {reunion.objetivo && <p className="mt-3 text-sm text-[var(--text-primary)]"><span className="text-[var(--text-tertiary)]">Para qué: </span>{reunion.objetivo}</p>}
                {reunion.preparar && <p className="mt-1 text-sm text-[var(--text-primary)]"><span className="text-[var(--text-tertiary)]">Traé o pensá: </span>{reunion.preparar}</p>}
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">Con Juan{reunion.conCM ? ' y la community manager' : ''}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {link && <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#191B20] px-3 py-1.5 font-medium text-white"><Video className="w-3.5 h-3.5" />Entrar</a>}
                  <a href={calendarLink({ fecha: reunion.fecha, hora: reunion.hora }, `Reunión .CERO · ${estudio}`, link)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-[var(--text-primary)]"><CalendarPlus className="w-3.5 h-3.5" />A mi calendario</a>
                  {whatsapp && <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola Juan, soy de ${estudio}. ¿Podemos mover la reunión del ${formatDisplayDate(reunion.fecha, 'medium')}?`)}`} target="_blank" rel="noopener noreferrer" className="px-1 py-1.5 text-[var(--text-secondary)] underline underline-offset-4">Reprogramar</a>}
                </div>
              </>
            ) : (
              <>
                <span className="mt-3 inline-flex rounded-full border border-[var(--border-strong)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]">Por confirmar</span>
                {porConfirmar?.objetivo && <p className="mt-2 text-sm text-[var(--text-primary)]"><span className="text-[var(--text-tertiary)]">Para qué: </span>{porConfirmar.objetivo}</p>}
                <p className="mt-1 text-sm text-[var(--text-secondary)]">La fecha la acordamos con vos.</p>
              </>
            )}
            {acuerdo && <p className="mt-4 text-[11px] text-[var(--text-tertiary)]">Es la reunión {Math.min(acuerdo.hechas + 1, acuerdo.total)} de {acuerdo.total} del acuerdo</p>}
          </div>
        )}
      </div>
    </section>
  );
}

/** Línea de etapas del programa: las contratadas, con la actual marcada */
function EtapasLine({ etapas, actual }: { etapas: Etapa[]; actual: Etapa }) {
  if (etapas.length < 2) return null;
  const idx = etapas.indexOf(actual);
  return (
    <ol className="mt-6 flex items-center gap-1.5 text-xs" aria-label="Etapas del programa">
      {etapas.map((e, i) => (
        <React.Fragment key={e}>
          {i > 0 && <span aria-hidden className={`h-px flex-1 ${i <= idx ? 'bg-[var(--marca)]' : 'bg-[var(--border-strong)]'}`} />}
          <li className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${e === actual ? 'bg-[var(--marca)] text-[var(--marca-text)] font-medium' : i < idx ? 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]' : 'border border-dashed border-[var(--border-strong)] text-[var(--text-tertiary)]'}`} aria-current={e === actual ? 'step' : undefined}>
            {i < idx && <Check className="w-3 h-3" />}{ETAPAS.find((x) => x.id === e)!.label}
          </li>
        </React.Fragment>
      ))}
    </ol>
  );
}

/** TU MES: lo hecho y aprobado en el mes, juntando los reportes publicados */
function TuMes({ reportes }: { reportes: NonNullable<PafPortalDoc['reportes']> }) {
  const mes = reportes[0].hasta.slice(0, 7);
  const delMes = reportes.filter((r) => r.hasta.slice(0, 7) === mes);
  const lineas = (k: 'hicimos' | 'aprobaste') => [...new Set(delMes.flatMap((r) => r[k].split('\n').map((l) => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean)))];
  const hicimos = lineas('hicimos');
  const aprobaste = lineas('aprobaste');
  const viene = reportes[0].viene.split('\n').map((l) => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
  const nombre = new Date(`${mes}-15T12:00:00`).toLocaleDateString('es-AR', { month: 'long' });
  const col = (titulo: string, items: string[]) => items.length > 0 && (
    <div>
      <p className="text-xs font-medium text-[var(--text-tertiary)]">{titulo}</p>
      <ul className="mt-1.5 space-y-1">{items.slice(0, 6).map((x) => <li key={x} className="flex gap-2 text-sm text-[var(--text-primary)]"><Check className="mt-0.5 w-3.5 h-3.5 shrink-0 text-[var(--marca)]" />{x}</li>)}</ul>
    </div>
  );
  return (
    <Card className="p-5 sm:p-6">
      <Eyebrow>Tu mes · <span className="capitalize">{nombre}</span></Eyebrow>
      <div className="mt-4 grid gap-5 sm:grid-cols-3">
        {col('Lo que hicimos', hicimos)}
        {col('Lo que aprobaste', aprobaste)}
        {col('Lo que viene', viene)}
      </div>
    </Card>
  );
}

/** Navegación de abajo en el celular, como una app */
function BottomNav({ tabs, tab, onChange }: { tabs: { id: Tab; label: string; count?: number }[]; tab: Tab; onChange: (t: Tab) => void }) {
  const ICON: Record<Tab, React.ElementType> = { inicio: Home, recorrido: Route, tareas: ListChecks, entregas: Package, archivos: Folder };
  return (
    <nav className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-subtle)] bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]" aria-label="Secciones">
      <ul className="flex">
        {tabs.map((x) => {
          const Icon = ICON[x.id];
          const on = tab === x.id;
          return (
            <li key={x.id} className="flex-1">
              <button type="button" onClick={() => onChange(x.id)} aria-current={on ? 'page' : undefined} className={`relative flex w-full flex-col items-center gap-0.5 py-2.5 text-[10px] ${on ? 'text-[var(--marca)] font-semibold' : 'text-[var(--text-tertiary)]'}`}>
                <Icon className="w-5 h-5" />{x.label.replace('Mi recorrido', 'Recorrido')}
                {!!x.count && <span className="absolute right-[calc(50%-18px)] top-1.5 min-w-[16px] rounded-full bg-[var(--marca)] px-1 text-[9px] leading-4 text-white">{x.count}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
