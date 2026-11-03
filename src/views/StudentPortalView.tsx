import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { PafClientExperience } from '../components/PafClientExperience';
import { type StudentPortalSnapshot, subscribeStudentPortal } from '../utils/studentPortal';
import type { PanelSnapshot } from '../panels/model';
import { subscribePanelSnapshot } from '../panels/store';

/** Un solo enlace por estudio, sin login; solo lee las copias destinadas al cliente. */
export const StudentPortalView: React.FC<{ token: string }> = ({ token }) => {
  const [data, setData] = useState<StudentPortalSnapshot | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [panel, setPanel] = useState<PanelSnapshot | null>(null);
  const [panelError, setPanelError] = useState(false);

  useEffect(() => {
    setPanel(null); setPanelError(false);
    return subscribePanelSnapshot(token, (snapshot) => { setPanel(snapshot); setPanelError(false); }, () => { setPanel(null); setPanelError(true); });
  }, [token]);

  useEffect(() => {
    document.title = 'Mi programa · Método PAF';
    setData(null); setState('loading');
    if (!/^[a-f0-9]{24,64}$/.test(token)) { setState('missing'); return; }
    return subscribeStudentPortal(token, (snapshot) => {
      setData(snapshot); setState(snapshot ? 'ready' : 'missing');
    }, () => setState('error'));
  }, [token]);

  if (state === 'ready' && data) return <PafClientExperience key={token} data={data} panel={panel} panelError={panelError} token={token} />;
  return <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] p-6">
    <div className="mx-auto max-w-lg py-8"><BrandLogo size="sm" />
      {state === 'loading' ? <div role="status" className="flex items-center justify-center gap-3 py-24 text-zinc-400"><Loader2 className="w-5 h-5 animate-spin" /> Cargando tu programa…</div> :
        <div className="text-center py-20 space-y-3"><h1 className="text-xl font-semibold">{state === 'error' ? 'No pudimos cargar tu programa' : 'Este enlace no está disponible'}</h1><p className="text-sm text-zinc-400">{state === 'error' ? 'Revisá tu conexión y volvé a intentar.' : 'Pedile a tu equipo de .Cero el enlace de tu programa.'}</p>{state === 'error' && <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-amber-400 text-zinc-950 px-4 py-2 text-sm font-semibold">Volver a intentar</button>}</div>}
    </div>
  </div>;
};
