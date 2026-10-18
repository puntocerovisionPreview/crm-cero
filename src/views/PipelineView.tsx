import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, FileText, Phone, Send, X } from 'lucide-react';
import type { DocumentPrefill } from '../components/DocumentEditorModal';
import { Project, Prospect } from '../types';
import { useProspecting } from '../prospecting/useProspecting';
import { recordProspectAction, updateProspect } from '../prospecting/store';
import { prospectToProject } from '../prospecting/convert';
import { ProspectAction } from '../prospecting/core';
import { PIPELINE_COLUMNS, PipelineColumn, PipelineItem, buildPipeline, openTotals } from '../utils/pipeline';
import { daysBetween } from '../utils/coldClients';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';

interface Props {
  projects: Project[];
  privacyMode?: boolean;
  onAddProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onNavigate: (path: string) => void;
  showToast?: (msg: string) => void;
  onNewQuote?: (prefill: DocumentPrefill) => void;
}

const money = (n: number, cur: 'ARS' | 'USD', privacy?: boolean) =>
  privacy ? '••••' : `${cur === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`;

// Tablero de oportunidades: el embudo de ventas desde que el prospecto responde hasta que firma
export const PipelineView: React.FC<Props> = ({ projects, privacyMode, onAddProject, onUpdateProject, onNavigate, showToast, onNewQuote }) => {
  const { prospects, settings, today, loadError } = useProspecting();
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const items = useMemo(() => buildPipeline(prospects || [], projects, today), [prospects, projects, today]);
  const totals = useMemo(() => openTotals(items), [items]);
  const contacting = (prospects || []).filter(p => p.stage === 'contactado').length;

  const act = async (item: PipelineItem, action: 'call' | 'proposal_sent' | 'won' | 'lost') => {
    hapticFeedback.medium();
    setBusy(item.id);
    try {
      if (item.kind === 'prospect' && item.prospect) {
        if (action === 'won') {
          onAddProject(prospectToProject(item.prospect, today));
          playTaskDone();
        }
        await recordProspectAction(item.prospect, action as ProspectAction, today, settings, action === 'lost' ? 'Desde el tablero de oportunidades' : undefined);
      } else if (item.project) {
        if (action === 'won') {
          onUpdateProject(item.id, { isLead: false, status: 'En curso', lastContactDate: today });
          playTaskDone();
        } else if (action === 'lost') {
          onUpdateProject(item.id, { archived: true });
        }
      }
      if (action === 'won') showToast?.(`¡${item.title} es cliente!`);
    } catch (err) {
      showToast?.(`No se guardó: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const saveValue = async (item: PipelineItem, raw: string, currency: 'ARS' | 'USD') => {
    const value = Number(raw.replace(/[^\d]/g, '')) || undefined;
    setEditingValue(null);
    if (item.kind === 'prospect') await updateProspect(item.id, { dealValue: value, dealCurrency: currency } as Partial<Prospect>);
    else onUpdateProject(item.id, { estimatedPrice: value, estimatedCurrency: currency });
  };

  const actionsFor = (col: PipelineColumn, item: PipelineItem) => {
    const btn = 'h-7 px-2.5 rounded-full text-[12px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-40';
    if (col === 'ganado' || col === 'perdido') return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {col === 'conversacion' && item.kind === 'prospect' && (
          <button type="button" disabled={busy === item.id} onClick={() => act(item, 'call')} className={`${btn} bg-[var(--bg-surface-muted)] text-[var(--text-primary)]`}>
            <Phone className="w-3.5 h-3.5" aria-hidden /> Llamada
          </button>
        )}
        {col !== 'propuesta' && item.kind === 'prospect' && (
          <button type="button" disabled={busy === item.id} onClick={() => act(item, 'proposal_sent')} className={`${btn} bg-[var(--bg-surface-muted)] text-[var(--text-primary)]`}>
            <Send className="w-3.5 h-3.5" aria-hidden /> Propuesta
          </button>
        )}
        {onNewQuote && (
          <button
            type="button"
            onClick={() =>
              onNewQuote({
                kind: 'presupuesto',
                projectId: item.kind === 'lead' ? item.id : undefined,
                prospectId: item.kind === 'prospect' ? item.id : undefined,
                clientName: item.title,
                contactName: item.prospect?.name || item.project?.ownerName,
                phone: item.prospect?.whatsapp || item.project?.clientPhone,
                email: item.prospect?.email,
                currency: item.currency,
                items: [{ description: '', quantity: 1, unitPrice: item.value || 0 }],
              })
            }
            className={`${btn} bg-[var(--bg-surface-muted)] text-[var(--text-primary)]`}
          >
            <FileText className="w-3.5 h-3.5" aria-hidden /> Presupuesto
          </button>
        )}
        <button type="button" disabled={busy === item.id} onClick={() => act(item, 'won')} className={`${btn} bg-[#34C759] text-white`}>
          <Check className="w-3.5 h-3.5" aria-hidden /> Ganado
        </button>
        <button type="button" disabled={busy === item.id} onClick={() => act(item, 'lost')} className={`${btn} text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)]`}>
          <X className="w-3.5 h-3.5" aria-hidden /> Perdido
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-28">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">Oportunidades</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Del primer "sí, contame" a la firma. Tocá un paso para avanzar.</p>
        </div>
        <dl className="flex gap-6">
          <div>
            <dd className="text-[22px] font-bold tabular-nums text-[var(--text-primary)]">{totals.count}</dd>
            <dt className="text-[12px] text-[var(--text-secondary)]">abiertas</dt>
          </div>
          {(totals.USD > 0 || totals.ARS > 0) && (
            <div>
              <dd className="text-[22px] font-bold tabular-nums text-[var(--semantic-green)]">
                {[totals.USD ? money(totals.USD, 'USD', privacyMode) : '', totals.ARS ? money(totals.ARS, 'ARS', privacyMode) : ''].filter(Boolean).join(' + ')}
              </dd>
              <dt className="text-[12px] text-[var(--text-secondary)]">en juego{totals.sinValor ? ` (${totals.sinValor} sin valor)` : ''}</dt>
            </div>
          )}
        </dl>
      </header>

      {loadError && <p className="px-1 text-[14px] text-[var(--semantic-amber)]">No se pudo leer la prospección: {loadError}</p>}
      {contacting > 0 && (
        <button type="button" onClick={() => onNavigate('/prospeccion')} className="mx-1 text-[13px] text-[var(--accent)] flex items-center gap-1 cursor-pointer">
          {contacting} contactados esperando respuesta en Prospección <ArrowRight className="w-3.5 h-3.5" aria-hidden />
        </button>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar">
        {PIPELINE_COLUMNS.map(col => {
          const colItems = items.filter(i => i.column === col.key);
          return (
            <section key={col.key} aria-label={col.label} className="snap-start shrink-0 w-[290px] rounded-[18px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] p-3 flex flex-col gap-2.5 max-h-[calc(100dvh-260px)]">
              <header className="flex items-center gap-2 px-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.tint }} aria-hidden />
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] flex-1">{col.label}</h2>
                <span className="text-[13px] tabular-nums text-[var(--text-tertiary)]">{colItems.length}</span>
              </header>
              {col.hint && <p className="px-1 -mt-1.5 text-[12px] text-[var(--text-tertiary)]">{col.hint}</p>}

              <ul className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
                {colItems.length === 0 && <li className="px-1 py-6 text-center text-[13px] text-[var(--text-tertiary)]">Nada por acá.</li>}
                {colItems.map(item => {
                  const stale = item.since ? daysBetween(item.since, today) : 0;
                  return (
                    <li key={`${item.kind}-${item.id}`} className="rounded-[14px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3 space-y-2 shadow-[var(--shadow-card)]">
                      <button
                        type="button"
                        onClick={() => onNavigate(item.kind === 'lead' ? `/clientes/${item.id}` : '/prospeccion')}
                        className="w-full text-left cursor-pointer"
                      >
                        <span className="block text-[15px] font-semibold text-[var(--text-primary)] truncate">{item.title}</span>
                        <span className="block text-[12px] text-[var(--text-tertiary)] truncate">
                          {[item.subtitle, item.kind === 'lead' ? 'Posible cliente' : null, stale >= 1 && col.key !== 'ganado' && col.key !== 'perdido' ? `hace ${stale} días` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </button>

                      {/* Valor de la oportunidad */}
                      {editingValue === `${item.kind}-${item.id}` ? (
                        <form
                          className="flex items-center gap-1.5"
                          onSubmit={e => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            saveValue(item, String(f.get('valor') || ''), (f.get('moneda') as 'ARS' | 'USD') || item.currency);
                          }}
                        >
                          <select name="moneda" defaultValue={item.currency} aria-label="Moneda" className="h-8 rounded-[8px] bg-[var(--bg-surface-muted)] border-0 text-[13px] px-1.5">
                            <option value="USD">US$</option>
                            <option value="ARS">$</option>
                          </select>
                          <input name="valor" autoFocus inputMode="numeric" defaultValue={item.value || ''} aria-label="Valor" placeholder="Valor" className="flex-1 min-w-0 h-8 rounded-[8px] bg-[var(--bg-surface-muted)] border-0 px-2 text-[14px] tabular-nums" />
                          <button type="submit" className="h-8 px-2.5 rounded-[8px] bg-[var(--accent)] text-white text-[12px] font-semibold">OK</button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingValue(`${item.kind}-${item.id}`)}
                          className={`text-[14px] font-semibold tabular-nums cursor-pointer ${item.value ? 'text-[var(--text-primary)]' : 'text-[var(--accent)] font-medium text-[13px]'}`}
                        >
                          {item.value ? money(item.value, item.currency, privacyMode) : '+ Poner valor'}
                        </button>
                      )}

                      {stale >= 7 && (col.key === 'propuesta' || col.key === 'llamada') && (
                        <p className="text-[12px] text-[var(--semantic-amber)]">Hace {stale} días sin novedades: escribile.</p>
                      )}
                      {actionsFor(col.key, item)}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default PipelineView;
