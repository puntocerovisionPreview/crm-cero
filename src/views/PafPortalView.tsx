import React, { useEffect, useLayoutEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ArrowUpRight, BarChart3, CalendarDays, Check, CheckCircle2, Circle, FileText, Folder, Globe,
  LayoutList, Loader2, LogOut, Package, Sparkles,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { auth } from '../firebaseAuth';
import { signInWithGoogle, signOutUser } from '../utils/authAccess';
import { formatDisplayDate } from '../utils/projectTimeline';
import { PAF_PORTAL_LINK_KEYS, PAF_PORTAL_LINK_LABEL, PRESENCIA_HITOS, type PafAviso, type PafPortalDoc, type PafPortalLinkKey } from '../portal/model';
import { sendTaskDone, subscribeAvisos, subscribeMyPafPortals } from '../portal/store';

/**
 * /portal: el estudio entra con su cuenta de Google (el mismo correo con el que se
 * compartió su carpeta) y ve solo su paf_portal. Las reglas de Firestore hacen el control.
 * En desarrollo, /portal?demo muestra un ejemplo sin login para revisar el diseño.
 */

const LINK_ICON: Record<PafPortalLinkKey, React.ElementType> = {
  carpeta: Folder,
  materiales: FileText,
  resultados: BarChart3,
  web: Globe,
  asana: LayoutList,
};

const DEMO: PafPortalDoc = {
  clienteId: 'PAF-DEMO',
  estudio: 'Estudio Ejemplo Arquitectura',
  emailsAutorizados: ['demo@example.com'],
  hitoVisible: 2,
  resumenVisible: 'Esta semana cerramos el foco del estudio: a quién le hablamos y qué proyectos queremos atraer. Con eso arrancamos el mensaje.',
  enlaces: { carpeta: 'https://drive.google.com/', materiales: 'https://drive.google.com/', resultados: 'https://drive.google.com/', web: 'https://example.com/', asana: 'https://app.asana.com/' },
  tareas: [
    { id: 'd1', titulo: 'Completar el formulario de arranque', estado: 'aprobada', aprobadaEl: '2026-10-28' },
    { id: 'd2', titulo: 'Subir 10 fotos de obras terminadas', detalle: 'A la carpeta Materiales. Las de mejor calidad que tengas, sin editar.', fecha: '2026-11-06', estado: 'habilitada' },
    { id: 'd3', titulo: 'Elegir 3 proyectos que te representen', detalle: 'Los que te gustaría hacer más seguido.', fecha: '2026-11-08', estado: 'habilitada' },
    { id: 'd4', titulo: 'Revisar la propuesta de foco', estado: 'enviada' },
  ],
  entregas: [
    { id: 'e1', titulo: 'Diagnóstico inicial del estudio', fecha: '2026-10-30', enlace: 'https://drive.google.com/' },
    { id: 'e2', titulo: 'Propuesta de foco', fecha: '2026-11-04', enlace: 'https://drive.google.com/' },
  ],
  proximaReunion: { fecha: '2026-11-10', hora: '10:30' },
  actualizadoEn: '2026-11-02T20:00:00.000Z',
};

/** El portal usa siempre su propio tema oscuro, como el portal del alumno */
function useDarkPortal() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousDark = root.classList.contains('dark');
    const previousScheme = root.style.colorScheme;
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
    return () => {
      root.classList.toggle('dark', previousDark);
      root.style.colorScheme = previousScheme;
    };
  }, []);
}

export const PafPortalView: React.FC = () => {
  useDarkPortal();
  const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');
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
    setPortals(null); setError(''); setSelected(0);
    if (!user?.email || !user.emailVerified) return;
    return subscribeMyPafPortals(user.email, setPortals, () => setError('No pudimos cargar tu portal. Revisá tu conexión y volvé a intentar.'));
  }, [user]);

  if (demo) return <PortalScreen portal={DEMO} email="demo@example.com" demo onLogout={() => undefined} />;

  const login = async () => {
    setError('');
    try { await signInWithGoogle(); } catch { setError('No se pudo iniciar sesión. Probá de nuevo.'); }
  };

  if (user === undefined || (user && portals === null && !error)) {
    return <Shell><div role="status" className="flex items-center justify-center gap-3 py-32 text-zinc-400"><Loader2 className="w-5 h-5 animate-spin" /> Cargando tu portal…</div></Shell>;
  }

  if (!user) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/30 p-8 text-center space-y-5 mt-10">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-400">Método PAF</p>
          <h1 className="text-3xl font-semibold tracking-tight">Tu portal</h1>
          <p className="text-sm text-zinc-300 leading-relaxed">Entrá con la cuenta de Google con la que compartimos tu carpeta de Drive.</p>
          <button type="button" onClick={login} className="w-full rounded-2xl bg-amber-400 text-zinc-950 px-4 py-3 text-sm font-semibold hover:bg-amber-300 transition">Entrar con Google</button>
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        </div>
      </Shell>
    );
  }

  if (error || !portals?.length) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 text-center space-y-4 mt-10">
          <h1 className="text-xl font-semibold">{error ? 'No pudimos cargar tu portal' : 'Esta cuenta no tiene un portal'}</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">{error || `Entraste como ${user.email}. Usá el correo con el que compartimos tu carpeta, o avisale a tu equipo de .CERO.`}</p>
          <LogoutButton email={user.email} />
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
        <select aria-label="Estudio" value={selected} onChange={(e) => setSelected(Number(e.target.value))} className="rounded-full bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200">
          {portals.map((x, i) => <option key={x.clienteId} value={i}>{x.estudio}</option>)}
        </select>
      ) : null}
    />
  );
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0B0F17] text-zinc-100 selection:bg-amber-400/30">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10 space-y-6">
        <div className="flex items-center justify-between gap-3"><BrandLogo size="sm" /><span className="text-xs text-zinc-400">Tu espacio de trabajo con .CERO</span></div>
        {children}
      </div>
    </div>
  );
}

function LogoutButton({ email, onLogout = () => signOutUser() }: { email?: string | null; onLogout?: () => void }) {
  return (
    <button type="button" onClick={onLogout} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200">
      <LogOut className="w-3.5 h-3.5" /> Salir{email ? ` (${email})` : ''}
    </button>
  );
}

function PortalScreen({ portal: p, email, demo, onLogout, switcher }: { portal: PafPortalDoc; email: string; demo?: boolean; onLogout: () => void; switcher?: React.ReactNode }) {
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
  const avisada = (t: PafPortalDoc['tareas'][number]) =>
    t.estado === 'enviada' || (t.estado === 'habilitada' && avisos.some((a) => a.tareaId === t.id && (!t.habilitadaEn || a.creadoEn > t.habilitadaEn)));
  const pendientes = tareas.filter((t) => t.estado === 'habilitada' && !avisada(t));
  const enRevision = tareas.filter((t) => t.estado !== 'aprobada' && avisada(t));
  const aprobadas = tareas.filter((t) => t.estado === 'aprobada');
  const links = PAF_PORTAL_LINK_KEYS.filter((k) => p.enlaces?.[k]);
  const hito = Math.min(PRESENCIA_HITOS.length, Math.max(1, p.hitoVisible || 1));

  return (
    <Shell>
      {demo && <p className="rounded-2xl border border-sky-500/30 bg-sky-500/5 px-4 py-2 text-xs text-sky-200">Vista de ejemplo (solo en tu compu): así lo ve un estudio. Los datos son inventados.</p>}

      <header className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/30 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-amber-400">Método PAF · Presencia</p>
          {switcher}
        </div>
        <h1 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-tight break-words">{p.estudio}</h1>
        {p.resumenVisible
          ? <p className="mt-4 text-zinc-300 max-w-2xl leading-relaxed whitespace-pre-line">{p.resumenVisible}</p>
          : <p className="mt-4 text-zinc-300 max-w-2xl leading-relaxed">Un lugar para ver en qué estamos, qué necesitamos de vos y todo lo que vamos entregando.</p>}
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-zinc-300">
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-200 px-3 py-1.5">Etapa {hito} de {PRESENCIA_HITOS.length} · {PRESENCIA_HITOS[hito - 1]}</span>
          {p.proximaReunion && <span className="rounded-full border border-zinc-700 px-3 py-1.5">Próxima reunión · {formatDisplayDate(p.proximaReunion.fecha, 'medium')}{p.proximaReunion.hora ? ` · ${p.proximaReunion.hora}` : ''}</span>}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Para hacer" value={pendientes.length} tone={pendientes.length ? 'text-amber-300' : 'text-zinc-100'} />
        <Stat label="En revisión" value={enRevision.length} />
        <Stat label="Aprobadas" value={aprobadas.length} tone="text-emerald-300" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Section title="Lo que necesitamos de vos" subtitle="Cuando termines, tocá “Terminé”. Lo revisamos y te confirmamos.">
            {pendientes.length === 0 && enRevision.length === 0 ? (
              <div className="flex items-center gap-3 text-sm text-zinc-400"><Sparkles className="w-5 h-5 text-amber-400 shrink-0" />Por ahora no hay nada pendiente de tu lado.</div>
            ) : (
              <ul className="space-y-3">
                {pendientes.map((t) => (
                  <li key={t.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-100 break-words">{t.titulo}</p>
                        {t.fecha && <p className="mt-1 text-xs text-amber-300/90">Para el {formatDisplayDate(t.fecha, 'medium')}</p>}
                        {t.detalle && <p className="mt-2 text-sm text-zinc-400 whitespace-pre-line leading-relaxed">{t.detalle}</p>}
                      </div>
                      <button type="button" onClick={() => done(t.id)} disabled={sending === t.id} className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 text-zinc-950 px-4 py-2 text-sm font-semibold hover:bg-amber-300 transition disabled:opacity-60">
                        {sending === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Terminé
                      </button>
                    </div>
                  </li>
                ))}
                {enRevision.map((t) => (
                  <li key={t.id} className="rounded-2xl border border-zinc-800/70 p-4 flex items-start gap-3">
                    <Circle className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-300 break-words">{t.titulo}</p>
                      <p className="mt-1 text-xs text-sky-300">Nos avisaste que terminaste · lo estamos revisando</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
          </Section>

          <Section title="Entregas" subtitle="Lo que preparamos para tu estudio.">
            {p.entregas?.length ? (
              <ul className="divide-y divide-zinc-800">
                {p.entregas.map((d) => (
                  <li key={d.id}>
                    {d.enlace ? (
                      <a href={d.enlace} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 py-3">
                        <Package className="w-5 h-5 text-violet-300 shrink-0" />
                        <span className="min-w-0 flex-1"><span className="block font-medium text-zinc-100 break-words group-hover:text-amber-200">{d.titulo}</span>{d.fecha && <span className="text-xs text-zinc-500">{formatDisplayDate(d.fecha, 'medium')}</span>}</span>
                        <ArrowUpRight className="w-4 h-4 text-amber-300 shrink-0" />
                      </a>
                    ) : (
                      <div className="flex items-center gap-3 py-3"><Package className="w-5 h-5 text-violet-300 shrink-0" /><span className="font-medium text-zinc-100">{d.titulo}</span></div>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-zinc-500">Las entregas aparecen acá a medida que las compartimos.</p>}
          </Section>

          {aprobadas.length > 0 && (
            <Section title="Ya está">
              <ul className="space-y-2">
                {aprobadas.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span className="text-zinc-400">{t.titulo}{t.aprobadaEl && <span className="text-zinc-600"> · {formatDisplayDate(t.aprobadaEl, 'medium')}</span>}</span></li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="space-y-5">
          <Section title="Tu camino">
            <ol className="relative space-y-4">
              {PRESENCIA_HITOS.map((title, i) => {
                const n = i + 1;
                const state = n < hito ? 'done' : n === hito ? 'current' : 'pending';
                return (
                  <li key={title} className="relative flex items-center gap-3" aria-current={state === 'current' ? 'step' : undefined}>
                    {i < PRESENCIA_HITOS.length - 1 && <span aria-hidden className={`absolute left-[15px] top-8 h-4 w-px ${n < hito ? 'bg-emerald-500/60' : 'bg-zinc-800'}`} />}
                    <span className={`relative z-10 w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${state === 'done' ? 'bg-emerald-500 text-zinc-950' : state === 'current' ? 'bg-amber-400 text-zinc-950 ring-4 ring-amber-400/20' : 'bg-zinc-800 text-zinc-500'}`}>
                      {state === 'done' ? <Check className="w-4 h-4" /> : n}
                    </span>
                    <span className={`text-sm ${state === 'current' ? 'font-semibold text-zinc-100' : state === 'done' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {title}{state === 'current' && <span className="ml-2 text-xs font-medium text-amber-300">Estamos acá</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Section>

          <Section title="Próxima reunión">
            {p.proximaReunion ? (
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-amber-400/10 flex items-center justify-center shrink-0"><CalendarDays className="w-6 h-6 text-amber-400" /></span>
                <div><p className="font-medium text-zinc-100">{formatDisplayDate(p.proximaReunion.fecha, 'medium')}</p>{p.proximaReunion.hora && <p className="text-sm text-zinc-400">{p.proximaReunion.hora} hs (Argentina)</p>}</div>
              </div>
            ) : <p className="text-sm text-zinc-500">La vas a ver acá cuando la coordinemos.</p>}
          </Section>

          {links.length > 0 && (
            <Section title="Tus carpetas y enlaces">
              <ul className="grid gap-2">
                {links.map((k) => {
                  const Icon = LINK_ICON[k];
                  return (
                    <li key={k}>
                      <a href={p.enlaces[k]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-zinc-800/60 hover:bg-zinc-800 px-4 py-3 text-sm transition">
                        <Icon className="w-4 h-4 text-amber-300 shrink-0" /><span className="flex-1 font-medium">{PAF_PORTAL_LINK_LABEL[k]}</span><ArrowUpRight className="w-4 h-4 text-zinc-500" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
        </div>
      </div>

      <footer className="border-t border-zinc-800 pt-5 text-xs text-zinc-500 flex flex-wrap items-center justify-between gap-3">
        <span>.CERO · Actualizado {formatDisplayDate(p.actualizadoEn.slice(0, 10), 'medium')}</span>
        <LogoutButton email={email} onLogout={onLogout} />
      </footer>
    </Shell>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
      <h2 className="font-semibold text-zinc-100">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, tone = 'text-zinc-100' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`text-3xl font-semibold tracking-tight mt-1 ${tone}`}>{value}</p>
    </div>
  );
}
