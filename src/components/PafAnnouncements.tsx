import React, { useState } from 'react';
import { ExternalLink, Pin, Trash2 } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { newItemId } from '../panels/model';
import { safeHttpsUrl, type PafAnnouncement } from '../portal/model';
import { republishIfPublished } from '../portal/store';

/** Para no escribir siempre lo mismo: se completan y se editan antes de publicar */
const ANNOUNCEMENT_TEMPLATES = [
  { titulo: 'Bienvenida', texto: '¡Bienvenido a tu portal! Acá vas a ver en qué estamos, lo que necesitamos de vos y todo lo que te entregamos.' },
  { titulo: 'Entrega lista', texto: 'Ya tenés una entrega nueva. Mirala con calma y anotá lo que cambiarías: lo vemos en la próxima reunión.' },
  { titulo: 'Recordatorio', texto: 'Te recuerdo que tenemos tareas pendientes de tu lado. Cuando las termines, tocá “Terminé”.' },
  { titulo: 'Reunión confirmada', texto: 'Confirmamos nuestra próxima reunión. La tenés abajo con el botón para agregarla a tu calendario.' },
  { titulo: 'Cerramos etapa', texto: '¡Cerramos esta etapa! Gracias por el trabajo. En la próxima reunión arrancamos con lo que sigue.' },
];

const input = 'w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';

/**
 * Anuncios para el estudio: texto corto (obligatorio), título y link opcionales, y fijar arriba.
 * "Publicar" lo muestra en el portal al instante (si el portal está publicado).
 */
export const PafAnnouncements: React.FC<{
  project: Project;
  meetings: AgendaMeeting[];
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  showForm?: boolean;
  onDone?: () => void;
  /** Sin título propio (cuando va dentro de una sección que ya lo tiene) */
  bare?: boolean;
}> = ({ project, meetings, onUpdateProject, showForm = true, onDone, bare }) => {
  const items = [...(project.pafAnuncios || [])].sort((a, b) => Number(!!b.fijado) - Number(!!a.fijado) || b.creadoEn.localeCompare(a.creadoEn));
  const [f, setF] = useState({ texto: '', titulo: '', link: '', fijado: false });
  const [error, setError] = useState('');

  const save = (next: PafAnnouncement[]) => {
    setError('');
    onUpdateProject(project.id, { pafAnuncios: next });
    republishIfPublished({ ...project, pafAnuncios: next }, meetings).catch((e: Error) => setError(e.message));
  };
  const update = (id: string, patch: Partial<PafAnnouncement>) => save((project.pafAnuncios || []).map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const add = (publicado: boolean) => {
    if (!f.texto.trim()) { setError('Escribí el texto del anuncio.'); return; }
    const link = f.link.trim() ? safeHttpsUrl(f.link) : null;
    if (f.link.trim() && !link) { setError('El link tiene que empezar con https://'); return; }
    save([...(project.pafAnuncios || []), {
      id: newItemId(), texto: f.texto.trim(), publicado, creadoEn: new Date().toISOString(),
      ...(f.titulo.trim() ? { titulo: f.titulo.trim() } : {}), ...(link ? { link } : {}), ...(f.fijado ? { fijado: true } : {}),
    }]);
    setF({ texto: '', titulo: '', link: '', fijado: false });
    onDone?.();
  };

  return (
    <section className="space-y-2">
      {!bare && <div>
        <h3 className="text-xs font-bold text-zinc-100">Anuncios</h3>
        <p className="text-[11px] text-zinc-500">Lo primero que ve el cliente.</p>
      </div>}

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((a) => (
            <li key={a.id} className={`rounded-lg border p-2 text-xs space-y-1 ${a.publicado ? 'border-zinc-800' : 'border-dashed border-zinc-700'}`}>
              <div className="flex items-start gap-2">
                <span className="flex-1 min-w-0 text-zinc-100">
                  {a.titulo && <span className="block font-semibold">{a.titulo}</span>}
                  <span className="block text-zinc-300 whitespace-pre-line">{a.texto}</span>
                  {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-sky-300">Link <ExternalLink className="w-3 h-3" /></a>}
                </span>
                <span className="shrink-0 text-[10px] text-zinc-500">{a.publicado ? 'Publicado' : 'Sin publicar'}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <button type="button" onClick={() => update(a.id, { publicado: !a.publicado })} className="rounded-lg bg-zinc-800 text-zinc-300 px-2 py-1">{a.publicado ? 'Ocultar' : 'Publicar'}</button>
                <button type="button" onClick={() => update(a.id, { fijado: !a.fijado })} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${a.fijado ? 'bg-amber-400/15 text-amber-300' : 'bg-zinc-800 text-zinc-300'}`}><Pin className="w-3 h-3" />{a.fijado ? 'Fijado' : 'Fijar'}</button>
                <button type="button" aria-label="Borrar anuncio" onClick={() => window.confirm('¿Borrar este anuncio?') && save((project.pafAnuncios || []).filter((x) => x.id !== a.id))} className="ml-auto text-zinc-500 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5" aria-label="Plantillas">
          {ANNOUNCEMENT_TEMPLATES.map((t) => (
            <button key={t.titulo} type="button" onClick={() => setF({ ...f, titulo: t.titulo, texto: t.texto })} className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-500">{t.titulo}</button>
          ))}
        </div>
        <textarea className={input} rows={2} value={f.texto} placeholder="Ej: Esta semana arrancamos con tu web. Ya tenés el borrador en tu carpeta." onChange={(e) => setF({ ...f, texto: e.target.value })} />
        <div className="flex gap-1.5">
          <input className={input} value={f.titulo} placeholder="Título (opcional)" onChange={(e) => setF({ ...f, titulo: e.target.value })} />
          <input className={input} value={f.link} placeholder="Link (opcional, https://)" onChange={(e) => setF({ ...f, link: e.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => add(true)} className="btn-solid-primary px-3 py-1.5 text-xs">Publicar anuncio</button>
          <label className="flex items-center gap-1 text-[11px] text-zinc-400"><input type="checkbox" checked={f.fijado} onChange={(e) => setF({ ...f, fijado: e.target.checked })} />Fijar arriba</label>
          <button type="button" onClick={() => add(false)} className="ml-auto text-[11px] text-zinc-500 hover:text-zinc-300">Guardar sin publicar</button>
        </div>
      </div>}
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
    </section>
  );
};
