import React, { useEffect, useLayoutEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ArrowRight, ArrowUpRight, CalendarPlus, Check, ChevronDown, Folder, LayoutList, Loader2, MessageCircle, Package, Paperclip, Video,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { EmptyState, SegmentedControl } from '../ui';
import { auth } from '../firebaseAuth';
import { isAllowedUser, signInWithGoogle, signOutUser } from '../utils/authAccess';
import { formatDisplayDate } from '../utils/projectTimeline';
import { AccessIcon } from '../components/AccessIcon';
import { MATERIALES, PAF_DELIVERY_STATE_LABEL, PAF_RESPONSABLE_LABEL, PRESENCIA_HITO_INFO, seccionesVisibles } from '../portal/model';
import { PAF_PORTAL_LINK_KEYS, PAF_PORTAL_LINK_LABEL, PRESENCIA_HITOS, accessHost, accessesFromEnlaces, calendarLink, isOverdue, portalItemKeys, type PafAviso, type PafPortalDoc, type PafPortalLinkKey } from '../portal/model';
import { sendTaskDone, subscribeAvisos, subscribeMyPafPortals, subscribePafPortal } from '../portal/store';

/**
 * /portal: el estudio entra con su cuenta de Google (el mismo correo con el que se
 * compartió su carpeta) y ve solo su paf_portal. Las reglas de Firestore hacen el control.
 * Usa los colores y componentes del CRM (claro u oscuro según el dispositivo).
 * En desarrollo, /portal?demo muestra un ejemplo sin login para revisar el diseño.
 */

type Tab = 'inicio' | 'recorrido' | 'tareas' | 'entregas' | 'archivos';
type PortalTask = PafPortalDoc['tareas'][number];

const LINK_HINT: Record<PafPortalLinkKey, string> = {
  carpeta: 'Todo lo del programa',
  materiales: 'Fotos, planos y lo que nos compartís',
  resultados: 'Métricas y avances',
  web: 'Tu sitio',
  asana: 'Qué se publica y cuándo',
};

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
  secciones: { novedades: true, proximaAccion: true, recorrido: true, anuncios: true, semana: true, tareas: true, reuniones: true, reunionesAcuerdo: true, acuerdos: true, entregas: true, reportes: true, materiales: true, contenido: true, cicloCM: true, accesos: true },
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
  proximaReunion: { fecha: '2026-11-10', hora: '10:30', objetivo: 'Revisar la propuesta de mensaje', preparar: 'Tus 3 proyectos favoritos', conCM: true },
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
  const entregas = p.entregas || [];
  // Accesos libres; los portales publicados antes traen los 5 enlaces fijos
  const accesos = p.accesos ?? accessesFromEnlaces(p.enlaces || {});
  const anuncios = p.anuncios || [];
  const mostrarAvance = p.mostrarAvance !== false;
  const hito = Math.min(PRESENCIA_HITOS.length, Math.max(1, p.hitoVisible || 1));
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
            <Eyebrow>Tu espacio con .CERO · Presencia</Eyebrow>
            <h1 className="mt-1.5 text-3xl sm:text-5xl font-light tracking-tight leading-[1.1] text-[var(--text-primary)] break-words">Hola, {p.estudio}</h1>
          </div>
        </div>
        {mostrarAvance && (
          <button type="button" onClick={() => verRecorrido && setTab('recorrido')} className="mt-6 w-full text-left group">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-[var(--text-secondary)]">
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span>Ahora:</span>
                <span className="font-serif italic text-base text-[var(--text-primary)]">{PRESENCIA_HITOS[hito - 1]}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]">
                {hechos.length} de {PRESENCIA_HITOS.length} hitos completados{verRecorrido && <ArrowRight className="w-3.5 h-3.5" />}
              </span>
            </span>
            <HitosBar hito={hito} hechos={hechos} />
          </button>
        )}
      </header>

      {/* Lo nuevo desde la última visita, en una línea: cada parte lleva a su lugar */}
      {!showWelcome && ver.novedades && <SinceLastVisit keys={portalItemKeys(p).filter(isNew)} onGo={(t) => setTab(t)} />}

      {showWelcome && <Welcome onClose={closeWelcome} hasWhatsapp={!!whatsapp} bienvenida={p.bienvenida} />}

      {/* Pestañas */}
      {tabs.length > 1 && (
        <nav className="mt-8 sm:mt-10 -mx-4 px-4 overflow-x-auto no-scrollbar">
          <SegmentedControl<Tab> value={tab} onChange={setTab} options={tabs} />
        </nav>
      )}

      <main className="mt-8 animate-in fade-in duration-200" key={tab}>
        {tab === 'inicio' && (
          <div className="space-y-8">
            {/* Tu próxima acción y la reunión: lo primero, también en el celular */}
            {(principal || (ver.proximaAccion && !pendientes.length && enRevision.length > 0)) && (
              principal ? <NextAction t={principal} {...taskProps} nuevo={isNew(`t:${principal.id}:${principal.habilitadaEn || ''}`)} /> : (
                <Card className="p-5 sm:p-6"><Eyebrow>Tu próxima acción</Eyebrow><p className="mt-3 text-[15px] text-[var(--text-primary)]">Nada pendiente de tu lado. Estamos revisando lo que nos mandaste.</p></Card>
              )
            )}
            {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}

            {ver.reuniones && (
              <Card className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <Eyebrow>Próxima reunión</Eyebrow>
                  {p.reunionesAcuerdo && <span className="text-xs text-[var(--text-tertiary)]">Llevamos {p.reunionesAcuerdo.hechas} de {p.reunionesAcuerdo.total} reuniones del acuerdo</span>}
                </div>
                {p.proximaReunion ? <MeetingDate {...p.proximaReunion} link={p.linkReunion} estudio={p.estudio} whatsapp={whatsapp} />
                  : p.reunionPorConfirmar ? (
                    <div className="mt-3">
                      <span className="inline-flex rounded-full border border-[var(--border-strong)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]">Por confirmar</span>
                      {p.reunionPorConfirmar.objetivo && <p className="mt-2 text-sm text-[var(--text-primary)]"><span className="text-[var(--text-tertiary)]">Objetivo: </span>{p.reunionPorConfirmar.objetivo}</p>}
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">La fecha la acordamos con vos.</p>
                    </div>
                  ) : <p className="mt-3 text-sm text-[var(--text-secondary)]">La vas a ver acá cuando la coordinemos.</p>}
              </Card>
            )}

            {/* Anuncios de Juan */}
            {anuncios.length > 0 && (
              <ul className="space-y-3" aria-label="Anuncios">
                {anuncios.map((a) => (
                  <li key={a.id}>
                    <Card className={`p-5 ${a.fijado ? 'border-l-[3px] border-l-[var(--marca)]' : ''}`}>
                      {isNew(`a:${a.id}`) && <NewBadge className="mb-2" />}
                      {a.titulo && <p className="text-[15px] font-medium text-[var(--text-primary)]">{a.titulo}</p>}
                      <p className={`${a.titulo ? 'mt-1.5' : ''} text-[15px] leading-relaxed text-[var(--text-primary)] whitespace-pre-line`}>{a.texto}</p>
                      {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] underline underline-offset-4">Abrir <ArrowUpRight className="w-3.5 h-3.5" /></a>}
                    </Card>
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

            {/* Esta semana: foco y objetivos (si no hay nada cargado, no se muestra) */}
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

            {ver.tareas && resto.length > 0 && (
              <section>
                <SectionTitle title={principal ? 'También te toca' : 'Lo que necesitamos de vos'} hint="Cuando termines, tocá “Terminé”. Lo revisamos y te confirmamos." />
                <ul className="space-y-3">
                  {resto.slice(0, 3).map((t) => <li key={t.id}><PendingTask t={t} {...taskProps} nuevo={isNew(`t:${t.id}:${t.habilitadaEn || ''}`)} /></li>)}
                </ul>
                {resto.length > 3 && <button type="button" onClick={() => setTab('tareas')} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">Ver las {pendientes.length} tareas <ArrowRight className="w-4 h-4" /></button>}
              </section>
            )}
            {ver.tareas && !pendientes.length && !enRevision.length && !principal && (
              <p className="text-sm text-[var(--text-secondary)]">Nada pendiente de tu lado. Te avisamos cuando haya algo nuevo.</p>
            )}

            {(ver.entregas && entregas.length > 0) && (
              <Card className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <Eyebrow>Última entrega</Eyebrow>
                  {entregas.length > 1 && <button type="button" onClick={() => setTab('entregas')} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Ver todas</button>}
                </div>
                <DeliveryRow d={latest(entregas)} nuevo={isNew(`e:${latest(entregas).id}`)} />
              </Card>
            )}

            {reuniones.length > 0 && (
              <Card className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2"><Eyebrow>Lo que acordamos · {formatDisplayDate(reuniones[0].fecha, 'medium')}</Eyebrow>{isNew(`r:${reuniones[0].fecha}`) && <NewBadge />}</span>
                  {reuniones.length > 1 && <button type="button" onClick={() => setTab('entregas')} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Ver anteriores</button>}
                </div>
                <MeetingSummary s={reuniones[0]} />
              </Card>
            )}

            {reportes.length > 0 && <ReportCard r={reportes[0]} />}

            {/* Accesos a mano desde el inicio: gestión de contenido y los primeros accesos */}
            {(accesos.length > 0 || (ver.contenido && !ver.cicloCM && p.gestionContenido)) && (
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Eyebrow>Tus accesos</Eyebrow>
                  {accesos.length > 4 && <button type="button" onClick={() => setTab('archivos')} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Ver los {accesos.length}</button>}
                </div>
                {ver.contenido && !ver.cicloCM && p.gestionContenido && <ContentButton url={p.gestionContenido} className="mb-3" />}
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {accesos.slice(0, 4).map((a, i) => (
                    <li key={`${a.url}-${i}`}>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="card-swiss group relative flex h-full flex-col gap-3 p-4 transition hover:-translate-y-0.5">
                        {isNew(`l:${a.url}`) && <NewBadge className="absolute right-3 top-3" />}
                        <span className="w-9 h-9 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] flex items-center justify-center text-[var(--marca)]"><AccessIcon nombre={a.nombre} url={a.url} /></span>
                        <span className="text-sm font-medium leading-snug text-[var(--text-primary)] break-words">{a.nombre}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {tab === 'recorrido' && <Recorrido hito={hito} hechos={hechos} />}

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
                              <span className="block text-xs text-[var(--text-tertiary)] truncate">{k ? LINK_HINT[k] : accessHost(a.url)}</span>
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

      <footer className={`mt-16 pt-6 ${whatsapp ? 'mb-16' : ''} border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-tertiary)]`}>
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
function HitosBar({ hito, hechos }: { hito: number; hechos: number[] }) {
  return (
    <span className="mt-3 grid grid-cols-5 gap-1.5" aria-hidden>
      {PRESENCIA_HITOS.map((t, i) => (
        <span key={t} className={`block h-1.5 rounded-full ${hechos.includes(i + 1) ? 'bg-[var(--marca)]' : i + 1 === hito ? 'bg-[var(--marca)] opacity-40' : 'bg-[var(--border-strong)]'}`} />
      ))}
    </span>
  );
}

/** MI RECORRIDO: los cinco hitos de Presencia, qué se trabaja en cada uno y cuándo se completa */
function Recorrido({ hito, hechos }: { hito: number; hechos: number[] }) {
  return (
    <section>
      <SectionTitle title="Tu recorrido en Presencia" hint={`${hechos.length} de ${PRESENCIA_HITOS.length} hitos completados. Un hito se completa cuando lo confirmamos juntos, no por la fecha.`} />
      <ol className="relative space-y-3">
        {PRESENCIA_HITOS.map((titulo, i) => {
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
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{PRESENCIA_HITO_INFO[i].trabajo}</p>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">Se completa cuando: {PRESENCIA_HITO_INFO[i].seCompleta}</p>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
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

function Welcome({ onClose, hasWhatsapp, bienvenida }: { onClose: () => void; hasWhatsapp: boolean; bienvenida?: string | null }) {
  const steps = [
    'Arriba ves en qué hito estamos. En “Mi recorrido” está qué trabajamos en cada uno.',
    'Tu próxima acción va siempre arriba, con su explicación. No hace falta completar nada hasta que te lo indiquemos. Cuando la termines, tocá “Terminé”: la revisamos y te confirmamos.',
    'Tus carpetas de Drive y todo lo que te entregamos están en Archivos y Entregas.',
  ];
  return (
    <Card className="mt-8 p-5 sm:p-6">
      <Eyebrow>Bienvenido</Eyebrow>
      <p className="mt-3 text-lg font-light tracking-tight">Así funciona tu portal</p>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-[var(--text-secondary)]">
            <span className="w-6 h-6 shrink-0 rounded-full border border-[var(--border-subtle)] flex items-center justify-center text-[11px] font-semibold text-[var(--text-primary)]">{i + 1}</span>{s}
          </li>
        ))}
      </ol>
      {hasWhatsapp && <p className="mt-4 text-sm text-[var(--text-secondary)]">¿Dudas? Escribime por WhatsApp con el botón de abajo.</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        {bienvenida && <a href={bienvenida} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--marca)] px-4 py-2 text-sm font-medium text-[var(--marca-text)]">Abrir la bienvenida <ArrowUpRight className="w-4 h-4" /></a>}
        <button type="button" onClick={onClose} className="btn-solid-primary px-4 py-2 text-sm">Entendido</button>
      </div>
    </Card>
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

function PendingTask({ t, today, uploadUrl, sending, readOnly, onDone, nuevo, bare }: { t: PortalTask; today: string; uploadUrl?: string; sending: string | null; readOnly: boolean; onDone: (id: string) => void; nuevo?: boolean; bare?: boolean }) {
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
          {t.pideArchivos && uploadUrl && (
            <a href={uploadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] underline underline-offset-4">
              <Paperclip className="w-3.5 h-3.5" /> Subir a Materiales <ArrowUpRight className="w-3.5 h-3.5" />
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

/** Botón fijo para escribirle a Juan por WhatsApp */
function WhatsappButton({ number, studio }: { number: string; studio: string }) {
  const href = `https://wa.me/${number}?text=${encodeURIComponent(`Hola Juan, te escribo de ${studio}.`)}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="btn-solid-primary fixed z-40 right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm shadow-lg">
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
