import React, { useEffect, useLayoutEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ArrowRight, ArrowUpRight, Building2, CalendarPlus, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Folder, Sparkles, Users, Home, LayoutList, ListChecks, Loader2, MessageCircle, Newspaper, Paperclip, Video,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { EmptyState, SegmentedControl } from '../ui';
import { auth } from '../firebaseAuth';
import { isAllowedUser, signInWithGoogle, signOutUser } from '../utils/authAccess';
import { formatDisplayDate } from '../utils/projectTimeline';
import { AccessIcon } from '../components/AccessIcon';
import { ETAPAS, type Etapa } from '../portal/presencia';
import { MATERIALES, type MaterialKey, PAF_DELIVERY_STATE_LABEL, PAF_RESPONSABLE_LABEL, hitoInfoDe, hitosDe, seccionesVisibles, type Recorrido } from '../portal/model';
import { PAF_PORTAL_LINK_KEYS, PAF_PORTAL_LINK_LABEL, accessHost, accessesFromEnlaces, calendarLink, isOverdue, portalItemKeys, type PafAviso, type PafPortalDoc, type PafPortalLinkKey } from '../portal/model';
import { Festejo, LoUltimo, saludoDelMomento, useFestejo } from './portal/PortalUltimo';
import { ArranqueCreando, ArranqueForm } from './portal/PortalArranque';
import { PASO_ESTADO_LABEL, armarPasos, pasosPorHito, type PasoEstado, type PortalPaso } from '../portal/pasos';
import { sendTaskDone, sendVisita, subscribeAvisos, subscribeMyPafPortals, subscribePafPortal } from '../portal/store';

/**
 * /portal: el estudio entra con su cuenta de Google (el mismo correo con el que se
 * compartió su carpeta) y ve solo su paf_portal. Las reglas de Firestore hacen el control.
 * Usa los colores y componentes del CRM (claro u oscuro según el dispositivo).
 * En desarrollo, /portal?demo muestra un ejemplo sin login para revisar el diseño.
 */

type Tab = 'inicio' | 'pasos' | 'novedades' | 'archivos';
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
    { id: 'a2', texto: 'Te grabé 3 minutos contándote cómo quedó la propuesta de foco y qué mirar primero.', link: 'https://www.loom.com/', fecha: '2026-11-09' },
    { id: 'a3', texto: 'Esta semana cerramos el diagnóstico y ya estamos armando las primeras publicaciones con tus fotos.', fecha: '2026-11-07' },
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
    { id: 'd1', titulo: 'Completar el formulario de arranque', estado: 'aprobada', aprobadaEl: '2026-10-28', paso: 'arranque' },
    { id: 'd2', titulo: 'Subir 10 fotos de obras terminadas', paraQue: 'Con esto armamos las primeras publicaciones de tu portfolio.', detalle: 'Las de mejor calidad que tengas, sin editar.', link: 'https://drive.google.com/', fecha: '2026-11-06', estado: 'habilitada', prioritaria: true },
    { id: 'd3', titulo: 'Elegir 3 proyectos que te representen', detalle: 'Los que te gustaría hacer más seguido.', fecha: '2026-11-01', estado: 'habilitada', motivo: 'Sumá uno de vivienda, así comparamos.', paso: 'cliente_ideal' },
    { id: 'd4', titulo: 'Completar el Excel de cliente ideal', estado: 'enviada', paso: 'cliente_ideal' },
  ],
  tareasHabilitadas: ['d2', 'd3'],
  pasos: [
    { id: 'arranque', titulo: 'Arranque', objetivo: 'Ordenar todo para empezar: accesos, materiales y reunión inicial.', hito: 1 },
    { id: 'cliente_ideal', titulo: 'Cliente ideal, nicho y oferta', objetivo: 'Definir a quién le hablamos y qué proyectos queremos atraer.', hito: 2 },
  ],
  entregas: [
    { id: 'e1', titulo: 'Diagnóstico inicial del estudio', fecha: '2026-10-30', enlace: 'https://drive.google.com/', paso: 'arranque' },
    { id: 'e2', paso: 'cliente_ideal', titulo: 'Devolución del kit de cliente ideal', version: 'v2', fecha: '2026-11-04', enlace: 'https://drive.google.com/', estado: 'en_revision', decision: 'si este foco representa a tu estudio', hasta: '2026-11-07', canal: 'mail' },
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
  const entregas = p.entregas || [];
  // Las cartas: cada una junta lo que le pedimos y lo que le devolvemos (Juan decide cuál va con cuál)
  const cartas = armarPasos({ tareas: ver.tareas || ver.proximaAccion ? tareas : [], entregas: ver.entregas ? entregas : [], pasos: p.pasos }, avisada);
  const enCurso = cartas.filter((c) => c.estado !== 'listo');
  const cerradas = cartas.filter((c) => c.estado === 'listo');
  // Lo que le toca a él (hacer o revisar): en Inicio va de a una
  const tuyas = enCurso.filter((c) => c.estado === 'te_toca' || c.estado === 'revisar');
  const nuestras = enCurso.filter((c) => c.estado === 'nosotros');
  const [ahoraI, setAhoraI] = useState(0);
  const idx = Math.min(ahoraI, Math.max(0, tuyas.length - 1));
  const ahora = tuyas[idx];
  // Accesos libres; los portales publicados antes traen los 5 enlaces fijos
  const accesos = p.accesos ?? accessesFromEnlaces(p.enlaces || {});
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
  // Atajos de Inicio: solo lo que este cliente tiene a la vista
  const carpetaUrl = p.enlaces?.carpeta || accesos.find((a) => a.nombre === 'Tu carpeta')?.url;
  const atajos: { key: string; label: string; hint: string; icon: React.ElementType; url?: string }[] = [
    ...(ver.materiales ? materiales.map((m) => ({ key: `m-${m.id}`, label: m.label, hint: 'Subí acá', icon: MATERIAL_ICON[m.id], url: p.materiales![m.id] })) : []),
    ...(ver.contenido && p.gestionContenido ? [{ key: 'contenido', label: 'Contenido', hint: 'Ver y aprobar', icon: LayoutList, url: p.gestionContenido }] : []),
    ...(ver.accesos && carpetaUrl ? [{ key: 'carpeta', label: 'Tu carpeta', hint: 'Todo en Drive', icon: Folder, url: carpetaUrl }] : []),
    ...(ver.accesos && accesos.length > 1 ? [{ key: 'todo', label: 'Todos tus enlaces', hint: `${accesos.length} accesos`, icon: Paperclip }] : []),
  ];
  const isNew = useNewItems(p, !readOnly && !demo);
  // Hito cerrado desde la última vez que entró: se festeja una vez (en el ejemplo, siempre)
  const [festejo, cerrarFestejo] = useFestejo(p.clienteId, etapa, hechos, !readOnly && !embedded, !!demo);
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

  const taskProps: TaskProps = {
    today: new Date().toLocaleDateString('en-CA'),
    uploadUrl: p.materiales?.proyectos || p.enlaces?.materiales || p.enlaces?.carpeta,
    // Cada tarea sube a su subcarpeta de Materiales (Proyectos, Equipo y marca, Registro de obra…)
    uploadFor: (t: PortalTask) => p.materiales?.[t.carpeta || 'proyectos'] || p.enlaces?.materiales || (p.accesos || []).find((a) => a.nombre === 'Materiales')?.url || p.enlaces?.carpeta,
    sending, readOnly: !!readOnly, onDone: done, avisada,
  };
  const verRecorrido = ver.recorrido && mostrarAvance;
  const conReunion = ver.reuniones && !!(p.proximaReunion || p.reunionPorConfirmar);
  const hayNovedades = ver.novedades || ver.anuncios || ver.semana || ver.cicloCM || ver.tuMes || ver.reportes || ver.acuerdos || (p.numeros || []).length > 0;

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
    ...(cartas.length ? [{ id: 'pasos' as Tab, label: 'Paso a paso', count: tuyas.length || undefined }] : []),
    ...(hayNovedades ? [{ id: 'novedades' as Tab, label: 'Novedades' }] : []),
    ...(ver.accesos || ver.materiales || ver.contenido ? [{ id: 'archivos' as Tab, label: 'Archivos' }] : []),
  ];
  const irA = (t: Tab) => { setTab(t); window.scrollTo({ top: 0 }); };

  return (
    <Shell right={readOnly ? undefined : account} marca={p.marca} embedded={embedded}>
      {readOnly && !embedded && <p className="mb-6 rounded-[var(--radius-control)] border border-dashed border-[var(--border-strong)] px-4 py-2 text-xs text-[var(--text-secondary)]">Vista previa: así ve {p.estudio} su portal ahora. Es solo lectura: los botones no hacen nada.</p>}
      {demo && <p className="mb-6 rounded-[var(--radius-control)] border border-dashed border-[var(--border-strong)] px-4 py-2 text-xs text-[var(--text-secondary)]">Vista de ejemplo, solo en tu compu: así lo ve un estudio. Los datos son inventados.</p>}

      {/* Encabezado de marca: logo del estudio, saludo, la semana en una frase y el avance */}
      <header className="pt-1 sm:pt-4">
        <div className="flex items-center gap-4 sm:gap-5">
          {p.logo && (
            <span className="flex w-16 h-16 sm:w-20 sm:h-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white p-2 shadow-sm">
              <img src={p.logo} alt={`Logo de ${p.estudio}`} className="max-w-full max-h-full object-contain" />
            </span>
          )}
          <div className="min-w-0">
            <Eyebrow>Tu espacio con .CERO · {p.recorrido === 'web' ? 'Tu web' : ETAPAS.find((x) => x.id === etapa)!.label}</Eyebrow>
            <h1 className="mt-1.5 text-3xl sm:text-5xl font-light tracking-tight leading-[1.1] text-[var(--text-primary)] break-words">{saludoDelMomento()}, {p.estudio}.</h1>
          </div>
        </div>
        <p className="mt-5 max-w-2xl text-lg sm:text-2xl font-light leading-snug tracking-tight text-[var(--text-primary)]">
          {mostrarAvance && p.recorrido !== 'web' && HITOS[hito - 1] ? <>Ahora estamos en <span className="font-medium">{HITOS[hito - 1].charAt(0).toLowerCase() + HITOS[hito - 1].slice(1)}</span>. </> : null}
          {tuyas.length ? <>De tu lado hay {tuyas.length === 1 ? 'una sola cosa' : `${tuyas.length} cosas`}</> : <>De tu lado no hay nada por ahora</>}
          {ver.reuniones && p.proximaReunion ? <>, y nos vemos <span className="font-medium">{p.proximaReunion.fecha === taskProps.today ? 'hoy' : new Date(`${p.proximaReunion.fecha}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' })}{p.proximaReunion.hora ? ` a las ${p.proximaReunion.hora}` : ''}</span>.</> : '.'}
        </p>
        {/* La semana en una o dos líneas, como se la contaría Juan */}
        {ver.semana && p.resumenVisible && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-line line-clamp-3">{p.resumenVisible}</p>}
        {!readOnly && <button type="button" onClick={() => setShowWelcome(true)} className="mt-3 text-xs text-[var(--text-tertiary)] underline underline-offset-4 hover:text-[var(--text-primary)]">Ver la guía de cómo usar tu portal</button>}
        {mostrarAvance && p.recorrido !== 'web' && <EtapasLine etapas={p.etapas || ['presencia']} actual={etapa} />}
        {mostrarAvance && (
          <button type="button" onClick={() => cartas.length > 0 && irA('pasos')} className="mt-5 w-full text-left group">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-[var(--text-secondary)]">
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span>Ahora:</span>
                <span className="font-serif italic text-base text-[var(--text-primary)]">{HITOS[hito - 1]}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]">
                {hechos.length} de {HITOS.length} hitos completados{cartas.length > 0 && <ArrowRight className="w-3.5 h-3.5" />}
              </span>
            </span>
            <HitosBar hito={hito} hechos={hechos} hitos={HITOS} />
          </button>
        )}
      </header>

      {festejo && HITOS[festejo - 1] && <div className="mt-8"><Festejo titulo={HITOS[festejo - 1]} hechos={hechos.length} total={HITOS.length} onClose={cerrarFestejo} /></div>}

      {/* Lo nuevo desde la última visita, en una línea: cada parte lleva a su lugar */}
      {!showWelcome && ver.novedades && <SinceLastVisit keys={portalItemKeys(p).filter(isNew)} onGo={(t) => irA(tabs.some((x) => x.id === t) ? t : 'inicio')} />}

      {showWelcome && <GuiaInicial onClose={closeWelcome} estudio={p.estudio} pendientes={tuyas.length} reunion={ver.reuniones ? p.proximaReunion : undefined} carpeta={carpetaUrl} bienvenida={p.bienvenida} hasWhatsapp={!!whatsapp} />}

      {/* Pestañas */}
      {tabs.length > 1 && (
        <>
          <nav className="hidden sm:block mt-10 -mx-4 px-4 overflow-x-auto no-scrollbar">
            <SegmentedControl<Tab> value={tab} onChange={setTab} options={tabs} />
          </nav>
          <BottomNav tabs={tabs} tab={tab} onChange={irA} />
        </>
      )}

      <main className="mt-6 sm:mt-8 animate-in fade-in duration-200" key={tab}>
        {tab === 'inicio' && (
          <div className="space-y-6 sm:space-y-8">
            {/* Lo que Juan fijó (la bienvenida, un aviso importante): arriba de todo, apenas entra */}
            {ver.anuncios && (p.anuncios || []).filter((a) => a.fijado).slice(0, 2).map((a) => (
              <section key={a.id} aria-label={a.titulo || 'Mensaje de .CERO'} className="rounded-[28px] border border-[var(--border-subtle)] bg-white p-5 shadow-sm sm:p-7">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.2em] text-[var(--marca)]">De .CERO para vos{isNew(`a:${a.id}`) && <NewBadge />}</p>
                {a.titulo && <h2 className="mt-2 text-2xl font-normal leading-tight tracking-tight text-[var(--text-primary)] sm:text-[28px]">{a.titulo}</h2>}
                <p className="mt-3 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-[var(--text-secondary)]">{a.texto}</p>
                {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]">Abrir <ArrowUpRight className="h-4 w-4" /></a>}
              </section>
            ))}

            {/* Alta sin Tally: lo primero es completar sus datos (con eso se crean sus carpetas) */}
            {p.arranque?.pendiente && <ArranqueForm clienteId={p.clienteId} estudio={p.estudio} email={email} readOnly={readOnly || demo} />}
            {p.arranque?.creando && <ArranqueCreando />}

            {/* AHORA: una sola carta (lo que le toca y, en la misma carta, nuestra devolución) y la reunión */}
            {!p.arranque?.pendiente && <section id="hoy" aria-label="Lo de ahora" className="scroll-mt-6 overflow-hidden rounded-[28px] border border-[var(--border-subtle)] bg-white text-[var(--text-primary)] shadow-sm">
              <div className={`grid ${conReunion ? 'sm:grid-cols-[1.45fr_1fr]' : ''}`}>
                <div className="p-5 sm:p-7">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[var(--marca)]">Ahora</p>
                    {tuyas.length > 1 && (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                        <button type="button" aria-label="Anterior" disabled={idx === 0} onClick={() => setAhoraI(idx - 1)} className="rounded-full p-1.5 hover:bg-[var(--bg-surface-muted)] disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="tabular-nums">{idx + 1} de {tuyas.length}</span>
                        <button type="button" aria-label="Siguiente" disabled={idx === tuyas.length - 1} onClick={() => setAhoraI(idx + 1)} className="rounded-full p-1.5 hover:bg-[var(--bg-surface-muted)] disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                      </span>
                    )}
                  </div>
                  {ahora ? (
                    <>
                      <div className="mt-3" key={ahora.id}><PasoCuerpo c={ahora} grande isNew={isNew} {...taskProps} /></div>
                      {tuyas[idx + 1] && (
                        <p className="mt-5 text-sm text-[var(--text-secondary)]">
                          Después de esta te {tuyas.length - idx - 1 === 1 ? 'queda una más' : `quedan ${tuyas.length - idx - 1} más`}:{' '}
                          <button type="button" onClick={() => setAhoraI(idx + 1)} className="text-[var(--text-primary)] underline underline-offset-4">{tuyas[idx + 1].titulo}</button>
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <h2 className="mt-3 text-2xl sm:text-[32px] font-light leading-tight tracking-tight">Nada de tu lado por ahora.</h2>
                      <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-secondary)]">
                        {nuestras.length ? `Lo tenemos nosotros: ${nuestras.slice(0, 2).map((c) => c.titulo).join(' y ')}${nuestras.length > 2 ? ` y ${nuestras.length - 2} más` : ''}. ` : ''}
                        Te avisamos acá cuando haya algo para vos.
                      </p>
                    </>
                  )}
                </div>
                {conReunion && <ReunionBlock reunion={p.proximaReunion} porConfirmar={p.reunionPorConfirmar} acuerdo={p.reunionesAcuerdo} link={p.linkReunion} estudio={p.estudio} whatsapp={whatsapp} />}
              </div>
            </section>}
            {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}

            {/* Atajos: subir materiales, ver el contenido y abrir la carpeta sin buscar */}
            {atajos.length > 0 && (
              <section aria-label="Atajos">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--text-tertiary)]">Ir directo a</p>
                <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                  {atajos.map((a) => {
                    const inner = (
                      <>
                        <IconTile icon={a.icon} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium leading-tight text-[var(--text-primary)]">{a.label}</span>
                          <span className="mt-0.5 block text-xs leading-tight text-[var(--text-tertiary)]">{a.hint}</span>
                        </span>
                      </>
                    );
                    const cls = 'group flex h-full w-full items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-sm';
                    return (
                      <li key={a.key}>
                        {a.url
                          ? <a href={a.url} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                          : <button type="button" onClick={() => irA('archivos')} className={cls}>{inner}</button>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Lo que estamos haciendo nosotros: chico, para que sepa que avanza */}
            {ver.enMarcha && (p.enMarcha || []).length > 0 && (
              <section className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--text-secondary)]">Mientras tanto, nosotros</p>
                <ul className="mt-2 space-y-1.5">
                  {(p.enMarcha || []).map((x, i) => <li key={i} className="text-sm leading-relaxed text-[var(--text-primary)]">{x.texto}</li>)}
                </ul>
              </section>
            )}

            {/* Lo último que hablamos: para que no tenga que buscarlo en Novedades */}
            {reuniones[0] && (
              <section aria-label="Lo que hablamos" className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--text-tertiary)]">Lo que hablamos el {formatDisplayDate(reuniones[0].fecha, 'medium')}{isNew(`r:${reuniones[0].fecha}`) && <NewBadge className="ml-2" />}</p>
                <div className="border-l-2 border-[var(--marca)] pl-4"><MeetingSummary s={reuniones[0]} /></div>
              </section>
            )}

            {/* Tus números, chicos: el detalle sigue en Novedades */}
            {(p.numeros || []).length > 0 && (
              <section aria-label="Tus números">
                <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--text-tertiary)]">Tus números</p>
                <ul className="mt-2 flex flex-wrap gap-x-10 gap-y-3">
                  {(p.numeros || []).slice(0, 4).map((n, i) => (
                    <li key={i}>
                      <p className="text-3xl font-light tracking-tight tabular-nums text-[var(--text-primary)]">{n.valor}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{n.label}{n.fuente ? ` · ${n.fuente}` : ''}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* El resto, ordenado: un solo acceso al paso a paso */}
            {cartas.length > 0 && (
              <button type="button" onClick={() => irA('pasos')} className="card-swiss group flex w-full items-center gap-4 p-4 text-left transition hover:-translate-y-0.5">
                <IconTile icon={ListChecks} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--text-primary)]">Todo el paso a paso</span>
                  <span className="block text-xs text-[var(--text-tertiary)]">{enCurso.length} en curso · {cerradas.length} {cerradas.length === 1 ? 'cerrada' : 'cerradas'}</span>
                </span>
                <ArrowRight className="w-4 h-4 text-[var(--text-tertiary)] transition group-hover:translate-x-0.5 group-hover:text-[var(--text-primary)]" />
              </button>
            )}
          </div>
        )}

        {tab === 'pasos' && (
          <div className="space-y-10">
            <section>
              <SectionTitle title="En curso" hint="Cada carta junta lo que te pedimos y lo que te devolvemos. Cuando termines tu parte, tocá “Terminé”: lo revisamos y te confirmamos." />
              {enCurso.length ? (
                <ul className="space-y-3">
                  {enCurso.map((c, i) => <li key={c.id}><PasoPlegable c={c} abierto={i === 0} isNew={isNew} {...taskProps} /></li>)}
                </ul>
              ) : <EmptyState icon={<Check className="w-5 h-5" />} title="Nada en curso" description="Cuando arranquemos algo nuevo, aparece acá." />}
              {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
            </section>

            {cerradas.length > 0 && (
              <section>
                <SectionTitle title="Ya cerrado" hint={mostrarAvance && p.recorrido !== 'web' ? 'Lo que fuimos terminando juntos, por hito del programa.' : 'Lo que fuimos terminando juntos.'} />
                <div className="space-y-3">
                  {(mostrarAvance && p.recorrido !== 'web' ? pasosPorHito(cerradas, etapa) : [{ titulo: 'Todo lo cerrado', pasos: cerradas }]).map((g) => (
                    <details key={g.titulo} className="group card-swiss">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--text-primary)]"><Check className="w-4 h-4 shrink-0 text-emerald-600" />{g.titulo}</span>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--text-tertiary)]">{g.pasos.length} {g.pasos.length === 1 ? 'carta' : 'cartas'}<ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" /></span>
                      </summary>
                      <ul className="divide-y divide-[var(--border-divider)] border-t border-[var(--border-divider)] px-5">
                        {g.pasos.map((c) => <li key={c.id} className="py-4"><PasoCuerpo c={c} isNew={isNew} {...taskProps} /></li>)}
                      </ul>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {verRecorrido && (
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />Ver cómo es el programa, hito por hito
                </summary>
                <div className="mt-6"><Recorrido hito={hito} hechos={hechos} recorrido={p.recorrido} etapa={etapa} etapas={p.etapas || ['presencia']} /></div>
              </details>
            )}
          </div>
        )}

        {tab === 'novedades' && (
          <div className="space-y-6 sm:space-y-8">
            {/* La historia de lo que fue pasando (anuncios, entregas, reuniones) */}
            <LoUltimo portal={p} today={taskProps.today} isNew={isNew} />

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

            {ver.tuMes && reportes.length > 0 && <TuMes reportes={reportes} />}

            {reportes.length > 0 && (
              <section>
                <SectionTitle title="Reportes" hint="El resumen de cada semana." />
                <ul className="space-y-3">{reportes.map((r) => <li key={r.id}><ReportCard r={r} /></li>)}</ul>
              </section>
            )}

            {reuniones.length > 0 && (
              <section>
                <SectionTitle title="Lo que acordamos" hint="Acuerdos y próximos pasos de cada reunión." />
                <ul className="space-y-3">
                  {reuniones.map((s, i) => (
                    <li key={i}><Card className="p-5"><p className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">{formatDisplayDate(s.fecha, 'medium')}{isNew(`r:${s.fecha}`) && <NewBadge />}</p><MeetingSummary s={s} /></Card></li>
                  ))}
                </ul>
              </section>
            )}
          </div>
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
                      <a href={p.materiales![m.id]} target="_blank" rel="noopener noreferrer" className="card-swiss group flex h-full items-start gap-4 p-4 transition hover:-translate-y-0.5">
                        <IconTile icon={MATERIAL_ICON[m.id]} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">{m.label}<ArrowUpRight className="ml-auto w-4 h-4 shrink-0 text-[var(--text-tertiary)] transition group-hover:text-[var(--text-primary)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
                          <span className="mt-1 block text-xs leading-relaxed text-[var(--text-secondary)]">{m.pedido}</span>
                          <span className="mt-2 inline-block text-xs font-medium text-[var(--marca)]">Subir acá</span>
                        </span>
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

/** Cada material con su ícono, para reconocerlo de un vistazo */
const MATERIAL_ICON: Record<MaterialKey, React.ElementType> = {
  proyectos: Building2,
  equipo: Users,
  referencias: Sparkles,
  registro: Camera,
};

/** Cuadrado con ícono en el color de la marca del estudio */
function IconTile({ icon: Icon, fuerte = false }: { icon: React.ElementType; fuerte?: boolean }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
      style={fuerte ? { background: 'var(--marca)', color: 'var(--marca-text)' } : { background: 'color-mix(in srgb, var(--marca) 12%, transparent)', color: 'var(--marca)' }}
      aria-hidden
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
    </span>
  );
}

function DeliveryRow({ d, nuevo, sinTitulo }: { d: PafPortalDoc['entregas'][number]; nuevo?: boolean; sinTitulo?: boolean }) {
  const hasta = d.hasta ? formatDisplayDate(d.hasta, 'medium') : '';
  return (
    <div className="py-4">
      <div className="flex items-start gap-4">
        <span className="min-w-0 flex-1">
          {!sinTitulo && (
            <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--text-primary)] break-words">
              {d.titulo}{d.version && <span className="text-xs font-normal text-[var(--text-tertiary)]">{d.version}</span>}{nuevo && <NewBadge />}
            </span>
          )}
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-[var(--text-tertiary)]">
            {sinTitulo && d.version && <span>{d.version}</span>}
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
    { count: n('a:'), one: '1 anuncio', many: 'anuncios', tab: 'novedades' as Tab },
    { count: n('t:'), one: '1 tarea nueva', many: 'tareas nuevas', tab: 'pasos' as Tab },
    { count: n('e:'), one: '1 entrega', many: 'entregas', tab: 'pasos' as Tab },
    { count: n('l:'), one: '1 acceso', many: 'accesos', tab: 'archivos' as Tab },
    { count: n('r:'), one: '1 resumen de reunión', many: 'resúmenes de reunión', tab: 'novedades' as Tab },
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
      titulo: 'Una cosa a la vez',
      texto: <>En <b>Inicio</b> ves solo lo de ahora: una carta con lo que te toca y, en la misma carta, lo que te devolvemos. Si hay más de una, pasás con las flechas.{pendientes ? <> Ahora tenés <b>{pendientes === 1 ? '1 cosa' : `${pendientes} cosas`}</b> de tu lado.</> : <> Ahora no tenés nada de tu lado: te avisamos cuando haya algo.</>}</>,
    },
    {
      titulo: 'Todo ordenado, paso a paso',
      texto: <>Cada tarea viene con <b>para qué sirve</b> y cómo hacerla. Al terminarla tocá <b>Terminé</b>: nos llega el aviso y te confirmamos. En <b>Paso a paso</b> queda todo: lo que está en curso arriba y lo cerrado guardado por etapa. Lo que no aparece, no hace falta que lo hagas.</>,
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

type TaskProps = {
  today: string; uploadUrl?: string; uploadFor?: (t: PortalTask) => string | undefined;
  sending: string | null; readOnly: boolean; onDone: (id: string) => void; avisada: (t: PortalTask) => boolean;
};

const ESTADO_CHIP: Record<PasoEstado, string> = {
  te_toca: 'bg-[var(--marca)] text-[var(--marca-text)]',
  revisar: 'bg-amber-500 text-white',
  nosotros: 'bg-sky-100 text-sky-800',
  listo: 'bg-emerald-100 text-emerald-800',
};

function EstadoChip({ e }: { e: PasoEstado }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ESTADO_CHIP[e]}`}>{PASO_ESTADO_LABEL[e]}</span>;
}

/**
 * Una carta: lo que le pedimos (con "Terminé") y lo que le devolvemos, juntos.
 * Si la carta es de una sola cosa, el título ya es esa tarea o esa entrega.
 */
function PasoCuerpo({ c, grande, sinEncabezado, isNew, ...tp }: { c: PortalPaso; grande?: boolean; sinEncabezado?: boolean; isNew: (k: string) => boolean } & TaskProps) {
  const soloTarea = c.solo && c.tareas.length === 1 && !c.entregas.length;
  const soloEntrega = c.solo && c.entregas.length === 1 && !c.tareas.length;
  const primeraPendiente = c.tareas.find((t) => t.estado === 'habilitada' && !tp.avisada(t) && (t.responsable || 'estudio') === 'estudio')
    || c.tareas.find((t) => t.estado === 'habilitada' && !tp.avisada(t));
  const nuevo = c.tareas.some((t) => isNew(`t:${t.id}:${t.habilitadaEn || ''}`)) || c.entregas.some((e) => isNew(`e:${e.id}`));
  const tit = 'text-[11px] font-semibold uppercase tracking-[.16em] text-[var(--text-tertiary)]';
  return (
    <div>
      {!sinEncabezado && (
        <>
          <p className="flex flex-wrap items-center gap-2"><EstadoChip e={c.estado} />{nuevo && <NewBadge />}</p>
          <h3 className={`mt-2 font-normal leading-tight tracking-tight text-[var(--text-primary)] break-words ${grande ? 'text-2xl sm:text-[30px]' : 'text-[17px]'}`}>{c.titulo}</h3>
        </>
      )}
      {c.objetivo && <p className={`${sinEncabezado ? '' : 'mt-1.5'} text-sm leading-relaxed text-[var(--text-secondary)]`}>{c.objetivo}</p>}
      {c.tareas.length > 0 && (
        <div className={soloTarea ? 'mt-2' : 'mt-5'}>
          {!soloTarea && <p className={tit}>Tu parte</p>}
          <ul className={`${soloTarea ? '' : 'mt-3'} space-y-4`}>
            {c.tareas.map((t) => {
              // Una cosa a la vez también adentro de la carta: abierta la primera pendiente, las demás en una línea
              const pendiente = t.estado === 'habilitada' && !tp.avisada(t);
              const plegada = pendiente && !soloTarea && t.id !== primeraPendiente?.id;
              return (
                <li key={t.id}>
                  {plegada ? (
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-start gap-3">
                        <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-[var(--marca)]" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-medium text-[var(--text-primary)] break-words">{t.titulo}</span>
                          {t.fecha && <span className="block text-xs text-[var(--text-tertiary)]">Para el {formatDisplayDate(t.fecha, 'medium')}</span>}
                        </span>
                        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-[var(--text-tertiary)] group-open:hidden">Ver<ChevronDown className="h-3.5 w-3.5" /></span>
                      </summary>
                      <div className="mt-2 pl-8"><TaskRow t={t} sinTitulo grande={grande} {...tp} /></div>
                    </details>
                  ) : <TaskRow t={t} sinTitulo={soloTarea} grande={grande} {...tp} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {c.entregas.length > 0 && (
        <div className={c.tareas.length ? 'mt-5 border-t border-[var(--border-divider)] pt-4' : soloEntrega ? '' : 'mt-5'}>
          {!soloEntrega && <p className={tit}>{c.entregas.length === 1 ? 'Nuestra devolución' : 'Nuestras devoluciones'}</p>}
          <div className="divide-y divide-[var(--border-divider)]">
            {c.entregas.map((d) => <DeliveryRow key={d.id} d={d} sinTitulo={soloEntrega} nuevo={!soloEntrega && isNew(`e:${d.id}`)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/** Una tarea dentro de su carta: lo pendiente con su "para qué" y botones; lo hecho, en una línea */
function TaskRow({ t, sinTitulo, grande, today, uploadUrl, uploadFor, sending, readOnly, onDone, avisada }: { t: PortalTask; sinTitulo?: boolean; grande?: boolean } & TaskProps) {
  const delEstudio = (t.responsable || 'estudio') === 'estudio';
  const pendiente = t.estado === 'habilitada' && !avisada(t);
  const overdue = pendiente && isOverdue(t, today);
  const subir = t.pideArchivos ? uploadFor?.(t) || uploadUrl : undefined;
  const estado = t.estado === 'aprobada'
    ? <span className="text-emerald-700">Aprobada{t.aprobadaEl ? ` el ${formatDisplayDate(t.aprobadaEl, 'short')}` : ''}</span>
    : !pendiente ? <span className="text-sky-700">Recibida · la estamos revisando</span>
      : t.fecha ? <span className={overdue ? 'text-rose-600' : ''}>{overdue ? 'Venció el ' : 'Para el '}{formatDisplayDate(t.fecha, 'medium')}</span> : null;
  const btn = grande ? 'px-5 py-2.5 text-[15px]' : 'px-4 py-2 text-sm';
  return (
    <div className="flex items-start gap-3">
      {!sinTitulo && (
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${t.estado === 'aprobada' ? 'bg-emerald-500 text-white' : !pendiente ? 'bg-sky-500 text-white' : 'border-2 border-[var(--marca)]'}`} aria-hidden>
          {!pendiente && <Check className="w-3 h-3" />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {!sinTitulo && <p className={`font-medium break-words ${pendiente ? 'text-[15px] text-[var(--text-primary)]' : 'text-sm text-[var(--text-secondary)]'}`}>{t.titulo}</p>}
        {(estado || !delEstudio) && (
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-[var(--text-tertiary)]">
            {!delEstudio && <span>Lo hace {PAF_RESPONSABLE_LABEL[t.responsable!]}</span>}{estado}
          </p>
        )}
        {pendiente && (
          <>
            {t.paraQue && <p className="mt-2 text-sm leading-relaxed text-[var(--text-primary)]"><span className="text-[var(--text-tertiary)]">Para qué sirve: </span>{t.paraQue}</p>}
            {t.motivo && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><span className="text-amber-700">Requiere ajustes: </span>{t.motivo}</p>}
            {t.detalle && <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">{t.detalle}</p>}
            {overdue && grande && <p className="mt-2 text-xs text-rose-600">Se pasó la fecha: si necesitás más tiempo, avisanos.</p>}
            {(delEstudio || t.link || subir) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {delEstudio && (
                  <button type="button" onClick={() => onDone(t.id)} disabled={sending === t.id || readOnly} title={readOnly ? 'Vista previa: el botón no hace nada' : 'Avisanos que lo terminaste: lo revisamos y te confirmamos'}
                    className={`inline-flex items-center gap-1.5 rounded-full bg-[var(--marca)] font-medium text-[var(--marca-text)] disabled:opacity-60 ${btn}`}>
                    {sending === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Terminé
                  </button>
                )}
                {t.link && <a href={t.link} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] ${btn}`}>Abrir <ArrowUpRight className="w-4 h-4" /></a>}
                {subir && <a href={subir} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] ${btn}`}><Paperclip className="w-4 h-4" />Subir a {carpetaLabel(t)}</a>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Carta plegada en "Paso a paso": se ve el estado y el título; se abre para hacer */
function PasoPlegable({ c, abierto, ...rest }: { c: PortalPaso; abierto?: boolean; isNew: (k: string) => boolean } & TaskProps) {
  const resumen = [
    c.tareas.length ? `${c.tareas.length} ${c.tareas.length === 1 ? 'tarea' : 'tareas'}` : '',
    c.entregas.length ? `${c.entregas.length} ${c.entregas.length === 1 ? 'devolución' : 'devoluciones'}` : '',
  ].filter(Boolean).join(' · ');
  const tuya = c.estado === 'te_toca' || c.estado === 'revisar';
  return (
    <details open={abierto} className={`group card-swiss ${tuya ? 'border-[var(--marca)]' : ''}`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2"><EstadoChip e={c.estado} />{!c.solo && <span className="text-xs text-[var(--text-tertiary)]">{resumen}</span>}</span>
          <span className="mt-1.5 block text-[15px] font-medium text-[var(--text-primary)] break-words">{c.titulo}</span>
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-[var(--text-tertiary)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-[var(--border-divider)] px-5 pb-5 pt-4"><PasoCuerpo c={c} sinEncabezado {...rest} /></div>
    </details>
  );
}

/** La próxima reunión (o la que está por confirmar), al lado de la carta de ahora */
function ReunionBlock({ reunion, porConfirmar, acuerdo, link, estudio, whatsapp }: {
  reunion: PafPortalDoc['proximaReunion']; porConfirmar?: PafPortalDoc['reunionPorConfirmar']; acuerdo?: PafPortalDoc['reunionesAcuerdo'];
  link?: string | null; estudio: string; whatsapp: string;
}) {
  return (
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
  const ICON: Record<Tab, React.ElementType> = { inicio: Home, pasos: ListChecks, novedades: Newspaper, archivos: Folder };
  return (
    <nav className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-subtle)] bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]" aria-label="Secciones">
      <ul className="flex">
        {tabs.map((x) => {
          const Icon = ICON[x.id];
          const on = tab === x.id;
          return (
            <li key={x.id} className="flex-1">
              <button type="button" onClick={() => onChange(x.id)} aria-current={on ? 'page' : undefined} className={`relative flex w-full flex-col items-center gap-0.5 py-2.5 text-[10px] ${on ? 'text-[var(--marca)] font-semibold' : 'text-[var(--text-tertiary)]'}`}>
                <Icon className="w-5 h-5" />{x.label}
                {!!x.count && <span className="absolute right-[calc(50%-18px)] top-1.5 min-w-[16px] rounded-full bg-[var(--marca)] px-1 text-[9px] leading-4 text-white">{x.count}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
