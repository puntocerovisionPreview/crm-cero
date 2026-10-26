import React, { useEffect, useState } from 'react';
import { driveApi } from '../automation/driveApi';
export const DriveSettings: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = () => driveApi('/api/drive/status').then(setStatus).catch(e => setError(e.message));
  useEffect(() => { void load(); }, []);
  const act = async (connect: boolean) => {
    setBusy(true); setError('');
    try {
      const result = await driveApi(`/api/drive/${connect ? 'connect' : 'disconnect'}`, {});
      if (connect) window.location.assign(result.url);
      else await load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <section className="rounded-xl border border-[var(--border-subtle)] p-4 space-y-3">
    <h3 className="font-semibold">Google Drive · Carpetas de clientes</h3>
    <p className="text-sm">{!status ? 'Consultando conexión…' : status.error ? `Error: ${status.error}` : status.connected ? `Conectado con ${status.email}` : 'Desconectado'}</p>
    <p className="text-sm text-[var(--text-secondary)]">Los nuevos proyectos Web preparan sus carpetas, panel, tareas y propuesta de arranque. Las invitaciones a las carpetas llegan por correo de Google.</p>
    {status && !status.configured && <p className="text-sm text-amber-500">Falta completar la configuración del servidor. Seguí la guía de conexión de Drive del proyecto.</p>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <button disabled={busy || !status?.configured} onClick={() => act(true)} className="px-3 py-2 bg-[var(--accent)] text-white rounded-lg disabled:opacity-40">{busy ? 'Procesando…' : status?.connected ? 'Volver a conectar' : 'Conectar Google Drive'}</button>
      {status?.connected && <button disabled={busy} onClick={() => window.confirm('¿Desconectar Drive? Las carpetas existentes se conservan y las acciones nuevas quedarán pendientes.') && act(false)} className="px-3 py-2 border rounded-lg">Desconectar</button>}
      <button disabled={busy} onClick={load} className="px-3 py-2">Revisar estado</button>
    </div>
  </section>;
};
