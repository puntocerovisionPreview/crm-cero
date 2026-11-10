import React, { useState } from 'react';
import { Check, Link2, Loader2, Pin, Send } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { newItemId } from '../panels/model';
import { republishIfPublished } from '../portal/store';
import { NOVEDAD_TIPO_HINT, NOVEDAD_TIPO_LABEL, aplicarNovedad, leerNovedad, type NovedadTipo } from '../portal/novedad';
import { esVideo } from '../portal/ultimo';
import { hapticFeedback } from '../utils/haptics';

const TIPOS: NovedadTipo[] = ['novedad', 'entrega', 'pedido'];

/**
 * Una sola caja para mostrarle algo al cliente: escribís como se lo dirías, pegás un link si hay,
 * y sale a su portal. Se da cuenta sola si es una novedad, una entrega o un pedido (y lo podés cambiar).
 */
export const PafNovedadBox: React.FC<{
  project: Project;
  meetings: AgendaMeeting[];
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  compact?: boolean;
  autoFocus?: boolean;
}> = ({ project, meetings, onUpdateProject, compact, autoFocus }) => {
  const [raw, setRaw] = useState('');
  const [tipoManual, setTipoManual] = useState<NovedadTipo | null>(null);
  const [fijar, setFijar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const leida = leerNovedad(raw);
  const tipo = tipoManual || leida.tipo;
  const publicado = !!(project.pafClienteId && project.pafPortal?.publishedAt);
  const nombre = project.clientName;

  const publicar = async () => {
    if (busy) return;
    const r = aplicarNovedad(project, raw, { tipo, fijar: tipo === 'novedad' && fijar, newId: newItemId });
    if ('error' in r) { setMsg({ ok: false, texto: r.error }); return; }
    const updates = r.updates as Partial<Project>;
    setBusy(true);
    onUpdateProject(project.id, updates);
    try {
      await republishIfPublished({ ...project, ...updates }, meetings);
      hapticFeedback.success();
      setMsg({ ok: true, texto: publicado ? `Listo: ${nombre} ya lo ve en su portal.` : 'Guardado. Lo va a ver cuando publiques el portal.' });
      setRaw(''); setTipoManual(null); setFijar(false);
    } catch (e) {
      setRaw(''); setTipoManual(null); setFijar(false);
      setMsg({ ok: false, texto: (e as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <section className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] ${compact ? 'p-3' : 'p-4'}`} aria-label={`Novedad para ${nombre}`}>
      {!compact && (
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Contale algo a {nombre}</h3>
          <p className="text-[11px] text-[var(--text-tertiary)]">{publicado ? 'Sale a su portal al toque' : 'El portal todavía no está publicado'}</p>
        </div>
      )}
      <textarea
        value={raw}
        autoFocus={autoFocus}
        onChange={(e) => { setRaw(e.target.value); setMsg(null); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); publicar(); } }}
        rows={compact ? 2 : 3}
        maxLength={1200}
        placeholder={'Escribilo como se lo dirías: “Esta semana dejamos lista la home”. Si pegás un link (Drive, Loom, Figma), va con su botón.'}
        aria-label="Novedad"
        className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-strong)] focus:outline-none"
      />

      {(raw.trim() || !compact) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Cómo le aparece">
            {TIPOS.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => setTipoManual(t)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${tipo === t ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-surface)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'}`}>
                {NOVEDAD_TIPO_LABEL[t]}
              </button>
            ))}
          </div>
          {tipo === 'novedad' && (
            <button type="button" aria-pressed={fijar} onClick={() => setFijar((v) => !v)} title="Queda arriba de todo hasta que la saques"
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${fijar ? 'border-amber-400/60 text-amber-500' : 'border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-[var(--border-strong)]'}`}>
              <Pin className="w-3 h-3" />Fijar arriba
            </button>
          )}
          <span className="flex-1" />
          <button type="button" onClick={publicar} disabled={busy || !raw.trim()}
            className="inline-flex items-center gap-1.5 btn-solid-primary px-3.5 py-1.5 text-xs disabled:opacity-40">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}{publicado ? 'Publicar' : 'Guardar'}
          </button>
        </div>
      )}

      {raw.trim() && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--text-tertiary)]">
          <span>{NOVEDAD_TIPO_HINT[tipo]}</span>
          {leida.link && <span className="inline-flex min-w-0 items-center gap-1"><Link2 className="w-3 h-3 shrink-0" /><span className="truncate max-w-[16rem]">{esVideo(leida.link) && tipo === 'novedad' ? 'Video: le aparece como un mensaje tuyo' : leida.link.replace(/^https:\/\//, '')}</span></span>}
        </p>
      )}
      {msg && (
        <p role="status" className={`mt-2 flex items-center gap-1.5 text-xs ${msg.ok ? 'text-emerald-500' : 'text-rose-500'}`}>
          {msg.ok && <Check className="w-3.5 h-3.5" />}{msg.texto}
        </p>
      )}
    </section>
  );
};
