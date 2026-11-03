import React, { useEffect, useLayoutEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ArrowUpRight, Check, Folder, Loader2, MessageCircle, Paperclip,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { SegmentedControl } from '../ui';
import { auth } from '../firebaseAuth';
import { isAllowedUser, signInWithGoogle, signOutUser } from '../utils/authAccess';
import { formatDisplayDate } from '../utils/projectTimeline';
import { accessesFromEnlaces, isOverdue, type PafAviso, type PafPortalDoc } from '../portal/model';
import { sendTaskDone, subscribeAvisos, subscribeMyPafPortals, subscribePafPortal } from '../portal/store';

/**
 * /portal: el estudio entra con su cuenta de Google (el mismo correo con el que se
 * compartió su carpeta) y ve solo su paf_portal. Las reglas de Firestore hacen el control.
 * Usa los colores y componentes del CRM (claro u oscuro según el dispositivo).
 * En desarrollo, /portal?demo muestra un ejemplo sin login para revisar el diseño.
 */

type Tab = 'inicio' | 'entregas';
type PortalTask = PafPortalDoc['tareas'][number];

const DEMO: PafPortalDoc = {
  clienteId: 'PAF-DEMO',
  estudio: 'Estudio Ejemplo Arquitectura',
  emailsAutorizados: ['demo@example.com'],
  hitoVisible: 1,
  resumenVisible: '',
  enlaces: {},
  accesos: [
    { nombre: 'Tu carpeta', url: 'https://drive.google.com/' },
    { nombre: 'Contenido en Asana', url: 'https://app.asana.com/' },
    { nombre: 'Tu web (versión de prueba)', url: 'https://example.com/' },
  ],
  anuncios: [
    { id: 'a1', titulo: 'Ya está el borrador de tu web', texto: 'Miralo con calma y anotá lo que cambiarías. Lo vemos el martes.', link: 'https://example.com/', fijado: true, fecha: '2026-11-03' },
    { id: 'a2', texto: 'Esta semana arrancamos con las fotos de obra.', fecha: '2026-11-02' },
  ],
  tareas: [
    { id: 'd1', titulo: 'Completar el formulario de arranque', estado: 'aprobada', aprobadaEl: '2026-10-28' },
    { id: 'd2', titulo: 'Subir 10 fotos de obras terminadas', detalle: 'Las de mejor calidad que tengas, sin editar.', link: 'https://drive.google.com/', fecha: '2026-11-06', estado: 'habilitada' },
    { id: 'd3', titulo: 'Elegir 3 proyectos que te representen', fecha: '2026-11-01', estado: 'habilitada', motivo: 'Sumá uno de vivienda, así comparamos.' },
    { id: 'd5', titulo: 'Mandarnos tu logo en buena calidad', estado: 'habilitada' },
    { id: 'd4', titulo: 'Revisar la propuesta de foco', estado: 'enviada' },
  ],
  tareasHabilitadas: ['d2', 'd3', 'd5'],
  entregas: [
    { id: 'e1', titulo: 'Diagnóstico inicial del estudio', fecha: '2026-10-30', enlace: 'https://drive.google.com/' },
  ],
  proximaReunion: { fecha: '2026-11-10', hora: '10:30' },
  actualizadoEn: '2026-11-03T20:00:00.000Z',
  contacto: { whatsapp: '5491100000000' },
  reuniones: [{ fecha: '2026-10-30', acuerdos: 'Arrancamos por la web.', proximosPasos: 'Ustedes: fotos de obra. Nosotros: borrador de la web.' }],
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
  const initial = (email[0] || '?').toUpperCase();
  const reuniones = p.reuniones || [];
  const whatsapp = p.contacto?.whatsapp || '';
  // Accesos libres; los portales publicados antes traen los 5 enlaces fijos
  const accesos = p.accesos ?? accessesFromEnlaces(p.enlaces || {});
  // Anuncios; el "foco" de antes se muestra como un anuncio fijado (no se pierde)
  const anuncios = [
    ...(p.resumenVisible ? [{ id: 'foco', texto: p.resumenVisible, fijado: true, fecha: p.actualizadoEn.slice(0, 10) }] : []),
    ...(p.anuncios || []),
  ];

  // Dos pantallas como máximo: Inicio y, si hay algo, Entregas
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'inicio', label: 'Inicio' },
    ...(entregas.length || reuniones.length ? [{ id: 'entregas' as Tab, label: 'Entregas', count: entregas.length || undefined }] : []),
  ];
  const inicioVacio = !anuncios.length && !pendientes.length && !enRevision.length && !p.proximaReunion && !accesos.length;

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

      <header className="pt-1 sm:pt-6">
        <h1 className="text-3xl sm:text-5xl font-light tracking-tight leading-[1.1] text-[var(--text-primary)] break-words">Hola, {p.estudio}</h1>
      </header>

      {showWelcome && <Welcome onClose={closeWelcome} hasWhatsapp={!!whatsapp} />}

      {/* Pestañas: solo las que tienen algo. Si queda solo Inicio, no se muestran. */}
      {tabs.length > 1 && (
        <nav className="mt-8 sm:mt-10 -mx-4 px-4 overflow-x-auto no-scrollbar">
          <SegmentedControl<Tab> value={tab} onChange={setTab} options={tabs} />
        </nav>
      )}

      <main className="mt-8 animate-in fade-in duration-200" key={tab}>
        {tab === 'inicio' && (
          <div className="space-y-8">
            {anuncios.length > 0 && (
              <ul className="space-y-3" aria-label="Anuncios">
                {anuncios.map((a) => (
                  <li key={a.id}>
                    <Card className="p-5">
                      {a.titulo && <p className="text-[15px] font-medium text-[var(--text-primary)]">{a.titulo}</p>}
                      <p className={`${a.titulo ? 'mt-1.5' : ''} text-[15px] leading-relaxed text-[var(--text-primary)] whitespace-pre-line`}>{a.texto}</p>
                      {a.link && (
                        <a href={a.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] underline underline-offset-4">
                          Abrir <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            )}

            {(pendientes.length > 0 || enRevision.length > 0 || aprobadas.length > 0) && (
              <section>
                <SectionTitle title="Tareas" hint={pendientes.length ? 'Cuando termines, tocá “Terminé”. Lo revisamos y te confirmamos.' : undefined} />
                {pendientes.length > 0 && (
                  <ul className="space-y-3">
                    {pendientes.map((t) => <li key={t.id}><PendingTask t={t} {...taskProps} /></li>)}
                  </ul>
                )}
                {!pendientes.length && enRevision.length > 0 && (
                  <p className="text-sm text-[var(--text-secondary)]">Nada pendiente de tu lado. Estamos revisando {enRevision.length === 1 ? 'lo que nos mandaste' : `${enRevision.length} cosas que nos mandaste`}.</p>
                )}
                {pendientes.length > 0 && enRevision.length > 0 && <div className="mt-4"><p className="mb-1 text-sm text-[var(--text-tertiary)]">En revisión</p><TaskList items={enRevision} dot="bg-sky-500" /></div>}
                {aprobadas.length > 0 && (
                  <details className="mt-4 group">
                    <summary className="cursor-pointer list-none text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Hechas ({aprobadas.length})</summary>
                    <div className="mt-2"><TaskList items={aprobadas} dot="bg-emerald-500" muted /></div>
                  </details>
                )}
                {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error}</p>}
              </section>
            )}

            {p.proximaReunion && (
              <Card className="p-5 sm:p-6">
                <Eyebrow>Próxima reunión</Eyebrow>
                <MeetingDate fecha={p.proximaReunion.fecha} hora={p.proximaReunion.hora} />
              </Card>
            )}

            {accesos.length > 0 && (
              <section>
                <SectionTitle title="Accesos directos" />
                <ul className="grid gap-3 sm:grid-cols-2">
                  {accesos.map((a, i) => (
                    <li key={`${a.url}-${i}`}>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="card-swiss group flex items-center gap-4 p-4">
                        <span className="w-10 h-10 shrink-0 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"><Folder className="w-[18px] h-[18px]" /></span>
                        <span className="min-w-0 flex-1 text-sm font-medium text-[var(--text-primary)] break-words">{a.nombre}</span>
                        <ArrowUpRight className="w-4 h-4 shrink-0 text-[var(--text-tertiary)] transition group-hover:text-[var(--text-primary)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {inicioVacio && <p className="text-sm text-[var(--text-secondary)]">Por ahora no hay nada nuevo. Te avisamos cuando haya algo.</p>}
          </div>
        )}

        {tab === 'entregas' && (
          <div className="space-y-10">
            {entregas.length > 0 && (
              <section>
                <SectionTitle title="Entregas" hint="Lo que preparamos para tu estudio." />
                <Card className="px-5 divide-y divide-[var(--border-divider)]">
                  {[...entregas].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map((d) => <DeliveryRow key={d.id} d={d} />)}
                </Card>
              </section>
            )}
            {reuniones.length > 0 && (
              <section>
                <SectionTitle title="Resúmenes de reunión" hint="Acuerdos y próximos pasos de cada encuentro." />
                <ul className="space-y-3">
                  {reuniones.map((s, i) => (
                    <li key={i}><Card className="p-5"><p className="text-xs text-[var(--text-tertiary)]">{formatDisplayDate(s.fecha, 'medium')}</p><MeetingSummary s={s} /></Card></li>
                  ))}
                </ul>
              </section>
            )}
          </div>
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

/** Bienvenida corta, solo la primera vez */
function Welcome({ onClose, hasWhatsapp }: { onClose: () => void; hasWhatsapp: boolean }) {
  return (
    <Card className="mt-6 p-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <p className="flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">
        Bienvenido a tu portal. Acá vas a encontrar lo que necesitamos de vos, tus reuniones y tus accesos.{hasWhatsapp ? ' Cualquier duda, escribime.' : ''}
      </p>
      <button type="button" onClick={onClose} className="btn-solid-primary shrink-0 self-start px-4 py-2 text-sm">Entendido</button>
    </Card>
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
          {t.link && (
            <a href={t.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] underline underline-offset-4">
              Abrir <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          )}
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
