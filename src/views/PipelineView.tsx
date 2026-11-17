import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, FileText, Folder, Phone, Send, X } from 'lucide-react';
import type { DocumentPrefill } from '../components/DocumentEditorModal';
import { Project, Prospect } from '../types';
import { useProspecting } from '../prospecting/useProspecting';
import { recordProspectAction, updateProspect } from '../prospecting/store';
import { prospectToProject } from '../prospecting/convert';
import { ProspectAction } from '../prospecting/core';
import { PIPELINE_COLUMNS, PipelineColumn, PipelineItem, buildPipeline, openTotals } from '../utils/pipeline';
import { EmbudoMes, FilaEmbudo, Interes, MOMENTOS, PASOS_EMBUDO, embudoDelMes, etapaDeLead, etapaDeProspecto, interesDeProject } from '../utils/ventaEtapas';
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
  const { prospects, events, settings, today, loadError } = useProspecting();
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editingCarpeta, setEditingCarpeta] = useState<string | null>(null);
  const [openEtapa, setOpenEtapa] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const items = useMemo(() => buildPipeline(prospects || [], projects, today), [prospects, projects, today]);
  const embudo = useMemo(() => embudoDelMes(events, prospects || [], projects, today.slice(0, 7)), [events, prospects, projects, today]);

  // ---- Paso a paso de venta: Web/PAF, checklist de la etapa y carpeta ----
  const interesOf = (item: PipelineItem): Interes | undefined =>
    item.kind === 'prospect' ? item.prospect?.interes : item.project ? interesDeProject(item.project) : undefined;
  const checksOf = (item: PipelineItem) => (item.kind === 'prospect' ? item.prospect?.ventaChecks : item.project?.ventaChecks) || {};
  const carpetaOf = (item: PipelineItem) => (item.kind === 'prospect' ? item.prospect?.carpetaUrl : item.project?.carpetaUrl);

  const saveVenta = async (item: PipelineItem, updates: { interes?: Interes; ventaChecks?: Record<string, boolean>; carpetaUrl?: string }) => {
    try {
      if (item.kind === 'prospect') await updateProspect(item.id, updates as Partial<Prospect>);
      else {
        const { interes, ...rest } = updates;
        onUpdateProject(item.id, {
          ...rest,
          ...(interes ? { serviceType: interes, projectType: interes === 'web' ? 'web' : 'paf_pro' } : {}),
        });
      }
    } catch (err) {
      showToast?.(`No se guardó: ${(err as Error).message}`);
    }
  };

  const toggleCheck = (item: PipelineItem, id: string) => {
    hapticFeedback.selection();
    const next = { ...checksOf(item), [id]: !checksOf(item)[id] };
    saveVenta(item, { ventaChecks: next });
  };
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
          onUpdateProject(item.id, { isLead: false, status: 'En curso', lastContactDate: today, wonAt: today });
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

      <EmbudoDelMes embudo={embudo} month={today.slice(0, 7)} />

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

                      {col.key !== 'perdido' && (
                        <VentaBox
                          item={item}
                          interes={interesOf(item)}
                          checks={checksOf(item)}
                          carpeta={carpetaOf(item)}
                          open={openEtapa === `${item.kind}-${item.id}`}
                          editingCarpeta={editingCarpeta === `${item.kind}-${item.id}`}
                          onToggleOpen={() => setOpenEtapa(o => (o === `${item.kind}-${item.id}` ? null : `${item.kind}-${item.id}`))}
                          onInteres={i => saveVenta(item, { interes: i })}
                          onToggleCheck={id => toggleCheck(item, id)}
                          onEditCarpeta={() => setEditingCarpeta(`${item.kind}-${item.id}`)}
                          onSaveCarpeta={url => {
                            setEditingCarpeta(null);
                            saveVenta(item, { carpetaUrl: url.trim() || undefined });
                          }}
                        />
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

// ---------------- Embudo del mes: los cinco números, en Web y PAF ----------------

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const EmbudoDelMes: React.FC<{ embudo: Record<FilaEmbudo, EmbudoMes>; month: string }> = ({ embudo, month }) => {
  const hasSin = PASOS_EMBUDO.some(p => embudo.sin[p.key] > 0);
  const filas: { key: FilaEmbudo; label: string }[] = [
    { key: 'web', label: 'Web' },
    { key: 'paf', label: 'PAF' },
    ...(hasSin ? [{ key: 'sin' as const, label: 'Sin definir' }] : []),
  ];
  const total = (k: keyof EmbudoMes) => embudo.web[k] + embudo.paf[k] + embudo.sin[k];
  const mes = MESES[Number(month.slice(5, 7)) - 1] || '';
  return (
    <section aria-label="Embudo del mes" className="mx-1 rounded-[18px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-3 sm:p-4 overflow-x-auto">
      <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">Embudo de {mes}</h2>
      <table className="w-full min-w-[460px] text-[13px] tabular-nums">
        <thead>
          <tr className="text-[var(--text-tertiary)]">
            <th className="text-left font-medium py-1 pr-2" scope="col"><span className="sr-only">Servicio</span></th>
            {PASOS_EMBUDO.map(p => (
              <th key={p.key} className="text-right font-medium py-1 px-1.5" scope="col">{p.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(f => (
            <tr key={f.key} className="border-t border-[var(--border-subtle)]">
              <th scope="row" className="text-left font-medium py-1.5 pr-2 text-[var(--text-secondary)]">{f.label}</th>
              {PASOS_EMBUDO.map(p => (
                <td key={p.key} className="text-right py-1.5 px-1.5 text-[var(--text-primary)]">{embudo[f.key][p.key]}</td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-[var(--border-strong)] font-semibold">
            <th scope="row" className="text-left py-1.5 pr-2 text-[var(--text-primary)]">Total</th>
            {PASOS_EMBUDO.map(p => (
              <td key={p.key} className="text-right py-1.5 px-1.5 text-[var(--text-primary)]">{total(p.key)}</td>
            ))}
          </tr>
        </tbody>
      </table>
      {hasSin && <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">Elegí Web o PAF en cada oportunidad para que no quede "sin definir".</p>}
    </section>
  );
};

// ---------------- En cada oportunidad: Web/PAF, etapa del paso a paso y carpeta ----------------

const VentaBox: React.FC<{
  item: PipelineItem;
  interes?: Interes;
  checks: Record<string, boolean>;
  carpeta?: string;
  open: boolean;
  editingCarpeta: boolean;
  onToggleOpen: () => void;
  onInteres: (i: Interes) => void;
  onToggleCheck: (id: string) => void;
  onEditCarpeta: () => void;
  onSaveCarpeta: (url: string) => void;
}> = ({ item, interes, checks, carpeta, open, editingCarpeta, onToggleOpen, onInteres, onToggleCheck, onEditCarpeta, onSaveCarpeta }) => {
  const actual =
    item.kind === 'prospect' && item.prospect
      ? etapaDeProspecto({ ...item.prospect, ventaChecks: checks })
      : item.project
        ? etapaDeLead({ ...item.project, ventaChecks: checks })
        : null;
  const chip = (i: Interes, label: string) => (
    <button
      type="button"
      onClick={() => onInteres(i)}
      aria-pressed={interes === i}
      className={`h-6 px-2.5 rounded-full text-[12px] font-medium cursor-pointer ${
        interes === i ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {chip('web', 'Web')}
        {chip('paf', 'PAF')}
        <span className="flex-1" />
        {editingCarpeta ? null : carpeta ? (
          <a href={carpeta} target="_blank" rel="noreferrer" className="h-6 px-2 rounded-full text-[12px] font-medium flex items-center gap-1 text-[var(--accent)] hover:bg-[var(--bg-surface-muted)]">
            <Folder className="w-3.5 h-3.5" aria-hidden /> Carpeta
          </a>
        ) : (
          <button type="button" onClick={onEditCarpeta} className="h-6 px-2 rounded-full text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] flex items-center gap-1 cursor-pointer">
            <Folder className="w-3.5 h-3.5" aria-hidden /> + Carpeta
          </button>
        )}
      </div>

      {editingCarpeta && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={e => {
            e.preventDefault();
            onSaveCarpeta(String(new FormData(e.currentTarget).get('carpeta') || ''));
          }}
        >
          <input name="carpeta" autoFocus defaultValue={carpeta || ''} aria-label="Link de la carpeta en Drive" placeholder="Pegá el link de Drive" className="flex-1 min-w-0 h-8 rounded-[8px] bg-[var(--bg-surface-muted)] border-0 px-2 text-[13px]" />
          <button type="submit" className="h-8 px-2.5 rounded-[8px] bg-[var(--accent)] text-white text-[12px] font-semibold">OK</button>
        </form>
      )}

      {actual && (
        <>
          <button type="button" onClick={onToggleOpen} aria-expanded={open} className="w-full flex items-center gap-1.5 text-left text-[12px] cursor-pointer">
            <span className="font-semibold text-[var(--text-primary)]">
              {actual.n === 0 ? 'Esperando la auto auditoría' : actual.etapa ? `Etapa ${actual.n} de 9 · ${actual.etapa.titulo}` : 'Las 9 etapas listas'}
            </span>
            {actual.etapa && <span className="text-[var(--text-tertiary)] tabular-nums">{actual.hechos}/{actual.total}</span>}
            {actual.etapa && <ChevronDown className={`w-3.5 h-3.5 ml-auto text-[var(--text-tertiary)] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />}
          </button>
          {open && actual.etapa && (
            <div className="rounded-[10px] bg-[var(--bg-surface-muted)] p-2 space-y-1">
              <p className="text-[11px] text-[var(--text-tertiary)]">{MOMENTOS[actual.etapa.momento]} · antes de seguir</p>
              {actual.etapa.checks.map(c => (
                <label key={c.id} className="flex items-start gap-2 text-[12px] text-[var(--text-primary)] cursor-pointer">
                  <input type="checkbox" checked={!!checks[c.id]} onChange={() => onToggleCheck(c.id)} className="mt-0.5 accent-[var(--accent)]" />
                  <span>{c.text}</span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PipelineView;
