import React, { useEffect, useState } from 'react';
import { Copy, Loader2, ShieldCheck } from 'lucide-react';
import { Project } from '../types';
import {
  CLIENTE_ID_RE, PAF_PORTAL_LINK_KEYS, PAF_PORTAL_LINK_LABEL, PRESENCIA_HITOS,
  buildPafPortal, emptyPortalDraft, normalizeEmails, type PafPortalDoc, type PafPortalDraft,
} from '../portal/model';
import { publishPafPortal, subscribePafPortal, unpublishPafPortal } from '../portal/store';
import { hapticFeedback } from '../utils/haptics';

const input = 'w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';

/**
 * En la ficha PAF: lo que Juan decide mostrar en el portal con login (/portal).
 * El borrador queda en el proyecto; "Publicar" copia solo eso a paf_portal/{ID}.
 * No manda nada al cliente: el enlace lo pasa Juan por su canal.
 */
export const PafPortalCard: React.FC<{ project: Project; onUpdateProject: (id: string, updates: Partial<Project>) => void }> = ({ project, onUpdateProject }) => {
  const [clienteId, setClienteId] = useState(project.pafClienteId || '');
  const [draft, setDraft] = useState<PafPortalDraft>(project.pafPortal || emptyPortalDraft(project.clientEmail));
  const [emailsText, setEmailsText] = useState((project.pafPortal?.emails || draft.emails).join(', '));
  const [published, setPublished] = useState<PafPortalDoc | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');

  const savedId = project.pafClienteId && CLIENTE_ID_RE.test(project.pafClienteId) ? project.pafClienteId : '';
  useEffect(() => {
    if (!savedId) { setPublished(null); return; }
    return subscribePafPortal(savedId, setPublished);
  }, [savedId]);

  const set = (patch: Partial<PafPortalDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const portalUrl = `${window.location.origin}/portal`;

  const publish = async () => {
    hapticFeedback.light();
    const nextDraft = { ...draft, emails: normalizeEmails(emailsText) };
    const result = buildPafPortal({ clienteId, estudio: project.clientName, draft: nextDraft });
    if ('errors' in result) { setErrors(result.errors); return; }
    setBusy(true); setErrors([]); setNotice('');
    try {
      await publishPafPortal(result.doc);
      onUpdateProject(project.id, { pafClienteId: result.doc.clienteId, pafPortal: { ...nextDraft, publishedAt: result.doc.actualizadoEn } });
      setNotice('Publicado. Pasale el enlace por tu canal.');
    } catch {
      setErrors(['No se pudo publicar. Revisá la conexión y reintentá.']);
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    if (!savedId || !window.confirm(`¿Despublicar el portal de ${project.clientName}? El estudio deja de verlo.`)) return;
    setBusy(true); setErrors([]); setNotice('');
    try {
      await unpublishPafPortal(savedId);
      setNotice('Portal despublicado.');
    } catch {
      setErrors(['No se pudo despublicar. Reintentá.']);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(portalUrl); setNotice('Enlace copiado.'); } catch { setNotice(portalUrl); }
  };

  return (
    <div className="space-y-2.5 pt-3 border-t border-zinc-800">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <h3 className="text-xs font-bold text-zinc-100 flex-1">Portal con cuenta de Google</h3>
        <span className="text-[10px] text-zinc-400">{published ? `Publicado · ${new Date(published.actualizadoEn).toLocaleDateString('es-AR')}` : 'Sin publicar'}</span>
      </div>
      <p className="text-[11px] text-zinc-400">Solo lo ven los correos de abajo, entrando con su cuenta. Usá el mismo correo con el que se compartió su carpeta.</p>

      <label className="block text-[11px] text-zinc-400">ID del cliente
        <input className={input} value={clienteId} disabled={!!published} placeholder="PAF-002" onChange={(e) => setClienteId(e.target.value.toUpperCase())} />
      </label>
      <label className="block text-[11px] text-zinc-400">Correos autorizados
        <input className={input} value={emailsText} placeholder="estudio@gmail.com, socia@gmail.com" onChange={(e) => setEmailsText(e.target.value)} />
      </label>
      <label className="block text-[11px] text-zinc-400">Etapa que ve el estudio
        <select className={input} value={draft.hito} onChange={(e) => set({ hito: Number(e.target.value) })}>
          {PRESENCIA_HITOS.map((t, i) => <option key={t} value={i + 1}>{i + 1}. {t}</option>)}
        </select>
      </label>
      <label className="block text-[11px] text-zinc-400">Resumen para el estudio
        <textarea className={input} rows={3} value={draft.resumen} onChange={(e) => set({ resumen: e.target.value })} placeholder="Esta semana cerramos el foco y arrancamos con el mensaje." />
      </label>
      <div className="grid grid-cols-1 gap-1.5">
        {PAF_PORTAL_LINK_KEYS.map((k) => (
          <label key={k} className="block text-[11px] text-zinc-400">{PAF_PORTAL_LINK_LABEL[k]}
            <input className={input} value={draft.enlaces[k] || ''} placeholder="https://" onChange={(e) => set({ enlaces: { ...draft.enlaces, [k]: e.target.value } })} />
          </label>
        ))}
      </div>
      <p className="text-[10px] text-zinc-500">No pongas la carpeta interna ni la ficha: esto lo ve el estudio.</p>

      {errors.length > 0 && <ul role="alert" className="text-[11px] text-rose-300 space-y-0.5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      {notice && <p role="status" className="text-[11px] text-emerald-300">{notice}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={publish} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 text-zinc-950 px-3 py-1.5 text-xs font-bold disabled:opacity-60">
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{published ? 'Actualizar portal' : 'Publicar portal'}
        </button>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 text-xs font-bold">
          <Copy className="w-3.5 h-3.5" /> Copiar enlace
        </button>
        {published && (
          <button type="button" onClick={unpublish} disabled={busy} className="rounded-xl px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/10">Despublicar</button>
        )}
      </div>
    </div>
  );
};
