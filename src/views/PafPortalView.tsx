import React, { useEffect, useLayoutEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ArrowRight, ArrowUpRight, BarChart3, Check, ChevronDown, FileText, Folder, Globe, LayoutList, Loader2, Lock, MessageCircle, Package, Paperclip,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { EmptyState, SegmentedControl } from '../ui';
import { auth } from '../firebaseAuth';
import { isAllowedUser, signInWithGoogle, signOutUser } from '../utils/authAccess';
import { formatDisplayDate } from '../utils/projectTimeline';
import { AccessIcon } from '../components/AccessIcon';
import { PAF_PORTAL_LINK_KEYS, PAF_PORTAL_LINK_LABEL, PRESENCIA_HITOS, accessHost, accessesFromEnlaces, isOverdue, type PafAviso, type PafPortalDoc, type PafPortalLinkKey } from '../portal/model';
import { sendTaskDone, subscribeAvisos, subscribeMyPafPortals, subscribePafPortal } from '../portal/store';

/**
 * /portal: el estudio entra con su cuenta de Google (el mismo correo con el que se
 * compartió su carpeta) y ve solo su paf_portal. Las reglas de Firestore hacen el control.
 * Usa los colores y componentes del CRM (claro u oscuro según el dispositivo).
 * En desarrollo, /portal?demo muestra un ejemplo sin login para revisar el diseño.
 */

type Tab = 'inicio' | 'tareas' | 'entregas' | 'archivos';
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
  tareas: [
    { id: 'd1', titulo: 'Completar el formulario de arranque', estado: 'aprobada', aprobadaEl: '2026-10-28' },
    { id: 'd2', titulo: 'Subir 10 fotos de obras terminadas', detalle: 'Las de mejor calidad que tengas, sin editar.', link: 'https://drive.google.com/', fecha: '2026-11-06', estado: 'habilitada' },
    { id: 'd3', titulo: 'Elegir 3 proyectos que te representen', detalle: 'Los que te gustaría hacer más seguido.', fecha: '2026-11-01', estado: 'habilitada', motivo: 'Sumá uno de vivienda, así comparamos.' },
    { id: 'd4', titulo: 'Revisar la propuesta de foco', estado: 'enviada' },
  ],
  tareasHabilitadas: ['d2', 'd3'],
  entregas: [
    { id: 'e1', titulo: 'Diagnóstico inicial del estudio', fecha: '2026-10-30', enlace: 'https://drive.google.com/' },
    { id: 'e2', titulo: 'Propuesta de foco', fecha: '2026-11-04', enlace: 'https://drive.google.com/' },
  ],
  proximaReunion: { fecha: '2026-11-10', hora: '10:30' },
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
    const apply = () => {
      root.classList.toggle('dark', mq.matches);
      root.classList.toggle('light', !mq.matches);
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

  useEffect(() => {
    document.title = 'Mi portal · Método PAF';
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
    if (preview === undefined) return <Shell><div role="status" className="flex items-center justify-center gap-3 py-40 text-sm text-[var(--text-tertiary)]"><Loader2 className="w-4 h-4 animate-spin" /> Cargando la vista previa…</div></Shell>;
    if (!preview) return <Shell><p className="py-24 text-center text-sm text-[var(--text-secondary)]">El portal {previewId} no está publicado.</p></Shell>;
    return <PortalScreen portal={preview} email={user.email!} readOnly onLogout={() => undefined} />;
  }

  const login = async () => {
    setError('');
    try { await signInWithGoogle(); } catch { setError('No se pudo iniciar sesión. Probá de nuevo.'); }
  };

  if (user === undefined || (user && portals === null && !error)) {
    return <Shell><div role="status" className="flex items-center justify-center gap-3 py-40 text-sm text-[var(--text-tertiary)]"><Loader2 className="w-4 h-4 animate-spin" /> Cargando tu portal…</div></Shell>;
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

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
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

function PortalScreen({ portal: p, email, demo, readOnly, onLogout, switcher }: { portal: PafPortalDoc; email: string; demo?: boolean; readOnly?: boolean; onLogout: () => void; switcher?: React.ReactNode }) {
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

  const tareas = p.tareas || [];
  const avisada = (t: PortalTask) =>
    t.estado === 'enviada' || (t.estado === 'habilitada' && avisos.some((a) => a.tareaId === t.id && (!t.habilitadaEn || a.creadoEn > t.habilitadaEn)));
  const pendientes = tareas.filter((t) => t.estado === 'habilitada' && !avisada(t));
  const enRevision = tareas.filter((t) => t.estado !== 'aprobada' && avisada(t));
  const aprobadas = tareas.filter((t) => t.estado === 'aprobada');
  const entregas = p.entregas || [];
  // Accesos libres; los portales publicados antes traen los 5 enlaces fijos
  const accesos = p.accesos ?? accessesFromEnlaces(p.enlaces || {});
  const anuncios = p.anuncios || [];
  const mostrarAvance = p.mostrarAvance !== false;
  const hito = Math.min(PRESENCIA_HITOS.length, Math.max(1, p.hitoVisible || 1));
  const initial = (email[0] || '?').toUpperCase();
  const objetivos = p.objetivos || [];
  const reuniones = p.reuniones || [];
  const whatsapp = p.contacto?.whatsapp || '';
  const [showStages, setShowStages] = useState(false);

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
    uploadUrl: p.enlaces?.materiales || p.enlaces?.carpeta,
    sending, readOnly: !!readOnly, onDone: done,
  };

  const account = (
    <div className="flex items-center gap-3">
      {switcher}
      <button type="button" onClick={onLogout} title={`Salir (${email})`} className="group inline-flex items-center gap-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
        <span className="hidden sm:inline">Salir</span>
        <span className="w-8 h-8 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)] group-hover:border-[var(--border-strong)]">{initial}</span>
      </button>
    </div>
  );

  return (
    <Shell right={readOnly ? undefined : account}>
      {readOnly && <p className="mb-6 rounded-[var(--radius-control)] border border-dashed border-[var(--border-strong)] px-4 py-2 text-xs text-[var(--text-secondary)]">Vista previa: así ve {p.estudio} su portal ahora. Es solo lectura: los botones no hacen nada.</p>}
      {demo && <p className="mb-6 rounded-[var(--radius-control)] border border-dashed border-[var(--border-strong)] px-4 py-2 text-xs text-[var(--text-secondary)]">Vista de ejemplo, solo en tu compu: así lo ve un estudio. Los datos son inventados.</p>}

      {/* Encabezado corto: saludo y avance en una línea (al tocarla se abre el detalle) */}
      <header className="pt-1 sm:pt-6">
        <h1 className="text-3xl sm:text-5xl font-light tracking-tight leading-[1.1] text-[var(--text-primary)] break-words">Hola, {p.estudio}</h1>
        {mostrarAvance && <button type="button" onClick={() => setShowStages((v) => !v)} aria-expanded={showStages} className="mt-4 w-full text-left group">
          <span className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">Presencia</span>
            <span aria-hidden>·</span><span>Etapa {hito} de {PRESENCIA_HITOS.length}</span>
            <span aria-hidden>·</span><span className="font-serif italic text-base text-[var(--text-primary)]">{PRESENCIA_HITOS[hito - 1]}</span>
            {p.semana && <><span aria-hidden>·</span><span>Semana {p.semana.actual} de {p.semana.total}</span></>}
            <ChevronDown className={`w-4 h-4 self-center text-[var(--text-tertiary)] transition-transform ${showStages ? 'rotate-180' : ''}`} />
          </span>
          <span className="mt-3 grid grid-cols-5 gap-1.5" aria-hidden>
            {PRESENCIA_HITOS.map((title, i) => (
              <span key={title} className={`block h-1 rounded-full ${i + 1 < hito ? 'bg-[var(--text-primary)]' : i + 1 === hito ? 'bg-[var(--text-primary)] opacity-60' : 'bg-[var(--border-strong)]'}`} />
            ))}
          </span>
        </button>}
        {mostrarAvance && showStages && <StageDetail hito={hito} />}
      </header>

      {showWelcome && <Welcome onClose={closeWelcome} hasWhatsapp={!!whatsapp} />}

      {/* Pestañas */}
      <nav className="mt-8 sm:mt-10 -mx-4 px-4 overflow-x-auto no-scrollbar">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { id: 'inicio', label: 'Inicio' },
            { id: 'tareas', label: 'Tareas', count: pendientes.length || undefined },
            { id: 'entregas', label: 'Entregas', count: entregas.length || undefined },
            { id: 'archivos', label: 'Archivos' },
          ]}
        />
      </nav>

      <main className="mt-8 animate-in fade-in duration-200" key={tab}>
        {tab === 'inicio' && (
          <div className="space-y-8">
            {/* Anuncios de Juan, arriba de todo */}
            {anuncios.length > 0 && (
              <ul className="space-y-3" aria-label="Anuncios">
                {anuncios.map((a) => (
                  <li key={a.id}>
                    <Card className="p-5">
                      {a.titulo && <p className="text-[15px] font-medium text-[var(--text-primary)]">{a.titulo}</p>}
                      <p className={`${a.titulo ? 'mt-1.5' : ''} text-[15px] leading-relaxed text-[var(--text-primary)] whitespace-pre-line`}>{a.texto}</p>
                      {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] underline underline-offset-4">Abrir <ArrowUpRight className="w-3.5 h-3.5" /></a>}
                    </Card>
                  </li>
                ))}
              </ul>
            )}

            {/* Esta semana: foco y objetivos (si no hay nada cargado, no se muestra) */}
            {(p.resumenVisible || objetivos.length > 0) && (
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

            <section>
              <SectionTitle title="Lo que necesitamos de vos" hint={pendientes.length ? 'Cuando termines, tocá “Terminé”. Lo revisamos y te confirmamos.' : undefined} />
              {pendientes.length ? (
                <>
                  <ul className="space-y-3">
                    {pendientes.slice(0, 3).map((t) => <li key={t.id}><PendingTask t={t} {...taskProps} /></li>)}
                  </ul>
                  {pendientes.length > 3 && <button type="button" onClick={() => setTab('tareas')} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">Ver las {pendientes.length} tareas <ArrowRight className="w-4 h-4" /></button>}
                </>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">Nada pendiente de tu lado. {enRevision.length ? `Estamos revisando ${enRevision.length === 1 ? 'lo que nos mandaste' : `${enRevision.length} cosas que nos mandaste`}.` : 'Te avisamos cuando haya algo nuevo.'}</p>
              )}
              {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5 sm:p-6">
                <Eyebrow>Próxima reunión</Eyebrow>
                {p.proximaReunion ? <MeetingDate fecha={p.proximaReunion.fecha} hora={p.proximaReunion.hora} /> : (
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">La vas a ver acá cuando la coordinemos.</p>
                )}
              </Card>
              <Card className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <Eyebrow>Última entrega</Eyebrow>
                  {entregas.length > 1 && <button type="button" onClick={() => setTab('entregas')} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Ver todas</button>}
                </div>
                {entregas.length ? <DeliveryRow d={latest(entregas)} /> : <p className="mt-3 text-sm text-[var(--text-secondary)]">Las entregas aparecen acá cuando las compartimos.</p>}
              </Card>
            </div>

            {reuniones.length > 0 && (
              <Card className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <Eyebrow>Lo que acordamos · {formatDisplayDate(reuniones[0].fecha, 'medium')}</Eyebrow>
                  {reuniones.length > 1 && <button type="button" onClick={() => setTab('entregas')} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Ver anteriores</button>}
                </div>
                <MeetingSummary s={reuniones[0]} />
              </Card>
            )}

            {/* Accesos a mano desde el inicio: los primeros, con su ícono */}
            {accesos.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Eyebrow>Tus accesos</Eyebrow>
                  {accesos.length > 4 && <button type="button" onClick={() => setTab('archivos')} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Ver los {accesos.length}</button>}
                </div>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {accesos.slice(0, 4).map((a, i) => (
                    <li key={`${a.url}-${i}`}>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="card-swiss group flex h-full flex-col gap-3 p-4">
                        <span className="w-9 h-9 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"><AccessIcon nombre={a.nombre} url={a.url} /></span>
                        <span className="text-sm font-medium leading-snug text-[var(--text-primary)] break-words">{a.nombre}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {tab === 'tareas' && (
          <div className="space-y-10">
            <section>
              <SectionTitle title="Lo que necesitamos de vos" hint="Cuando termines una, tocá “Terminé”. La revisamos y te confirmamos." />
              {pendientes.length ? (
                <ul className="space-y-3">
                  {pendientes.map((t) => <li key={t.id}><PendingTask t={t} {...taskProps} /></li>)}
                </ul>
              ) : <EmptyState icon={<Check className="w-5 h-5" />} title="Nada pendiente" description="Cuando tengamos algo para vos, aparece acá." />}
              {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
            </section>

            {enRevision.length > 0 && (
              <section>
                <SectionTitle title="En revisión" hint="Nos avisaste que las terminaste." />
                <TaskList items={enRevision} dot="bg-sky-500" />
              </section>
            )}

            {aprobadas.length > 0 && (
              <section>
                <SectionTitle title="Aprobadas" />
                <TaskList items={aprobadas} dot="bg-emerald-500" muted />
              </section>
            )}
          </div>
        )}

        {tab === 'entregas' && (
          <section>
            <SectionTitle title="Entregas" hint="Lo que preparamos para tu estudio." />
            {entregas.length ? (
              <Card className="px-5 divide-y divide-[var(--border-divider)]">
                {[...entregas].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map((d) => <DeliveryRow key={d.id} d={d} />)}
              </Card>
            ) : <EmptyState icon={<Package className="w-5 h-5" />} title="Todavía no hay entregas" description="Aparecen acá a medida que las compartimos." />}
            {reuniones.length > 0 && (
              <div className="mt-10">
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
          <section>
            <SectionTitle title="Tus carpetas y enlaces" hint="Se abren en Drive y en las herramientas que usamos juntos." />
            {accesos.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {accesos.map((a, i) => {
                  // Los 5 accesos de siempre conservan su descripción; el ícono sale de lo que es el link
                  const k = PAF_PORTAL_LINK_KEYS.find((key) => PAF_PORTAL_LINK_LABEL[key] === a.nombre);
                  return (
                    <li key={`${a.url}-${i}`}>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="card-swiss group flex items-center gap-4 p-4">
                        <span className="w-10 h-10 shrink-0 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"><AccessIcon nombre={a.nombre} url={a.url} className="w-[18px] h-[18px]" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-[var(--text-primary)] break-words">{a.nombre}</span>
                          <span className="block text-xs text-[var(--text-tertiary)] truncate">{k ? LINK_HINT[k] : accessHost(a.url)}</span>
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-[var(--text-tertiary)] transition group-hover:text-[var(--text-primary)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState icon={<Folder className="w-5 h-5" />} title="Todavía no hay carpetas" description="Las compartimos cuando completes el formulario de arranque." />}
          </section>
        )}
      </main>

      <footer className={`mt-16 pt-6 ${whatsapp ? 'mb-16' : ''} border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-tertiary)]`}>
        <span>.CERO</span>
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

function MeetingDate({ fecha, hora }: { fecha: string; hora?: string }) {
  const d = new Date(`${fecha}T12:00:00`);
  const month = d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
  const weekday = d.toLocaleDateString('es-AR', { weekday: 'long' });
  return (
    <div className="mt-3 flex items-center gap-4">
      <div className="w-14 shrink-0 rounded-[var(--radius-control)] border border-[var(--border-subtle)] overflow-hidden text-center">
        <p className="bg-[var(--bg-surface-muted)] py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{month}</p>
        <p className="py-1.5 text-2xl font-light tracking-tight">{d.getDate()}</p>
      </div>
      <div>
        <p className="text-sm font-medium capitalize text-[var(--text-primary)]">{weekday}</p>
        <p className="text-sm text-[var(--text-secondary)]">{hora ? `${hora} hs · hora de Argentina` : 'Horario a confirmar'}</p>
      </div>
    </div>
  );
}

function DeliveryRow({ d }: { d: PafPortalDoc['entregas'][number] }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[var(--text-primary)] break-words">{d.titulo}</span>
        {d.fecha && <span className="block mt-0.5 text-xs text-[var(--text-tertiary)]">{formatDisplayDate(d.fecha, 'medium')}</span>}
      </span>
      {d.enlace && <ArrowUpRight className="w-4 h-4 shrink-0 text-[var(--text-tertiary)] transition group-hover:text-[var(--text-primary)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />}
    </>
  );
  return d.enlace
    ? <a href={d.enlace} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 py-4">{body}</a>
    : <div className="flex items-center gap-4 py-4">{body}</div>;
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

/** Detalle de la línea de avance: los tres pilares (lo futuro, visible y bloqueado) y las 5 etapas */
function StageDetail({ hito }: { hito: number }) {
  const pillars = [
    { name: 'Presencia', state: 'current' },
    { name: 'Adquisición', state: 'locked' },
    { name: 'Conversión', state: 'locked' },
  ];
  return (
    <div className="mt-4 card-swiss p-5 space-y-5 animate-in fade-in duration-200">
      <ol className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs" aria-label="Pilares del método">
        {pillars.map((x, i) => (
          <React.Fragment key={x.name}>
            {i > 0 && <span aria-hidden className="hidden sm:block h-px flex-1 bg-[var(--border-strong)]" />}
            <li className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${x.state === 'current' ? 'border-[var(--text-primary)] text-[var(--text-primary)] font-medium' : 'border-[var(--border-subtle)] text-[var(--text-tertiary)]'}`} aria-current={x.state === 'current' ? 'step' : undefined}>
              {x.state === 'locked' && <Lock className="w-3 h-3" aria-label="Próximamente" />}{x.name}
            </li>
          </React.Fragment>
        ))}
      </ol>
      <ol className="space-y-3">
        {PRESENCIA_HITOS.map((title, i) => {
          const n = i + 1;
          const state = n < hito ? 'done' : n === hito ? 'current' : 'pending';
          return (
            <li key={title} className="flex items-center gap-3 text-sm" aria-current={state === 'current' ? 'step' : undefined}>
              <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold ${state === 'done' ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]' : state === 'current' ? 'border border-[var(--text-primary)] text-[var(--text-primary)]' : 'border border-[var(--border-subtle)] text-[var(--text-tertiary)]'}`}>
                {state === 'done' ? <Check className="w-3.5 h-3.5" /> : n}
              </span>
              <span className={state === 'pending' ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}>{title}{state === 'current' && <span className="ml-2 text-xs text-[var(--text-tertiary)]">Estamos acá</span>}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-[var(--text-tertiary)]">Adquisición y Conversión se habilitan cuando cerremos Presencia.</p>
    </div>
  );
}

function Welcome({ onClose, hasWhatsapp }: { onClose: () => void; hasWhatsapp: boolean }) {
  const steps = [
    'Arriba ves en qué etapa estamos. Tocá la línea para ver el recorrido completo.',
    'Cuando necesitemos algo de vos, aparece en “Lo que necesitamos de vos”. Hacelo y tocá “Terminé”: lo revisamos y te confirmamos.',
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
      <button type="button" onClick={onClose} className="btn-solid-primary mt-5 px-4 py-2 text-sm">Entendido</button>
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

function PendingTask({ t, today, uploadUrl, sending, readOnly, onDone }: { t: PortalTask; today: string; uploadUrl?: string; sending: string | null; readOnly: boolean; onDone: (id: string) => void }) {
  const overdue = isOverdue(t, today);
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-[var(--text-primary)] break-words">{t.titulo}</p>
          {t.fecha && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              {overdue && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden />}
              {overdue ? `Venció el ${formatDisplayDate(t.fecha, 'medium')}` : `Para el ${formatDisplayDate(t.fecha, 'medium')}`}
            </p>
          )}
          {t.motivo && <p className="mt-3 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)]"><span className="text-[var(--text-tertiary)]">Te pedimos: </span>{t.motivo}</p>}
          {t.detalle && <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">{t.detalle}</p>}
          {t.link && <a href={t.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] underline underline-offset-4">Abrir <ArrowUpRight className="w-3.5 h-3.5" /></a>}
          {t.pideArchivos && uploadUrl && (
            <a href={uploadUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] underline underline-offset-4">
              <Paperclip className="w-3.5 h-3.5" /> Subir a Materiales <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
        <button type="button" onClick={() => onDone(t.id)} disabled={sending === t.id || readOnly} title={readOnly ? 'Vista previa: el botón no hace nada' : undefined} className="btn-solid-primary shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm disabled:opacity-60">
          {sending === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Terminé
        </button>
      </div>
    </Card>
  );
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
