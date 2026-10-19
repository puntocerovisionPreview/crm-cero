import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, FileText, Receipt, Share2, Trash2 } from 'lucide-react';
import { StudioDocument, deleteDocument, docTitle, docTotal } from '../utils/documents';
import { DocumentPrefill } from '../components/DocumentEditorModal';

interface Props {
  documents: StudioDocument[];
  today: string;
  privacyMode?: boolean;
  onNew: (prefill: DocumentPrefill) => void;
  onShare: (doc: StudioDocument) => void;
  onNavigate: (path: string) => void;
  showToast?: (msg: string) => void;
}

type Filter = 'todos' | 'presupuesto' | 'recibo';
const money = (n: number, cur: string, privacy?: boolean) => (privacy ? '••••' : `${cur === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`);
const shortDay = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

// Presupuestos y recibos enviados, con su estado
export const DocumentsView: React.FC<Props> = ({ documents, today, privacyMode, onNew, onShare, onNavigate, showToast }) => {
  const [filter, setFilter] = useState<Filter>('todos');
  const list = useMemo(() => documents.filter(d => filter === 'todos' || d.kind === filter), [documents, filter]);
  const pending = documents.filter(d => d.kind === 'presupuesto' && d.status === 'enviado' && (!d.validUntil || d.validUntil >= today));
  const accepted = documents.filter(d => d.kind === 'presupuesto' && d.status === 'aceptado');

  const status = (d: StudioDocument) => {
    if (d.kind === 'recibo') return { label: 'Recibo', cls: 'text-[var(--text-tertiary)]', icon: Receipt };
    if (d.status === 'aceptado') return { label: `Aceptado${d.acceptedAt ? ` el ${shortDay(d.acceptedAt)}` : ''}`, cls: 'text-[var(--semantic-green)] font-semibold', icon: CheckCircle2 };
    if (d.validUntil && d.validUntil < today) return { label: 'Vencido', cls: 'text-[var(--semantic-red)]', icon: Clock };
    return { label: `Esperando respuesta${d.validUntil ? ` · vence ${shortDay(d.validUntil)}` : ''}`, cls: 'text-[var(--semantic-amber)]', icon: Clock };
  };

  const remove = async (d: StudioDocument) => {
    if (!window.confirm(`¿Borrar ${docTitle(d)} de ${d.clientName}? El link deja de funcionar.`)) return;
    try {
      await deleteDocument(d);
      showToast?.('Documento borrado');
    } catch (err) {
      showToast?.(`No se pudo borrar: ${(err as Error).message}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full space-y-5 pb-28">
      <header className="px-1 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">Documentos</h1>
            <p className="text-[14px] text-[var(--text-secondary)]">
              {pending.length} {pending.length === 1 ? 'presupuesto esperando respuesta' : 'presupuestos esperando respuesta'} · {accepted.length} aceptados
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onNew({ kind: 'presupuesto' })} className="h-9 px-4 rounded-full bg-[var(--accent)] text-white text-[14px] font-semibold flex items-center gap-1.5 cursor-pointer">
              <FileText className="w-4 h-4" aria-hidden /> Presupuesto
            </button>
            <button type="button" onClick={() => onNew({ kind: 'recibo' })} className="h-9 px-4 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[14px] font-medium text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer">
              <Receipt className="w-4 h-4" aria-hidden /> Recibo
            </button>
          </div>
        </div>
        <div role="tablist" aria-label="Filtrar" className="inline-flex p-[3px] rounded-[10px] bg-[var(--bg-surface-muted)]/70">
          {([['todos', 'Todos'], ['presupuesto', 'Presupuestos'], ['recibo', 'Recibos']] as [Filter, string][]).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`px-3.5 h-8 rounded-[8px] text-[14px] cursor-pointer ${filter === k ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-[var(--text-secondary)] font-medium'}`}>
              {l}
            </button>
          ))}
        </div>
      </header>

      {list.length === 0 ? (
        <div className="card-swiss p-8 text-center">
          <p className="text-[17px] font-semibold text-[var(--text-primary)]">Todavía no hay documentos</p>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">Armá un presupuesto con link: el cliente lo ve, lo baja en PDF y lo acepta con un toque.</p>
        </div>
      ) : (
        <ul className="card-swiss divide-y divide-[var(--border-subtle)] overflow-hidden p-0">
          {list.map(d => {
            const st = status(d);
            return (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`w-9 h-9 rounded-[10px] flex items-center justify-center text-white shrink-0 ${d.kind === 'presupuesto' ? 'bg-[#007AFF]' : 'bg-[#34C759]'}`} aria-hidden>
                  {d.kind === 'presupuesto' ? <FileText className="w-[18px] h-[18px]" /> : <Receipt className="w-[18px] h-[18px]" />}
                </span>
                <button type="button" onClick={() => (d.projectId ? onNavigate(`/clientes/${d.projectId}`) : onShare(d))} className="flex-1 min-w-0 text-left cursor-pointer">
                  <span className="block text-[15px] text-[var(--text-primary)] truncate">
                    {d.clientName}
                    <span className="ml-1.5 font-semibold tabular-nums">{money(docTotal(d.items), d.currency, privacyMode)}</span>
                  </span>
                  <span className="block text-[12px] text-[var(--text-tertiary)] truncate">{docTitle(d)} · {shortDay(d.issueDate)}</span>
                  <span className={`block text-[12px] ${st.cls}`}>{st.label}</span>
                </button>
                <button type="button" onClick={() => onShare(d)} aria-label="Compartir" title="Compartir" className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[var(--accent)] hover:bg-[var(--bg-surface-muted)] cursor-pointer">
                  <Share2 className="w-4 h-4" aria-hidden />
                </button>
                <button type="button" onClick={() => remove(d)} aria-label="Borrar" title="Borrar" className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--semantic-red)] hover:bg-[var(--bg-surface-muted)] cursor-pointer">
                  <Trash2 className="w-4 h-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default DocumentsView;
