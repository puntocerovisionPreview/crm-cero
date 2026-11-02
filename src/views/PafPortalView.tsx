import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { CalendarDays, Check, ExternalLink, Loader2, LogOut } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { auth } from '../firebaseAuth';
import { signInWithGoogle, signOutUser } from '../utils/authAccess';
import { PAF_PORTAL_LINK_KEYS, PAF_PORTAL_LINK_LABEL, PRESENCIA_HITOS, type PafPortalDoc } from '../portal/model';
import { subscribeMyPafPortals } from '../portal/store';

/**
 * /portal: el estudio entra con su cuenta de Google (el mismo correo con el que se
 * compartió su carpeta) y ve solo su paf_portal. Las reglas de Firestore hacen el control.
 */
export const PafPortalView: React.FC = () => {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [portals, setPortals] = useState<PafPortalDoc[] | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    document.title = 'Mi portal · Método PAF';
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    setPortals(null); setError(''); setSelected(0);
    if (!user?.email || !user.emailVerified) return;
    return subscribeMyPafPortals(user.email, setPortals, () => setError('No pudimos cargar tu portal. Revisá tu conexión y volvé a intentar.'));
  }, [user]);

  const login = async () => {
    setError('');
    try { await signInWithGoogle(); } catch { setError('No se pudo iniciar sesión. Probá de nuevo.'); }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] px-4 py-6">
      <div className="mx-auto max-w-lg space-y-6"><BrandLogo size="sm" />{children}</div>
    </div>
  );

  if (user === undefined || (user && portals === null && !error)) {
    return shell(<div role="status" className="flex items-center justify-center gap-3 py-24 text-zinc-400"><Loader2 className="w-5 h-5 animate-spin" /> Cargando…</div>);
  }

  if (!user) {
    return shell(
      <div className="text-center py-16 space-y-4">
        <h1 className="text-xl font-semibold">Tu portal del Método PAF</h1>
        <p className="text-sm text-zinc-400">Entrá con la cuenta de Google con la que compartimos tu carpeta.</p>
        <button type="button" onClick={login} className="rounded-xl bg-amber-400 text-zinc-950 px-4 py-2 text-sm font-semibold">Entrar con Google</button>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      </div>
    );
  }

  const logout = (
    <button type="button" onClick={() => signOutUser()} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200">
      <LogOut className="w-3.5 h-3.5" /> Salir ({user.email})
    </button>
  );

  if (error || !portals?.length) {
    return shell(
      <div className="text-center py-16 space-y-4">
        <h1 className="text-xl font-semibold">{error ? 'No pudimos cargar tu portal' : 'Esta cuenta no tiene un portal'}</h1>
        <p className="text-sm text-zinc-400">{error || `Entraste como ${user.email}. Usá el correo con el que compartimos tu carpeta, o avisale a tu equipo de .CERO.`}</p>
        {logout}
      </div>
    );
  }

  const p = portals[Math.min(selected, portals.length - 1)];
  const links = PAF_PORTAL_LINK_KEYS.filter((k) => p.enlaces?.[k]);
  return shell(
    <>
      <header className="space-y-2">
        {portals.length > 1 && (
          <select aria-label="Estudio" value={selected} onChange={(e) => setSelected(Number(e.target.value))} className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1 text-sm">
            {portals.map((x, i) => <option key={x.clienteId} value={i}>{x.estudio}</option>)}
          </select>
        )}
        <h1 className="text-2xl font-semibold">{p.estudio}</h1>
        {p.resumenVisible && <p className="text-sm text-zinc-300 whitespace-pre-line">{p.resumenVisible}</p>}
      </header>

      <section aria-label="Etapas" className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Presencia</h2>
        <ol className="space-y-2">
          {PRESENCIA_HITOS.map((title, i) => {
            const n = i + 1;
            const state = n < p.hitoVisible ? 'done' : n === p.hitoVisible ? 'current' : 'pending';
            return (
              <li key={title} className="flex items-center gap-3 text-sm" aria-current={state === 'current' ? 'step' : undefined}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${state === 'done' ? 'bg-emerald-500 text-zinc-950' : state === 'current' ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-zinc-500'}`}>
                  {state === 'done' ? <Check className="w-3.5 h-3.5" /> : n}
                </span>
                <span className={state === 'pending' ? 'text-zinc-500' : ''}>{title}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {p.proximaReunion && (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 flex items-center gap-3 text-sm">
          <CalendarDays className="w-4 h-4 text-amber-400" /> Próxima reunión: {p.proximaReunion.fecha}{p.proximaReunion.hora ? ` · ${p.proximaReunion.hora}` : ''}
        </section>
      )}

      {p.tareas?.length > 0 && (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Tus tareas</h2>
          {p.tareas.map((t) => (
            <div key={t.id} className="text-sm"><span className="font-medium">{t.titulo}</span>{t.fecha && <span className="text-zinc-500"> · {t.fecha}</span>}{t.detalle && <p className="text-zinc-400">{t.detalle}</p>}</div>
          ))}
        </section>
      )}

      {p.entregas?.length > 0 && (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Entregas</h2>
          {p.entregas.map((d) => (
            <div key={d.id} className="text-sm">{d.enlace ? <a href={d.enlace} target="_blank" rel="noopener noreferrer" className="underline">{d.titulo}</a> : d.titulo}{d.fecha && <span className="text-zinc-500"> · {d.fecha}</span>}</div>
          ))}
        </section>
      )}

      {links.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {links.map((k) => (
            <a key={k} href={p.enlaces[k]} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl bg-zinc-800 hover:bg-zinc-700 px-3 py-2.5 text-sm font-medium">
              {PAF_PORTAL_LINK_LABEL[k]} <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>
          ))}
        </section>
      )}

      <footer className="pt-2">{logout}</footer>
    </>
  );
};
