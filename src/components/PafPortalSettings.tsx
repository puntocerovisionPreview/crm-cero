import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { MATERIALES, PORTAL_SECCIONES, safeHttpsUrl, normalizeLinkInput, seccionesVisibles, type PafPortalDraft, type PortalSeccion } from '../portal/model';

const input = 'w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';
const linkOk = (v?: string) => !v?.trim() || !!safeHttpsUrl(normalizeLinkInput(v));

/**
 * QUÉ VE TU CLIENTE: cada sección del portal se prende o apaga. Lo que apagás no se manda al
 * portal (no queda escondido: directamente no viaja). Las que pueden comprometerte vienen apagadas.
 */
export const PortalSectionsToggles: React.FC<{ draft: PafPortalDraft; onChange: (patch: Partial<PafPortalDraft>) => void }> = ({ draft, onChange }) => {
  const ver = seccionesVisibles(draft.secciones);
  const set = (id: PortalSeccion, v: boolean) => onChange({ secciones: { ...draft.secciones, [id]: v } });
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {PORTAL_SECCIONES.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => set(s.id, !ver[s.id])} aria-pressed={ver[s.id]}
            className={`w-full flex items-start gap-2 rounded-lg border p-2 text-left transition ${ver[s.id] ? 'border-zinc-700 bg-white/[0.03]' : 'border-zinc-800 opacity-70'}`}>
            {ver[s.id] ? <Eye className="mt-0.5 w-3.5 h-3.5 shrink-0 text-emerald-400" /> : <EyeOff className="mt-0.5 w-3.5 h-3.5 shrink-0 text-zinc-500" />}
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-zinc-100">{s.label}</span>
              <span className="block text-[10px] text-zinc-500">{s.hint}{!s.porDefecto && ' · apagada de entrada'}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};

/** Bienvenida (PDF), Gestión de contenido (app de la CM) y las 4 subcarpetas de Materiales */
export const PortalLinksEditor: React.FC<{ draft: PafPortalDraft; onChange: (patch: Partial<PafPortalDraft>) => void }> = ({ draft, onChange }) => (
  <div className="space-y-3">
    <label className="block text-[11px] text-zinc-400">Bienvenida (el PDF 00_BIENVENIDA de su carpeta)
      <input className={input} value={draft.bienvenida || ''} placeholder="https://drive.google.com/file/d/…" onChange={(e) => onChange({ bienvenida: e.target.value })} />
      {!linkOk(draft.bienvenida) && <span className="text-amber-300">Ese link no se puede abrir.</span>}
    </label>
    <label className="block text-[11px] text-zinc-400">Gestión de contenido (su espacio en la app de la CM)
      <input className={input} value={draft.gestionContenido || ''} placeholder="Sin link, el botón dice «Aún no disponible»" onChange={(e) => onChange({ gestionContenido: e.target.value })} />
      {!linkOk(draft.gestionContenido) && <span className="text-amber-300">Ese link no se puede abrir.</span>}
    </label>
    <div className="space-y-1.5">
      <p className="text-[11px] text-zinc-400">Materiales: las subcarpetas de 02_Materiales (cada tarjeta le explica qué subir)</p>
      {MATERIALES.map((m) => (
        <label key={m.id} className="flex items-center gap-2 text-[11px] text-zinc-400">
          <span className="w-28 shrink-0">{m.label}</span>
          <input className={input} value={draft.materiales?.[m.id] || ''} placeholder="https://drive.google.com/drive/folders/…" onChange={(e) => onChange({ materiales: { ...draft.materiales, [m.id]: e.target.value } })} />
        </label>
      ))}
    </div>
  </div>
);

/** Tus números: los cargás vos, con su fuente. El cliente los ve si “Tus números” está prendido. */
export const NumerosEditor: React.FC<{ draft: PafPortalDraft; onChange: (patch: Partial<PafPortalDraft>) => void }> = ({ draft, onChange }) => {
  const items = draft.numeros || [];
  const set = (id: string, patch: Partial<{ label: string; valor: string; fuente: string }>) => onChange({ numeros: items.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  return (
    <div className="space-y-1.5">
      {items.map((n) => (
        <div key={n.id} className="flex flex-wrap items-center gap-1.5">
          <input className={`${input} w-24`} value={n.valor} placeholder="1.240" aria-label="Valor" onChange={(e) => set(n.id, { valor: e.target.value })} />
          <input className={`${input} flex-1 min-w-[8rem]`} value={n.label} placeholder="Qué es (ej. Consultas del mes)" aria-label="Qué es" onChange={(e) => set(n.id, { label: e.target.value })} />
          <input className={`${input} flex-1 min-w-[8rem]`} value={n.fuente} placeholder="Fuente y período (ej. Registro, octubre)" aria-label="Fuente" onChange={(e) => set(n.id, { fuente: e.target.value })} />
          <button type="button" aria-label="Borrar" onClick={() => onChange({ numeros: items.filter((x) => x.id !== n.id) })} className="text-xs text-zinc-500 hover:text-rose-300">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange({ numeros: [...items, { id: `${Date.now().toString(36)}`, label: '', valor: '', fuente: '' }] })} className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-[11px] font-bold text-zinc-200">+ Número</button>
    </div>
  );
};
