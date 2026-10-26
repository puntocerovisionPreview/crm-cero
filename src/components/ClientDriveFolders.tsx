import React from 'react';
import type { ClientDriveFolder } from '../automation/webRecipe';
export const ClientDriveFolders: React.FC<{ folders?: ClientDriveFolder[] }> = ({ folders }) => {
  if (!folders?.length) return null;
  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3">
    <h2 className="font-semibold text-zinc-100">Tus carpetas</h2>
    <p className="text-sm text-zinc-400">Abrilas con el correo con el que te compartimos el acceso.</p>
    <div className="grid gap-2 sm:grid-cols-2">{folders.map(f => <a key={f.key} href={f.url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-zinc-800 px-3 py-3 text-sm text-zinc-100">{f.name}<span className="block text-xs text-zinc-400">{f.role === 'writer' ? 'Abrir y subir archivos' : 'Ver entregables'}</span></a>)}</div>
  </section>;
};
